<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Mesa;
use App\Nucleo\Efeitos\Efeitos;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Itens da mesa. SÓ O MESTRE cria, edita e exclui (os efeitos de um item são poder de jogo). Entregar o item a um
 * personagem é editar o inventário da ficha (`FichaController`); o jogador equipa e muda quantidades.
 */
class ItemController extends Controller
{
    public function store(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $item = $mesa->itens()->create($this->campos($request, $mesa, $sistemas, parcial: false));
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($item->paraFront(), 201);
    }

    public function update(Request $request, Mesa $mesa, Item $item, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($item->mesa_id === $mesa->id, 404);
        $item->update($this->campos($request, $mesa, $sistemas, parcial: true));
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($item->paraFront());
    }

    /** Exclui o item e o tira do inventário de todos os personagens da mesa. */
    public function destroy(Request $request, Mesa $mesa, Item $item, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($item->mesa_id === $mesa->id, 404);

        $sistema = $sistemas->resolver($mesa->sistema->slug);
        if ($sistema) {
            foreach ($mesa->personagens()->whereNotNull('ficha')->get() as $personagem) {
                if (in_array($item->id, $sistema->itensReferenciados($personagem->ficha), true)) {
                    $personagem->ficha = $sistema->semItem($personagem->ficha, $item->id);
                    $personagem->save();
                }
            }
        }
        $item->delete();
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    /** Valida e normaliza o corpo. `$parcial` (PATCH): só os campos enviados mudam. */
    private function campos(Request $request, Mesa $mesa, RegistroSistemas $sistemas, bool $parcial): array
    {
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        $regras = [
            'nome' => ['required', 'string', 'max:120'],
            'descricao' => ['nullable', 'string', 'max:2000'],
            'peso' => ['required', 'numeric', 'between:0,100000'],
            'equipavel' => ['required', 'boolean'],
            'requer_sintonia' => ['required', 'boolean'],
        ] + Efeitos::regras('efeitos', $sistema?->alvosDeEfeito()) + ($sistema?->regrasItem() ?? []);
        if ($parcial) {
            foreach (['nome', 'descricao', 'peso', 'equipavel', 'requer_sintonia', 'efeitos'] as $chave) {
                $regras[$chave] = ['sometimes', ...$regras[$chave]];
            }
        }

        $validado = $request->validate($regras);
        $campos = collect($validado)->only(['nome', 'descricao', 'peso', 'equipavel', 'requer_sintonia'])->all();
        if (array_key_exists('nome', $campos)) {
            $campos['nome'] = trim($campos['nome']);
        }
        if (array_key_exists('efeitos', $validado)) {
            $campos['efeitos'] = array_map(fn (array $e) => array_filter([
                'alvo' => $e['alvo'], 'modo' => $e['modo'],
                'valor' => in_array($e['modo'], ['vantagem', 'desvantagem'], true) ? null : (is_string($e['valor']) ? trim($e['valor']) : $e['valor']),
            ], fn ($v) => $v !== null), $validado['efeitos']);
        }
        if (! $parcial || $request->has('dados')) {
            $campos['dados'] = $validado['dados'] ?? null; // só entra o que o sistema declarou em `regrasItem()`
        }

        return $campos;
    }
}
