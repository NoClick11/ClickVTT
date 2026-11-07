<script setup lang="ts">
import type { Criacao, Jogador, Personagem } from '@/site/types';
import { Head, router } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { apiMesa, ErroApi, medirArquivo } from '../api';
import AtribuirJogadoresDialog from '../components/AtribuirJogadoresDialog.vue';
import BarraFerramentas from '../components/BarraFerramentas.vue';
import BarraLateral, { type AbaLateral } from '../components/BarraLateral.vue';
import BarraSuperior from '../components/BarraSuperior.vue';
import BarraTurnos from '../components/BarraTurnos.vue';
import CenaCanvas from '../components/CenaCanvas.vue';
import JanelaDeReacao from '../components/combate/JanelaDeReacao.vue';
import ModalIniciativa from '../components/combate/ModalIniciativa.vue';
import ModalReacao from '../components/combate/ModalReacao.vue';
import PainelDoTurno from '../components/combate/PainelDoTurno.vue';
import ConfigPaginaDialog from '../components/ConfigPaginaDialog.vue';
import ControlesZoom from '../components/ControlesZoom.vue';
import DadosAnimacao from '../components/DadosAnimacao.vue';
import ExcluirPersonagemDialog from '../components/ExcluirPersonagemDialog.vue';
import Inspetor from '../components/Inspetor.vue';
import MenuObjeto from '../components/MenuObjeto.vue';
import MenuPaginas from '../components/MenuPaginas.vue';
import MenuPersonagem from '../components/MenuPersonagem.vue';
import NovoPersonagemDialog from '../components/NovoPersonagemDialog.vue';
import OpcoesFerramenta from '../components/OpcoesFerramenta.vue';
import PainelAlvo from '../components/PainelAlvo.vue';
import PainelChat from '../components/PainelChat.vue';
import PainelDados from '../components/PainelDados.vue';
import PainelPersonagens from '../components/PainelPersonagens.vue';
import PainelTurnos from '../components/PainelTurnos.vue';
import SeletorCamada from '../components/SeletorCamada.vue';
import {
    CAMADAS,
    type Camada,
    type CamposGeometria,
    type EstiloPintura,
    type Ferramenta,
    type ObjetoDto,
    type PaginaDto,
    type TipoParede,
} from '../engine/tipos';
import { avaliarAcao, avaliarAtaque, type CategoriaAcao } from '../nucleo/combate/acoes';
import type { AreaDeEfeito } from '../nucleo/combate/area';
import { podeAtingir } from '../nucleo/combate/equipes';
import { emCurso, itemAtual, normalizar as normalizarCombate, podeAgirAgora, rodadaParaFicha, semIniciativaDe } from '../nucleo/combate/estado';
import { totalDoTurno } from '../nucleo/combate/movimento';
import { comResumo, semOfertasDe, type OfertaDeReacao, type ResumoEvento } from '../nucleo/combate/reacoes';
import { definirCaminho } from '../nucleo/ficha/caminho';
import { arrastandoDaLoja, arrastandoItem, arrastandoPersonagem, itemDaLojaSolto, itemSolto, personagemSolto } from '../nucleo/itens/arrastar';
import EditorItemDialog from '../nucleo/itens/EditorItemDialog.vue';
import PainelItens from '../nucleo/itens/PainelItens.vue';
import type { AcaoDaRolagem } from '../nucleo/rolagem';
import FichaNaoImplementada from '../nucleo/sistemas/FichaNaoImplementada.vue';
import FichaPrivada from '../nucleo/sistemas/FichaPrivada.vue';
import { moduloDoSistema } from '../nucleo/sistemas/registro';
import type { AbrirEditorItem } from '../nucleo/sistemas/tipos';
import JanelaFlutuante from '../nucleo/ui/JanelaFlutuante.vue';
import { conectar, type Conexao } from '../realtime';
import type { UsoDeTecnica } from '../sistemas/onepiece/contexto';
import type { AcaoCaracteristica } from '../sistemas/onepiece/regras';
import type {
    Combate,
    ItemDeCatalogoDto,
    ItemDto,
    LojaAbertaDto,
    LojaDoJogadorDto,
    Mensagem,
    NovoItem,
    NovoItemDeCatalogo,
    VisibilidadeRolagem,
} from '../tipos-mesa';

interface Pasta {
    id: number;
    nome: string;
    ordem: number;
}
const props = defineProps<{
    mesa: { id: number; slug: string; nome: string; capa: string | null; fogo_amigo?: boolean };
    /** Sistema da mesa: o módulo (ficha, regras) é resolvido pelo slug. */
    sistema: { slug: string; nome: string; modulo: boolean };
    jogador: Jogador;
    mestre: boolean;
    pagina: PaginaDto | null;
    objetos: ObjetoDto[];
    paginas: PaginaDto[];
    pastas: Pasta[];
    jogadores: Jogador[];
    personagens: Personagem[];
    /** ids dos personagens que ESTE jogador controla (o mestre controla todos) */
    meusPersonagens: number[];
    /** Itens da mesa: o mestre recebe todos; o jogador, só os das fichas que controla. */
    itens: ItemDto[];
    /** Loja: o mestre recebe as lojas abertas e os itens que criou; o jogador, a loja aberta para ele (ou null). */
    lojasAbertas?: LojaAbertaDto[];
    catalogoDoMestre?: ItemDeCatalogoDto[];
    lojaDoJogador?: LojaDoJogadorDto | null;
    combate: Combate;
    /** Categorias de ação do sistema da mesa (padrão, poderosa, bônus, livre, reação...). */
    categoriasDeAcao?: CategoriaAcao[];
    /** Janelas de reação abertas e as ofertas dos personagens que este jogador controla. */
    reacoes?: { eventos: ResumoEvento[]; ofertas: OfertaDeReacao[] };
    mensagens: Mensagem[];
    sairUrl: string;
}>();

const api = apiMesa(props.mesa.id, props.jogador.id);
const urlJogo = () => route('jogo', [props.mesa.slug, props.jogador.id]);
const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Camada padrão = Jogadores (só o mestre troca). Estado local da tela:
const objetos = ref<ObjetoDto[]>(copia(props.objetos));
const camada = ref<Camada>('jogadores');
const ferramenta = ref<Ferramenta>('selecionar');
const selecionadoId = ref<number | null>(null);
/** A seleção inteira do mapa (um ou vários objetos: laço, Shift+clique, Ctrl+A). */
const selecionadosIds = ref<number[]>([]);
const escala = ref(1);
const erro = ref<string | null>(null);
const canvas = ref<InstanceType<typeof CenaCanvas> | null>(null);

const menuAberto = ref(false);
const configAberta = ref(false);
const configPagina = ref<PaginaDto | null>(null);
const configErro = ref<string | undefined>();
const painelDados = ref(false);
const painelTurnos = ref(false);
const estilo = ref<EstiloPintura>({ cor: '#ef4444', espessura: 4, tamanho: 28 });
const mensagens = ref<Mensagem[]>(copia(props.mensagens));
const combate = ref<Combate>(normalizarCombate(copia(props.combate)));
const textoPendente = ref<{ x: number; y: number; tela: { x: number; y: number }; valor: string } | null>(null);

// Animação dos dados: ligada por padrão (exceto para quem pede movimento reduzido); preferência salva no navegador.
function lerPreferencia(): boolean {
    try {
        const v = localStorage.getItem('clickvtt.animacaoDados');
        if (v !== null) return v === '1';
    } catch {
        /* armazenamento indisponível */
    }

    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
const animacao = ref(lerPreferencia());
watch(animacao, (v) => {
    try {
        localStorage.setItem('clickvtt.animacaoDados', v ? '1' : '0');
    } catch {
        /* ignora */
    }
});
// Só a rolagem MAIS RECENTE é animada: uma nova rolagem substitui a animação em curso (sem fila).
const animacaoAtual = ref<Mensagem | null>(null);

// Barra lateral à direita, com abas no topo (Chat, Personagens). Aba ativa e aberta/recolhida ficam salvas.
function lerLocal(chave: string, padrao: string): string {
    try {
        return localStorage.getItem(chave) ?? padrao;
    } catch {
        return padrao;
    }
}
function gravarLocal(chave: string, valor: string) {
    try {
        localStorage.setItem(chave, valor);
    } catch {
        /* ignora */
    }
}
const abaLateral = ref<AbaLateral>(abaSalva());
const lateralAberta = ref(lerLocal('clickvtt.lateralAberta', '1') !== '0');
const naoLidas = ref(0);
// A aba Itens é só do mestre: a de um jogador nunca cai nela.
function abaSalva(): AbaLateral {
    const salva = lerLocal('clickvtt.abaLateral', 'chat');

    return salva === 'personagens' || (salva === 'itens' && props.mestre) ? salva : 'chat';
}
watch(abaLateral, (v) => gravarLocal('clickvtt.abaLateral', v));
watch(lateralAberta, (v) => gravarLocal('clickvtt.lateralAberta', v ? '1' : '0'));
// Mensagens que chegam com o chat fora de vista contam como não lidas.
watch([abaLateral, lateralAberta], () => {
    if (lateralAberta.value && abaLateral.value === 'chat') naoLidas.value = 0;
});
const larguraTela = ref(window.innerWidth);
const larguraPainel = computed(() => (lateralAberta.value ? Math.min(320, larguraTela.value * 0.85) : 0));
/** Faixa coberta pela barra lateral: o mapa e seus controles recuam esse tanto. */
const margemDireita = computed(() => larguraPainel.value);
const aoRedimensionar = () => (larguraTela.value = window.innerWidth);
onMounted(() => window.addEventListener('resize', aoRedimensionar));
onBeforeUnmount(() => window.removeEventListener('resize', aoRedimensionar));

// Personagens: quem tem token na página aberta e (mestre) em que página cada um está.
const comToken = computed(() => objetos.value.filter((o) => o.tipo === 'token' && o.personagem_id !== null).map((o) => o.personagem_id as number));
const paginaDe = computed(() => {
    const m: Record<number, PaginaDto | undefined> = {};
    for (const p of props.jogadores) m[p.id] = props.paginas.find((x) => x.id === (p.pagina_id ?? props.paginas[0]?.id));

    return m;
});
function focarPersonagem(personagemId: number) {
    const token = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === personagemId);
    if (token) canvas.value?.focar(token.id, props.mestre && camada.value === 'jogadores');
}

watch(
    () => props.objetos,
    (novos) => (objetos.value = copia(novos)),
);

/** Ações do combate para as fichas: o botão liga ou desliga pela categoria e gastar avisa o servidor (que recusa se não pode). */
const categoriasAcao = computed(() => props.categoriasDeAcao ?? []);
async function gastarAcaoDoCombate(personagemId: number, categoria: string | undefined, tecnica = false): Promise<boolean> {
    if (!categoria || !emCurso(combate.value)) return true;
    try {
        combate.value = normalizarCombate((await api.gastarAcao(personagemId, categoria, tecnica)).combate);

        return true;
    } catch (e) {
        avisar(mensagemDe(e));

        return false;
    }
}
provide('acoesDoCombate', {
    categorias: categoriasAcao,
    pode: (personagemId: number, categoria: string | undefined, tecnica = false) =>
        avaliarAcao(combate.value, categoriasAcao.value, personagemId, categoria, props.mestre, tecnica),
    /** Gasta a ação no servidor; false (com aviso do motivo) se não pôde. Fora do combate em curso não faz nada e libera. */
    gastar: (personagemId: number, categoria: string | undefined, tecnica = false) => gastarAcaoDoCombate(personagemId, categoria, tecnica),
    /** Ataque com arma: o 1º gasta a Ação, os seguintes valem até o limite de ataques (por Ação + extras do turno). */
    ataque: (personagemId: number, ataquesPorAcao: number) =>
        avaliarAtaque(combate.value, categoriasAcao.value, personagemId, props.mestre, ataquesPorAcao),
    /** As Técnicas ativas do personagem (Quick Draw...) e como encerrar uma. */
    ativas: (personagemId: number) => combate.value.ativas.filter((a) => a.personagem_id === personagemId),
    moverVigia: (personagemId: number, id: string) => void moverVigia(personagemId, id),
    encerrarAtiva: async (id: string) => {
        try {
            combate.value = normalizarCombate((await api.encerrarTecnicaAtiva(id)).combate);
        } catch (e) {
            avisar(mensagemDe(e));
        }
    },
    /** Ataques extras do turno: só com o combate em curso. */
    darExtras: async (personagemId: number, n: number) => {
        try {
            combate.value = normalizarCombate((await api.ataquesExtras(personagemId, n)).combate);
        } catch (e) {
            avisar(mensagemDe(e));
        }
    },
});

