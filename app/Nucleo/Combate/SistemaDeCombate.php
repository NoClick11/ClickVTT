<?php

namespace App\Nucleo\Combate;

/**
 * Contrato de combate que um sistema (D&D, One Piece...) cumpre para participar do sistema de turnos do núcleo. O núcleo
 * não conhece regras: pergunta ao sistema como rolar a iniciativa, quantas ações de cada categoria existem por turno,
 * quanto o personagem anda e qual é o valor que um ataque precisa bater. Sistema que não implementa a interface ainda
 * tem turnos (iniciativa 1d20, sem economia de ações nem movimento medido).
 */
interface SistemaDeCombate
{
    /**
     * Categorias de ação do sistema (ex.: padrão, poderosa, bônus, livre, reação). `porTurno` = limite por turno de
     * quem age (null = sem limite no turno), `porRodada` = limite por rodada (reação), `soNoTurno` = só pode ser usada
     * por quem está no turno (false = qualquer um, ex.: reação).
     *
     * @return list<array{id: string, nome: string, porTurno: ?int, porRodada: ?int, soNoTurno: bool, soTecnicas?: bool}>
     */
    public function categoriasDeAcao(): array;

    /** Expressão de dados da iniciativa; pode usar `@variáveis` da ficha (ex.: `1d20+@iniciativa`). */
    public function iniciativa(array $ficha): string;

    /**
     * Deslocamento do turno, em metros.
     *
     * @param  array<string, int|float>  $variaveis  valores calculados da ficha (`variaveisDeRolagem`)
     */
    public function deslocamentoDoTurno(array $ficha, array $variaveis): float;

    /**
     * As reações que o personagem pode usar AGORA diante de um gatilho (`ataque_declarado`...), já sem as que ele não pode
     * pagar (PP, usos). Cada oferta: `{id, rotulo, descricao, categoria, alcance: si|aliado|ambos, efeitos, cura, custo}`;
     * `efeitos` usa o motor de efeitos (`{alvo: 'defesa', modo: 'soma', valor: 2}`), `cura` é um valor ou dados (`1d8`).
     * O núcleo filtra por turno, categoria, aliança e alcance; o sistema só lê a ficha.
     *
     * @param  array<string, mixed>  $contexto
     * @param  array<string, int|float>  $variaveis
     * @return list<array<string, mixed>>
     */
    public function ofertasDeReacao(string $gatilho, array $contexto, array $ficha, array $variaveis): array;

    /**
     * Os campos da ficha a salvar quando a oferta é escolhida (gasta PP, um uso...), no formato de `FichaCampos`.
     *
     * @param  array<string, mixed>  $oferta
     * @return array<string, mixed>
     */
    public function pagarReacao(array $ficha, array $oferta): array;

    /** Categoria de ação que a Disparada gasta (soma o deslocamento do turno); null = o sistema não tem Disparada. */
    public function categoriaDaDisparada(): ?string;

    /**
     * O valor que uma jogada de ataque precisa igualar ou superar para acertar este personagem (a CA).
     *
     * @param  array<string, int|float>  $variaveis
     */
    public function defesa(array $variaveis): int;
}
