/** Constantes e tipos da ficha de D&D 5e (layout). Rótulos em pt-BR. */

export type AtributoId = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car';

export const ATRIBUTOS: { id: AtributoId; sigla: string; nome: string }[] = [
    { id: 'for', sigla: 'FOR', nome: 'Força' },
    { id: 'des', sigla: 'DES', nome: 'Destreza' },
    { id: 'con', sigla: 'CON', nome: 'Constituição' },
    { id: 'int', sigla: 'INT', nome: 'Inteligência' },
    { id: 'sab', sigla: 'SAB', nome: 'Sabedoria' },
    { id: 'car', sigla: 'CAR', nome: 'Carisma' },
];

export const PERICIAS: { id: string; nome: string; atributo: AtributoId }[] = [
    { id: 'acrobacia', nome: 'Acrobacia', atributo: 'des' },
    { id: 'adestrar', nome: 'Adestrar Animais', atributo: 'sab' },
    { id: 'arcanismo', nome: 'Arcanismo', atributo: 'int' },
    { id: 'atletismo', nome: 'Atletismo', atributo: 'for' },
    { id: 'atuacao', nome: 'Atuação', atributo: 'car' },
    { id: 'enganacao', nome: 'Enganação', atributo: 'car' },
    { id: 'furtividade', nome: 'Furtividade', atributo: 'des' },
    { id: 'historia', nome: 'História', atributo: 'int' },
    { id: 'intimidacao', nome: 'Intimidação', atributo: 'car' },
    { id: 'intuicao', nome: 'Intuição', atributo: 'sab' },
    { id: 'investigacao', nome: 'Investigação', atributo: 'int' },
    { id: 'medicina', nome: 'Medicina', atributo: 'sab' },
    { id: 'natureza', nome: 'Natureza', atributo: 'int' },
    { id: 'percepcao', nome: 'Percepção', atributo: 'sab' },
    { id: 'persuasao', nome: 'Persuasão', atributo: 'car' },
    { id: 'prestidigitacao', nome: 'Prestidigitação', atributo: 'des' },
    { id: 'religiao', nome: 'Religião', atributo: 'int' },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'sab' },
];

/** 0 = sem proficiência, 1 = proficiente, 2 = especialista. */
export type Proficiencia = 0 | 1 | 2;

export const MOEDAS = [
    { id: 'pl', sigla: 'PL', nome: 'Platina', cor: '#cbd5e1' },
    { id: 'po', sigla: 'PO', nome: 'Ouro', cor: '#ecc96c' },
    { id: 'pe', sigla: 'PE', nome: 'Electro', cor: '#a3e635' },
    { id: 'pp', sigla: 'PP', nome: 'Prata', cor: '#94a3b8' },
    { id: 'pc', sigla: 'PC', nome: 'Cobre', cor: '#c2763a' },
] as const;

export interface ItemInventario {
    nome: string;
    qtd: number;
    peso: number;
    equipado?: boolean;
    detalhe?: string;
}
export interface Caracteristica {
    nome: string;
    origem: string;
    tipo: 'ativa' | 'passiva';
    usos?: { atual: number; max: number };
}
export interface FichaDnd5e {
    nome: string;
    classe: string;
    subclasse: string;
    nivel: number;
    especie: string;
    antecedente: string;
    alinhamento: string;
    xp: { atual: number; proximo: number };
    inspiracao: boolean;
    atributos: Record<AtributoId, number>;
    salvaguardas: AtributoId[];
    pericias: Record<string, Proficiencia>;
    bonusProficiencia: number;
    ca: number;
    iniciativa: number;
    deslocamento: string;
    pv: { atual: number; max: number; temp: number };
    dadosVida: { restantes: number; max: number; tipo: string };
    morte: { sucessos: number; falhas: number };
    exaustao: number;
    sentidos: string[];
    idiomas: string[];
    resistencias: string[];
    imunidades: string[];
    vulnerabilidades: string[];
    proficienciasArmas: string[];
    proficienciasArmaduras: string[];
    ferramentas: { nome: string; prof: Proficiencia; atributo: AtributoId }[];
    carga: { atual: number; max: number };
    moedas: Record<(typeof MOEDAS)[number]['id'], number>;
    inventario: { secao: string; itens: ItemInventario[] }[];
    caracteristicas: Caracteristica[];
    magias: {
        atributo: AtributoId;
        cd: number;
        ataque: number;
        preparadas: { atual: number; max: number };
        espacos: { nivel: number; usados: number; total: number }[];
        lista: { nivel: number; magias: { nome: string; escola: string; preparada: boolean }[] }[];
    };
    biografia: { personalidade: string; ideais: string; vinculos: string; defeitos: string; aparencia: string; texto: string };
}

export const modificador = (valor: number): number => Math.floor((valor - 10) / 2);
export const comSinal = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

import type { InjectionKey, Ref } from 'vue';
/** Modo de edição da ficha (Jogar x Editar), compartilhado pelos blocos sem passar props. */
export const CHAVE_EDITAR: InjectionKey<Ref<boolean>> = Symbol('ficha-editar');
