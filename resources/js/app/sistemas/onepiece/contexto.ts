import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { AreaDeEfeito } from '../../nucleo/combate/area';
import type { Efeito, Origem, Rolagem } from '../../nucleo/efeitos/efeitos';
import type { AbrirEditorItem } from '../../nucleo/sistemas/tipos';
import type { ArmaParaForja, ItemDto } from '../../tipos-mesa';
import type { AcaoCaracteristica, ArmaAtiva, AtributoId } from './regras';

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
    /** Serviços da mesa (forja do Ferreiro); null quando a mesa não os oferece. */
    servicos: ServicosDaFicha | null;
    /** O personagem desta ficha. */
    personagemId: number;
    /** O mestre abre o editor de itens (`null` = novo); `aoSalvar` recebe o item salvo. */
    abrirEditorItem: AbrirEditorItem;
    /** Rodada do combate (null = sem combate ativo): limita Heat, Electro etc. a um uso por rodada. */
    rodada: ComputedRef<number | null>;
    /** Pede à mesa uma ação de característica (aplicar condição ao alvo mirado, hospedar-se). */
    acao: (acao: AcaoCaracteristica) => void;
    /**
     * Técnica com área (esfera, cone, linha): ANTES de rolar qualquer coisa a área é marcada no mapa a partir do token de quem usa. Devolve os
     * personagens atingidos (do mais perto ao mais longe), ou null se cancelou ou não há ninguém dentro. O mais perto vira o alvo mirado.
     */
    escolherArea: (area: AreaDeEfeito) => Promise<number[] | null>;
    /** Ataque de uma Técnica (1d20 + ataque, com vantagem/desvantagem dos efeitos) no alvo mirado: o card oferece o dano depois do acerto. */
    ataqueDeTecnica: (dados: { nome: string; dano: DanoDaTecnica | null; secundaria?: EfeitoSecundario }) => void;
    /** Técnica de Salvaguarda: a mesa marca a área no mapa e abre a Salvaguarda coletiva no chat. */
    salvaguardaDeTecnica: (uso: UsoDeSalvaguarda) => Promise<void>;
    /** Teste de d20 + variável: Shift = vantagem, Ctrl/Alt = desvantagem. `acao`: a categoria que a rolagem gasta no combate. */
    d20: (evento: MouseEvent, variavel: string, rotulo: string, acao?: { categoria: string; tecnica?: boolean }) => void;
}

/** O dano que a Técnica rola (a expressão já com os dados da Meito e o tipo) e a Salvaguarda do efeito dela. */
export interface DanoDaTecnica {
    expressao: string;
    tipo: string | null;
}
export interface EfeitoSecundario {
    atributo: AtributoId;
    desvantagem?: boolean;
    efeito: string;
}

/** Uma Técnica de Salvaguarda sendo usada: a mesa escolhe os alvos (a área no mapa), cobra o custo (`pagar`) e abre o card no chat. */
export interface UsoDeSalvaguarda {
    nome: string;
    atributo: AtributoId;
    desvantagem: boolean;
    aoPassar: 'metade' | 'nada';
    /** Quem a área atingiu (do mais perto ao mais longe); null = a Técnica não tem área: vale o alvo mirado. */
    alvos: number[] | null;
    dano: DanoDaTecnica | null;
    secundaria?: EfeitoSecundario;
    /** Gasta os PP e a ação; false = não pôde (nada é aberto). Chamado só depois de escolhidos os alvos. */
    pagar: () => Promise<boolean>;
}

/** O que a mesa oferece à ficha além de salvar e rolar (a ficha nunca fala com a API): a forja do Ferreiro. */
export interface ServicosDaFicha {
    /** Todos os personagens da mesa (o ferreiro aprimora a arma de qualquer um). */
    personagens: { id: number; nome: string }[];
    armasParaForja: (personagemId: number) => Promise<ArmaParaForja[]>;
    forjar: (dados: { ferreiro_id: number; item: string; atributo: 'for' | 'des' | 'sab' }) => Promise<{ sucesso: boolean; texto: string }>;
    aprimorar: (dados: { ferreiro_id: number; alvo_id: number; item_id: number; melhorias: Record<string, unknown> }) => Promise<{ texto: string }>;
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
