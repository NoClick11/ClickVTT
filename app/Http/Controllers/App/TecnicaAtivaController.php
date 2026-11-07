<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Combate\AplicarDano;
use App\Nucleo\Combate\CombateService;
use App\Nucleo\Combate\Equipes;
use App\Nucleo\Combate\Pipeline;
use App\Nucleo\Combate\SistemaDeCombate;
use App\Nucleo\Combate\TecnicasAtivas;
use App\Nucleo\Combate\Visibilidade;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Rolagem\RolagemInvalida;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\Regras;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Técnicas com duração (Quick Draw): ativar e encerrar, e o card que pede o ataque no início do turno de quem está ao alcance. O jogador
 * clica para rolar (`atacar`); no acerto o servidor rola e aplica o dano e o jogador escolhe o efeito (`escolher`). Tudo decidido aqui.
 */
class TecnicaAtivaController extends Controller
{
    private const EFEITOS = ['movimento_zero', 'dano', 'sem_acao'];

    /** Ativa a Técnica no combate em curso (uma por nome por personagem; só uma com concentração). */
    public function ativar(Request $request, Mesa $mesa, CombateService $combate, Rolador $rolador, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $d = $request->validate([
            'personagem_id' => ['required', 'integer', Rule::in($acesso->personagensPermitidos())],
            'nome' => ['required', 'string', 'max:120'],
            'rodadas' => ['required', 'integer', 'between:1,99'],
            'concentracao' => ['nullable', 'boolean'],
            'alcance' => ['required', 'numeric', 'between:0,1000'],
            'dano' => ['required', 'array'],
            'dano.expressao' => ['required', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'dano.tipo' => ['nullable', 'string', 'max:30'],
            'opcoes' => ['nullable', 'array', 'max:6'],
            'opcoes.*.id' => ['required', 'string', 'max:30'],
            'opcoes.*.rotulo' => ['required', 'string', 'max:120'],
            'opcoes.*.efeito' => ['required', 'array'],
            'opcoes.*.efeito.tipo' => ['required', Rule::in(self::EFEITOS)],
            'opcoes.*.efeito.expressao' => ['nullable', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'opcoes.*.efeito.tipoDano' => ['nullable', 'string', 'max:30'],
        ]);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        abort_unless($sistema instanceof SistemaDeCombate, 422, 'Este sistema não tem combate.');
        $atacante = $mesa->personagens()->findOrFail($d['personagem_id']);
        $vars = $sistema->variaveisDeRolagem($atacante->fichaCompleta($sistema), []);
        foreach ([$d['dano']['expressao'], ...array_filter(array_map(fn ($o) => $o['efeito']['expressao'] ?? null, $d['opcoes'] ?? []))] as $expr) {
            try {
                $rolador->rolar($expr, $vars); // só valida
            } catch (RolagemInvalida $e) {
                throw ValidationException::withMessages(['dano.expressao' => $e->getMessage()]);
            }
        }

        $depois = DB::transaction(function () use ($mesa, $d) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = CombateService::normalizar($m->combate);
            if ($c['fase'] !== 'em_curso' || ! collect($c['itens'])->contains(fn ($i) => $i['personagem_id'] === $d['personagem_id'])) {
                throw ValidationException::withMessages(['personagem_id' => 'Esta Técnica dura vários turnos: use-a com o combate em curso.']);
            }
            $concentra = (bool) ($d['concentracao'] ?? false);
            // a mesma Técnica reinicia; a concentração só vale para uma Técnica por vez
            $c['ativas'] = array_values(array_filter($c['ativas'], fn ($a) => ! ($a['personagem_id'] === $d['personagem_id'] && ($a['nome'] === $d['nome'] || ($concentra && $a['concentracao'])))));
            $c['ativas'][] = TecnicasAtivas::nova($d['personagem_id'], $d['nome'], (int) $d['rodadas'], $concentra, (float) $d['alcance'], ['expressao' => $d['dano']['expressao'], 'tipo' => $d['dano']['tipo'] ?? null], $d['opcoes'] ?? []);
            $m->forceFill(['combate' => $c])->save();

            return $c;
        });

        Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => $acesso->jogador->id], ['mesa']);
        AplicarDano::postar($mesa, $acesso, Visibilidade::mensagem($atacante->id), "{$atacante->nome} ativa {$d['nome']}: ".$d['rodadas'].' rodada'.($d['rodadas'] > 1 ? 's' : '').", alcance {$d['alcance']} m".(($d['concentracao'] ?? false) ? ' (concentração)' : '').'.');

