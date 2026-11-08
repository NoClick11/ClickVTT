/**
 * Formato dos dados do assistente de criação (espécies, variantes, variações raras). Arquivo PURO: o Node o executa
 * direto nos testes. Cada espécie nova é só um item novo em `especies.ts`, sem mudar a lógica.
 */
import type { EfeitoBruto } from '../../../../nucleo/efeitos/efeitos.ts';
import type { AcaoCaracteristica, AtributoId, BonusDeDano, CategoriaDeAcao, ReacaoDeCombate, Tecnica, TecnicaPrincipalConfig } from '../../regras.ts';

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
    /**
     * Só vale para perícias em que o personagem JÁ tem proficiência por outra fonte (Aptidão Natural). Como o estilo, que dá
     * perícias, vem depois, essa escolha é feita e conferida na etapa do estilo.
     */
    soProficientes?: boolean;
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
    usos?: { max?: number; porNivel?: boolean; porProf?: boolean; formula?: string; descanso?: 'curto' | 'longo' };
    efeitos?: EfeitoBruto[];
    resistencias?: string[];
    imunidades?: string[];
    /** Proficiência em salvaguardas. */
    salvaguardas?: AtributoId[];
    /** Deslocamentos que o traço dá (prevalece o maior). */
    movimento?: Partial<Movimento>;
    /** Categoria de tamanho que o traço define (ex.: Colosso → Grande). */
    tamanho?: string;
    /** Categoria de ação que ligar/usar o traço gasta no combate. */
    acao?: CategoriaDeAcao;
    /** Etiquetas de combate mostradas na ficha (ex.: "Ignora terreno difícil"). */
    etiquetas?: string[];
    /** Limite de um uso por rodada compartilhado entre as características do mesmo grupo (ex.: `ofensivo`). */
    grupoRodada?: string;
    /** Forma alternativa (junto da jogada de ataque): quantas vezes (contador próprio). */
    alternativo?: number;
    /** Reação a um ataque (Aparar): a característica oferece a defesa a quem foi atacado. */
    reacao?: ReacaoDeCombate;
    /** Ativa sem efeitos de motor que ainda assim tem interruptor, e o dano extra que dá enquanto vale (ver `BonusDeDano`). */
    interruptor?: boolean;
    bonusDano?: BonusDeDano[];
    /** Dá uma Técnica Principal/Assinatura: custa metade dos PP, +dados e (opcional) ignora resistências. */
    principal?: TecnicaPrincipalConfig;
    /** Botões da característica (condição no alvo, hospedar-se, dado extra). */
    acoes?: AcaoCaracteristica[];
    /** Técnicas que o traço dá (ex.: a esfera de fogo dos Lunarianos): entram na lista de técnicas, marcadas como do assistente. */
    tecnicas?: Omit<Tecnica, 'builder'>[];
    /** Cria um companheiro com ficha própria ao concluir (ex.: a Cobra Bélica das Kujas). */
    companheiro?: 'cobra-belica';
    /** O traço vira VÁRIAS características (ex.: Corpo Pequeno = Estômago Pequeno + Piscar + Andar das Fadas), cada uma com seus efeitos. */
    partes?: TracoDados[];
    /** Na lista restrita da Miscigenação: exige 1 dificuldade adicional e só vale 1 da lista. */
    restrito?: boolean;
    escolhaPericias?: EscolhaPericias;
    /** O jogador escolhe falhas de caráter desta lista (Aspectos Humanos). */
    falhas?: TracoDados[];
    /** O traço pede o campo de Ancestralidade (traços Zoan em texto). */
    pedeAncestralidade?: boolean;
    /** A característica só vale a partir deste nível do personagem (e, se houver, até `nivelMax`). */
    nivelMin?: number;
    nivelMax?: number;
    /** Habilidade Básica de que o traço faz parte (catálogo das Habilidades Básicas). */
    hb?: string;
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
