<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\PersonagemRequest;
use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Personagens (fichas) da mesa e os jogadores de cada um. Só o dono da mesa gerencia. */
class PersonagemController extends Controller
{
    public function store(PersonagemRequest $request, Mesa $mesa): RedirectResponse
    {
        $personagem = $mesa->personagens()->create($request->safe()->only(['nome', 'cor']));
        $personagem->jogadores()->sync($request->validated('jogadores', []));

        return back();
    }

    public function update(PersonagemRequest $request, Mesa $mesa, Personagem $personagem): RedirectResponse
    {
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $personagem->update($request->safe()->only(['nome', 'cor']));
        $personagem->jogadores()->sync($request->validated('jogadores', []));

        return back();
    }

    public function destroy(Request $request, Mesa $mesa, Personagem $personagem): RedirectResponse
    {
        abort_unless($mesa->user_id === $request->user()->id && $personagem->mesa_id === $mesa->id, 403);
        $personagem->delete();

        return back();
    }
}
