<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Site\ConviteController;
use App\Models\Mesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Parte interna (mesa de jogo). Por enquanto só um placeholder protegido pelo acesso do convite. */
class JogoController extends Controller
{
    public function show(Request $request, Mesa $mesa): Response|RedirectResponse
    {
        $personagemId = $request->session()->get(ConviteController::SESSAO.'.'.$mesa->id);
        $personagem = $personagemId ? $mesa->personagens()->find($personagemId) : null;

        if (! $personagem) {
            return redirect()->route('convite.show', $mesa->convite_token);
        }

        return Inertia::render('app/Jogo', [
            'mesa' => ['nome' => $mesa->nome, 'capa' => $mesa->capaUrl()],
            'personagem' => $personagem->paraFront(),
            'sairUrl' => route('convite.sair', $mesa->convite_token),
        ]);
    }
}
