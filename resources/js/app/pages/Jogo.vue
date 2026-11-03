<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Personagem } from '@/site/types';
import { apiMesa, ErroApi, medirArquivo } from '../api';
import { conectar, type Conexao } from '../realtime';
import type { Combate, Dado, Mensagem, PersonagemElenco, VisibilidadeRolagem } from '../tipos-mesa';
import BarraFerramentas from '../components/BarraFerramentas.vue';
import BarraSuperior from '../components/BarraSuperior.vue';
import CenaCanvas from '../components/CenaCanvas.vue';
import ConfigPaginaDialog from '../components/ConfigPaginaDialog.vue';
import BarraTurnos from '../components/BarraTurnos.vue';
import ControlesZoom from '../components/ControlesZoom.vue';
import DadosAnimacao from '../components/DadosAnimacao.vue';
import OpcoesFerramenta from '../components/OpcoesFerramenta.vue';
import BarraLateral, { type AbaLateral } from '../components/BarraLateral.vue';
import PainelChat from '../components/PainelChat.vue';
import PainelPersonagens from '../components/PainelPersonagens.vue';
import PainelDados from '../components/PainelDados.vue';
import PainelTurnos from '../components/PainelTurnos.vue';
import Inspetor from '../components/Inspetor.vue';
import MenuPaginas from '../components/MenuPaginas.vue';
import NovoTokenDialog from '../components/NovoTokenDialog.vue';
import SeletorCamada from '../components/SeletorCamada.vue';
import { CAMADAS, type Camada, type CamposGeometria, type EstiloPintura, type Ferramenta, type ObjetoDto, type PaginaDto, type TipoParede } from '../engine/tipos';

interface Pasta {
    id: number;
    nome: string;
    ordem: number;
}
const props = defineProps<{
    mesa: { id: number; slug: string; nome: string; capa: string | null };
    personagem: Personagem;
    mestre: boolean;
    pagina: PaginaDto | null;
    objetos: ObjetoDto[];
    paginas: PaginaDto[];
    pastas: Pasta[];
    personagens: Personagem[];
    elenco: PersonagemElenco[];
    combate: Combate;
    mensagens: Mensagem[];
    sairUrl: string;
}>();

const api = apiMesa(props.mesa.id, props.personagem.id);
const urlJogo = () => route('jogo', [props.mesa.slug, props.personagem.id]);
const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Camada padrão = Jogadores (só o mestre troca). Estado local da tela:
const objetos = ref<ObjetoDto[]>(copia(props.objetos));
const camada = ref<Camada>('jogadores');
const ferramenta = ref<Ferramenta>('selecionar');
const selecionadoId = ref<number | null>(null);
const escala = ref(1);
const erro = ref<string | null>(null);
const canvas = ref<InstanceType<typeof CenaCanvas> | null>(null);
const inputMapa = ref<HTMLInputElement | null>(null);

const menuAberto = ref(false);
const configAberta = ref(false);
const configPagina = ref<PaginaDto | null>(null);
const configErro = ref<string | undefined>();
const tokenAberto = ref(false);
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
const abaLateral = ref<AbaLateral>(lerLocal('clickvtt.abaLateral', 'chat') === 'personagens' ? 'personagens' : 'chat');
const lateralAberta = ref(lerLocal('clickvtt.lateralAberta', '1') !== '0');
const naoLidas = ref(0);
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
    for (const p of props.personagens) m[p.id] = props.paginas.find((x) => x.id === (p.pagina_id ?? props.paginas[0]?.id));

    return m;
});
function focarPersonagem(personagemId: number) {
    const token = objetos.value.find((o) => o.tipo === 'token' && o.personagem_id === personagemId);
    if (token) canvas.value?.focar(token.id, props.mestre && camada.value === 'jogadores');
}

watch(() => props.objetos, (novos) => (objetos.value = copia(novos)));
watch(() => props.combate, (c) => (combate.value = copia(c)));

const selecionado = computed(() => objetos.value.find((o) => o.id === selecionadoId.value) ?? null);
const camadaNome = computed(() => CAMADAS.find((c) => c.id === (['jogadores', 'mestre'].includes(camada.value) ? camada.value : 'jogadores'))!.nome);

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
    if (!o || (!props.mestre && !['traco', 'texto'].includes(o.tipo))) return;
    objetos.value = objetos.value.filter((x) => x.id !== o.id);
    selecionadoId.value = null;
    api.removerObjeto(o.id).catch(falhou);
}

function centroEmQuadrados(): { x: number; y: number; t: number } {
    const t = props.pagina!.tamanho_quadrado;
    const c = canvas.value?.centro() ?? { x: 0, y: 0 };

    return { x: Math.floor(c.x / t) * t, y: Math.floor(c.y / t) * t, t };
}

