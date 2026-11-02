<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Entrada de jogadores por link de convite: escolhe o personagem e digita a senha (modelo Foundry). */
class ConviteController extends Controller
{
    public const SESSAO = 'acesso_mesas';

    public function show(Request $request, string $token): Response|RedirectResponse
    {
        $mesa = $this->mesa($token);

        return Inertia::render('site/Convite', [
            'token' => $token,
            'mesa' => [
                'nome' => $mesa->nome,
                'descricao' => $mesa->descricao,
                'capa' => $mesa->capaUrl(),
                'tema_entrada' => $mesa->tema_entrada,
                'sistema' => $mesa->sistema->nome,
            ],
            'personagens' => $mesa->personagens()->orderByRaw("papel = 'mestre' desc")->orderBy('nome')->get()
                ->map(fn ($p) => $p->paraFront()),
            'entrouComo' => $request->session()->get(self::SESSAO.'.'.$mesa->id),
        ]);
    }

    public function entrar(Request $request, string $token): RedirectResponse
    {
        $mesa = $this->mesa($token);
        $dados = $request->validate([
            'personagem_id' => ['required', 'integer'],
            'senha' => ['nullable', 'string', 'max:100'],
        ]);

        $personagem = $mesa->personagens()->find($dados['personagem_id']);
        if (! $personagem) {
            throw ValidationException::withMessages(['personagem_id' => 'Personagem não encontrado.']);
        }
        if ($personagem->senha !== null && ! Hash::check($dados['senha'] ?? '', $personagem->senha)) {
            throw ValidationException::withMessages(['senha' => 'Senha incorreta.']);
        }

        $request->session()->regenerate();
        $request->session()->put(self::SESSAO.'.'.$mesa->id, $personagem->id);

        return to_route('jogo', $mesa->slug);
    }

    public function sair(Request $request, string $token): RedirectResponse
    {
        $mesa = $this->mesa($token);
        $request->session()->forget(self::SESSAO.'.'.$mesa->id);

        return to_route('convite.show', $token);
    }

    private function mesa(string $token): Mesa
    {
        return Mesa::with('sistema')->where('convite_token', $token)->firstOrFail();
    }
}
