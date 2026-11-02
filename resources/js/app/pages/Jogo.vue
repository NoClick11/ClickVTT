<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Personagem } from '@/site/types';
import { apiMesa, ErroApi, medirArquivo } from '../api';
import BarraFerramentas from '../components/BarraFerramentas.vue';
import BarraSuperior from '../components/BarraSuperior.vue';
import CenaCanvas from '../components/CenaCanvas.vue';
import ConfigPaginaDialog from '../components/ConfigPaginaDialog.vue';
import ControlesZoom from '../components/ControlesZoom.vue';
import Inspetor from '../components/Inspetor.vue';
import MenuPaginas from '../components/MenuPaginas.vue';
import NovoTokenDialog from '../components/NovoTokenDialog.vue';
import SeletorCamada from '../components/SeletorCamada.vue';
import { CAMADAS, type Camada, type CamposGeometria, type Ferramenta, type ObjetoDto, type PaginaDto, type TipoParede } from '../engine/tipos';

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
    sairUrl: string;
}>();

const api = apiMesa(props.mesa.id);
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

watch(() => props.objetos, (novos) => (objetos.value = copia(novos)));

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
    Object.assign(o, campos);
    api.atualizarObjeto(o.id, campos).catch(falhou);
}

function removerSelecionado() {
    const o = selecionado.value;
    if (!o || !props.mestre) return;
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
    router.visit(`${route('jogo', props.mesa.slug)}?pagina=${id}`, { preserveState: true, preserveScroll: true, only: ['pagina', 'objetos'] });
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
        if (id === props.pagina?.id) router.visit(route('jogo', props.mesa.slug));
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

// Placeholders da fase de iluminação (ligados em seguida).
const criarLuz = (_x: number, _y: number) => undefined;
const criarParede = (_p: [number, number, number, number], _t: TipoParede) => undefined;
const alternarPorta = (_id: number) => undefined;
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
                    @ferramenta="ferramenta = $event"
                    @enviar-mapa="inputMapa?.click()"
                    @novo-token="tokenAberto = true"
                    @configurar="configurar(pagina.id)"
                />
                <SeletorCamada v-if="mestre" :camada="camada" @camada="(c) => ((camada = c), (ferramenta = 'selecionar'))" />
                <Inspetor v-if="mestre && selecionado && pagina" :objeto="selecionado" :pagina="pagina" @atualizar="atualizarSelecionado" @remover="removerSelecionado" />
                <ControlesZoom :escala="escala" @mais="canvas?.zoomPor(1.25)" @menos="canvas?.zoomPor(1 / 1.25)" @ajustar="canvas?.ajustar()" />
            </template>

            <div v-if="erro" role="alert" class="pointer-events-auto absolute left-1/2 top-16 z-30 max-w-md -translate-x-1/2 rounded-md border border-ouro-500/40 bg-preto-900 px-4 py-2 text-sm text-ouro-100 shadow-lg">{{ erro }}</div>
        </div>

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
