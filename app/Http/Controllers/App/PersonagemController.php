<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Jogador;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PersonagemController extends Controller
{
    /** O mestre escolhe os jogadores de um personagem (N:N). */
    public function atribuir(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);

        $dados = $request->validate([
            'jogadores' => ['present', 'array'],
            'jogadores.*' => ['integer', Rule::exists('jogadores', 'id')->where('mesa_id', $mesa->id)->where('papel', 'jogador')],
        ]);
        $personagem->jogadores()->sync($dados['jogadores']);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront());
    }
}
