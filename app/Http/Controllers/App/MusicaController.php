<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MusicaController extends Controller
{
    /** Atualiza o estado da música tocando ou a playlist da mesa (só o mestre). */
    public function atualizar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);

        $dados = $request->validate([
            'tocando' => ['nullable', 'array'],
            'tocando.url' => ['nullable', 'string'],
            'tocando.videoId' => ['nullable', 'string'],
            'tocando.titulo' => ['nullable', 'string'],
            'tocando.tocando' => ['nullable', 'boolean'],
            'tocando.loop' => ['nullable', 'boolean'],
            'tocando.tempo' => ['nullable', 'numeric'],
            'playlist' => ['nullable', 'array'],
            'playlist.*.id' => ['required', 'string'],
            'playlist.*.url' => ['required', 'string'],
            'playlist.*.videoId' => ['required', 'string'],
            'playlist.*.titulo' => ['required', 'string'],
        ]);

        $atual = $mesa->musica ?? [];
        $novo = [
            'tocando' => array_key_exists('tocando', $dados) ? $dados['tocando'] : ($atual['tocando'] ?? null),
            'playlist' => array_key_exists('playlist', $dados) ? $dados['playlist'] : ($atual['playlist'] ?? []),
        ];

        $mesa->forceFill(['musica' => $novo])->save();

        // Notifica todos na mesa em tempo real
        Transmitir::enviar($mesa, 'musica', ['musica' => $novo, 'ator' => $acesso->jogador->id], ['mesa']);

        return response()->json(['musica' => $novo]);
    }
}
