/**
 * Formato dos dados do assistente de criação (espécies, variantes, variações raras). Arquivo PURO: o Node o executa
 * direto nos testes. Cada espécie nova é só um item novo em `especies.ts`, sem mudar a lógica.
 */
import type { EfeitoBruto } from '../../../../nucleo/efeitos/efeitos.ts';
import type { AtributoId } from '../../regras.ts';

export type Preconceito = 'Inexistente' | 'Débil' | 'Medíocre' | 'Severo';
export const NIVEIS_PRECONCEITO: Preconceito[] = ['Inexistente', 'Débil', 'Medíocre', 'Severo'];

export interface Movimento {
    normal: number;
    nado: number;
    escalada: number;
    voo: number;
}

/** O jogador escolhe perícias ao receber o traço (Adaptação, Herança Cultural, Aptidão Natural). */
export interface EscolhaPericias {
    quantidade: number;
    /** 1 = proficiente, 2 = especialista (proficiência dobrada). */
    nivel: 1 | 2;
    /** Perícias que não podem ser escolhidas. */
    excluir: string[];
    /** O jogador pode trocar UMA das perícias por este traço (ex.: Singularidade no lugar de perícia). */
    troca?: { rotulo: string; traco: TracoDados };
}

/** Benefício, dificuldade ou traço da espécie/variante: vira uma característica na ficha. */
export interface TracoDados {
    id: string;
    nome: string;
    descricao: string;
    /** `ativa` tem interruptor (buffs que o jogador liga); o padrão é passiva. */
    tipo?: 'ativa' | 'passiva';
    usos?: { max?: number; porNivel?: boolean; descanso?: 'curto' | 'longo' };
    efeitos?: EfeitoBruto[];
    resistencias?: string[];
    imunidades?: string[];
    /** Proficiência em salvaguardas. */
    salvaguardas?: AtributoId[];
    /** Deslocamentos que o traço dá (prevalece o maior). */
    movimento?: Partial<Movimento>;
    /** Categoria de tamanho que o traço define (ex.: Colosso → Grande). */
    tamanho?: string;
    /** Na lista restrita da Miscigenação: exige 1 dificuldade adicional e só vale 1 da lista. */
    restrito?: boolean;
    escolhaPericias?: EscolhaPericias;
    /** O jogador escolhe falhas de caráter desta lista (Aspectos Humanos). */
    falhas?: TracoDados[];
    /** O traço pede o campo de Ancestralidade (traços Zoan em texto). */
    pedeAncestralidade?: boolean;
}

export interface VarianteDados {
    id: string;
    nome: string;
    descricao: string;
    /** Benefício da variante (conta como escolha da Miscigenação). */
    beneficio: TracoDados;
    /** Outros traços (ex.: Cobra Companheira das Kujas). */
    tracos?: TracoDados[];
    /** Obriga a dificuldade da espécie, com mais falhas (Kujas: 2 falhas). */
    falhasObrigatorias?: number;
}

export interface EspecieDados {
    id: string;
    nome: string;
    pv: number;
    preconceito: Preconceito;
    /** Tamanho em centímetros (mín. e máx. normais) e a categoria padrão. */
    tamanhoCm: [number, number];
    categoria: string;
    pesoKg: [number, number];
    movimento: Movimento;
    /** Benefícios da espécie: quem não é mestiço recebe todos. */
    beneficios: TracoDados[];
    dificuldade: TracoDados;
    variantes?: VarianteDados[];
    /** Traços sem escolha (ex.: Forma Sulong). */
    extras?: TracoDados[];
    /** Traços Culturais (pontos de treinamento) ou Ancestralidade (traços Zoan). */
    tracoCultural: boolean;
    ancestralidade: boolean;
    lore: { aparencia: string; patria: string; cultura: string; comportamento: string; relacao: string };
}

export interface VariacaoRaraDados {
    id: string;
    nome: string;
    descricao: string;
    traco: TracoDados;
}
