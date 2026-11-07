<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\ItemDeCatalogo;
use App\Models\Jogador;
use App\Models\Mesa;
use App\Nucleo\Efeitos\Efeitos;
use App\Nucleo\Loja\LojaService;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\SistemaComLoja;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Loja da mesa. SÓ O MESTRE abre e fecha a loja (para jogadores específicos ou todos, por categorias) e cria itens para o
 * catálogo. O jogador compra enquanto a loja estiver aberta para ele: o preço, as categorias e o dinheiro são conferidos aqui.
 */
class LojaController extends Controller
{
    public function abrir(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $sistema = $this->sistema($mesa, $sistemas);
        $ids = array_column($sistema->catalogoDeLoja()['categorias'], 'id');
        $dados = $request->validate([
            'jogadores' => ['required'],
            'categorias' => ['required', 'array', 'min:1'],
            'categorias.*' => ['string', Rule::in($ids)],
            'fator' => ['nullable', 'integer', 'between:1,10000'],
        ]);
        $alvos = $this->jogadoresAlvo($mesa, $dados['jogadores']);
        foreach ($alvos as $j) {
            $mesa->lojasAbertas()->updateOrCreate(['jogador_id' => $j->id], ['categorias' => array_values(array_unique($dados['categorias'])), 'fator' => $dados['fator'] ?? 100]);
        }
        Transmitir::enviar($mesa, 'loja', ['aberta' => true], $alvos->map(fn ($j) => "jogador.{$j->id}")->all());

        return response()->json(['lojas' => $this->lojas($mesa)]);
    }

    public function fechar(Request $request, Mesa $mesa): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $request->validate(['jogadores' => ['required']]);
        $alvos = $this->jogadoresAlvo($mesa, $request->input('jogadores'));
        $mesa->lojasAbertas()->whereIn('jogador_id', $alvos->pluck('id'))->delete();
        Transmitir::enviar($mesa, 'loja', ['aberta' => false], $alvos->map(fn ($j) => "jogador.{$j->id}")->all());

