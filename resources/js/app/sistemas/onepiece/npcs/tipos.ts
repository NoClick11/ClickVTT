/**
 * Ficha de NPC (One Piece): uma tela só, feita para o mestre controlar rápido. Os dados do catálogo são só leitura;
 * ao adicionar um NPC à mesa a ficha é COPIADA e passa a ser editável sem tocar no catálogo.
 */
export type AtributoNpc = 'for' | 'des' | 'con' | 'sab' | 'pre' | 'von';
export const ATRIBUTOS_NPC: AtributoNpc[] = ['for', 'des', 'con', 'sab', 'pre', 'von'];
export const ROTULO_ATRIBUTO_NPC: Record<AtributoNpc, string> = { for: 'FOR', des: 'DES', con: 'CON', sab: 'SAB', pre: 'PRE', von: 'VON' };

/** Quantas vezes pode usar: `N/dia` (contador que o mestre zera no descanso) ou recarga por dado (`5-6`). */
export type UsosNpc = { max: number; periodo: 'dia' } | { recarga: string };

/** Ataque com arma ou desarmado. `alcance` em metros: corpo a corpo = alcance; à distância = `[normal, máximo]`. */
export interface AtaqueNpc {
    nome: string;
    tipo: 'corpo' | 'distancia';
    /** ataque com arma (false = desarmado) */
    arma: boolean;
    bonus: number;
    alcance: number | [number, number];
    /** expressão de dano já com o modificador, ex.: `1d6+2` */
    dano: string;
    tipoDano: string;
}

/** Característica, aspecto, reação, ação bônus ou ação lendária: texto, com PP e usos quando for técnica auxiliar. */
export interface TextoNpc {
    nome: string;
    texto: string;
    pp?: number;
    usos?: UsosNpc;
}

/** Técnica de Combate (ação poderosa): ataque, área ou alvo único com salvaguarda, com efeito em texto. */
export interface TecnicaNpc {
    nome: string;
    grau: number;
    pp: number;
    usos?: UsosNpc;
    /** `ataque` = jogada de ataque; `area` = cone/linha com salvaguarda; `alvo` = alvo único com salvaguarda. */
    modo: 'ataque' | 'area' | 'alvo';
    /** ataque: corpo a corpo ou à distância e o bônus para atingir */
    ataque?: { tipo: 'corpo' | 'distancia'; bonus: number };
    /** metros; área/alvo em linha ou cone: comprimento */
    alcance: number;
    area?: { forma: 'cone' | 'linha'; largura?: number };
    dano?: string;
    /** tipos possíveis (o mestre escolhe um quando há mais de um) */
    tipoDano: string[];
    salvaguarda?: { atributo: AtributoNpc; cd: number; metade: boolean };
    /** margem de crítico quando diferente de 20 (ex.: 18) */
    critico?: number;
    efeito?: string;
}

export interface NpcModelo {
    id: string;
    nome: string;
    faccao: 'Pirata' | 'Marinha' | 'Outro';
    /** nível de desafio como está na ficha (`1/8`, `13`) */
    nd: string;
    xp: number;
    /** Pontos de Poder (null = não usa) */
    pp: number | null;
    cr: number;
    pv: { medio: number; dados: string };
    bp: number;
    cd: number;
    deslocamento: number;
    nado: number;
    atributos: Record<AtributoNpc, number>;
    pericias: string;
    salvaguardas: string;
    sentidos: string;
    aspectos: TextoNpc[];
    ataques: AtaqueNpc[];
    /** ataques por turno e com o quê (ex.: 3 — "sabre, pistola ou ataque desarmado") */
    multiplos?: { n: number; com: string };
    acoesBonus: TextoNpc[];
    reacoes: TextoNpc[];
    tecnicas: TecnicaNpc[];
    lendarias?: { n: number; texto: string; opcoes: TextoNpc[] };
}

export const modificador = (valor: number): number => Math.floor((valor - 10) / 2);
export const comSinal = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
