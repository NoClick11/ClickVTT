import type { Criacao, Personagem } from '@/site/types';
import type { LootDto, ObjetoDto, PaginaDto } from './engine/tipos';
import type { ResumoEvento } from './nucleo/combate/reacoes';
import { socketIdAtual } from './realtime';
import type {
    ArmaParaForja,
    Combate,
    DiarioPastaDto,
    FolhetoDto,
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
        public dados?: unknown,
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
    const sid = socketIdAtual();
    if (sid) cabecalhos['X-Socket-ID'] = sid;
    let body: BodyInit | undefined;
    if (corpo instanceof FormData) {
        body = corpo;
    } else if (corpo) {
        cabecalhos['Content-Type'] = 'application/json';
        body = JSON.stringify(corpo);
    }
    // Tempo limite: uma requisição presa (queda de rede, Wi-Fi trocando) travava a fila de salvamento da ficha para sempre, e as
    // edições seguintes nunca chegavam ao servidor. Com o limite, ela falha, a tela avisa e volta ao que está salvo.
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), corpo instanceof FormData ? 180_000 : 30_000);
    let resposta: Response;
    try {
        resposta = await fetch(url, { method: metodo, headers: cabecalhos, body, credentials: 'same-origin', signal: controle.signal });
    } catch (e) {
        throw new ErroApi(
            controle.signal.aborted ? 'O servidor demorou demais para responder. Confira a conexão.' : 'Sem conexão com o servidor.',
            0,
            e,
        );
    } finally {
        clearTimeout(limite);
    }
    if (!resposta.ok) {
        let mensagem = `Erro ${resposta.status}`;
        let dados: unknown;
        try {
            const json = await resposta.json();
            dados = json;
            mensagem = json.message ?? mensagem;
            // Laravel 422: junta as mensagens de cada campo (a principal sozinha diz só "e mais N erros").
            const detalhes = json.errors ? [...new Set(Object.values(json.errors as Record<string, string[]>).map((m) => m[0]))] : [];
            if (detalhes.length) mensagem = detalhes.slice(0, 3).join(' ') + (detalhes.length > 3 ? ` (+${detalhes.length - 3})` : '');
        } catch {
            /* corpo não é JSON */
        }
        throw new ErroApi(mensagem, resposta.status, dados);
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
    const r = (nome: string, ...params: (number | string)[]) => route(nome, [mesaId, ...params], false);

    return {
        criarObjeto: (paginaId: number, dados: object | FormData) => requisitar<ObjetoDto>(atorId, 'POST', r('jogo.objetos.store', paginaId), dados),
        atualizarObjeto: (id: number, campos: object) => requisitar<ObjetoDto>(atorId, 'PATCH', r('jogo.objetos.update', id), campos),
        /** Abre/fecha uma porta ou janela (o servidor recusa se estiver trancada, salvo para o mestre). */
        alternarObjeto: (id: number) => requisitar<ObjetoDto>(atorId, 'POST', r('jogo.objetos.alternar', id)),
        /** Usa um ponto de viagem para navegar até outra página e posicionar o token. */
        viajar: (objetoId: number, personagemId?: number) =>
            requisitar<{ destino_pagina_id: number; x: number; y: number; token_movido: boolean }>(
                atorId,
                'POST',
                r('jogo.objetos.viajar', objetoId),
                personagemId ? { personagem_id: personagemId } : {},
            ),
        /** A memória das áreas que ESTE jogador já viu na página (PNG em data URL) ou null. */
        exploracao: (paginaId: number) => requisitar<{ imagem: string | null }>(atorId, 'GET', r('jogo.exploracao.mostrar', paginaId)),
        guardarExploracao: (paginaId: number, imagem: string) =>
            requisitar<{ ok: true }>(atorId, 'PUT', r('jogo.exploracao.guardar', paginaId), { imagem }),
        /** Só o mestre: apaga a memória de todos os jogadores nesta página. */
        limparExploracao: (paginaId: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.exploracao.limpar', paginaId)),
        removerObjeto: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.objetos.destroy', id)),
        // Loot no mapa: o mestre monta; o jogador abre e pega (409 = alguém levou antes; `ErroApi.dados.loot` traz o conteúdo de agora).
        criarLoot: (paginaId: number, dados: { nome?: string; camada: 'mestre' | 'jogadores'; x: number; y: number }) =>
            requisitar<{ objeto: ObjetoDto; loot: LootDto }>(atorId, 'POST', r('jogo.loot.criar', paginaId), dados),
        abrirLoot: (id: number) => requisitar<LootDto>(atorId, 'GET', r('jogo.loot.mostrar', id)),
        pegarDoLoot: (id: number, dados: { personagem_id: number; loot_item_id?: number; dinheiro?: boolean; qtd?: number; tudo?: boolean }) =>
            requisitar<{ campos: Record<string, unknown>; loot: LootDto; texto: string }>(atorId, 'POST', r('jogo.loot.pegar', id), dados),
        catalogoParaLoot: () =>
            requisitar<{ itens: { ref: string; nome: string; categoria: string; raridade: string | null }[] }>(
                atorId,
                'GET',
                r('jogo.loot.catalogo'),
            ),
        adicionarAoLoot: (
            id: number,
            dados: {
                origem: 'catalogo' | 'item' | 'novo';
                ref?: string;
                item_id?: number;
                nome?: string;
                descricao?: string;
                peso?: number;
                qtd?: number;
            },
        ) => requisitar<LootDto>(atorId, 'POST', r('jogo.loot.itens.store', id), dados),
        qtdNoLoot: (id: number, linha: number, qtd: number) => requisitar<LootDto>(atorId, 'PATCH', r('jogo.loot.itens.update', id, linha), { qtd }),
        atualizarLoot: (id: number, campos: { dinheiro?: number; nome?: string }) =>
            requisitar<LootDto>(atorId, 'PATCH', r('jogo.loot.update', id), campos),
        criarPagina: (dados: object) => requisitar<PaginaDto>(atorId, 'POST', r('jogo.paginas.store'), dados),
        atualizarPagina: (id: number, campos: object) => requisitar<PaginaDto>(atorId, 'PATCH', r('jogo.paginas.update', id), campos),
        removerPagina: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.paginas.destroy', id)),
        moverJogador: (paginaId: number, jogadorId: number) => requisitar<object>(atorId, 'POST', r('jogo.paginas.jogador', paginaId, jogadorId)),
        /** Só o mestre: cria o personagem (sem jogadores = NPC). */
        criarPersonagem: (dados: { nome: string; cor: string; jogadores: number[] }) =>
            requisitar<Personagem>(atorId, 'POST', r('jogo.personagens.store'), dados),
        /** Só o mestre: renomeia o personagem ou NPC. */
        renomearPersonagem: (personagemId: number, nome: string) =>
            requisitar<Personagem>(atorId, 'PATCH', r('jogo.personagens.renomear', personagemId), { nome }),
        /** Só o mestre: exclui o personagem (ficha, tokens e lugar no combate). */
        excluirPersonagem: (personagemId: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.personagens.excluir', personagemId)),
        /** Altera ou remove a foto do personagem (arquivo local ou URL). */
        alterarFotoPersonagem: (
            personagemId: number,
            dados: { arquivo?: Blob | File | null; arquivo_token?: Blob | File | null; url?: string | null; remover?: boolean },
        ) => {
            if (dados.arquivo) {
                const f = new FormData();
                const nomeFicha =
                    dados.arquivo instanceof File ? dados.arquivo.name : dados.arquivo.type === 'image/webp' ? 'ficha.webp' : 'ficha.jpg';
                f.append('arquivo', dados.arquivo, nomeFicha);
                if (dados.arquivo_token) {
                    const nomeToken =
                        dados.arquivo_token instanceof File
                            ? dados.arquivo_token.name
                            : dados.arquivo_token.type === 'image/webp'
                              ? 'token.webp'
                              : 'token.jpg';
                    f.append('arquivo_token', dados.arquivo_token, nomeToken);
                }
                return requisitar<{ ok: boolean; foto: string | null; foto_token?: string | null; personagem?: Personagem }>(
                    atorId,
                    'POST',
                    r('jogo.personagens.foto', personagemId),
                    f,
                );
            }
            return requisitar<{ ok: boolean; foto: string | null; foto_token?: string | null; personagem?: Personagem }>(
                atorId,
                'POST',
                r('jogo.personagens.foto', personagemId),
                {
                    url: dados.url ?? null,
                    remover: dados.remover ? true : false,
                },
            );
        },
        // Diário (só o mestre): pastas, folhetos e a pasta de cada personagem.
        criarPastaDoDiario: (nome: string, paiId: number | null = null) =>
            requisitar<DiarioPastaDto>(atorId, 'POST', r('jogo.diario.pastas.store'), { nome, pai_id: paiId }),
        atualizarPastaDoDiario: (id: number, campos: { nome?: string; pai_id?: number | null }) =>
            requisitar<DiarioPastaDto>(atorId, 'PATCH', r('jogo.diario.pastas.update', id), campos),
        excluirPastaDoDiario: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.diario.pastas.destroy', id)),
        criarFolheto: (dados: FormData) => requisitar<FolhetoDto>(atorId, 'POST', r('jogo.diario.folhetos.store'), dados),
        atualizarFolheto: (id: number, campos: { nome?: string; texto?: string | null; visivel?: boolean; pasta_id?: number | null }) =>
            requisitar<FolhetoDto>(atorId, 'PATCH', r('jogo.diario.folhetos.update', id), campos),
        excluirFolheto: (id: number) => requisitar<{ ok: true }>(atorId, 'DELETE', r('jogo.diario.folhetos.destroy', id)),
        /** Libera o folheto e o abre na tela de todos. */
        mostrarFolheto: (id: number) => requisitar<FolhetoDto>(atorId, 'POST', r('jogo.diario.folhetos.mostrar', id)),
        moverPersonagem: (id: number, pastaId: number | null) =>
            requisitar<{ ok: true }>(atorId, 'PATCH', r('jogo.personagens.pasta', id), { pasta_id: pastaId }),
        /** Só o mestre: guarda um NPC (do catálogo ou em branco) com a ficha já montada pelo módulo do sistema. */
        criarNpc: (nome: string, campos: Record<string, unknown>) => requisitar<Personagem>(atorId, 'POST', r('jogo.npcs.store'), { nome, campos }),
        /** Só o mestre: cria um navio de um modelo do livro (`modelo`) ou em branco (`tamanho` + `madeira`). */
        criarNavio: (dados: { nome: string; modelo?: string | null; tamanho?: string; madeira?: string }) =>
            requisitar<Personagem>(atorId, 'POST', r('jogo.navios.store'), dados),
        /** Ação na ficha do navio (obras, tesouro, carga, tripulação, PV): devolve os campos do navio e os do personagem que mudou junto. */
        acaoDoNavio: (navioId: number, acao: string, dados: Record<string, unknown> = {}) =>
            requisitar<{
                personagem_id: number;
                campos: Record<string, unknown>;
                outro: { personagem_id: number; campos: Record<string, unknown> } | null;
            }>(atorId, 'POST', r('jogo.navios.acao', navioId), { acao, ...dados }),
        /** Só o mestre: a cópia do NPC que vira o token no mapa (PV, PP e usos próprios, nome numerado). */
        instanciarNpc: (personagemId: number) => requisitar<Personagem>(atorId, 'POST', r('jogo.personagens.instanciar', personagemId)),
        atribuirJogadores: (personagemId: number, jogadores: number[]) =>
            requisitar<object>(atorId, 'PUT', r('jogo.personagens.atribuir', personagemId), { jogadores }),
        enviarTexto: (texto: string, personagemId: number | null) =>
            requisitar<Mensagem>(atorId, 'POST', r('jogo.mensagens.store'), { texto, personagem_id: personagemId }),
        rolar: (
            expressao: string,
            visibilidade: VisibilidadeRolagem,
            personagemId: number | null,
            rotulo?: string,
            dano?: { tipo: string | null; fator?: number; fonte?: string },
            acao?: { categoria: string; tecnica?: boolean },
            alvoPersonagemId?: number | null,
            tecnica?: {
                nome: string;
                dano?: { expressao: string; tipo: string | null; extras?: { expressao: string; tipo: string | null }[] } | null;
                secundaria?: object | null;
                /** Só o mestre (ataque de arma de NPC): não conta como Técnica e traz a margem de crítico própria. */
                semTecnica?: boolean;
                margem?: number;
                /** Só o mestre: a rolagem (de bônus próprio, sem `@ataque`) é um ataque: rola contra a defesa do alvo. */
                ataque?: boolean;
            },
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
                              ...(tecnica.semTecnica ? { semTecnica: true } : {}),
                              ...(tecnica.margem ? { margem: tecnica.margem } : {}),
                              ...(tecnica.ataque ? { ataque: true } : {}),
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
            dano?: { expressao: string; tipo: string | null; extras?: { expressao: string; tipo: string | null }[] } | null;
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
            requisitar<{ evento: ResumoEvento; combate: Combate }>(atorId, 'POST', r('jogo.combate.eventos.reagir', eventoId), {
                personagem_id: personagemId,
                opcao,
            }),
        /** O mestre fecha a janela de reação: quem não respondeu conta como "passou". */
        encerrarJanela: (eventoId: number) =>
            requisitar<{ evento: ResumoEvento; combate: Combate }>(atorId, 'POST', r('jogo.combate.eventos.encerrar', eventoId), {}),
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
        /** Dano Brutal (One Piece): pedir para o jogador rolar, rolar Salvaguarda de CON CD 16, aplicar ou ignorar. */
        danoBrutalPedir: (mensagemId: number) => requisitar<Mensagem>(atorId, 'POST', r('jogo.dano-brutal.pedir', mensagemId), {}),
        danoBrutalRolar: (mensagemId: number) => requisitar<Mensagem>(atorId, 'POST', r('jogo.dano-brutal.rolar', mensagemId), {}),
        danoBrutalAplicar: (mensagemId: number) => requisitar<Mensagem>(atorId, 'POST', r('jogo.dano-brutal.aplicar', mensagemId), {}),
        danoBrutalIgnorar: (mensagemId: number) => requisitar<Mensagem>(atorId, 'POST', r('jogo.dano-brutal.ignorar', mensagemId), {}),
        /** Trata a ferida brutal restaurando os PV máximos reduzidos. */
        tratarDanoBrutal: (personagemId: number, quantidade?: number) =>
            requisitar<{ ok: boolean }>(atorId, 'POST', r('jogo.personagens.tratar-brutal', personagemId), {
                ...(quantidade ? { quantidade } : {}),
            }),
        /** Só o mestre: liga ou desliga o fogo amigo da mesa. */
        /** Só o mestre: libera (ou trava) descansos e subir de nível para os jogadores. */
        liberacoes: (campos: { descanso_curto?: boolean; descanso_longo?: boolean; subir_nivel?: boolean }) =>
            requisitar<{ descanso_curto: boolean; descanso_longo: boolean; subir_nivel: boolean }>(atorId, 'PATCH', r('jogo.liberacoes'), campos),
        /** Só o mestre: divide o XP em partes iguais entre os personagens (o que sobra da divisão não é distribuído). */
        distribuirXp: (personagens: number[], total: number) =>
            requisitar<{ por_cabeca: number; sobra: number; personagens: string[] }>(atorId, 'POST', r('jogo.xp.distribuir'), { personagens, total }),
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
        atualizarMusica: (dados: { tocando?: object | null; playlist?: object[] }) =>
            requisitar<{ musica: { tocando?: object | null; playlist?: object[] } }>(atorId, 'PATCH', r('jogo.musica.atualizar'), dados),
        atualizarTempo: (tempo: { dia: number; hora: number; minuto: number }) =>
            requisitar<{ tempo: { dia: number; hora: number; minuto: number } }>(atorId, 'PATCH', r('jogo.tempo.atualizar'), tempo),
        enviarPing: (dados: { pagina_id: number; x: number; y: number; puxar?: boolean }) =>
            requisitar<{ ok: true }>(atorId, 'POST', r('jogo.ping'), dados),
        mirar: (dados: { objeto_id: number | null; pagina_id?: number | null }) => requisitar<{ ok: true }>(atorId, 'POST', r('jogo.mirar'), dados),
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
