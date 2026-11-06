<script setup lang="ts">
import type { Jogador, Personagem } from '@/site/types';
import { Head, router } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { apiMesa, ErroApi, medirArquivo } from '../api';
import AtribuirJogadoresDialog from '../components/AtribuirJogadoresDialog.vue';
import BarraFerramentas from '../components/BarraFerramentas.vue';
import BarraLateral, { type AbaLateral } from '../components/BarraLateral.vue';
import BarraSuperior from '../components/BarraSuperior.vue';
import BarraTurnos from '../components/BarraTurnos.vue';
import CenaCanvas from '../components/CenaCanvas.vue';
import ConfigPaginaDialog from '../components/ConfigPaginaDialog.vue';
import ControlesZoom from '../components/ControlesZoom.vue';
import DadosAnimacao from '../components/DadosAnimacao.vue';
import Inspetor from '../components/Inspetor.vue';
import MenuObjeto from '../components/MenuObjeto.vue';
import MenuPaginas from '../components/MenuPaginas.vue';
import NovoPersonagemDialog from '../components/NovoPersonagemDialog.vue';
import OpcoesFerramenta from '../components/OpcoesFerramenta.vue';
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
import { definirCaminho } from '../nucleo/ficha/caminho';
import { arrastandoItem, arrastandoPersonagem, itemSolto, personagemSolto } from '../nucleo/itens/arrastar';
import EditorItemDialog from '../nucleo/itens/EditorItemDialog.vue';
import PainelItens from '../nucleo/itens/PainelItens.vue';
import type { AcaoDaRolagem } from '../nucleo/rolagem';
import FichaNaoImplementada from '../nucleo/sistemas/FichaNaoImplementada.vue';
import FichaPrivada from '../nucleo/sistemas/FichaPrivada.vue';
import { moduloDoSistema } from '../nucleo/sistemas/registro';
import type { AbrirEditorItem } from '../nucleo/sistemas/tipos';
import JanelaFlutuante from '../nucleo/ui/JanelaFlutuante.vue';
import { conectar, type Conexao } from '../realtime';
import type { Combate, ItemDto, Mensagem, NovoItem, VisibilidadeRolagem } from '../tipos-mesa';

interface Pasta {
    id: number;
    nome: string;
    ordem: number;
}
const props = defineProps<{
    mesa: { id: number; slug: string; nome: string; capa: string | null };
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
    combate: Combate;
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
const combate = ref<Combate>(copia(props.combate));
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
watch(
    () => props.combate,
    (c) => (combate.value = copia(c)),
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
    router.reload({ only: ['objetos'] });
}
const recarregar = (only: string[]) => router.reload({ only });

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

function removerSelecionado() {
    const o = selecionado.value;
    if (!o || (!props.mestre && !(['traco', 'texto'].includes(o.tipo) && o.jogador_id === props.jogador.id))) return;
    objetos.value = objetos.value.filter((x) => x.id !== o.id);
    selecionadoId.value = null;
    api.removerObjeto(o.id).catch(falhou);
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
    fichas.value = novas;
}
sincronizarFichas();
watch(() => props.personagens, sincronizarFichas, { deep: true });

/** Um envio por vez por personagem, na ordem das edições (respostas fora de ordem não desfazem nada). */
const filasFicha = new Map<number, Promise<void>>();
function salvarFicha(personagemId: number, campos: Record<string, unknown>) {
    const ficha = fichas.value[personagemId];
    if (!ficha) return;
    for (const [caminho, valor] of Object.entries(campos)) definirCaminho(ficha, caminho, copia(valor));
    const fila = (filasFicha.get(personagemId) ?? Promise.resolve())
        .then(() => api.salvarFicha(personagemId, campos))
        .then(() => undefined)
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
const itensDaMesa = computed(() => [
    ...props.itens.map((i) => itensSalvos.value.find((s) => s.id === i.id) ?? i),
    ...itensSalvos.value.filter((s) => !props.itens.some((i) => i.id === s.id)),
]);

// Editor do mestre (diálogo único; abre pela aba Itens ou pelo inventário de uma ficha).
const editorAberto = ref(false);
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
type RolagemDaFicha = [expressao: string, rotulo: string, aoRolar?: (total: number) => void];

/** Rolagem vinda da ficha: as `@variáveis` são resolvidas no servidor pela ficha salva do personagem. */
async function rolarDaFicha(personagemId: number, ...[expressao, rotulo, aoRolar]: RolagemDaFicha) {
    try {
        const m = await api.rolar(expressao, 'todos', personagemId, rotulo);
        aoNovaMensagem(m);
        if (m.dados) aoRolar?.(m.dados.total);
    } catch (e) {
        avisar(mensagemDe(e));
    }
}

// Arrastar um item da aba Itens para a janela de uma ficha entrega o item ao personagem (só o mestre; o formato do
// inventário é do módulo do sistema).
const fichaSobre = ref<number | null>(null);
const aceitaItem = (e: DragEvent, personagemId: number) =>
    props.mestre && !!moduloSistema?.entregarItem && !!fichas.value[personagemId] && arrastandoItem(e);
function itemSobreFicha(e: DragEvent, personagemId: number) {
    if (!aceitaItem(e, personagemId)) return;
    e.preventDefault(); // sem isto o navegador não deixa soltar
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    fichaSobre.value = personagemId;
}
function itemSaiuDaFicha(e: DragEvent, personagemId: number) {
    // `dragleave` também dispara ao passar por elementos filhos: só limpa quando saiu da janela de verdade.
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null) && fichaSobre.value === personagemId) fichaSobre.value = null;
}
function soltarItemNaFicha(e: DragEvent, personagemId: number) {
    fichaSobre.value = null;
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
    router.reload({ only: ['personagens', 'meusPersonagens', 'itens'], onSuccess: () => abrirPersonagem(personagem.id) });
}

