import { defineAsyncComponent } from 'vue';
import type { ModuloSistema } from '../../nucleo/sistemas/tipos';
import { ALVOS_DE_EFEITO, formatoDeResumo, variaveisParaAlvo } from './alvos';
import { atalhos } from './atalhos';
import { CONDICOES } from './condicoes';
import { CATEGORIAS, RARIDADES } from './itens/tipos';
import { calcularNavio, type NavioFicha } from './navios/regras';
import { ATRIBUTOS, comItemEntregue, resumoDoToken, type FichaOnePiece, type ItensPorId } from './regras';

/** Módulo de D&D 5e: a ficha e o editor de dados do item são carregados só quando usados. */
export const modulo: ModuloSistema = {
    slug: 'one-piece',
    Ficha: defineAsyncComponent(() => import('./ficha/FichaOnePiece.vue')),
    alvosDeEfeito: ALVOS_DE_EFEITO,
    variaveisDeEfeito: variaveisParaAlvo,
    formatoDeResumo,
    resumoDoToken: (ficha, itens) => {
        // Navio: PV (com os PV paralelos) e a Classe de Resistência no lugar da CA
        if (ficha.navio) {
            const f = ficha as unknown as { navio: NavioFicha; pv: { atual: number; temp?: number } };
            const c = calcularNavio(f.navio, f.pv?.atual ?? 0);

            return [
                { id: 'pv', rotulo: 'PV', atual: (f.pv?.atual ?? 0) + (f.pv?.temp ?? 0), max: c.pvMax },
                { id: 'ca', rotulo: 'CR', valor: c.cr },
            ];
        }

        return resumoDoToken(ficha as unknown as FichaOnePiece, itens as unknown as ItensPorId);
    },
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
    FichaDeNavio: defineAsyncComponent(() => import('./navios/FichaDeNavio.vue')),
    NovoNavioDialog: defineAsyncComponent(() => import('./navios/NovoNavioDialog.vue')),
};
