<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Combate\AplicarCondicao;
use App\Nucleo\Combate\AplicarDano;
use App\Nucleo\Combate\Duracoes;
use App\Nucleo\Combate\Equipes;
use App\Nucleo\Combate\Visibilidade;
use App\Nucleo\Combate\Pipeline;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Rolagem\RolagemInvalida;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\ConsumoDaSaijo;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Técnica de Salvaguarda: quem usa a Técnica abre um card no chat com os alvos da área; cada alvo rola a Salvaguarda contra a CD de quem
 * usou (o dono do personagem, ou o mestre); com todos rolados o servidor rola o dano UMA vez e o desconta de cada um: todo o dano se
 * falhou, metade (ou nada) se passou. A CD, as rolagens e o dano saem do servidor; o cliente só diz quem é alvo e o que a Técnica rola.
 */
class TecnicaController extends Controller
{
    private const ATRIBUTOS = ['for', 'des', 'con', 'sab', 'pre', 'von'];

    /** Abre a Salvaguarda coletiva no chat. */
    public function abrir(Request $request, Mesa $mesa, RegistroSistemas $sistemas, Rolador $rolador): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $d = $request->validate([
            'personagem_id' => ['required', 'integer', Rule::in($acesso->personagensPermitidos())],
            'nome' => ['required', 'string', 'max:120'],
            'atributo' => ['required', Rule::in(self::ATRIBUTOS)],
            'desvantagem' => ['nullable', 'boolean'],
            'ao_passar' => ['nullable', Rule::in(['metade', 'nada'])],
            'alvos' => ['required', 'array', 'min:1', 'max:30'],
            'alvos.*' => ['integer', 'distinct', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'dano' => ['nullable', 'array'],
            'dano.expressao' => ['required_with:dano', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'dano.tipo' => ['nullable', 'string', 'max:30'],
            'efeito' => ['nullable', 'string', 'max:200'], // o que acontece com quem falha (Salvaguarda do efeito)
            // A condição que quem falha recebe sozinha, com a duração (id da condição do sistema)
            'aplica' => ['nullable', 'array'],
            'aplica.condicao' => ['required_with:aplica', 'string', 'max:40'],
            'aplica.turnos' => ['nullable', 'integer', 'between:1,99'],
            'aplica.aoDano' => ['nullable', 'boolean'],
            'secundaria' => ['nullable', 'array'],
            'secundaria.aplica' => ['nullable', 'array'],
            'secundaria.aplica.condicao' => ['required_with:secundaria.aplica', 'string', 'max:40'],
            'secundaria.aplica.turnos' => ['nullable', 'integer', 'between:1,99'],
            'secundaria.aplica.aoDano' => ['nullable', 'boolean'],
            'secundaria.atributo' => ['required_with:secundaria', Rule::in(self::ATRIBUTOS)],
            'secundaria.desvantagem' => ['nullable', 'boolean'],
            'secundaria.efeito' => ['required_with:secundaria', 'string', 'max:200'],
        ]);
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);
        $atacante = $mesa->personagens()->findOrFail($d['personagem_id']);
        foreach ($d['alvos'] as $alvoId) {
            Equipes::exigirInimigos($mesa, $atacante->id, (int) $alvoId, 'alvos');
            // camadas: quem está só na camada do Mestre não é visto pelos jogadores, então a área deles não o atinge
            if (! $acesso->ehMestre() && Visibilidade::oculto((int) $alvoId)) {
                throw ValidationException::withMessages(['alvos' => 'Esse alvo não está à vista.']);
            }
        }
        $ficha = $atacante->fichaCompleta($sistema);
        $variaveis = $sistema->variaveisDeRolagem($ficha, []);
        if (! isset($variaveis['cd'])) {
            throw ValidationException::withMessages(['sistema' => 'Este sistema não tem CD de Técnicas.']);
        }
        if (isset($d['dano'])) {
            try {
                $rolador->rolar($d['dano']['expressao'], $variaveis); // só valida a expressão
            } catch (RolagemInvalida $e) {
                throw ValidationException::withMessages(['dano.expressao' => $e->getMessage()]);
            }
            // `^2` (Saijo Ô): o uso é gasto agora, ao abrir
            if (str_contains($d['dano']['expressao'], '^')) {
                $itensIds = $sistema->itensReferenciados($ficha);
                $itens = $itensIds ? $mesa->itens()->whereIn('id', $itensIds)->get()->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all() : [];
                ConsumoDaSaijo::consumir($mesa, $atacante->id, $sistema, $itens, $ficha);
            }
        }

        $mensagem = $this->criar($mesa, $acesso, $atacante, [
            'nome' => trim($d['nome']), 'atributo' => $d['atributo'], 'desvantagem' => (bool) ($d['desvantagem'] ?? false),
            'cd' => (int) $variaveis['cd'], 'aoPassar' => $d['ao_passar'] ?? 'metade',
            'dano' => isset($d['dano']) ? ['expressao' => $d['dano']['expressao'], 'tipo' => filled($d['dano']['tipo'] ?? null) ? trim($d['dano']['tipo']) : null] : null,
            'efeito' => $d['efeito'] ?? null, 'aplica' => $d['aplica'] ?? null, 'secundaria' => $d['secundaria'] ?? null,
        ], $d['alvos']);

        return response()->json($mensagem->para($acesso->jogador), 201);
    }

