<?php

namespace App\Sistemas\OnePiece;

/**
 * Catálogo de itens do One Piece (cap. 8) no servidor: equipamentos, armas, veículos e serviços com preço, peso, raridade e
 * dados do sistema. Vem de `dados/itens.json` (gerado de `itens/` no TS e conferido por teste). A loja usa o preço de compra e
 * de venda daqui, nunca o que o cliente manda.
 */
class Itens
{
    /** @var array<string, mixed>|null */
    private static ?array $catalogo = null;

    /** @return array<string, mixed> */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/itens.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function item(string $id): ?array
    {
        foreach (self::catalogo()['itens'] as $i) {
            if ($i['id'] === $id) {
                return $i;
            }
        }

        return null;
    }

    /** Preço de compra: o do livro vezes `$fator` (Mercado Negro: até 100 vezes, a critério do Narrador). Null se o preço não é fixo. */
    public static function precoDeCompra(array $item, float $fator = 1): ?int
    {
        if ($item['preco'] === null) {
            return null;
        }
        $max = $item['raridade'] === 'mercado-negro' ? (float) self::catalogo()['comercio']['multiplicadorMaximoDoMercadoNegro'] : 1.0;

        return (int) round($item['preco'] * min(max($fator, 0.0), $max));
    }

    /** Preço de venda: metade do preço em bom estado; serviços e itens sem preço fixo não se vendem. */
    public static function precoDeVenda(array $item, bool $bomEstado = true): ?int
    {
        if ($item['tipo'] !== 'item' || $item['preco'] === null) {
            return null;
        }

        return (int) floor($item['preco'] * ($bomEstado ? (float) self::catalogo()['comercio']['vendaDeEquipamentos'] : 0.0));
    }
}