/** Em combate, só o token de quem está no turno se move (o servidor também recusa); o mestre controla todos. */
const personagensQuePodemMover = computed(() => props.meusPersonagens.filter((id) => podeAgirAgora(combate.value, id, props.mestre)));

/** O token do turno e o deslocamento que lhe resta: a régua do arrasto mostra o gasto e, para o jogador, trava no limite. */
const movimentoDaCena = computed(() => {
    const item = emCurso(combate.value) ? itemAtual(combate.value) : null;
    const total = item ? totalDoTurno(item) : null;
    if (!item || total === null) return null;
    const token = objetos.value.find(
        (o) => o.tipo === 'token' && (o.id === item.objeto_id || (item.personagem_id !== null && o.personagem_id === item.personagem_id)),
    );

    return token ? { objetoId: token.id, usado: item.movimento.usado, total, limitar: !props.mestre } : null;
});
async function dispararDoTurno(personagemId: number) {
    try {
        combate.value = normalizarCombate((await api.disparada(personagemId)).combate);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// --- reações ao ataque ----------------------------------------------------------------------------------------------
// O servidor abre a janela quando alguém ataca um alvo no combate em curso: cada jogador com uma reação que serve recebe
// o modal (privado) e todos veem quem ainda não respondeu. O resultado volta no card do ataque (acerta ou erra).
const ofertasDeReacao = ref<OfertaDeReacao[]>(copia(props.reacoes?.ofertas ?? []));
const janelasDeReacao = ref<ResumoEvento[]>(copia(props.reacoes?.eventos ?? []));
const reagindo = ref(false);
async function reagir(eventoId: number, personagemId: number, opcao: string | null) {
    reagindo.value = true;
    try {
        await api.reagir(eventoId, personagemId, opcao);
        ofertasDeReacao.value = semOfertasDe(ofertasDeReacao.value, eventoId, personagemId);
    } catch (e) {
        avisar(mensagemDe(e));
        ofertasDeReacao.value = semOfertasDe(ofertasDeReacao.value, eventoId, personagemId); // a janela fechou ou já respondi: não prende o modal
    } finally {
        reagindo.value = false;
    }
}
async function encerrarJanela(eventoId: number) {
    try {
        await api.encerrarJanela(eventoId);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
/** O alvo do ataque que a ficha manda junto da rolagem: só com o combate em curso e um alvo mirado. */
const alvoDoAtaque = computed(() => (emCurso(combate.value) ? (alvoPersonagem.value?.id ?? null) : null));
provide('alvoDoAtaque', alvoDoAtaque);

// --- alvo (mira) -----------------------------------------------------------------------------------------------
// Cada jogador mira o seu alvo (só local): botão Mirar ou tecla T + clique num token de personagem. O alvo fica travado
// até ser trocado ou limpo e recebe o dano aplicado pelo chat e os efeitos do painel.
const alvoObjetoId = ref<number | null>(null);
/** A mira foi posta por uma Técnica (o mais perto da área): o painel de aplicar efeito não abre, a Técnica já traz o efeito, a CD e a duração. */
const miraDaTecnica = ref(false);
function miraManual(id: number | null) {
    miraDaTecnica.value = false;
    alvoObjetoId.value = id;
}
const alvoObjeto = computed(() => objetos.value.find((o) => o.id === alvoObjetoId.value && o.tipo === 'token') ?? null);
const alvoPersonagem = computed(() => props.personagens.find((p) => p.id === alvoObjeto.value?.personagem_id) ?? null);
watch(alvoObjeto, (o) => {
    if (alvoObjetoId.value !== null && !o) alvoObjetoId.value = null; // o token saiu da cena
});
const aplicadosLocais = ref<Set<string>>(new Set());
/** Ids das rolagens de dano já aplicadas ao alvo atual (o botão do chat fica desligado). */
const aplicadosAoAlvo = computed(() => {
    const alvo = alvoPersonagem.value?.id;
    if (alvo === undefined) return [];
    const deste = [...aplicadosLocais.value].filter((k) => k.endsWith(`:${alvo}`)).map((k) => k.split(':')[0]);
    const doServidor = mensagens.value.filter((m) => (m.dados as { aplicado?: number[] } | null)?.aplicado?.includes(alvo)).map((m) => String(m.id));

    return [...deste, ...doServidor];
});
const alvoOcupado = ref(false);
async function aplicarDanoDoChat(mensagem: Mensagem) {
    const alvo = alvoPersonagem.value;
    if (!alvo) return avisar('Mire um token de personagem para aplicar o dano.');
    try {
        await api.aplicarDano(alvo.id, mensagem.id); // o servidor desconta os PV e avisa a mesa no chat
        aplicadosLocais.value = new Set([...aplicadosLocais.value, `${mensagem.id}:${alvo.id}`]);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
async function condicaoDoAlvo(
    dados: { condicao: string; acao: 'aplicar' | 'remover'; turnos?: string; ao_dano?: boolean; salvaguarda?: { atributo: string; cd: number } },
    personagemId: number | null = null,
) {
    const alvo = personagemId !== null ? { id: personagemId } : alvoPersonagem.value;
    if (!alvo) return avisar('Mire um token de personagem primeiro.');
    alvoOcupado.value = true;
    try {
        await api.aplicarCondicao(alvo.id, dados);
    } catch (e) {
        avisar(mensagemDe(e));
    } finally {
        alvoOcupado.value = false;
    }
}

/** Rodada do combate para as fichas (limites de um uso por rodada); null = sem combate ativo. */
provide(
    'rodadaDoCombate',
    computed(() => rodadaParaFicha(combate.value)),
);
/** Botão de uma característica: aplicar condição (a si ou ao alvo mirado) ou hospedar-se no alvo. */
async function executarAcao(personagemId: number, acao: AcaoCaracteristica) {
    if (acao.tipo === 'hospedar') {
        const alvo = alvoPersonagem.value;
        const atual = (fichas.value[personagemId]?.hospedado as number | null) ?? null;
        if (atual !== null) return salvarFicha(personagemId, { hospedado: null }); // sair do espaço
        if (!alvo) return avisar('Mire um token de personagem para se hospedar nele.');
        if (alvo.id === personagemId) return avisar('Escolha outro personagem como hospedeiro.');
        return salvarFicha(personagemId, { hospedado: alvo.id });
    }
    if (acao.tipo === 'deslocar') {
        try {
            combate.value = normalizarCombate((await api.deslocamento(personagemId, acao.fator ?? 1)).combate);
        } catch (e) {
            avisar(mensagemDe(e));
        }
        return;
    }
    if (acao.tipo === 'socorrer') {
        const alvo = alvoPersonagem.value;
        if (!alvo) return avisar('Mire a criatura que vai receber os Primeiros Socorros.');
        try {
            await api.socorros(alvo.id, personagemId, !!acao.soCondicoes);
        } catch (e) {
            avisar(mensagemDe(e));
        }
        return;
    }
    if (acao.tipo !== 'condicao' || !acao.condicao) return;
    await condicaoDoAlvo(
        {
            condicao: acao.condicao,
            acao: 'aplicar',
            ...(acao.turnos ? { turnos: acao.turnos } : {}),
            ao_dano: !!acao.aoDano,
            ...(acao.cd && acao.atributo ? { salvaguarda: { atributo: acao.atributo, cd: acao.cd } } : {}),
        },
        acao.alvo === 'proprio' ? personagemId : null,
    );
}

// Efeitos ativos de cada personagem (ícones no token). Vêm públicos do servidor e mudam ao vivo (evento `status`).
const statusPorPersonagem = ref<Record<number, string[]>>({});
/** Põe `alvo` igual a `novo` mexendo só no que mudou (quem não mudou mantém a identidade: nada é redesenhado à toa). */
function sincronizarPorId<T>(alvo: Record<number, T>, novo: Record<number, T>) {
    for (const id of Object.keys(alvo)) if (!(id in novo)) delete alvo[Number(id)];
    for (const [id, valor] of Object.entries(novo)) {
        if (!(id in alvo) || JSON.stringify(alvo[Number(id)]) !== JSON.stringify(valor)) alvo[Number(id)] = valor;
    }
}
function sincronizarStatus() {
    sincronizarPorId(statusPorPersonagem.value, Object.fromEntries(props.personagens.map((p) => [p.id, [...(p.status ?? [])]])));
}
sincronizarStatus();
watch(() => props.personagens, sincronizarStatus, { deep: true });
/** Os tokens que o mapa desenha, cada um com os efeitos do seu personagem. */
const objetosDaCena = computed(() =>
    objetos.value.map((o) => {
        if (o.tipo !== 'token' || o.personagem_id === null) return o;
        // vida, CA e PP sobre o token: só das fichas que este jogador recebe (as dele; o mestre recebe todas), então ninguém vê a vida alheia
        const ficha = fichas.value[o.personagem_id];
        const barras = ficha ? (moduloSistema?.resumoDoToken?.(ficha, itensPorIdDaMesa.value) ?? []) : [];

        return { ...o, status: statusPorPersonagem.value[o.personagem_id] ?? [], barras };
    }),
);
watch(
    () => props.combate,
    (c) => (combate.value = normalizarCombate(copia(c))),
);

const selecionado = computed(() => objetos.value.find((o) => o.id === selecionadoId.value) ?? null);

// --- utilidades ----------------------------------------------------------------

let temporizadorErro: ReturnType<typeof setTimeout> | undefined;
function avisar(mensagem: string) {
    erro.value = mensagem;
    clearTimeout(temporizadorErro);
    temporizadorErro = setTimeout(() => (erro.value = null), 5000);
}
function mensagemDe(e: unknown): string {
    return e instanceof ErroApi || e instanceof Error ? e.message : 'Algo deu errado.';
}
/** Falhou ao salvar: avisa e volta ao estado do servidor. */
function falhou(e: unknown) {
    avisar(mensagemDe(e));
    recarregar(['objetos']);
}
/**
 * Recarrega só as props pedidas, em segundo plano: sem a barra de progresso do Inertia no topo (que parece recarregar a página), sem cancelar outra
 * recarga em andamento e mantendo estado e rolagem. Todas as recargas da mesa passam por aqui.
 */
const recarregar = (only: string[], extra: { onSuccess?: () => void } = {}) =>
    router.reload({ only, showProgress: false, async: true, preserveState: true, preserveScroll: true, ...extra });

// --- objetos -------------------------------------------------------------------

function aoAlterar(id: number, campos: CamposGeometria, final: boolean) {
    const o = objetos.value.find((x) => x.id === id);
    if (!o) return;
    Object.assign(o, campos);
    if (final) api.atualizarObjeto(id, campos).catch(falhou);
}

function atualizarSelecionado(campos: Partial<ObjetoDto>) {
    const o = selecionado.value;
    if (!o) return;
    const { dados, ...resto } = campos;
    Object.assign(o, resto);
    if (dados) o.dados = { ...o.dados, ...dados }; // o servidor também mescla: pontos/tipo nunca se perdem
    api.atualizarObjeto(o.id, campos).catch(falhou);
}

/** Pode apagar este objeto? Mestre, tudo; jogador, só o que ele mesmo desenhou ou escreveu. */
const podeApagar = (o: ObjetoDto) => props.mestre || (['traco', 'texto'].includes(o.tipo) && o.jogador_id === props.jogador.id);

function removerSelecionado() {
    // Apaga a seleção inteira (um ou vários): o que a pessoa não pode apagar fica
    const ids = new Set(selecionadosIds.value.length ? selecionadosIds.value : selecionadoId.value ? [selecionadoId.value] : []);
    const alvos = objetos.value.filter((o) => ids.has(o.id) && podeApagar(o));
    if (!alvos.length) return;
    objetos.value = objetos.value.filter((x) => !alvos.some((o) => o.id === x.id));
    selecionadoId.value = null;
    selecionadosIds.value = [];
    for (const o of alvos) api.removerObjeto(o.id).catch(falhou);
}

function centroEmQuadrados(): { x: number; y: number; t: number } {
    const t = props.pagina!.tamanho_quadrado;
    const c = canvas.value?.centro() ?? { x: 0, y: 0 };

    return { x: Math.floor(c.x / t) * t, y: Math.floor(c.y / t) * t, t };
}

// Botão direito sobre um objeto: menu para movê-lo entre camadas (só o mestre).
const menuObjeto = ref<{ id: number; x: number; y: number } | null>(null);
const abrirMenuObjeto = (id: number, tela: { x: number; y: number }) => (menuObjeto.value = { id, ...tela });
const objetoDoMenu = computed(() => objetos.value.find((o) => o.id === menuObjeto.value?.id) ?? null);
function moverParaCamada(nova: Camada) {
    const o = objetoDoMenu.value;
    menuObjeto.value = null;
    if (!o || o.camada === nova) return;
    o.camada = nova;
    api.atualizarObjeto(o.id, { camada: nova }).catch(falhou);
    const nome = CAMADAS.find((c) => c.id === nova)?.nome;
    avisar(`${o.nome || 'Objeto'} movido para a camada ${nome}.`);
}

/** Camada onde cai o que o mestre arrasta para o mapa: a que está aberta (a iluminação só aceita luzes e paredes). */
const camadaDeDestino = (): Camada => (camada.value === 'iluminacao' ? 'jogadores' : camada.value);

/** Imagem, GIF ou vídeo arrastado do computador para o mapa: vira o mapa da página (como no Roll20 e no Foundry). */
async function enviarMapa(arquivo: File | undefined) {
    if (!arquivo || !props.pagina) return;
    try {
        const { largura, altura } = await medirArquivo(arquivo);
        const larguraPagina = props.pagina.colunas * props.pagina.tamanho_quadrado;
        const dados = new FormData();
        dados.append('camada', camadaDeDestino());
        dados.append('tipo', 'imagem');
        dados.append('nome', arquivo.name.replace(/\.[^.]+$/, ''));
        dados.append('x', '0');
        dados.append('y', '0');
        dados.append('largura', String(larguraPagina));
        dados.append('altura', String(Math.round((larguraPagina * altura) / largura)));
        dados.append('arquivo', arquivo);
        objetos.value.push(await api.criarObjeto(props.pagina.id, dados));
        avisar(`Imagem adicionada na camada ${CAMADAS.find((c) => c.id === camadaDeDestino())?.nome}. Botão direito nela para trocar de camada.`);
    } catch (err) {
        avisar(mensagemDe(err));
    }
}

async function criarToken(
    d: { nome: string; personagem_id: number | null; cor: string; tamanho: number; arquivo: File | null },
    ponto?: { x: number; y: number },
) {
    if (!props.pagina) return;
    const centro = centroEmQuadrados();
    const t = centro.t;
    // Solto no mapa: o token cai no quadrado sob o cursor; senão, no centro da vista.
    const x = ponto ? Math.floor(ponto.x / t) * t : centro.x;
    const y = ponto ? Math.floor(ponto.y / t) * t : centro.y;
    const lado = d.tamanho * t;
    const alvoCamada: Camada = camadaDeDestino();
    const base = { camada: alvoCamada, tipo: 'token', nome: d.nome, x, y, largura: lado, altura: lado };
    try {
        let corpo: object | FormData;
        if (d.arquivo || d.personagem_id) {
            const f = new FormData();
            Object.entries(base).forEach(([k, v]) => f.append(k, String(v)));
            if (d.personagem_id) f.append('personagem_id', String(d.personagem_id));
            f.append('dados[cor]', d.cor);
            if (d.arquivo) f.append('arquivo', d.arquivo);
            corpo = f;
        } else {
            corpo = { ...base, dados: { cor: d.cor } };
        }
        objetos.value.push(await api.criarObjeto(props.pagina.id, corpo));
    } catch (err) {
        avisar(mensagemDe(err));
    }
}

/** Personagem arrastado do painel para o mapa: cria o token dele onde soltou (um token por personagem na página). */
const arrastandoArquivo = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
function personagemSobreMapa(e: DragEvent) {
    if (!props.mestre || !props.pagina || !(arrastandoPersonagem(e) || arrastandoArquivo(e))) return;
    e.preventDefault(); // sem isto o navegador não deixa soltar
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}
async function soltarNoMapa(e: DragEvent) {
    if (!props.mestre || !props.pagina) return;
    if (arrastandoArquivo(e)) {
        e.preventDefault();

        return enviarMapa(e.dataTransfer?.files[0]);
    }
    if (!arrastandoPersonagem(e)) return;
    e.preventDefault();
    const p = props.personagens.find((x) => x.id === personagemSolto(e));
    if (!p) return;
    if (comToken.value.includes(p.id)) {
        focarPersonagem(p.id);

        return avisar(`${p.nome} já tem token nesta página.`);
    }
    await criarToken({ nome: p.nome, personagem_id: p.id, cor: p.cor, tamanho: 1, arquivo: null }, canvas.value?.pontoDoMundo(e.clientX, e.clientY));
}

// --- páginas e menu ----------------------------------------------------------------

function abrirPagina(id: number) {
    menuAberto.value = false;
    if (id === props.pagina?.id) return;
    selecionadoId.value = null;
    router.visit(`${urlJogo()}?pagina=${id}`, { preserveState: true, preserveScroll: true, only: ['pagina', 'objetos'] });
}

const acao = (fn: () => Promise<unknown>, recarga: string[]) => () =>
    fn()
        .then(() => recarregar(recarga))
        .catch((e) => avisar(mensagemDe(e)));

async function novaPagina(pastaId: number | null) {
    try {
        const criada = await api.criarPagina({ nome: 'Nova página', pasta_id: pastaId });
        recarregar(['paginas']);
        configErro.value = undefined;
        configPagina.value = criada;
        configAberta.value = true;
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

function configurar(id: number) {
    configPagina.value = props.paginas.find((p) => p.id === id) ?? props.pagina;
    configErro.value = undefined;
    configAberta.value = true;
}

async function salvarConfig(id: number, campos: Partial<PaginaDto>) {
    try {
        await api.atualizarPagina(id, campos);
        configAberta.value = false;
        recarregar(['paginas', 'pagina']);
    } catch (e) {
        configErro.value = mensagemDe(e);
    }
}

async function excluirPagina(id: number) {
    try {
        await api.removerPagina(id);
        if (id === props.pagina?.id) router.visit(urlJogo());
        else recarregar(['paginas', 'personagens']);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function reordenar(id: number, direcao: -1 | 1) {
    const atual = props.paginas.find((p) => p.id === id);
    if (!atual) return;
    const irmas = props.paginas.filter((p) => p.pasta_id === atual.pasta_id).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
    const i = irmas.findIndex((p) => p.id === id);
    const vizinha = irmas[i + direcao];
    if (!vizinha) return;
    // Troca as ordens; se iguais, desempata deslocando a página movida.
    const ordemAtual = atual.ordem === vizinha.ordem ? vizinha.ordem + direcao : vizinha.ordem;
    const ordemVizinha = atual.ordem === vizinha.ordem ? vizinha.ordem : atual.ordem;
    await acao(
        () =>
            Promise.all([
                api.atualizarPagina(atual.id, { ordem: Math.max(0, ordemAtual) }),
                api.atualizarPagina(vizinha.id, { ordem: Math.max(0, ordemVizinha) }),
            ]),
        ['paginas'],
    )();
}

const moverJogador = (paginaId: number, jogadorId: number) => acao(() => api.moverJogador(paginaId, jogadorId), ['jogadores'])();
const trazerTodos = (paginaId: number) => acao(() => Promise.all(props.jogadores.map((j) => api.moverJogador(paginaId, j.id))), ['jogadores'])();

// --- personagem ativo ------------------------------------------------------------
// Chat e dados da barra saem como o personagem ATIVO: o último em que o jogador clicou (entre os dele).
const chaveAtivo = `clickvtt.ativo.${props.mesa.id}.${props.jogador.id}`;
function ativoInicial(): number | null {
    const salvo = Number(lerLocal(chaveAtivo, ''));
    if (salvo && props.meusPersonagens.includes(salvo)) return salvo;

    return props.mestre ? null : (props.meusPersonagens[0] ?? null);
}
const ativoId = ref<number | null>(ativoInicial());
const ativo = computed(() => props.personagens.find((p) => p.id === ativoId.value) ?? null);
watch(ativoId, (v) => gravarLocal(chaveAtivo, v === null ? '' : String(v)));
// Se o mestre mudar os donos e o ativo deixar de ser meu, volta ao padrão.
watch(
    () => props.meusPersonagens,
    (ids) => {
        if (ativoId.value !== null && !ids.includes(ativoId.value)) ativoId.value = props.mestre ? null : (ids[0] ?? null);
    },
    { deep: true },
);

// Fichas abertas em janelas flutuantes. A ordem do array é a ordem de empilhamento (a última fica por cima).
interface FichaAberta {
    id: number;
    x: number;
    y: number;
}
/** Módulo do sistema da mesa (null = sistema sem módulo: a ficha mostra um aviso, nunca a de outro sistema). */
const moduloSistema = moduloDoSistema(props.sistema.slug);
const fichasAbertas = ref<FichaAberta[]>([]);
const personagensAbertos = computed(() =>
    fichasAbertas.value.map((f, i) => ({ ...f, z: 30 + i, personagem: props.personagens.find((p) => p.id === f.id) })).filter((f) => f.personagem),
);
const tamanhoFicha = () => ({ largura: Math.min(940, window.innerWidth - 32), altura: Math.min(700, window.innerHeight - 76) });
function focarFicha(id: number) {
    const i = fichasAbertas.value.findIndex((f) => f.id === id);
    if (i >= 0 && i < fichasAbertas.value.length - 1) fichasAbertas.value.push(...fichasAbertas.value.splice(i, 1));
}
function fecharFicha(id: number) {
    fichasAbertas.value = fichasAbertas.value.filter((f) => f.id !== id);
}
/** Clicar num personagem abre a ficha (janela flutuante) e, se ele for meu, o torna o ativo. */
function abrirPersonagem(id: number) {
    if (props.meusPersonagens.includes(id)) ativoId.value = id;
    if (fichasAbertas.value.some((f) => f.id === id)) return focarFicha(id);
    const desloca = (fichasAbertas.value.length % 6) * 28;
    fichasAbertas.value.push({ id, x: 90 + desloca, y: 64 + desloca });
}

// --- dados das fichas ----------------------------------------------------------
// O servidor só envia a ficha a quem controla o personagem (mestre e donos). Aqui fica uma cópia local:
// edições são aplicadas na hora (otimista), enviadas campo a campo e, se falharem, a tela volta ao estado do servidor.
const fichas = ref<Record<number, Record<string, unknown>>>({});
function sincronizarFichas() {
    const novas: Record<number, Record<string, unknown>> = {};
    for (const p of props.personagens) if (p.ficha) novas[p.id] = copia(p.ficha);
    sincronizarPorId(fichas.value, novas); // só as fichas que mudaram de verdade são trocadas: as janelas abertas não piscam a cada recarga
}
sincronizarFichas();
watch(() => props.personagens, sincronizarFichas, { deep: true });

/** Um envio por vez por personagem, na ordem das edições (respostas fora de ordem não desfazem nada). */
const filasFicha = new Map<number, Promise<void>>();
function salvarFicha(personagemId: number, campos: Record<string, unknown>) {
    const ficha = fichas.value[personagemId];
    if (!ficha) return;
    for (const [caminho, valor] of Object.entries(campos)) definirCaminho(ficha, caminho, copia(valor));
    if ('condicoes' in campos) statusPorPersonagem.value[personagemId] = [...((campos.condicoes as string[] | null) ?? [])];
    const fila = (filasFicha.get(personagemId) ?? Promise.resolve())
        .then(() => api.salvarFicha(personagemId, campos))
        .then(() => {
            // o "aliado" do NPC é público (a área dos jogadores o consulta): traz a lista de personagens de volta
            if ('aliado' in campos) recarregar(['personagens']);
        })
        .catch((e) => {
            avisar(mensagemDe(e));
            recarregar(['personagens']);
        });
    filasFicha.set(personagemId, fila);
}
/** Outro participante (ou outra aba) alterou a ficha: aplica os mesmos campos. */
function aoMudarFicha(e: { personagem_id: number; campos: Record<string, unknown>; ator: number }) {
    const ficha = fichas.value[e.personagem_id];
    if (e.ator === props.jogador.id || !ficha) return;
    for (const [caminho, valor] of Object.entries(e.campos)) definirCaminho(ficha, caminho, copia(valor));
}
// --- itens da mesa -------------------------------------------------------------
// Um item salvo agora vale aqui até a recarga do servidor trazê-lo (evita piscar "item removido" ou o valor antigo).
const itensSalvos = ref<ItemDto[]>([]);
/** Os itens da mesa por id, para calcular as fichas (CA e PV máximos dependem do que o personagem veste). */
const itensPorIdDaMesa = computed(() => Object.fromEntries(itensDaMesa.value.map((i) => [i.id, i])) as Record<number, ItemDto>);
const itensDaMesa = computed(() => [
    ...props.itens.map((i) => itensSalvos.value.find((s) => s.id === i.id) ?? i),
    ...itensSalvos.value.filter((s) => !props.itens.some((i) => i.id === s.id)),
]);

// Editor do mestre (diálogo único; abre pela aba Itens ou pelo inventário de uma ficha).
const editorAberto = ref(false);
const catalogoAberto = ref(false);
const dadosDaLoja = moduloSistema?.dadosDaLoja;
const itemEditando = ref<ItemDto | null>(null);
let aoSalvarItem: ((item: ItemDto) => void) | undefined;
const abrirEditorItem: AbrirEditorItem = (itemId, aoSalvar) => {
    if (!props.mestre) return;
    itemEditando.value = itemId === null ? null : (itensDaMesa.value.find((i) => i.id === itemId) ?? null);
    aoSalvarItem = aoSalvar;
    editorAberto.value = true;
};
async function salvarItem(campos: NovoItem, id: number | null): Promise<ItemDto> {
    const item = id === null ? await api.criarItem(campos) : await api.atualizarItem(id, campos);
    itensSalvos.value = [...itensSalvos.value.filter((s) => s.id !== item.id), item];
    recarregar(['itens']);

    return item;
}
async function excluirItem(id: number) {
    await api.excluirItem(id);
    itensSalvos.value = itensSalvos.value.filter((s) => s.id !== id);
    recarregar(['itens', 'personagens']); // o item sai do inventário de todos
}
function aoSalvarItemOk(item: ItemDto) {
    aoSalvarItem?.(item);
    aoSalvarItem = undefined;
}
watch(
    () => props.itens,
    () => (itensSalvos.value = itensSalvos.value.filter((s) => !props.itens.some((i) => i.id === s.id && JSON.stringify(i) === JSON.stringify(s)))),
    { deep: true },
);

/** Argumentos do evento `rolar` da ficha: expressão, nome e, opcional, quem recebe o total sorteado. */
type RolagemDaFicha = [
    // (o 6º argumento, o alvo do ataque, vem depois da ação)
    expressao: string,
    rotulo: string,
    aoRolar?: (total: number) => void,
    dano?: { tipo: string | null; fator?: number },
    acao?: { categoria: string; tecnica?: boolean },
    alvoPersonagemId?: number | null,
    tecnica?: { nome: string; dano?: { expressao: string; tipo: string | null } | null; secundaria?: object | null },
    municaoItemId?: number,
];

/** Rolagem vinda da ficha: as `@variáveis` são resolvidas no servidor pela ficha salva do personagem. */
async function rolarDaFicha(
    personagemId: number,
    ...[expressao, rotulo, aoRolar, dano, acao, alvoPersonagemId, tecnica, municaoItemId]: RolagemDaFicha
) {
    try {
        const m = await api.rolar(expressao, 'todos', personagemId, rotulo, dano, acao, alvoPersonagemId, tecnica, municaoItemId);
        aoNovaMensagem(m);
        if (m.dados) aoRolar?.(m.dados.total);
    } catch (e) {
        avisar(mensagemDe(e));
    } finally {
        // a rolagem gastou ação no servidor (ou foi recusada): traz o estado do combate para o contador de ataques e os botões
        if (acao) recarregar(['combate']);
    }
}

// --- Técnicas: gabarito de área e Salvaguarda coletiva ---------------------------------------------------------------------
// Técnica de Salvaguarda: a área aparece no mapa a partir do token de quem usa; quem estiver dentro é alvo. O clique confirma, Esc cancela.
const gabarito = ref<{ area: AreaDeEfeito; origem: number; excluir?: number[] } | null>(null);
let resolverGabarito: ((ids: number[] | null) => void) | null = null;
function aoGabarito(ids: number[] | null) {
    gabarito.value = null;
    resolverGabarito?.(ids);
    resolverGabarito = null;
}
const escolherNaArea = (area: AreaDeEfeito, origem: number, excluir: number[]) =>
    new Promise<number[] | null>((resolver) => {
        resolverGabarito?.(null);
        resolverGabarito = resolver;
        gabarito.value = { area, origem, excluir };
    });
// Vigília (Overwatch): marcar o centro da esfera no mapa (limitada ao alcance) e as esferas ativas, visíveis para todos.
const pontoAtivo = ref<{ de: { x: number; y: number }; maximo: number; raio: number } | null>(null);
let resolverPonto: ((p: { x: number; y: number } | null) => void) | null = null;
function aoPonto(p: { x: number; y: number } | null) {
    pontoAtivo.value = null;
    resolverPonto?.(p);
    resolverPonto = null;
}
const escolherPonto = (cfg: { de: { x: number; y: number }; maximo: number; raio: number }) =>
    new Promise<{ x: number; y: number } | null>((resolver) => {
        resolverPonto?.(null);
        resolverPonto = resolver;
        pontoAtivo.value = cfg;
    });
const centroDoToken = (personagemId: number) => {
    const t = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === personagemId);

    return t ? { x: t.x + t.largura / 2, y: t.y + t.altura / 2 } : null;
};
const zonasDaCena = computed(() =>
    combate.value.ativas
        .filter((a) => a.zona && a.zona.pagina_id === props.pagina?.id)
        .map((a) => ({
            id: a.id,
            x: a.zona!.x,
            y: a.zona!.y,
            raio: a.zona!.raio,
            cor: props.personagens.find((p) => p.id === a.personagem_id)?.cor ?? '#fb923c',
        })),
);
/** Ação bônus: a ficha fecha e o jogador marca no mapa o novo centro da esfera (até 6 m do atual). */
async function moverVigia(personagemId: number, id: string) {
    const a = combate.value.ativas.find((x) => x.id === id);
    if (!a?.zona) return;
    fecharFicha(personagemId);
    try {
        avisar('Marque o novo centro da esfera: clique para confirmar, Esc cancela.');
        const novo = await escolherPonto({ de: { x: a.zona.x, y: a.zona.y }, maximo: 6, raio: a.zona.raio });
        erro.value = null;
        if (!novo) return;
        combate.value = normalizarCombate((await api.moverVigia(id, novo.x, novo.y)).combate);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

/** Fogo amigo da mesa (o mestre liga): sem ele, jogador só acerta NPC não aliado e NPC só acerta jogador. */
const fogoAmigo = ref(props.mesa.fogo_amigo ?? false);
watch(
    () => props.mesa.fogo_amigo,
    (v) => (fogoAmigo.value = v ?? false),
);
async function alternarFogoAmigo(ligado: boolean) {
    try {
        fogoAmigo.value = (await api.fogoAmigo(ligado)).fogo_amigo;
        recarregar(['mesa']);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
const ladoDe = (id: number) => {
    const p = props.personagens.find((x) => x.id === id);

    return { id, jogador: (p?.jogadores?.length ?? 0) > 0, aliado: !!p?.aliado };
};
/** Os tokens que a Técnica de quem usa NÃO pode atingir (jogador, aliado...): a área não os conta nem destaca. */
const protegidosDe = (personagemId: number) =>
    objetos.value
        .filter((o) => o.tipo === 'token' && o.personagem_id !== null && !podeAtingir(fogoAmigo.value, ladoDe(personagemId), ladoDe(o.personagem_id)))
        .map((o) => o.id);
/**
 * Marca a área da Técnica no mapa e devolve os personagens atingidos (do mais perto ao mais longe), ou null (cancelou, sem token no mapa ou
 * ninguém dentro). O mais perto vira o alvo mirado: o ataque e o "Aplicar" do chat o usam.
 */
async function escolherAreaDaFicha(personagemId: number, area: AreaDeEfeito): Promise<number[] | null> {
    if (area.bloqueio) {
        avisar(area.bloqueio);

        return null;
    }
    const token = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === personagemId);
    if (!token) {
        avisar('Coloque o seu token no mapa para marcar a área da Técnica.');

        return null;
    }
    avisar('Marque a área no mapa: clique para confirmar, Esc cancela.');
    const alvos = await escolherNaArea(area, token.id, protegidosDe(personagemId));
    erro.value = null;
    if (alvos === null) return null;
    if (!alvos.length) {
        avisar('Nenhum alvo válido na área (sem fogo amigo: jogadores e aliados não são atingidos).');

        return null;
    }
    const maisPerto = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === alvos[0]);
    if (maisPerto) {
        alvoObjetoId.value = maisPerto.id;
        miraDaTecnica.value = true;
    }

    return alvos;
}

/**
 * Usar uma Técnica (a ficha só monta o pedido; tudo roda aqui, então fechar a janela da ficha no meio não perde nada):
 * 0. fecha a janela da ficha (o mapa fica livre);
 * 1. com área, marca-a no mapa antes de qualquer custo (o mais perto vira o alvo mirado);
 * 2. gasta a ação e os PP;
 * 3. ataque: rola 1d20+ataque no alvo (o card oferece o dano); Salvaguarda: abre o card coletivo; senão rola o dano.
 */
async function usarTecnicaDaFicha(personagemId: number, uso: UsoDeTecnica) {
    fecharFicha(personagemId); // a ficha sai da frente: o jogador mira e acompanha o resultado no mapa e no chat
    try {
        // Vigília (Overwatch): marca a esfera no mapa (dentro do alcance da arma), gasta a ação e os PP e fica ativa
        if (uso.duracao?.vigia && uso.vigia) {
            if (!emCurso(combate.value)) return avisar('A Vigília dura vários turnos: use-a com o combate em curso.');
            if (uso.vigia.bloqueio) return avisar(uso.vigia.bloqueio);
            const de = centroDoToken(personagemId);
            if (!de) return avisar('Coloque o seu token no mapa para marcar a esfera.');
            avisar('Marque a esfera no mapa: clique para confirmar, Esc cancela.');
            const centro = await escolherPonto({ de, maximo: uso.vigia.maximo, raio: uso.vigia.raio });
            erro.value = null;
            if (!centro) return;
            if (!(await gastarAcaoDoCombate(personagemId, uso.categoria, true))) return;
            if (uso.municao) await api.gastarMunicaoDaTecnica(personagemId, uso.municao.tecnica);
            const r = await api.ativarVigia({
                personagem_id: personagemId,
                nome: uso.nome,
                rodadas: uso.duracao.rodadas,
                concentracao: !!uso.duracao.concentracao,
                x: centro.x,
                y: centro.y,
                raio: uso.vigia.raio,
            });
            salvarFicha(personagemId, uso.camposDosPP);
            combate.value = normalizarCombate(r.combate);

            return;
        }
        // Técnica com duração (Quick Draw): com o combate em curso ela fica ativa e o ataque vem no início do turno de cada criatura ao alcance
        // (sem marcar área agora). Fora do combate, vale como uma Técnica de uso único.
        if (uso.duracao && emCurso(combate.value) && uso.dano) {
            if (!(await gastarAcaoDoCombate(personagemId, uso.categoria, true))) return;
            if (uso.municao) await api.gastarMunicaoDaTecnica(personagemId, uso.municao.tecnica);
            const r = await api.ativarTecnica({
                personagem_id: personagemId,
                nome: uso.nome,
                rodadas: uso.duracao.rodadas,
                concentracao: !!uso.duracao.concentracao,
                alcance: uso.area?.metros ?? 0,
                dano: uso.dano,
                opcoes: uso.duracao.opcoes ?? [],
            });
            salvarFicha(personagemId, uso.camposDosPP);
            combate.value = normalizarCombate(r.combate);

            return;
        }
        let alvos: number[] | null = null;
        if (uso.area) {
            alvos = await escolherAreaDaFicha(personagemId, uso.area);
            if (!alvos) return;
        }
        const teste = uso.teste;
        // sem área, a Salvaguarda vale para o alvo mirado: confere antes de gastar
        if (teste?.tipo === 'salvaguarda' && !alvos && !alvoPersonagem.value) return avisar('Mire um alvo.');
        if (!(await gastarAcaoDoCombate(personagemId, uso.categoria, true))) return;
        if (uso.municao) await api.gastarMunicaoDaTecnica(personagemId, uso.municao.tecnica); // sem munição o servidor recusa e os PP não são gastos
        salvarFicha(personagemId, uso.camposDosPP);

        if (teste?.tipo === 'salvaguarda' && teste.atributo) {
            const alvosDaSalvaguarda = alvos ?? (alvoPersonagem.value ? [alvoPersonagem.value.id] : []);
            aoNovaMensagem(
                await api.abrirSalvaguarda({
                    personagem_id: personagemId,
                    nome: uso.nome,
                    atributo: teste.atributo,
                    desvantagem: uso.desvantagem,
                    ao_passar: teste.aoPassar ?? 'metade',
                    alvos: alvosDaSalvaguarda,
                    dano: uso.dano,
                    ...(teste.aplica ? { aplica: teste.aplica } : {}),
                    ...(uso.secundaria ? { secundaria: uso.secundaria } : {}),
                }),
            );
        } else if (teste?.tipo === 'ataque') {
            const dados = uso.modoAtaque === 'vantagem' ? '2d20kh1' : uso.modoAtaque === 'desvantagem' ? '2d20kl1' : '1d20';
            await rolarDaFicha(
                personagemId,
                `${dados}+@ataque`,
                uso.modoAtaque ? `${uso.nome} (${uso.modoAtaque})` : uso.nome,
                undefined,
                undefined,
                undefined,
                alvoDoAtaque.value,
                { nome: uso.nomeBase ?? uso.nome, dano: uso.dano, ...(uso.secundaria ? { secundaria: uso.secundaria } : {}) },
            );
        } else if (uso.dano) {
            await rolarDaFicha(personagemId, uso.dano.expressao, uso.nome, undefined, uso.dano.tipo ? { tipo: uso.dano.tipo } : undefined);
        }
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

/** Card de uma Técnica ativa (Quick Draw): atacar, escolher o efeito do acerto ou ignorar. O servidor decide e devolve o card novo. */
async function agirNoGatilho(mensagem: Mensagem, chamada: () => Promise<Mensagem>) {
    const chave = `g${mensagem.id}`;
    if (salvaguardasRolando.value.includes(chave)) return;
    salvaguardasRolando.value = [...salvaguardasRolando.value, chave];
    try {
        aoNovaMensagem(await chamada(), true);
        recarregar(['personagens']); // o dano mexe nos PV do alvo
    } catch (e) {
        avisar(mensagemDe(e));
    } finally {
        salvaguardasRolando.value = salvaguardasRolando.value.filter((c) => c !== chave);
    }
}

/** Salvaguardas em andamento (`mensagem:personagem`): o botão do card fica desligado até a resposta. */
const salvaguardasRolando = ref<string[]>([]);
async function rolarSalvaguarda(mensagem: Mensagem, personagemId: number) {
    const chave = `${mensagem.id}:${personagemId}`;
    if (salvaguardasRolando.value.includes(chave)) return;
    salvaguardasRolando.value = [...salvaguardasRolando.value, chave];
    try {
        aoNovaMensagem(await api.rolarSalvaguarda(mensagem.id, personagemId), true);
    } catch (e) {
        avisar(mensagemDe(e));
    } finally {
        salvaguardasRolando.value = salvaguardasRolando.value.filter((c) => c !== chave);
    }
}
/** Ataque de Técnica que acertou: pede ao atingido a Salvaguarda do efeito (Sangramento, Atordoado...). */
async function pedirSalvaguardaDoEfeito(mensagem: Mensagem) {
    const t = mensagem.dados?.sistema?.tecnica;
    const alvo = mensagem.dados?.sistema?.resolucao?.alvo_id ?? alvoPersonagem.value?.id;
    const personagemId = mensagem.autor?.personagem_id;
    if (!t?.secundaria || !personagemId) return;
    if (!alvo) return avisar('Mire o alvo atingido para pedir a Salvaguarda.');
    try {
        aoNovaMensagem(
            await api.abrirSalvaguarda({
                personagem_id: personagemId,
                nome: `${t.nome}: efeito`,
                atributo: t.secundaria.atributo,
                desvantagem: !!t.secundaria.desvantagem,
                ao_passar: 'nada',
                alvos: [alvo],
                efeito: t.secundaria.efeito,
                ...(t.secundaria.aplica ? { aplica: t.secundaria.aplica } : {}),
            }),
        );
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

/**
 * Efeito da munição de um ataque que acertou. Kairoseki: o servidor dá Enfraquecido ao alvo se ele usar Akuma no Mi. Bola Explosiva: a explosão
 * de 1,5 m é marcada no mapa em volta do alvo atingido (clique confirma, Esc cancela) e quem está dentro rola a Salvaguarda de Destreza CD 16.
 */
async function efeitoDaMunicaoDoChat(mensagem: Mensagem) {
    const efeito = mensagem.dados?.sistema?.municao?.efeito;
    const alvoId = mensagem.dados?.sistema?.resolucao?.alvo_id ?? alvoPersonagem.value?.id ?? null;
    const personagemId = mensagem.autor?.personagem_id;
    if (!efeito || !personagemId) return;
    if (!alvoId) return avisar('Mire o alvo atingido.');
    try {
        if (efeito === 'kairoseki') {
            aoNovaMensagem(await api.efeitoDaMunicao(mensagem.id, { alvo_id: alvoId }), true);
            recarregar(['personagens']);

            return;
        }
        const token = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === alvoId);
        if (!token) return avisar('O alvo precisa ter token no mapa para marcar a explosão.');
        fecharFicha(personagemId); // a ficha sai da frente para marcar a explosão no mapa
        avisar('Marque a explosão no mapa: clique para confirmar, Esc cancela.');
        // o raio de 1,5 m parte do alvo atingido; quem o atirador não pode atingir (aliados, sem fogo amigo) fica de fora
        const naArea = await escolherNaArea({ forma: 'esfera', metros: 1.5 }, token.id, protegidosDe(personagemId));
        erro.value = null;
        if (naArea === null) return;
        aoNovaMensagem(await api.efeitoDaMunicao(mensagem.id, { alvo_id: alvoId, alvos: naArea.filter((id) => id !== alvoId) }), true);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// --- loja ---------------------------------------------------------------------------------------------------------------
// O mestre abre a loja (jogadores e categorias) e cria itens do catálogo; o jogador compra enquanto ela estiver aberta.
const lojas = ref<LojaAbertaDto[]>(copia(props.lojasAbertas ?? []));
watch(
    () => props.lojasAbertas,
    (l) => (lojas.value = copia(l ?? [])),
    { deep: true },
);
const jogadoresDaLoja = computed(() => props.jogadores.filter((j) => j.papel !== 'mestre').map((j) => ({ id: j.id, nome: j.nome })));
async function abrirLoja(dados: { jogadores: 'todos' | number[]; categorias: string[]; raridades: string[]; fator: number }) {
    lojas.value = (await api.abrirLoja(dados)).lojas;
}
/** O mestre entrega um item do catálogo a um personagem; a ficha dele se atualiza pelo broadcast. */
async function entregarDoCatalogo(personagemId: number, item: string, qtd: number) {
    const r = await api.entregarDoCatalogo({ personagem_id: personagemId, item, qtd });
    aplicarNaFicha(personagemId, r.campos); // o inventário novo entra na ficha aberta sem recarregar a lista de personagens
    recarregar(['itens']); // o item materializado da mesa (a ficha precisa dele para mostrar o nome)

    return r;
}
async function fecharLoja(jogadores: 'todos' | number[]) {
    lojas.value = (await api.fecharLoja(jogadores)).lojas;
}
// itens que o mestre cria para o catálogo/loja (usa o mesmo editor dos itens, com categoria, raridade e preço)
const editorCatalogoAberto = ref(false);
const itemDeCatalogoEditando = ref<ItemDeCatalogoDto | null>(null);
const itemDoEditorDeCatalogo = computed(() => itemDeCatalogoEditando.value as unknown as ItemDto | null);
const abrirEditorDeCatalogo = (id: number | null) => {
    itemDeCatalogoEditando.value = id === null ? null : (props.catalogoDoMestre?.find((i) => i.id === id) ?? null);
    editorCatalogoAberto.value = true;
};
async function salvarItemDeCatalogo(campos: NovoItem, id: number | null): Promise<ItemDto> {
    const corpo = campos as NovoItemDeCatalogo;
    const item = id === null ? await api.criarItemDeCatalogo(corpo) : await api.atualizarItemDeCatalogo(id, corpo);
    recarregar(['catalogoDoMestre']);

    return item as unknown as ItemDto;
}
async function excluirItemDeCatalogo(id: number) {
    await api.excluirItemDeCatalogo(id);
    recarregar(['catalogoDoMestre']);
}
const lojaVisivel = ref(true);
/** Compra: o servidor confere tudo; a ficha daqui recebe o novo Belly e o inventário na hora. */
async function comprarNaLoja(dados: { personagem_id: number; item: string; qtd: number }) {
    const r = await api.comprarNaLoja(dados);
    const ficha = fichas.value[dados.personagem_id];
    if (ficha) for (const [caminho, valor] of Object.entries(r.campos)) definirCaminho(ficha, caminho, copia(valor));
    recarregar(['itens']);

    return { total: r.total, saldo: r.saldo };
}
const meusPersonagensDaLoja = computed(() =>
    props.personagens.filter((p) => props.meusPersonagens.includes(p.id)).map((p) => ({ id: p.id, nome: p.nome })),
);

// Serviços da mesa para a ficha (forja do Ferreiro): a ficha nunca fala com a API, a mesa executa e aplica o resultado.
function aplicarNaFicha(personagemId: number, campos: Record<string, unknown>) {
    const ficha = fichas.value[personagemId];
    if (ficha) for (const [caminho, valor] of Object.entries(campos)) definirCaminho(ficha, caminho, copia(valor));
}
const servicosDaFicha = computed(() => ({
    personagens: props.personagens.map((p) => ({ id: p.id, nome: p.nome })),
    armasParaForja: (id: number) => api.armasParaForja(id),
    melhorar: async (d: Parameters<typeof api.melhorarEquipamento>[0]) => {
        const r = await api.melhorarEquipamento(d);
        aplicarNaFicha(d.ferreiro_id, r.camposFerreiro);
        aplicarNaFicha(r.alvo_id, r.camposAlvo);
        recarregar(['itens']);

        return { resultado: r.resultado, texto: r.texto };
    },
    forjar: async (d: { ferreiro_id: number; item: string; atributo: 'for' | 'des' | 'sab' }) => {
        const r = await api.forjar(d);
        aplicarNaFicha(d.ferreiro_id, r.campos);
        recarregar(['itens']);

        return { sucesso: r.sucesso, texto: r.texto };
    },
    aprimorar: async (d: { ferreiro_id: number; alvo_id: number; item_id: number; melhorias: Record<string, unknown> }) => {
        const r = await api.aprimorarArma(d);
        aplicarNaFicha(d.ferreiro_id, r.camposFerreiro);
        aplicarNaFicha(r.alvo_id, r.camposAlvo);
        recarregar(['itens']);

        return { texto: r.texto };
    },
}));

// Arrastar um item da aba Itens para a janela de uma ficha entrega o item ao personagem (só o mestre; o formato do
// inventário é do módulo do sistema).
const fichaSobre = ref<number | null>(null);
const aceitaItem = (e: DragEvent, personagemId: number) =>
    props.mestre && !!moduloSistema?.entregarItem && !!fichas.value[personagemId] && arrastandoItem(e);
/** Item da loja arrastado para a ficha de um personagem MEU: compra e entrega (o servidor confere loja e Belly). */
const aceitaLoja = (e: DragEvent, personagemId: number) =>
    !!props.lojaDoJogador && props.meusPersonagens.includes(personagemId) && arrastandoDaLoja(e);
function itemSobreFicha(e: DragEvent, personagemId: number) {
    if (!aceitaItem(e, personagemId) && !aceitaLoja(e, personagemId)) return;
    e.preventDefault(); // sem isto o navegador não deixa soltar
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    fichaSobre.value = personagemId;
}
function itemSaiuDaFicha(e: DragEvent, personagemId: number) {
    // `dragleave` também dispara ao passar por elementos filhos: só limpa quando saiu da janela de verdade.
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null) && fichaSobre.value === personagemId) fichaSobre.value = null;
}
async function soltarItemNaFicha(e: DragEvent, personagemId: number) {
    fichaSobre.value = null;
    if (aceitaLoja(e, personagemId)) {
        e.preventDefault();
        const ref = itemDaLojaSolto(e);
        if (!ref) return;
        try {
            const r = await comprarNaLoja({ personagem_id: personagemId, item: ref, qtd: 1 });
            avisar(`Compra feita: ฿ ${r.total.toLocaleString('pt-BR')}. Saldo: ฿ ${r.saldo.toLocaleString('pt-BR')}.`);
        } catch (err) {
            avisar(mensagemDe(err));
        }
        return;
    }
    if (!aceitaItem(e, personagemId)) return;
    e.preventDefault();
    const itemId = itemSolto(e);
    const item = itensDaMesa.value.find((i) => i.id === itemId);
    const campos = itemId && moduloSistema?.entregarItem?.(fichas.value[personagemId], itemId);
    if (!item || !campos) return avisar('Não foi possível entregar esse item.');
    salvarFicha(personagemId, campos);
    avisar(`${item.nome} entregue a ${props.personagens.find((p) => p.id === personagemId)?.nome ?? 'personagem'}.`);
}

// --- criar personagem (mestre) ------------------------------------------------
const novoPersonagemAberto = ref(false);
const criarPersonagem = (dados: { nome: string; cor: string; jogadores: number[] }) => api.criarPersonagem(dados);
/** Depois de criar: recarrega a lista (e o que depende dela) e já abre a ficha do novo personagem. */
function aoCriarPersonagem(personagem: Personagem) {
    recarregar(['personagens', 'meusPersonagens', 'itens'], {
        onSuccess: () => {
            abrirPersonagem(personagem.id);
            if (moduloSistema?.Construtor) construtorId.value = personagem.id; // sistema com assistente: começa por ele
        },
    });
}

// --- assistente de criação (sistemas com `Construtor`) -----------------------------------------------------------
// O progresso da criação (etapa e escolhas) fica salvo no servidor, por personagem, para retomar depois.
const criacoes = ref<Record<number, Criacao | null>>({});
function sincronizarCriacoes() {
    sincronizarPorId(criacoes.value, Object.fromEntries(props.personagens.map((p) => [p.id, p.criacao ?? null])));
}
sincronizarCriacoes();
watch(() => props.personagens, sincronizarCriacoes, { deep: true });
const construtorId = ref<number | null>(null);
const construtorPersonagem = computed(() => props.personagens.find((p) => p.id === construtorId.value) ?? null);
/** Salva a etapa/escolhas (e, ao concluir, os campos da ficha) e aplica o resultado na tela. */
async function salvarCriacao(personagemId: number, campos: Record<string, unknown>, criacao: Criacao) {
    const resp = await api.salvarFicha(personagemId, campos, criacao);
    criacoes.value[personagemId] = resp.criacao;
    if (Object.keys(campos).length) fichas.value[personagemId] = copia(resp.ficha);
    // concluir a criação entrega os itens iniciais da profissão: os itens novos da mesa chegam à tela
    if (criacao.concluida) recarregar(['itens']);
}
/** Companheiro entregue pelo assistente (ex.: Cobra Bélica): cria o personagem e recarrega a lista. */
async function criarCompanheiroDoConstrutor(modelo: string) {
    if (construtorId.value === null) return;
    await api.criarCompanheiro(construtorId.value, modelo);
    recarregar(['personagens', 'meusPersonagens']);
}
/** Os Bellys iniciais do estilo: o servidor rola e guarda na criação; a tela mostra e guarda o resultado. */
const rolarDinheiroDaCriacao = (personagemId: number) => async (estilo: string) => {
    const r = await api.rolarDinheiro(personagemId, estilo);
    criacoes.value[personagemId] = {
        ...(criacoes.value[personagemId] ?? { etapa: 'estilo', concluida: false }),
        dados: { ...criacoes.value[personagemId]?.dados, dinheiro: r },
    };

    return r;
};
const rolarAtributosDaCriacao = (personagemId: number) => async () => {
    const r = await api.rolarAtributos(personagemId);
    criacoes.value[personagemId] = {
        ...(criacoes.value[personagemId] ?? { etapa: 'atributos', concluida: false }),
        dados: { ...criacoes.value[personagemId]?.dados, rolados: r.rolados },
    };

    return r.rolados;
};

const atribuindo = ref<Personagem | null>(null);
const atribuicaoAberta = ref(false);
function pedirAtribuicao(id: number) {
    atribuindo.value = props.personagens.find((p) => p.id === id) ?? null;
    atribuicaoAberta.value = atribuindo.value !== null;
}
// Botão direito num personagem da lista (só o mestre): excluir, com confirmação.
const menuPersonagem = ref<{ id: number; x: number; y: number } | null>(null);
const excluindoId = ref<number | null>(null);
const excluindo = ref(false);
const nomeDoMenu = computed(() => props.personagens.find((p) => p.id === menuPersonagem.value?.id)?.nome ?? '');
const nomeDoExcluido = computed(() => props.personagens.find((p) => p.id === excluindoId.value)?.nome ?? '');
async function excluirPersonagem() {
    const id = excluindoId.value;
    if (id === null) return;
    excluindo.value = true;
    try {
        await api.excluirPersonagem(id);
        fecharFicha(id);
        if (ativoId.value === id) ativoId.value = null;
        if (alvoPersonagem.value?.id === id) alvoObjetoId.value = null;
        excluindoId.value = null;
        recarregar(['personagens', 'meusPersonagens', 'objetos', 'jogadores', 'combate']);
    } catch (e) {
        avisar(mensagemDe(e));
    } finally {
        excluindo.value = false;
    }
}

async function salvarAtribuicao(personagemId: number, jogadores: number[]) {
    try {
        await api.atribuirJogadores(personagemId, jogadores);
        atribuicaoAberta.value = false;
        recarregar(['personagens', 'meusPersonagens']);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// --- pintar e texto ----------------------------------------------------------------

/** Jogador sempre desenha na camada Jogadores; o mestre, na camada ativa (menos Iluminação). */
const camadaDeDesenho = (): Camada => (props.mestre && camada.value !== 'iluminacao' ? camada.value : 'jogadores');

async function criarTraco(t: { x: number; y: number; largura: number; altura: number; pontos: number[] }) {
    if (!props.pagina) return;
    try {
        objetos.value.push(
            await api.criarObjeto(props.pagina.id, {
                camada: camadaDeDesenho(),
                tipo: 'traco',
                x: t.x,
                y: t.y,
                largura: t.largura,
                altura: t.altura,
                dados: {
                    pontos: t.pontos,
                    cor: estilo.value.cor,
                    espessura: estilo.value.espessura,
                    largura_original: t.largura,
                    altura_original: t.altura,
                },
            }),
        );
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

function pedirTexto(x: number, y: number, tela: { x: number; y: number }) {
    textoPendente.value = { x, y, tela, valor: '' };
}

async function confirmarTexto() {
    const t = textoPendente.value;
    textoPendente.value = null;
    if (!t || !t.valor.trim() || !props.pagina) return;
    const tamanho = estilo.value.tamanho;
    try {
        objetos.value.push(
            await api.criarObjeto(props.pagina.id, {
                camada: camadaDeDesenho(),
                tipo: 'texto',
                x: t.x,
                y: t.y,
                largura: Math.max(10, t.valor.length * tamanho * 0.6),
                altura: tamanho * 1.3,
                dados: { texto: t.valor.trim(), cor: estilo.value.cor, tamanho },
            }),
        );
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// --- chat, dados e turnos ----------------------------------------------------------------

/** Insere (ou completa) uma mensagem; devolve true se era nova. Dedupe por id: chega pela API e pelo canal. */
function receberMensagem(m: Mensagem, substitui = false): boolean {
    const i = mensagens.value.findIndex((x) => x.id === m.id);
    if (i === -1) {
        mensagens.value.push(m);
        return true;
    }
    // Aviso de "rolou em segredo" é trocado pelo resultado completo; nunca o contrário.
    if (substitui || (mensagens.value[i].visibilidade === 'secreto_oculto' && m.visibilidade !== 'secreto_oculto')) mensagens.value[i] = m;

    return false;
}
function aoNovaMensagem(m: Mensagem, substitui = false) {
    const nova = receberMensagem(m, substitui);
    if (nova && m.autor?.id !== props.jogador.id && !(lateralAberta.value && abaLateral.value === 'chat')) naoLidas.value++;
    if (nova && m.tipo === 'rolagem' && m.dados && animacao.value) animacaoAtual.value = m;
}

/** Sem trava no botão: cada clique rola. As respostas entram no chat na hora; a animação mostra só a mais recente. */
async function rolar(expressao: string, visibilidade: VisibilidadeRolagem, rotulo?: string) {
    try {
        aoNovaMensagem(await api.rolar(expressao, visibilidade, ativoId.value, rotulo));
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
/** Botão do card de uma rolagem (ex.: Dano): rola a ação como o mesmo personagem e com a mesma visibilidade. */
async function rolarAcaoDoChat(mensagem: Mensagem, acao: AcaoDaRolagem) {
    const visibilidade: VisibilidadeRolagem =
        mensagem.visibilidade === 'secreto' || mensagem.visibilidade === 'mestre' ? mensagem.visibilidade : 'todos';
    try {
        aoNovaMensagem(await api.rolar(acao.expressao, visibilidade, mensagem.autor?.personagem_id ?? null, acao.rotuloRolagem, acao.dano));
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
async function enviarTexto(texto: string) {
    try {
        aoNovaMensagem(await api.enviarTexto(texto, ativoId.value));
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
/** Comando de combate: o servidor decide e devolve o estado novo (a tela só mostra). */
async function comandoCombate(comando: string, dados: Record<string, unknown> = {}) {
    try {
        combate.value = normalizarCombate((await api.comandoCombate(comando, dados)).combate);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
const rolarMinhaIniciativa = (itemId: string) => comandoCombate('iniciativa', { item_id: itemId });
/** Personagens meus que ainda não rolaram a iniciativa (o aviso abre sozinho na minha tela). */
const iniciativasPendentes = computed(() => semIniciativaDe(combate.value, props.meusPersonagens));

// --- tempo real (Reverb): chat, turnos e sincronia da cena ---------------------------------------

let conexao: Conexao | null = null;
let temporizadorCena: ReturnType<typeof setTimeout> | undefined;
const meuId = props.jogador.id;

/** Outro participante mudou a cena: recarrega só o necessário (e não para quem agiu). */
function aoMudarCena(payload: { ator: number | null }) {
    if (payload.ator === meuId) return;
    clearTimeout(temporizadorCena);
    temporizadorCena = setTimeout(
        () => recarregar(['objetos', 'pagina', 'paginas', 'pastas', 'jogadores', 'personagens', 'meusPersonagens', 'itens', 'mesa']),
        120,
    );
}

onMounted(() => {
    try {
        conexao = conectar(props.mesa.id, meuId);
        const base = `mesa.${props.mesa.id}`;
        const abrir = (canal: ReturnType<Conexao['echo']['private']>) =>
            canal
                .listen('.mensagem', (e: { mensagem: Mensagem; substitui?: boolean }) => aoNovaMensagem(e.mensagem, !!e.substitui))
                .listen('.cena', (e: { ator: number | null }) => aoMudarCena(e))
                .listen('.ficha', aoMudarFicha)
                .listen('.loja', (e: { aberta: boolean; catalogo?: boolean }) => {
                    if (props.mestre) return recarregar(['catalogoDoMestre', 'lojasAbertas']);
                    if (e.aberta) lojaVisivel.value = true;
                    recarregar(['lojaDoJogador']);
                })
                .listen('.loja-compra', (e: { jogador: string; item: string; qtd: number; total: number }) =>
                    avisar(`${e.jogador} comprou ${e.qtd}× ${e.item} por ฿ ${e.total.toLocaleString('pt-BR')}.`),
                )
                .listen(
                    '.reacao',
                    (e: OfertaDeReacao) => (ofertasDeReacao.value = [...semOfertasDe(ofertasDeReacao.value, e.evento_id, e.personagem_id), e]),
                )
                .listen('.evento', (e: ResumoEvento) => {
                    janelasDeReacao.value = comResumo(janelasDeReacao.value, e);
                    if (e.estado === 'resolvido') ofertasDeReacao.value = semOfertasDe(ofertasDeReacao.value, e.id);
                })
                .listen('.status', (e: { personagem_id: number; status: string[] }) => (statusPorPersonagem.value[e.personagem_id] = e.status))
                .listen('.combate', (e: { combate: Combate; ator: number }) => e.ator !== meuId && (combate.value = normalizarCombate(e.combate)));
        abrir(conexao.echo.private(base));
        abrir(conexao.echo.private(`${base}.jogador.${meuId}`));
        if (props.mestre) abrir(conexao.echo.private(`${base}.mestre`));
    } catch (e) {
        console.warn('Tempo real indisponível', e);
    }
});
onBeforeUnmount(() => {
    clearTimeout(temporizadorCena);
    conexao?.fechar();
});

// --- teclado -------------------------------------------------------------------

function aoTeclar(e: KeyboardEvent) {
    const alvo = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo?.tagName)) return;
    if (e.key === 'Escape' && alvoObjetoId.value !== null) alvoObjetoId.value = null; // Esc limpa a mira
    if ((e.key === 'Delete' || e.key === 'Backspace') && (selecionadoId.value || selecionadosIds.value.length)) {
        e.preventDefault();
        removerSelecionado();
    }
}
onMounted(() => window.addEventListener('keydown', aoTeclar));
onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar));

// --- iluminação (só o mestre) ------------------------------------------------------

async function criarLuz(cx: number, cy: number) {
    if (!props.pagina || !props.mestre) return;
    const raio = props.pagina.tamanho_quadrado * 4; // 4 quadrados (6 m)
    try {
        objetos.value.push(
            await api.criarObjeto(props.pagina.id, {
                camada: 'iluminacao',
                tipo: 'luz',
                nome: 'Luz',
                x: cx - raio,
                y: cy - raio,
                largura: raio * 2,
                altura: raio * 2,
                dados: { raio, cor: '#ffd27a' },
            }),
        );
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function criarParede(p: [number, number, number, number], tipo: TipoParede) {
    if (!props.pagina || !props.mestre) return;
    const [x1, y1, x2, y2] = p;
    try {
        const novo = await api.criarObjeto(props.pagina.id, {
            camada: 'iluminacao',
            tipo: 'parede',
            nome: tipo,
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            largura: Math.max(1, Math.abs(x2 - x1)),
            altura: Math.max(1, Math.abs(y2 - y1)),
            dados: { pontos: p, tipo, aberta: false },
        });
        objetos.value.push(novo);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

function alternarPorta(id: number) {
    const o = objetos.value.find((x) => x.id === id);
    if (!o || o.dados?.tipo !== 'porta') return;
    selecionadoId.value = id;
    atualizarSelecionado({ dados: { aberta: !o.dados.aberta } });
}
</script>

<template>
    <Head :title="mesa.nome" />
    <div class="fixed inset-0 overflow-hidden bg-preto-950 text-preto-100">
        <template v-if="pagina">
            <div class="absolute inset-0" @dragover="personagemSobreMapa" @drop="soltarNoMapa">
                <CenaCanvas
                    ref="canvas"
                    :pagina="pagina"
                    :objetos="objetosDaCena"
                    :alvo-id="alvoObjetoId"
                    :movimento="movimentoDaCena"
                    :gabarito="gabarito"
                    :ponto="pontoAtivo"
                    :zonas="zonasDaCena"
                    :camada="camada"
                    :ferramenta="ferramenta"
                    :mestre="mestre"
                    :jogador-id="jogador.id"
                    :personagens-permitidos="personagensQuePodemMover"
                    :estilo="estilo"
                    :margem-direita="margemDireita"
                    @criar-traco="criarTraco"
                    @criar-texto="pedirTexto"
                    @selecionar="selecionadoId = $event"
                    @selecao="selecionadosIds = $event"
                    @mirar="miraManual($event)"
                    @gabarito="aoGabarito"
                    @ponto="aoPonto"
                    @alterar="aoAlterar"
                    @zoom="escala = $event"
                    @criar-luz="criarLuz"
                    @criar-parede="criarParede"
                    @alternar-porta="alternarPorta"
                    @menu-objeto="abrirMenuObjeto"
                />
            </div>
        </template>
        <div v-else class="flex h-full items-center justify-center text-center text-preto-300">
            <p>Aguardando o mestre abrir uma página para você…</p>
        </div>

        <div class="pointer-events-none absolute inset-0">
            <BarraSuperior
                :mesa-nome="mesa.nome"
                :pagina-nome="pagina?.nome ?? '—'"
                :jogador="jogador"
                :ativo="ativo"
                :mestre="mestre"
                @paginas="menuAberto = true"
                @sair="router.post(sairUrl)"
            />

            <template v-if="pagina">
                <BarraFerramentas
                    :ferramenta="ferramenta"
                    :mestre="mestre"
                    :camada-iluminacao="camada === 'iluminacao'"
                    :dados="painelDados"
                    :turnos="painelTurnos"
                    @ferramenta="ferramenta = $event"
                    @dados="((painelDados = !painelDados), (painelTurnos = false))"
                    @turnos="((painelTurnos = !painelTurnos), (painelDados = false))"
                    @configurar="configurar(pagina.id)"
                />
                <SeletorCamada v-if="mestre" :camada="camada" @camada="(c) => ((camada = c), (ferramenta = 'selecionar'))" />
                <!-- Área do mapa: recua para não ficar sob a barra do chat -->
                <div
                    class="pointer-events-none absolute bottom-0 left-0 top-0 transition-[right] duration-200"
                    :style="{ right: margemDireita + 'px', top: lateralAberta ? '0px' : '2.75rem' }"
                >
                    <Inspetor
                        v-if="mestre && selecionado && pagina"
                        :objeto="selecionado"
                        :pagina="pagina"
                        @atualizar="atualizarSelecionado"
                        @remover="removerSelecionado"
                    />
                    <ControlesZoom :escala="escala" @mais="canvas?.zoomPor(1.25)" @menos="canvas?.zoomPor(1 / 1.25)" @ajustar="canvas?.ajustar()" />
                    <PainelDoTurno
                        :combate="combate"
                        :categorias="categoriasAcao"
                        :mestre="mestre"
                        :meus-personagens="meusPersonagens"
                        @disparar="dispararDoTurno"
                        @devolver="(item, categoria) => comandoCombate('devolver', { item_id: item, categoria })"
                    />
                    <PainelAlvo
                        v-if="alvoPersonagem && !miraDaTecnica"
                        :nome="alvoPersonagem.nome"
                        :cor="alvoPersonagem.cor"
                        :condicoes="moduloSistema?.condicoes ?? []"
                        :ativas="statusPorPersonagem[alvoPersonagem.id] ?? []"
                        :ocupado="alvoOcupado"
                        :atributos="moduloSistema?.atributos"
                        @limpar="alvoObjetoId = null"
                        @aplicar="(d) => condicaoDoAlvo({ ...d, acao: 'aplicar' })"
                        @remover="(id) => condicaoDoAlvo({ condicao: id, acao: 'remover' })"
                    />
                    <BarraTurnos
                        :combate="combate"
                        :mestre="mestre"
                        :meus-personagens="meusPersonagens"
                        @anterior="comandoCombate('turno', { sentido: 'anterior' })"
                        @proximo="comandoCombate('turno', { sentido: 'proximo' })"
                        @abrir="((painelTurnos = true), (painelDados = false))"
                    />
                </div>
                <OpcoesFerramenta
                    v-if="(ferramenta === 'pintar' || ferramenta === 'texto') && !painelDados && !painelTurnos"
                    :ferramenta="ferramenta"
                    v-model:estilo="estilo"
                />
                <PainelDados v-if="painelDados" v-model:animacao="animacao" :mestre="mestre" @rolar="rolar" @fechar="painelDados = false" />
                <PainelTurnos
                    v-if="painelTurnos && mestre"
                    :combate="combate"
                    :personagens="personagens"
                    :pagina-id="pagina?.id ?? null"
                    @comando="comandoCombate"
                    @fechar="painelTurnos = false"
                />
                <JanelaDeReacao :janelas="janelasDeReacao" :mestre="mestre" @encerrar="encerrarJanela" />
                <ModalReacao :ofertas="ofertasDeReacao" :ocupado="reagindo" @reagir="reagir" />
                <ModalIniciativa :itens="iniciativasPendentes" :ocupado="false" @rolar="rolarMinhaIniciativa" />
                <BarraLateral v-model:aba="abaLateral" v-model:aberta="lateralAberta" :nao-lidas="naoLidas" :mestre="mestre">
                    <template #chat>
                        <PainelChat
                            :mensagens="mensagens"
                            :meu-id="jogador.id"
                            :visivel="lateralAberta && abaLateral === 'chat'"
                            :mestre="mestre"
                            @enviar="enviarTexto"
                            :alvo-nome="alvoPersonagem?.nome ?? null"
                            :aplicados="aplicadosAoAlvo"
                            :meus-personagens="meusPersonagens"
                            :ocupados="salvaguardasRolando"
                            @gatilho-atacar="(m: Mensagem) => agirNoGatilho(m, () => api.gatilhoAtacar(m.id))"
                            @gatilho-escolher="(m: Mensagem, o: string) => agirNoGatilho(m, () => api.gatilhoEscolher(m.id, o))"
                            @gatilho-ignorar="(m: Mensagem) => agirNoGatilho(m, () => api.gatilhoIgnorar(m.id))"
                            @rolar-salvaguarda="rolarSalvaguarda"
                            @pedir-salvaguarda="pedirSalvaguardaDoEfeito"
                            @efeito-da-municao="efeitoDaMunicaoDoChat"
                            @acao="rolarAcaoDoChat"
                            @aplicar-dano="aplicarDanoDoChat"
                        />
                    </template>
                    <template #personagens>
                        <PainelPersonagens
                            :personagens="personagens"
                            :jogadores="jogadores"
                            :meu-id="jogador.id"
                            :mestre="mestre"
                            :ativo-id="ativoId"
                            :meus-personagens="meusPersonagens"
                            :pagina-de="paginaDe"
                            :com-token="comToken"
                            @abrir="abrirPersonagem"
                            @menu="(id, tela) => (menuPersonagem = { id, ...tela })"
                            @focar="focarPersonagem"
                            @atribuir="pedirAtribuicao"
                            :fogo-amigo="fogoAmigo"
                            @fogo-amigo="alternarFogoAmigo"
                            @criar="novoPersonagemAberto = true"
                        />
                    </template>
                    <template v-if="mestre" #itens>
                        <PainelItens
                            :itens="itensDaMesa.filter((i) => !i.catalogo_id)"
                            :formato="moduloSistema?.formatoDeResumo"
                            :tem-catalogo="!!moduloSistema?.CatalogoDeItens"
                            @editar="abrirEditorItem"
                            @catalogo="catalogoAberto = true"
                        />
                    </template>
                </BarraLateral>

                <form
                    v-if="textoPendente"
                    class="pointer-events-auto absolute z-30"
                    :style="{ left: textoPendente.tela.x + 'px', top: textoPendente.tela.y + 'px' }"
                    @submit.prevent="confirmarTexto"
                >
                    <input
                        v-model="textoPendente.valor"
                        autofocus
                        maxlength="500"
                        placeholder="Digite e pressione Enter…"
                        aria-label="Texto na cena"
                        class="h-9 w-64 rounded-md border border-ouro-400 bg-preto-950 px-3 text-sm text-preto-100 shadow-lg focus-visible:outline-none"
                        @keydown.esc.prevent="textoPendente = null"
                        @blur="confirmarTexto"
                    />
                </form>
            </template>

            <div
                v-if="erro"
                role="alert"
                class="pointer-events-auto absolute left-1/2 top-16 z-30 max-w-md -translate-x-1/2 rounded-md border border-ouro-500/40 bg-preto-900 px-4 py-2 text-sm text-ouro-100 shadow-lg"
            >
                {{ erro }}
            </div>
        </div>

        <!-- Fichas: janelas flutuantes por cima do mapa (arrastar, redimensionar, várias abertas) -->
        <JanelaFlutuante
            v-for="f in personagensAbertos"
            :key="f.id"
            :titulo="`Ficha · ${f.personagem!.nome}`"
            :cor="f.personagem!.cor"
            :x="f.x"
            :y="f.y"
            :largura="tamanhoFicha().largura"
            :altura="tamanhoFicha().altura"
            :z="f.z"
            :class="fichaSobre === f.id ? 'ring-2 ring-ouro-300' : ''"
            @focar="focarFicha(f.id)"
            @fechar="fecharFicha(f.id)"
            @dragenter="itemSobreFicha($event, f.id)"
            @dragover="itemSobreFicha($event, f.id)"
            @dragleave="itemSaiuDaFicha($event, f.id)"
            @drop="soltarItemNaFicha($event, f.id)"
        >
            <div
                v-if="fichaSobre === f.id"
                class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-ouro-500/15 text-sm font-semibold text-ouro-100 backdrop-blur-[1px]"
                role="status"
            >
                Solte para entregar o item a {{ f.personagem!.nome }}
            </div>
            <FichaNaoImplementada v-if="!moduloSistema" :personagem="f.personagem!" :sistema="sistema.nome" />
            <component
                :is="moduloSistema.Ficha"
                v-else-if="fichas[f.id]"
                :personagem="f.personagem!"
                :ficha="fichas[f.id]"
                :itens="itensDaMesa"
                :mestre="mestre"
                v-bind="moduloSistema.slug === 'one-piece' ? { servicos: servicosDaFicha } : {}"
                @editor-item="abrirEditorItem"
                @construtor="construtorId = f.id"
                @acao="(a: AcaoCaracteristica) => executarAcao(f.id, a)"
                @salvar="(campos: Record<string, unknown>) => salvarFicha(f.id, campos)"
                @rolar="(...a: RolagemDaFicha) => rolarDaFicha(f.id, ...a)"
                @usar-tecnica="(uso: UsoDeTecnica) => usarTecnicaDaFicha(f.id, uso)"
            />
            <FichaPrivada v-else :personagem="f.personagem!" />
        </JanelaFlutuante>

        <component
            :is="moduloSistema.Construtor"
            v-if="moduloSistema?.Construtor && construtorPersonagem && fichas[construtorPersonagem.id]"
            :open="true"
            :personagem="construtorPersonagem"
            :ficha="fichas[construtorPersonagem.id]"
            :criacao="criacoes[construtorPersonagem.id] ?? null"
            :salvar="(campos: Record<string, unknown>, criacao: Criacao) => salvarCriacao(construtorPersonagem!.id, campos, criacao)"
            :rolar-atributos="rolarAtributosDaCriacao(construtorPersonagem.id)"
            :rolar-dinheiro="rolarDinheiroDaCriacao(construtorPersonagem.id)"
            :criar-companheiro="criarCompanheiroDoConstrutor"
            @update:open="construtorId = null"
        />

        <MenuPersonagem
            v-if="mestre && menuPersonagem"
            :nome="nomeDoMenu"
            :x="menuPersonagem.x"
            :y="menuPersonagem.y"
            @fechar="menuPersonagem = null"
            @excluir="
                excluindoId = menuPersonagem.id;
                menuPersonagem = null;
            "
        />
        <ExcluirPersonagemDialog
            :open="excluindoId !== null"
            :nome="nomeDoExcluido"
            :ocupado="excluindo"
            @update:open="(v: boolean) => !v && (excluindoId = null)"
            @confirmar="excluirPersonagem"
        />
        <MenuObjeto
            v-if="menuObjeto && objetoDoMenu"
            :objeto="objetoDoMenu"
            :x="menuObjeto.x"
            :y="menuObjeto.y"
            @mover="moverParaCamada"
            @fechar="menuObjeto = null"
        />

        <DadosAnimacao v-if="animacaoAtual" :key="animacaoAtual.id" :mensagem="animacaoAtual" @fim="animacaoAtual = null" />

        <template v-if="mestre">
            <MenuPaginas
                v-model:open="menuAberto"
                :paginas="paginas"
                :pastas="pastas"
                :jogadores="jogadores"
                :pagina-atual-id="pagina?.id ?? null"
                @abrir="abrirPagina"
                @configurar="configurar"
                @nova-pagina="novaPagina"
                @nova-pasta="acao(() => api.criarPasta('Nova pasta'), ['pastas'])()"
                @renomear-pagina="(id, nome) => acao(() => api.atualizarPagina(id, { nome }), ['paginas', 'pagina'])()"
                @excluir-pagina="excluirPagina"
                @mover-para-pasta="(id, pasta) => acao(() => api.atualizarPagina(id, { pasta_id: pasta }), ['paginas'])()"
                @reordenar="reordenar"
                @mover-jogador="moverJogador"
                @trazer-todos="trazerTodos"
                @renomear-pasta="(id, nome) => acao(() => api.atualizarPasta(id, { nome }), ['pastas'])()"
                @excluir-pasta="(id) => acao(() => api.removerPasta(id), ['pastas', 'paginas'])()"
            />
            <ConfigPaginaDialog v-model:open="configAberta" :pagina="configPagina" :erro="configErro" @salvar="salvarConfig" />
            <NovoPersonagemDialog v-model:open="novoPersonagemAberto" :jogadores="jogadores" :criar="criarPersonagem" @criado="aoCriarPersonagem" />
            <AtribuirJogadoresDialog v-model:open="atribuicaoAberta" :personagem="atribuindo" :jogadores="jogadores" @salvar="salvarAtribuicao" />
            <component
                :is="moduloSistema.CatalogoDeItens"
                v-if="moduloSistema?.CatalogoDeItens"
                v-model:open="catalogoAberto"
                :jogadores="jogadoresDaLoja"
                :lojas="lojas"
                :proprios="catalogoDoMestre ?? []"
                :personagens="props.personagens.map((p) => ({ id: p.id, nome: p.nome }))"
                :entregar="entregarDoCatalogo"
                :abrir-loja="abrirLoja"
                :fechar-loja="fecharLoja"
                @editar="abrirEditorDeCatalogo"
            />
            <EditorItemDialog
                v-if="mestre && moduloSistema?.CatalogoDeItens"
                v-model:open="editorCatalogoAberto"
                :item="itemDoEditorDeCatalogo"
                :modulo="moduloSistema"
                :loja="dadosDaLoja"
                :salvar="salvarItemDeCatalogo"
                :excluir="excluirItemDeCatalogo"
            />
            <component
                :is="moduloSistema.Loja"
                v-if="lojaDoJogador && lojaVisivel && moduloSistema?.Loja"
                :loja="lojaDoJogador"
                :personagens="meusPersonagensDaLoja"
                :fichas="fichas"
                :comprar="comprarNaLoja"
                @fechar="lojaVisivel = false"
            />
            <button
                v-if="lojaDoJogador && !lojaVisivel && moduloSistema?.Loja"
                type="button"
                class="fixed bottom-4 right-4 z-40 rounded-full border border-ouro-400 bg-ouro-500 px-4 py-2 text-sm font-semibold text-preto-950 shadow-lg hover:bg-ouro-400"
                @click="lojaVisivel = true"
            >
                Loja aberta
            </button>
            <EditorItemDialog
                v-model:open="editorAberto"
                :item="itemEditando"
                :modulo="moduloSistema"
                :salvar="salvarItem"
                :excluir="excluirItem"
                @salvo="aoSalvarItemOk"
            />
        </template>
    </div>
</template>
