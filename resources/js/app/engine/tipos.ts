export type Camada = 'mapa' | 'mestre' | 'jogadores' | 'iluminacao';

/** Ordem de desenho (de baixo para cima) e rótulos da interface. */
export const CAMADAS: { id: Camada; nome: string; dica: string }[] = [
    { id: 'mapa', nome: 'Mapa', dica: 'Imagem ou vídeo de fundo' },
    { id: 'mestre', nome: 'Mestre', dica: 'Só o mestre vê' },
    { id: 'jogadores', nome: 'Jogadores', dica: 'Tokens visíveis a todos' },
    { id: 'iluminacao', nome: 'Iluminação', dica: 'Luzes, paredes, portas e janelas' },
];

export type Ferramenta = 'selecionar' | 'mirar' | 'mover' | 'regua' | 'pintar' | 'texto' | 'parede' | 'porta' | 'janela' | 'luz' | 'loot' | 'viagem';

/** Estilo atual das ferramentas de pintar (traço) e texto. */
export interface EstiloPintura {
    cor: string;
    espessura: number;
    tamanho: number;
}

export type TipoParede = 'parede' | 'porta' | 'janela';

/** Mira de um jogador ativa num token de personagem. */
export interface InfoMira {
    jogadorId?: number;
    cor: string;
    nome?: string;
}

import type { BarraDoToken } from '../nucleo/sistemas/tipos';

export interface ObjetoDto {
    id: number;
    camada: Camada;
    tipo: 'imagem' | 'token' | 'luz' | 'parede' | 'traco' | 'texto' | 'loot' | 'viagem';
    personagem_id: number | null;
    /** token: ids dos efeitos (condições) ativos do personagem, desenhados como ícones no token. */
    status?: string[];
    /** token: vida, CA e PP do personagem, só para quem pode ver a ficha (o jogador vê os dele; o mestre, todos). */
    barras?: BarraDoToken[];
    /** token: o personagem está com 0 de vida (NPC): o token é desenhado esmaecido com uma caveira. */
    morto?: boolean;
    /** token: fração de vida perdida do NPC (0 a 1); o token ganha manchas de sangue conforme sobe. */
    ferimento?: number;
    /** token: se é um NPC (para estilização de borda etc.) */
    npc?: boolean;
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
        /** token/imagem: rotação em graus (0 a 360). */
        rotacao?: number;
        /** porta/janela: só o mestre abre uma trancada. */
        trancada?: boolean;
        /** token: quantos quadrados enxerga no escuro (vazio = o padrão da página). */
        visao?: number | null;
        /** token: false = sem visão (cego): o jogador não enxerga por ele. */
        visao_ativa?: boolean;
        /** parede/porta/janela: o que barra (movimento, visão, luz); o que falta segue o padrão do tipo. */
        bloqueio?: { movimento?: boolean; visao?: boolean; luz?: boolean };
        /** luz: false = apagada. */
        ativa?: boolean;
        /** luz: 0 a 1 (padrão 1). */
        intensidade?: number;
        /** luz: raio (px) em que brilha por inteiro, antes de esmaecer até `raio`. */
        raio_claro?: number;
        /** luz: abertura do cone em graus (360 = em volta toda). */
        angulo?: number;
        /** luz: para onde o cone aponta, em graus (0 = direita). */
        direcao?: number;
        /** luz: ignora as paredes. */
        atravessa?: boolean;
        /** viagem: página e ponto de destino conectados */
        destino_pagina_id?: number | null;
        destino_objeto_id?: number | null;
        destino_nome?: string | null;
    } | null;
}

/** Conteúdo de um loot: o item vem completo porque o jogador ainda não o tem na ficha. */
export interface LootDto {
    objeto_id: number;
    nome: string | null;
    dinheiro: number;
    itens: { id: number; qtd: number; item: { id: number; nome: string; descricao: string | null; peso: number; efeitos: unknown[] } }[];
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
    /** Iluminação dinâmica: visão dos tokens, luzes e sombras das paredes (calculadas no navegador de cada jogador). */
    iluminacao_ativa: boolean;
    /** 0 = escuridão total, 100 = pleno dia. */
    luz_ambiente: number;
    /** Quadrados que um token enxerga no escuro. */
    visao_padrao: number;
    /** Falso: sem linha de visão (só luz e escuridão). */
    usar_visao: boolean;
    /** O que o jogador já viu fica no mapa, esmaecido. */
    memoria_ativa: boolean;
    /** Imagem de fundo/mapa da página para miniatura (estilo Roll20). */
    miniatura?: string | null;
}

