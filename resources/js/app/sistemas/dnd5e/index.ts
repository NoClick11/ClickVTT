import { defineAsyncComponent } from 'vue';
import type { ModuloSistema } from '../../nucleo/sistemas/tipos';
import { ALVOS_DE_EFEITO, formatoDeResumo, variaveisParaAlvo } from './alvos';
import { comItemEntregue, resumoDoToken, type FichaDnd5e, type ItensPorId } from './regras';

/** Módulo de D&D 5e: a ficha e o editor de dados do item são carregados só quando usados. */
export const modulo: ModuloSistema = {
    slug: 'dnd-5e',
    Ficha: defineAsyncComponent(() => import('./ficha/FichaDnd5e.vue')),
    alvosDeEfeito: ALVOS_DE_EFEITO,
    variaveisDeEfeito: variaveisParaAlvo,
    formatoDeResumo,
    resumoDoToken: (ficha, itens) => resumoDoToken(ficha as unknown as FichaDnd5e, itens as unknown as ItensPorId),
    entregarItem: (ficha, itemId) => ({ inventario: comItemEntregue(ficha as unknown as FichaDnd5e, itemId) }),
    EditorDadosItem: defineAsyncComponent(() => import('./EditorDadosItem.vue')),
};
