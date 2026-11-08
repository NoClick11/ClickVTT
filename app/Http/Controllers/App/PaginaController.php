<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Pagina;
use App\Models\Jogador;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaginaController extends Controller
{
    public function store(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = $this->validar($request, $mesa);
        $dados['ordem'] ??= ($mesa->paginas()->max('ordem') ?? 0) + 1;
        $dados['tamanho_quadrado'] ??= 100;

        $pagina = $mesa->paginas()->create($dados)->refresh(); // traz os defaults do banco
        Transmitir::cena($mesa, null, $acesso->jogador->id, true);

        return response()->json($pagina->paraFront(), 201);
    }

    public function update(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $pagina);
        $pagina->update($this->validar($request, $mesa, parcial: true));
        Transmitir::cena($mesa, $pagina->id, $acesso->jogador->id);

        return response()->json($pagina->paraFront());
    }

    public function destroy(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $pagina);
        abort_if($mesa->paginas()->count() <= 1, 422, 'A mesa precisa ter ao menos uma página.');
        $pagina->delete();
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    /** Arrastar jogador para uma página: ele passa a ver aquela página. */
    public function moverJogador(Request $request, Mesa $mesa, Pagina $pagina, Jogador $jogador): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $pagina);
        abort_unless($jogador->mesa_id === $mesa->id, 404);
        $jogador->update(['pagina_id' => $pagina->id]);
        Transmitir::cena($mesa, $pagina->id, $acesso->jogador->id);

        return response()->json($jogador->paraFront());
    }

    private function pertence(Mesa $mesa, Pagina $pagina): void
    {
        abort_unless($pagina->mesa_id === $mesa->id, 404);
    }

    private function validar(Request $request, Mesa $mesa, bool $parcial = false): array
    {
        $obrigatorio = $parcial ? 'sometimes' : 'required';

        return $request->validate([
            'nome' => [$obrigatorio, 'string', 'max:80'],
            'pasta_id' => ['nullable', Rule::exists('pastas', 'id')->where('mesa_id', $mesa->id)],
            'ordem' => ['sometimes', 'integer', 'min:0'],
            'colunas' => ['sometimes', 'integer', 'min:1', 'max:300'],
            'linhas' => ['sometimes', 'integer', 'min:1', 'max:300'],
            'tamanho_quadrado' => ['sometimes', 'integer', 'min:10', 'max:400'],
            'grade_quadrada' => ['sometimes', 'boolean'],
            'distancia_quadrado' => ['sometimes', 'numeric', 'gt:0', 'max:10000'],
            'unidade' => ['sometimes', 'string', 'max:8'],
            'iluminacao_ativa' => ['sometimes', 'boolean'],
            'luz_ambiente' => ['sometimes', 'integer', 'between:0,100'],
            'visao_padrao' => ['sometimes', 'integer', 'between:0,200'],
            'usar_visao' => ['sometimes', 'boolean'],
            'memoria_ativa' => ['sometimes', 'boolean'],
        ]);
    }
}
