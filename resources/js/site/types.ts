export interface Sistema {
    id: number;
    nome: string;
    icone: string | null;
    descricao: string | null;
}

export interface Mesa {
    id: number;
    slug: string;
    nome: string;
    sistema_id: number;
    sistema: Pick<Sistema, 'nome' | 'icone'>;
    descricao: string | null;
    capa: string | null;
    tema_entrada: 'padrao' | 'minimo';
    favorita: boolean;
    travada: boolean;
}

export type Papel = 'jogador' | 'mestre';

export const PAPEIS: Record<Papel, string> = { jogador: 'Jogador', mestre: 'Mestre' };

/** Quem entra na mesa pelo convite (o mestre também é um jogador). */
export interface Jogador {
    id: number;
    nome: string;
    papel: Papel;
    cor: string;
    tem_senha?: boolean;
    pagina_id?: number | null;
}

/** Resumo de um jogador (dono de personagem). */
export type DonoPersonagem = Pick<Jogador, 'id' | 'nome' | 'cor'>;

/** Ficha (PC ou NPC). Pode ter vários jogadores; um jogador pode ter vários personagens. */
/** Criação guiada do personagem: etapa atual, se terminou e as escolhas do assistente (formato do sistema). */
export interface Criacao {
    etapa: string;
    concluida: boolean;
    dados?: Record<string, unknown>;
}

export interface Personagem {
    id: number;
    /** Pasta do diário em que o mestre guardou o personagem (null = raiz). */
    pasta_id?: number | null;
    nome: string;
    cor: string;
    /** Ids dos efeitos (condições) ativos: públicos, viram ícones no token. */
    status?: string[];
    /** NPC marcado pelo mestre como aliado dos jogadores (os jogadores não o atingem). */
    aliado?: boolean;
    jogadores: DonoPersonagem[];
    /** Dados da ficha (formato do sistema da mesa): só vêm para o mestre e para os jogadores do personagem. */
    ficha?: Record<string, unknown> | null;
    /** Criação guiada em andamento (etapa atual), se houver. */
    criacao?: Criacao | null;
}
