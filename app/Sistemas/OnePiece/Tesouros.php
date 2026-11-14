<?php

namespace App\Sistemas\OnePiece;

/**
 * Tabela "Tesouros Aleatórios" (d100). Dinheiro e itens que existem na loja viram automáticos (dinheiro no baú, item do catálogo);
 * o resto (Dials, sementes, Meito, Akuma no Mi, Raid Suit...) vira só o texto, para o mestre criar e entregar depois.
 */
final class Tesouros
{
    private const KITS = [
        'kit-de-chaves', 'kit-de-construcao', 'kit-de-cozinha', 'kit-de-disfarce', 'kit-de-escalada', 'kit-medico',
        'kit-de-pesquisa', 'kit-de-primeiros-socorros', 'kit-de-temperos', 'kit-para-abrir-cadeado', 'kit-de-herbalismo', 'kit-de-venenos',
    ];

    private const BEBIDAS = ['sake-fino', 'vinho-garrafa'];

    /** @return array{texto: string, dinheiro: int, itens: list<array{ref: string, qtd: int}>, manual: bool} */
    public static function resolver(int $d): array
    {
        $d = max(1, min(100, $d));

        return match (true) {
            $d <= 5 => self::nada(),
            $d <= 10 => self::dinheiro('Uma moeda de ฿ 10', 10),
            $d <= 15 => self::dinheiro('Uma moeda de ฿ 100', 100),
            $d <= 20 => self::dinheiro('Uma nota de ฿ 1.000', 1000),
            $d <= 25 => self::item('Garrafa de bebida', self::BEBIDAS[array_rand(self::BEBIDAS)]),
            $d <= 30 => self::manual('Um livro velho com informações úteis'),
            $d <= 35 => self::dinheiro('Uma nota de ฿ 10.000', 10000),
            $d <= 40 => self::manual('Uma semente Pop Green'),
            $d <= 45 => self::item('Um Kit de Ferramentas', self::KITS[array_rand(self::KITS)]),
            $d <= 50 => self::manual('Um Dial Cotidiano'),
            $d <= 55 => self::item('Um Veneno Básico', 'veneno-basico'),
            $d <= 60 => self::manual('Uma Semente de Planta Mãe'),
            $d <= 65 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 100.000', 100000),
            $d <= 70 => self::manual('Uma arma Meito - Wazamono'),
            $d <= 75 => self::manual('Um Dial Bélico'),
            $d === 76 => self::item('Um Eternal Pose', 'eternal-pose'),
            $d === 77 => self::manual('Um Dial Restrito'),
            $d === 78 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 500.000', 500000),
            $d === 79 => self::item('Um Livro de Profissão', 'livro-de-profissao'),
            $d === 80 => self::item('Den-Den Mushi Branco', 'den-den-mushi-branco'),
            $d === 81 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 1.000.000', 1000000),
            $d === 82 => self::item('Um par de Algemas de Kairoseki', 'algemas-de-kairoseki'),
            $d === 83 => self::item('Uma Rede de Kairoseki', 'rede-de-kairoseki'),
            $d === 84 => self::manual('Um baú com uma Akuma no Mi - Categoria C'),
            $d === 85 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 30.000.000', 30000000),
            $d === 86 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 50.000.000', 50000000),
            $d === 87 => self::manual('Uma arma Meito - Ryo Wazamono'),
            $d === 88 => self::manual('Um Equipamento Engenhado'),
            $d === 89 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 150.000.000', 150000000),
            $d === 90 => self::manual('Um baú com uma Akuma no Mi - Categoria B'),
            $d === 91 => self::manual('Um Objeto Usuário de Akuma no Mi'),
            $d === 92 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 250.000.000', 250000000),
            $d === 93 => self::manual('Uma arma Meito - Ô Wazamono'),
            $d === 94 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 500.000.000', 500000000),
            $d === 95 => self::manual('Um baú com uma Akuma no Mi - Categoria A'),
            $d === 96 => self::municoes(),
            $d === 97 => self::dinheiro('Joias, ouro ou obras de arte valendo ฿ 1.000.000.000', 1000000000),
            $d === 98 => self::manual('Uma arma Meito - Saijo Ô Wazamono'),
            $d === 99 => self::manual('Um baú com uma Akuma no Mi - Categoria S'),
            default => self::manual('Raid Suit'),
        };
    }

    private static function nada(): array
    {
        return ['texto' => 'Nada', 'dinheiro' => 0, 'itens' => [], 'manual' => false];
    }

    private static function dinheiro(string $texto, int $valor): array
    {
        return ['texto' => $texto, 'dinheiro' => $valor, 'itens' => [], 'manual' => false];
    }

    private static function item(string $texto, string $ref, int $qtd = 1): array
    {
        return ['texto' => $texto, 'dinheiro' => 0, 'itens' => [['ref' => $ref, 'qtd' => $qtd]], 'manual' => false];
    }

    private static function municoes(): array
    {
        $qtd = random_int(1, 10) + random_int(1, 10) + random_int(1, 10);

        return self::item("{$qtd} Munições de Kairoseki (3d10)", 'municao-de-kairoseki', $qtd);
    }

    private static function manual(string $texto): array
    {
        return ['texto' => $texto, 'dinheiro' => 0, 'itens' => [], 'manual' => true];
    }
}