async function enviarMapa(e: Event) {
    const alvo = e.target as HTMLInputElement;
    const arquivo = alvo.files?.[0];
    alvo.value = '';
    if (!arquivo || !props.pagina) return;
    try {
        const { largura, altura } = await medirArquivo(arquivo);
        const larguraPagina = props.pagina.colunas * props.pagina.tamanho_quadrado;
        const dados = new FormData();
        dados.append('camada', 'mapa');
        dados.append('tipo', 'imagem');
        dados.append('nome', arquivo.name.replace(/\.[^.]+$/, ''));
        dados.append('x', '0');
        dados.append('y', '0');
        dados.append('largura', String(larguraPagina));
        dados.append('altura', String(Math.round((larguraPagina * altura) / largura)));
        dados.append('arquivo', arquivo);
        objetos.value.push(await api.criarObjeto(props.pagina.id, dados));
        avisar('Mapa enviado. Mude para a camada Mapa para movê-lo ou redimensioná-lo.');
    } catch (err) {
        avisar(mensagemDe(err));
    }
}

async function criarToken(d: { nome: string; personagem_id: number | null; cor: string; tamanho: number; arquivo: File | null }) {
    if (!props.pagina) return;
    const { x, y, t } = centroEmQuadrados();
    const lado = d.tamanho * t;
    const alvoCamada: Camada = camada.value === 'mestre' ? 'mestre' : 'jogadores';
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

// --- páginas e menu ----------------------------------------------------------------

function abrirPagina(id: number) {
    menuAberto.value = false;
    if (id === props.pagina?.id) return;
    selecionadoId.value = null;
    router.visit(`${urlJogo()}?pagina=${id}`, { preserveState: true, preserveScroll: true, only: ['pagina', 'objetos'] });
}

const acao = (fn: () => Promise<unknown>, recarga: string[]) => () =>
    fn().then(() => recarregar(recarga)).catch((e) => avisar(mensagemDe(e)));

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
    await acao(() => Promise.all([api.atualizarPagina(atual.id, { ordem: Math.max(0, ordemAtual) }), api.atualizarPagina(vizinha.id, { ordem: Math.max(0, ordemVizinha) })]), ['paginas'])();
}

const moverJogador = (paginaId: number, personagemId: number) => acao(() => api.moverJogador(paginaId, personagemId), ['personagens'])();
const trazerTodos = (paginaId: number) => acao(() => Promise.all(props.personagens.map((p) => api.moverJogador(paginaId, p.id))), ['personagens'])();

// --- pintar e texto ----------------------------------------------------------------

/** Jogador sempre desenha na camada Jogadores; o mestre, na camada ativa (menos Iluminação). */
const camadaDeDesenho = (): Camada => (props.mestre && camada.value !== 'iluminacao' ? camada.value : 'jogadores');

