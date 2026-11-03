<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Entrada por link de convite: escolhe o JOGADOR e digita a senha (modelo Foundry). */
class ConviteController extends Controller
{
    public const SESSAO = 'acesso_mesas';

    public function show(Request $request, string $token): Response|RedirectResponse
    {
        $mesa = $this->mesa($token);

        return Inertia::render('site/Convite', [
            'token' => $token,
            'mesa' => [
                'slug' => $mesa->slug,
                'nome' => $mesa->nome,
                'descricao' => $mesa->descricao,
                'capa' => $mesa->capaUrl(),
                'tema_entrada' => $mesa->tema_entrada,
                'sistema' => $mesa->sistema->nome,
            ],
            'jogadores' => $mesa->jogadores()->orderByRaw("papel = 'mestre' desc")->orderBy('nome')->get()
                ->map(fn ($j) => $j->paraFront()),
            'jaEntrou' => AcessoMesa::autorizados($request, $mesa),
        ]);
    }

    public function entrar(Request $request, string $token): RedirectResponse
    {
        $mesa = $this->mesa($token);
        $dados = $request->validate([
            'jogador_id' => ['required', 'integer'],
            'senha' => ['nullable', 'string', 'max:100'],
        ]);

        $jogador = $mesa->jogadores()->find($dados['jogador_id']);
        if (! $jogador) {
            throw ValidationException::withMessages(['jogador_id' => 'Jogador não encontrado.']);
        }
        if ($jogador->senha !== null && ! Hash::check($dados['senha'] ?? '', $jogador->senha)) {
            throw ValidationException::withMessages(['senha' => 'Senha incorreta.']);
        }

        // Acumula: entrar com outro jogador NÃO derruba os que já estão abertos em outras abas.
        $request->session()->regenerate();
        $request->session()->put(self::SESSAO.'.'.$mesa->id.'.'.$jogador->id, true);

        return to_route('jogo', [$mesa->slug, $jogador->id]);
    }

    public function sair(Request $request, string $token): RedirectResponse
    {
        $mesa = $this->mesa($token);
        // Sai só do jogador desta aba (os demais continuam entrados).
        $chave = self::SESSAO.'.'.$mesa->id;
        $jogadorId = $request->input('jogador');
        $jogadorId ? $request->session()->forget($chave.'.'.(int) $jogadorId) : $request->session()->forget($chave);

        return to_route('convite.show', $token);
    }

    private function mesa(string $token): Mesa
    {
        return Mesa::with('sistema')->where('convite_token', $token)->firstOrFail();
    }
}
