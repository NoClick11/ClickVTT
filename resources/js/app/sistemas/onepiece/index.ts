import { defineAsyncComponent } from 'vue';
import type { ModuloSistema } from '../../nucleo/sistemas/tipos';
import { ALVOS_DE_EFEITO, formatoDeResumo, variaveisParaAlvo } from './alvos';
import { atalhos } from './atalhos';
import { CONDICOES } from './condicoes';
import { CATEGORIAS, RARIDADES } from './itens/tipos';
import { ATRIBUTOS, comItemEntregue, resumoDoToken, type FichaOnePiece, type ItensPorId } from './regras';

/** Módulo de D&D 5e: a ficha e o editor de dados do item são carregados só quando usados. */
export const modulo: ModuloSistema = {
    slug: 'one-piece',
    Ficha: defineAsyncComponent(() => import('./ficha/FichaOnePiece.vue')),
    alvosDeEfeito: ALVOS_DE_EFEITO,
    variaveisDeEfeito: variaveisParaAlvo,
    formatoDeResumo,
    resumoDoToken: (ficha, itens) => resumoDoToken(ficha as unknown as FichaOnePiece, itens as unknown as ItensPorId),
    entregarItem: (ficha, itemId) => ({ inventario: comItemEntregue(ficha as unknown as FichaOnePiece, itemId) }),
    EditorDadosItem: defineAsyncComponent(() => import('./EditorDadosItem.vue')),
    atributos: ATRIBUTOS.map((a) => ({ id: a.id, sigla: a.sigla })),
    condicoes: CONDICOES.map((c) => ({ id: c.id, nome: c.nome, descricao: c.descricao })),
    Construtor: defineAsyncComponent(() => import('./construtor/ConstrutorFicha.vue')),
    dadosDaLoja: { categorias: CATEGORIAS.filter((c) => !['hospedagem', 'estilo-de-vida'].includes(c.id)), raridades: RARIDADES, moeda: '฿' },
    Loja: defineAsyncComponent(() => import('./itens/LojaDoJogador.vue')),
    CatalogoDeItens: defineAsyncComponent(() => import('./itens/CatalogoDeItens.vue')),
    PainelDeFrutas: defineAsyncComponent(() => import('./frutas/PainelDeFrutas.vue')),
    atalhos,
    FichaDeNpc: defineAsyncComponent(() => import('./npcs/FichaDeNpc.vue')),
    NovoNpcDialog: defineAsyncComponent(() => import('./npcs/NovoNpcDialog.vue')),
};
