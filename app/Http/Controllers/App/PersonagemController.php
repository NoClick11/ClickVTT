<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\PersonagemRequest;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PersonagemController extends Controller
{
    /**
     * O mestre cria um personagem de dentro do jogo (as mesmas regras do site: nome único na mesa, cor, jogadores
     * da mesa). Sem jogadores é um NPC, que só o mestre controla. A ficha nasce com os valores padrão do sistema.
     */
    public function criar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = Validator::make($request->all(), PersonagemRequest::regrasPara($mesa), PersonagemRequest::mensagens())->validate();

        $personagem = $mesa->personagens()->create(['nome' => trim($dados['nome']), 'cor' => $dados['cor']]);
        $personagem->jogadores()->sync($dados['jogadores'] ?? []);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront(), 201);
    }

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
