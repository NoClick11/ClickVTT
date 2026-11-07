<?php

namespace App\Nucleo\Combate;

use App\Models\EventoDeCombate;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Eventos do combate com janela de reação. Hoje: o ataque com alvo (`ataque_declarado`). O núcleo segura o evento, descobre
 * quem tem reação aplicável (o sistema lê as fichas), oferece a cada um (modal privado), junta os MODIFICADORES que as
 * reações devolvem (ex.: +2 na defesa de quem foi atacado, mesmo que a reação seja de outro jogador) e, quando todos
 * responderam (ou o mestre encerra a janela), resolve e posta o resultado. Serve depois para outros gatilhos.
 */
final class Pipeline
{
    public const GATILHO_ATAQUE = 'ataque_declarado';

    public function __construct(
        private readonly RegistroSistemas $sistemas,
        private readonly CombateService $combate,
        private readonly FichaCampos $fichas,
        private readonly Rolador $rolador,
    ) {}

    /** Equipe do disposição: jogadores e aliados de um lado, inimigos do outro. */
    private static function equipe(string $disposicao): string
    {
        return $disposicao === 'inimigo' ? 'inimigos' : 'aliados';
    }

    /**
     * Um ataque foi rolado contra um alvo. Abre a janela de reação (se alguém pode reagir) ou resolve na hora. Devolve o
     * evento, ou null se não vale a pena (sem combate em curso, alvo igual ao atacante, sistema sem combate).
     */
    public function ataqueDeclarado(Mesa $mesa, AcessoMesa $acesso, Mensagem $mensagem, int $atacanteId, int $alvoId): ?EventoDeCombate
    {
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        $estado = CombateService::normalizar($mesa->combate);
        $alvo = Personagem::query()->where('mesa_id', $mesa->id)->find($alvoId);
        $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($atacanteId);
        if (! $sistema instanceof SistemaDeCombate || $estado['fase'] !== 'em_curso' || ! $alvo || ! $atacante || $alvo->id === $atacante->id) {
            return null;
        }

        $fichaAlvo = $alvo->fichaCompleta($sistema);
        $defesa = $sistema->defesa($sistema->variaveisDeRolagem($fichaAlvo, []));
        $contexto = [
            'mensagem_id' => $mensagem->id, 'atacante_id' => $atacante->id, 'alvo_id' => $alvo->id,
            'atacante' => $atacante->nome, 'alvo' => $alvo->nome, 'rotulo' => $mensagem->dados['rotulo'] ?? 'Ataque',
            'total' => (int) $mensagem->dados['total'], 'natural' => self::naturalDoD20($mensagem->dados['termos'] ?? []),
            'margem' => (int) ($mensagem->dados['sistema']['margem'] ?? 20), 'defesa' => $defesa,
        ];
        $ofertas = $this->ofertas($mesa, $sistema, $estado, $contexto);

        $evento = $mesa->eventosDeCombate()->create(['tipo' => 'ataque', 'estado' => 'aguardando', 'contexto' => $contexto, 'ofertas' => $ofertas, 'respostas' => []]);
        $this->marcarMensagem($mesa, $acesso, $mensagem, ['estado' => 'aguardando', 'evento_id' => $evento->id, 'defesa' => $defesa, 'alvo' => $alvo->nome, 'alvo_id' => $alvo->id]);

        if ($ofertas === []) {
            return $this->resolver($mesa, $acesso, $evento);
        }
        foreach ($ofertas as $personagemId => $lista) {
            $this->enviarOferta($mesa, $evento, (int) $personagemId, $lista);
        }
        $this->enviarResumo($mesa, $evento);

        return $evento;
    }