        return response()->json(['combate' => $depois]);
    }

    /** Encerra a Técnica ativa (quem a usou ou o mestre). */
    public function encerrar(Request $request, Mesa $mesa, string $ativa): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $depois = DB::transaction(function () use ($mesa, $acesso, $ativa) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = CombateService::normalizar($m->combate);
            $a = collect($c['ativas'])->firstWhere('id', $ativa);
            abort_unless($a, 404, 'Esta Técnica não está ativa.');
            abort_unless($acesso->podeControlar($a['personagem_id']), 403, 'Esta Técnica não é sua.');
            $c['ativas'] = array_values(array_filter($c['ativas'], fn ($x) => $x['id'] !== $ativa));
            $m->forceFill(['combate' => $c])->save();

            return [$c, $a];
        });
        Transmitir::enviar($mesa, 'combate', ['combate' => $depois[0], 'ator' => $acesso->jogador->id], ['mesa']);
        AplicarDano::postar($mesa, $acesso, Visibilidade::mensagem($depois[1]['personagem_id']), "{$depois[1]['nome']} foi encerrada.");

        return response()->json(['combate' => $depois[0]]);
    }

    /** O jogador clica: rola o ataque (1d20 + ataque) contra a defesa de quem começou o turno; no acerto rola e aplica o dano. */
    public function atacar(Request $request, Mesa $mesa, Mensagem $mensagem, RegistroSistemas $sistemas, Rolador $rolador, AplicarDano $aplicar): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        abort_unless($sistema instanceof SistemaDeCombate, 422, 'Este sistema não tem combate.');

        $aplicados = [];
        $m = DB::transaction(function () use ($mesa, $mensagem, $acesso, $sistema, $rolador, $aplicar, &$aplicados) {
            $m = $this->travar($mesa, $mensagem, $acesso, 'pendente');
            $dados = $m->dados;
            $a = $this->ativa($mesa, $dados['ativa_id']);
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($dados['atacante']['personagem_id']);
            $alvo = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($dados['alvo']['personagem_id']);
            Equipes::exigirPodeAtingir($mesa, $atacante->id, $alvo->id);
            $vars = $sistema->variaveisDeRolagem($atacante->fichaCompleta($sistema), []);
            $r = $rolador->rolar('1d20+@ataque', $vars);
            $natural = Pipeline::naturalDoD20($r['termos']);
            $defesa = $sistema->defesa($sistema->variaveisDeRolagem($alvo->fichaCompleta($sistema), []));
            $critico = $natural !== null && $natural >= 20;
            $acerto = $natural !== 1 && ($critico || $r['total'] >= $defesa);
            $dados['ataque'] = ['total' => $r['total'], 'termos' => $r['termos'], 'defesa' => $defesa, 'acerto' => $acerto, 'critico' => $critico && $acerto, 'falha' => $natural === 1];
            if (! $acerto) {
                $dados['estado'] = 'errou';
            } else {
                $expr = $critico ? Regras::dobrarDadosDaExpressao($a['dano']['expressao']) : $a['dano']['expressao'];
                $dano = $rolador->rolar($expr, $vars);
                $res = $aplicar->aplicar($mesa, $alvo->id, $sistema, $dano['total'], $a['dano']['tipo'], [], $atacante->id);
                $aplicados[] = $res;
                $dados['estado'] = 'acertou';
                $dados['dano'] = ['expressao' => $dano['expressao'], 'total' => $dano['total'], 'final' => $res['calculo']['final'], 'modo' => $res['calculo']['modo'], 'tipo' => $a['dano']['tipo'], 'termos' => $dano['termos']];
            }
            $m->dados = $dados;
            $m->save();

            return $m;
        });

        foreach ($aplicados as $res) {
            $aplicar->avisar($mesa, $acesso, 'todos', $res, postar: false);
        }
        EntregarMensagem::para($mesa, $m, $acesso, substitui: true);

        return response()->json($m->para($acesso->jogador));
    }

    /** No acerto, o jogador escolhe um dos efeitos da Técnica; o servidor o aplica a quem foi atingido. */
    public function escolher(Request $request, Mesa $mesa, Mensagem $mensagem, RegistroSistemas $sistemas, Rolador $rolador, AplicarDano $aplicar): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $d = $request->validate(['opcao' => ['required', 'string', 'max:30']]);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        abort_unless($sistema instanceof SistemaDeCombate, 422, 'Este sistema não tem combate.');

        $aplicados = [];
        $combateMudou = null;
        $m = DB::transaction(function () use ($mesa, $mensagem, $acesso, $d, $sistema, $rolador, $aplicar, &$aplicados, &$combateMudou) {
            $m = $this->travar($mesa, $mensagem, $acesso, 'acertou');
            $dados = $m->dados;
            $a = $this->ativa($mesa, $dados['ativa_id']);
            $opcao = collect($a['opcoes'] ?? [])->firstWhere('id', $d['opcao'])
                ?? throw ValidationException::withMessages(['opcao' => 'Efeito desconhecido.']);
            $alvoId = $dados['alvo']['personagem_id'];
            $efeito = $opcao['efeito'];
            $texto = $opcao['rotulo'];
            if ($efeito['tipo'] === 'dano') {
                $atacante = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($dados['atacante']['personagem_id']);
                $expr = ($dados['ataque']['critico'] ?? false) ? Regras::dobrarDadosDaExpressao($efeito['expressao']) : $efeito['expressao'];
                $extra = $rolador->rolar($expr, $sistema->variaveisDeRolagem($atacante->fichaCompleta($sistema), []));
                $res = $aplicar->aplicar($mesa, $alvoId, $sistema, $extra['total'], $efeito['tipoDano'] ?? $a['dano']['tipo'], [], $atacante->id);
                $aplicados[] = $res;
                $texto = "{$opcao['rotulo']}: {$extra['total']} ({$res['calculo']['final']} depois das defesas)";
            } else {
                $mesaTrava = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
                $c = CombateService::normalizar($mesaTrava->combate);
                $k = collect($c['itens'])->search(fn ($i) => $i['personagem_id'] === $alvoId);
                if ($k !== false) {
                    if ($efeito['tipo'] === 'movimento_zero') {
                        $c['itens'][$k]['movimento'] = [...$c['itens'][$k]['movimento'], 'base' => 0.0, 'bonus' => 0.0];
                    } else { // sem_acao: a Ação do turno já foi usada
                        $c['itens'][$k]['acoes']['padrao'] = max(1, (int) ($c['itens'][$k]['acoes']['padrao'] ?? 0));
                    }
                    $mesaTrava->forceFill(['combate' => $c])->save();
                    $combateMudou = $c;
                }
            }
            $dados['estado'] = 'resolvido';
            $dados['escolha'] = ['id' => $opcao['id'], 'texto' => $texto];
            $m->dados = $dados;
            $m->save();

            return $m;
        });

        foreach ($aplicados as $res) {
            $aplicar->avisar($mesa, $acesso, 'todos', $res, postar: false);
        }
        if ($combateMudou) {
            Transmitir::enviar($mesa, 'combate', ['combate' => $combateMudou, 'ator' => $acesso->jogador->id], ['mesa']);
        }
        EntregarMensagem::para($mesa, $m, $acesso, substitui: true);

        return response()->json($m->para($acesso->jogador));
    }

    /** O jogador não quer atacar esta criatura. */
    public function ignorar(Request $request, Mesa $mesa, Mensagem $mensagem): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $m = DB::transaction(function () use ($mesa, $mensagem, $acesso) {
            $m = $this->travar($mesa, $mensagem, $acesso, 'pendente');
            $m->dados = [...$m->dados, 'estado' => 'ignorado'];
            $m->save();

            return $m;
        });
        EntregarMensagem::para($mesa, $m, $acesso, substitui: true);

        return response()->json($m->para($acesso->jogador));
    }

    /** O card, travado, no estado esperado e só para quem controla o atacante (ou o mestre). */
    private function travar(Mesa $mesa, Mensagem $mensagem, AcessoMesa $acesso, string $estado): Mensagem
    {
        abort_unless($mensagem->mesa_id === $mesa->id && $mensagem->tipo === 'gatilho', 404);
        $m = Mensagem::query()->whereKey($mensagem->id)->lockForUpdate()->firstOrFail();
        abort_unless($acesso->podeControlar($m->dados['atacante']['personagem_id']), 403, 'Este personagem não é seu.');
        if (($m->dados['estado'] ?? null) !== $estado) {
            throw ValidationException::withMessages(['estado' => 'Este card já foi resolvido.']);
        }

        return $m;
    }

    /** A Técnica ativa do card, ou 422 se já acabou. */
    private function ativa(Mesa $mesa, string $id): array
    {
        $c = CombateService::normalizar($mesa->fresh()->combate);

        return collect($c['ativas'])->firstWhere('id', $id)
            ?? throw ValidationException::withMessages(['estado' => 'A Técnica já acabou.']);
    }
}
