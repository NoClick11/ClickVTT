<?php

namespace App\Nucleo\Combate;

use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\Sistema;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use Illuminate\Validation\ValidationException;

/**
 * Desconta o dano de um personagem: imunidade, resistência e vulnerabilidade ao tipo, Pontos de Escudo, condições "até receber dano",
 * Superioridade Absoluta do atacante e o Hóspede Feérico. Usado pelo botão "Aplicar" do chat e pelas Técnicas de Salvaguarda.
 * O valor do dano nunca vem do cliente. `aplicar` roda DENTRO de uma transação (quem chama a abre); `avisar` vem depois dela.
 */
final class AplicarDano
{
    public function __construct(private readonly FichaCampos $fichas) {}

    /**
     * @param  list<string>  $ignora  defesas que o dano ignora (densidade e balanço da arma forjada)
     * @param  array<string, mixed>  $contexto  de onde vem o dano, para as reduções do sistema: `origem` (`ataque` comum, `tecnica`, `salvaguarda`),
     *                                          e na salvaguarda `atributo` e `passou`
     * @return array{p: Personagem, calculo: array, total: int, tipo: ?string, campos: array, acabaram: list<string>, hospedes: list<array>, execucao: ?array, aviso: ?string}
     */
    public function aplicar(Mesa $mesa, int $personagemId, Sistema $sistema, int $total, ?string $tipo, array $ignora = [], ?int $atacanteId = null, array $contexto = []): array
    {
        $p = Personagem::query()->whereKey($personagemId)->lockForUpdate()->firstOrFail();
        $ficha = $p->fichaCompleta($sistema);
        if (($ficha['hospedado'] ?? null) !== null) {
            throw ValidationException::withMessages(['mensagem_id' => "{$p->nome} está hospedado no espaço de outro personagem: ataque o hospedeiro."]);
        }
        $calculo = Dano::calcular($ficha, $total, $tipo, $ignora);
        // Reações defensivas armadas (reserva de redução, Corpo de Criatura): o sistema reduz o dano já calculado
        $absorcao = null;
        if (method_exists($sistema, 'absorverDano') && $calculo['final'] > 0) {
            $contexto['usados'] = $this->usadosNaRodada($mesa, $personagemId);
            $absorcao = $sistema->absorverDano($ficha, $calculo['final'], $contexto);
            $calculo['final'] = $absorcao['final'];
            foreach ($absorcao['marcar'] ?? [] as $chave) {
                $this->marcarNaRodada($mesa, $personagemId, $chave);
            }
        }
        // Pontos de Escudo (Haki do Armamento) absorvem antes dos PV temporários, com a resistência do sistema
        if (method_exists($sistema, 'escudoResiste') && (int) ($ficha['pv']['escudo'] ?? 0) > 0) {
            $pv = Dano::noPvComEscudo($ficha['pv'], $calculo['final'], $sistema->escudoResiste($ficha, $tipo));
            $campos = ['pv.atual' => $pv['atual'], 'pv.temp' => $pv['temp'], 'pv.escudo' => $pv['escudo']];
        } else {
            $pv = Dano::noPv($ficha['pv'] ?? [], $calculo['final']);
            $campos = ['pv.atual' => $pv['atual'], 'pv.temp' => $pv['temp']];
        }

        $tempAntes = (int) ($ficha['pv']['temp'] ?? 0);
        $tempDepois = (int) ($pv['temp'] ?? 0);
        $tempAbsorvido = max(0, $tempAntes - $tempDepois);
        $danoNoPv = max(0, $calculo['final'] - $tempAbsorvido);

        if ($absorcao && $absorcao['campos']) {
            $campos = [...$campos, ...$absorcao['campos']];
        }

        // Condições "até receber dano" (ex.: Atordoado de Instintos Animalescos) acabam com o dano.
        $acabaram = [];
        if ($calculo['final'] > 0) {
            foreach ($ficha['duracoes'] ?? [] as $id => $d) {
                if ($d['aoDano'] ?? false) {
                    $acabaram[] = $id;
                }
            }
            if ($acabaram) {
                $campos['condicoes'] = array_values(array_diff($ficha['condicoes'] ?? [], $acabaram));
                $campos['duracoes'] = array_diff_key($ficha['duracoes'] ?? [], array_flip($acabaram));
            }
        }
        // Superioridade Absoluta (e afins): o sistema pode mandar o dano zerar o alvo quando sobra pouco; o atacante ganha o bônus
        $execucao = null;
        if ($atacanteId && method_exists($sistema, 'execucao') && $pv['atual'] > 0 && $calculo['final'] > 0) {
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($atacanteId);
            $execucao = $atacante ? $sistema->execucao($atacante->fichaCompleta($sistema), $pv['atual']) : null;
            if ($execucao) {
                $campos['pv.atual'] = 0;
                $execucao = [$atacante, $execucao['campos']];
            }
        }
        $p->ficha = $this->fichas->aplicar($sistema, $p->ficha, $campos);
        $p->save();
        if ($execucao) {
            $execucao[0]->ficha = $this->fichas->aplicar($sistema, $execucao[0]->ficha, $execucao[1]);
            $execucao[0]->save();
        }

        // Hóspede Feérico: quem está no espaço deste alvo sofre METADE do dano que o alvo recebeu, ignorando as defesas dele.
        $hospedes = [];
        foreach ($mesa->personagens()->get() as $outro) {
            if ($outro->id === $p->id || (int) ($outro->ficha['hospedado'] ?? 0) !== $p->id) {
                continue;
            }
            $outraFicha = $outro->fichaCompleta($sistema);
            $pvHospede = Dano::noPv($outraFicha['pv'] ?? [], intdiv($calculo['final'], 2));
            $camposHospede = ['pv.atual' => $pvHospede['atual'], 'pv.temp' => $pvHospede['temp']];
            $outro->ficha = $this->fichas->aplicar($sistema, $outro->ficha, $camposHospede);
            $outro->save();
            $hospedes[] = [$outro, $camposHospede, intdiv($calculo['final'], 2)];
        }

        $aviso = $absorcao['aviso'] ?? null;

        return compact('p', 'calculo', 'total', 'tipo', 'campos', 'acabaram', 'hospedes', 'execucao', 'aviso', 'danoNoPv');
    }

