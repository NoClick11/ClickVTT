/**
 * O alcance que uma Técnica "Arma, Cone/Linha/Esfera" pode ter: o da arma equipada. Arma à distância: o alcance MÁXIMO do catálogo (o normal
 * é até onde o ataque não sofre desvantagem; além do máximo não se ataca). Arma corpo a corpo: o alcance corpo a corpo da ficha (1,5 m por
 * padrão). Várias armas equipadas: vale a de maior alcance. null = não dá para saber (arma à distância sem item do catálogo e nenhuma outra arma): sem limite.
 * Arquivo PURO.
 */
import { itemDoCatalogo } from './itens/index.ts';
import { armaCabe, ativo, type DadosItemOnePiece, type FichaOnePiece, type ItensPorId } from './regras.ts';

/** O alcance corpo a corpo em metros (`alcance.corpo` vem em decímetros nos valores calculados). */
const CORPO_A_CORPO = 1.5;

export function alcanceMaximoDaArma(f: FichaOnePiece, itens: ItensPorId, alcanceCorpoDm?: number): number | null {
    const corpo = (alcanceCorpoDm ?? CORPO_A_CORPO * 10) / 10;
    let melhor: number | null = null;
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const dados = item?.dados as (DadosItemOnePiece & { catalogo?: { id: string } }) | null | undefined;
            const arma = dados?.arma;
            if (!item || !arma || !ativo(ref, item) || !armaCabe(arma, f.tamanho)) continue;
            if (!arma.distancia) {
                melhor = Math.max(melhor ?? 0, corpo);
                continue;
            }
            const alcance = dados?.catalogo?.id ? itemDoCatalogo(dados.catalogo.id)?.arma?.distancia : undefined;
            if (alcance) melhor = Math.max(melhor ?? 0, alcance[1]);
        }
    }

    return melhor;
}
