/**
 * Sem fogo amigo: dano e efeitos hostis não atingem quem é do mesmo lado. Dois lados: jogadores e inimigos. Em combate em curso vale a
 * disposição de cada participante (`jogadores` e `aliado` de um lado, `inimigo` do outro); fora dele, personagem com jogador é do lado dos
 * jogadores e NPC (sem jogador) é do lado dos inimigos. Espelha `app/Nucleo/Combate/Equipes.php` (o servidor é quem recusa de verdade; a tela
 * usa isto para não oferecer aliados como alvo). Arquivo PURO.
 */
import { emCurso, type Combate } from './estado.ts';

export type Equipe = 'jogadores' | 'inimigos';

/** O lado do personagem agora. `temJogador`: o personagem tem algum jogador atribuído (PC) ou é NPC. */
export function equipeDe(c: Combate, personagemId: number, temJogador: boolean): Equipe {
    if (emCurso(c)) {
        const item = c.itens.find((i) => i.personagem_id === personagemId);
        if (item) return item.disposicao === 'inimigo' ? 'inimigos' : 'jogadores';
    }

    return temJogador ? 'jogadores' : 'inimigos';
}

/** Os dois são pessoas diferentes do mesmo lado? */
export const mesmoLado = (c: Combate, a: number, b: number, temJogador: (id: number) => boolean): boolean =>
    a !== b && equipeDe(c, a, temJogador(a)) === equipeDe(c, b, temJogador(b));
