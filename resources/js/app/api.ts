import type { ObjetoDto, PaginaDto } from './engine/tipos';

export class ErroApi extends Error {
    constructor(
        mensagem: string,
        public status: number,
    ) {
        super(mensagem);
    }
}

function xsrf(): string {
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return m ? decodeURIComponent(m[1]) : '';
}

async function requisitar<T>(personagemId: number, metodo: string, url: string, corpo?: object | FormData): Promise<T> {
    // X-Personagem diz ao servidor QUEM está agindo nesta aba (mestre e jogador podem coexistir no navegador).
    const cabecalhos: Record<string, string> = { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest', 'X-Personagem': String(personagemId) };
    let body: BodyInit | undefined;
    if (corpo instanceof FormData) {
        body = corpo;
    } else if (corpo) {
        cabecalhos['Content-Type'] = 'application/json';
        body = JSON.stringify(corpo);
    }
    const resposta = await fetch(url, { method: metodo, headers: cabecalhos, body, credentials: 'same-origin' });
    if (!resposta.ok) {
        let mensagem = `Erro ${resposta.status}`;
        try {
            const json = await resposta.json();
            mensagem = json.message ?? mensagem;
        } catch {
            /* corpo não é JSON */
        }
        throw new ErroApi(mensagem, resposta.status);
    }

    return (await resposta.json()) as T;
}

/** Cliente da API da mesa de jogo (rotas `jogo.*`). */
/** `atorId` = personagem desta aba (vai no cabeçalho). Atenção: não confundir com o personagem-alvo de moverJogador. */
export function apiMesa(mesaId: number, atorId: number) {
    const r = (nome: string, ...params: (number | string)[]) => route(nome, [mesaId, ...params]);

    return {
        criarObjeto: (paginaId: number, dados: object | FormData) => requisitar<ObjetoDto>(atorId, 'POST', r('jogo.objetos.store', paginaId), dados),
        atualizarObjeto: (id: number, campos: object) => requisitar<ObjetoDto>(atorId, 'PATCH', r('jogo.objetos.update', id), campos),
        removerObjeto: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.objetos.destroy', id)),
        criarPagina: (dados: object) => requisitar<PaginaDto>(atorId, 'POST', r('jogo.paginas.store'), dados),
        atualizarPagina: (id: number, campos: object) => requisitar<PaginaDto>(atorId, 'PATCH', r('jogo.paginas.update', id), campos),
        removerPagina: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.paginas.destroy', id)),
        moverJogador: (paginaId: number, personagemId: number) => requisitar<object>(atorId, 'POST', r('jogo.paginas.jogador', paginaId, personagemId)),
        criarPasta: (nome: string) => requisitar<{ id: number; nome: string; ordem: number }>(atorId, 'POST', r('jogo.pastas.store'), { nome }),
        atualizarPasta: (id: number, campos: object) => requisitar<{ id: number; nome: string; ordem: number }>(atorId, 'PATCH', r('jogo.pastas.update', id), campos),
        removerPasta: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.pastas.destroy', id)),
    };
}

/** Lê largura/altura naturais de imagem, GIF ou vídeo antes do envio. */
export function medirArquivo(arquivo: File): Promise<{ largura: number; altura: number }> {
    const url = URL.createObjectURL(arquivo);
    const livre = () => URL.revokeObjectURL(url);

    return new Promise((ok, falha) => {
        if (arquivo.type.startsWith('video/')) {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.onloadedmetadata = () => (ok({ largura: v.videoWidth, altura: v.videoHeight }), livre());
            v.onerror = () => (falha(new Error('Vídeo inválido')), livre());
            v.src = url;
        } else {
            const i = new Image();
            i.onload = () => (ok({ largura: i.naturalWidth, altura: i.naturalHeight }), livre());
            i.onerror = () => (falha(new Error('Imagem inválida')), livre());
            i.src = url;
        }
    });
}
