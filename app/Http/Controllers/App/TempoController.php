<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TempoController extends Controller
{
    /** Atualiza o dia e horário da mesa (só o mestre). */
    public function atualizar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);

        $dados = $request->validate([
            'dia' => ['required', 'integer', 'min:1', 'max:99999'],
            'hora' => ['required', 'integer', 'min:0', 'max:23'],
            'minuto' => ['required', 'integer', 'min:0', 'max:59'],
        ]);

        $tempo = [
            'dia' => (int) $dados['dia'],
            'hora' => (int) $dados['hora'],
            'minuto' => (int) $dados['minuto'],
        ];

        $mesa->forceFill(['tempo' => $tempo])->save();

        // Notifica todos na mesa em tempo real
        Transmitir::enviar($mesa, 'tempo', ['tempo' => $tempo, 'ator' => $acesso->jogador->id], ['mesa']);

        return response()->json(['tempo' => $tempo]);
    }
}
