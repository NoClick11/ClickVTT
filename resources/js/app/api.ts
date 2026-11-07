import type { Criacao, Personagem } from '@/site/types';
import type { ObjetoDto, PaginaDto } from './engine/tipos';
import type { ResumoEvento } from './nucleo/combate/reacoes';
import type {
    ArmaParaForja,
    Combate,
    ItemDeCatalogoDto,
    ItemDto,
    LojaAbertaDto,
    Mensagem,
    MunicaoParaForja,
    NovoItem,
    NovoItemDeCatalogo,
    VisibilidadeRolagem,
} from './tipos-mesa';

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
/** Os Bellys iniciais rolados no servidor (`5d10 × 1000`). */
export interface DinheiroRolado {
    estilo: string;
    dados: number[];
    total: number;
    bellys: number;
    expressao: string;
    multiplicador: number;
}

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
        /** Só o mestre: exclui o personagem (ficha, tokens e lugar no combate). */
        excluirPersonagem: (personagemId: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.personagens.excluir', personagemId)),
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
            tecnica?: { nome: string; dano?: { expressao: string; tipo: string | null } | null; secundaria?: object | null },
            municaoItemId?: number,
        ) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.rolagens.store'), {
                ...(alvoPersonagemId ? { alvo_personagem_id: alvoPersonagemId } : {}),
                ...(tecnica
                    ? {
                          tecnica: {
                              nome: tecnica.nome,
                              ...(tecnica.dano ? { dano: tecnica.dano } : {}),
                              ...(tecnica.secundaria ? { secundaria: tecnica.secundaria } : {}),
                          },
                      }
                    : {}),
                expressao,
                rotulo,
                visibilidade,
                personagem_id: personagemId,
                ...(dano ? { dano } : {}),
                ...(acao ? { acao } : {}),
                ...(municaoItemId ? { municao_item_id: municaoItemId } : {}),
            }),
        /** Técnica de arma de fogo: gasta a munição do Requisito (o servidor lê o custo da Técnica salva). */
        gastarMunicaoDaTecnica: (personagemId: number, tecnica: string) =>
            requisitar<{ gasto: { quantidade: number } | null }>(atorId, 'POST', r('jogo.tecnicas.municao.gastar'), {
                personagem_id: personagemId,
                tecnica,
            }),
        /** Efeito de Técnica que a mesa comanda (botão do card): Execução, Zona do Atirador, Headshot, Covering, Mira Cruel, redução extra. */
        efeitoEspecial: (mensagemId: number, efeito: string, alvoId?: number | null) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.tecnicas.especial', mensagemId), { efeito, ...(alvoId ? { alvo_id: alvoId } : {}) }),
        /** Efeito da munição de um ataque que acertou: Kairoseki (Enfraquecido) ou Bola Explosiva (Salvaguarda em área). */
        efeitoDaMunicao: (mensagemId: number, dados: { alvo_id?: number | null; alvos?: number[] }) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.tecnicas.municao.efeito', mensagemId), dados),
        /** Técnica de Salvaguarda: abre o card no chat com os alvos da área (a CD e o dano saem do servidor). */
        abrirSalvaguarda: (dados: {
            personagem_id: number;
            nome: string;
            atributo: string;
            desvantagem?: boolean;
            ao_passar?: 'metade' | 'nada';
            alvos: number[];
            dano?: { expressao: string; tipo: string | null } | null;
            efeito?: string;
            aplica?: { condicao: string; turnos?: number; aoDano?: boolean } | null;
            secundaria?: {
                atributo: string;
                desvantagem?: boolean;
                efeito: string;
                aplica?: { condicao: string; turnos?: number; aoDano?: boolean };
            } | null;
        }) => requisitar<Mensagem>(atorId, 'POST', r('jogo.tecnicas.salvaguarda.abrir'), dados),
        /** Um alvo rola a Salvaguarda do card; com o último a rolar o servidor rola o dano e o aplica. */
        rolarSalvaguarda: (mensagemId: number, personagemId: number) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.tecnicas.salvaguarda.rolar', mensagemId), { personagem_id: personagemId }),
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
        /** Ativa uma Técnica com duração no combate em curso (Quick Draw): o servidor pede o ataque no início do turno de quem está ao alcance. */
        ativarTecnica: (dados: {
            personagem_id: number;
            nome: string;
            rodadas: number;
            concentracao?: boolean;
            alcance: number;
            dano: { expressao: string; tipo: string | null };
            opcoes?: object[];
        }) => requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.tecnicas-ativas.ativar'), dados),
        /** Vigília (Overwatch): marca a esfera (centro em pixels do mapa) dentro do alcance da arma de fogo. */
        ativarVigia: (dados: { personagem_id: number; nome: string; rodadas: number; concentracao: boolean; x: number; y: number; raio: number }) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.tecnicas-ativas.vigia'), dados),
        /** Ação bônus: move o centro da esfera até 6 m. */
        moverVigia: (id: string, x: number, y: number) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.tecnicas-ativas.mover', id), { x, y }),
        encerrarTecnicaAtiva: (id: string) => requisitar<{ combate: Combate }>(atorId, 'DELETE', r('jogo.combate.tecnicas-ativas.encerrar', id)),
        /** Card do gatilho: rola o ataque, escolhe o efeito do acerto ou ignora. */
        gatilhoAtacar: (mensagemId: number) => requisitar<Mensagem>(atorId, 'POST', r('jogo.gatilhos.atacar', mensagemId), {}),
        gatilhoEscolher: (mensagemId: number, opcao: string) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.gatilhos.escolher', mensagemId), { opcao }),
        gatilhoIgnorar: (mensagemId: number) => requisitar<Mensagem>(atorId, 'POST', r('jogo.gatilhos.ignorar', mensagemId), {}),
        /** Só o mestre: liga ou desliga o fogo amigo da mesa. */
        fogoAmigo: (ligado: boolean) => requisitar<{ fogo_amigo: boolean }>(atorId, 'PATCH', r('jogo.fogo-amigo'), { ligado }),
        /** Ataques extras do turno (Tempestade de Balas, Alvo Travado...): soma `n` (pode ser negativo) ao limite de ataques do personagem. */
        ataquesExtras: (personagemId: number, n: number) =>
            requisitar<{ combate: Combate }>(atorId, 'POST', r('jogo.combate.ataques-extras'), { personagem_id: personagemId, n }),
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
        /** Rola os Bellys iniciais do estilo no servidor (uma vez por estilo; pedir de novo devolve o mesmo resultado). */
        rolarDinheiro: (personagemId: number, estilo: string) =>
            requisitar<DinheiroRolado>(atorId, 'POST', r('jogo.personagens.dinheiro-rolado', personagemId), { estilo }),
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
        /** O mestre entrega um item do catálogo (`item` = id do livro ou `c:ID`) a um personagem, sem cobrar. */
        entregarDoCatalogo: (dados: { personagem_id: number; item: string; qtd?: number }) =>
            requisitar<{ campos: Record<string, unknown>; nome: string; qtd: number }>(atorId, 'POST', r('jogo.loja.entregar'), dados),
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
        /** Forja do Ferreiro: as armas de um personagem, criar do catálogo (lingote + Belly + Teste) e aprimorar com Pontos de Forja. */
        armasParaForja: (personagem_id: number) =>
            requisitar<{ armas: ArmaParaForja[]; municoes: MunicaoParaForja[] }>(atorId, 'POST', r('jogo.forja.armas'), { personagem_id }),
        forjar: (dados: { ferreiro_id: number; item: string; atributo: 'for' | 'des' | 'sab' }) =>
            requisitar<{ sucesso: boolean; total: number; cd: number; custo: number; texto: string; campos: Record<string, unknown> }>(
                atorId,
                'POST',
                r('jogo.forja.criar'),
                dados,
            ),
        melhorarEquipamento: (dados: {
            ferreiro_id: number;
            alvo_id: number;
            atributo: 'for' | 'des' | 'sab';
            tipo: 'kairoseki-arma' | 'kairoseki-municao' | 'municoes' | 'alcance';
            item_id?: number | null;
            tipo_dano?: 'Contundente' | 'Perfurante';
        }) =>
            requisitar<{
                resultado: 'sucesso' | 'falhou' | 'quebrou';
                texto: string;
                alvo_id: number;
                camposFerreiro: Record<string, unknown>;
                camposAlvo: Record<string, unknown>;
            }>(atorId, 'POST', r('jogo.forja.melhorar'), dados),
        aprimorarArma: (dados: { ferreiro_id: number; alvo_id: number; item_id: number; melhorias: Record<string, unknown> }) =>
            requisitar<{ texto: string; alvo_id: number; camposFerreiro: Record<string, unknown>; camposAlvo: Record<string, unknown> }>(
                atorId,
                'POST',
                r('jogo.forja.aprimorar'),
                dados,
            ),
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
