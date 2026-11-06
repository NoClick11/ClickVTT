<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Sistemas\Sistema;

/** Módulo de One Piece: parte das regras do D&D 5e, com atributos, perícias, técnicas e pontos de poder próprios. */
class OnePiece implements Sistema
{
    public static function slug(): string
    {
        return 'one-piece';
    }

    public function fichaPadrao(): array
    {
        return FichaOnePiece::padrao();
    }

    public function regrasFicha(): array
    {
        return FichaOnePiece::regras();
    }

    public function variaveisDeRolagem(array $ficha, array $itens = []): array
    {
        return Regras::calcular($ficha, $itens);
    }

    public function metadadosDaRolagem(array $termos, array $variaveis, array $itens = [], array $ficha = []): array
    {
        return Regras::metadadosDaRolagem($termos, $variaveis, $itens, $ficha);
    }

    public function itensReferenciados(array $ficha): array
    {
        $ids = [];
        foreach ($ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                if (isset($ref['item_id'])) {
                    $ids[(int) $ref['item_id']] = true;
                }
            }
        }

        return array_keys($ids);
    }

    public function semItem(array $ficha, int $itemId): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            $ficha['inventario'][$s]['itens'] = array_values(array_filter($secao['itens'] ?? [], fn ($ref) => (int) ($ref['item_id'] ?? 0) !== $itemId));
        }

        return $ficha;
    }

    public function regrasItem(): array
    {
        return FichaOnePiece::regrasItem();
    }

    public function alvosDeEfeito(): array
    {
        return FichaOnePiece::alvosDeEfeito();
    }
}