    /**
     * Quem pode reagir: todo participante (menos o atacante) com ao menos uma reação oferecida pelo sistema, com a categoria
     * disponível (reação por rodada), do lado do alvo e com o alcance da reação (`si`: só o alvo; `aliado`: outro da equipe
     * do alvo; `ambos`).
     *
     * @return array<int, list<array<string, mixed>>> personagem_id => ofertas
     */
    private function ofertas(Mesa $mesa, SistemaDeCombate $sistema, array $estado, array $contexto): array
    {
        $cats = collect($sistema->categoriasDeAcao())->keyBy('id');
        $itemAlvo = collect($estado['itens'])->firstWhere('personagem_id', $contexto['alvo_id']);
        $equipeAlvo = $itemAlvo ? self::equipe($itemAlvo['disposicao']) : 'aliados';
        $saida = [];
        foreach ($estado['itens'] as $item) {
            $pid = $item['personagem_id'];
            if ($pid === null || $pid === $contexto['atacante_id']) {
                continue;
            }
            $p = Personagem::query()->where('mesa_id', $mesa->id)->find($pid);
            if (! $p) {
                continue;
            }
            $ficha = $p->fichaCompleta($sistema);
            $lista = [];
            foreach ($sistema->ofertasDeReacao(self::GATILHO_ATAQUE, $contexto, $ficha, $sistema->variaveisDeRolagem($ficha, [])) as $o) {
                $cfg = $cats[$o['categoria'] ?? 'reacao'] ?? null;
                if ($cfg && ($cfg['porRodada'] ?? null) !== null && (int) ($item['acoes'][$cfg['id']] ?? 0) >= $cfg['porRodada']) {
                    continue; // já reagiu nesta rodada
                }
                $alcance = $o['alcance'] ?? 'si';
                $ehAlvo = $pid === $contexto['alvo_id'];
                $mesmaEquipe = self::equipe($item['disposicao']) === $equipeAlvo;
                $serve = ($ehAlvo && in_array($alcance, ['si', 'ambos'], true)) || (! $ehAlvo && $mesmaEquipe && in_array($alcance, ['aliado', 'ambos'], true));
                if ($serve) {
                    $lista[] = $o;
                }
            }
            if ($lista) {
                $saida[$pid] = $lista;
            }
        }

        return $saida;
    }

    /**
     * Um personagem responde a janela: passa (`$opcaoId` null) ou usa uma reação (paga o custo, gasta a categoria e soma o
     * modificador à defesa ou cura quem foi atacado). Quando todos responderam, resolve.
     */
    public function reagir(Mesa $mesa, AcessoMesa $acesso, EventoDeCombate $evento, int $personagemId, ?string $opcaoId): EventoDeCombate
    {
        abort_unless($acesso->podeControlar($personagemId), 403, 'Este personagem não é seu.');
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        abort_unless($sistema instanceof SistemaDeCombate, 422, 'Este sistema não tem combate.');

        $resolveuAgora = false;
        $campos = null;
        $cura = null;
        $e = DB::transaction(function () use ($mesa, $acesso, $evento, $personagemId, $opcaoId, $sistema, &$resolveuAgora, &$campos, &$cura) {
            $e = EventoDeCombate::query()->whereKey($evento->id)->lockForUpdate()->firstOrFail();
            if ($e->estado !== 'aguardando') {
                throw ValidationException::withMessages(['evento' => 'A janela de reação já fechou.']);
            }
            if (! isset($e->ofertas[$personagemId]) || isset($e->respostas[$personagemId])) {
                throw ValidationException::withMessages(['evento' => 'Este personagem não tem reação a responder.']);
            }
            $respostas = $e->respostas;
            if ($opcaoId === null) {
                $respostas[$personagemId] = ['passou' => true];
            } else {
                $oferta = collect($e->ofertas[$personagemId])->firstWhere('id', $opcaoId)
                    ?? throw ValidationException::withMessages(['opcao' => 'Reação indisponível.']);
                // A categoria gasta primeiro: se não puder (limite da rodada), nada é pago
                $this->combate->gastar($mesa, $acesso, $personagemId, $oferta['categoria'] ?? 'reacao');
                $p = Personagem::query()->whereKey($personagemId)->lockForUpdate()->firstOrFail();
                $ficha = $p->fichaCompleta($sistema);
                $pago = $sistema->pagarReacao($ficha, $oferta);
                if ($pago) {
                    $p->ficha = $this->fichas->aplicar($sistema, $p->ficha, $pago);
                    $p->save();
                    $campos = [$p, $pago];
                }
                $mods = [];
                foreach ($oferta['efeitos'] ?? [] as $ef) {
                    if (($ef['alvo'] ?? null) === 'defesa' && ($ef['modo'] ?? null) === 'soma') {
                        $mods[] = ['alvo' => 'defesa', 'valor' => $this->valor($ef['valor'])];
                    }
                }
                $respostas[$personagemId] = ['opcao' => $oferta['id'], 'rotulo' => $oferta['rotulo'], 'mods' => $mods, 'cura' => $oferta['cura'] ?? null];
                $cura = $oferta['cura'] ?? null;
            }
            $e->respostas = $respostas;
            $e->save();
            $resolveuAgora = $e->aguardando() === [];

            return $e;
        });

        if ($campos) {
            Duracoes::transmitir($mesa, $campos[0], $campos[1]);
        }
        if ($cura) {
            $this->curar($mesa, $sistema, (int) $e->contexto['alvo_id'], $this->valor($cura));
        }
        $this->enviarResumo($mesa, $e);

        return $resolveuAgora ? $this->resolver($mesa, $acesso, $e) : $e;
    }

