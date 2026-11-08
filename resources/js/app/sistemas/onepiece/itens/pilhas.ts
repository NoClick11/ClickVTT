import { itemDoCatalogo } from '.';
import type { ItemDto } from '../../../tipos-mesa';
import { municoesDaArma } from './municoes';

/** Uma pilha de munição do inventário que serve a uma arma. */
export interface PilhaDeMunicao {
    itemId: number;
    nome: string;
    qtd: number;
    dano: string | null;
    tipoDano: string | null;
}

/**
 * As munições do inventário que servem à arma (pelo nome, Cap. 8): as do catálogo que ela aceita e as criadas à mão (servem a qualquer
 * arma por munição). Usada pela ficha e pela barra de atalhos.
 */
export function pilhasDeMunicao(
    inventario: { itens?: { item_id: number; qtd: number }[] }[] | undefined,
    itens: Record<number, ItemDto>,
    armaCatalogoId: string | null,
): PilhaDeMunicao[] {
    const aceitas = municoesDaArma(armaCatalogoId);
    const pilhas: PilhaDeMunicao[] = [];
    for (const secao of inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            if (!item || ref.qtd <= 0) continue;
            const dados = item.dados as { catalogo?: { id?: string }; municao?: { dano: string; tipoDano?: string | null } } | null | undefined;
            if (dados?.municao) {
                pilhas.push({
                    itemId: ref.item_id,
                    nome: item.nome,
                    qtd: ref.qtd,
                    dano: dados.municao.dano,
                    tipoDano: dados.municao.tipoDano ?? null,
                });
                continue;
            }
            const idDoCatalogo = dados?.catalogo?.id;
            if (!idDoCatalogo || !aceitas.includes(idDoCatalogo)) continue;
            const entrada = itemDoCatalogo(idDoCatalogo);
            pilhas.push({
                itemId: ref.item_id,
                nome: entrada?.nome ?? 'Munição',
                qtd: ref.qtd,
                dano: entrada?.arma?.dano ?? null,
                tipoDano: entrada?.arma?.tipoDano ?? null,
            });
        }
    }

    return pilhas;
}
