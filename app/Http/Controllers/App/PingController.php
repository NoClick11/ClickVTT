<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PingController extends Controller
{
    /** Envia um ping no mapa (ondas de atenção) e opcionalmente centraliza a câmera de quem recebe. */
    public function ping(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);

        $dados = $request->validate([
            'pagina_id' => ['required', 'integer'],
            'x' => ['required', 'numeric'],
            'y' => ['required', 'numeric'],
            'puxar' => ['nullable', 'boolean'],
        ]);

        $payload = [
            'pagina_id' => (int) $dados['pagina_id'],
            'x' => (float) $dados['x'],
            'y' => (float) $dados['y'],
            'puxar' => (bool) ($dados['puxar'] ?? false),
            'ator' => $acesso->jogador->id,
            'cor' => $acesso->jogador->cor ?? '#f59e0b',
            'nome' => $acesso->jogador->nome,
        ];

        // Transmite para todos os participantes da mesa
        Transmitir::enviar($mesa, 'ping', $payload, ['mesa']);

        return response()->json(['ok' => true]);
    }
}
