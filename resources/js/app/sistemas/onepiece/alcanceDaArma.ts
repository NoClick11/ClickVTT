/**
 * O alcance que uma Técnica "Arma, Cone/Linha/Esfera" pode ter: o MÁXIMO da arma equipada (`alcanceMaximo`, campo obrigatório de toda arma:
 * à distância é o alcance máximo; corpo a corpo, o da arma). O normal é até onde o ataque não sofre desvantagem; além do máximo não se ataca.
 * Várias armas equipadas: vale a de maior alcance. Sem arma equipada, ou com arma antiga sem alcance cadastrado (e sem item do catálogo para
 * completar), devolve o problema em vez de um limite: o mestre precisa equipar uma arma ou preencher o alcance no item. Arquivo PURO.
 */
import { itemDoCatalogo } from './itens/index.ts';
import { alcanceDaArmaDoCatalogo } from './itens/regras.ts';
import { armaCabe, ativo, type DadosItemOnePiece, type FichaOnePiece, type ItensPorId } from './regras.ts';

export type AlcanceDaArma = { maximo: number } | { problema: string };

export function alcanceMaximoDaArma(f: FichaOnePiece, itens: ItensPorId): AlcanceDaArma {
    let melhor: number | null = null;
    let semAlcance: string | null = null;
    let equipada = false;
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const dados = item?.dados as (DadosItemOnePiece & { catalogo?: { id: string } }) | null | undefined;
            const arma = dados?.arma;
            if (!item || !arma || !ativo(ref, item) || !armaCabe(arma, f.tamanho)) continue;
            equipada = true;
            // arma antiga, de antes do campo existir: o item do catálogo completa o alcance
            const doCatalogo = dados?.catalogo?.id ? itemDoCatalogo(dados.catalogo.id)?.arma : undefined;
            const maximo =
                typeof arma.alcanceMaximo === 'number' ? arma.alcanceMaximo : doCatalogo ? alcanceDaArmaDoCatalogo(doCatalogo).alcanceMaximo : null;
            if (maximo === null) semAlcance ??= (item as { nome?: string }).nome ?? 'a arma';
            else melhor = Math.max(melhor ?? 0, maximo);
        }
    }
    if (melhor !== null) return { maximo: melhor };
    if (!equipada) return { problema: 'Equipe uma arma: esta Técnica usa o alcance dela.' };

    return { problema: `${semAlcance}: toda arma precisa de alcance. Edite o item e preencha o alcance normal e o máximo.` };
}
