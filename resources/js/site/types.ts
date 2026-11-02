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

export interface Personagem {
    id: number;
    nome: string;
    papel: Papel;
    cor: string;
    tem_senha: boolean;
}