    /** As chaves de "1 vez por rodada" que o personagem já gastou nesta rodada (ex.: `rompante`), guardadas no item dele no combate. */
    private function usadosNaRodada(Mesa $mesa, int $personagemId): array
    {
        $c = \App\Nucleo\Combate\CombateService::normalizar(Mesa::query()->whereKey($mesa->id)->first()?->combate);
        $item = collect($c['itens'])->firstWhere('personagem_id', $personagemId);

        return $c['fase'] === 'em_curso' && $item ? array_keys(array_filter($item['acoes'] ?? [], fn ($v) => (int) $v > 0)) : [];
    }

    private function marcarNaRodada(Mesa $mesa, int $personagemId, string $chave): void
    {
        $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
        $c = \App\Nucleo\Combate\CombateService::normalizar($m->combate);
        if ($c['fase'] !== 'em_curso') {
            return;
        }
        foreach ($c['itens'] as $i => $item) {
            if ($item['personagem_id'] === $personagemId) {
                $c['itens'][$i]['acoes'][$chave] = 1;
                $m->forceFill(['combate' => $c])->save();
                \App\Support\Transmitir::enviar($m, 'combate', ['combate' => $c, 'ator' => 0], ['mesa']);

                return;
            }
        }
    }

    /** Depois da transação: avisa as fichas (PV novos) e posta no chat o que aconteceu. Devolve o texto do dano do alvo. */
    public function avisar(Mesa $mesa, AcessoMesa $acesso, string $visibilidade, array $r, bool $postar = true): string
    {
        /** @var Personagem $alvo */
        $alvo = $r['p'];
        Duracoes::transmitir($mesa, $alvo, $r['campos'], $r['acabaram'] !== []);
        $danoFinal = (int) ($r['calculo']['final'] ?? 0);
        if ($danoFinal > 0) {
            \App\Support\Transmitir::enviar($mesa, 'combate-efeito', [
                'personagem_id' => $alvo->id,
                'delta' => -$danoFinal,
                'tipo' => 'dano',
            ], ['mesa']);
        }
        if ($r['execucao']) {
            Duracoes::transmitir($mesa, $r['execucao'][0], $r['execucao'][1]);
            self::postar($mesa, $acesso, $visibilidade, "{$alvo->nome} é derrotado por Superioridade Absoluta de {$r['execucao'][0]->nome}.");
        }
        foreach ($r['hospedes'] as [$hospede, $camposHospede, $parte]) {
            Duracoes::transmitir($mesa, $hospede, $camposHospede);
            if ($parte > 0) {
                \App\Support\Transmitir::enviar($mesa, 'combate-efeito', [
                    'personagem_id' => $hospede->id,
                    'delta' => -$parte,
                    'tipo' => 'dano',
                ], ['mesa']);
            }
            self::postar($mesa, $acesso, $visibilidade, "{$hospede->nome} sofreu {$parte} de dano como hóspede de {$alvo->nome}.");
        }
        $texto = self::texto($alvo->nome, $r['total'], $r['tipo'], $r['calculo']);
        if (! empty($r['aviso'])) {
            $texto .= ' '.$r['aviso'];
        }
        if ($postar) {
            self::postar($mesa, $acesso, $visibilidade, $texto);
        }

        if (($mesa->sistema->slug ?? '') === 'one-piece') {
            $this->verificarDanoBrutal($mesa, $acesso, $r);
        }

        return $texto;
    }

