<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Turnos/iniciativa: só o mestre altera; todos veem. Por enquanto é apenas visual. */
class CombateController extends Controller
{
    public function atualizar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = $request->validate([
            'ativo' => ['required', 'boolean'],
            'rodada' => ['required', 'integer', 'min:1', 'max:9999'],
            'atual' => ['nullable', 'string', 'max:40'],
            'itens' => ['present', 'array', 'max:60'],
            'itens.*.id' => ['required', 'string', 'max:40'],
            'itens.*.nome' => ['required', 'string', 'max:60'],
            'itens.*.iniciativa' => ['nullable', 'numeric', 'between:-999,999'],
            'itens.*.cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'itens.*.personagem_id' => ['nullable', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
        ]);
        $mesa->forceFill(['combate' => $dados])->save();

        Transmitir::enviar($mesa, 'combate', ['combate' => $dados, 'ator' => $acesso->jogador->id], ['mesa']);

        return response()->json($dados);
    }
}
