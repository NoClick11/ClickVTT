<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Combate\AplicarDano;
use App\Nucleo\Combate\Dano;
use App\Nucleo\Combate\Duracoes;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\Sistema;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Ações sobre um personagem ALVO, feitas por qualquer participante da mesa (o jogador mira num token e age sobre ele):
 * aplicar o dano de uma rolagem e aplicar/remover uma condição. O valor do dano nunca vem do cliente: sai da mensagem da
 * rolagem (decidida pelo servidor). Quem altera a ficha do alvo é o servidor, com a mesma validação da ficha.
 */
class AlvoController extends Controller
{
    /**
     * Aplica o total de uma rolagem de dano ao alvo, respeitando imunidade, resistência e vulnerabilidade ao tipo do dano.
     * Só o autor da rolagem ou o mestre; cada rolagem vale uma vez por alvo. Corpo: `mensagem_id`.
     */
    public function dano(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas, AplicarDano $aplicar): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $entrada = $request->validate(['mensagem_id' => ['required', 'integer']]);
        $sistema = $this->sistema($mesa, $sistemas);

        $resultado = DB::transaction(function () use ($mesa, $personagem, $acesso, $entrada, $sistema, $aplicar) {
            /** @var Mensagem $mensagem */
            $mensagem = $mesa->mensagens()->whereKey($entrada['mensagem_id'])->lockForUpdate()->firstOrFail();
            $dano = $mensagem->dados['sistema']['dano'] ?? null;
            if ($mensagem->tipo !== 'rolagem' || ! is_array($dano)) {
                throw ValidationException::withMessages(['mensagem_id' => 'Esta mensagem não é uma rolagem de dano.']);
            }
            abort_unless($acesso->ehMestre() || $mensagem->jogador_id === $acesso->jogador->id, 403, 'Só quem rolou o dano (ou o mestre) pode aplicá-lo.');
            $jaAplicado = $mensagem->dados['aplicado'] ?? [];
            if (in_array($personagem->id, $jaAplicado, true)) {
                throw ValidationException::withMessages(['mensagem_id' => 'Este dano já foi aplicado a este alvo.']);
            }

            if ($mensagem->personagem_id) {
                \App\Nucleo\Combate\Equipes::exigirPodeAtingir($mesa, $mensagem->personagem_id, $personagem->id, 'mensagem_id');
            }
            $tipo = $dano['tipo'] ?? null;
            // Fração do dano que vale (arma à distância do anão: metade), antes das defesas do alvo.
            $total = (int) floor(((int) ($mensagem->dados['total'] ?? 0)) * (float) ($dano['fator'] ?? 1));
            // De onde vem o dano: ataque (comum) com arma, ou Técnica (a marca `tecnica` está no card do ataque da Técnica)
            $origem = isset($mensagem->dados['sistema']['tecnica']) && empty($mensagem->dados['sistema']['tecnica']['semTecnica']) ? 'tecnica' : 'ataque';
            $r = $aplicar->aplicar($mesa, $personagem->id, $sistema, $total, $tipo, (array) ($dano['ignora'] ?? []), $mensagem->personagem_id, ['origem' => $origem]);

            $mensagem->dados = [...$mensagem->dados, 'aplicado' => [...$jaAplicado, $personagem->id]];
            $mensagem->save();

            return [$r, $mensagem];
        });

        [$r, $mensagem] = $resultado;
        $texto = $aplicar->avisar($mesa, $acesso, $mensagem->visibilidade, $r);

