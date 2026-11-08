import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { AreaDeEfeito } from '../../nucleo/combate/area';
import type { Efeito, Origem, Rolagem } from '../../nucleo/efeitos/efeitos';
import type { AbrirEditorItem } from '../../nucleo/sistemas/tipos';
import type { ArmaParaForja, ItemDto, MunicaoParaForja } from '../../tipos-mesa';
import type { AcaoCaracteristica, ArmaAtiva, AtributoId, DuracaoDaTecnica, EfeitoDeCondicao } from './regras';

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
        dano?: { tipo: string | null; fator?: number; fonte?: string },
        acao?: { categoria: string; tecnica?: boolean },
    ) => void;
    /** Economia de ações do combate: se a categoria pode ser usada agora, gastá-la no servidor e o nome dela. */
    acoes: {
        pode: (categoria: string | undefined, tecnica?: boolean) => { ok: boolean; motivo?: string };
        gastar: (categoria: string | undefined, tecnica?: boolean) => Promise<boolean>;
        rotulo: (categoria: string | undefined) => string;
        /** Pode atacar com arma agora? Os ataques feitos no turno, o limite (por Ação + extras) e o motivo se não puder. */
        ataque: (ataquesPorAcao: number) => { ok: boolean; motivo?: string; feitos: number; max: number; extras: number };
        /** Ataques extras do turno (Tempestade de Balas, Alvo Travado...): soma `n` ao limite; null = fora do combate. */
        darExtras: ((n: number) => Promise<void>) | null;
        /** As Técnicas ativas deste personagem (com as rodadas que faltam) e como encerrar uma. */
        ativas: () => { id: string; nome: string; rodadas: number; concentracao: boolean; tipo?: 'vigia' }[];
        encerrarAtiva: ((id: string) => Promise<void>) | null;
        /** Ação bônus: marca no mapa o novo centro da esfera da Vigília (até 6 m). */
        moverVigia: ((id: string) => void) | null;
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
     * Usa uma Técnica: a MESA faz tudo (marca a área no mapa, gasta a ação e os PP, rola o ataque ou abre a Salvaguarda). Assim o fluxo
     * não depende de a janela da ficha continuar aberta enquanto o jogador mira no mapa.
     */
    usarTecnica: (uso: UsoDeTecnica) => void;
    /** Teste de d20 + variável: Shift = vantagem, Ctrl/Alt = desvantagem. `acao`: a categoria que a rolagem gasta no combate. */
    d20: (evento: MouseEvent, variavel: string, rotulo: string, acao?: { categoria: string; tecnica?: boolean }, municaoItemId?: number) => void;
}

/** O dano que a Técnica rola (a expressão já com os dados da Meito e o tipo) e a Salvaguarda do efeito dela. */
export interface DanoDaTecnica {
    expressao: string;
    tipo: string | null;
    /** Danos extras de outro tipo (Fogo do Diable Jambe...): rolam à parte e se aplicam com o próprio tipo. */
    extras?: { expressao: string; tipo: string | null }[];
}
export interface EfeitoSecundario {
    atributo: AtributoId;
    desvantagem?: boolean;
    efeito: string;
    /** A condição que quem falha recebe sozinha. */
    aplica?: EfeitoDeCondicao;
}

/** Uma Técnica sendo usada, com tudo que a mesa precisa para executá-la sem voltar à ficha. */
export interface UsoDeTecnica {
    nome: string;
    /** O nome da Técnica na ficha (`nome` pode trazer o sufixo da Saijo/Kokuto): o servidor identifica efeitos pelo nome da ficha. */
    nomeBase?: string;
    /** Como acerta: ataque, Salvaguarda da área, automática; ausente = só rola o dano. */
    teste?: { tipo: 'ataque' | 'salvaguarda' | 'automatico'; atributo?: AtributoId; aoPassar?: 'metade' | 'nada'; aplica?: EfeitoDeCondicao };
    /** Desvantagem na Salvaguarda de quem está na área (a do livro ou a da Kokuto). */
    desvantagem: boolean;
    /** A forma e o tamanho da área no mapa (null = sem forma: vale o alvo mirado). */
    area: AreaDeEfeito | null;
    /** Técnica que dura vários turnos: com o combate em curso, fica ativa e pede um ataque a cada turno de quem está ao alcance. */
    duracao?: DuracaoDaTecnica;
    dano: DanoDaTecnica | null;
    secundaria?: EfeitoSecundario;
    /** Vantagem/desvantagem dos efeitos na jogada de ataque. */
    modoAtaque: 'vantagem' | 'desvantagem' | null;
    /** NPC: o ataque da Técnica usa este bônus (o da ficha dele) em vez de `@ataque`; `margemCritica` é a dele (ex.: 18). */
    ataqueFixo?: { bonus: number; margemCritica?: number };
    /** A categoria de ação que a Técnica gasta no combate e os campos dos PP gastos (`pp.atual` já descontado). */
    categoria: string | undefined;
    camposDosPP: Record<string, unknown>;
    /** Técnica de arma de fogo: o servidor gasta a munição do Requisito (lê o custo da Técnica salva, pelo nome). */
    municao?: { tecnica: string };
    /** Vigília (Overwatch): marcar a esfera no mapa (raio e alcance máximo da arma, em metros) e a Ação bônus de mover; `bloqueio` = por que não dá. */
    vigia?: { raio: number; mover: number; maximo: number; bloqueio?: string };
}

/** O que a mesa oferece à ficha além de salvar e rolar (a ficha nunca fala com a API): a forja do Ferreiro. */
export interface ServicosDaFicha {
    /** Todos os personagens da mesa (o ferreiro aprimora a arma de qualquer um). */
    personagens: { id: number; nome: string }[];
    armasParaForja: (personagemId: number) => Promise<{ armas: ArmaParaForja[]; municoes: MunicaoParaForja[] }>;
    /** Aprimorar/Consertar Equipamento: um aprimoramento por item, com Teste; quebra no 1 natural. */
    melhorar: (dados: {
        ferreiro_id: number;
        alvo_id: number;
        atributo: 'for' | 'des' | 'sab';
        tipo: 'kairoseki-arma' | 'kairoseki-municao' | 'municoes' | 'alcance';
        item_id?: number | null;
        tipo_dano?: 'Contundente' | 'Perfurante';
    }) => Promise<{ resultado: 'sucesso' | 'falhou' | 'quebrou'; texto: string }>;
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