    /** O mestre fecha a janela: quem não respondeu conta como "passou". */
    public function encerrar(Mesa $mesa, AcessoMesa $acesso, EventoDeCombate $evento): EventoDeCombate
    {
        abort_unless($acesso->ehMestre(), 403, 'Só o mestre encerra a janela de reação.');

        return $this->resolver($mesa, $acesso, $evento);
    }

    /**
     * Resolve o ataque: defesa = a de partida + os modificadores das reações; 1 natural sempre erra e o crítico (d20 puro na
     * margem) sempre acerta. Grava o resultado, marca a rolagem no chat (o botão de dano só abre no acerto) e avisa a mesa.
     */
    public function resolver(Mesa $mesa, AcessoMesa $acesso, EventoDeCombate $evento): EventoDeCombate
    {
        $e = DB::transaction(function () use ($evento) {
            $e = EventoDeCombate::query()->whereKey($evento->id)->lockForUpdate()->firstOrFail();
            if ($e->estado !== 'aguardando') {
                return $e;
            }
            $c = $e->contexto;
            $mods = [];
            foreach ($e->respostas as $r) {
                foreach ($r['mods'] ?? [] as $m) {
                    $mods[] = ['fonte' => $r['rotulo'], 'valor' => (int) $m['valor']];
                }
            }
            $defesa = $c['defesa'] + array_sum(array_column($mods, 'valor'));
            $critico = $c['natural'] !== null && $c['natural'] >= $c['margem'];
            $falha = $c['natural'] === 1;
            $acerto = ! $falha && ($critico || $c['total'] >= $defesa);
            $e->estado = 'resolvido';
            $e->resultado = ['acerto' => $acerto, 'critico' => $critico && $acerto, 'falha' => $falha, 'defesa' => $defesa, 'base' => $c['defesa'], 'mods' => $mods];
            $e->save();

            return $e;
        });

        $c = $e->contexto;
        $r = $e->resultado;
        $mensagem = $mesa->mensagens()->find($c['mensagem_id']);
        if ($mensagem) {
            $this->marcarMensagem($mesa, $acesso, $mensagem, ['estado' => 'resolvido', 'evento_id' => $e->id, 'alvo' => $c['alvo'], 'alvo_id' => $c['alvo_id'], ...$r]);
            $mods = $r['mods'] ? ' ('.implode(', ', array_map(fn ($m) => "{$m['fonte']} ".($m['valor'] >= 0 ? '+' : '').$m['valor'], $r['mods'])).')' : '';
            $texto = $r['acerto']
                ? "{$c['atacante']} ".($r['critico'] ? 'acerta um golpe crítico em' : 'acerta')." {$c['alvo']}: {$c['total']} contra defesa {$r['defesa']}{$mods}."
                : "{$c['atacante']} erra {$c['alvo']}: {$c['total']} contra defesa {$r['defesa']}{$mods}.";
            $aviso = $mesa->mensagens()->create(['jogador_id' => $mensagem->jogador_id, 'personagem_id' => null, 'tipo' => 'texto', 'visibilidade' => $mensagem->visibilidade === 'secreto' ? 'mestre' : $mensagem->visibilidade, 'texto' => $texto, 'dados' => null]);
            EntregarMensagem::para($mesa, $aviso, $acesso);
        }
        $this->enviarResumo($mesa, $e);

        return $e;
    }

    // --- apoio -----------------------------------------------------------------------------------------------------------

    /** Marca a rolagem do ataque com o andamento/resultado (o card mostra e libera o dano só no acerto) e a retransmite. */
    private function marcarMensagem(Mesa $mesa, AcessoMesa $acesso, Mensagem $mensagem, array $resolucao): void
    {
        $dados = $mensagem->dados;
        $dados['sistema'] = [...($dados['sistema'] ?? []), 'resolucao' => $resolucao];
        $mensagem->dados = $dados;
        $mensagem->save();
        EntregarMensagem::para($mesa, $mensagem, $acesso, substitui: true);
    }

    /** O d20 puro do ataque (o mantido, com vantagem ou desvantagem). */
    public static function naturalDoD20(array $termos): ?int
    {
        foreach ($termos as $t) {
            if (($t['tipo'] ?? null) !== 'dados' || ($t['faces'] ?? null) !== 20) {
                continue;
            }
            foreach ($t['resultados'] as $i => $v) {
                if (! in_array($i, $t['descartados'] ?? [], true)) {
                    return (int) $v;
                }
            }
        }

        return null;
    }

