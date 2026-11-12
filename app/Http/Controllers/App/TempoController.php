<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Sistemas\OnePiece\NavioService;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TempoController extends Controller
{
    /** Atualiza o dia e horário da mesa (só o mestre). */
    public function atualizar(Request $request, Mesa $mesa, NavioService $servico): JsonResponse
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

        // Com a Mesa travada: dois avanços seguidos não cobram a mesma semana duas vezes
        $navios = DB::transaction(function () use ($mesa, $tempo, $servico) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $antigo = (int) ($m->tempo['dia'] ?? 1);
            $m->forceFill(['tempo' => $tempo])->save();

            // Navios: obras e consertos que venceram, despesas semanais, auto-reparo e baterias
            return $m->sistema->slug === 'one-piece' ? $servico->aoAvancarTempo($m, $antigo, $tempo['dia']) : [];
        });

        // Notifica todos na mesa em tempo real
        Transmitir::enviar($mesa, 'tempo', ['tempo' => $tempo, 'ator' => $acesso->jogador->id], ['mesa']);
        foreach ($navios as $navio) {
            // ator 0: quem avançou o tempo também recebe (a mudança veio do servidor)
            Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $navio->id, 'campos' => NavioService::campos($navio), 'ator' => 0], ['mesa']);
        }

        return response()->json(['tempo' => $tempo]);
    }
}