        return response()->json(['final' => $r['calculo']['final'], 'modo' => $r['calculo']['modo'], 'texto' => $texto]);
    }

    /**
     * Liga ou desliga uma condição do alvo, com duração em turnos opcional (`turnos`: acaba no fim do turno dele que zera
     * a contagem; `ao_dano`: acaba ao receber dano). Imunidade à condição (ou ao nome dela) impede. Corpo: `condicao`,
     * `acao` (`aplicar`|`remover`), `turnos`, `ao_dano`.
     */
    public function condicao(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas, FichaCampos $fichas, Rolador $rolador): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $sistema = $this->sistema($mesa, $sistemas);
        $catalogo = collect(method_exists($sistema, 'condicoes') ? $sistema->condicoes() : [])->keyBy('id');
        $entrada = $request->validate([
            'condicao' => ['required', 'string', Rule::in($catalogo->keys()->all())],
            'acao' => ['required', Rule::in(['aplicar', 'remover'])],
            // Duração: um número de turnos ou dados (`1d4`), sorteados aqui no servidor.
            'turnos' => ['nullable', 'string', 'regex:/^\d{1,2}(d\d{1,2})?$/'],
            'ao_dano' => ['nullable', 'boolean'],
            // Salvaguarda do ALVO contra a condição: o servidor rola `1d20 + salvaguarda do atributo` e só aplica se ficar abaixo da CD.
            'salvaguarda' => ['nullable', 'array'],
            'salvaguarda.atributo' => ['required_with:salvaguarda', 'string', 'max:10'],
            'salvaguarda.cd' => ['required_with:salvaguarda', 'integer', 'between:1,40'],
        ]);
        $turnos = isset($entrada['turnos']) ? $this->turnos($entrada['turnos'], $rolador) : null;
        $id = $entrada['condicao'];
        $nome = $catalogo[$id]['nome'];

        $resultado = DB::transaction(function () use ($personagem, $sistema, $fichas, $entrada, $id, $nome, $turnos, $rolador) {
            $p = Personagem::query()->whereKey($personagem->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->fichaCompleta($sistema);
            $condicoes = array_values(array_diff($ficha['condicoes'] ?? [], [$id]));
            $duracoes = $ficha['duracoes'] ?? [];
            unset($duracoes[$id]);
            if ($entrada['acao'] === 'aplicar') {
                if (Dano::contem($ficha['imunidades'] ?? [], $nome) || Dano::contem($ficha['imunidades'] ?? [], $id)) {
                    return [$p, 'imune'];
                }
                if (isset($entrada['salvaguarda'])) {
                    $variaveis = $sistema->variaveisDeRolagem($ficha, []);
                    $chave = 'salv.'.strtolower($entrada['salvaguarda']['atributo']);
                    if (! array_key_exists($chave, $variaveis)) {
                        throw ValidationException::withMessages(['salvaguarda.atributo' => 'Atributo de salvaguarda desconhecido neste sistema.']);
                    }
                    $teste = $rolador->rolar("1d20+@{$chave}", $variaveis)['total'];
                    if ($teste >= (int) $entrada['salvaguarda']['cd']) {
                        return [$p, 'resistiu', null, $teste];
                    }
                    $falhou = $teste;
                }
                $condicoes[] = $id;
                if ($turnos !== null || ! empty($entrada['ao_dano'])) {
                    $duracoes[$id] = ['turnos' => $turnos ?? 99, 'aoDano' => (bool) ($entrada['ao_dano'] ?? false)];
                }
            }
            $campos = ['condicoes' => $condicoes];
            if (array_key_exists('duracoes', $ficha)) {
                $campos['duracoes'] = $duracoes;
            }
            $p->ficha = $fichas->aplicar($sistema, $p->ficha, $campos);
            $p->save();

            return [$p, $entrada['acao'], $campos, $falhou ?? null];
        });

        [$alvo, $situacao] = $resultado;
        if ($situacao === 'resistiu') {
            $texto = "{$alvo->nome} resistiu a {$nome} (salvaguarda {$resultado[3]} contra CD {$entrada['salvaguarda']['cd']}).";
            $this->avisar($mesa, $acesso, 'todos', $texto);

            return response()->json(['imune' => false, 'resistiu' => true, 'texto' => $texto]);
        }
        if ($situacao === 'imune') {
            $this->avisar($mesa, $acesso, 'todos', "{$alvo->nome} é imune a {$nome}.");

            return response()->json(['imune' => true, 'texto' => "{$alvo->nome} é imune a {$nome}."]);
        }
        Duracoes::transmitir($mesa, $alvo, $resultado[2], true);
        $duracao = $turnos !== null ? " por {$turnos} turno".($turnos > 1 ? 's' : '').(! empty($entrada['ao_dano']) ? ' (ou até receber dano)' : '') : (! empty($entrada['ao_dano']) ? ' até receber dano' : '');
        $falha = isset($resultado[3]) ? " (falhou na salvaguarda: {$resultado[3]} contra CD {$entrada['salvaguarda']['cd']})" : '';
        $texto = $situacao === 'aplicar' ? "{$alvo->nome} recebeu a condição {$nome}{$duracao}{$falha}." : "{$alvo->nome} não está mais {$nome}.";
        $this->avisar($mesa, $acesso, 'todos', $texto);

        return response()->json(['imune' => false, 'texto' => $texto]);
    }

    /** `3` vale 3 turnos; `1d4` sorteia 1 a 4 (decisão do servidor). */
    private function turnos(string $valor, Rolador $rolador): int
    {
        return max(1, min(99, (int) (str_contains($valor, 'd') ? $rolador->rolar($valor)['total'] : $valor)));
    }

    /** As condições que os Primeiros Socorros encerram. */
    public const CONDICOES_DE_SOCORRO = ['envenenado', 'letargico', 'queimado', 'sangramento'];

    /**
     * Primeiros Socorros (Habilidade Básica): o socorrista trata a criatura `{personagem}`. Cura 10 PV por nível dele, dá
     * 4d10 PV temporários e encerra as condições Envenenado, Letárgico, Queimado e Sangramento; cada criatura recebe isso
     * uma vez por descanso longo (`socorrido`). Com `so_condicoes` só encerra as condições, quantas vezes quiser.
     * Corpo: `socorrista_id`, `so_condicoes`.
     */
    public function socorros(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas, FichaCampos $fichas, Rolador $rolador): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $entrada = $request->validate([
            'socorrista_id' => ['required', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'so_condicoes' => ['nullable', 'boolean'],
        ]);
        abort_unless($acesso->podeControlar($entrada['socorrista_id']), 403, 'O socorrista não é seu.');
        $sistema = $this->sistema($mesa, $sistemas);
        $socorrista = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($entrada['socorrista_id']);
        $soCondicoes = (bool) ($entrada['so_condicoes'] ?? false);

        $r = DB::transaction(function () use ($personagem, $sistema, $socorrista, $fichas, $rolador, $soCondicoes) {
            $p = Personagem::query()->whereKey($personagem->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->fichaCompleta($sistema);
            $campos = [];
            $acabaram = array_values(array_intersect($ficha['condicoes'] ?? [], self::CONDICOES_DE_SOCORRO));
            if ($acabaram) {
                $campos['condicoes'] = array_values(array_diff($ficha['condicoes'], $acabaram));
                if (array_key_exists('duracoes', $ficha)) {
                    $campos['duracoes'] = array_diff_key($ficha['duracoes'], array_flip($acabaram));
                }
            }
            $cura = $temp = 0;
            if (! $soCondicoes) {
                if (($ficha['socorrido'] ?? false) === true) {
                    throw ValidationException::withMessages(['socorrista_id' => "{$p->nome} já recebeu Primeiros Socorros: só depois de um descanso longo."]);
                }
                $nivel = (int) ($socorrista->fichaCompleta($sistema)['nivel'] ?? 1);
                $max = (int) ($sistema->variaveisDeRolagem($ficha, [])['pv.max'] ?? ($ficha['pv']['max'] ?? 0));
                $cura = 10 * $nivel;
                $temp = (int) $rolador->rolar('4d10')['total'];
                $campos += ['pv.atual' => min($max, (int) ($ficha['pv']['atual'] ?? 0) + $cura), 'pv.temp' => $temp, 'socorrido' => true];
            }
            if ($campos === []) {
                return [$p, [], $acabaram, 0, 0];
            }
            $p->ficha = $fichas->aplicar($sistema, $p->ficha, $campos);
            $p->save();

            return [$p, $campos, $acabaram, $cura, $temp];
        });

        [$alvo, $campos, $acabaram, $cura, $temp] = $r;
        if ($campos) {
            Duracoes::transmitir($mesa, $alvo, $campos, $acabaram !== []);
        }
        $texto = $soCondicoes
            ? ($acabaram ? "{$socorrista->nome} trata {$alvo->nome}: as condições terminam." : "{$alvo->nome} não tem condição que os Primeiros Socorros encerrem.")
            : "{$socorrista->nome} dá Primeiros Socorros a {$alvo->nome}: cura {$cura} PV, {$temp} PV temporários".($acabaram ? ' e encerra as condições.' : '.');
        $this->avisar($mesa, $acesso, 'todos', $texto);

        return response()->json(['texto' => $texto]);
    }

    private function sistema(Mesa $mesa, RegistroSistemas $sistemas): Sistema
    {
        return $sistemas->resolver($mesa->sistema->slug)
            ?? throw ValidationException::withMessages(['sistema' => "O sistema {$mesa->sistema->nome} ainda não tem ficha."]);
    }

    /** @param  array{final: int, modo: string}  $calculo */
    private function avisar(Mesa $mesa, AcessoMesa $acesso, string $visibilidade, string $texto): void
    {
        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => null, 'tipo' => 'texto',
            'visibilidade' => $visibilidade === 'secreto' ? 'mestre' : $visibilidade, 'texto' => $texto, 'dados' => null,
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);
    }
}
