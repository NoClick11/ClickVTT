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

    public function metadadosDaRolagem(array $termos, array $variaveis, array $itens = []): array
    {
        return Regras::metadadosDaRolagem($termos, $variaveis, $itens);
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
        return [
            // numéricos (soma, base, mín., máx.)
            'ca', 'iniciativa', 'cd', 'ataque', 'ataque.arma', 'dano.arma', 'carga.max', 'pv.max',
            'salv.*', 'pericia.*', 'atributos.*',
            // só para vantagem/desvantagem: testes de atributo e de ferramenta (os demais alvos de rolagem são os de cima)
            'teste.*', 'ferramenta.*', ...array_map(fn ($a) => "teste.{$a}", FichaDnd5e::ATRIBUTOS),
            ...array_map(fn ($a) => "salv.{$a}", FichaDnd5e::ATRIBUTOS),
            ...array_map(fn ($a) => "atributos.{$a}", FichaDnd5e::ATRIBUTOS),
            ...array_map(fn ($p) => "pericia.{$p}", array_keys(FichaDnd5e::PERICIAS)),
        ];
    }
}
