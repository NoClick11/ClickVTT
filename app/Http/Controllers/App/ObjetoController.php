<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Pagina;
use App\Support\AcessoMesa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ObjetoController extends Controller
{
    public function store(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pagina->mesa_id === $mesa->id, 404);

        $dados = $request->validate([
            'camada' => ['required', Rule::in(Objeto::CAMADAS)],
            'tipo' => ['required', Rule::in(Objeto::TIPOS)],
            'personagem_id' => ['nullable', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'nome' => ['nullable', 'string', 'max:80'],
            'x' => ['required', 'numeric'],
            'y' => ['required', 'numeric'],
            'largura' => ['required', 'numeric', 'min:1', 'max:20000'],
            'altura' => ['required', 'numeric', 'min:1', 'max:20000'],
            'z' => ['sometimes', 'integer'],
            'arquivo' => ['nullable', 'file', 'mimes:png,jpg,jpeg,webp,gif,webm,mp4', 'max:102400'],
            'dados' => ['nullable', 'array'],
            'dados.pontos' => ['required_if:tipo,parede', 'array', 'size:4'],
            'dados.pontos.*' => ['numeric'],
            'dados.tipo' => ['nullable', Rule::in(['parede', 'porta', 'janela'])],
            'dados.raio' => ['required_if:tipo,luz', 'numeric', 'min:1'],
            'dados.cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'dados.aberta' => ['nullable', 'boolean'],
        ]);
        $this->validarCamada($dados['camada'], $dados['tipo']);

        $arquivo = $request->file('arquivo');
        unset($dados['arquivo']);
        if ($arquivo) {
            $dados['arquivo'] = $arquivo->store('cenas', 'public');
            $dados['arquivo_tipo'] = $this->tipoDoArquivo($arquivo->getClientOriginalExtension());
        }

        $objeto = $pagina->objetos()->create($dados)->refresh();

        return response()->json($objeto->paraFront(), 201);
    }

    public function update(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $this->pertence($mesa, $objeto);

        if ($acesso->ehMestre()) {
            $dados = $request->validate([
                'camada' => ['sometimes', Rule::in(Objeto::CAMADAS)],
                'nome' => ['sometimes', 'nullable', 'string', 'max:80'],
                'x' => ['sometimes', 'numeric'],
                'y' => ['sometimes', 'numeric'],
                'largura' => ['sometimes', 'numeric', 'min:1', 'max:20000'],
                'altura' => ['sometimes', 'numeric', 'min:1', 'max:20000'],
                'z' => ['sometimes', 'integer'],
                'dados' => ['sometimes', 'nullable', 'array'],
                'dados.cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
                'dados.aberta' => ['nullable', 'boolean'],
                'dados.raio' => ['nullable', 'numeric', 'min:1'],
            ]);
            if (isset($dados['camada'])) {
                $this->validarCamada($dados['camada'], $objeto->tipo);
            }
            // `dados` é mesclado: pontos/tipo de uma parede nunca se perdem ao mudar só a cor ou aberta.
            if (array_key_exists('dados', $dados) && is_array($dados['dados'])) {
                $dados['dados'] = array_merge($objeto->dados ?? [], $dados['dados']);
            }
        } else {
            // Jogador: só move o PRÓPRIO token, na camada Jogadores e na página onde está.
            abort_unless(
                $objeto->camada === 'jogadores'
                && $objeto->personagem_id === $acesso->personagem->id
                && $objeto->pagina_id === $this->paginaDoJogador($mesa, $acesso),
                403,
            );
            $dados = $request->validate(['x' => ['required', 'numeric'], 'y' => ['required', 'numeric']]);
        }

        $objeto->update($dados);

        return response()->json($objeto->paraFront());
    }

    public function destroy(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $this->pertence($mesa, $objeto);
        $objeto->delete();

        return response()->json(['ok' => true]);
    }

    private function pertence(Mesa $mesa, Objeto $objeto): void
    {
        abort_unless($objeto->pagina()->where('mesa_id', $mesa->id)->exists(), 404);
    }

    private function paginaDoJogador(Mesa $mesa, AcessoMesa $acesso): ?int
    {
        return $acesso->personagem->pagina_id ?? $mesa->paginas()->value('id');
    }

    /** Paredes e luzes vivem na camada de iluminação; o resto, não. */
    private function validarCamada(string $camada, string $tipo): void
    {
        $iluminacao = in_array($tipo, ['luz', 'parede'], true);
        abort_if($iluminacao && $camada !== 'iluminacao', 422, 'Luzes e paredes pertencem à camada de iluminação.');
        abort_if(! $iluminacao && $camada === 'iluminacao', 422, 'Esta camada só aceita luzes e paredes.');
    }

    private function tipoDoArquivo(string $extensao): string
    {
        return match (strtolower($extensao)) {
            'gif' => 'gif',
            'webm', 'mp4' => 'video',
            default => 'imagem',
        };
    }
}
