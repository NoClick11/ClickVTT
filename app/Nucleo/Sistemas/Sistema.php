<?php

namespace App\Nucleo\Sistemas;

/**
 * Contrato de um sistema de RPG (D&D 5e, One Piece...). Cada sistema é um módulo em `app/Sistemas/<Nome>`
 * que implementa esta interface e é registrado em `RegistroSistemas`. O núcleo (`app/Nucleo`) nunca cita um
 * sistema específico: só conversa com este contrato.
 *
 * O contrato cresce junto com as capacidades do núcleo (ficha persistida, variáveis de rolagem...), sempre
 * com métodos que o núcleo realmente chama.
 */
interface Sistema
{
    /** Identificador estável; igual ao `slug` da tabela `sistemas` (ex.: `dnd-5e`). */
    public static function slug(): string;

    /** Ficha de um personagem recém-criado (estrutura completa, com os valores iniciais). */
    public function fichaPadrao(): array;

    /**
     * Regras de validação do Laravel, por caminho com pontos (`pv.atual`, `inventario.*.nome`), de TODA a ficha.
     * - Uma chave SEM `*` é um campo editável: só estes caminhos podem ser enviados em `campos`.
     * - Chaves com `*` validam o conteúdo de listas quando a lista inteira é enviada (ex.: `inventario`).
     * Listas são sempre substituídas por inteiro; objetos são editados campo a campo.
     * Use as variantes estritas (`integer:strict`, `boolean:strict`) para o JSON não guardar "14" no lugar de 14.
     *
     * @return array<string, mixed>
     */
    public function regrasFicha(): array;

    /**
     * Variáveis que as expressões de rolagem do personagem podem usar (`@mod.for`, `@pericia.percepcao`...),
     * calculadas SEMPRE no servidor a partir da ficha salva: o cliente nunca informa valores.
     *
     * @param  array<int, array>  $itens  itens da mesa referenciados pela ficha, por id (`Item::paraFront()`)
     * @return array<string, int|float>
     */
    public function variaveisDeRolagem(array $ficha, array $itens = []): array;

    /**
     * Informações que só o sistema sabe sobre uma rolagem já feita, guardadas na mensagem (`dados.sistema`): que foi
     * um ataque crítico (`destaque`, `margem`) e as AÇÕES que o card do chat oferece em seguida (`acoes`: ex.: rolar o
     * dano da arma). O núcleo só repassa; cada ação é `{id, rotulo, resumo, expressao, rotuloRolagem, destaque?}` e,
     * ao clicar, `expressao` é rolada como qualquer outra (com as variáveis do personagem, resolvidas no servidor).
     *
     * @param  list<array>  $termos  termos da rolagem (`Rolador::rolar()['termos']`)
     * @param  array<string, int|float>  $variaveis  as mesmas variáveis usadas na rolagem
     * @param  array<int, array>  $itens  itens da mesa referenciados pela ficha, por id (`Item::paraFront()`)
     * @param  array<string, mixed>  $ficha  a ficha do personagem que rolou (ex.: para os buffs que acrescentam dados ao dano)
     * @param  array<string, mixed>  $contexto  o que o sistema pediu junto da rolagem (ex.: a munição escolhida no ataque)
     * @return array<string, mixed> vazio quando não há nada a marcar
     */
    public function metadadosDaRolagem(array $termos, array $variaveis, array $itens = [], array $ficha = [], array $contexto = []): array;

    /**
     * Ids dos itens da mesa que a ficha referencia no inventário (sem repetição).
     *
     * @return list<int>
     */
    public function itensReferenciados(array $ficha): array;

    /** A ficha sem as referências ao item `$itemId` (quando o mestre exclui o item da mesa). */
    public function semItem(array $ficha, int $itemId): array;

    /**
     * Regras de validação do Laravel para `Item::dados` (o que só este sistema entende: armadura, arma...), por
     * caminho com pontos e SEM regra no pai: `dados.armadura.tipo`. Só os caminhos com regra são guardados.
     *
     * @return array<string, mixed>
     */
    public function regrasItem(): array;

    /**
     * Alvos que um efeito pode ter neste sistema (`ca`, `atributos.for`, `pericia.*`...), as chaves que o cálculo
     * da ficha entende. Serve para validar e para o formulário do mestre.
     *
     * @return list<string>
     */
    public function alvosDeEfeito(): array;
}
