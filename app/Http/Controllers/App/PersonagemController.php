<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\PersonagemRequest;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Personagem;
use App\Nucleo\Combate\CombateService;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PersonagemController extends Controller
{
    /**
     * O mestre cria um personagem de dentro do jogo (as mesmas regras do site: nome único na mesa, cor, jogadores
     * da mesa). Sem jogadores é um NPC, que só o mestre controla. A ficha nasce com os valores padrão do sistema.
     */
    public function criar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = Validator::make($request->all(), PersonagemRequest::regrasPara($mesa), PersonagemRequest::mensagens())->validate();

        $personagem = $mesa->personagens()->create(['nome' => trim($dados['nome']), 'cor' => $dados['cor']]);
        $personagem->jogadores()->sync($dados['jogadores'] ?? []);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront(), 201);
    }

    /** O mestre escolhe os jogadores de um personagem (N:N). */
    public function atribuir(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);

        $dados = $request->validate([
            'jogadores' => ['present', 'array'],
            'jogadores.*' => ['integer', Rule::exists('jogadores', 'id')->where('mesa_id', $mesa->id)->where('papel', 'jogador')],
        ]);
        $personagem->jogadores()->sync($dados['jogadores']);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront());
    }

    /**
     * O mestre exclui um personagem: some a ficha, os tokens dele em todas as páginas e o lugar dele no combate (se era o turno
     * dele, passa para o primeiro da fila). Os itens da mesa não são tocados. Não dá para desfazer.
     */
    public function excluir(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);

        $combate = DB::transaction(function () use ($mesa, $personagem) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = CombateService::normalizar($m->combate);
            $antes = count($c['itens']);
            $removidos = array_column(array_filter($c['itens'], fn ($i) => $i['personagem_id'] === $personagem->id), 'id');
            $c['itens'] = array_values(array_filter($c['itens'], fn ($i) => $i['personagem_id'] !== $personagem->id));
            if (in_array($c['atual'], $removidos, true)) {
                $c['atual'] = $c['fase'] === 'em_curso' ? ($c['itens'][0]['id'] ?? null) : null;
            }
            $mudou = count($c['itens']) !== $antes;
            if ($mudou) {
                $m->forceFill(['combate' => $c])->save();
            }
            Objeto::query()->where('personagem_id', $personagem->id)->delete(); // os tokens dele em todas as páginas
            $personagem->delete();

            return $mudou ? $c : null;
        });

        if ($combate) {
            Transmitir::enviar($mesa, 'combate', ['combate' => $combate, 'ator' => $acesso->jogador->id], ['mesa']);
        }
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }
}
