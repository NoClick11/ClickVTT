<?php

namespace App\Nucleo\Loja;

use App\Models\Item;
use App\Models\ItemDeCatalogo;
use App\Models\LojaAberta;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\SistemaComLoja;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A loja da mesa: o catálogo (do sistema + os itens que o mestre criou), o preço e a compra. O servidor é quem decide: confere
 * se a loja está aberta para o jogador, a categoria, o preço (nunca o que o cliente manda) e o dinheiro da ficha.
 */
final class LojaService
{
    /** A entrada do catálogo (do sistema ou do mestre) ou null. @return array<string, mixed>|null */
    public function entrada(Mesa $mesa, SistemaComLoja $sistema, string $ref): ?array
    {
        if (str_starts_with($ref, 'c:')) {
            return $mesa->itensDeCatalogo()->find((int) substr($ref, 2))?->comoEntrada();
        }
        foreach ($sistema->catalogoDeLoja()['itens'] as $i) {
            if ($i['id'] === $ref) {
                return $i;
            }
        }

        return null;
    }

    /** Preço total: o do catálogo × quantidade × ajuste da loja (%), arredondado para cima. */
    public function total(array $entrada, int $qtd, int $fator): int
    {
        return (int) ceil((int) $entrada['preco'] * $qtd * $fator / 100);
    }

    /**
     * Compra: tira o dinheiro e entrega o item no inventário, numa transação.
     *
     * @return array{personagem: Personagem, item: Item, total: int, saldo: int, entrada: array<string, mixed>}
     */
    public function comprar(Mesa $mesa, SistemaComLoja $sistema, LojaAberta $loja, int $personagemId, string $ref, int $qtd): array
    {
        $entrada = $this->entrada($mesa, $sistema, $ref);
        if (! $entrada || ($entrada['tipo'] ?? 'item') !== 'item' || $entrada['preco'] === null || empty($entrada['loja'])) {
            throw ValidationException::withMessages(['item' => 'Este item não está à venda.']);
        }
        if (! in_array($entrada['categoria'], $loja->categorias, true)) {
            throw ValidationException::withMessages(['item' => 'Este item não está na loja aberta para você.']);
        }
        $moeda = $sistema->moedaDaLoja();
        $total = $this->total($entrada, $qtd, $loja->fator);

        return DB::transaction(function () use ($mesa, $sistema, $personagemId, $entrada, $qtd, $total, $moeda) {
            $p = Personagem::query()->whereKey($personagemId)->lockForUpdate()->firstOrFail();
            $ficha = $p->ficha ?? $sistema->fichaPadrao();
            $saldo = (int) data_get($ficha, $moeda['campo'], 0);
            if ($saldo < $total) {
                throw ValidationException::withMessages(['dinheiro' => sprintf(
                    'Sem dinheiro: %s custa %s %s e você tem %s %s.',
                    $entrada['nome'], $moeda['simbolo'], number_format($total, 0, ',', '.'), $moeda['simbolo'], number_format($saldo, 0, ',', '.'),
                )]);
            }
            $item = $this->materializar($mesa, $sistema, $entrada);
            $ficha = $sistema->entregarNoInventario($ficha, $item->id, $qtd);
            data_set($ficha, $moeda['campo'], $saldo - $total);
            $p->ficha = $ficha;
            $p->save();

            return ['personagem' => $p, 'item' => $item, 'total' => $total, 'saldo' => $saldo - $total, 'entrada' => $entrada];
        });
    }

    /** O item da mesa que representa a entrada (um por entrada; criado na primeira compra, atualizado nas seguintes). */
    public function materializar(Mesa $mesa, SistemaComLoja $sistema, array $entrada): Item
    {
        $campos = ! empty($entrada['propria'])
            ? collect($entrada)->only(['nome', 'descricao', 'peso', 'equipavel', 'requer_sintonia', 'dados', 'efeitos'])->all()
            : $sistema->itemDaLoja($entrada);
        $item = $mesa->itens()->firstOrNew(['catalogo_id' => $entrada['id']]);
        $item->fill($campos + ['catalogo_id' => $entrada['id']])->save();

        return $item;
    }

    /** Itens que o mestre criou para o catálogo e estão nas categorias dadas. @param list<string> $categorias */
    public function itensProprios(Mesa $mesa, array $categorias)
    {
        return $mesa->itensDeCatalogo()->whereIn('categoria', $categorias)->orderBy('nome')->get();
    }
}
