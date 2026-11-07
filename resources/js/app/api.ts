import type { Criacao, Personagem } from '@/site/types';
import type { ObjetoDto, PaginaDto } from './engine/tipos';
import type { ResumoEvento } from './nucleo/combate/reacoes';
import type { Combate, ItemDeCatalogoDto, ItemDto, LojaAbertaDto, Mensagem, NovoItem, NovoItemDeCatalogo, VisibilidadeRolagem } from './tipos-mesa';

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

async function requisitar<T>(jogadorId: number, metodo: string, url: string, corpo?: object | FormData): Promise<T> {
    // X-Jogador diz ao servidor QUEM está agindo nesta aba (mestre e jogador podem coexistir no navegador).
    const cabecalhos: Record<string, string> = {
        Accept: 'application/json',
        'X-XSRF-TOKEN': xsrf(),
        'X-Requested-With': 'XMLHttpRequest',
        'X-Jogador': String(jogadorId),
    };
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
            // Laravel 422: junta as mensagens de cada campo (a principal sozinha diz só "e mais N erros").
            const detalhes = json.errors ? [...new Set(Object.values(json.errors as Record<string, string[]>).map((m) => m[0]))] : [];
            if (detalhes.length) mensagem = detalhes.slice(0, 3).join(' ') + (detalhes.length > 3 ? ` (+${detalhes.length - 3})` : '');
        } catch {
            /* corpo não é JSON */
        }
        throw new ErroApi(mensagem, resposta.status);
    }

    return (await resposta.json()) as T;
}

