<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\EventoDeCombate;
use App\Models\Mesa;
use App\Nucleo\Combate\CombateService;
use App\Nucleo\Combate\Pipeline;
use App\Support\AcessoMesa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Janela de reação de um evento do combate (ex.: um ataque): responder (usar uma reação ou passar) e o mestre encerrar. */
class EventoDeCombateController extends Controller
{
    /** O personagem usa uma reação (`opcao`) ou passa (`opcao` vazio). Só quem controla o personagem. */
    public function reagir(Request $request, Mesa $mesa, EventoDeCombate $evento, Pipeline $pipeline): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($evento->mesa_id === $mesa->id, 404);
        $dados = $request->validate([
            'personagem_id' => ['required', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'opcao' => ['nullable', 'string', 'max:20'],
        ]);

        $e = $pipeline->reagir($mesa, $acesso, $evento, $dados['personagem_id'], $dados['opcao'] ?? null);

        return response()->json([
            'evento' => Pipeline::resumo($e),
            'combate' => CombateService::normalizar($mesa->fresh()->combate),
        ]);
    }

    /** O mestre fecha a janela: quem não respondeu conta como "passou" e o ataque é resolvido. */
    public function encerrar(Request $request, Mesa $mesa, EventoDeCombate $evento, Pipeline $pipeline): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($evento->mesa_id === $mesa->id, 404);

        $e = $pipeline->encerrar($mesa, $acesso, $evento);

        return response()->json([
            'evento' => Pipeline::resumo($e),
            'combate' => CombateService::normalizar($mesa->fresh()->combate),
        ]);
    }
}
