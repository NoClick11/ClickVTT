<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Pasta;
use App\Support\AcessoMesa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PastaController extends Controller
{
    public function store(Request $request, Mesa $mesa): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $dados = $request->validate(['nome' => ['required', 'string', 'max:80']]);
        $pasta = $mesa->pastas()->create($dados + ['ordem' => ($mesa->pastas()->max('ordem') ?? 0) + 1]);

        return response()->json(['id' => $pasta->id, 'nome' => $pasta->nome, 'ordem' => $pasta->ordem], 201);
    }

    public function update(Request $request, Mesa $mesa, Pasta $pasta): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pasta->mesa_id === $mesa->id, 404);
        $pasta->update($request->validate([
            'nome' => ['sometimes', 'string', 'max:80'],
            'ordem' => ['sometimes', 'integer', 'min:0'],
        ]));

        return response()->json(['id' => $pasta->id, 'nome' => $pasta->nome, 'ordem' => $pasta->ordem]);
    }

    public function destroy(Request $request, Mesa $mesa, Pasta $pasta): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pasta->mesa_id === $mesa->id, 404);
        $pasta->delete(); // páginas da pasta voltam para a raiz (nullOnDelete)

        return response()->json(['ok' => true]);
    }
}