async function criarTraco(t: { x: number; y: number; largura: number; altura: number; pontos: number[] }) {
    if (!props.pagina) return;
    try {
        objetos.value.push(
            await api.criarObjeto(props.pagina.id, {
                camada: camadaDeDesenho(), tipo: 'traco', x: t.x, y: t.y, largura: t.largura, altura: t.altura,
                dados: { pontos: t.pontos, cor: estilo.value.cor, espessura: estilo.value.espessura, largura_original: t.largura, altura_original: t.altura },
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
                camada: camadaDeDesenho(), tipo: 'texto', x: t.x, y: t.y,
                largura: Math.max(10, t.valor.length * tamanho * 0.6), altura: tamanho * 1.3,
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
    if (nova && m.autor?.id !== props.personagem.id && !(lateralAberta.value && abaLateral.value === 'chat')) naoLidas.value++;
    if (nova && m.tipo === 'rolagem' && m.dados && animacao.value) animacaoAtual.value = m;
}

/** Sem trava no botão: cada clique rola. As respostas entram no chat na hora; a animação mostra só a mais recente. */
async function rolar(dado: Dado, quantidade: number, visibilidade: VisibilidadeRolagem) {
    try {
        aoNovaMensagem(await api.rolar(dado, quantidade, visibilidade));
    } catch (e) {
        avisar(mensagemDe(e));
    }
}
async function enviarTexto(texto: string) {
    try {
        aoNovaMensagem(await api.enviarTexto(texto));
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
const meuId = props.personagem.id;

/** Outro participante mudou a cena: recarrega só o necessário (e não para quem agiu). */
function aoMudarCena(payload: { ator: number | null }) {
    if (payload.ator === meuId) return;
    clearTimeout(temporizadorCena);
    temporizadorCena = setTimeout(() => router.reload({ only: ['objetos', 'pagina', 'paginas', 'pastas', 'personagens'] }), 120);
}

onMounted(() => {
    try {
        conexao = conectar(props.mesa.id, meuId);
        const base = `mesa.${props.mesa.id}`;
        const abrir = (canal: ReturnType<Conexao['echo']['private']>) =>
            canal
                .listen('.mensagem', (e: { mensagem: Mensagem; substitui?: boolean }) => aoNovaMensagem(e.mensagem, !!e.substitui))
                .listen('.cena', (e: { ator: number | null }) => aoMudarCena(e))
                .listen('.combate', (e: { combate: Combate; ator: number }) => e.ator !== meuId && (combate.value = e.combate));
        abrir(conexao.echo.private(base));
        abrir(conexao.echo.private(`${base}.personagem.${meuId}`));
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
                camada: 'iluminacao', tipo: 'luz', nome: 'Luz',
                x: cx - raio, y: cy - raio, largura: raio * 2, altura: raio * 2,
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
            camada: 'iluminacao', tipo: 'parede', nome: tipo,
            x: Math.min(x1, x2), y: Math.min(y1, y2), largura: Math.max(1, Math.abs(x2 - x1)), altura: Math.max(1, Math.abs(y2 - y1)),
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
            <CenaCanvas
                ref="canvas"
                :pagina="pagina"
                :objetos="objetos"
                :camada="camada"
                :ferramenta="ferramenta"
                :mestre="mestre"
                :personagem-id="personagem.id"
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
            />
        </template>
        <div v-else class="flex h-full items-center justify-center text-center text-preto-300">
            <p>Aguardando o mestre abrir uma página para você…</p>
        </div>

        <div class="pointer-events-none absolute inset-0">
            <BarraSuperior :mesa-nome="mesa.nome" :pagina-nome="pagina?.nome ?? '—'" :personagem="personagem" :mestre="mestre" @paginas="menuAberto = true" @sair="router.post(sairUrl)" />

            <template v-if="pagina">
                <BarraFerramentas
                    :ferramenta="ferramenta"
                    :mestre="mestre"
                    :camada-iluminacao="camada === 'iluminacao'"
                    :dados="painelDados"
                    :turnos="painelTurnos"
                    @ferramenta="ferramenta = $event"
                    @dados="(painelDados = !painelDados), (painelTurnos = false)"
                    @turnos="(painelTurnos = !painelTurnos), (painelDados = false)"
                    @enviar-mapa="inputMapa?.click()"
                    @novo-token="tokenAberto = true"
                    @configurar="configurar(pagina.id)"
                />
                <SeletorCamada v-if="mestre" :camada="camada" @camada="(c) => ((camada = c), (ferramenta = 'selecionar'))" />
                <!-- Área do mapa: recua para não ficar sob a barra do chat -->
                <div class="pointer-events-none absolute bottom-0 left-0 top-0 transition-[right] duration-200" :style="{ right: margemDireita + 'px', top: lateralAberta ? '0px' : '2.75rem' }">
                    <Inspetor v-if="mestre && selecionado && pagina" :objeto="selecionado" :pagina="pagina" @atualizar="atualizarSelecionado" @remover="removerSelecionado" />
                    <ControlesZoom :escala="escala" @mais="canvas?.zoomPor(1.25)" @menos="canvas?.zoomPor(1 / 1.25)" @ajustar="canvas?.ajustar()" />
                    <BarraTurnos :combate="combate" :mestre="mestre" @anterior="passarTurno(-1)" @proximo="passarTurno(1)" @abrir="(painelTurnos = true), (painelDados = false)" />
                </div>
                <OpcoesFerramenta v-if="(ferramenta === 'pintar' || ferramenta === 'texto') && !painelDados && !painelTurnos" :ferramenta="ferramenta" v-model:estilo="estilo" />
                <PainelDados v-if="painelDados" v-model:animacao="animacao" :mestre="mestre" @rolar="rolar" @fechar="painelDados = false" />
                <PainelTurnos v-if="painelTurnos && mestre" :combate="combate" :personagens="personagens" @atualizar="salvarCombate" @fechar="painelTurnos = false" />
                <BarraLateral v-model:aba="abaLateral" v-model:aberta="lateralAberta" :nao-lidas="naoLidas">
                    <template #chat>
                        <PainelChat :mensagens="mensagens" :meu-id="personagem.id" :visivel="lateralAberta && abaLateral === 'chat'" @enviar="enviarTexto" />
                    </template>
                    <template #personagens>
                        <PainelPersonagens :elenco="elenco" :meu-id="personagem.id" :mestre="mestre" :pagina-de="paginaDe" :com-token="comToken" @focar="focarPersonagem" />
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

            <div v-if="erro" role="alert" class="pointer-events-auto absolute left-1/2 top-16 z-30 max-w-md -translate-x-1/2 rounded-md border border-ouro-500/40 bg-preto-900 px-4 py-2 text-sm text-ouro-100 shadow-lg">{{ erro }}</div>
        </div>

        <DadosAnimacao v-if="animacaoAtual" :key="animacaoAtual.id" :mensagem="animacaoAtual" @fim="animacaoAtual = null" />

        <input ref="inputMapa" type="file" class="sr-only" tabindex="-1" accept="image/png,image/jpeg,image/webp,image/gif,video/webm,video/mp4" @change="enviarMapa" />

        <template v-if="mestre">
            <MenuPaginas
                v-model:open="menuAberto"
                :paginas="paginas"
                :pastas="pastas"
                :personagens="personagens"
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
            <NovoTokenDialog v-model:open="tokenAberto" :personagens="personagens" :camada-nome="camadaNome" @criar="criarToken" />
        </template>
    </div>
</template>