        return response()->json(['lojas' => $this->lojas($mesa)]);
    }

    /** Compra de um item do catálogo para um personagem do jogador (ou de qualquer um, se for o mestre testando). */
    public function comprar(Request $request, Mesa $mesa, RegistroSistemas $sistemas, LojaService $loja): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $sistema = $this->sistema($mesa, $sistemas);
        $dados = $request->validate(['personagem_id' => ['required', 'integer'], 'item' => ['required', 'string', 'max:60'], 'qtd' => ['nullable', 'integer', 'between:1,99']]);
        abort_unless($acesso->podeControlar($dados['personagem_id']), 403, 'Esta ficha não é sua.');
        $aberta = $mesa->lojasAbertas()->where('jogador_id', $acesso->jogador->id)->first();
        if (! $aberta) {
            throw ValidationException::withMessages(['loja' => 'A loja não está aberta para você.']);
        }
        $r = $loja->comprar($mesa, $sistema, $aberta, $dados['personagem_id'], $dados['item'], $dados['qtd'] ?? 1);
        $p = $r['personagem'];
        $moeda = $sistema->moedaDaLoja();
        $campos = [$moeda['campo'] => $r['saldo'], 'inventario' => $p->ficha['inventario']];
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => $campos, 'criacao' => $p->criacao, 'ator' => $acesso->jogador->id], $canais);
        Transmitir::enviar($mesa, 'loja-compra', ['personagem_id' => $p->id, 'jogador' => $acesso->jogador->nome, 'item' => $r['entrada']['nome'], 'qtd' => $dados['qtd'] ?? 1, 'total' => $r['total']], ['mestre']);

        return response()->json(['campos' => $campos, 'item' => $r['item']->paraFront(), 'total' => $r['total'], 'saldo' => $r['saldo']]);
    }

    public function store(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $item = $mesa->itensDeCatalogo()->create($this->campos($request, $mesa, $sistemas, false));
        $this->avisarMestre($mesa);

        return response()->json($item->paraFront(), 201);
    }

    public function update(Request $request, Mesa $mesa, ItemDeCatalogo $item, RegistroSistemas $sistemas): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($item->mesa_id === $mesa->id, 404);
        $item->update($this->campos($request, $mesa, $sistemas, true));
        $this->avisarMestre($mesa);

        return response()->json($item->paraFront());
    }

    public function destroy(Request $request, Mesa $mesa, ItemDeCatalogo $item): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($item->mesa_id === $mesa->id, 404);
        $item->delete();
        $this->avisarMestre($mesa);

        return response()->json(['ok' => true]);
    }

    /** @return array<string, mixed> */
    private function campos(Request $request, Mesa $mesa, RegistroSistemas $sistemas, bool $parcial): array
    {
        $sistema = $this->sistema($mesa, $sistemas);
        $c = $sistema->catalogoDeLoja();
        $regras = [
            'nome' => ['required', 'string', 'max:120'],
            'descricao' => ['nullable', 'string', 'max:2000'],
            'categoria' => ['required', 'string', Rule::in(array_column($c['categorias'], 'id'))],
            'raridade' => ['required', 'string', Rule::in($c['raridades'])],
            'preco' => ['required', 'integer', 'between:0,1000000000000'],
            'peso' => ['required', 'numeric', 'between:0,100000'],
            'equipavel' => ['required', 'boolean'],
            'requer_sintonia' => ['required', 'boolean'],
        ] + Efeitos::regras('efeitos', $sistema instanceof \App\Nucleo\Sistemas\Sistema ? $sistema->alvosDeEfeito() : null) + ($sistema instanceof \App\Nucleo\Sistemas\Sistema ? $sistema->regrasItem() : []);
        if ($parcial) {
            foreach (['nome', 'descricao', 'categoria', 'raridade', 'preco', 'peso', 'equipavel', 'requer_sintonia', 'efeitos'] as $k) {
                $regras[$k] = ['sometimes', ...$regras[$k]];
            }
        }
        $v = $request->validate($regras);
        $campos = collect($v)->only(['nome', 'descricao', 'categoria', 'raridade', 'preco', 'peso', 'equipavel', 'requer_sintonia'])->all();
        if (array_key_exists('nome', $campos)) {
            $campos['nome'] = trim($campos['nome']);
        }
        if (array_key_exists('efeitos', $v)) {
            $campos['efeitos'] = array_map(fn (array $e) => array_filter([
                'alvo' => $e['alvo'], 'modo' => $e['modo'],
                'valor' => in_array($e['modo'], ['vantagem', 'desvantagem'], true) ? null : (is_string($e['valor']) ? trim($e['valor']) : $e['valor']),
            ], fn ($x) => $x !== null), $v['efeitos']);
        }
        if (! $parcial || $request->has('dados')) {
            $campos['dados'] = $v['dados'] ?? null; // só entra o que o sistema declarou em `regrasItem()`
        }

        return $campos;
    }

    private function sistema(Mesa $mesa, RegistroSistemas $sistemas): SistemaComLoja
    {
        $s = $sistemas->resolver($mesa->sistema->slug);
        abort_unless($s instanceof SistemaComLoja, 422, 'Este sistema ainda não tem loja.');

        return $s;
    }

    /** @return \Illuminate\Support\Collection<int, Jogador> */
    private function jogadoresAlvo(Mesa $mesa, mixed $quem)
    {
        $jogadores = $mesa->jogadores()->where('papel', '!=', 'mestre');

        return $quem === 'todos' ? $jogadores->get() : $jogadores->whereIn('id', array_map('intval', (array) $quem))->get();
    }

    /** @return list<array<string, mixed>> */
    private function lojas(Mesa $mesa): array
    {
        return $mesa->lojasAbertas()->get()->map->paraFront()->values()->all();
    }

    private function avisarMestre(Mesa $mesa): void
    {
        Transmitir::enviar($mesa, 'loja', ['aberta' => true, 'catalogo' => true], ['mestre']);
    }
}
