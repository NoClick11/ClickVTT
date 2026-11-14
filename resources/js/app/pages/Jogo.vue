<script setup lang="ts">
import type { Criacao, Jogador, Personagem } from '@/site/types';
import { Head, router } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { apiMesa, ErroApi, medirArquivo } from '../api';
import AlterarFotoPersonagemDialog from '../components/AlterarFotoPersonagemDialog.vue';
import AtribuirJogadoresDialog from '../components/AtribuirJogadoresDialog.vue';
import BarraAtalhos from '../components/BarraAtalhos.vue';
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
import FolhetoDialog from '../components/diario/FolhetoDialog.vue';
import NomeDialog from '../components/diario/NomeDialog.vue';
import NovoFolhetoDialog from '../components/diario/NovoFolhetoDialog.vue';
import DistribuirXpDialog from '../components/DistribuirXpDialog.vue';
import EscolherAlvoDialog, { type AlvoCandidato } from '../components/EscolherAlvoDialog.vue';
import ExcluirPersonagemDialog from '../components/ExcluirPersonagemDialog.vue';
import Inspetor from '../components/Inspetor.vue';
import LootDialog from '../components/LootDialog.vue';
import MenuObjeto from '../components/MenuObjeto.vue';
import MenuPaginas from '../components/MenuPaginas.vue';
import MenuPersonagem from '../components/MenuPersonagem.vue';
import MenuPing from '../components/MenuPing.vue';
import NovoPersonagemDialog from '../components/NovoPersonagemDialog.vue';
import OpcoesFerramenta from '../components/OpcoesFerramenta.vue';
import PainelAlvo from '../components/PainelAlvo.vue';
import PainelChat from '../components/PainelChat.vue';
import PainelConfiguracoes from '../components/PainelConfiguracoes.vue';
import PainelDados from '../components/PainelDados.vue';
import PainelMusica from '../components/PainelMusica.vue';
import PainelPersonagens from '../components/PainelPersonagens.vue';
import PainelTurnos from '../components/PainelTurnos.vue';
import SeletorCamada from '../components/SeletorCamada.vue';
import {
    CAMADAS,
    type Camada,
    type CamposGeometria,
    type EstiloPintura,
    type Ferramenta,
    type InfoMira,
    type LootDto,
    type ObjetoDto,
    type PaginaDto,
    type PontoDeViagem,
    type TipoParede,
} from '../engine/tipos';
import { tocarSomCura, tocarSomDano } from '../nucleo/audio/sonsCombate';
import { avaliarAcao, avaliarAtaque, type CategoriaAcao } from '../nucleo/combate/acoes';
import type { AreaDeEfeito } from '../nucleo/combate/area';
import { podeAtingir } from '../nucleo/combate/equipes';
import type { ItemTurno } from '../nucleo/combate/estado';
import { emCurso, itemAtual, normalizar as normalizarCombate, podeAgirAgora, rodadaParaFicha, semIniciativaDe } from '../nucleo/combate/estado';
import { fatorParaMetros, totalDoTurno } from '../nucleo/combate/movimento';
import { comResumo, semOfertasDe, type OfertaDeReacao, type ResumoEvento } from '../nucleo/combate/reacoes';
import { definirCaminho } from '../nucleo/ficha/caminho';
import { converterParaWebp } from '../nucleo/imagens/webp';
import { arrastandoDaLoja, arrastandoItem, arrastandoPersonagem, itemDaLojaSolto, itemSolto, personagemSolto } from '../nucleo/itens/arrastar';
import EditorItemDialog from '../nucleo/itens/EditorItemDialog.vue';
import PainelItens from '../nucleo/itens/PainelItens.vue';
import type { AcaoDaRolagem } from '../nucleo/rolagem';
import FichaNaoImplementada from '../nucleo/sistemas/FichaNaoImplementada.vue';
import FichaPrivada from '../nucleo/sistemas/FichaPrivada.vue';
import { moduloDoSistema } from '../nucleo/sistemas/registro';
import type { AbrirEditorItem } from '../nucleo/sistemas/tipos';
import { infoDoStatus } from '../nucleo/status';
import type { TempoMesa } from '../nucleo/tempo/tempo';
import CampoNumero from '../nucleo/ui/CampoNumero.vue';
import JanelaFlutuante from '../nucleo/ui/JanelaFlutuante.vue';
import { conectar, type Conexao } from '../realtime';
import type { UsoDeTecnica } from '../sistemas/onepiece/contexto';
import { efeitoDaTecnica, tocarAudioDaTecnica } from '../sistemas/onepiece/efeitosTecnicas';
import type { AcaoCaracteristica } from '../sistemas/onepiece/regras';
import type {
    Combate,
    DiarioDto,
    FolhetoDto,
    ItemDeCatalogoDto,
    ItemDto,
    LojaAbertaDto,
    LojaDoJogadorDto,
    Mensagem,
    MusicaMesaDto,
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
    mesa: {
        id: number;
        slug: string;
        nome: string;
        capa: string | null;
        fogo_amigo?: boolean;
        descanso_curto?: boolean;
        descanso_longo?: boolean;
        subir_nivel?: boolean;
        musica?: MusicaMesaDto | null;
        tempo?: TempoMesa | null;
    };
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
    /** Pastas e folhetos do diário (o jogador só recebe o que foi liberado). */
    diario: DiarioDto;
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
const urlJogo = () => route('jogo', [props.mesa.slug, props.jogador.id], false);
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
const reabrirMenuAoFecharConfig = ref(false);
const configPagina = ref<PaginaDto | null>(null);
const configErro = ref<string | undefined>();
const painelDados = ref(false);
const painelTurnos = ref(false);
const estilo = ref<EstiloPintura>({ cor: '#ef4444', espessura: 4, tamanho: 28 });
const mensagens = ref<Mensagem[]>(copia(props.mensagens));
const combate = ref<Combate>(normalizarCombate(copia(props.combate)));
const musicaMesa = ref<MusicaMesaDto | null>(copia(props.mesa.musica ?? null));
const tempoMesa = ref<TempoMesa>(copia(props.mesa.tempo ?? { dia: 1, hora: 8, minuto: 0 }));
watch(
    () => props.mesa.tempo,
    (novo) => {
        if (novo) tempoMesa.value = copia(novo);
    },
    { deep: true },
);

async function atualizarTempo(novo: TempoMesa) {
    if (!props.mestre) return;
    tempoMesa.value = novo;
    try {
        await api.atualizarTempo(novo);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
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
// As abas Itens, Frutas e Configurações são só do mestre: a de um jogador nunca cai nela.
function abaSalva(): AbaLateral {
    const salva = lerLocal('clickvtt.abaLateral', 'chat');

    return salva === 'personagens' || salva === 'musica' || ((salva === 'itens' || salva === 'frutas' || salva === 'configuracoes') && props.mestre)
        ? salva
        : 'chat';
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

const pendentesObjeto = new Map<number, CamposGeometria>();
function incluirObjeto(novo: ObjetoDto) {
    const idx = objetos.value.findIndex((o) => o.id === novo.id);
    if (idx >= 0) Object.assign(objetos.value[idx], novo);
    else objetos.value.push(novo);
}
watch(
    () => props.objetos,
    (novos) => {
        const lista = copia(novos);
        for (const o of lista) {
            const pendente = pendentesObjeto.get(o.id);
            if (pendente) Object.assign(o, pendente);
        }
        objetos.value = lista;
    },
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
        const res = await api.reagir(eventoId, personagemId, opcao);
        if (res.combate) {
            combate.value = normalizarCombate(res.combate);
        }
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
        const res = await api.encerrarJanela(eventoId);
        if (res.combate) {
            combate.value = normalizarCombate(res.combate);
        }
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
/** Confere se um personagem é um NPC derrotado (0 de vida): não pode ser mirado nem atingido. */
function ehNpcMorto(personagemId: number | null | undefined): boolean {
    if (!personagemId) return false;
    const p = props.personagens.find((x) => x.id === personagemId);
    if (!p) return false;
    if (p.morto) return true;
    const localFicha = typeof fichas !== 'undefined' ? fichas.value?.[personagemId] : undefined;
    const f = (localFicha ?? p.ficha) as Record<string, unknown> | undefined;
    return !!f?.npc && Number((f.pv as { atual?: number } | undefined)?.atual ?? 1) <= 0;
}

/** O alvo do ataque que a ficha manda junto da rolagem: só com o combate em curso e um alvo mirado. */
// Com um alvo travado na mira, todo ataque vai contra ele (rola contra a defesa; no acerto o chat libera o dano), dentro ou fora do combate.
const alvoDoAtaque = computed(() => alvoPersonagem.value?.id ?? null);
provide('alvoDoAtaque', alvoDoAtaque);

// --- alvo (mira) -----------------------------------------------------------------------------------------------
// Cada jogador mira o seu alvo: botão Mirar ou tecla T + clique num token de personagem. O alvo fica travado
// até ser trocado ou limpo e recebe o dano aplicado pelo chat e os efeitos do painel. A mira segue a cor do jogador e é visível a todos.
const alvoObjetoId = ref<number | null>(null);
const mirasPorJogador = ref<Record<number, { objetoId: number | null; cor: string; nome: string }>>({});

watch(
    alvoObjetoId,
    (novoId) => {
        if (props.jogador?.id) {
            mirasPorJogador.value[props.jogador.id] = {
                objetoId: novoId,
                cor: props.jogador.cor ?? '#ef4444',
                nome: props.jogador.nome,
            };
        }
        api.mirar({ objeto_id: novoId, pagina_id: props.pagina?.id }).catch((e) => console.error('Erro ao transmitir mira:', e));
    },
    { immediate: true },
);

watch(
    () => props.pagina?.id,
    () => {
        alvoObjetoId.value = null;
        mirasPorJogador.value = {};
    },
);

const mirasPorObjeto = computed<Record<number, InfoMira[]>>(() => {
    const mapa: Record<number, InfoMira[]> = {};
    for (const [jogIdStr, info] of Object.entries(mirasPorJogador.value)) {
        if (!info.objetoId) continue;
        if (!mapa[info.objetoId]) mapa[info.objetoId] = [];
        mapa[info.objetoId].push({
            jogadorId: Number(jogIdStr),
            cor: info.cor,
            nome: info.nome,
        });
    }
    return mapa;
});

/** A mira foi posta por uma Técnica (o mais perto da área): o painel de aplicar efeito não abre, a Técnica já traz o efeito, a CD e a duração. */
const miraDaTecnica = ref(false);
function miraManual(id: number | null) {
    if (id !== null) {
        const obj = objetos.value.find((o) => o.id === id);
        if (ehNpcMorto(obj?.personagem_id)) {
            avisar('NPCs com 0 de vida não podem ser mirados.');
            return;
        }
    }
    miraDaTecnica.value = false;
    alvoObjetoId.value = id;
}
const alvoObjeto = computed(() => objetos.value.find((o) => o.id === alvoObjetoId.value && o.tipo === 'token') ?? null);
const alvoPersonagem = computed(() => {
    const p = props.personagens.find((x) => x.id === alvoObjeto.value?.personagem_id) ?? null;
    if (ehNpcMorto(p?.id)) return null;
    return p;
});
watch(alvoPersonagem, (p) => {
    if (alvoObjetoId.value !== null && !p) alvoObjetoId.value = null;
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
    if (ehNpcMorto(alvo.id)) return avisar('Este alvo já foi derrotado.');
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

        // NPC com 0 de vida: o token mostra o indicador de morte (tanto para mestre quanto para jogadores)
        const p = props.personagens.find((x) => x.id === o.personagem_id);
        const ehNpc = !p?.jogadores?.length || !!p?.ficha?.npc || !!ficha?.npc;
        const npcMorto = !!p?.morto || (!!ficha?.npc && Number((ficha.pv as { atual?: number } | undefined)?.atual ?? 1) <= 0);

        // Se o token não tiver arquivo próprio definido, usa a foto_token do personagem (ou do modelo de NPC)
        let arquivo = o.arquivo;
        if (!arquivo && p) {
            const instanciaDe = (ficha?.npc as any)?.instancia_de ?? (p.ficha?.npc as any)?.instancia_de;
            const modelo = instanciaDe ? props.personagens.find((m) => m.id === instanciaDe) : null;
            arquivo =
                p.foto_token ||
                p.foto ||
                (ficha as any)?.foto_token ||
                (ficha as any)?.foto ||
                modelo?.foto_token ||
                modelo?.foto ||
                (modelo?.ficha as any)?.foto_token ||
                (modelo?.ficha as any)?.foto ||
                null;
        }

        // sangue só em NPC: a fração vem pública do servidor; a ficha local (mestre) tem prioridade por estar sempre atualizada
        let ferimento = 0;
        if (ehNpc) {
            const pv = ficha?.npc ? (ficha.pv as { atual?: number; max?: number } | undefined) : undefined;
            ferimento = pv && Number(pv.max) > 0 ? Math.min(1, Math.max(0, 1 - Number(pv.atual ?? pv.max) / Number(pv.max))) : (p?.ferimento ?? 0);
        }

        return { ...o, arquivo, status: statusPorPersonagem.value[o.personagem_id] ?? [], barras, morto: npcMorto, npc: ehNpc, ferimento };
    }),
);
watch(
    () => props.combate,
    (c) => (combate.value = normalizarCombate(copia(c))),
);

const selecionado = computed(() => objetos.value.find((o) => o.id === selecionadoId.value) ?? null);
// Um clique num token o torna o personagem ativo (chat, rolagens e a barra de atalhos passam a ser dele); a ficha só abre com duplo clique.
watch(selecionado, (o) => {
    if (!o) configurandoObjetoId.value = null;
    if (o?.tipo !== 'token' || !o.personagem_id) return;
    const p = props.personagens.find((x) => x.id === o.personagem_id);
    if (p && (props.meusPersonagens.includes(p.id) || (props.mestre && p.ficha?.npc))) ativoId.value = p.id;
});
function abrirDoToken(objetoId: number) {
    const o = objetos.value.find((x) => x.id === objetoId);
    if (o?.personagem_id) abrirPersonagem(o.personagem_id);
}

// Controle de vida rápida do token selecionado no mapa (estilo Roll20)
const posTokenSelecionado = ref<{ x: number; y: number; largura: number; altura: number } | null>(null);
const editandoVidaTokenId = ref<number | null>(null);

// Tooltip resumida mecânica estilo Foundry VTT para os efeitos/condições ativas no token
const tooltipStatus = ref<{
    tokenNome: string;
    itens: { id: string; nome: string; icone: string; cor: string; mecanica: string[] }[];
    pos: { x: number; y: number };
} | null>(null);

function aoHoverStatus(dados: { tokenNome: string; statusIds: string[]; tela: { x: number; y: number } } | null) {
    if (!dados || !dados.statusIds.length) {
        tooltipStatus.value = null;
        return;
    }
    const itens = dados.statusIds.map((id) => infoDoStatus(id));
    tooltipStatus.value = {
        tokenNome: dados.tokenNome,
        itens,
        pos: dados.tela,
    };
}

// Menu de contexto de ping acionado pelo botão direito no mapa
const menuPing = ref<{ mundo: { x: number; y: number }; tela: { x: number; y: number } } | null>(null);

function aoMenuPing(mundo: { x: number; y: number }, tela: { x: number; y: number }) {
    menuPing.value = { mundo, tela };
}

/**
 * Barra de turnos: aponta no mapa o token do combatente (um pulso só para quem olhou; ninguém mais vê) e, no clique, leva a
 * câmera até ele sem mexer no zoom. Token que este participante não enxerga (camada do mestre, outra página) não é apontado.
 */
function apontarCombatente(i: ItemTurno, focar: boolean) {
    const token =
        objetos.value.find((o) => o.id === i.objeto_id) ??
        objetos.value.find((o) => o.tipo === 'token' && i.personagem_id !== null && o.personagem_id === i.personagem_id);
    if (!token) return;
    const x = token.x + token.largura / 2;
    const y = token.y + token.altura / 2;
    canvas.value?.tocarPing(x, y, i.cor ?? '#f59e0b');
    if (focar) canvas.value?.centralizarEm(x, y, true);
}

async function aoPing(x: number, y: number, puxar: boolean) {
    if (!props.pagina?.id) return;
    // Toca imediatamente no cliente local
    canvas.value?.tocarPing(x, y, props.jogador.cor ?? '#f59e0b');
    if (puxar) {
        canvas.value?.centralizarEm(x, y, true, 0.65);
    }
    try {
        await api.enviarPing({ pagina_id: props.pagina.id, x, y, puxar });
    } catch (e) {
        console.warn('Falha ao transmitir ping:', e);
    }
}

function atualizarPosicaoTokenSelecionado() {
    if (!selecionadoId.value || !canvas.value) {
        posTokenSelecionado.value = null;
        editandoVidaTokenId.value = null;
        return;
    }
    const o = objetosDaCena.value.find((x) => x.id === selecionadoId.value);
    if (o?.tipo === 'token' && o.personagem_id) {
        posTokenSelecionado.value = (canvas.value as any)?.posicaoTela?.(selecionadoId.value) ?? null;
    } else {
        posTokenSelecionado.value = null;
        editandoVidaTokenId.value = null;
    }
}

watch(selecionadoId, (id) => {
    if (id !== editandoVidaTokenId.value) {
        editandoVidaTokenId.value = null;
    }
    atualizarPosicaoTokenSelecionado();
});

watch(
    () => objetos.value,
    () => {
        atualizarPosicaoTokenSelecionado();
    },
);

const tokenComVida = computed(() => {
    if (!selecionadoId.value || !posTokenSelecionado.value) return null;
    const o = objetosDaCena.value.find((x) => x.id === selecionadoId.value);
    if (!o || o.tipo !== 'token' || !o.personagem_id) return null;
    const p = props.personagens.find((x) => x.id === o.personagem_id);
    if (!p) return null;
    const f = fichas.value[p.id];
    const ehNpcToken = !!(f?.npc ?? (p.ficha as any)?.npc);
    const barraPv = o.barras?.find((b) => b.id === 'pv');
    const barraPp = o.barras?.find((b) => b.id === 'pp');
    const pvAtual = barraPv?.atual ?? (f?.pv as any)?.atual ?? 0;
    const pvMax = barraPv?.max ?? (f?.pv as any)?.max ?? 1;
    const pvTemp = (f?.pv as any)?.temp ?? 0;
    const podeEditarVida = props.mestre || (!ehNpcToken && props.meusPersonagens.includes(p.id));

    // Cálculo da altura das barras desenhadas pelo Pixi acima do token
    const numBarras = (barraPv ? 1 : 0) + (barraPp ? 1 : 0);
    const escala = o.largura > 0 ? posTokenSelecionado.value.largura / o.largura : 1;
    const altBarraMundo = Math.max(13, Math.min(20, o.largura * 0.22));
    const offsetBarras = numBarras > 0 ? (numBarras * (altBarraMundo + 2) + 3) * escala : 2;

    return {
        objetoId: o.id,
        personagemId: p.id,
        nome: p.nome,
        cor: p.cor,
        pvAtual,
        pvMax,
        pvTemp,
        podeEditar: podeEditarVida,
        pos: posTokenSelecionado.value,
        offsetBarras,
    };
});

function salvarVidaToken(personagemId: number, novoPv: number) {
    salvarFicha(personagemId, { 'pv.atual': novoPv });
}

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
// Uma recarga por vez: duas em paralelo podiam chegar fora de ordem, e a mais velha (com a ficha antiga) apagava a mais nova na tela.
// O que for pedido durante uma recarga junta-se num único pedido, disparado quando ela termina.
let recargaEmVoo = false;
let vigiaDaRecarga: ReturnType<typeof setTimeout> | undefined;
const recargaPendente = { chaves: new Set<string>(), aoTerminar: [] as (() => void)[] };
function recarregar(only: string[], extra: { onSuccess?: () => void } = {}) {
    if (recargaEmVoo) {
        for (const k of only) recargaPendente.chaves.add(k);
        if (extra.onSuccess) recargaPendente.aoTerminar.push(extra.onSuccess);

        return;
    }
    recargaEmVoo = true;
    let terminou = false;
    const terminar = () => {
        if (terminou) return;
        terminou = true;
        clearTimeout(vigiaDaRecarga);
        recargaEmVoo = false;
        if (!recargaPendente.chaves.size && !recargaPendente.aoTerminar.length) return;
        const chaves = [...recargaPendente.chaves];
        const avisos = recargaPendente.aoTerminar.splice(0);
        recargaPendente.chaves.clear();
        recarregar(chaves, { onSuccess: () => avisos.forEach((f) => f()) });
    };
    // se a resposta nunca vier (rede caiu no meio), a fila não fica presa
    vigiaDaRecarga = setTimeout(terminar, 20_000);
    router.reload({
        only,
        showProgress: false,
        async: true,
        preserveState: true,
        preserveScroll: true,
        onSuccess: extra.onSuccess,
        onFinish: terminar,
    });
}

// --- objetos -------------------------------------------------------------------

interface MovimentoHistorico {
    objetoId: number;
    personagemId: number | null;
    de: { x: number; y: number };
    para: { x: number; y: number };
}

// Histórico das últimas 3 ações de movimento de tokens para Ctrl+Z
const historicoMovimentos = ref<MovimentoHistorico[]>([]);

function aoAlterar(id: number, campos: CamposGeometria, final: boolean, origem?: { x: number; y: number }) {
    const o = objetos.value.find((x) => x.id === id);
    if (!o) return;
    if (campos.dados) {
        campos.dados = { ...(o.dados ?? {}), ...campos.dados };
    }
    Object.assign(o, campos);
    if (!final) return;

    if (o.tipo === 'token' && origem && (campos.x !== undefined || campos.y !== undefined)) {
        const paraX = campos.x ?? o.x;
        const paraY = campos.y ?? o.y;
        if (Math.hypot(paraX - origem.x, paraY - origem.y) >= 2) {
            historicoMovimentos.value.push({
                objetoId: id,
                personagemId: o.personagem_id,
                de: { x: origem.x, y: origem.y },
                para: { x: paraX, y: paraY },
            });
            if (historicoMovimentos.value.length > 3) {
                historicoMovimentos.value.shift();
            }
        }
    }

    pendentesObjeto.set(id, { ...campos });
    api.atualizarObjeto(id, campos)
        .then((r) => {
            pendentesObjeto.delete(id);
            const atual = objetos.value.find((x) => x.id === id);
            // O servidor tem a palavra final (parede no caminho, deslocamento do turno): se mudou a posição, o token vai para onde ele disse.
            if (atual && (r.x !== campos.x || r.y !== campos.y)) {
                Object.assign(atual, { x: r.x, y: r.y });
                const ultimo = historicoMovimentos.value[historicoMovimentos.value.length - 1];
                if (ultimo && ultimo.objetoId === id) {
                    ultimo.para = { x: r.x, y: r.y };
                }
            }
        })
        .catch((e) => {
            pendentesObjeto.delete(id);
            falhou(e);
        });
}

function desfazerUltimoMovimento() {
    if (!historicoMovimentos.value.length) return;

    // Busca o último movimento elegível (mestre mexe em qualquer token; jogador nos seus personagens)
    let idx = -1;
    for (let i = historicoMovimentos.value.length - 1; i >= 0; i--) {
        const item = historicoMovimentos.value[i];
        const pode = props.mestre || (item.personagemId !== null && props.meusPersonagens.includes(item.personagemId));
        if (pode) {
            idx = i;
            break;
        }
    }
    if (idx === -1) return;

    const [mov] = historicoMovimentos.value.splice(idx, 1);
    const o = objetos.value.find((x) => x.id === mov.objetoId);
    if (!o) return;

    const destino = { x: mov.de.x, y: mov.de.y };
    Object.assign(o, destino);

    // Animação suave deslizando o token de volta no mapa
    (canvas.value as any)?.deslizarObjeto?.(mov.objetoId, destino);

    pendentesObjeto.set(mov.objetoId, destino);
    api.atualizarObjeto(mov.objetoId, { ...destino, reverter_movimento: true })
        .then((r) => {
            pendentesObjeto.delete(mov.objetoId);
            const atual = objetos.value.find((x) => x.id === mov.objetoId);
            if (atual && (r.x !== destino.x || r.y !== destino.y)) Object.assign(atual, { x: r.x, y: r.y });
        })
        .catch((e) => {
            pendentesObjeto.delete(mov.objetoId);
            falhou(e);
        });
}

// Pontos de viagem da mesa (o mestre liga um ao outro): recarrega ao selecionar um ponto e depois de cada ligação.
const pontosDeViagem = ref<PontoDeViagem[]>([]);
async function carregarPontosDeViagem() {
    if (!props.mestre) return;
    try {
        pontosDeViagem.value = (await api.pontosDeViagem()).pontos;
    } catch {
        /* sem a lista o seletor só fica vazio */
    }
}
watch(
    () => (selecionado.value?.tipo === 'viagem' ? selecionado.value.id : null),
    (id) => id !== null && carregarPontosDeViagem(),
);

function atualizarSelecionado(campos: Partial<ObjetoDto>) {
    const o = selecionado.value;
    if (!o) return;
    const { dados, ...resto } = campos;
    Object.assign(o, resto);
    if (dados) o.dados = { ...o.dados, ...dados }; // o servidor também mescla: pontos/tipo nunca se perdem
    api.atualizarObjeto(o.id, campos)
        .then(() => o.tipo === 'viagem' && campos.dados && 'destino_objeto_id' in campos.dados && carregarPontosDeViagem())
        .catch(falhou);
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

// --- memória das áreas vistas (névoa de exploração) --------------------------------------------------------------------------
// Cada jogador guarda no servidor o que já viu em cada página (uma imagem pequena); vale em qualquer aparelho. O mestre apaga a de todos.
const guardarMemoria = (imagem: string) => props.pagina && api.guardarExploracao(props.pagina.id, imagem).catch(() => undefined);
async function pedirMemoria(paginaId: number) {
    try {
        const r = await api.exploracao(paginaId);
        if (props.pagina?.id === paginaId) canvas.value?.carregarMemoria(r.imagem);
    } catch {
        /* sem memória guardada: a névoa começa limpa */
    }
}

// --- loot -----------------------------------------------------------------------------------------------------------------
// Um loot é um objeto do mapa com itens e dinheiro. Quem manda é o servidor: se alguém levou antes, a resposta (409) já traz o conteúdo de
// agora e a janela se corrige. As janelas abertas também se atualizam ao vivo (evento `loot`).
const lootObjetoId = ref<number | null>(null);
const lootEstado = ref<LootDto | null>(null);
const lootAberto = computed({
    get: () => lootObjetoId.value !== null,
    set: (v: boolean) => {
        if (!v) {
            lootObjetoId.value = null;
            lootEstado.value = null;
        }
    },
});
const simboloDaMoeda = computed(() => moduloSistema?.dadosDaLoja?.moeda ?? '');
const personagensDoLoot = computed(() =>
    props.personagens.filter((p) => props.mestre || props.meusPersonagens.includes(p.id)).map((p) => ({ id: p.id, nome: p.nome })),
);
async function abrirLoot(id: number) {
    lootObjetoId.value = id;
    lootEstado.value = null;
    try {
        const estado = await api.abrirLoot(id);
        if (lootObjetoId.value === id) lootEstado.value = estado;
    } catch (e) {
        if (lootObjetoId.value === id) lootObjetoId.value = null;
        avisar(mensagemDe(e));
    }
}
/** O conteúdo mudou (alguém pegou, o mestre mexeu): atualiza a janela se for este loot. */
function aplicarLoot(estado: LootDto) {
    if (estado.objeto_id === lootObjetoId.value) lootEstado.value = estado;
}
async function pegarDoLoot(dados: { personagem_id: number; loot_item_id?: number; dinheiro?: boolean; qtd?: number; tudo?: boolean }) {
    const id = lootObjetoId.value;
    if (id === null) return;
    try {
        const r = await api.pegarDoLoot(id, dados);
        aplicarNaFicha(dados.personagem_id, r.campos);
        recarregar(['itens']);
        aplicarLoot(r.loot);
        avisar(`Você pegou ${r.texto}.`);
    } catch (e) {
        if (e instanceof ErroApi && e.status === 409) {
            // Chegou tarde: mostra o que sobrou e avisa.
            const estado = (e.dados as { loot?: LootDto } | undefined)?.loot;
            if (estado) aplicarLoot(estado);
        } else if (e instanceof ErroApi && e.status === 404) {
            lootObjetoId.value = null; // o loot sumiu ou foi escondido
        }
        avisar(mensagemDe(e));
    }
}
const mestreDoLoot = (fn: (id: number) => Promise<LootDto>) => async () => {
    const id = lootObjetoId.value;
    if (id === null) return;
    try {
        aplicarLoot(await fn(id));
    } catch (e) {
        if (e instanceof ErroApi && e.status === 409) {
            const estado = (e.dados as { loot?: LootDto } | undefined)?.loot;
            if (estado) aplicarLoot(estado);
        }
        avisar(mensagemDe(e));
    }
};
function abrirLootDoMenu() {
    const o = objetoDoMenu.value;
    menuObjeto.value = null;
    if (o) abrirLoot(o.id);
}
async function criarLoot(cx: number, cy: number) {
    if (!props.pagina || !props.mestre) return;
    const lado = props.pagina.tamanho_quadrado;
    try {
        // Nasce na camada ativa se for a dos jogadores; senão fica oculto (camada Mestre) até o mestre abri-lo aos jogadores.
        const r = await api.criarLoot(props.pagina.id, {
            camada: camada.value === 'jogadores' ? 'jogadores' : 'mestre',
            x: cx - lado / 2,
            y: cy - lado / 2,
        });
        incluirObjeto(r.objeto);
        lootObjetoId.value = r.objeto.id;
        lootEstado.value = r.loot;
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function criarViagem(cx: number, cy: number) {
    if (!props.pagina || !props.mestre) return;
    const lado = props.pagina.tamanho_quadrado;
    const alvoCamada: Camada = camada.value === 'jogadores' ? 'jogadores' : 'mestre';
    try {
        const novo = await api.criarObjeto(props.pagina.id, {
            camada: alvoCamada,
            tipo: 'viagem',
            nome: 'Ponto de Viagem',
            x: cx - lado / 2,
            y: cy - lado / 2,
            largura: lado,
            altura: lado,
            dados: {
                cor: '#6366f1',
                destino_pagina_id: null,
            },
        });
        incluirObjeto(novo);
        selecionadoId.value = novo.id;
        avisar('Ponto de viagem criado. Configure o mapa de destino no painel à direita.');
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function usarPontoViagem(id: number) {
    const obj = objetos.value.find((o) => o.id === id);
    if (!obj || obj.tipo !== 'viagem') return;
    const destinoId = obj.dados?.destino_pagina_id;
    if (!destinoId) {
        avisar('Este ponto de viagem ainda não tem um mapa de destino configurado.');
        return;
    }

    // Se for jogador, encontra o token do personagem ativo ou controlado que esteja perto
    let tokenPerto: ObjetoDto | undefined;
    if (!props.mestre) {
        const meusTokens = objetos.value.filter(
            (o) => o.tipo === 'token' && o.personagem_id !== null && props.meusPersonagens.includes(o.personagem_id),
        );
        const tamQuad = props.pagina?.tamanho_quadrado ?? 70;
        const raioMax = tamQuad * 1.75;
        const cxV = obj.x + obj.largura / 2;
        const cyV = obj.y + obj.altura / 2;

        tokenPerto = meusTokens.find((t) => {
            const cxT = t.x + t.largura / 2;
            const cyT = t.y + t.altura / 2;
            return Math.hypot(cxT - cxV, cyT - cyV) <= raioMax;
        });

        if (!tokenPerto && meusTokens.length > 0) {
            avisar('Aproxime seu personagem do ponto de viagem para utilizá-lo.');
            return;
        }
    }

    try {
        const resp = await api.viajar(id, tokenPerto?.personagem_id ?? undefined);
        abrirPagina(resp.destino_pagina_id);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// Botão direito sobre um objeto: menu para movê-lo entre camadas ou configurar (só o mestre).
const menuObjeto = ref<{ id: number; x: number; y: number } | null>(null);
const configurandoObjetoId = ref<number | null>(null);
const abrirMenuObjeto = (id: number, tela: { x: number; y: number }) => (menuObjeto.value = { id, ...tela });
const objetoDoMenu = computed(() => objetos.value.find((o) => o.id === menuObjeto.value?.id) ?? null);
function configurarObjetoDoMenu() {
    if (!menuObjeto.value) return;
    configurandoObjetoId.value = menuObjeto.value.id;
    selecionadoId.value = menuObjeto.value.id;
    menuObjeto.value = null;
}
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
        const arquivoFinal = await converterParaWebp(arquivo);
        const { largura, altura } = await medirArquivo(arquivoFinal);
        const larguraPagina = props.pagina.colunas * props.pagina.tamanho_quadrado;
        const dados = new FormData();
        dados.append('camada', camadaDeDestino());
        dados.append('tipo', 'imagem');
        dados.append('nome', arquivoFinal.name.replace(/\.[^.]+$/, ''));
        dados.append('x', '0');
        dados.append('y', '0');
        dados.append('largura', String(larguraPagina));
        dados.append('altura', String(Math.round((larguraPagina * altura) / largura)));
        dados.append('arquivo', arquivoFinal);
        const novoObj = await api.criarObjeto(props.pagina.id, dados);
        incluirObjeto(novoObj);
        if (novoObj.arquivo && props.pagina) {
            props.pagina.miniatura = novoObj.arquivo;
            const pg = props.paginas.find((p) => p.id === props.pagina?.id);
            if (pg) pg.miniatura = novoObj.arquivo;
        }
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
    const alvoCamada: Camada = props.mestre ? camadaDeDestino() : 'jogadores';
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
        incluirObjeto(await api.criarObjeto(props.pagina.id, corpo));
    } catch (err) {
        avisar(mensagemDe(err));
    }
}

/** Personagem arrastado do painel para o mapa: cria o token dele onde soltou (um token por personagem na página). */
const arrastandoArquivo = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
function personagemSobreMapa(e: DragEvent) {
    if (!props.pagina) return;
    if (props.mestre && arrastandoArquivo(e)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        return;
    }
    if (arrastandoPersonagem(e)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }
}
async function soltarNoMapa(e: DragEvent) {
    if (!props.pagina) return;
    if (props.mestre && arrastandoArquivo(e)) {
        e.preventDefault();
        const arquivos = Array.from(e.dataTransfer?.files ?? []);
        for (const arquivo of arquivos) {
            await enviarMapa(arquivo);
        }
        return;
    }
    if (!arrastandoPersonagem(e)) return;
    e.preventDefault();
    const pid = personagemSolto(e);
    if (!props.mestre && (!pid || !props.meusPersonagens.includes(pid))) {
        return;
    }
    const p = props.personagens.find((x) => x.id === pid);
    if (!p) return;
    const ponto = canvas.value?.pontoDoMundo(e.clientX, e.clientY);
    if (props.mestre && ehModeloDeNpc(p)) {
        // o NPC modelo gera uma cópia nova a cada vez (cada token tem a sua vida)
        try {
            const copiaNpc = await api.instanciarNpc(p.id);
            if (copiaNpc.ficha) fichas.value[copiaNpc.id] = copia(copiaNpc.ficha);
            await criarToken({ nome: copiaNpc.nome, personagem_id: copiaNpc.id, cor: copiaNpc.cor, tamanho: 1, arquivo: null }, ponto);
            recarregar(['personagens', 'meusPersonagens', 'diario']);
        } catch (err) {
            avisar(mensagemDe(err));
        }

        return;
    }
    if (comToken.value.includes(p.id)) {
        focarPersonagem(p.id);

        return avisar(`${p.nome} já tem token nesta página.`);
    }
    await criarToken({ nome: p.nome, personagem_id: p.id, cor: p.cor, tamanho: 1, arquivo: null }, ponto);
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
        reabrirMenuAoFecharConfig.value = menuAberto.value;
        menuAberto.value = false;
        configAberta.value = true;
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

function configurar(id: number) {
    reabrirMenuAoFecharConfig.value = menuAberto.value;
    menuAberto.value = false;
    configPagina.value = props.paginas.find((p) => p.id === id) ?? props.pagina;
    configErro.value = undefined;
    configAberta.value = true;
}

async function limparMemoriaDaPagina(id: number) {
    try {
        await api.limparExploracao(id);
        avisar('A memória das áreas exploradas foi apagada para todos os jogadores.');
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function salvarConfig(id: number, campos: Partial<PaginaDto>) {
    try {
        await api.atualizarPagina(id, campos);
        configAberta.value = false;
        if (reabrirMenuAoFecharConfig.value) {
            reabrirMenuAoFecharConfig.value = false;
            menuAberto.value = true;
        }
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
const tamanhoFicha = (npc = false) =>
    npc
        ? { largura: Math.min(620, window.innerWidth - 32), altura: Math.min(720, window.innerHeight - 76) }
        : { largura: Math.min(940, window.innerWidth - 32), altura: Math.min(700, window.innerHeight - 76) };
/** A ficha é de um NPC (tem o bloco `npc`) e o sistema tem a tela de uma tela só dele. */
const ehNpc = (id: number) => !!moduloSistema?.FichaDeNpc && !!fichas.value[id]?.npc;
/** A ficha é de um navio (tem o bloco `navio`): janela própria, que toda a mesa abre. */
const ehNavio = (id: number) => !!moduloSistema?.FichaDeNavio && !!fichas.value[id]?.navio;
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

// --- efeito audiovisual de dano / cura flutuante -----------------------------
const efeitosExibidos = new Map<string, number>();

function exibirEfeitoCombate(personagemId: number, delta: number, tipoForcado?: 'dano' | 'cura') {
    if (delta === 0) return;
    const chave = `${personagemId}:${delta}`;
    const agora = Date.now();
    const ultimo = efeitosExibidos.get(chave) ?? 0;
    if (agora - ultimo < 600) return;
    efeitosExibidos.set(chave, agora);

    const tipo: 'dano' | 'cura' = tipoForcado ?? (delta < 0 ? 'dano' : 'cura');
    const valor = Math.abs(delta);
    const texto = tipo === 'dano' ? `-${valor}` : `+${valor}`;

    // Acha o token no mapa atual
    const token = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === personagemId);
    if (token) {
        const x = token.x + token.largura / 2;
        const y = token.y;
        canvas.value?.mostrarTextoFlutuante(x, y, texto, tipo);
    }

    if (tipo === 'dano') {
        tocarSomDano();
    } else {
        tocarSomCura();
    }
}

const pvAnteriorPorPersonagem = new Map<number, number>();

function rastrearPvPersonagem(personagemId: number, ficha: Record<string, unknown> | undefined) {
    if (!ficha) return;
    const pvObj = (ficha.pv as { atual?: number; temp?: number; escudo?: number } | undefined) ?? {};
    const pvAtual = (pvObj.atual ?? 0) + (pvObj.temp ?? 0) + (pvObj.escudo ?? 0);
    const pvAntigo = pvAnteriorPorPersonagem.get(personagemId);
    pvAnteriorPorPersonagem.set(personagemId, pvAtual);

    if (pvAntigo !== undefined && pvAntigo !== pvAtual) {
        exibirEfeitoCombate(personagemId, pvAtual - pvAntigo);
    }
}

// --- dados das fichas ----------------------------------------------------------
// O servidor só envia a ficha a quem controla o personagem (mestre e donos). Aqui fica uma cópia local:
// edições são aplicadas na hora (otimista), enviadas campo a campo e, se falharem, a tela volta ao estado do servidor.
const fichas = ref<Record<number, Record<string, unknown>>>({});
/**
 * Edições locais ainda a caminho do servidor (ou recém-confirmadas). Uma recarga de `personagens` pedida ANTES de o salvamento
 * terminar traz a ficha velha: sem isto ela desfazia na tela o que o jogador acabou de mudar (PP gasto, descanso, campo editado).
 * Enquanto a edição é recente, ela é reaplicada por cima do que a recarga trouxe.
 */
const edicoesRecentes = new Map<number, { campos: Record<string, unknown>; fim: number | null }[]>();
const VALIDADE_DA_EDICAO = 4000;
let temporizadorConvergir: ReturnType<typeof setTimeout> | undefined;
function sincronizarFichas() {
    const novas: Record<number, Record<string, unknown>> = {};
    const agora = Date.now();
    let reaplicou = false;
    for (const p of props.personagens) {
        if (p.ficha) {
            novas[p.id] = copia(p.ficha);
            const recentes = (edicoesRecentes.get(p.id) ?? []).filter((e) => e.fim === null || agora - e.fim < VALIDADE_DA_EDICAO);
            if (recentes.length) edicoesRecentes.set(p.id, recentes);
            else edicoesRecentes.delete(p.id);
            for (const e of recentes) {
                for (const [caminho, valor] of Object.entries(e.campos)) definirCaminho(novas[p.id], caminho, copia(valor));
                reaplicou = true;
            }
            rastrearPvPersonagem(p.id, novas[p.id]);
        }
    }
    // a recarga pode ter vindo de antes do salvamento: depois que as edições assentarem, busca o estado final do servidor
    if (reaplicou) {
        clearTimeout(temporizadorConvergir);
        temporizadorConvergir = setTimeout(() => recarregar(['personagens']), VALIDADE_DA_EDICAO + 1500);
    }
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
    rastrearPvPersonagem(personagemId, ficha);
    const edicao = { campos: copia(campos), fim: null as number | null };
    edicoesRecentes.set(personagemId, [...(edicoesRecentes.get(personagemId) ?? []), edicao]);
    const fila = (filasFicha.get(personagemId) ?? Promise.resolve())
        .then(() => api.salvarFicha(personagemId, campos))
        .then(() => {
            edicao.fim = Date.now();
            // o "aliado" do NPC é público (a área dos jogadores o consulta): traz a lista de personagens de volta
            if ('aliado' in campos) recarregar(['personagens']);
        })
        .catch((e) => {
            // o servidor recusou: a edição sai da frente e a tela volta ao que está salvo, com o motivo no aviso
            edicoesRecentes.set(
                personagemId,
                (edicoesRecentes.get(personagemId) ?? []).filter((x) => x !== edicao),
            );
            avisar(`Não foi possível salvar a ficha: ${mensagemDe(e)}`);
            recarregar(['personagens']);
        });
    filasFicha.set(personagemId, fila);
}
/** Outro participante (ou outra aba) alterou a ficha: aplica os mesmos campos. */
function aoMudarFicha(e: { personagem_id: number; campos: Record<string, unknown>; ator: number; socket?: string | null }) {
    const ficha = fichas.value[e.personagem_id];
    if (deMim(e) || !ficha) return;
    for (const [caminho, valor] of Object.entries(e.campos)) definirCaminho(ficha, caminho, copia(valor));
    rastrearPvPersonagem(e.personagem_id, ficha);
    // a carga do navio é de todos: um item que alguém guardou pode ser novo para este jogador
    if (ficha.navio && 'inventario' in e.campos) recarregar(['itens']);
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
    dano?: { tipo: string | null; fator?: number; fonte?: string },
    acao?: { categoria: string; tecnica?: boolean },
    alvoPersonagemId?: number | null,
    tecnica?: {
        nome: string;
        dano?: { expressao: string; tipo: string | null } | null;
        secundaria?: object | null;
        semTecnica?: boolean;
        margem?: number;
        alcance?: number;
        alcanceNormal?: number;
    },
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
export interface InfoGabaritoArea {
    medida: { forma: 'linha' | 'cone' | 'esfera'; metros: number; angulo: number };
    origem: { x: number; y: number };
    mpp: number;
}
export type ResultadoGabarito = number[] & { info?: InfoGabaritoArea | null };

const gabarito = ref<{ area: AreaDeEfeito; origem: number; excluir?: number[] } | null>(null);
let resolverGabarito: ((r: ResultadoGabarito | null) => void) | null = null;
function aoGabarito(ids: number[] | null, info?: InfoGabaritoArea | null) {
    gabarito.value = null;
    if (ids === null) {
        resolverGabarito?.(null);
    } else {
        const res = [...ids] as ResultadoGabarito;
        res.info = info;
        resolverGabarito?.(res);
    }
    resolverGabarito = null;
}
const escolherNaArea = (area: AreaDeEfeito, origem: number, excluir: number[]) =>
    new Promise<ResultadoGabarito | null>((resolver) => {
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
// --- liberações do mestre (descansos e subir de nível) e distribuição de XP ----------------------------------------------------
const liberacoes = computed(() => ({
    descanso_curto: !!props.mesa.descanso_curto,
    descanso_longo: !!props.mesa.descanso_longo,
    subir_nivel: !!props.mesa.subir_nivel,
}));
/** O que a ficha do jogador precisa saber: o mestre não é barrado, então o front só usa isto para os jogadores. */
const permissoesDaMesa = computed(() => ({
    descansoCurto: liberacoes.value.descanso_curto,
    descansoLongo: liberacoes.value.descanso_longo,
    subirNivel: liberacoes.value.subir_nivel,
}));
const alterarLiberacao = (chave: 'descanso_curto' | 'descanso_longo' | 'subir_nivel', ligado: boolean) =>
    acao(() => api.liberacoes({ [chave]: ligado }), ['mesa'])();
const xpAberto = ref(false);
const personagensDosJogadores = computed(() => props.personagens.filter((p) => p.jogadores.length > 0));
const distribuirXp = async (ids: number[], total: number) => {
    const r = await api.distribuirXp(ids, total);
    recarregar(['personagens']);

    return r;
};

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
/** Os tokens que a Técnica de quem usa NÃO pode atingir (jogador, aliado, NPC com 0 de vida...): a área não os conta nem destaca. */
const protegidosDe = (personagemId: number) =>
    objetos.value
        .filter(
            (o) =>
                o.tipo === 'token' &&
                o.personagem_id !== null &&
                (!podeAtingir(fogoAmigo.value, ladoDe(personagemId), ladoDe(o.personagem_id)) || ehNpcMorto(o.personagem_id)),
        )
        .map((o) => o.id);
/** Verifica se uma Técnica afeta apenas um alvo único, mesmo que seu alcance seja em linha ou área. */
function tecnicaEhAlvoUnico(nome: string, descricao?: string): boolean {
    const n = nome.toLowerCase();
    if (
        n.includes('prison whip') ||
        n.includes('power whip') ||
        n.includes('laço de dominação') ||
        n.includes('laco de dominacao') ||
        n.includes('pain whip')
    ) {
        return true;
    }
    if (descricao) {
        if (/cada criatura na área/i.test(descricao) || /todos os inimigos/i.test(descricao)) return false;
        if (/uma criatura|única contra um alvo|o alvo atingido|contra um alvo/i.test(descricao)) return true;
    }
    return false;
}

const alvoDialogConfig = ref<{
    open: boolean;
    tecnicaNome: string;
    alvos: AlvoCandidato[];
    resolver: ((id: number | null) => void) | null;
}>({
    open: false,
    tecnicaNome: '',
    alvos: [],
    resolver: null,
});

function pedirEscolhaDeAlvo(tecnicaNome: string, alvos: AlvoCandidato[]): Promise<number | null> {
    return new Promise((resolver) => {
        alvoDialogConfig.value = {
            open: true,
            tecnicaNome,
            alvos,
            resolver,
        };
    });
}

function aoEscolherAlvo(id: number) {
    const res = alvoDialogConfig.value.resolver;
    alvoDialogConfig.value.open = false;
    alvoDialogConfig.value.resolver = null;
    res?.(id);
}

function aoCancelarEscolhaAlvo() {
    const res = alvoDialogConfig.value.resolver;
    alvoDialogConfig.value.open = false;
    alvoDialogConfig.value.resolver = null;
    res?.(null);
}

/**
 * Marca a área da Técnica no mapa e devolve os personagens atingidos (do mais perto ao mais longe), ou null (cancelou, sem token no mapa ou
 * ninguém dentro). O mais perto vira o alvo mirado: o ataque e o "Aplicar" do chat o usam.
 */
async function escolherAreaDaFicha(personagemId: number, area: AreaDeEfeito): Promise<ResultadoGabarito | null> {
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

    const alvosVivos = alvos.filter((id) => !ehNpcMorto(id));
    if ((alvos as any).info) (alvosVivos as any).info = (alvos as any).info;

    if (alvosVivos.length) {
        const maisPerto = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === alvosVivos[0]);
        if (maisPerto) {
            alvoObjetoId.value = maisPerto.id;
            miraDaTecnica.value = true;
        }
    }

    return alvosVivos as ResultadoGabarito;
}

/** Dispara o efeito visual e sonoro da técnica no mapa (o áudio toca apenas uma vez no início). */
function dispararEfeitoAudiovisual(
    personagemId: number,
    uso: UsoDeTecnica,
    alvos?: ResultadoGabarito | number[] | null,
    infoArea?: InfoGabaritoArea | null,
) {
    const efeito = efeitoDaTecnica(uso.nomeBase ?? uso.nome);
    if (!efeito) return;

    // 1. Áudio da técnica: toca apenas uma única vez na ativação (nunca em loop)
    tocarAudioDaTecnica(efeito.audio);

    // 2. Coordenadas de origem (o personagem que está usando a técnica)
    const origem = centroDoToken(personagemId);
    if (!origem) return;

    const info = infoArea ?? ((alvos as any)?.info as InfoGabaritoArea | undefined);
    const mpp =
        info?.mpp ??
        ((props.pagina?.distancia_quadrado ?? 1.5) * fatorParaMetros(props.pagina?.unidade)) / Math.max(1, props.pagina?.tamanho_quadrado ?? 100);

    // Identifica o alvo mirado (seja pelo atalho 'T', alvo na área ou objeto selecionado):
    let destino: { x: number; y: number } | null = null;
    const alvoId = (Array.isArray(alvos) && alvos.length ? alvos[0] : null) ?? alvoPersonagem.value?.id;
    if (alvoId) {
        destino = centroDoToken(alvoId);
    } else if (alvoObjetoId.value) {
        const obj = objetos.value.find((o) => o.id === alvoObjetoId.value);
        if (obj) destino = { x: obj.x + obj.largura / 2, y: obj.y + obj.altura / 2 };
    }

    // 1. Efeitos em volta do alvo ou ponto escolhido (ex: Prison Whip, Sonic Boom):
    if (efeito.posicao === 'alvo') {
        const ehSonic = (uso.nomeBase ?? uso.nome).includes('Sonic Boom');
        const pos = ehSonic && info?.origem ? info.origem : (destino ?? info?.origem ?? origem);
        const metros = info?.medida?.metros ?? uso.area?.metros;
        let tamanhoPx = efeito.tamanho ?? 260;
        if (metros && (info?.medida?.forma === 'esfera' || uso.area?.forma === 'esfera' || ehSonic)) {
            const diametroPx = (metros / mpp) * 2;
            const fatorEnquadramento = ehSonic ? 256 / 236 : 1.0;
            tamanhoPx = diametroPx * fatorEnquadramento;
        }

        canvas.value?.tocarEfeito(pos.x, pos.y, efeito.animacao, {
            largura: tamanhoPx,
            altura: tamanhoPx,
            duracaoMs: efeito.duracaoMs,
            ancoraX: 0.5,
            ancoraY: 0.5,
        });
        return;
    }

    // 2. Efeito pessoal (buff ou cúpula centralizada no próprio conjurador):
    if (efeito.posicao === 'pessoal') {
        const metros = info?.medida?.metros ?? uso.area?.metros;
        let larguraPx = efeito.tamanho ?? 220;
        let alturaPx = larguraPx;

        if (metros && (info?.medida?.forma === 'esfera' || uso.area?.forma === 'esfera' || (uso.nomeBase ?? uso.nome).includes('Círculo da Morte'))) {
            // Esfera ocupa todo o alcance/raio (diâmetro em pixels)
            const diametroPx = (metros / mpp) * 2;
            const fatorEnquadramento = (uso.nomeBase ?? uso.nome).includes('Círculo da Morte') ? 256 / 236 : 1.0;
            larguraPx = diametroPx * fatorEnquadramento;
            alturaPx = larguraPx;
        }

        canvas.value?.tocarEfeito(origem.x, origem.y, efeito.animacao, {
            largura: larguraPx,
            altura: alturaPx,
            duracaoMs: efeito.duracaoMs,
            ancoraX: 0.5,
            ancoraY: 0.5,
        });
        return;
    }

    // 3. Efeitos de origem para alvo / projeção (cone, linha, disparo, chicotada):
    if (info && info.medida.forma === 'cone') {
        // Cones sempre ocupam todo o cone a partir do conjurador
        const comprimentoPx = info.medida.metros / info.mpp;
        canvas.value?.tocarEfeito(origem.x, origem.y, efeito.animacao, {
            largura: comprimentoPx,
            altura: comprimentoPx,
            duracaoMs: efeito.duracaoMs,
            rotacao: info.medida.angulo,
            ancoraX: 0.0,
            ancoraY: 0.5,
        });
        return;
    }

    // Para ataques direcionados (ex: Laço de Dominação, tiros, chicotadas):
    // Se há um alvo sendo mirado, o efeito vai da origem até o token mirado
    if (destino) {
        const dx = destino.x - origem.x;
        const dy = destino.y - origem.y;
        const dist = Math.hypot(dx, dy);
        const rotacao = Math.atan2(dy, dx);
        // O laço foi desenhado com o nó/laço em x=350 num quadro de 400px; escala para coincidir com o alvo:
        const ehLaco = (uso.nomeBase ?? uso.nome).includes('Laço');
        const largura = ehLaco ? Math.max(efeito.tamanho ?? 240, dist * (400 / 350)) : Math.max(efeito.tamanho ?? 240, dist * 1.05);
        const altura = Math.max(120, Math.min(largura * 0.5, 300));

        canvas.value?.tocarEfeito(origem.x, origem.y, efeito.animacao, {
            largura,
            altura,
            duracaoMs: efeito.duracaoMs,
            rotacao,
            ancoraX: 0.0,
            ancoraY: 0.5,
        });
        return;
    }

    // Se foi marcada uma linha no mapa sem alvo mirado:
    if (info && info.medida.forma === 'linha') {
        const comprimentoPx = info.medida.metros / info.mpp;
        const larguraPx = comprimentoPx;
        const alturaPx = Math.max(1.5 / info.mpp, 70);
        canvas.value?.tocarEfeito(origem.x, origem.y, efeito.animacao, {
            largura: larguraPx,
            altura: alturaPx,
            duracaoMs: efeito.duracaoMs,
            rotacao: info.medida.angulo,
            ancoraX: 0.0,
            ancoraY: 0.5,
        });
        return;
    }

    // Disparo em linha reta padrão se não houver alvo mirado nem área
    const alcancePadrao = efeito.tamanho ?? 240;
    canvas.value?.tocarEfeito(origem.x, origem.y, efeito.animacao, {
        largura: alcancePadrao,
        altura: Math.min(alcancePadrao * 0.6, 180),
        duracaoMs: efeito.duracaoMs,
        rotacao: 0,
        ancoraX: 0.0,
        ancoraY: 0.5,
    });
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
            dispararEfeitoAudiovisual(personagemId, uso, null);

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
            dispararEfeitoAudiovisual(personagemId, uso, null);

            return;
        }
        let alvos: ResultadoGabarito | number[] | null = null;
        let infoGabarito: InfoGabaritoArea | null = null;

        if ((uso.nomeBase ?? uso.nome).includes('Sonic Boom')) {
            const de = centroDoToken(personagemId);
            if (!de) return avisar('Coloque o seu token no mapa para marcar a área.');
            avisar('Escolha o ponto da explosão (até 21 m): clique para confirmar, Esc cancela.');
            const centro = await escolherPonto({ de, maximo: 21, raio: 6 });
            erro.value = null;
            if (!centro) return;
            const mpp =
                ((props.pagina?.distancia_quadrado ?? 1.5) * fatorParaMetros(props.pagina?.unidade)) /
                Math.max(1, props.pagina?.tamanho_quadrado ?? 100);
            const raioPx = 6 / mpp;
            const protegidos = new Set(protegidosDe(personagemId));
            const atingidos = objetos.value
                .filter((o) => o.tipo === 'token' && o.personagem_id !== null && o.personagem_id !== personagemId && !protegidos.has(o.id))
                .filter((o) => {
                    const cx = o.x + o.largura / 2;
                    const cy = o.y + o.altura / 2;
                    const distPx = Math.hypot(cx - centro.x, cy - centro.y);
                    const raioToken = Math.min(o.largura, o.altura) / 2;
                    return distPx <= raioPx + raioToken;
                })
                .map((o) => o.personagem_id as number);

            infoGabarito = {
                medida: { forma: 'esfera', metros: 6, angulo: 0 },
                origem: centro,
                mpp,
            };
            const res = atingidos as ResultadoGabarito;
            res.info = infoGabarito;
            alvos = res;
        } else if (uso.area) {
            alvos = await escolherAreaDaFicha(personagemId, uso.area);
            if (!alvos) return;
            infoGabarito = (alvos as any)?.info ?? null;
        }

        // Se a técnica for de alvo único e houver mais de um alvo atingido na área:
        if (alvos && alvos.length > 1 && tecnicaEhAlvoUnico(uso.nomeBase ?? uso.nome, uso.descricao)) {
            const candidatos: AlvoCandidato[] = alvos
                .filter((id) => !ehNpcMorto(id))
                .map((id) => {
                    const p = props.personagens.find((x) => x.id === id);
                    const token = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === id);
                    if (!p) return null;
                    return {
                        id: p.id,
                        nome: p.nome,
                        imagem: token?.arquivo ?? p.avatar ?? null,
                        cor: p.cor,
                        pvAtual: p.ficha?.pv?.atual,
                        pvMax: p.ficha?.pv?.maximo,
                    };
                })
                .filter((c): c is AlvoCandidato => c !== null);

            if (candidatos.length > 1) {
                const escolhidoId = await pedirEscolhaDeAlvo(uso.nome, candidatos);
                if (!escolhidoId) return; // jogador cancelou
                alvos = [escolhidoId];
                if (infoGabarito) (alvos as any).info = infoGabarito;
                const tokenEscolhido = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === escolhidoId);
                if (tokenEscolhido) {
                    alvoObjetoId.value = tokenEscolhido.id;
                    miraDaTecnica.value = true;
                }
            }
        }

        const teste = uso.teste;
        // sem área, a Salvaguarda vale para o alvo mirado: confere antes de gastar
        if (teste?.tipo === 'salvaguarda' && !alvos && !alvoPersonagem.value) return avisar('Mire um alvo.');
        if (!(await gastarAcaoDoCombate(personagemId, uso.categoria, true))) return;
        if (uso.municao) await api.gastarMunicaoDaTecnica(personagemId, uso.municao.tecnica); // sem munição o servidor recusa e os PP não são gastos
        salvarFicha(personagemId, uso.camposDosPP);
        dispararEfeitoAudiovisual(personagemId, uso, alvos, infoGabarito);

        if (teste?.tipo === 'salvaguarda' && teste.atributo) {
            const alvosDaSalvaguarda = alvos ?? (alvoPersonagem.value ? [alvoPersonagem.value.id] : []);
            if (alvosDaSalvaguarda.length > 0) {
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
            }
        } else if (teste?.tipo === 'ataque') {
            const dados = uso.modoAtaque === 'vantagem' ? '2d20kh1' : uso.modoAtaque === 'desvantagem' ? '2d20kl1' : '1d20';
            await rolarDaFicha(
                personagemId,
                uso.ataqueFixo ? `${dados}${uso.ataqueFixo.bonus >= 0 ? '+' : ''}${uso.ataqueFixo.bonus}` : `${dados}+@ataque`,
                uso.modoAtaque ? `${uso.nome} (${uso.modoAtaque})` : uso.nome,
                undefined,
                undefined,
                undefined,
                alvoDoAtaque.value,
                {
                    nome: uso.nomeBase ?? uso.nome,
                    dano: uso.dano,
                    ...(uso.secundaria ? { secundaria: uso.secundaria } : {}),
                    ...(uso.ataqueFixo ? { ataque: true, ...(uso.ataqueFixo.margemCritica ? { margem: uso.ataqueFixo.margemCritica } : {}) } : {}),
                },
            );
        } else if (uso.dano) {
            await rolarDaFicha(personagemId, uso.dano.expressao, uso.nome, undefined, uso.dano.tipo ? { tipo: uso.dano.tipo } : undefined);
            // danos extras de outro tipo (Fogo do Diable Jambe...): cada um rola à parte, com o próprio tipo
            for (const extra of uso.dano.extras ?? []) {
                await rolarDaFicha(
                    personagemId,
                    extra.expressao,
                    `${uso.nome} (${extra.tipo ?? 'extra'})`,
                    undefined,
                    extra.tipo ? { tipo: extra.tipo, fonte: 'black-leg' } : undefined,
                );
            }
        }
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// --- Barra de atalhos (macros) --------------------------------------------------------------------------------------------
// NPC: tudo da ficha (ataques, técnicas, salvaguardas, perícias, testes). Jogador: os ataques com arma e as técnicas que ele fixou na ficha.
const chaveFixados = (id: number) => `clickvtt.atalhos.${props.mesa.id}.${id}`;
const fixadosSalvos = ref<Record<number, string[]>>({});
function fixadosDe(id: number): string[] {
    if (id in fixadosSalvos.value) return fixadosSalvos.value[id];
    try {
        const v = JSON.parse(lerLocal(chaveFixados(id), '[]'));

        return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : [];
    } catch {
        return [];
    }
}
provide('atalhosFixados', {
    tem: (id: number, nome: string) => fixadosDe(id).includes(nome),
    alternar: (id: number, nome: string) => {
        const atuais = fixadosDe(id);
        const novos = atuais.includes(nome) ? atuais.filter((n) => n !== nome) : [...atuais, nome].slice(0, 20);
        fixadosSalvos.value = { ...fixadosSalvos.value, [id]: novos };
        gravarLocal(chaveFixados(id), JSON.stringify(novos));
    },
});
/** A ficha invisível do personagem ativo: é por ela que a barra usa as técnicas (a lógica de custo, área e munição é da ficha). */
const executorDeTecnicas = ref<{ usarTecnicaPorNome?: (nome: string) => string | null } | null>(null);
const executorPersonagem = computed(() => {
    const a = ativo.value;
    if (!a || !moduloSistema?.atalhos || !fichas.value[a.id] || fichas.value[a.id].npc) return null;

    return a;
});
const atalhosDoAtivo = computed(() => {
    const a = ativo.value;
    const ficha = a ? fichas.value[a.id] : null;
    if (!a || !ficha || !moduloSistema?.atalhos) return [];

    try {
        return moduloSistema.atalhos({
            personagemId: a.id,
            ficha,
            itens: itensPorIdDaMesa.value,
            mestre: props.mestre,
            alvo: alvoDoAtaque.value,
            rolar: (...argumentos) => void rolarDaFicha(a.id, ...(argumentos as RolagemDaFicha)),
            salvar: (campos) => salvarFicha(a.id, campos),
            usarTecnica: (uso) => void usarTecnicaDaFicha(a.id, uso as UsoDeTecnica),
            usarTecnicaPorNome: (nome) => executorDeTecnicas.value?.usarTecnicaPorNome?.(nome) ?? 'A ficha ainda está carregando.',
            fixados: fixadosDe(a.id),
            abrirFicha: () => abrirPersonagem(a.id),
            avisar,
        });
    } catch (e) {
        console.warn('Falha ao montar atalhos do personagem ativo', e);

        return [];
    }
});

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

/** Card de Dano Brutal: rolar Salvaguarda de CON CD 16, aplicar ou ignorar. */
async function agirNoDanoBrutal(mensagem: Mensagem, chamada: () => Promise<Mensagem>) {
    const chave = `b${mensagem.id}`;
    if (salvaguardasRolando.value.includes(chave)) return;
    salvaguardasRolando.value = [...salvaguardasRolando.value, chave];
    try {
        aoNovaMensagem(await chamada(), true);
        recarregar(['personagens']);
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
const lojaDoJogador = ref<LojaDoJogadorDto | null>(copia(props.lojaDoJogador ?? null));
watch(
    () => props.lojaDoJogador,
    (l) => {
        lojaDoJogador.value = copia(l ?? null);
        if (l) lojaVisivel.value = true;
    },
    { deep: true },
);
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
    props.personagens
        .filter((p) => !p.navio && !p.ficha?.npc && !fichas.value[p.id]?.npc && props.meusPersonagens.includes(p.id))
        .map((p) => ({ id: p.id, nome: p.nome })),
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

// --- diário: pastas e folhetos -------------------------------------------------
const pastaDialog = ref<{ id: number | null } | null>(null);
const nomeDaPasta = computed(() => props.diario.pastas.find((p) => p.id === pastaDialog.value?.id)?.nome ?? '');
const salvarPasta = (nome: string) => {
    const id = pastaDialog.value?.id ?? null;
    acao(() => (id === null ? api.criarPastaDoDiario(nome) : api.atualizarPastaDoDiario(id, { nome })), ['diario'])();
};
const novoFolhetoAberto = ref(false);
const criarFolheto = async (dados: FormData) => {
    const f = await api.criarFolheto(dados);
    recarregar(['diario']);

    return f;
};
const folhetoAberto = ref<FolhetoDto | null>(null);
// o folheto aberto acompanha o que o mestre mudar (nome, texto) e fecha se ele o esconder ou excluir
watch(
    () => props.diario.folhetos,
    (lista) => {
        if (!folhetoAberto.value) return;
        const atual = lista.find((f) => f.id === folhetoAberto.value!.id);
        folhetoAberto.value = atual ?? null;
    },
);
const salvarFolheto = (id: number, campos: { nome?: string; texto?: string | null; visivel?: boolean }) =>
    acao(() => api.atualizarFolheto(id, campos), ['diario'])();
const excluirFolheto = (id: number) => {
    folhetoAberto.value = null;
    acao(() => api.excluirFolheto(id), ['diario'])();
};

// --- NPCs (mestre) --------------------------------------------------------------------------------------------------------
// O NPC do catálogo (ou em branco) vira um personagem da mesa com a ficha de uma tela só. Arrastá-lo para o mapa cria uma CÓPIA
// com PV, PP e usos próprios (nome numerado); a cópia some com o último token.
const novoNpcAberto = ref(false);
async function criarNpc(nome: string, campos: Record<string, unknown>) {
    try {
        const p = await api.criarNpc(nome, campos);
        recarregar(['personagens', 'meusPersonagens', 'diario'], { onSuccess: () => abrirPersonagem(p.id) });
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
// --- navios (ficha de toda a mesa: obras, tesouro, carga e tripulação) ------------------------------------------------
const novoNavioAberto = ref(false);
async function criarNavio(dados: { nome: string; modelo?: string | null; tamanho?: string; madeira?: string }) {
    try {
        const p = await api.criarNavio(dados);
        novoNavioAberto.value = false;
        if (p.ficha) fichas.value[p.id] = copia(p.ficha);
        recarregar(['personagens', 'meusPersonagens'], { onSuccess: () => abrirPersonagem(p.id) });
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
/**
 * Ação na ficha do navio: o servidor valida, debita e move; aqui só se aplica o que voltou (no navio e no personagem que mudou
 * junto). Devolve o motivo quando o servidor recusa, para a ficha mostrar ao lado do botão.
 */
async function acaoDoNavio(navioId: number, nome: string, dados: Record<string, unknown> = {}): Promise<string | null> {
    try {
        const r = await api.acaoDoNavio(navioId, nome, dados);
        aplicarNaFicha(r.personagem_id, r.campos);
        if (r.outro) aplicarNaFicha(r.outro.personagem_id, r.outro.campos);
        if (nome === 'guardar' || nome === 'retirar') recarregar(['itens']);

        return null;
    } catch (e) {
        return mensagemDe(e);
    }
}
/** Os personagens que este participante pode usar na carga e no tesouro do navio (os dele; o mestre, os dos jogadores). */
const personagensParaONavio = computed(() =>
    props.personagens
        .filter((p) => !p.navio && !fichas.value[p.id]?.npc && fichas.value[p.id] && props.meusPersonagens.includes(p.id) && p.jogadores.length > 0)
        .map((p) => ({ id: p.id, nome: p.nome, ficha: fichas.value[p.id] })),
);
/** Quem pode entrar na tripulação ligado a um personagem da mesa (todos os personagens de jogador, pelo nome). */
const tripulaveis = computed(() => props.personagens.filter((p) => !p.navio && p.jogadores.length > 0).map((p) => ({ id: p.id, nome: p.nome })));

/** O NPC que serve de modelo (as cópias do mapa têm `instancia_de`). */
const ehModeloDeNpc = (p: Personagem) => !!(p.ficha?.npc && !(p.ficha.npc as { instancia_de?: number }).instancia_de);

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

const renomearPersonagemDialog = ref<number | null>(null);
const nomeDoPersonagemARenomear = computed(() => {
    if (renomearPersonagemDialog.value === null) return '';
    return props.personagens.find((p) => p.id === renomearPersonagemDialog.value)?.nome ?? '';
});

function abrirRenomearPersonagem(id: number) {
    renomearPersonagemDialog.value = id;
}

async function salvarNovoNomePersonagem(novoNome: string) {
    if (renomearPersonagemDialog.value === null) return;
    const id = renomearPersonagemDialog.value;
    renomearPersonagemDialog.value = null;
    await renomearPersonagem(id, novoNome);
}

async function renomearPersonagem(id: number, novoNome: string) {
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) return;
    try {
        await api.renomearPersonagem(id, nomeLimpo);
        const p = props.personagens.find((x) => x.id === id);
        if (p) p.nome = nomeLimpo;
        for (const obj of objetos.value) {
            if (obj.tipo === 'token' && obj.personagem_id === id) {
                obj.nome = nomeLimpo;
            }
        }
        recarregar(['personagens', 'meusPersonagens', 'diario', 'objetos']);
    } catch (e) {
        avisar(mensagemDe(e));
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

// --- foto do personagem -------------------------------------------------------------
const modalFotoPersonagem = ref<{ id: number; nome: string; foto?: string | null; fotoToken?: string | null; ehNpc?: boolean } | null>(null);

function abrirAlterarFoto(p: { id: number; nome: string; foto?: string | null; fotoToken?: string | null; ehNpc?: boolean }) {
    modalFotoPersonagem.value = { ...p };
}
provide('abrirAlterarFoto', abrirAlterarFoto);

async function salvarFotoPersonagem(dados: {
    arquivo?: Blob | File | null;
    arquivo_token?: Blob | File | null;
    url?: string | null;
    remover?: boolean;
}) {
    if (!modalFotoPersonagem.value) return;
    const personagemId = modalFotoPersonagem.value.id;
    const res = await api.alterarFotoPersonagem(personagemId, dados);
    const foto = res.foto ?? null;
    const fotoToken = res.foto_token ?? foto;
    if (fichas.value[personagemId]) {
        fichas.value[personagemId].foto = foto;
        fichas.value[personagemId].foto_token = fotoToken;
    }
    const p = props.personagens.find((x) => x.id === personagemId);
    if (p) {
        p.foto = foto;
        p.foto_token = fotoToken;
        if (p.ficha) {
            p.ficha.foto = foto;
            p.ficha.foto_token = fotoToken;
        }
    }
    // Se for NPC modelo ou instância de NPC, atualiza também os tokens relacionados
    const instanciaDe = (p?.ficha?.npc as any)?.instancia_de;
    for (const obj of objetos.value) {
        if (obj.tipo === 'token') {
            const ehMesmo = obj.personagem_id === personagemId;
            const outroP = props.personagens.find((x) => x.id === obj.personagem_id);
            const ehFilho = (outroP?.ficha?.npc as any)?.instancia_de === personagemId;
            const ehIrmao = instanciaDe && (outroP?.ficha?.npc as any)?.instancia_de === instanciaDe;
            const ehPai = instanciaDe && obj.personagem_id === instanciaDe;
            if (ehMesmo || ehFilho || ehIrmao || ehPai) {
                obj.arquivo = fotoToken;
            }
        }
    }
    recarregar(['personagens', 'objetos']);
}

// --- pintar e texto ----------------------------------------------------------------

/** Jogador sempre desenha na camada Jogadores; o mestre, na camada ativa (menos Iluminação). */
const camadaDeDesenho = (): Camada => (props.mestre && camada.value !== 'iluminacao' ? camada.value : 'jogadores');

async function criarTraco(t: { x: number; y: number; largura: number; altura: number; pontos: number[] }) {
    if (!props.pagina) return;
    try {
        incluirObjeto(
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
        incluirObjeto(
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
let sondagem: ReturnType<typeof setInterval> | undefined;
const meuId = props.jogador.id;

/** Verdadeiro só quando o evento partiu desta mesma aba/conexão (permite sincronizar múltiplos PCs/abas do mesmo jogador ou mestre). */
function deMim(e: { ator?: number | null; socket?: string | null }): boolean {
    if (!e.ator) return false;
    const meuSocket = conexao?.socketId();
    if (e.socket && meuSocket) return e.socket === meuSocket;

    return e.ator === meuId;
}

/** Aplica na hora a criação, movimento, edição ou remoção de um objeto na página atual. */
function aoMudarObjeto(e: {
    acao: 'salvar' | 'remover';
    pagina_id: number;
    objeto: ObjetoDto | null;
    id: number;
    ator: number | null;
    socket?: string | null;
}) {
    if (deMim(e) || e.pagina_id !== props.pagina?.id) return;
    if (e.acao === 'remover') {
        objetos.value = objetos.value.filter((o) => o.id !== e.id);
        if (selecionadoId.value === e.id) selecionadoId.value = null;
        if (selecionadosIds.value.includes(e.id)) {
            selecionadosIds.value = selecionadosIds.value.filter((x) => x !== e.id);
        }
        return;
    }
    if (e.acao === 'salvar' && e.objeto) {
        if (!props.mestre && e.objeto.camada === 'mestre') {
            objetos.value = objetos.value.filter((o) => o.id !== e.id);
            return;
        }
        const idx = objetos.value.findIndex((o) => o.id === e.objeto!.id);
        if (idx >= 0) {
            Object.assign(objetos.value[idx], copia(e.objeto));
        } else {
            objetos.value.push(copia(e.objeto));
        }
    }
}

/** Outro participante mudou a cena: recarrega só o necessário (e não para a aba que agiu). */
function aoMudarCena(payload: { ator: number | null; socket?: string | null }) {
    if (deMim(payload)) return;
    clearTimeout(temporizadorCena);
    temporizadorCena = setTimeout(
        () =>
            recarregar([
                'objetos',
                'pagina',
                'paginas',
                'pastas',
                'diario',
                'jogadores',
                'personagens',
                'meusPersonagens',
                'itens',
                'mesa',
                'combate',
            ]),
        120,
    );
}

function aoVoltarVisibilidade() {
    if (document.visibilityState === 'visible') {
        recarregar(['objetos', 'pagina', 'paginas', 'pastas', 'diario', 'jogadores', 'personagens', 'meusPersonagens', 'itens', 'mesa', 'combate']);
    }
}

onMounted(() => {
    document.addEventListener('visibilitychange', aoVoltarVisibilidade);
    try {
        conexao = conectar(props.mesa.id, meuId);
        conexao.aoReconectar(() =>
            recarregar([
                'objetos',
                'pagina',
                'paginas',
                'pastas',
                'diario',
                'jogadores',
                'personagens',
                'meusPersonagens',
                'itens',
                'mesa',
                'combate',
                'mensagens',
            ]),
        );
        const base = `mesa.${props.mesa.id}`;
        const abrir = (canal: ReturnType<Conexao['echo']['private']>) =>
            canal
                .listen('.mensagem', (e: { mensagem: Mensagem; substitui?: boolean }) => aoNovaMensagem(e.mensagem, !!e.substitui))
                .listen('.objeto', aoMudarObjeto)
                .listen('.cena', (e: { ator: number | null; socket?: string | null }) => aoMudarCena(e))
                .listen('.ficha', aoMudarFicha)
                .listen('.folheto', (e: { folheto: FolhetoDto; ator: number | null; socket?: string | null }) => {
                    if (deMim(e)) return; // quem mostrou já está com ele aberto
                    folhetoAberto.value = e.folheto;
                    recarregar(['diario']);
                })
                .listen('.loja', (e: { aberta: boolean; loja?: LojaDoJogadorDto; catalogo?: boolean }) => {
                    if (props.mestre) return recarregar(['catalogoDoMestre', 'lojasAbertas']);
                    if (e.aberta) {
                        if (e.loja) lojaDoJogador.value = e.loja;
                        lojaVisivel.value = true;
                    } else {
                        lojaVisivel.value = false;
                        lojaDoJogador.value = null;
                    }
                    recarregar(['lojaDoJogador']);
                })
                .listen('.loot', (e: { loot: LootDto; aviso: string | null; ator: number | null; socket?: string | null }) => {
                    aplicarLoot(e.loot);
                    if (e.aviso && !deMim(e)) avisar(e.aviso);
                })
                .listen('.loot-fechado', (e: { objeto_id: number; nome: string | null }) => {
                    // O mestre fechou o loot: quem estava com ele aberto (jogador) é tirado dali na hora
                    if (!props.mestre && e.objeto_id === lootObjetoId.value) {
                        lootObjetoId.value = null;
                        lootEstado.value = null;
                        avisar(`${e.nome || 'O loot'} foi fechado pelo mestre.`);
                    }
                })
                .listen('.exploracao', (e: { pagina_id: number }) => {
                    if (e.pagina_id === props.pagina?.id) canvas.value?.limparMemoria();
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
                .listen('.status', (e: { personagem_id: number; status: string[]; morto?: boolean; ferimento?: number; aliado?: boolean }) => {
                    statusPorPersonagem.value[e.personagem_id] = e.status;
                    const p = props.personagens.find((x) => x.id === e.personagem_id);
                    if (p) {
                        if (e.morto !== undefined) p.morto = e.morto;
                        if (e.ferimento !== undefined) p.ferimento = e.ferimento;
                        if (e.aliado !== undefined) p.aliado = e.aliado;
                    }
                })
                .listen('.personagem:foto', (e: { personagem_id: number; foto: string | null; foto_token?: string | null }) => {
                    const foto = e.foto;
                    const fotoToken = e.foto_token ?? foto;
                    if (fichas.value[e.personagem_id]) {
                        fichas.value[e.personagem_id].foto = foto;
                        fichas.value[e.personagem_id].foto_token = fotoToken;
                    }
                    const p = props.personagens.find((x) => x.id === e.personagem_id);
                    if (p) {
                        p.foto = foto;
                        p.foto_token = fotoToken;
                        if (p.ficha) {
                            p.ficha.foto = foto;
                            p.ficha.foto_token = fotoToken;
                        }
                    }
                    const instanciaDe = (p?.ficha?.npc as any)?.instancia_de;
                    for (const obj of objetos.value) {
                        if (obj.tipo === 'token') {
                            const ehMesmo = obj.personagem_id === e.personagem_id;
                            const outroP = props.personagens.find((x) => x.id === obj.personagem_id);
                            const ehFilho = (outroP?.ficha?.npc as any)?.instancia_de === e.personagem_id;
                            const ehIrmao = instanciaDe && (outroP?.ficha?.npc as any)?.instancia_de === instanciaDe;
                            const ehPai = instanciaDe && obj.personagem_id === instanciaDe;
                            if (ehMesmo || ehFilho || ehIrmao || ehPai) {
                                obj.arquivo = fotoToken;
                            }
                        }
                    }
                })
                .listen('.combate-efeito', (e: { personagem_id: number; delta: number; tipo: 'dano' | 'cura' }) =>
                    exibirEfeitoCombate(e.personagem_id, e.delta, e.tipo),
                )
                .listen('.musica', (e: { musica: MusicaMesaDto }) => {
                    musicaMesa.value = e.musica;
                })
                .listen('.tempo', (e: { tempo: TempoMesa }) => {
                    tempoMesa.value = e.tempo;
                })
                .listen('.ping', (e: { pagina_id: number; x: number; y: number; puxar?: boolean; ator: number; cor: string; nome: string }) => {
                    if (e.pagina_id !== props.pagina?.id) return;
                    canvas.value?.tocarPing(e.x, e.y, e.cor);
                    if (e.puxar) {
                        canvas.value?.centralizarEm(e.x, e.y, true, 0.65);
                    }
                })
                .listen('.mira', (e: { jogador_id: number; objeto_id: number | null; pagina_id?: number | null; cor: string; nome: string }) => {
                    if (e.jogador_id === props.jogador?.id) return;
                    if (e.pagina_id && props.pagina?.id && e.pagina_id !== props.pagina.id) return;
                    mirasPorJogador.value[e.jogador_id] = {
                        objetoId: e.objeto_id,
                        cor: e.cor,
                        nome: e.nome,
                    };
                })
                .listen('.combate', (e: { combate: Combate; ator: number }) => (combate.value = normalizarCombate(e.combate)));
        const canais = [base, `${base}.jogador.${meuId}`, ...(props.mestre ? [`${base}.mestre`] : [])];
        for (const canal of canais) {
            abrir(conexao.echo.private(canal));
            conexao.vigiar(canal); // se a assinatura falhar, tenta de novo (senão a aba ficaria sem eventos a sessão inteira)
        }
    } catch (e) {
        console.warn('Tempo real indisponível', e);
    }
    // Rede de segurança: sem o socket ligado (porta bloqueada, queda longa), a mesa busca as mudanças a cada 15 s com a aba visível.
    sondagem = setInterval(() => {
        if (document.visibilityState === 'visible' && !conexao?.conectado()) {
            recarregar(['objetos', 'pagina', 'jogadores', 'personagens', 'meusPersonagens', 'itens', 'mesa', 'combate', 'mensagens']);
        }
    }, 15_000);
});
onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', aoVoltarVisibilidade);
    clearTimeout(temporizadorCena);
    clearInterval(sondagem);
    clearTimeout(temporizadorConvergir);
    clearTimeout(vigiaDaRecarga);
    conexao?.fechar();
});

// --- teclado -------------------------------------------------------------------

function aoTeclar(e: KeyboardEvent) {
    const alvo = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo?.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        desfazerUltimoMovimento();
        return;
    }
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
        incluirObjeto(
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
        incluirObjeto(novo);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function alternarPorta(id: number) {
    const o = objetos.value.find((x) => x.id === id);
    if (!o || !['porta', 'janela'].includes(o.dados?.tipo ?? '')) return;
    // Quem decide é o servidor (trancada, página, simultaneidade): o novo estado vem na resposta, nunca é presumido aqui.
    try {
        const novo = await api.alternarObjeto(id);
        if (novo.dados) o.dados = { ...o.dados, ...novo.dados };
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

async function atualizarMusicaDaMesa(dados: { tocando?: any; playlist?: any }) {
    if (!props.mestre) return;
    try {
        const resp = await api.atualizarMusica(dados);
        if (resp.musica) {
            musicaMesa.value = resp.musica as MusicaMesaDto;
        }
    } catch (e) {
        avisar(mensagemDe(e));
    }
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
                    :miras="mirasPorObjeto"
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
                    @criar-loot="criarLoot"
                    @criar-viagem="criarViagem"
                    @usar-ponto-viagem="usarPontoViagem"
                    @abrir-loot="abrirLoot"
                    @abrir-token="abrirDoToken"
                    @memoria="guardarMemoria"
                    @pedir-memoria="pedirMemoria"
                    @criar-parede="criarParede"
                    @alternar-porta="alternarPorta"
                    @menu-objeto="abrirMenuObjeto"
                    @vista="atualizarPosicaoTokenSelecionado"
                    @hover-status="aoHoverStatus"
                    @menu-ping="aoMenuPing"
                    @ping="aoPing"
                    @editar-vida="
                        (id) => {
                            editandoVidaTokenId = id;
                            atualizarPosicaoTokenSelecionado();
                        }
                    "
                />

                <!-- Bolhinha com borda vermelho escuro e círculo preto no topo do token ao clicar na barra de vida -->
                <div
                    v-if="tokenComVida && editandoVidaTokenId === tokenComVida.objetoId && tokenComVida.podeEditar"
                    class="pointer-events-auto fixed z-30 flex -translate-x-1/2 -translate-y-full select-none items-center justify-center rounded-full border-2 border-red-800 bg-black shadow-md shadow-black/80"
                    :style="{
                        left: tokenComVida.pos.x + tokenComVida.pos.largura / 2 + 'px',
                        top: tokenComVida.pos.y - tokenComVida.offsetBarras - 2 + 'px',
                        width: '24px',
                        height: '24px',
                        minWidth: '24px',
                        maxWidth: '24px',
                        minHeight: '24px',
                        maxHeight: '24px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                    }"
                    :title="`${tokenComVida.nome}: ${tokenComVida.pvAtual}/${tokenComVida.pvMax}`"
                    @pointerdown.stop
                    @mousedown.stop
                >
                    <CampoNumero
                        :model-value="tokenComVida.pvAtual"
                        :min="0"
                        :max="tokenComVida.pvMax > 0 ? tokenComVida.pvMax : 9999"
                        :relativo="true"
                        :autofocus="true"
                        class="!m-0 !h-full !w-full !min-w-0 !max-w-full !appearance-none !rounded-full !border-0 !bg-transparent !p-0 text-center font-mono text-[11px] font-bold leading-none !text-white !outline-none !ring-0 focus:!outline-none"
                        aria-label="PV atual do token"
                        @salvar="
                            salvarVidaToken(tokenComVida.personagemId, $event);
                            editandoVidaTokenId = null;
                        "
                        @cancelar="editandoVidaTokenId = null"
                    />
                </div>

                <!-- Tooltip estilo Foundry VTT para os efeitos e condições ativas no token -->
                <div
                    v-if="tooltipStatus"
                    class="pointer-events-none fixed z-40 w-max max-w-xs -translate-x-1/2 -translate-y-full select-none pb-3 duration-150 animate-in fade-in-0 zoom-in-95"
                    :style="{
                        left: tooltipStatus.pos.x + 'px',
                        top: tooltipStatus.pos.y - 6 + 'px',
                    }"
                >
                    <div
                        class="rounded-lg border border-preto-700/80 bg-preto-950/95 p-2.5 text-xs text-preto-100 shadow-2xl shadow-black/90 backdrop-blur-md"
                    >
                        <div
                            class="mb-2 flex items-center gap-1.5 border-b border-preto-800 pb-1.5 text-[11px] font-semibold tracking-wide text-ouro-300"
                        >
                            <span>Efeitos em</span>
                            <span class="truncate text-white">{{ tooltipStatus.tokenNome }}</span>
                        </div>
                        <ul class="space-y-2">
                            <li v-for="item in tooltipStatus.itens" :key="item.id" class="rounded border border-preto-800/80 bg-preto-900/60 p-1.5">
                                <div class="flex items-center gap-1.5 font-bold" :style="{ color: item.cor }">
                                    <span class="text-sm leading-none" aria-hidden="true">{{ item.icone }}</span>
                                    <span>{{ item.nome }}</span>
                                </div>
                                <ul class="mt-1 space-y-0.5 pl-3 text-[11px] font-normal leading-tight text-preto-200">
                                    <li v-for="(mec, idx) in item.mecanica" :key="idx" class="list-disc">
                                        {{ mec }}
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
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
                :tempo="tempoMesa"
                @paginas="menuAberto = true"
                @sair="router.post(sairUrl)"
                @atualizar-tempo="atualizarTempo"
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
                        v-if="mestre && selecionado && pagina && (selecionado.tipo !== 'token' || configurandoObjetoId === selecionado.id)"
                        :objeto="selecionado"
                        :pagina="pagina"
                        :paginas="paginas"
                        :pontos-de-viagem="pontosDeViagem"
                        @atualizar="atualizarSelecionado"
                        @remover="removerSelecionado"
                        @fechar="configurandoObjetoId = null"
                        @navegar="abrirPagina"
                    />
                    <ControlesZoom :escala="escala" @mais="canvas?.zoomPor(1.25)" @menos="canvas?.zoomPor(1 / 1.25)" @ajustar="canvas?.ajustar()" />
                    <BarraAtalhos v-if="ativo && atalhosDoAtivo.length" :atalhos="atalhosDoAtivo" :nome="ativo.nome" :cor="ativo.cor" />
                    <PainelDoTurno
                        :combate="combate"
                        :categorias="categoriasAcao"
                        :mestre="mestre"
                        :meus-personagens="meusPersonagens"
                        @disparar="dispararDoTurno"
                        @devolver="(item, categoria) => comandoCombate('devolver', { item_id: item, categoria })"
                        @finalizar="comandoCombate('turno', { sentido: 'proximo' })"
                    />
                    <PainelAlvo
                        v-if="alvoPersonagem && !miraDaTecnica"
                        :nome="alvoPersonagem.nome"
                        :cor="alvoPersonagem.cor"
                        @limpar="alvoObjetoId = null"
                    />
                    <BarraTurnos
                        :combate="combate"
                        :mestre="mestre"
                        :meus-personagens="meusPersonagens"
                        :objetos="objetos"
                        :personagens="personagens"
                        @anterior="comandoCombate('turno', { sentido: 'anterior' })"
                        @proximo="comandoCombate('turno', { sentido: 'proximo' })"
                        @abrir="((painelTurnos = true), (painelDados = false))"
                        @apontar="(i: ItemTurno) => apontarCombatente(i, false)"
                        @focar="(i: ItemTurno) => apontarCombatente(i, true)"
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
                <BarraLateral
                    v-model:aba="abaLateral"
                    v-model:aberta="lateralAberta"
                    :nao-lidas="naoLidas"
                    :mestre="mestre"
                    :tem-frutas="!!moduloSistema?.PainelDeFrutas"
                >
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
                            @pedir-dano-brutal="(m: Mensagem) => agirNoDanoBrutal(m, () => api.danoBrutalPedir(m.id))"
                            @rolar-dano-brutal="(m: Mensagem) => agirNoDanoBrutal(m, () => api.danoBrutalRolar(m.id))"
                            @aplicar-dano-brutal="(m: Mensagem) => agirNoDanoBrutal(m, () => api.danoBrutalAplicar(m.id))"
                            @ignorar-dano-brutal="(m: Mensagem) => agirNoDanoBrutal(m, () => api.danoBrutalIgnorar(m.id))"
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
                            @renomear="abrirRenomearPersonagem"
                            @focar="focarPersonagem"
                            @atribuir="pedirAtribuicao"
                            @criar="novoPersonagemAberto = true"
                            @novo-npc="novoNpcAberto = true"
                            @novo-navio="novoNavioAberto = true"
                            :diario="diario"
                            @nova-pasta="pastaDialog = { id: null }"
                            @novo-folheto="novoFolhetoAberto = true"
                            @renomear-pasta="(id) => (pastaDialog = { id })"
                            @excluir-pasta="(id) => acao(() => api.excluirPastaDoDiario(id), ['diario', 'personagens'])()"
                            @mover-pasta="(id, pai) => acao(() => api.atualizarPastaDoDiario(id, { pai_id: pai }), ['diario'])()"
                            @mover-folheto="(id, pasta) => acao(() => api.atualizarFolheto(id, { pasta_id: pasta }), ['diario'])()"
                            @mover-personagem="(id, pasta) => acao(() => api.moverPersonagem(id, pasta), ['personagens'])()"
                            @abrir-folheto="(id) => (folhetoAberto = diario.folhetos.find((f) => f.id === id) ?? null)"
                            @alternar-folheto="(id, v) => acao(() => api.atualizarFolheto(id, { visivel: v }), ['diario'])()"
                            @mostrar-folheto="(id) => acao(() => api.mostrarFolheto(id), ['diario'])()"
                        />
                    </template>
                    <template #musica>
                        <PainelMusica :musica="musicaMesa" :mestre="mestre" @atualizar="atualizarMusicaDaMesa" />
                    </template>
                    <template v-if="mestre && moduloSistema?.PainelDeFrutas" #frutas>
                        <component
                            :is="moduloSistema.PainelDeFrutas"
                            :personagens="personagens"
                            :fichas="fichas"
                            @salvar="(id: number, campos: Record<string, unknown>) => salvarFicha(id, campos)"
                        />
                    </template>
                    <template v-if="mestre" #configuracoes>
                        <PainelConfiguracoes
                            :fogo-amigo="fogoAmigo"
                            :liberacoes="liberacoes"
                            @fogo-amigo="alternarFogoAmigo"
                            @liberacao="alterarLiberacao"
                            @distribuir-xp="xpAberto = true"
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

        <!-- Ficha invisível do personagem ativo: a barra de atalhos usa as técnicas por ela -->
        <div v-if="executorPersonagem && moduloSistema" class="hidden" aria-hidden="true">
            <component
                :is="moduloSistema.Ficha"
                :key="executorPersonagem.id"
                :ref="(el: unknown) => (executorDeTecnicas = el as typeof executorDeTecnicas.value)"
                :personagem="executorPersonagem"
                :ficha="fichas[executorPersonagem.id]"
                :itens="itensDaMesa"
                :mestre="mestre"
                executor
                @usar-tecnica="(uso: UsoDeTecnica) => usarTecnicaDaFicha(executorPersonagem!.id, uso)"
            />
        </div>

        <!-- Fichas: janelas flutuantes por cima do mapa (arrastar, redimensionar, várias abertas) -->
        <JanelaFlutuante
            v-for="f in personagensAbertos"
            :key="f.id"
            :titulo="`Ficha · ${f.personagem!.nome}`"
            :nome="f.personagem!.nome"
            :cor="f.personagem!.cor"
            :x="f.x"
            :y="f.y"
            :largura="tamanhoFicha(ehNpc(f.id) && !ehNavio(f.id)).largura"
            :altura="tamanhoFicha(ehNpc(f.id) && !ehNavio(f.id)).altura"
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
                :is="moduloSistema.FichaDeNavio"
                v-else-if="ehNavio(f.id)"
                :personagem="f.personagem!"
                :ficha="fichas[f.id]"
                :itens="itensDaMesa"
                :mestre="mestre"
                :dia="tempoMesa.dia"
                :personagens="personagensParaONavio"
                :tripulaveis="tripulaveis"
                :acao="(nome: string, dados?: Record<string, unknown>) => acaoDoNavio(f.id, nome, dados)"
                @renomear="(nome: string) => renomearPersonagem(f.id, nome)"
            />
            <component
                :is="moduloSistema.FichaDeNpc"
                v-else-if="ehNpc(f.id)"
                :personagem="f.personagem!"
                :ficha="fichas[f.id]"
                :mestre="mestre"
                :pode-editar="mestre || meusPersonagens.includes(f.id)"
                @renomear="(nome: string) => renomearPersonagem(f.id, nome)"
                @salvar="(campos: Record<string, unknown>) => salvarFicha(f.id, campos)"
                @rolar="(...a: RolagemDaFicha) => rolarDaFicha(f.id, ...a)"
                @usar-tecnica="(uso: UsoDeTecnica) => usarTecnicaDaFicha(f.id, uso)"
            />
            <component
                :is="moduloSistema.Ficha"
                v-else-if="fichas[f.id]"
                :personagem="f.personagem!"
                :ficha="fichas[f.id]"
                :itens="itensDaMesa"
                :mestre="mestre"
                :pode-editar="mestre || meusPersonagens.includes(f.id)"
                v-bind="
                    moduloSistema.slug === 'one-piece'
                        ? { servicos: servicosDaFicha, construtorConcluido: !!criacoes[f.id]?.concluida, permissoes: permissoesDaMesa }
                        : {}
                "
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
            @renomear="
                abrirRenomearPersonagem(menuPersonagem.id);
                menuPersonagem = null;
            "
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
        <AlterarFotoPersonagemDialog
            :open="modalFotoPersonagem !== null"
            :personagem-nome="modalFotoPersonagem?.nome ?? ''"
            :foto-atual="modalFotoPersonagem?.foto"
            :foto-token-atual="modalFotoPersonagem?.fotoToken"
            :eh-npc="modalFotoPersonagem?.ehNpc"
            :salvar="salvarFotoPersonagem"
            @update:open="(v: boolean) => !v && (modalFotoPersonagem = null)"
        />
        <EscolherAlvoDialog
            :open="alvoDialogConfig.open"
            :tecnica-nome="alvoDialogConfig.tecnicaNome"
            :alvos="alvoDialogConfig.alvos"
            @escolher="aoEscolherAlvo"
            @update:open="(v: boolean) => !v && aoCancelarEscolhaAlvo()"
        />
        <LootDialog
            v-model:open="lootAberto"
            :loot="lootEstado"
            :mestre="mestre"
            :personagens="personagensDoLoot"
            :simbolo="simboloDaMoeda"
            :itens-proprios="itensDaMesa.filter((i) => !i.catalogo_id).map((i) => ({ id: i.id, nome: i.nome }))"
            :pegar="pegarDoLoot"
            :adicionar="(d) => mestreDoLoot((id) => api.adicionarAoLoot(id, d))()"
            :definir-qtd="(linha, qtd) => mestreDoLoot((id) => api.qtdNoLoot(id, linha, qtd))()"
            :definir-dinheiro="(v) => mestreDoLoot((id) => api.atualizarLoot(id, { dinheiro: v }))()"
            :carregar-catalogo="() => api.catalogoParaLoot().then((r) => r.itens)"
            :jogadores="jogadoresDaLoja"
            :sortear="() => mestreDoLoot((id) => api.sortearTesouro(id))()"
            :configurar-bau="(c) => mestreDoLoot((id) => api.atualizarLoot(id, c))()"
        />
        <MenuObjeto
            v-if="menuObjeto && objetoDoMenu"
            :objeto="objetoDoMenu"
            :x="menuObjeto.x"
            :y="menuObjeto.y"
            @mover="moverParaCamada"
            @abrir="abrirLootDoMenu"
            @configurar="configurarObjetoDoMenu"
            @fechar="menuObjeto = null"
        />

        <MenuPing
            v-if="menuPing"
            :x="menuPing.tela.x"
            :y="menuPing.tela.y"
            @ping-normal="aoPing(menuPing.mundo.x, menuPing.mundo.y, false)"
            @ping-foco="aoPing(menuPing.mundo.x, menuPing.mundo.y, true)"
            @fechar="menuPing = null"
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
            <ConfigPaginaDialog
                :open="configAberta"
                :pagina="configPagina"
                :erro="configErro"
                @update:open="
                    (v: boolean) => {
                        configAberta = v;
                        if (!v && reabrirMenuAoFecharConfig) {
                            reabrirMenuAoFecharConfig = false;
                            menuAberto = true;
                        }
                    }
                "
                @salvar="salvarConfig"
                @limpar-memoria="limparMemoriaDaPagina"
            />
            <DistribuirXpDialog v-model:open="xpAberto" :personagens="personagensDosJogadores" :distribuir="distribuirXp" />
            <NomeDialog
                :open="pastaDialog !== null"
                :titulo="pastaDialog?.id == null ? 'Nova pasta' : 'Renomear pasta'"
                :inicial="nomeDaPasta"
                @update:open="(v: boolean) => !v && (pastaDialog = null)"
                @salvar="salvarPasta"
            />
            <NomeDialog
                :open="renomearPersonagemDialog !== null"
                titulo="Renomear NPC / Personagem"
                :inicial="nomeDoPersonagemARenomear"
                @update:open="(v: boolean) => !v && (renomearPersonagemDialog = null)"
                @salvar="salvarNovoNomePersonagem"
            />
            <NovoFolhetoDialog v-model:open="novoFolhetoAberto" :criar="criarFolheto" />
            <component
                :is="moduloSistema.NovoNpcDialog"
                v-if="mestre && moduloSistema?.NovoNpcDialog"
                v-model:open="novoNpcAberto"
                @escolher="criarNpc"
            />
            <component
                :is="moduloSistema.NovoNavioDialog"
                v-if="mestre && moduloSistema?.NovoNavioDialog"
                v-model:open="novoNavioAberto"
                @criar="criarNavio"
            />
            <NovoPersonagemDialog v-model:open="novoPersonagemAberto" :jogadores="jogadores" :criar="criarPersonagem" @criado="aoCriarPersonagem" />
            <AtribuirJogadoresDialog v-model:open="atribuicaoAberta" :personagem="atribuindo" :jogadores="jogadores" @salvar="salvarAtribuicao" />
            <component
                :is="moduloSistema.CatalogoDeItens"
                v-if="moduloSistema?.CatalogoDeItens"
                v-model:open="catalogoAberto"
                :jogadores="jogadoresDaLoja"
                :lojas="lojas"
                :proprios="catalogoDoMestre ?? []"
                :personagens="
                    props.personagens.filter((p) => !p.navio && !p.ficha?.npc && !fichas[p.id]?.npc).map((p) => ({ id: p.id, nome: p.nome }))
                "
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
            <EditorItemDialog
                v-model:open="editorAberto"
                :item="itemEditando"
                :modulo="moduloSistema"
                :salvar="salvarItem"
                :excluir="excluirItem"
                @salvo="aoSalvarItemOk"
            />
        </template>
        <FolhetoDialog
            :folheto="folhetoAberto"
            :mestre="mestre"
            @fechar="folhetoAberto = null"
            @salvar="salvarFolheto"
            @mostrar="(id) => acao(() => api.mostrarFolheto(id), ['diario'])()"
            @excluir="excluirFolheto"
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
    </div>
</template>
