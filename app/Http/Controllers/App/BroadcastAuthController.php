<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

/**
 * Autoriza canais privados do Reverb. Os jogadores não têm conta: a autorização vem do acesso
 * por convite (sessão) + X-Jogador da aba. Canais:
 *  - private-mesa.{id}                  qualquer jogador que entrou
 *  - private-mesa.{id}.mestre           só o mestre
 *  - private-mesa.{id}.jogador.{jid}    só o próprio jogador
 */
class BroadcastAuthController extends Controller
{
    public function __invoke(Request $request, Mesa $mesa)
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $canal = (string) $request->input('channel_name');
        $base = "private-mesa.{$mesa->id}";

        $permitido = match (true) {
            $canal === $base => true,
            $canal === "{$base}.mestre" => $acesso->ehMestre(),
            $canal === "{$base}.jogador.{$acesso->jogador->id}" => true,
            default => false,
        };
        abort_unless($permitido, 403);

        return Broadcast::driver()->validAuthenticationResponse($request, true);
    }
}
