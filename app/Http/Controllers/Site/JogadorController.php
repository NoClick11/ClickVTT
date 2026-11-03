<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\JogadorRequest;
use App\Models\Jogador;
use App\Models\Mesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Jogadores da mesa (quem entra pelo convite): nome, senha, papel e cor. Só o dono da mesa gerencia. */
class JogadorController extends Controller
{
    public function store(JogadorRequest $request, Mesa $mesa): RedirectResponse
    {
        $mesa->jogadores()->create($request->safe()->only(['nome', 'papel', 'cor', 'senha']));

        return back();
    }

    public function update(JogadorRequest $request, Mesa $mesa, Jogador $jogador): RedirectResponse
    {
        abort_unless($jogador->mesa_id === $mesa->id, 404);

        $dados = $request->safe()->only(['nome', 'papel', 'cor']);
        if ($request->filled('senha')) {
            $dados['senha'] = $request->input('senha');
        } elseif ($request->boolean('remover_senha')) {
            $dados['senha'] = null;
        }
        $jogador->update($dados);

        return back();
    }

    public function destroy(Request $request, Mesa $mesa, Jogador $jogador): RedirectResponse
    {
        abort_unless($mesa->user_id === $request->user()->id && $jogador->mesa_id === $mesa->id, 403);
        $jogador->delete();

        return back();
    }
}
