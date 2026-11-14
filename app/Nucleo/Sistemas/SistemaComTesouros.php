<?php

namespace App\Nucleo\Sistemas;

/** Sistema com tabela de tesouro aleatório (baú do tesouro): o d100 vira dinheiro, itens do catálogo ou um texto para o mestre entregar. */
interface SistemaComTesouros
{
    /**
     * @return array{texto: string, dinheiro: int, itens: list<array{ref: string, qtd: int}>, manual: bool}
     *                                                                                                      `manual` = há algo que o mestre precisa criar/entregar à mão (o `texto` diz o quê).
     */
    public function tesouroDoD100(int $d100): array;
}
