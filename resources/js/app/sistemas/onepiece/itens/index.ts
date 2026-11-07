// Catálogo de itens do One Piece (cap. 8): junta equipamentos, armas, veículos e serviços.
import { ARMAS } from './armas.ts';
import { EQUIPAMENTO, HOSPEDAGEM } from './equipamento.ts';
import type { CategoriaId, ItemDoCatalogo, Raridade } from './tipos.ts';
import { ARREIOS, BARCOS, ESTILOS_DE_VIDA, MONTARIAS, SELAS } from './veiculos.ts';

export { ARMAS_IMPROVISADAS, DANO_DE_ARMA_MARCIAL, PROPRIEDADES_DAS_ARMAS } from './armas.ts';
export * from './tipos.ts';
export { REGRA_DO_ESTILO_DE_VIDA, REGRAS_DE_MONTARIAS } from './veiculos.ts';

export const CATALOGO_DE_ITENS: ItemDoCatalogo[] = [
    ...EQUIPAMENTO,
    ...ARMAS,
    ...BARCOS,
    ...MONTARIAS,
    ...ARREIOS,
    ...SELAS,
    ...HOSPEDAGEM,
    ...ESTILOS_DE_VIDA,
];

export const itemDoCatalogo = (id: string): ItemDoCatalogo | undefined => CATALOGO_DE_ITENS.find((i) => i.id === id);
export const itensDaCategoria = (c: CategoriaId): ItemDoCatalogo[] => CATALOGO_DE_ITENS.filter((i) => i.categoria === c);
export const itensDaRaridade = (r: Raridade): ItemDoCatalogo[] => CATALOGO_DE_ITENS.filter((i) => i.raridade === r);
