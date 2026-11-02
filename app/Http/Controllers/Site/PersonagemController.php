<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\PersonagemRequest;
use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PersonagemController extends Controller
{
    public function store(PersonagemRequest $request, Mesa $mesa): RedirectResponse
    {
        $mesa->personagens()->create($request->safe()->only(['nome', 'papel', 'cor', 'senha']));

        return back();
    }

    public function update(PersonagemRequest $request, Mesa $mesa, Personagem $personagem): RedirectResponse
    {
        abort_unless($personagem->mesa_id === $mesa->id, 404);

        $dados = $request->safe()->only(['nome', 'papel', 'cor']);
        if ($request->filled('senha')) {
            $dados['senha'] = $request->input('senha');
        } elseif ($request->boolean('remover_senha')) {
            $dados['senha'] = null;
        }
        $personagem->update($dados);

        return back();
    }

    public function destroy(Request $request, Mesa $mesa, Personagem $personagem): RedirectResponse
    {
        abort_unless($mesa->user_id === $request->user()->id && $personagem->mesa_id === $mesa->id, 403);
        $personagem->delete();

        return back();
    }
}
