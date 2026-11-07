<?php

namespace App\Sistemas\OnePiece;

/**
 * Fichas prontas de companheiros que o assistente de criação entrega (ex.: a Cobra Bélica das Kujas). São personagens
 * normais da mesa: o jogador controla, tem token e ficha própria.
 */
final class Companheiros
{
    public const MODELOS = ['cobra-belica'];

    /** Nome do companheiro para o dono. */
    public static function nome(string $modelo, string $dono): string
    {
        return match ($modelo) {
            'cobra-belica' => "Cobra Bélica de {$dono}",
        };
    }

    /**
     * A ficha completa do modelo (padrão do sistema + os valores da ficha do livro).
     *
     * @return array<string, mixed>
     */
    public static function ficha(string $modelo): array
    {
        return match ($modelo) {
            'cobra-belica' => self::cobraBelica(),
        };
    }

    /** Cobra Bélica: ND 1, CR 15, 39 PV (7d8+7), Pequena, 9 m e nado 9 m; Furtividade +7, Salvaguarda de Destreza +7. */
    private static function cobraBelica(): array
    {
        $ficha = array_replace_recursive(FichaOnePiece::padrao(), [
            'especie' => 'Cobra Bélica', 'estilo' => 'Companheiro (Tipo B, Comum)', 'tamanho' => 'Pequeno',
            'movimento' => ['normal' => 9, 'nado' => 9, 'escalada' => 0, 'voo' => 0], 'deslocamento' => '9 m · nado 9 m',
            'atributos' => ['for' => 11, 'des' => 20, 'con' => 13, 'sab' => 10, 'pre' => 10, 'von' => 10],
            'salvaguardas' => ['des'],
            'pericias' => ['furtividade' => 1],
            'imunidades' => ['Envenenado'],
            'pv' => ['atual' => 39, 'max' => 39, 'temp' => 0],
            'dadosVida' => ['restantes' => 1, 'tipo' => 'd8'],
            'tecnicas' => ['atributo' => 'des'],
        ]);
        $ficha['tecnicas']['lista'] = [
            ['nome' => 'Picada (ataque)', 'origem' => 'Cobra Bélica', 'custo' => 0, 'alcance' => '1,5 m', 'efeito' => '+7 para atingir, um alvo', 'rolagem' => '1d20+7', 'acao' => 'padrao', 'descricao' => 'Ataque corpo a corpo.'],
            ['nome' => 'Picada (dano)', 'origem' => 'Cobra Bélica', 'custo' => 0, 'alcance' => '1,5 m', 'efeito' => '10 (2d4+5) de veneno', 'rolagem' => '2d4+5', 'tipoDano' => 'veneno', 'acao' => 'livre', 'descricao' => 'Em caso de acerto. Depois use "Envenenar" na aba Características.'],
        ];
        $ficha['caracteristicas'] = [
            [
                'nome' => 'Picada Venenosa', 'origem' => 'Cobra Bélica', 'tipo' => 'passiva',
                'descricao' => 'O alvo faz uma Salvaguarda de Constituição CD 16 ou fica Envenenado por 1 minuto (10 turnos); enquanto durar, recebe 1d4 de dano de veneno no início de cada turno dele e repete a salvaguarda ao final de cada turno, encerrando o veneno em caso de sucesso (e ficando imune a ele por 24 horas).',
                'acoes' => [['rotulo' => 'Envenenar o alvo mirado (Constituição CD 16)', 'acao' => 'livre', 'tipo' => 'condicao', 'alvo' => 'mirado', 'condicao' => 'envenenado', 'atributo' => 'con', 'cd' => 16, 'turnos' => '10']],
            ],
            [
                'nome' => 'Aspectos Agarrador', 'origem' => 'Cobra Bélica', 'tipo' => 'ativa', 'ativa' => false,
                'descricao' => 'Vantagem nas jogadas de ataque (comum) contra qualquer criatura agarrada por ela. Ligue a característica quando o alvo estiver agarrado.',
                'efeitos' => [['alvo' => 'ataque.arma', 'modo' => 'vantagem']],
            ],
            [
                'nome' => 'Invulnerabilidade e classificação', 'origem' => 'Cobra Bélica', 'tipo' => 'passiva',
                'descricao' => 'Nível de Desafio 1 (200 XP). Classe de Resistência 15. Perícia: Furtividade +7. Salvaguarda: Destreza +7. Invulnerável à condição Envenenado.',
            ],
        ];

        return $ficha;
    }
}
