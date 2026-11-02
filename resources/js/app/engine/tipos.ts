export type Camada = 'mapa' | 'mestre' | 'jogadores' | 'iluminacao';

/** Ordem de desenho (de baixo para cima) e rótulos da interface. */
export const CAMADAS: { id: Camada; nome: string; dica: string }[] = [
    { id: 'mapa', nome: 'Mapa', dica: 'Imagem ou vídeo de fundo' },
    { id: 'mestre', nome: 'Mestre', dica: 'Só o mestre vê' },
    { id: 'jogadores', nome: 'Jogadores', dica: 'Tokens visíveis a todos' },
    { id: 'iluminacao', nome: 'Iluminação', dica: 'Luzes, paredes, portas e janelas' },
];

export type Ferramenta = 'selecionar' | 'mover' | 'regua' | 'parede' | 'porta' | 'janela' | 'luz';

export type TipoParede = 'parede' | 'porta' | 'janela';

export interface ObjetoDto {
    id: number;
    camada: Camada;
    tipo: 'imagem' | 'token' | 'luz' | 'parede';
    personagem_id: number | null;
    nome: string | null;
    x: number;
    y: number;
    largura: number;
    altura: number;
    z: number;
    arquivo: string | null;
    arquivo_tipo: 'imagem' | 'video' | 'gif' | null;
    dados: { raio?: number; cor?: string; pontos?: number[]; tipo?: TipoParede; aberta?: boolean } | null;
}

export interface PaginaDto {
    id: number;
    pasta_id: number | null;
    nome: string;
    ordem: number;
    colunas: number;
    linhas: number;
    tamanho_quadrado: number;
    grade_quadrada: boolean;
    distancia_quadrado: number;
    unidade: string;
}

export type AlcaRedimensionar = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type CamposGeometria = Partial<Pick<ObjetoDto, 'x' | 'y' | 'largura' | 'altura'>>;

export interface CenaEventos {
    selecionar: (id: number | null) => void;
    /** `final` = soltou o mouse (persistir); false = arrasto em andamento. */
    alterar: (id: number, campos: CamposGeometria, final: boolean) => void;
    zoom: (escala: number) => void;
    criarLuz: (x: number, y: number) => void;
    criarParede: (pontos: [number, number, number, number], tipo: TipoParede) => void;
    /** Clique numa porta (ferramenta selecionar, mestre ou jogador) alterna aberta/fechada. */
    alternarPorta: (id: number) => void;
}
