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

    /**
     * O que aparece numa casa da roleta para um resultado do d100: nome curto, raridade visual (`comum`, `incomum`, `raro`, `epico`, `lendario`)
     * e o ícone. Só para a animação: o que o baú recebe sai de `resolver`.
     *
     * @return array{nome: string, tier: string, icone: string}
     */
    public static function casa(int $d): array
    {
        $d = max(1, min(100, $d));
        [$nome, $icone] = match (true) {
            $d <= 5 => ['Nada', 'nada'],
            $d <= 10 => ['฿ 10', 'moeda'],
            $d <= 15 => ['฿ 100', 'moeda'],
            $d <= 20 => ['฿ 1.000', 'moeda'],
            $d <= 25 => ['Bebida fina', 'garrafa'],
            $d <= 30 => ['Livro velho', 'livro'],
            $d <= 35 => ['฿ 10.000', 'moeda'],
            $d <= 40 => ['Pop Green', 'semente'],
            $d <= 45 => ['Kit de Ferramentas', 'kit'],
            $d <= 50 => ['Dial Cotidiano', 'dial'],
            $d <= 55 => ['Veneno Básico', 'veneno'],
            $d <= 60 => ['Planta Mãe', 'semente'],
            $d <= 65 => ['฿ 100 mil', 'joia'],
            $d <= 70 => ['Meito Wazamono', 'espada'],
            $d <= 75 => ['Dial Bélico', 'dial'],
            $d === 76 => ['Eternal Pose', 'bussola'],
            $d === 77 => ['Dial Restrito', 'dial'],
            $d === 78 => ['฿ 500 mil', 'joia'],
            $d === 79 => ['Livro de Profissão', 'livro'],
            $d === 80 => ['Den-Den Branco', 'caracol'],
            $d === 81 => ['฿ 1 milhão', 'joia'],
            $d === 82 => ['Algemas de Kairoseki', 'algema'],
            $d === 83 => ['Rede de Kairoseki', 'rede'],
            $d === 84 => ['Akuma no Mi C', 'fruta'],
            $d === 85 => ['฿ 30 milhões', 'joia'],
            $d === 86 => ['฿ 50 milhões', 'joia'],
            $d === 87 => ['Ryo Wazamono', 'espada'],
            $d === 88 => ['Equip. Engenhado', 'engrenagem'],
            $d === 89 => ['฿ 150 milhões', 'joia'],
            $d === 90 => ['Akuma no Mi B', 'fruta'],
            $d === 91 => ['Objeto Akuma', 'fruta'],
            $d === 92 => ['฿ 250 milhões', 'joia'],
            $d === 93 => ['Ô Wazamono', 'espada'],
            $d === 94 => ['฿ 500 milhões', 'joia'],
            $d === 95 => ['Akuma no Mi A', 'fruta'],
            $d === 96 => ['Munição Kairoseki', 'municao'],
            $d === 97 => ['฿ 1 bilhão', 'joia'],
            $d === 98 => ['Saijo Ô Wazamono', 'espada'],
            $d === 99 => ['Akuma no Mi S', 'fruta'],
            default => ['Raid Suit', 'armadura'],
        };
        $tier = match (true) {
            $d <= 25 => 'comum',
            $d <= 55 => 'incomum',
            $d <= 75 => 'raro',
            $d <= 89 => 'epico',
            default => 'lendario',
        };

        return ['nome' => $nome, 'tier' => $tier, 'icone' => $icone];
    }

    private const TIERS = ['comum' => 0, 'incomum' => 1, 'raro' => 2, 'epico' => 3, 'lendario' => 4];

    /**
     * A faixa da roleta (estilo caixa de CS) para um d100 já sorteado: 60 casas, a do resultado na posição `alvo` e o ponto da parada dentro dela
     * (`offset`, 0 = borda esquerda, 1 = direita). Para atiçar a mesa: com resultado fraco, um lendário fica colado ao lado e a trava para na
     * beirada, quase pegando; no trecho final (que passa devagar) entram alguns épicos e lendários. O resultado nunca muda: é só o visual.
     *
     * @return array{casas: list<array{nome: string, tier: string, icone: string}>, alvo: int, offset: float}
     */
    public static function roleta(int $d100): array
    {
        $total = 60;
        $alvo = 50;
        $casas = [];
        for ($i = 0; $i < $total; $i++) {
            $casas[] = self::casa(random_int(1, 100));
        }
        $lendario = fn () => self::casa(random_int(90, 100));
        $epico = fn () => self::casa(random_int(76, 89));
        $fracao = fn (float $a, float $b) => $a + (random_int(0, 1000) / 1000) * ($b - $a);

        // o trecho que passa devagar antes da parada: alguns épicos e lendários à vista
        foreach ([$alvo - 7, $alvo - 4, $alvo - 2] as $k => $i) {
            $casas[$i] = $k === 1 ? $lendario() : $epico();
        }
        $resultado = self::casa($d100);
        $casas[$alvo] = $resultado;
        $rank = self::TIERS[$resultado['tier']];

        if ($rank === 4) {
            // tirou um lendário: para perto do meio da casa, sem susto
            $offset = $fracao(0.35, 0.65);
        } else {
            // quase: o lendário colado num lado e a trava parando na beirada dele
            $direita = random_int(0, 1) === 1;
            $casas[$direita ? $alvo + 1 : $alvo - 1] = $lendario();
            $casas[$direita ? $alvo - 1 : $alvo + 1] = $rank >= 3 ? $lendario() : $epico();
            $offset = $direita ? $fracao(0.84, 0.94) : $fracao(0.06, 0.16);
            if ($rank === 3 && random_int(0, 1) === 1) {
                $offset = $fracao(0.3, 0.7); // épico: às vezes para tranquilo
            }
        }

        return ['casas' => $casas, 'alvo' => $alvo, 'offset' => round($offset, 3)];
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
