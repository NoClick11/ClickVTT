<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Exploracao;
use App\Models\Mesa;
use App\Models\Pagina;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A memória das áreas já vistas (névoa de exploração): uma imagem pequena por jogador e página, guardada aqui para valer em qualquer aparelho.
 * Cada um lê e grava só a sua; o mestre não tem névoa e pode apagar a de todos numa página.
 */
class ExploracaoController extends Controller
{
    private const MAX = 400_000;

    public function mostrar(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($pagina->mesa_id === $mesa->id, 404);
        $e = Exploracao::query()->where('pagina_id', $pagina->id)->where('jogador_id', $acesso->jogador->id)->first();

        return response()->json(['imagem' => $e?->imagem]);
    }

    public function guardar(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($pagina->mesa_id === $mesa->id, 404);
        abort_if($acesso->ehMestre(), 403, 'O mestre não tem névoa de exploração.');
        $d = $request->validate(['imagem' => ['required', 'string', 'max:'.self::MAX, 'regex:/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/']]);
        Exploracao::query()->updateOrCreate(
            ['pagina_id' => $pagina->id, 'jogador_id' => $acesso->jogador->id],
            ['mesa_id' => $mesa->id, 'imagem' => $d['imagem']],
        );

        return response()->json(['ok' => true]);
    }

    /** O mestre apaga a memória de todos os jogadores nesta página (todos veem a névoa de novo). */
    public function limpar(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pagina->mesa_id === $mesa->id, 404);
        Exploracao::query()->where('pagina_id', $pagina->id)->delete();
        Transmitir::enviar($mesa, 'exploracao', ['pagina_id' => $pagina->id], ['mesa']);

        return response()->json(['ok' => true]);
    }
}