    /** Um alvo rola a Salvaguarda (o dono do personagem, ou o mestre). Com o último, o dano é rolado e aplicado. */
    public function rolar(Request $request, Mesa $mesa, Mensagem $mensagem, RegistroSistemas $sistemas, Rolador $rolador, AplicarDano $aplicar, AplicarCondicao $condicoes): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($mensagem->mesa_id === $mesa->id && $mensagem->tipo === 'tecnica', 404);
        $d = $request->validate(['personagem_id' => ['required', 'integer']]);
        abort_unless($acesso->podeControlar($d['personagem_id']), 403, 'Este personagem não é seu.');
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);

        $aplicados = [];
        $condicionados = [];
        $mensagem = DB::transaction(function () use ($mesa, $mensagem, $d, $sistema, $rolador, $aplicar, $condicoes, &$aplicados, &$condicionados) {
            $m = Mensagem::query()->whereKey($mensagem->id)->lockForUpdate()->firstOrFail();
            $dados = $m->dados;
            if (($dados['estado'] ?? null) !== 'aguardando') {
                throw ValidationException::withMessages(['personagem_id' => 'Esta Técnica já foi resolvida.']);
            }
            $i = collect($dados['alvos'])->search(fn ($a) => $a['personagem_id'] === $d['personagem_id']);
            if ($i === false || $dados['alvos'][$i]['estado'] !== 'pendente') {
                throw ValidationException::withMessages(['personagem_id' => 'Este personagem não tem Salvaguarda a rolar.']);
            }
            $t = $dados['tecnica'];
            $alvo = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($d['personagem_id']);
            $vars = $sistema->variaveisDeRolagem($alvo->fichaCompleta($sistema), []);
            $r = $rolador->rolar(($t['desvantagem'] ? '2d20kl1' : '1d20')."+@salv.{$t['atributo']}", $vars);
            $dados['alvos'][$i] = [...$dados['alvos'][$i], 'estado' => 'rolou', 'total' => $r['total'], 'termos' => $r['termos'], 'passou' => $r['total'] >= $t['cd']];

            if (collect($dados['alvos'])->every(fn ($a) => $a['estado'] === 'rolou')) {
                $dados = $this->resolver($mesa, $m, $dados, $sistema, $rolador, $aplicar, $condicoes, $aplicados, $condicionados);
            }
            $m->dados = $dados;
            $m->save();

            return $m;
        });

        foreach ($aplicados as $r) {
            $aplicar->avisar($mesa, $acesso, 'todos', $r, postar: false);
        }
        foreach ($condicionados as $c) {
            if ($c['situacao'] === 'aplicada') {
                Duracoes::transmitir($mesa, $c['p'], $c['campos'], true);
            }
            AplicarDano::postar($mesa, $acesso, 'todos', $c['texto']);
        }
        EntregarMensagem::para($mesa, $mensagem, $acesso, substitui: true);
        $this->abrirSecundaria($mesa, $acesso, $mensagem);

        return response()->json($mensagem->para($acesso->jogador));
    }

    /**
     * Resolve: rola o dano uma vez (com as variáveis de quem usou) e o aplica a cada alvo: todo se falhou, metade ou nada se passou.
     *
     * @param  array<string, mixed>  $dados
     * @param  list<array>  $aplicados  recebe os resultados do AplicarDano (para avisar depois da transação)
     * @return array<string, mixed>
     */
    private function resolver(Mesa $mesa, Mensagem $m, array $dados, mixed $sistema, Rolador $rolador, AplicarDano $aplicar, AplicarCondicao $condicoes, array &$aplicados, array &$condicionados): array
    {
        $t = $dados['tecnica'];
        $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($t['atacante_id']);
        if ($t['dano']) {
            $vars = $atacante ? $sistema->variaveisDeRolagem($atacante->fichaCompleta($sistema), []) : [];
            $r = $rolador->rolar($t['dano']['expressao'], $vars);
            $dados['dano'] = ['total' => $r['total'], 'termos' => $r['termos'], 'expressao' => $r['expressao'], 'tipo' => $t['dano']['tipo'], ...(isset($r['repeticoes']) ? ['repeticoes' => $r['repeticoes'], 'escolhida' => $r['escolhida']] : [])];
            foreach ($dados['alvos'] as $i => $a) {
                $base = $a['passou'] ? ($t['aoPassar'] === 'metade' ? intdiv($r['total'], 2) : 0) : $r['total'];
                $dados['alvos'][$i]['base'] = $base;
                $dados['alvos'][$i]['final'] = 0;
                if ($base > 0) {
                    $res = $aplicar->aplicar($mesa, $a['personagem_id'], $sistema, $base, $t['dano']['tipo'], [], $t['atacante_id']);
                    $dados['alvos'][$i]['final'] = $res['calculo']['final'];
                    $dados['alvos'][$i]['modo'] = $res['calculo']['modo'];
                    $aplicados[] = $res;
                }
            }
        }
        // A condição da Técnica vai sozinha para quem falhou, com a duração (imunidade respeitada)
        if ($t['aplica'] ?? null) {
            foreach ($dados['alvos'] as $i => $a) {
                if ($a['passou']) {
                    continue;
                }
                $c = $condicoes->aplicar($a['personagem_id'], $sistema, $t['aplica']['condicao'], $t['aplica']['turnos'] ?? null, (bool) ($t['aplica']['aoDano'] ?? false));
                $dados['alvos'][$i]['condicao'] = ['nome' => $c['nome'], 'situacao' => $c['situacao']];
                $duracao = isset($t['aplica']['turnos']) ? " por {$t['aplica']['turnos']} turno".($t['aplica']['turnos'] > 1 ? 's' : '') : '';
                $c['texto'] = match ($c['situacao']) {
                    'aplicada' => "{$a['nome']} recebeu a condição {$c['nome']}{$duracao} ({$t['nome']}).",
                    'imune' => "{$a['nome']} é imune a {$c['nome']}.",
                    default => "{$t['nome']}: condição {$t['aplica']['condicao']} não existe neste sistema.",
                };
                $condicionados[] = $c;
            }
        }
        $dados['estado'] = 'resolvido';

        return $dados;
    }

    /** Depois do dano: quem falhou numa Técnica com Salvaguarda do efeito (Sangramento...) rola a segunda Salvaguarda. */
    private function abrirSecundaria(Mesa $mesa, AcessoMesa $acesso, Mensagem $m): void
    {
        $dados = $m->dados;
        $s = $dados['tecnica']['secundaria'] ?? null;
        if (($dados['estado'] ?? null) !== 'resolvido' || ! $s || ($dados['secundariaAberta'] ?? false)) {
            return;
        }
        $falharam = collect($dados['alvos'])->where('passou', false)->pluck('personagem_id')->all();
        $dados['secundariaAberta'] = true;
        $m->dados = $dados;
        $m->save();
        if (! $falharam) {
            return;
        }
        $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($dados['tecnica']['atacante_id']);
        $t = $dados['tecnica'];
        $this->criar($mesa, $acesso, $atacante, [
            'nome' => "{$t['nome']}: efeito", 'atributo' => $s['atributo'], 'desvantagem' => (bool) ($s['desvantagem'] ?? false), 'cd' => $t['cd'],
            'aoPassar' => 'nada', 'dano' => null, 'efeito' => $s['efeito'], 'aplica' => $s['aplica'] ?? null, 'secundaria' => null,
        ], $falharam);
    }

    /**
     * Cria o card da Salvaguarda coletiva e o entrega à mesa.
     *
     * @param  array<string, mixed>  $t
     * @param  list<int>  $alvos
     */
    private function criar(Mesa $mesa, AcessoMesa $acesso, ?Personagem $atacante, array $t, array $alvos): Mensagem
    {
        $nomes = Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $alvos)->pluck('nome', 'id');
        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => $atacante?->id, 'tipo' => 'tecnica', 'visibilidade' => 'todos', // os alvos precisam ver o card para rolar a Salvaguarda
            'texto' => "{$t['nome']}: Salvaguarda de ".strtoupper($t['atributo'])." CD {$t['cd']}",
            'dados' => [
                'rotulo' => $t['nome'], 'estado' => 'aguardando',
                'tecnica' => [...$t, 'atacante_id' => $atacante?->id],
                'alvos' => array_map(fn ($id) => ['personagem_id' => (int) $id, 'nome' => $nomes[$id] ?? '?', 'estado' => 'pendente'], $alvos),
            ],
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);

        return $mensagem;
    }
}
