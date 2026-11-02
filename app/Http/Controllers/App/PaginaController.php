<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Pagina;
use App\Models\Personagem;
use App\Support\AcessoMesa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaginaController extends Controller
{
    public function store(Request $request, Mesa $mesa): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $dados = $this->validar($request, $mesa);
        $dados['ordem'] ??= ($mesa->paginas()->max('ordem') ?? 0) + 1;

        $pagina = $mesa->paginas()->create($dados);

        return response()->json($pagina->paraFront(), 201);
    }

    public function update(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $pagina);
        $pagina->update($this->validar($request, $mesa, parcial: true));

        return response()->json($pagina->paraFront());
    }

    public function destroy(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $pagina);
        abort_if($mesa->paginas()->count() <= 1, 422, 'A mesa precisa ter ao menos uma página.');
        $pagina->delete();

        return response()->json(['ok' => true]);
    }

    /** Arrastar jogador para uma página: ele passa a ver aquela página. */
    public function moverJogador(Request $request, Mesa $mesa, Pagina $pagina, Personagem $personagem): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $pagina);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $personagem->update(['pagina_id' => $pagina->id]);

        return response()->json($personagem->paraFront());
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
        ]);
    }
}
