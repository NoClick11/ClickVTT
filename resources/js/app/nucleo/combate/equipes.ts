/**
 * Sem fogo amigo (o mestre pode ligar na mesa). Dois tipos de personagem: JOGADOR (tem jogador atribuído) e NPC. Com o fogo amigo desligado:
 * o jogador só acerta NPC, e nunca um NPC marcado como ALIADO; o NPC só acerta jogador (NPC contra NPC nunca). Ligado, tudo vale. Quem age
 * sobre si mesmo não conta como "outro". Espelha `app/Nucleo/Combate/Equipes.php` (o servidor é quem recusa de verdade; a tela usa isto para
 * não oferecer quem não pode ser atingido). Arquivo PURO.
 */
export interface LadoDoPersonagem {
    id: number;
    /** Tem algum jogador atribuído (PC); senão é NPC. */
    jogador: boolean;
    /** NPC marcado pelo mestre como aliado dos jogadores. */
    aliado: boolean;
}

/** `de` pode atingir `para` com dano ou efeito hostil? */
export function podeAtingir(fogoAmigo: boolean, de: LadoDoPersonagem, para: LadoDoPersonagem): boolean {
    if (de.id === para.id || fogoAmigo) return true;
    if (de.jogador) return !para.jogador && !para.aliado;

    return para.jogador;
}
