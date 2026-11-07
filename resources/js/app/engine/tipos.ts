export type Camada = 'mapa' | 'mestre' | 'jogadores' | 'iluminacao';

/** Ordem de desenho (de baixo para cima) e rótulos da interface. */
export const CAMADAS: { id: Camada; nome: string; dica: string }[] = [
    { id: 'mapa', nome: 'Mapa', dica: 'Imagem ou vídeo de fundo' },
    { id: 'mestre', nome: 'Mestre', dica: 'Só o mestre vê' },
    { id: 'jogadores', nome: 'Jogadores', dica: 'Tokens visíveis a todos' },
    { id: 'iluminacao', nome: 'Iluminação', dica: 'Luzes, paredes, portas e janelas' },
];

export type Ferramenta = 'selecionar' | 'mirar' | 'mover' | 'regua' | 'pintar' | 'texto' | 'parede' | 'porta' | 'janela' | 'luz';

/** Estilo atual das ferramentas de pintar (traço) e texto. */
export interface EstiloPintura {
    cor: string;
    espessura: number;
    tamanho: number;
}

export type TipoParede = 'parede' | 'porta' | 'janela';

import type { BarraDoToken } from '../nucleo/sistemas/tipos';

export interface ObjetoDto {
    id: number;
    camada: Camada;
    tipo: 'imagem' | 'token' | 'luz' | 'parede' | 'traco' | 'texto';
    personagem_id: number | null;
    /** token: ids dos efeitos (condições) ativos do personagem, desenhados como ícones no token. */
    status?: string[];
    /** token: vida, CA e PP do personagem, só para quem pode ver a ficha (o jogador vê os dele; o mestre, todos). */
    barras?: BarraDoToken[];
    /** jogador que fez (traço/texto) */
    jogador_id: number | null;
    nome: string | null;
    x: number;
    y: number;
    largura: number;
    altura: number;
    z: number;
    arquivo: string | null;
    arquivo_tipo: 'imagem' | 'video' | 'gif' | null;
    dados: {
        raio?: number;
        cor?: string;
        /** parede: absolutos; traço: relativos ao x,y do objeto */
        pontos?: number[];
        tipo?: TipoParede;
        aberta?: boolean;
        espessura?: number;
        largura_original?: number;
        altura_original?: number;
        texto?: string;
        tamanho?: number;
    } | null;
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
    /** O objeto selecionado quando há um só (o inspetor usa); `null` com nenhum ou vários. */
    selecionar: (id: number | null) => void;
    /** A seleção inteira (um ou vários objetos: laço, Shift+clique, Ctrl+A). */
    selecao: (ids: number[]) => void;
    /** `final` = soltou o mouse (persistir); false = arrasto em andamento. */
    alterar: (id: number, campos: CamposGeometria, final: boolean) => void;
    zoom: (escala: number) => void;
    criarLuz: (x: number, y: number) => void;
    /** `pontos` relativos a (x, y); bbox já calculada. */
    criarTraco: (traco: { x: number; y: number; largura: number; altura: number; pontos: number[] }) => void;
    /** Clique com a ferramenta texto: mundo (x, y) e posição na tela para o campo de digitação. */
    criarTexto: (x: number, y: number, tela: { x: number; y: number }) => void;
    criarParede: (pontos: [number, number, number, number], tipo: TipoParede) => void;
    /** Clique numa porta (ferramenta selecionar, mestre ou jogador) alterna aberta/fechada. */
    alternarPorta: (id: number) => void;
    /** Botão direito (sem arrastar) sobre um objeto, em qualquer camada: posição na tela (client) para abrir o menu. */
    menuObjeto: (id: number, tela: { x: number; y: number }) => void;
    /** Ferramenta Mirar (ou tecla T + clique): o token de personagem clicado vira o alvo (`null` = limpar o alvo). */
    mirar: (id: number | null) => void;
    /** O gabarito de área foi confirmado (ids dos personagens dentro dele) ou cancelado (`null`). */
    gabarito: (personagemIds: number[] | null) => void;
}
