import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { Efeito, Origem, Rolagem } from '../../nucleo/efeitos/efeitos';
import type { AbrirEditorItem } from '../../nucleo/sistemas/tipos';
import type { ItemDto } from '../../tipos-mesa';
import type { AcaoCaracteristica, ArmaAtiva } from './regras';

/**
 * Contexto da ficha de D&D 5e, compartilhado pelos blocos sem passar props: modo Jogar/Editar, valores
 * derivados (`calc`), salvar campos e rolar. Quem fornece é `FichaOnePiece.vue`.
 */
export interface ContextoFicha {
    /** true = modo Editar (campos de construção liberados); false = modo Jogar (só o que muda em jogo). */
    editar: Ref<boolean>;
    /** Valores derivados (`calcular`), ex.: `calc.value['pericia.percepcao']`. */
    calc: ComputedRef<Record<string, number>>;
    /** Salva campos (1 = edição pontual; vários = lote). */
    salvar: (campos: Record<string, unknown>) => void;
    /** Rola uma expressão (pode usar `@variaveis`) com o nome da rolagem. */
    rolar: (
        expressao: string,
        rotulo: string,
        aoRolar?: (total: number) => void,
        dano?: { tipo: string | null; fator?: number },
        acao?: { categoria: string; tecnica?: boolean },
    ) => void;
    /** Economia de ações do combate: se a categoria pode ser usada agora, gastá-la no servidor e o nome dela. */
    acoes: {
        pode: (categoria: string | undefined, tecnica?: boolean) => { ok: boolean; motivo?: string };
        gastar: (categoria: string | undefined, tecnica?: boolean) => Promise<boolean>;
        rotulo: (categoria: string | undefined) => string;
        /** Todas as categorias do sistema (id e nome), para os seletores de edição. */
        todas: () => { id: string; nome: string }[];
    };
    /** De onde vem cada bônus, por alvo (`origens.value.ca` = [{fonte: 'Placas', modo: 'base', valor: 16}, ...]). */
    origens: ComputedRef<Record<string, Origem[]>>;
    /** Efeitos ativos agora (itens, condições e ajustes manuais), cada um com a fonte. */
    efeitos: ComputedRef<Efeito[]>;
    /** Vantagem/desvantagem que os efeitos ativos dão à rolagem desta variável (`pericia.furtividade`...). */
    modoDe: (variavel: string) => Rolagem;
    /** Armas ativas (equipadas e sintonizadas se exigir), com ataque e dano calculados. */
    armas: ComputedRef<ArmaAtiva[]>;
    /** Itens da mesa que este jogador pode ver, por id. Um `item_id` fora daqui foi excluído da mesa. */
    itens: ComputedRef<Record<number, ItemDto>>;
    /** Quem vê os controles de criar e entregar itens. */
    mestre: boolean;
    /** O mestre abre o editor de itens (`null` = novo); `aoSalvar` recebe o item salvo. */
    abrirEditorItem: AbrirEditorItem;
    /** Rodada do combate (null = sem combate ativo): limita Heat, Electro etc. a um uso por rodada. */
    rodada: ComputedRef<number | null>;
    /** Pede à mesa uma ação de característica (aplicar condição ao alvo mirado, hospedar-se). */
    acao: (acao: AcaoCaracteristica) => void;
    /** Teste de d20 + variável: Shift = vantagem, Ctrl/Alt = desvantagem. `acao`: a categoria que a rolagem gasta no combate. */
    d20: (evento: MouseEvent, variavel: string, rotulo: string, acao?: { categoria: string; tecnica?: boolean }) => void;
}

export const CHAVE_FICHA: InjectionKey<ContextoFicha> = Symbol('ficha-onepiece');

export function useFicha(): ContextoFicha {
    const contexto = inject(CHAVE_FICHA);
    if (!contexto) throw new Error('useFicha() fora de FichaOnePiece.');

    return contexto;
}

/** Classes dos campos (compartilhadas): bordas só aparecem em foco; somente leitura não parece editável. */
export const estilos = {
    campo: 'w-full border-b border-transparent bg-transparent px-0.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default',
    num: 'w-10 rounded border border-transparent bg-transparent text-center tabular-nums focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default',
    ajuste: 'w-9 rounded border border-preto-700 bg-preto-950 text-center text-xs tabular-nums text-ouro-200 focus-visible:border-ouro-400 focus-visible:outline-none',
    rotulo: 'text-[10px] font-semibold uppercase tracking-wider text-preto-500',
    cartao: 'rounded-lg border border-preto-800 bg-preto-900/60',
    titulo: 'border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400',
};
