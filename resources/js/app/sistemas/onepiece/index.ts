import { defineAsyncComponent } from 'vue';
import type { ModuloSistema } from '../../nucleo/sistemas/tipos';
import { ALVOS_DE_EFEITO, formatoDeResumo, variaveisParaAlvo } from './alvos';
import { comItemEntregue, type FichaOnePiece } from './regras';

/** Módulo de D&D 5e: a ficha e o editor de dados do item são carregados só quando usados. */
export const modulo: ModuloSistema = {
    slug: 'one-piece',
    Ficha: defineAsyncComponent(() => import('./ficha/FichaOnePiece.vue')),
    alvosDeEfeito: ALVOS_DE_EFEITO,
    variaveisDeEfeito: variaveisParaAlvo,
    formatoDeResumo,
    entregarItem: (ficha, itemId) => ({ inventario: comItemEntregue(ficha as unknown as FichaOnePiece, itemId) }),
    EditorDadosItem: defineAsyncComponent(() => import('./EditorDadosItem.vue')),
    Construtor: defineAsyncComponent(() => import('./construtor/ConstrutorFicha.vue')),
};
