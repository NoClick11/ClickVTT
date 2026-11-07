<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Nucleo\Combate\CombateService;
use App\Support\AcessoMesa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Combate (turnos): um endpoint de comandos. O servidor decide e transmite o estado novo a todos (`.combate`).
 * Só o mestre dá comandos, exceto `iniciativa` (o jogador rola a dos personagens dele). Ver `CombateService`.
 */
class CombateController extends Controller
{
    public function comando(Request $request, Mesa $mesa, CombateService $combate): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $dados = $request->validate([
            'comando' => ['required', Rule::in(['iniciar', 'iniciativa', 'rolar_npcs', 'definir_iniciativa', 'definir_disposicao', 'comecar', 'turno', 'rodada', 'ordem', 'adicionar', 'adicionar_varios', 'remover', 'devolver', 'definir_movimento', 'encerrar'])],
            'pagina_id' => ['nullable', 'integer', Rule::exists('paginas', 'id')->where('mesa_id', $mesa->id)],
            'objetos' => ['nullable', 'array', 'max:60'],
            'objetos.*' => ['integer'],
            'item_id' => ['nullable', 'string', 'max:40'],
            'iniciativa' => ['nullable', 'numeric', 'between:-999,999'],
            'disposicao' => ['nullable', Rule::in(CombateService::DISPOSICOES)],
            'sentido' => ['nullable', Rule::in(['proximo', 'anterior', 'escolher'])],
            'rodada' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'ids' => ['nullable', 'array', 'max:60'],
            'ids.*' => ['string', 'max:40'],
            'nome' => ['nullable', 'string', 'max:60'],
            'cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'personagem_id' => ['nullable', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'personagem_ids' => ['nullable', 'array', 'max:60'],
            'personagem_ids.*' => ['integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'objeto_id' => ['nullable', 'integer'],
            'categoria' => ['nullable', 'string', 'max:20'],
            'usado' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'bonus' => ['nullable', 'numeric', 'min:0', 'max:9999'],
        ]);

        $faltando = match ($dados['comando']) {
            'iniciativa', 'definir_iniciativa', 'definir_disposicao', 'remover' => ['item_id'],
            'devolver' => ['item_id', 'categoria'],
            'definir_movimento' => ['item_id'],
            'rodada' => ['rodada'],
            'ordem' => ['ids'],
            'adicionar_varios' => ['personagem_ids'],
            default => [],
        };
        $request->validate(array_fill_keys($faltando, ['required']));
        if ($dados['comando'] === 'definir_disposicao') {
            $request->validate(['disposicao' => ['required']]);
        }

        return response()->json(['combate' => $combate->executar($mesa, $acesso, $dados['comando'], $dados)]);
    }

    /** Disparada: gasta a ação dela e soma outro deslocamento ao turno do personagem. Ver `CombateService::disparar`. */
    public function disparada(Request $request, Mesa $mesa, CombateService $combate): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $dados = $request->validate(['personagem_id' => ['required', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)]]);

        return response()->json(['combate' => $combate->disparar($mesa, $acesso, $dados['personagem_id'])]);
    }

    /**
     * Gasta uma ação do personagem no combate (botões que não rolam dados: ligar uma característica, aplicar um efeito...).
     * Recusa com o motivo se não pode agir agora. Ver `CombateService::gastar`.
     */
    public function acao(Request $request, Mesa $mesa, CombateService $combate): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $dados = $request->validate([
            'personagem_id' => ['required', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'categoria' => ['required', 'string', 'max:20'],
            'tecnica' => ['nullable', 'boolean'],
        ]);

        return response()->json(['combate' => $combate->gastar($mesa, $acesso, $dados['personagem_id'], $dados['categoria'], (bool) ($dados['tecnica'] ?? false))]);
    }
}