/** Cliente da API da mesa de jogo (rotas `jogo.*`). */
/** `atorId` = jogador desta aba (vai no cabeçalho). Atenção: não confundir com o jogador-alvo de moverJogador. */
export function apiMesa(mesaId: number, atorId: number) {
    const r = (nome: string, ...params: (number | string)[]) => route(nome, [mesaId, ...params]);

    return {
        criarObjeto: (paginaId: number, dados: object | FormData) => requisitar<ObjetoDto>(atorId, 'POST', r('jogo.objetos.store', paginaId), dados),
        atualizarObjeto: (id: number, campos: object) => requisitar<ObjetoDto>(atorId, 'PATCH', r('jogo.objetos.update', id), campos),
        removerObjeto: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.objetos.destroy', id)),
        criarPagina: (dados: object) => requisitar<PaginaDto>(atorId, 'POST', r('jogo.paginas.store'), dados),
        atualizarPagina: (id: number, campos: object) => requisitar<PaginaDto>(atorId, 'PATCH', r('jogo.paginas.update', id), campos),
        removerPagina: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.paginas.destroy', id)),
        moverJogador: (paginaId: number, jogadorId: number) => requisitar<object>(atorId, 'POST', r('jogo.paginas.jogador', paginaId, jogadorId)),
        /** Só o mestre: cria o personagem (sem jogadores = NPC). */
        criarPersonagem: (dados: { nome: string; cor: string; jogadores: number[] }) =>
            requisitar<Personagem>(atorId, 'POST', r('jogo.personagens.store'), dados),
        atribuirJogadores: (personagemId: number, jogadores: number[]) =>
            requisitar<object>(atorId, 'PUT', r('jogo.personagens.atribuir', personagemId), { jogadores }),
        enviarTexto: (texto: string, personagemId: number | null) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.mensagens.store'), { texto, personagem_id: personagemId }),
        rolar: (
            expressao: string,
            visibilidade: VisibilidadeRolagem,
            personagemId: number | null,
            rotulo?: string,
            dano?: { tipo: string | null; fator?: number },
            acao?: { categoria: string; tecnica?: boolean },
            alvoPersonagemId?: number | null,
        ) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.rolagens.store'), {
                ...(alvoPersonagemId ? { alvo_personagem_id: alvoPersonagemId } : {}),
                expressao,
                rotulo,
                visibilidade,
                personagem_id: personagemId,
                ...(dano ? { dano } : {}),
                ...(acao ? { acao } : {}),
            }),
        /** Disparada: gasta a ação dela e soma outro deslocamento ao turno do personagem. */
        disparada: (personagemId: number) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.disparada'), { personagem_id: personagemId }),
        /** Soma ao turno `fator` vezes o deslocamento do personagem (Recuo Estratégico, Reflexo Afiado). */
        deslocamento: (personagemId: number, fator: number) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.deslocamento'), { personagem_id: personagemId, fator }),
        /** Primeiros Socorros: o socorrista trata o personagem alvo (cura, PV temporários, encerra condições). */
        socorros: (alvoId: number, socorristaId: number, soCondicoes = false) =>
            requisitar<{ texto: string }>(atorId, 'POST', r('jogo.personagens.socorros', alvoId), {
                socorrista_id: socorristaId,
                so_condicoes: soCondicoes,
            }),
        /** Responde a janela de reação: usa a reação `opcao` ou passa (`null`). */
        reagir: (eventoId: number, personagemId: number, opcao: string | null) =>
            requisitar<ResumoEvento>(atorId, 'POST', r('jogo.combate.eventos.reagir', eventoId), { personagem_id: personagemId, opcao }),
        /** O mestre fecha a janela de reação: quem não respondeu conta como "passou". */
        encerrarJanela: (eventoId: number) => requisitar<ResumoEvento>(atorId, 'POST', r('jogo.combate.eventos.encerrar', eventoId), {}),
        /** Gasta uma ação do personagem no combate (o servidor recusa com o motivo se não pode agir agora). */
        gastarAcao: (personagemId: number, categoria: string, tecnica = false) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.acao'), { personagem_id: personagemId, categoria, tecnica }),
        /** Entrega um companheiro com ficha pronta ao personagem (ex.: Cobra Bélica); pedir de novo devolve o mesmo. */
        criarCompanheiro: (personagemId: number, modelo: string) =>
            requisitar<{ id: number; criado: boolean }>(atorId, 'POST', r('jogo.personagens.companheiros', personagemId), { modelo }),
        /** Aplica ao alvo o total de uma rolagem de dano (o servidor desconta PV, respeitando resistências e imunidades). */
        aplicarDano: (personagemId: number, mensagemId: number) =>
            requisitar<{ final: number; modo: string; texto: string }>(atorId, 'POST', r('jogo.personagens.dano', personagemId), {
                mensagem_id: mensagemId,
            }),
        /** Liga ou desliga uma condição do alvo, com duração em turnos ou até receber dano. */
        aplicarCondicao: (
            personagemId: number,
            dados: {
                condicao: string;
                acao: 'aplicar' | 'remover';
                turnos?: string;
                ao_dano?: boolean;
                salvaguarda?: { atributo: string; cd: number };
            },
        ) => requisitar<{ imune: boolean; resistiu?: boolean; texto: string }>(atorId, 'POST', r('jogo.personagens.condicoes', personagemId), dados),
        /** Salva campos da ficha: 1 campo = edição pontual; vários = etapa da criação guiada (aplicados juntos). */
        salvarFicha: (personagemId: number, campos: Record<string, unknown>, criacao?: Criacao | null) =>
            requisitar<{ ficha: Record<string, unknown>; criacao: Criacao | null }>(
                atorId,
                'PATCH',
                r('jogo.personagens.ficha', personagemId),
                criacao === undefined ? { campos } : { campos, criacao },
            ),
        /** Rola (no servidor) os 6 valores de atributo da criação: 4d6 descartando o menor. Uma vez só: depois devolve os mesmos. */
        rolarAtributos: (personagemId: number) =>
            requisitar<{ rolados: number[] }>(atorId, 'POST', r('jogo.personagens.atributos-rolados', personagemId), {}),
        /** Só o mestre. */
        criarItem: (item: NovoItem) => requisitar<ItemDto>(atorId, 'POST', r('jogo.itens.store'), item),
        atualizarItem: (id: number, item: NovoItem) => requisitar<ItemDto>(atorId, 'PATCH', r('jogo.itens.update', id), item),
        /** Também tira o item do inventário de todos os personagens da mesa. */
        excluirItem: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.itens.destroy', id)),
        /** Loja (só o mestre abre e fecha): `jogadores` = 'todos' ou ids; `fator` = ajuste de preço em %. */
        abrirLoja: (dados: { jogadores: 'todos' | number[]; categorias: string[]; raridades?: string[]; fator?: number }) =>
            requisitar<{ lojas: LojaAbertaDto[] }>(atorId, 'POST', r('jogo.loja.abrir'), dados),
        fecharLoja: (jogadores: 'todos' | number[]) => requisitar<{ lojas: LojaAbertaDto[] }>(atorId, 'DELETE', r('jogo.loja.fechar'), { jogadores }),
        /** Compra (o servidor confere loja aberta, categoria, preço e Belly). `item` = id do catálogo do sistema ou `c:ID` do mestre. */
        comprarNaLoja: (dados: { personagem_id: number; item: string; qtd?: number }) =>
            requisitar<{ campos: Record<string, unknown>; item: ItemDto; total: number; saldo: number }>(
                atorId,
                'POST',
                r('jogo.loja.comprar'),
                dados,
            ),
        criarItemDeCatalogo: (item: NovoItemDeCatalogo) => requisitar<ItemDeCatalogoDto>(atorId, 'POST', r('jogo.catalogo.store'), item),
        atualizarItemDeCatalogo: (id: number, item: NovoItemDeCatalogo) =>
            requisitar<ItemDeCatalogoDto>(atorId, 'PATCH', r('jogo.catalogo.update', id), item),
        excluirItemDeCatalogo: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.catalogo.destroy', id)),
        /** Comando de combate (o servidor decide e devolve o estado novo): iniciar, iniciativa, turno, ordem... Ver `CombateService`. */
        comandoCombate: (comando: string, dados: Record<string, unknown> = {}) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.comando'), { comando, ...dados }),
        criarPasta: (nome: string) => requisitar<{ id: number; nome: string; ordem: number }>(atorId, 'POST', r('jogo.pastas.store'), { nome }),
        atualizarPasta: (id: number, campos: object) =>
            requisitar<{ id: number; nome: string; ordem: number }>(atorId, 'PATCH', r('jogo.pastas.update', id), campos),
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