    /** Regra do Dano Brutal (One Piece): destaque exclusivo para o mestre quando um jogador sofre dano massivo. */
    private function verificarDanoBrutal(Mesa $mesa, AcessoMesa $acesso, array $r): void
    {
        /** @var Personagem $alvo */
        $alvo = $r['p'];
        if (! empty($alvo->ficha['npc'])) {
            return;
        }

        $danoNoPv = (int) ($r['danoNoPv'] ?? $r['calculo']['final'] ?? 0);
        if ($danoNoPv <= 0) {
            return;
        }

        $maxHp = (int) ($alvo->ficha['pv']['max'] ?? 0);
        if ($maxHp <= 0) {
            return;
        }

        if ($danoNoPv > ($maxHp * 2.0 / 3.0)) {
            $severidade = 'mortal';
        } elseif ($danoNoPv > ($maxHp / 2.0)) {
            $severidade = 'critico';
        } elseif ($danoNoPv > ($maxHp / 3.0)) {
            $severidade = 'grave';
        } else {
            return;
        }

        $mestreJogador = $mesa->jogadores()->where('papel', 'mestre')->first();
        $jogadorId = $mestreJogador?->id ?? $acesso->jogador->id;

        $msg = $mesa->mensagens()->create([
            'jogador_id' => $jogadorId,
            'personagem_id' => $alvo->id,
            'tipo' => 'dano_brutal',
            'visibilidade' => 'mestre',
            'texto' => "⚠️ Limiar de Dano Brutal ({$severidade}) atingido por {$alvo->nome}: {$danoNoPv} de dano.",
            'dados' => [
                'personagem_id' => $alvo->id,
                'personagem_nome' => $alvo->nome,
                'dano' => $danoNoPv,
                'severidade' => $severidade,
                'cd' => 16,
                'estado' => 'pendente',
                'resultado' => null,
            ],
        ]);

        $paraMestre = $mestreJogador ? $msg->para($mestreJogador) : $msg->para($acesso->jogador);
        if ($paraMestre) {
            \App\Support\Transmitir::enviar($mesa, 'mensagem', [
                'mensagem' => $paraMestre,
                'ator' => 0,
            ], ['mestre']);
        }
    }

    public static function texto(string $nome, int $total, ?string $tipo, array $calculo): string
    {
        $tipoTexto = filled($tipo) ? " de {$tipo}" : '';

        return match ($calculo['modo']) {
            'imune' => "{$nome} é imune a dano{$tipoTexto}: nenhum dano.",
            'imune_metade' => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto} (invulnerável, mas o golpe causa metade: {$total} pela metade).",
            'resistido' => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto} (resistência: {$total} pela metade).",
            'vulneravel' => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto} (vulnerável: {$total} em dobro).",
            default => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto}.",
        };
    }

    public static function postar(Mesa $mesa, AcessoMesa $acesso, string $visibilidade, string $texto): void
    {
        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => null, 'tipo' => 'texto',
            'visibilidade' => $visibilidade === 'secreto' ? 'mestre' : $visibilidade, 'texto' => $texto, 'dados' => null,
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);
    }
}