const atribuindo = ref<Personagem | null>(null);
const atribuicaoAberta = ref(false);
function pedirAtribuicao(id: number) {
    atribuindo.value = props.personagens.find((p) => p.id === id) ?? null;
    atribuicaoAberta.value = atribuindo.value !== null;
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
        aoNovaMensagem(await api.rolar(acao.expressao, visibilidade, mensagem.autor?.personagem_id ?? null, acao.rotuloRolagem));
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
async function salvarCombate(novo: Combate) {
    combate.value = novo;
    try {
        await api.salvarCombate(novo);
    } catch (e) {
        avisar(mensagemDe(e));
        combate.value = copia(props.combate);
    }
}
function passarTurno(delta: 1 | -1) {
    const c = combate.value;
    const o = [...c.itens].sort((a, b) => (b.iniciativa ?? -Infinity) - (a.iniciativa ?? -Infinity));
    if (!o.length) return;
    const i = o.findIndex((x) => x.id === c.atual);
    const prox = i === -1 ? 0 : i + delta;
    const rodada = prox >= o.length ? c.rodada + 1 : prox < 0 ? Math.max(1, c.rodada - 1) : c.rodada;
    salvarCombate({ ...c, atual: o[(prox + o.length) % o.length].id, rodada });
}

// --- tempo real (Reverb): chat, turnos e sincronia da cena ---------------------------------------

let conexao: Conexao | null = null;
let temporizadorCena: ReturnType<typeof setTimeout> | undefined;
const meuId = props.jogador.id;

/** Outro participante mudou a cena: recarrega só o necessário (e não para quem agiu). */
function aoMudarCena(payload: { ator: number | null }) {
    if (payload.ator === meuId) return;
    clearTimeout(temporizadorCena);
    temporizadorCena = setTimeout(
        () => router.reload({ only: ['objetos', 'pagina', 'paginas', 'pastas', 'jogadores', 'personagens', 'meusPersonagens', 'itens'] }),
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
                .listen('.combate', (e: { combate: Combate; ator: number }) => e.ator !== meuId && (combate.value = e.combate));
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
    if ((e.key === 'Delete' || e.key === 'Backspace') && selecionadoId.value) {
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
                    :objetos="objetos"
                    :camada="camada"
                    :ferramenta="ferramenta"
                    :mestre="mestre"
                    :jogador-id="jogador.id"
                    :personagens-permitidos="meusPersonagens"
                    :estilo="estilo"
                    :margem-direita="margemDireita"
                    @criar-traco="criarTraco"
                    @criar-texto="pedirTexto"
                    @selecionar="selecionadoId = $event"
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
                    <BarraTurnos
                        :combate="combate"
                        :mestre="mestre"
                        @anterior="passarTurno(-1)"
                        @proximo="passarTurno(1)"
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
                    @atualizar="salvarCombate"
                    @fechar="painelTurnos = false"
                />
                <BarraLateral v-model:aba="abaLateral" v-model:aberta="lateralAberta" :nao-lidas="naoLidas" :mestre="mestre">
                    <template #chat>
                        <PainelChat
                            :mensagens="mensagens"
                            :meu-id="jogador.id"
                            :visivel="lateralAberta && abaLateral === 'chat'"
                            :mestre="mestre"
                            @enviar="enviarTexto"
                            @acao="rolarAcaoDoChat"
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
                            @focar="focarPersonagem"
                            @atribuir="pedirAtribuicao"
                            @criar="novoPersonagemAberto = true"
                        />
                    </template>
                    <template v-if="mestre" #itens>
                        <PainelItens :itens="itensDaMesa" :formato="moduloSistema?.formatoDeResumo" @editar="abrirEditorItem" />
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
                @editor-item="abrirEditorItem"
                @salvar="(campos: Record<string, unknown>) => salvarFicha(f.id, campos)"
                @rolar="(...a: RolagemDaFicha) => rolarDaFicha(f.id, ...a)"
            />
            <FichaPrivada v-else :personagem="f.personagem!" />
        </JanelaFlutuante>

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
