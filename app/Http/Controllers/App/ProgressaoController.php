<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Progressão dos jogadores, só pelo mestre: o que está liberado (descansos e subir de nível) e a distribuição de XP. */
class ProgressaoController extends Controller
{
    private const LIMITE_XP = 10000000;

    /** Liga/desliga o que os jogadores podem fazer: descanso curto, descanso longo, subir de nível. Corpo: qualquer um dos três (booleano). */
    public function liberacoes(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = $request->validate([
            'descanso_curto' => ['sometimes', 'boolean'],
            'descanso_longo' => ['sometimes', 'boolean'],
            'subir_nivel' => ['sometimes', 'boolean'],
        ]);
        $mesa->forceFill($dados)->save();
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($mesa->only(['descanso_curto', 'descanso_longo', 'subir_nivel']));
    }

    /**
     * Divide um total de XP, em partes iguais, entre os personagens escolhidos (que têm jogador): 2700 para 3 = 900 cada. O que
     * sobra da divisão (total não múltiplo) não é distribuído. Corpo: `personagens` (ids) e `total` (inteiro ≥ 1).
     */
    public function distribuirXp(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        $dados = $request->validate([
            'personagens' => ['required', 'array', 'min:1', 'max:50'],
            'personagens.*' => ['integer', 'distinct', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'total' => ['required', 'integer', 'min:1', 'max:'.self::LIMITE_XP],
        ]);
        $ids = array_map('intval', $dados['personagens']);
        $porCabeca = intdiv((int) $dados['total'], count($ids));
        abort_if($porCabeca < 1, 422, 'O total é pequeno demais para dividir entre '.count($ids).' personagens.');

        $nomes = DB::transaction(function () use ($mesa, $sistema, $ids, $porCabeca) {
            $nomes = [];
            foreach (Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $ids)->lockForUpdate()->get() as $p) {
                $ficha = array_replace_recursive($sistema->fichaPadrao(), $p->ficha ?? []);
                $ficha['xp']['atual'] = min(self::LIMITE_XP, (int) ($ficha['xp']['atual'] ?? 0) + $porCabeca);
                $p->ficha = $ficha;
                $p->save();
                $nomes[] = $p->nome;
            }

            return $nomes;
        });

        // Cada ficha se atualiza na hora para o mestre e para os donos dela.
        foreach (Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $ids)->with('jogadores')->get() as $p) {
            $canais = ['mestre', ...$p->jogadores->pluck('id')->map(fn ($id) => "jogador.{$id}")->all()];
            Transmitir::enviar($mesa, 'ficha', [
                'personagem_id' => $p->id, 'campos' => ['xp' => $p->ficha['xp']], 'criacao' => $p->criacao, 'ator' => 0,
            ], $canais);
        }
        $aviso = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => null, 'tipo' => 'texto', 'visibilidade' => 'todos',
            'texto' => "O mestre distribuiu XP: {$porCabeca} para cada (".implode(', ', $nomes).').', 'dados' => null,
        ]);
        EntregarMensagem::para($mesa, $aviso, $acesso);

        return response()->json(['por_cabeca' => $porCabeca, 'sobra' => (int) $dados['total'] - $porCabeca * count($ids), 'personagens' => $nomes]);
    }
}