export type AlcaRedimensionar = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type CamposGeometria = Partial<Pick<ObjetoDto, 'x' | 'y' | 'largura' | 'altura'>> & {
    dados?: Partial<NonNullable<ObjetoDto['dados']>>;
};

export interface CenaEventos {
    /** O objeto selecionado quando há um só (o inspetor usa); `null` com nenhum ou vários. */
    selecionar: (id: number | null) => void;
    /** A seleção inteira (um ou vários objetos: laço, Shift+clique, Ctrl+A). */
    selecao: (ids: number[]) => void;
    /** `final` = soltou o mouse (persistir); false = arrasto em andamento; `origem` = ponto de partida do movimento. */
    alterar: (id: number, campos: CamposGeometria, final: boolean, origem?: { x: number; y: number }) => void;
    zoom: (escala: number) => void;
    criarLuz: (x: number, y: number) => void;
    /** Clique com a ferramenta Loot (mestre): cria um loot no ponto. */
    criarLoot: (x: number, y: number) => void;
    /** Clique num loot (jogador) ou duplo clique (mestre): abre o conteúdo. */
    abrirLoot: (id: number) => void;
    /** Duplo clique num token com personagem (mestre ou jogador): abre a ficha. */
    abrirToken: (id: number) => void;
    /** `pontos` relativos a (x, y); bbox já calculada. */
    criarTraco: (traco: { x: number; y: number; largura: number; altura: number; pontos: number[] }) => void;
    /** Clique com a ferramenta texto: mundo (x, y) e posição na tela para o campo de digitação. */
    criarTexto: (x: number, y: number, tela: { x: number; y: number }) => void;
    criarParede: (pontos: [number, number, number, number], tipo: TipoParede) => void;
    /** Clique numa porta (ferramenta selecionar, mestre ou jogador) alterna aberta/fechada. */
    alternarPorta: (id: number) => void;
    /** Clique num ponto de viagem (mestre ou jogador próximo) para transitar entre mapas. */
    usarPontoViagem: (id: number) => void;
    /** Clique com a ferramenta Viagem (mestre): cria um ponto de viagem. */
    criarViagem: (x: number, y: number) => void;
    /** Botão direito (sem arrastar) sobre um objeto, em qualquer camada: posição na tela (client) para abrir o menu. */
    menuObjeto: (id: number, tela: { x: number; y: number }) => void;
    /** Ferramenta Mirar (ou tecla T + clique): o token de personagem clicado vira o alvo (`null` = limpar o alvo). */
    mirar: (id: number | null) => void;
    /** O gabarito de área foi confirmado (ids dos personagens dentro dele) ou cancelado (`null`). */
    gabarito: (
        personagemIds: number[] | null,
        info?: {
            medida: { forma: 'linha' | 'cone' | 'esfera'; metros: number; angulo: number };
            origem: { x: number; y: number };
            mpp: number;
        } | null,
    ) => void;
    /** Ponto marcado no mapa para uma esfera (Vigília): o centro em pixels do mundo, ou null (Esc). */
    ponto: (ponto: { x: number; y: number } | null) => void;
    /** A memória das áreas vistas mudou: PNG (data URL) para guardar no servidor. */
    memoria: (imagem: string) => void;
    /** Entrou numa página com iluminação: busca no servidor a memória deste jogador. */
    pedirMemoria: (paginaId: number) => void;
    /** Clique na barra de vida de um token: abre edição rápida de vida flutuante. */
    editarVida?: (id: number) => void;
    /** Cursor sobre um ícone de status de um token: dados mecânicos para tooltip ou null ao sair. */
    hoverStatus?: (dados: { tokenNome: string; statusIds: string[]; tela: { x: number; y: number } } | null) => void;
    /** Clique com botão direito no mapa sem arrastar: abre menu de ping com coordenadas do mundo e da tela. */
    menuPing?: (mundo: { x: number; y: number }, tela: { x: number; y: number }) => void;
    /** Ping emitido no mapa: coordenadas do mundo e se deve puxar a câmera dos demais. */
    ping?: (x: number, y: number, puxar: boolean) => void;
    /** A câmera mudou de posição ou zoom, ou a tela foi redimensionada. */
    vista?: () => void;
}
