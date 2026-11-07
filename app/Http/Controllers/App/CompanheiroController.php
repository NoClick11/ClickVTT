<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Sistemas\OnePiece\Companheiros;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Entrega um companheiro com ficha própria a um personagem (ex.: a Cobra Bélica da Kuja). Quem controla o dono (ou o
 * mestre) pode pedir; o companheiro é um personagem da mesa, dos mesmos jogadores do dono. Pedir de novo devolve o que já existe.
 */
class CompanheiroController extends Controller
{
    public function criar(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        abort_unless($acesso->podeControlar($personagem->id), 403, 'Este personagem não é seu.');
        if ($mesa->sistema->slug !== 'one-piece') {
            throw ValidationException::withMessages(['modelo' => 'Este sistema não tem companheiros prontos.']);
        }
        $modelo = $request->validate(['modelo' => ['required', Rule::in(Companheiros::MODELOS)]])['modelo'];
        $nome = Companheiros::nome($modelo, $personagem->nome);

        $existente = $mesa->personagens()->where('nome', $nome)->first();
        if ($existente) {
            return response()->json(['id' => $existente->id, 'criado' => false]);
        }
        $companheiro = $mesa->personagens()->create(['nome' => $nome, 'cor' => $personagem->cor]);
        $companheiro->ficha = Companheiros::ficha($modelo);
        $companheiro->save();
        $companheiro->jogadores()->sync($personagem->jogadores()->pluck('jogadores.id')->all());
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['id' => $companheiro->id, 'criado' => true], 201);
    }
}
