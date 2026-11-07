<?php

namespace App\Nucleo\Sistemas;

/**
 * Sistema que tem catálogo de itens e loja. O catálogo (itens, categorias, preços) é do módulo do sistema; o núcleo só
 * sabe vender: confere se a loja está aberta, tira a moeda da ficha e entrega o item no inventário.
 */
interface SistemaComLoja
{
    /**
     * Catálogo do sistema: categorias ([{id, nome, grupo}]), raridades (ids) e itens. Cada item tem `id`, `nome`, `categoria`,
     * `raridade`, `preco` (null = não se vende), `tipo` (`item` é vendável; `servico` não) e `loja` (false = só o mestre).
     *
     * @return array{categorias: list<array<string, mixed>>, raridades: list<string>, itens: list<array<string, mixed>>}
     */
    public function catalogoDeLoja(): array;

    /** Onde fica o dinheiro na ficha (`campo`, caminho com pontos) e o símbolo da moeda. @return array{campo: string, simbolo: string} */
    public function moedaDaLoja(): array;

    /**
     * Campos do item da mesa (`nome`, `descricao`, `peso`, `equipavel`, `requer_sintonia`, `dados`, `efeitos`) para uma entrada
     * do catálogo do SISTEMA (os itens criados pelo mestre já trazem esses campos).
     *
     * @param  array<string, mixed>  $entrada
     * @return array<string, mixed>
     */
    public function itemDaLoja(array $entrada): array;

    /** A ficha com `$qtd` unidades do item no inventário (soma à quantidade se já tem). */
    public function entregarNoInventario(array $ficha, int $itemId, int $qtd): array;
}
