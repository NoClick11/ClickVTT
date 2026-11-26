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

    /** Dano sem jogada de ataque a caminho (Técnica de Salvaguarda, área): só as reações defensivas que mexem no dano. */
    public const GATILHO_DANO = 'dano_recebido';

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
     * Um ataque foi rolado contra um alvo. Rola contra a defesa: com o combate em curso abre a janela de reação (se alguém pode
     * reagir); fora do combate resolve na hora (não há quem reaja). Devolve o evento, ou null se não vale a pena (alvo igual ao
     * atacante, sistema sem combate).
     */
    public function ataqueDeclarado(Mesa $mesa, AcessoMesa $acesso, Mensagem $mensagem, int $atacanteId, int $alvoId): ?EventoDeCombate
    {
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        $estado = CombateService::normalizar($mesa->combate);
        $alvo = Personagem::query()->where('mesa_id', $mesa->id)->find($alvoId);
        $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($atacanteId);
        if (! $sistema instanceof SistemaDeCombate || ! $alvo || ! $atacante || $alvo->id === $atacante->id) {
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
        // reação é do combate: fora dele ninguém reage e o ataque resolve na hora
        $ofertas = $estado['fase'] === 'em_curso' ? $this->ofertas($mesa, $sistema, $estado, $contexto) : [];

        $evento = $mesa->eventosDeCombate()->create(['tipo' => 'ataque', 'estado' => 'aguardando', 'contexto' => $contexto, 'ofertas' => $ofertas, 'respostas' => []]);

        if ($ofertas === []) {
            return $this->resolver($mesa, $acesso, $evento);
        }

        $this->marcarMensagem($mesa, $acesso, $mensagem, ['estado' => 'aguardando', 'evento_id' => $evento->id, 'defesa' => $defesa, 'alvo' => $alvo->nome, 'alvo_id' => $alvo->id]);

        foreach ($ofertas as $personagemId => $lista) {
            $this->enviarOferta($mesa, $evento, (int) $personagemId, $lista);
        }
        $this->enviarResumo($mesa, $evento);

        return $evento;
    }

    /**
     * Dano sem jogada de ataque a caminho (Técnica de Salvaguarda, Técnica de área): com o combate em curso, abre a janela de reação do alvo (e dos
     * aliados que o protegem) ANTES de o dano sair, só com as reações defensivas que mexem no dano (reduzir, zerar, PV temporários, cura). A reação
     * arma o efeito na ficha e o dano, quando for aplicado, já passa por ele. Devolve o evento, ou null se ninguém pode reagir.
     */
    public function danoDeclarado(Mesa $mesa, AcessoMesa $acesso, Mensagem $mensagem, ?int $atacanteId, int $alvoId, string $rotulo, string $detalhe): ?EventoDeCombate
    {
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        $estado = CombateService::normalizar($mesa->fresh()->combate);
        if (! $sistema instanceof SistemaDeCombate || $estado['fase'] !== 'em_curso' || $alvoId === $atacanteId) {
            return null;
        }
        $alvo = Personagem::query()->where('mesa_id', $mesa->id)->find($alvoId);
        if (! $alvo) {
            return null;
        }
        $atacante = $atacanteId ? Personagem::query()->where('mesa_id', $mesa->id)->find($atacanteId) : null;
        $contexto = [
            'gatilho' => self::GATILHO_DANO, 'mensagem_id' => $mensagem->id, 'atacante_id' => $atacante?->id, 'alvo_id' => $alvo->id,
            'atacante' => $atacante?->nome ?? $rotulo, 'alvo' => $alvo->nome, 'rotulo' => $rotulo, 'detalhe' => $detalhe,
        ];
        $ofertas = $this->ofertas($mesa, $sistema, $estado, $contexto);
        if ($ofertas === []) {
            return null;
        }
        $evento = $mesa->eventosDeCombate()->create(['tipo' => 'dano', 'estado' => 'aguardando', 'contexto' => $contexto, 'ofertas' => $ofertas, 'respostas' => []]);
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
            foreach ($sistema->ofertasDeReacao($contexto['gatilho'] ?? self::GATILHO_ATAQUE, $contexto, $ficha, $sistema->variaveisDeRolagem($ficha, [])) as $o) {
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
    public function reagir(Mesa $mesa, AcessoMesa $acesso, EventoDeCombate $evento, int $personagemId, ?string $opcaoId, int $extra = 0): EventoDeCombate
    {
        abort_unless($acesso->podeControlar($personagemId), 403, 'Este personagem não é seu.');
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        abort_unless($sistema instanceof SistemaDeCombate, 422, 'Este sistema não tem combate.');

        $resolveuAgora = false;
        $campos = null;
        $cura = null;
        $rolagemDaReacao = null;
        $rolagemPv = null;
        $rotuloDaReacao = null;
        $e = DB::transaction(function () use ($mesa, $acesso, $evento, $personagemId, $opcaoId, $extra, $sistema, &$resolveuAgora, &$campos, &$cura, &$rolagemDaReacao, &$rolagemPv, &$rotuloDaReacao) {
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
                // Redução armada: dura até o fim do PRÓXIMO turno do dono (1 fim de turno dele se ainda vem; 2 se já está no turno dele)
                if (is_array($oferta['reducao'] ?? null)) {
                    $estado = CombateService::normalizar($mesa->fresh()->combate);
                    $noTurno = (CombateService::itemAtual($estado)['personagem_id'] ?? null) === $personagemId;
                    $oferta['reducao']['turnos'] = $noTurno ? 2 : 1;
                }
                $p = Personagem::query()->whereKey($personagemId)->lockForUpdate()->firstOrFail();
                $ficha = $p->fichaCompleta($sistema);
                $oferta['extra'] = max(0, $extra); // PP a mais na redução (o sistema limita ao que cabe)
                $pago = $sistema->pagarReacao($ficha, $oferta);
                // A rolagem da redução de dano (Kiri Shigure, Parry Shot...) vai para o chat; não é campo da ficha
                $rolagemDaReacao = $pago['_rolagem'] ?? null;
                // PV temporários rolados pela reação (Costura Interna): também vão ao chat com os dados
                $rolagemPv = $pago['_rolagemPv'] ?? null;
                unset($pago['_rolagem'], $pago['_rolagemPv']);
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
                $rotuloDaReacao = $oferta['rotulo'];
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
            // Cura em dados: rolada aqui e mostrada no chat com os dados; valor fixo só cura
            $pontos = $this->valor($cura);
            if (is_string($cura) && str_contains($cura, 'd')) {
                $r = $this->rolador->rolar($cura);
                $pontos = (int) $r['total'];
                $this->mostrarRolagemDaReacao($mesa, $acesso, $personagemId, (string) $rotuloDaReacao, $r['expressao'], $r['termos'], $pontos, "cura {$pontos} PV de ".($e->contexto['alvo'] ?? '?'));
            }
            $this->curar($mesa, $sistema, (int) $e->contexto['alvo_id'], $pontos);
        }
        if ($rolagemDaReacao) {
            $r = $rolagemDaReacao;
            $this->mostrarRolagemDaReacao($mesa, $acesso, $personagemId, (string) $rotuloDaReacao, $r['expressao'], $r['termos'], (int) $r['total'], "reduz {$r['total']} do dano (reserva {$r['reserva']})");
        }
        if ($rolagemPv) {
            $this->mostrarRolagemDaReacao($mesa, $acesso, $personagemId, (string) $rotuloDaReacao, $rolagemPv['expressao'], $rolagemPv['termos'], (int) $rolagemPv['total'], "{$rolagemPv['total']} PV temporários");
        }
        $this->enviarResumo($mesa, $e);

        return $resolveuAgora ? $this->resolver($mesa, $acesso, $e) : $e;
    }

    /**
     * O chat mostra os dados que a reação rolou, como uma rolagem comum (expressão, dados e total), com o efeito no rótulo: a redução armada
     * (Kiri Shigure, Parry Shot, Yamantaka), os PV temporários (Costura Interna) ou a cura.
     */
    private function mostrarRolagemDaReacao(Mesa $mesa, AcessoMesa $acesso, int $personagemId, string $rotulo, string $expressao, array $termos, int $total, string $efeito): void
    {
        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => $personagemId, 'tipo' => 'rolagem', 'visibilidade' => 'todos',
            'texto' => $expressao,
            'dados' => ['expressao' => $expressao, 'rotulo' => "{$rotulo}: {$efeito}", 'termos' => $termos, 'total' => $total],
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);
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
        if ($evento->tipo === 'dano') {
            return $this->resolverDano($mesa, $acesso, $evento);
        }
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
        }
        $this->enviarResumo($mesa, $e);

        return $e;
    }

    /**
     * Fecha a janela de reação de um dano sem ataque: não há acerto a decidir (as reações já armaram o efeito na ficha). O card da Técnica que
     * esperava as reações libera as Salvaguardas quando a última janela dela fecha.
     */
    private function resolverDano(Mesa $mesa, AcessoMesa $acesso, EventoDeCombate $evento): EventoDeCombate
    {
        $e = DB::transaction(function () use ($evento) {
            $e = EventoDeCombate::query()->whereKey($evento->id)->lockForUpdate()->firstOrFail();
            if ($e->estado === 'aguardando') {
                $e->estado = 'resolvido';
                $e->resultado = null;
                $e->save();
            }

            return $e;
        });
        $card = DB::transaction(function () use ($mesa, $e) {
            $m = $mesa->mensagens()->whereKey($e->contexto['mensagem_id'] ?? 0)->lockForUpdate()->first();
            if (! $m || $m->tipo !== 'tecnica' || empty($m->dados['reagindo'])) {
                return null;
            }
            $abertas = EventoDeCombate::query()->whereIn('id', $m->dados['reagindo'])->where('estado', 'aguardando')->pluck('id')->all();
            $m->dados = [...$m->dados, 'reagindo' => array_values($abertas)];
            $m->save();

            return $m;
        });
        if ($card) {
            EntregarMensagem::para($mesa, $card, $acesso, substitui: true);
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
        $dano = $evento->tipo === 'dano';

        return [
            'evento_id' => $evento->id, 'personagem_id' => $personagemId, 'personagem' => $nome, 'titulo' => $dano ? 'Reação ao dano' : 'Reação ao ataque',
            'contexto' => [
                'tipo' => $dano ? 'dano' : 'ataque', 'atacante' => $c['atacante'], 'alvo' => $c['alvo'], 'alvo_id' => $c['alvo_id'], 'rotulo' => $c['rotulo'],
                'total' => $c['total'] ?? null, 'defesa' => $c['defesa'] ?? null, 'detalhe' => $c['detalhe'] ?? null,
            ],
            'opcoes' => array_map(fn ($o) => [
                'id' => $o['id'], 'rotulo' => $o['rotulo'], 'descricao' => $o['descricao'] ?? '', 'custo' => $o['custo'] ?? [], 'cura' => $o['cura'] ?? null,
                'defesa' => collect($o['efeitos'] ?? [])->where('alvo', 'defesa')->sum('valor'), 'efeito' => self::efeitoNoDano($o),
                'extraMax' => $o['extraMax'] ?? 0, 'maisPorPp' => $o['extraMax'] ?? 0 ? ($o['reducao']['mais'] ?? null) : null,
            ], $opcoes),
        ];
    }

    /** O que a reação faz com o dano, em palavras (para o modal): reduzir, zerar, metade, PV temporários... Vazio se só mexe na defesa. */
    private static function efeitoNoDano(array $o): string
    {
        $r = $o['reducao'] ?? null;
        $partes = [];
        if (is_array($r)) {
            $partes[] = match (true) {
                isset($r['mais']) && ! isset($r['reserva']) => "+{$r['mais']} na reserva de redução",
                isset($r['reserva']) => "reduz {$r['reserva']} do dano",
                ! empty($r['zerar']) => 'zera o próximo dano',
                ! empty($r['metade']) => 'metade do próximo dano',
                ! empty($r['piso']) => 'os PV não caem abaixo de 1',
                default => 'reduz o dano',
            };
        }
        if (! empty($o['pvTemporarios'])) {
            $partes[] = "{$o['pvTemporarios']} PV temporários";
        }

        return implode(' · ', $partes);
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