    /** Número ou dados (`2`, `1d4`): dados são rolados aqui, no servidor. */
    private function valor(mixed $v): int
    {
        return is_string($v) && str_contains($v, 'd') ? (int) $this->rolador->rolar($v)['total'] : (int) $v;
    }

    /** A reação cura quem foi atacado (até o máximo de PV). */
    private function curar(Mesa $mesa, SistemaDeCombate $sistema, int $alvoId, int $pontos): void
    {
        $alvo = DB::transaction(function () use ($mesa, $sistema, $alvoId, $pontos) {
            $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($alvoId)->lockForUpdate()->first();
            if (! $p) {
                return null;
            }
            $ficha = $p->fichaCompleta($sistema);
            $max = (int) ($sistema->variaveisDeRolagem($ficha, [])['pv.max'] ?? ($ficha['pv']['max'] ?? 0));
            $novo = min($max, (int) ($ficha['pv']['atual'] ?? 0) + max(0, $pontos));
            $p->ficha = $this->fichas->aplicar($sistema, $p->ficha, ['pv.atual' => $novo]);
            $p->save();

            return [$p, ['pv.atual' => $novo]];
        });
        if ($alvo) {
            Duracoes::transmitir($mesa, $alvo[0], $alvo[1]);
        }
    }

    /** Envia a oferta, em privado, a quem controla o personagem (sem jogador: ao mestre). */
    private function enviarOferta(Mesa $mesa, EventoDeCombate $evento, int $personagemId, array $opcoes): void
    {
        $p = Personagem::query()->find($personagemId);
        $canais = $p ? $p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all() : [];
        Transmitir::enviar($mesa, 'reacao', self::payloadDaOferta($evento, $personagemId, $opcoes, $p?->nome ?? '?'), $canais ?: ['mestre']);
    }

    /** O que o modal de reação precisa: o ataque (quem, contra quem, números) e as opções. */
    public static function payloadDaOferta(EventoDeCombate $evento, int $personagemId, array $opcoes, string $nome): array
    {
        $c = $evento->contexto;

        return [
            'evento_id' => $evento->id, 'personagem_id' => $personagemId, 'personagem' => $nome, 'titulo' => 'Reação ao ataque',
            'contexto' => ['atacante' => $c['atacante'], 'alvo' => $c['alvo'], 'alvo_id' => $c['alvo_id'], 'rotulo' => $c['rotulo'], 'total' => $c['total'], 'defesa' => $c['defesa']],
            'opcoes' => array_map(fn ($o) => ['id' => $o['id'], 'rotulo' => $o['rotulo'], 'descricao' => $o['descricao'] ?? '', 'custo' => $o['custo'] ?? [], 'cura' => $o['cura'] ?? null, 'defesa' => collect($o['efeitos'] ?? [])->where('alvo', 'defesa')->sum('valor')], $opcoes),
        ];
    }

    /** Resumo público da janela: quem ataca, quem é o alvo, quem ainda não respondeu e o resultado. */
    public static function resumo(EventoDeCombate $e): array
    {
        $nomes = fn (array $ids) => Personagem::query()->whereIn('id', $ids)->pluck('nome')->all();

        return [
            'id' => $e->id, 'estado' => $e->estado, 'atacante' => $e->contexto['atacante'], 'alvo' => $e->contexto['alvo'],
            'aguardando' => $e->estado === 'aguardando' ? $nomes($e->aguardando()) : [], 'resultado' => $e->resultado,
        ];
    }

    private function enviarResumo(Mesa $mesa, EventoDeCombate $e): void
    {
        Transmitir::enviar($mesa, 'evento', self::resumo($e), ['mesa']);
    }

    /**
     * Para quem entra ou recarrega a página: as janelas abertas e as ofertas dos personagens que ele controla.
     *
     * @return array{eventos: list<array<string, mixed>>, ofertas: list<array<string, mixed>>}
     */
    public function pendentesPara(Mesa $mesa, AcessoMesa $acesso): array
    {
        $eventos = $mesa->eventosDeCombate()->where('estado', 'aguardando')->get();
        $ofertas = [];
        foreach ($eventos as $e) {
            foreach ($e->aguardando() as $pid) {
                if ($acesso->podeControlar($pid)) {
                    $ofertas[] = self::payloadDaOferta($e, $pid, $e->ofertas[$pid], Personagem::query()->find($pid)?->nome ?? '?');
                }
            }
        }

        return ['eventos' => $eventos->map(fn ($e) => self::resumo($e))->values()->all(), 'ofertas' => $ofertas];
    }
}
