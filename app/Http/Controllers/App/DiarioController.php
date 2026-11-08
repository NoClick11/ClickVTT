<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\DiarioPasta;
use App\Models\Folheto;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Diário da mesa (só o mestre mexe): pastas, folhetos e o lugar de cada personagem. */
class DiarioController extends Controller
{
    public function criarPasta(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = $request->validate(['nome' => ['required', 'string', 'max:80'], 'pai_id' => ['nullable', $this->pasta($mesa)]]);
        $pasta = $mesa->diarioPastas()->create(['nome' => trim($dados['nome']), 'pai_id' => $dados['pai_id'] ?? null]);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($pasta->paraFront(), 201);
    }

    public function atualizarPasta(Request $request, Mesa $mesa, DiarioPasta $pasta): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pasta->mesa_id === $mesa->id, 404);
        $dados = $request->validate(['nome' => ['sometimes', 'string', 'max:80'], 'pai_id' => ['sometimes', 'nullable', $this->pasta($mesa)]]);
        if (! empty($dados['pai_id'])) {
            // não dá para pôr uma pasta dentro dela mesma nem de uma descendente
            for ($id = (int) $dados['pai_id']; $id; $id = (int) $mesa->diarioPastas()->whereKey($id)->value('pai_id')) {
                abort_if($id === $pasta->id, 422, 'Não dá para pôr a pasta dentro dela mesma.');
            }
        }
        $pasta->update($dados);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($pasta->paraFront());
    }

    /** Excluir a pasta não apaga o que há nela: pastas, personagens e folhetos sobem para a pasta de cima. */
    public function excluirPasta(Request $request, Mesa $mesa, DiarioPasta $pasta): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pasta->mesa_id === $mesa->id, 404);
        $mesa->diarioPastas()->where('pai_id', $pasta->id)->update(['pai_id' => $pasta->pai_id]);
        $mesa->folhetos()->where('pasta_id', $pasta->id)->update(['pasta_id' => $pasta->pai_id]);
        $mesa->personagens()->where('pasta_id', $pasta->id)->update(['pasta_id' => $pasta->pai_id]);
        $pasta->delete();
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    public function criarFolheto(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:80'],
            'imagem' => ['required', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:10240'],
            'texto' => ['nullable', 'string', 'max:5000'],
            'pasta_id' => ['nullable', $this->pasta($mesa)],
        ]);
        $folheto = $mesa->folhetos()->create([
            'nome' => trim($dados['nome']),
            'texto' => $dados['texto'] ?? null,
            'pasta_id' => $dados['pasta_id'] ?? null,
            'imagem' => $request->file('imagem')->store('folhetos', 'public'),
        ]);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($folheto->paraFront(), 201);
    }

    public function atualizarFolheto(Request $request, Mesa $mesa, Folheto $folheto): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($folheto->mesa_id === $mesa->id, 404);
        $folheto->update($request->validate([
            'nome' => ['sometimes', 'string', 'max:80'],
            'texto' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'visivel' => ['sometimes', 'boolean'],
            'pasta_id' => ['sometimes', 'nullable', $this->pasta($mesa)],
        ]));
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($folheto->paraFront());
    }

    public function excluirFolheto(Request $request, Mesa $mesa, Folheto $folheto): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($folheto->mesa_id === $mesa->id, 404);
        $folheto->delete();
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    /** Mostra o folheto agora: libera para os jogadores e abre na tela de todos. */
    public function mostrarFolheto(Request $request, Mesa $mesa, Folheto $folheto): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($folheto->mesa_id === $mesa->id, 404);
        $folheto->update(['visivel' => true]);
        Transmitir::cena($mesa, null, $acesso->jogador->id);
        Transmitir::enviar($mesa, 'folheto', ['folheto' => $folheto->paraFront(), 'ator' => $acesso->jogador->id], ['mesa']);

        return response()->json($folheto->paraFront());
    }

    public function moverPersonagem(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $dados = $request->validate(['pasta_id' => ['present', 'nullable', $this->pasta($mesa)]]);
        $personagem->update(['pasta_id' => $dados['pasta_id']]);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    private function pasta(Mesa $mesa)
    {
        return Rule::exists('diario_pastas', 'id')->where('mesa_id', $mesa->id);
    }
}
