<?php

namespace App\Sistemas\Dnd5e;

use App\Nucleo\Sistemas\Sistema;

/** Módulo de Dungeons & Dragons, quinta edição. As regras entram aqui conforme o núcleo as pede. */
class Dnd5e implements Sistema
{
    public static function slug(): string
    {
        return 'dnd-5e';
    }

    public function fichaPadrao(): array
    {
        return FichaDnd5e::padrao();
    }

    public function regrasFicha(): array
    {
        return FichaDnd5e::regras();
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
        return FichaDnd5e::regrasItem();
    }

    public function alvosDeEfeito(): array
    {
        return FichaDnd5e::alvosDeEfeito();
    }
}
