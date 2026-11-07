<?php

namespace App\Sistemas\OnePiece;

/**
 * Efeitos de Técnicas que o jogo NÃO decide sozinho: o card do ataque oferece um botão e quem comanda (o dono, ou só o Narrador onde o livro
 * pede o julgamento dele) o aciona. Automação híbrida: o servidor confere o acerto, o dono e as regras objetivas (150 PV, 6d10 extra); o resto fica por conta da mesa. O catálogo é POR NOME da Técnica, conferida na ficha do atacante.
 */
final class TecnicasEspeciais
{
    /** @var array<string, list<array{id: string, rotulo: string, critico?: bool, soMestre?: bool}>> */
    public const CATALOGO = [
        'Execução' => [['id' => 'executar', 'rotulo' => 'Executar (150 PV ou menos: morre)']],
        'Headshot' => [
            ['id' => 'cabeca', 'rotulo' => 'Atravessa a cabeça: morre (Narrador)', 'critico' => true, 'soMestre' => true],
            ['id' => 'extra', 'rotulo' => '6d10 Perfurante extra', 'critico' => true],
        ],
        'Covering' => [['id' => 'desvantagem', 'rotulo' => 'Desvantagem no próximo ataque dela']],
    ];

    /** Os botões do card para a Técnica: no acerto crítico entram os que só valem no crítico. @return list<array{id: string, rotulo: string}> */
    public static function botoes(string $nome, bool $critico): array
    {
        $r = [];
        foreach (self::CATALOGO[$nome] ?? [] as $b) {
            if (empty($b['critico']) || $critico) {
                $r[] = ['id' => $b['id'], 'rotulo' => $b['rotulo']];
            }
        }

        return $r;
    }

    /** A Técnica está na ficha (do estilo ou do Criador) do personagem? */
    public static function naFicha(array $ficha, string $nome): bool
    {
        foreach ([...($ficha['tecnicas']['lista'] ?? []), ...($ficha['akuma']['lista'] ?? [])] as $t) {
            if (($t['nome'] ?? null) === $nome) {
                return true;
            }
        }

        return false;
    }
}
