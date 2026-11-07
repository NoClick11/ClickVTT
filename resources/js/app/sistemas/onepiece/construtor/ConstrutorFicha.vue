<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Criacao } from '@/site/types';
import { Check, Dices, Minus, Plus } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { FOCO_EXCLUI, profissaoPorId, PROFISSOES, SEM_PROFISSAO } from '../profissoes/dados';
import type { ProfissoesFicha } from '../profissoes/regras';
import { ATRIBUTOS, comSinal, modificador, PERICIAS, PERICIAS_ESCOLHIVEIS, type AtributoId, type Caracteristica, type Tecnica } from '../regras';
import { antecedentePorId, ANTECEDENTES } from './dados/antecedentes';
import { ESPECIES } from './dados/especies';
import { estiloPorId, ESTILOS } from './dados/estilos';
import { HABILIDADES_BASICAS, hbPorId, OPCOES_QUEBRADOR } from './dados/habilidades-basicas';
import { AVISO_VARIACAO_RARA, VARIACOES_RARAS } from './dados/variacoes';
import {
    atributosFinais,
    beneficiosDisponiveis,
    camposDaCriacao,
    custoDaCompra,
    DADOS_DE_VIDA,
    escolhasIniciais,
    especiePorId,
    ETAPAS,
    fisicoDe,
    mesticoDaMesmaEspecie,
    pedidosDaEtapaEscolhas,
    pedidosDePericia,
    periciasJaProficientes,
    PONTOS_DE_COMPRA,
    problemasDaEtapa,
    pvInicial,
    quantidadeDeFalhas,
    textoDeMovimento,
    todosOsTracos,
    VALORES_PADRAO,
    type Escolhas,
    type EtapaId,
    type MetodoAtributos,
} from './regras';

/**
 * Assistente de criação do personagem (como o construtor do Foundry): o jogador escolhe espécie, variante, variação rara,
 * estilo de luta e atributos, e a ficha é preenchida sozinha. O progresso fica salvo em `criacao` e dá para retomar.
 * Só mostra e emite: quem salva e rola é a mesa (`salvar`, `rolarAtributos`).
 */
const props = defineProps<{
    open: boolean;
    personagem: { id: number; nome: string; cor: string };
    ficha: {
        nivel?: number;
        caracteristicas?: Caracteristica[];
        tecnicas?: { lista: Tecnica[] };
        proficienciasArmas?: string[];
        habilidadesBasicas?: { id: string; nivel: number; opcao?: string }[];
        profissoes?: Partial<ProfissoesFicha>;
        ferramentas?: { nome: string; prof: 0 | 1 | 2; atributo: AtributoId }[];
    };
    criacao: Criacao | null;
    salvar: (campos: Record<string, unknown>, criacao: Criacao) => Promise<void>;
    rolarAtributos: () => Promise<number[]>;
    /** Entrega um companheiro com ficha pronta (a mesa cria o personagem). */
    criarCompanheiro?: (modelo: string) => Promise<void>;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; concluido: [] }>();

const e = reactive<Escolhas>(escolhasIniciais());
const etapa = ref<EtapaId>('especie');
const erro = ref('');
const ocupado = ref(false);
const indice = computed(() => ETAPAS.findIndex((x) => x.id === etapa.value));
const problemas = computed(() => problemasDaEtapa(e, etapa.value));
const fisico = computed(() => fisicoDe(e));

/** Ao abrir: retoma as escolhas salvas (e os valores já rolados no servidor) ou começa do zero. */
watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        Object.assign(e, escolhasIniciais(), (props.criacao?.dados?.escolhas as Partial<Escolhas> | undefined) ?? {});
        const rolados = props.criacao?.dados?.rolados as number[] | undefined;
        e.rolados = rolados ?? null;
        etapa.value = ETAPAS.some((x) => x.id === props.criacao?.etapa) && !props.criacao?.concluida ? (props.criacao!.etapa as EtapaId) : 'especie';
        erro.value = '';
    },
    { immediate: true },
);

const escolhasSalvas = () => JSON.parse(JSON.stringify({ ...e, rolados: undefined }));
async function guardar(proxima: EtapaId, concluida = false, campos: Record<string, unknown> = {}) {
    ocupado.value = true;
    erro.value = '';
    try {
        await props.salvar(campos, { etapa: proxima, concluida, dados: { escolhas: escolhasSalvas() } });
        return true;
    } catch (x) {
        erro.value = x instanceof Error ? x.message : 'Não foi possível salvar.';
        return false;
    } finally {
        ocupado.value = false;
    }
}

/** A etapa "Variação rara" só vale para espécie única; no mestiço ela é pulada. */
const proximaEtapa = (passo: 1 | -1): EtapaId => {
    let i = indice.value + passo;
    if (ETAPAS[i]?.id === 'variacao' && e.modo === 'mestico') i += passo;

    return ETAPAS[Math.max(0, Math.min(ETAPAS.length - 1, i))].id;
};
async function avancar() {
    if (problemas.value.length) return;
    const proxima = proximaEtapa(1);
    if (await guardar(proxima)) etapa.value = proxima;
}
const voltar = () => (etapa.value = proximaEtapa(-1));

async function concluir() {
    const { campos } = camposDaCriacao(e, atualDaFicha());
    if (await guardar('resumo', true, campos)) {
        // Traços com companheiro (Kuja): a mesa cria o personagem com a ficha pronta (pedir de novo não duplica)
        for (const t of todosOsTracos(e)) if (t.traco.companheiro) await props.criarCompanheiro?.(t.traco.companheiro).catch(() => undefined);
        emit('concluido');
        emit('update:open', false);
    }
}
const resultado = computed(() => camposDaCriacao(e, atualDaFicha()));
function atualDaFicha() {
    return {
        caracteristicas: props.ficha.caracteristicas,
        tecnicas: props.ficha.tecnicas?.lista,
        nivel: props.ficha.nivel,
        proficienciasArmas: props.ficha.proficienciasArmas,
        habilidadesBasicas: props.ficha.habilidadesBasicas,
        profissoes: props.ficha.profissoes,
        ferramentas: props.ficha.ferramentas,
    };
}

// --- etapa 3c: profissão -----------------------------------------------------------------------------------------------
const profissaoEscolhida = computed(() => profissaoPorId(e.profissao?.id));
const semProfissao = computed(() => e.profissao?.id === 'nenhuma');
/** As perícias entre as quais escolher: as da profissão, ou (sem profissão) todas menos Haki, Sobrenatural, Sorte e Ofício. */
const periciasDaProfissao = computed(() =>
    semProfissao.value
        ? PERICIAS.filter((p) => !FOCO_EXCLUI.includes(p.id))
        : PERICIAS.filter((p) => profissaoEscolhida.value?.pericias.includes(p.id)),
);
function escolherProfissao(id: string) {
    e.profissao = { id, pericias: [] };
}
function alternarPericiaDaProfissao(id: string) {
    if (!e.profissao) return;
    const lista = e.profissao.pericias;
    const i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1);
    else if (lista.length < 2) lista.push(id);
    else e.profissao.pericias = [lista[1], id];
}
// --- etapa 3b: antecedente -------------------------------------------------------------------------------------------
const antecedenteEscolhido = computed(() => antecedentePorId(e.antecedente?.id));
const featuresDeOutros = computed(() => ANTECEDENTES.filter((a) => a.id !== e.antecedente?.id));
/** Escolher um antecedente zera a perícia, a característica trocada e sugere o atributo recomendado (se for um só). */
function escolherAntecedente(id: string) {
    const a = antecedentePorId(id);
    if (!a) return;
    e.antecedente = { id, pericia: '', atributo: a.atributos.length === 1 ? a.atributos[0] : null, personalizado: false, caracteristicaDe: null };
}
function personalizarAntecedente(ligado: boolean) {
    if (!e.antecedente) return;
    e.antecedente.personalizado = ligado;
    if (!ligado) {
        e.antecedente.caracteristicaDe = null;
        const a = antecedenteEscolhido.value;
        if (a && !a.pericias.includes(e.antecedente.pericia)) e.antecedente.pericia = '';
    }
}

// --- etapa 4: estilo de luta -------------------------------------------------------------------------------------
const opcoesProdigio = [
    { id: 'corpo', nome: 'Corpo a corpo' },
    { id: 'distancia', nome: 'À distância' },
];
function escolherOpcaoDaHB(opcao: string) {
    if (!e.hb) return;
    e.hbOpcoes = { ...(e.hbOpcoes ?? {}), [e.hb]: [opcao] };
}
const estiloEscolhido = computed(() => estiloPorId(e.estilo.id));
/** Escolher um estilo do catálogo preenche nome e dado e zera as escolhas dele; `null` volta ao estilo provisório. */
function escolherEstilo(id: string | null) {
    const est = estiloPorId(id);
    e.estilo = est
        ? {
              id: est.id,
              nome: est.nome,
              dado: est.dado,
              primario: est.atributosPrimarios.length === 1 ? est.atributosPrimarios[0] : null,
              caminho: est.caminhos?.[0]?.id ?? null,
              armaFavorita: null,
              hbInata: null,
              pericias: [],
          }
        : { id: '', nome: '', dado: 'd8', primario: null, caminho: null, armaFavorita: null, hbInata: null, pericias: [] };
}
function alternarPericiaDoEstilo(id: string) {
    const lista = e.estilo.pericias ?? (e.estilo.pericias = []);
    const i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1);
    else if (lista.length < (estiloEscolhido.value?.pericias ?? 0)) lista.push(id);
}

// --- etapa 1: espécie --------------------------------------------------------------------------------------------
function trocarModo(modo: Escolhas['modo']) {
    e.modo = modo;
    e.especies = e.especies.slice(0, modo === 'mestico' ? 2 : 1);
    e.variantes = e.variantes.slice(0, e.especies.length);
    e.beneficiosMestico = [];
    e.dificuldadeMestico = null;
    e.doisMundos = null;
    e.dificuldadeExtra = null;
    e.variacaoRara = null;
    e.beneficioSubstituido = null;
}
/** Única: escolhe a espécie. Mestiço: preenche a primeira vaga livre (clique de novo na vaga para limpar). */
function escolherEspecie(id: string) {
    if (e.modo === 'unica') {
        if (e.especies[0] !== id)
            Object.assign(e, {
                especies: [id],
                variantes: [null],
                pericias: {},
                trocas: {},
                falhas: [],
                variacaoRara: null,
                beneficioSubstituido: null,
            });
        return;
    }
    if (e.especies.length < 2) {
        e.especies = [...e.especies, id];
        e.variantes = [...e.variantes, null];
        e.beneficiosMestico = [];
    }
}
function limparVaga(i: number) {
    e.especies = e.especies.filter((_, j) => j !== i);
    e.variantes = e.variantes.filter((_, j) => j !== i);
    e.beneficiosMestico = [];
    e.dificuldadeMestico = null;
}
const foco = ref<string | null>(null);
const especieEmFoco = computed(() => especiePorId(foco.value ?? e.especies[e.especies.length - 1] ?? ''));

// --- etapa 2: escolhas ------------------------------------------------------------------------------------------------
const pedidos = computed(() => pedidosDaEtapaEscolhas(e));
/** Aptidão Natural e afins: escolhidas na etapa do estilo, entre as perícias que o personagem já tem. */
const pedidosDeAptidao = computed(() => pedidosDePericia(e).filter((p) => p.traco.escolhaPericias?.soProficientes));
const proficientes = computed(() => periciasJaProficientes(e));
const nFalhas = computed(() => quantidadeDeFalhas(e));
const falhasDisponiveis = computed(() => ESPECIES.find((x) => x.id === 'humano')!.dificuldade.falhas ?? []);
const ehHumano = computed(() => e.especies.some((id) => id === 'humano'));
const ehKuja = computed(() => e.variantes.includes('kuja'));
const pedeAncestralidade = computed(() => todosOsTracos(e).some((t) => t.traco.pedeAncestralidade));

function alternarLista(lista: string[], valor: string, maximo: number) {
    const i = lista.indexOf(valor);
    if (i >= 0) lista.splice(i, 1);
    else if (lista.length < maximo) lista.push(valor);
}
const periciasDe = (id: string) => (e.pericias[id] ??= []);
const maximoDe = (pedido: { traco: { id: string; escolhaPericias?: { troca?: unknown } }; quantidade: number }) =>
    pedido.quantidade - (pedido.traco.escolhaPericias?.troca && e.trocas[pedido.traco.id] ? 1 : 0);
function escolherAjuste(a: AtributoId) {
    const max = e.ajuste.tipo === 'um' ? 1 : 2;
    const i = e.ajuste.atributos.indexOf(a);
    if (i >= 0) e.ajuste.atributos.splice(i, 1);
    else {
        if (e.ajuste.atributos.length >= max) e.ajuste.atributos.shift();
        e.ajuste.atributos.push(a);
    }
}
watch(
    () => e.ajuste.tipo,
    (t) => (e.ajuste.atributos = e.ajuste.atributos.slice(0, t === 'um' ? 1 : 2)),
);
watch(
    () => e.adaptacaoOpcional,
    () => (e.falhas = []),
);

// --- etapa 3: variação rara ------------------------------------------------------------------------------------------
const beneficiosParaTrocar = computed(() => {
    if (e.modo !== 'unica' || !e.especies[0]) return [];

    return beneficiosDisponiveis(e.especies[0], e.variantes[0] ?? null);
});

// --- etapa 5: atributos ----------------------------------------------------------------------------------------------
const metodos: { id: MetodoAtributos; rotulo: string; ajuda: string }[] = [
    { id: 'padrao', rotulo: 'Valores padrão', ajuda: 'Distribua 15, 14, 13, 12, 10 e 8.' },
    { id: 'compra', rotulo: 'Compra de pontos', ajuda: `${PONTOS_DE_COMPRA} pontos, valores de 8 a 15.` },
    { id: 'rolagem', rotulo: 'Rolagem 4d6', ajuda: 'Seis rolagens de 4d6, descartando o menor (feitas no servidor, uma vez só).' },
];
function trocarMetodo(m: MetodoAtributos) {
    e.atributos.metodo = m;
    const baseNova = m === 'compra' ? 8 : 10;
    for (const a of ATRIBUTOS) e.atributos.base[a.id] = baseNova;
    if (m === 'padrao') ATRIBUTOS.forEach((a, i) => (e.atributos.base[a.id] = VALORES_PADRAO[i]));
    if (m === 'rolagem' && e.rolados) ATRIBUTOS.forEach((a, i) => (e.atributos.base[a.id] = e.rolados![i]));
}
const pontosRestantes = computed(() => PONTOS_DE_COMPRA - custoDaCompra(e.atributos.base));
function ajustar(a: AtributoId, delta: number) {
    const novo = e.atributos.base[a] + delta;
    if (novo < 8 || novo > 15) return;
    e.atributos.base[a] = novo;
}
async function rolar() {
    ocupado.value = true;
    erro.value = '';
    try {
        e.rolados = await props.rolarAtributos();
        ATRIBUTOS.forEach((a, i) => (e.atributos.base[a.id] = e.rolados![i]));
    } catch (x) {
        erro.value = x instanceof Error ? x.message : 'Não foi possível rolar.';
    } finally {
        ocupado.value = false;
    }
}
const finais = computed(() => atributosFinais(e));
const siglas = Object.fromEntries(ATRIBUTOS.map((a) => [a.id, a.sigla]));

const cartao = 'rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
const ativo = 'border-ouro-400 bg-ouro-500/15';
const inativo = 'border-preto-700 hover:border-ouro-500/50';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1.5 text-sm focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader class="border-b border-preto-800 px-5 pb-3 pt-4">
                <DialogTitle class="font-serif text-xl">Criar {{ personagem.nome }}</DialogTitle>
                <DialogDescription>Escolha as opções e a ficha é preenchida sozinha. Seu progresso fica salvo.</DialogDescription>
                <ol class="mt-2 flex flex-wrap gap-1.5" aria-label="Etapas">
                    <li
                        v-for="(x, i) in ETAPAS"
                        :key="x.id"
                        class="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
                        :class="[
                            x.id === etapa
                                ? 'border-ouro-400 bg-ouro-500/20 font-semibold text-ouro-100'
                                : i < indice
                                  ? 'border-green-500/40 text-green-300'
                                  : 'border-preto-700 text-preto-400',
                            e.modo === 'mestico' && x.id === 'variacao' ? 'hidden' : '',
                        ]"
                        :aria-current="x.id === etapa ? 'step' : undefined"
                    >
                        <Check v-if="i < indice" class="size-3" /> {{ x.rotulo }}
                    </li>
                </ol>
            </DialogHeader>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <!-- 1. ESPÉCIE -->
                <section v-if="etapa === 'especie'" class="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]" aria-label="Espécie">
                    <div class="grid content-start gap-3">
                        <div class="flex gap-1.5" role="group" aria-label="Tipo de personagem">
                            <button
                                type="button"
                                :class="[cartao, e.modo === 'unica' ? ativo : inativo]"
                                :aria-pressed="e.modo === 'unica'"
                                @click="trocarModo('unica')"
                            >
                                <span class="block font-semibold">Espécie única</span
                                ><span class="text-xs text-preto-400">Recebe todos os traços da espécie.</span>
                            </button>
                            <button
                                type="button"
                                :class="[cartao, e.modo === 'mestico' ? ativo : inativo]"
                                :aria-pressed="e.modo === 'mestico'"
                                @click="trocarModo('mestico')"
                            >
                                <span class="block font-semibold">Mestiço</span
                                ><span class="text-xs text-preto-400">Mistura duas espécies (ou duas variantes da mesma).</span>
                            </button>
                        </div>
                        <p v-if="e.modo === 'mestico'" class="text-xs text-preto-300">
                            Escolhida{{ e.especies.length === 1 ? '' : 's' }}:
                            <button
                                v-for="(id, i) in e.especies"
                                :key="i"
                                type="button"
                                class="mx-1 rounded-full border border-ouro-400 px-2 py-0.5 text-ouro-100"
                                :title="'Remover'"
                                @click="limparVaga(i)"
                            >
                                {{ especiePorId(id)?.nome }} ✕
                            </button>
                            <span v-if="e.especies.length < 2"
                                >Escolha {{ 2 - e.especies.length }} espécie{{ e.especies.length === 0 ? 's' : '' }} abaixo.</span
                            >
                        </p>
                        <ul class="grid gap-2 sm:grid-cols-2" aria-label="Espécies">
                            <li v-for="s in ESPECIES" :key="s.id">
                                <button
                                    type="button"
                                    class="w-full"
                                    :class="[cartao, e.especies.includes(s.id) ? ativo : inativo]"
                                    :aria-pressed="e.especies.includes(s.id)"
                                    @click="escolherEspecie(s.id)"
                                    @mouseenter="foco = s.id"
                                    @focus="foco = s.id"
                                >
                                    <span class="flex items-baseline justify-between gap-2"
                                        ><span class="font-serif text-lg font-semibold">{{ s.nome }}</span
                                        ><span class="text-xs text-sky-300">PV {{ s.pv }}</span></span
                                    >
                                    <span class="block text-xs text-preto-400"
                                        >{{ s.categoria }} · {{ textoDeMovimento(s.movimento) }} · preconceito {{ s.preconceito.toLowerCase() }}</span
                                    >
                                    <span class="mt-1 block text-xs text-preto-300">{{
                                        s.beneficios.map((b) => b.nome).join(' · ') || s.variantes?.map((v) => v.beneficio.nome).join(' · ')
                                    }}</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                    <aside
                        v-if="especieEmFoco"
                        class="grid content-start gap-2 rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-sm"
                        aria-label="Detalhes da espécie"
                    >
                        <h3 class="font-serif text-xl font-semibold text-ouro-100">{{ especieEmFoco.nome }}</h3>
                        <p class="text-xs text-preto-300">
                            PV base {{ especieEmFoco.pv }} · {{ especieEmFoco.categoria }} ({{ especieEmFoco.tamanhoCm[0] / 100 }} a
                            {{ especieEmFoco.tamanhoCm[1] / 100 }} m) · {{ textoDeMovimento(especieEmFoco.movimento) }}
                        </p>
                        <div v-for="b in [...especieEmFoco.beneficios, ...(especieEmFoco.variantes ?? []).map((v) => v.beneficio)]" :key="b.id">
                            <span :class="rotulo">Benefício: {{ b.nome }}</span>
                            <p class="line-clamp-4 text-xs text-preto-300">{{ b.descricao }}</p>
                        </div>
                        <div>
                            <span :class="rotulo">Dificuldade: {{ especieEmFoco.dificuldade.nome }}</span>
                            <p class="line-clamp-4 text-xs text-preto-300">{{ especieEmFoco.dificuldade.descricao }}</p>
                        </div>
                        <template v-if="especieEmFoco.lore.aparencia">
                            <div>
                                <span :class="rotulo">Aparência</span>
                                <p class="text-xs text-preto-300">{{ especieEmFoco.lore.aparencia }}</p>
                            </div>
                            <div>
                                <span :class="rotulo">Pátria</span>
                                <p class="text-xs text-preto-300">{{ especieEmFoco.lore.patria }}</p>
                            </div>
                            <div>
                                <span :class="rotulo">Cultura</span>
                                <p class="text-xs text-preto-300">{{ especieEmFoco.lore.cultura }}</p>
                            </div>
                            <div>
                                <span :class="rotulo">Comportamento</span>
                                <p class="text-xs text-preto-300">{{ especieEmFoco.lore.comportamento }}</p>
                            </div>
                            <div>
                                <span :class="rotulo">Relação com humanos</span>
                                <p class="text-xs text-preto-300">{{ especieEmFoco.lore.relacao }}</p>
                            </div>
                        </template>
                    </aside>
                </section>

                <!-- 2. ESCOLHAS -->
                <section v-else-if="etapa === 'escolhas'" class="grid gap-5" aria-label="Escolhas da espécie">
                    <div v-for="(id, i) in e.especies" :key="i">
                        <template v-if="especiePorId(id)?.variantes?.length">
                            <h3 :class="rotulo">Variante de {{ especiePorId(id)!.nome }}</h3>
                            <div class="grid gap-2 sm:grid-cols-2">
                                <button
                                    v-for="v in especiePorId(id)!.variantes"
                                    :key="v.id"
                                    type="button"
                                    :class="[cartao, e.variantes[i] === v.id ? ativo : inativo]"
                                    :aria-pressed="e.variantes[i] === v.id"
                                    @click="e.variantes[i] = v.id"
                                >
                                    <span class="block font-semibold">{{ v.nome }}</span>
                                    <span class="block text-xs text-ouro-200">{{ v.beneficio.nome }}</span>
                                    <span class="mt-1 block text-xs text-preto-400">{{ v.descricao }}</span>
                                    <span class="mt-1 block text-xs text-preto-300"
                                        >{{ v.beneficio.descricao.slice(0, 220) }}{{ v.beneficio.descricao.length > 220 ? '…' : '' }}</span
                                    >
                                </button>
                            </div>
                        </template>
                    </div>

                    <div>
                        <h3 :class="rotulo">Ajuste de atributo da espécie</h3>
                        <div class="mb-2 flex gap-1.5" role="group" aria-label="Tipo do ajuste">
                            <button
                                type="button"
                                :class="[cartao, e.ajuste.tipo === 'dois' ? ativo : inativo]"
                                :aria-pressed="e.ajuste.tipo === 'dois'"
                                @click="e.ajuste.tipo = 'dois'"
                            >
                                +1 em dois atributos
                            </button>
                            <button
                                type="button"
                                :class="[cartao, e.ajuste.tipo === 'um' ? ativo : inativo]"
                                :aria-pressed="e.ajuste.tipo === 'um'"
                                @click="e.ajuste.tipo = 'um'"
                            >
                                +2 em um atributo
                            </button>
                        </div>
                        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Atributos do ajuste">
                            <button
                                v-for="a in ATRIBUTOS"
                                :key="a.id"
                                type="button"
                                :class="[cartao, 'min-w-24 text-center', e.ajuste.atributos.includes(a.id) ? ativo : inativo]"
                                :aria-pressed="e.ajuste.atributos.includes(a.id)"
                                @click="escolherAjuste(a.id)"
                            >
                                <span class="block text-xs font-semibold">{{ a.sigla }}</span
                                ><span class="text-xs text-preto-400">{{ a.nome }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Mestiço: Miscigenação, dificuldade, Dois Mundos -->
                    <template v-if="e.modo === 'mestico' && e.especies.length === 2">
                        <p v-if="mesticoDaMesmaEspecie(e)" class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                            Mestiço entre variantes da mesma espécie: você recebe apenas o benefício de cada variante, sem o Benefício da Espécie
                            geral.
                        </p>
                        <template v-else>
                            <div v-for="(id, i) in e.especies" :key="`b${i}`">
                                <h3 :class="rotulo">Miscigenação: um benefício de {{ especiePorId(id)?.nome }}</h3>
                                <div class="grid gap-2 sm:grid-cols-2">
                                    <button
                                        v-for="b in beneficiosDisponiveis(id, e.variantes[i] ?? null)"
                                        :key="b.id"
                                        type="button"
                                        :class="[cartao, e.beneficiosMestico[i] === b.id ? ativo : inativo]"
                                        :aria-pressed="e.beneficiosMestico[i] === b.id"
                                        @click="e.beneficiosMestico[i] = b.id"
                                    >
                                        <span class="block font-semibold"
                                            >{{ b.nome }}<span v-if="b.restrito" class="ml-1 text-[10px] uppercase text-red-300">restrito</span></span
                                        >
                                        <span class="mt-1 block text-xs text-preto-300"
                                            >{{ b.descricao.slice(0, 200) }}{{ b.descricao.length > 200 ? '…' : '' }}</span
                                        >
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h3 :class="rotulo">Dificuldade da espécie (escolha de qual das duas)</h3>
                                <div class="grid gap-2 sm:grid-cols-2">
                                    <button
                                        v-for="(id, i) in e.especies"
                                        :key="`d${i}`"
                                        type="button"
                                        :class="[cartao, e.dificuldadeMestico === i ? ativo : inativo]"
                                        :aria-pressed="e.dificuldadeMestico === i"
                                        @click="e.dificuldadeMestico = i"
                                    >
                                        <span class="block font-semibold"
                                            >{{ especiePorId(id)!.dificuldade.nome }}
                                            <span class="text-xs text-preto-400">({{ especiePorId(id)!.nome }})</span></span
                                        >
                                        <span class="mt-1 block text-xs text-preto-300"
                                            >{{ especiePorId(id)!.dificuldade.descricao.slice(0, 200) }}…</span
                                        >
                                    </button>
                                </div>
                            </div>
                            <div v-if="todosOsTracos(e).some((t) => t.traco.restrito)">
                                <h3 :class="rotulo">Benefício restrito: uma dificuldade adicional (de qual espécie)</h3>
                                <div class="flex gap-1.5">
                                    <button
                                        v-for="(id, i) in e.especies"
                                        :key="`x${i}`"
                                        type="button"
                                        :class="[cartao, e.dificuldadeExtra === i ? ativo : inativo]"
                                        :aria-pressed="e.dificuldadeExtra === i"
                                        @click="e.dificuldadeExtra = i"
                                    >
                                        {{ especiePorId(id)!.dificuldade.nome }}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h3 :class="rotulo">Dois Mundos</h3>
                                <div class="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        :class="[cartao, e.doisMundos === 'ancestralidade' ? ativo : inativo]"
                                        :aria-pressed="e.doisMundos === 'ancestralidade'"
                                        @click="e.doisMundos = 'ancestralidade'"
                                    >
                                        Ancestralidade
                                    </button>
                                    <button
                                        type="button"
                                        :class="[cartao, e.doisMundos === 'cultural' ? ativo : inativo]"
                                        :aria-pressed="e.doisMundos === 'cultural'"
                                        @click="e.doisMundos = 'cultural'"
                                    >
                                        Traço Cultural
                                    </button>
                                </div>
                                <p class="mt-1 text-xs text-preto-400">Se as duas espécies têm a mesma característica, ela é mantida sem escolha.</p>
                            </div>
                        </template>
                    </template>

                    <!-- perícias escolhidas por traços -->
                    <div v-for="pedido in pedidos" :key="pedido.traco.id">
                        <h3 :class="rotulo">
                            {{ pedido.traco.nome }}: escolha {{ maximoDe(pedido) }} perícia{{ maximoDe(pedido) === 1 ? '' : 's'
                            }}{{ pedido.traco.escolhaPericias!.nivel === 2 ? ' (proficiência dobrada)' : '' }}
                        </h3>
                        <label v-if="pedido.traco.escolhaPericias!.troca" class="mb-2 flex items-center gap-2 text-sm text-preto-200">
                            <input
                                v-model="e.trocas[pedido.traco.id]"
                                type="checkbox"
                                class="size-4 accent-ouro-500"
                                @change="periciasDe(pedido.traco.id).splice(maximoDe(pedido))"
                            />
                            Trocar uma perícia por: {{ pedido.traco.escolhaPericias!.troca.rotulo }}
                        </label>
                        <div class="flex flex-wrap gap-1.5" role="group">
                            <button
                                v-for="p in PERICIAS_ESCOLHIVEIS.filter((x) => !pedido.traco.escolhaPericias!.excluir.includes(x.id))"
                                :key="p.id"
                                type="button"
                                :class="[cartao, 'px-2.5 py-1 text-xs', periciasDe(pedido.traco.id).includes(p.id) ? ativo : inativo]"
                                :aria-pressed="periciasDe(pedido.traco.id).includes(p.id)"
                                @click="alternarLista(periciasDe(pedido.traco.id), p.id, maximoDe(pedido))"
                            >
                                {{ p.nome }}
                            </button>
                        </div>
                    </div>

                    <!-- Humanos: Aspectos Humanos -->
                    <div v-if="ehHumano">
                        <label v-if="!ehKuja" class="mb-2 flex items-center gap-2 text-sm text-preto-200"
                            ><input v-model="e.adaptacaoOpcional" type="checkbox" class="size-4 accent-ouro-500" /> Regra opcional: só 1 perícia em
                            Adaptação e sem a Dificuldade "Aspectos Humanos"</label
                        >
                        <template v-if="nFalhas">
                            <h3 :class="rotulo">Aspectos Humanos: escolha {{ nFalhas }} falha{{ nFalhas === 1 ? '' : 's' }} de caráter</h3>
                            <div class="grid gap-2 sm:grid-cols-2">
                                <button
                                    v-for="f in falhasDisponiveis"
                                    :key="f.id"
                                    type="button"
                                    :class="[cartao, e.falhas.includes(f.id) ? ativo : inativo]"
                                    :aria-pressed="e.falhas.includes(f.id)"
                                    @click="alternarLista(e.falhas, f.id, nFalhas)"
                                >
                                    <span class="block font-semibold">{{ f.nome }}</span
                                    ><span class="mt-1 block text-xs text-preto-300">{{ f.descricao }}</span>
                                </button>
                            </div>
                        </template>
                    </div>

                    <label v-if="pedeAncestralidade" class="grid gap-1"
                        ><span :class="rotulo">Ancestralidade (traços Zoan, em texto)</span
                        ><textarea
                            v-model="e.ancestralidade"
                            rows="3"
                            maxlength="2000"
                            :class="campo"
                            class="resize-none"
                            placeholder="Animal ancestral e os traços escolhidos (até 2 comuns e 1 específico). O Narrador aprova."
                        />
                        <span class="text-xs text-preto-500"
                            >Pode ficar em branco por enquanto: a aba Detalhes da ficha guarda este texto.</span
                        ></label
                    >
                </section>

                <!-- 3. VARIAÇÃO RARA -->
                <section v-else-if="etapa === 'variacao'" class="grid gap-3" aria-label="Variação rara">
                    <p class="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-200" role="note">{{ AVISO_VARIACAO_RARA }}</p>
                    <p class="text-sm text-preto-300">Opcional. Ao escolher uma, ela substitui um dos Benefícios da Espécie.</p>
                    <div class="grid gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            :class="[cartao, !e.variacaoRara ? ativo : inativo]"
                            :aria-pressed="!e.variacaoRara"
                            @click="Object.assign(e, { variacaoRara: null, beneficioSubstituido: null })"
                        >
                            <span class="block font-semibold">Nenhuma</span><span class="text-xs text-preto-400">O caso normal.</span>
                        </button>
                        <button
                            v-for="v in VARIACOES_RARAS"
                            :key="v.id"
                            type="button"
                            :class="[cartao, e.variacaoRara === v.id ? ativo : inativo]"
                            :aria-pressed="e.variacaoRara === v.id"
                            @click="
                                Object.assign(e, {
                                    variacaoRara: v.id,
                                    beneficioSubstituido: beneficiosParaTrocar.length === 1 ? beneficiosParaTrocar[0].id : e.beneficioSubstituido,
                                })
                            "
                        >
                            <span class="block font-semibold">{{ v.nome }}</span
                            ><span class="block text-xs text-ouro-200">{{ v.traco.nome }}</span>
                            <span class="mt-1 block text-xs text-preto-400">{{ v.descricao }}</span>
                            <span class="mt-1 block text-xs text-preto-300"
                                >{{ v.traco.descricao.slice(0, 260) }}{{ v.traco.descricao.length > 260 ? '…' : '' }}</span
                            >
                        </button>
                    </div>
                    <div v-if="e.variacaoRara">
                        <h3 :class="rotulo">Qual Benefício da Espécie ela substitui?</h3>
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                v-for="b in beneficiosParaTrocar"
                                :key="b.id"
                                type="button"
                                :class="[cartao, e.beneficioSubstituido === b.id ? ativo : inativo]"
                                :aria-pressed="e.beneficioSubstituido === b.id"
                                @click="e.beneficioSubstituido = b.id"
                            >
                                {{ b.nome }}
                            </button>
                        </div>
                    </div>
                </section>

                <!-- 3b. ANTECEDENTE -->
                <section v-else-if="etapa === 'antecedente'" class="grid max-w-3xl gap-3" aria-label="Antecedente">
                    <p class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                        O passado do personagem: dá proficiência em uma perícia, +2 em um atributo (até 20) e uma Característica Especial. Pode
                        personalizar: trocar a característica por a de outro antecedente, escolher outra perícia e outro atributo.
                    </p>
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Antecedentes">
                        <button
                            v-for="a in ANTECEDENTES"
                            :key="a.id"
                            type="button"
                            :class="[cartao, e.antecedente?.id === a.id ? ativo : inativo]"
                            :aria-pressed="e.antecedente?.id === a.id"
                            @click="escolherAntecedente(a.id)"
                        >
                            <span class="font-serif text-base font-semibold">{{ a.nome }}</span>
                            <span class="block text-xs text-preto-400"
                                >{{ a.caracteristica.nome }} · {{ a.atributos.map((x) => x.toUpperCase()).join(' ou ') }}</span
                            >
                        </button>
                    </div>
                    <template v-if="antecedenteEscolhido && e.antecedente">
                        <p class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                            {{ antecedenteEscolhido.descricao }}
                        </p>
                        <label class="flex items-center gap-2 text-sm text-preto-200">
                            <input
                                :checked="e.antecedente.personalizado"
                                type="checkbox"
                                class="size-4 accent-ouro-500"
                                @change="personalizarAntecedente(($event.target as HTMLInputElement).checked)"
                            />
                            Personalizar (qualquer perícia e a característica especial de outro antecedente)
                        </label>
                        <div class="grid gap-1">
                            <span :class="rotulo">Perícia</span>
                            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Perícia do antecedente">
                                <button
                                    v-for="p in PERICIAS_ESCOLHIVEIS.filter(
                                        (x) => e.antecedente!.personalizado || antecedenteEscolhido!.pericias.includes(x.id),
                                    )"
                                    :key="p.id"
                                    type="button"
                                    :class="[cartao, 'px-2.5 py-1 text-xs', e.antecedente.pericia === p.id ? ativo : inativo]"
                                    :aria-pressed="e.antecedente.pericia === p.id"
                                    @click="e.antecedente.pericia = p.id"
                                >
                                    {{ p.nome }}
                                </button>
                            </div>
                        </div>
                        <div class="grid gap-1">
                            <span :class="rotulo">Atributo +2 (máximo 20)</span>
                            <div class="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Atributo do antecedente">
                                <button
                                    v-for="a in ATRIBUTOS"
                                    :key="a.id"
                                    type="button"
                                    :class="[cartao, 'text-center', e.antecedente.atributo === a.id ? ativo : inativo]"
                                    :aria-pressed="e.antecedente.atributo === a.id"
                                    @click="e.antecedente.atributo = a.id"
                                >
                                    <span class="block font-semibold"
                                        >{{ a.sigla }}{{ antecedenteEscolhido.atributos.includes(a.id) ? ' ★' : '' }}</span
                                    >
                                    <span class="block text-xs text-preto-400">+2</span>
                                </button>
                            </div>
                            <p class="text-xs text-preto-400">
                                ★ = recomendado para este antecedente. O +2 é somado ao valor do atributo definido na etapa Atributos e nunca passa de
                                20.
                            </p>
                        </div>
                        <div v-if="e.antecedente.personalizado" class="grid gap-1">
                            <span :class="rotulo">Característica especial</span>
                            <select v-model="e.antecedente.caracteristicaDe" :class="campo" aria-label="Característica especial">
                                <option :value="null">A do próprio antecedente ({{ antecedenteEscolhido.caracteristica.nome }})</option>
                                <option v-for="o in featuresDeOutros" :key="o.id" :value="o.id">{{ o.caracteristica.nome }} ({{ o.nome }})</option>
                            </select>
                        </div>
                        <div class="rounded-lg border border-ouro-500/30 bg-ouro-500/5 p-3">
                            <p class="font-serif text-base font-semibold text-ouro-200">
                                {{
                                    (e.antecedente.personalizado && e.antecedente.caracteristicaDe
                                        ? antecedentePorId(e.antecedente.caracteristicaDe)
                                        : antecedenteEscolhido
                                    )?.caracteristica.nome
                                }}
                            </p>
                            <p class="text-xs leading-relaxed text-preto-200">
                                {{
                                    (e.antecedente.personalizado && e.antecedente.caracteristicaDe
                                        ? antecedentePorId(e.antecedente.caracteristicaDe)
                                        : antecedenteEscolhido
                                    )?.caracteristica.descricao
                                }}
                            </p>
                        </div>
                    </template>
                </section>

                <!-- 3c. PROFISSÃO -->
                <section v-else-if="etapa === 'profissao'" class="grid max-w-3xl gap-3" aria-label="Profissão">
                    <p class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                        Sua função na tripulação. Você recebe proficiência em 2 perícias da profissão, nas ferramentas dela, as características únicas
                        e a perícia <b>Ofício</b> treinada: o Bônus de Proficiência vale em Testes de QUALQUER atributo ligados à profissão. Novas
                        profissões só nos níveis 5, 10, 15 e 20.
                    </p>
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Profissões">
                        <button
                            v-for="p in PROFISSOES"
                            :key="p.id"
                            type="button"
                            :class="[cartao, e.profissao?.id === p.id ? ativo : inativo]"
                            :aria-pressed="e.profissao?.id === p.id"
                            @click="escolherProfissao(p.id)"
                        >
                            <span class="font-serif text-base font-semibold">{{ p.nome }}</span>
                            <span class="block text-xs text-preto-400">{{ p.resumo }}</span>
                        </button>
                        <button
                            type="button"
                            :class="[cartao, semProfissao ? ativo : inativo]"
                            :aria-pressed="semProfissao"
                            @click="escolherProfissao('nenhuma')"
                        >
                            <span class="font-serif text-base font-semibold">{{ SEM_PROFISSAO.nome }}</span>
                            <span class="block text-xs text-preto-400">Ajudante Perfeito, Foco, Parceiro de Treino e Tempo Livre.</span>
                        </button>
                    </div>
                    <template v-if="e.profissao?.id && (profissaoEscolhida || semProfissao)">
                        <div class="grid gap-1">
                            <span :class="rotulo"
                                >Perícias ({{ e.profissao.pericias.length }}/2){{
                                    semProfissao ? ' — Foco, exceto Haki, Sobrenatural e Sorte' : ''
                                }}</span
                            >
                            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Perícias da profissão">
                                <button
                                    v-for="p in periciasDaProfissao"
                                    :key="p.id"
                                    type="button"
                                    :class="[cartao, 'px-2.5 py-1 text-xs', e.profissao.pericias.includes(p.id) ? ativo : inativo]"
                                    :aria-pressed="e.profissao.pericias.includes(p.id)"
                                    @click="alternarPericiaDaProfissao(p.id)"
                                >
                                    {{ p.nome }}
                                </button>
                            </div>
                        </div>
                        <template v-if="profissaoEscolhida">
                            <p class="text-xs text-preto-400">
                                <b>{{ profissaoEscolhida.ferramenta }}</b> (proficiência) · Ofício ({{ profissaoEscolhida.nome }}) treinado
                            </p>
                            <details class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                                <summary class="cursor-pointer font-semibold text-preto-200">
                                    Itens iniciais (entram no inventário ao concluir)
                                </summary>
                                <ul class="mt-1 list-disc pl-5">
                                    <li v-for="i in profissaoEscolhida.itens" :key="i">{{ i }}</li>
                                </ul>
                            </details>
                            <details class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                                <summary class="cursor-pointer font-semibold text-preto-200">Testes de Atributo da profissão</summary>
                                <ul class="mt-1 list-disc pl-5">
                                    <li v-for="t in profissaoEscolhida.testes" :key="t">{{ t }}</li>
                                </ul>
                            </details>
                            <div class="grid gap-2">
                                <div
                                    v-for="t in profissaoEscolhida.tracos"
                                    :key="t.id"
                                    class="rounded-lg border border-ouro-500/30 bg-ouro-500/5 p-3"
                                >
                                    <p class="font-serif text-base font-semibold text-ouro-200">{{ t.nome }}</p>
                                    <p class="line-clamp-4 text-xs leading-relaxed text-preto-200">
                                        {{ t.descricao.replace(/\{(cd|bellys|dado):(\d+)\}/g, '$2') }}
                                    </p>
                                </div>
                            </div>
                        </template>
                        <div v-else class="grid gap-2">
                            <div v-for="t in SEM_PROFISSAO.tracos" :key="t.id" class="rounded-lg border border-ouro-500/30 bg-ouro-500/5 p-3">
                                <p class="font-serif text-base font-semibold text-ouro-200">{{ t.nome }}</p>
                                <p class="text-xs leading-relaxed text-preto-200">{{ t.descricao }}</p>
                            </div>
                        </div>
                    </template>
                </section>

                <!-- 4. ESTILO DE LUTA (provisório) -->
                <section v-else-if="etapa === 'estilo'" class="grid max-w-xl gap-3" aria-label="Estilo de luta">
                    <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="Estilo de luta">
                        <button
                            v-for="est in ESTILOS"
                            :key="est.id"
                            type="button"
                            :class="[cartao, e.estilo.id === est.id ? ativo : inativo]"
                            :aria-pressed="e.estilo.id === est.id"
                            @click="escolherEstilo(est.id)"
                        >
                            <span class="font-serif text-base font-semibold">{{ est.nome }}</span>
                            <span class="block text-xs text-preto-400"
                                >{{ est.dado }} · atributo primário {{ est.atributosPrimarios.map((a) => a.toUpperCase()).join(' ou ') }}</span
                            >
                        </button>
                        <button
                            type="button"
                            :class="[cartao, !e.estilo.id ? ativo : inativo]"
                            :aria-pressed="!e.estilo.id"
                            @click="escolherEstilo(null)"
                        >
                            <span class="font-serif text-base font-semibold">Outro (provisório)</span>
                            <span class="block text-xs text-preto-400">Nome e dado de vida à mão, até o estilo entrar no catálogo.</span>
                        </button>
                    </div>
                    <template v-if="estiloEscolhido">
                        <p class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">{{ estiloEscolhido.descricao }}</p>
                        <p class="text-xs text-preto-400">
                            Salvaguardas: {{ estiloEscolhido.salvaguardas.map((s) => s.toUpperCase()).join(', ') }} · Proficiência:
                            {{ estiloEscolhido.proficiencias.join(', ') }}
                        </p>
                        <div v-if="estiloEscolhido.atributosPrimarios.length > 1" class="grid gap-1">
                            <span :class="rotulo">Atributo primário</span>
                            <div class="flex flex-wrap gap-2" role="group" aria-label="Atributo primário">
                                <button
                                    v-for="a in estiloEscolhido.atributosPrimarios"
                                    :key="a"
                                    type="button"
                                    :class="[cartao, e.estilo.primario === a ? ativo : inativo]"
                                    :aria-pressed="e.estilo.primario === a"
                                    @click="e.estilo.primario = a"
                                >
                                    {{ ATRIBUTOS.find((x) => x.id === a)?.nome }}
                                </button>
                            </div>
                        </div>
                        <div v-if="estiloEscolhido.caminhos?.length" class="grid gap-1">
                            <span :class="rotulo">Caminho</span>
                            <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="Caminho">
                                <button
                                    v-for="c in estiloEscolhido.caminhos"
                                    :key="c.id"
                                    type="button"
                                    :class="[cartao, e.estilo.caminho === c.id ? ativo : inativo]"
                                    :aria-pressed="e.estilo.caminho === c.id"
                                    @click="e.estilo.caminho = c.id"
                                >
                                    <span class="font-semibold">{{ c.nome }}</span>
                                    <span class="block text-xs text-preto-400">{{ c.descricao }}</span>
                                </button>
                            </div>
                        </div>
                        <div class="grid gap-1">
                            <span :class="rotulo">Arma favorita</span>
                            <div class="flex flex-wrap gap-2" role="group" aria-label="Arma favorita">
                                <button
                                    v-for="a in estiloEscolhido.armasFavoritas"
                                    :key="a"
                                    type="button"
                                    :class="[cartao, e.estilo.armaFavorita === a ? ativo : inativo]"
                                    :aria-pressed="e.estilo.armaFavorita === a"
                                    @click="e.estilo.armaFavorita = a"
                                >
                                    {{ a }}
                                </button>
                            </div>
                        </div>
                        <div class="grid gap-1">
                            <span :class="rotulo">Habilidade Básica Inata</span>
                            <div class="flex flex-wrap gap-2" role="group" aria-label="Habilidade Básica Inata">
                                <button
                                    v-for="h in estiloEscolhido.habilidadesInatas"
                                    :key="h.id"
                                    type="button"
                                    :class="[cartao, e.estilo.hbInata === h.id ? ativo : inativo]"
                                    :aria-pressed="e.estilo.hbInata === h.id"
                                    @click="e.estilo.hbInata = h.id"
                                >
                                    {{ h.nome }}
                                </button>
                            </div>
                        </div>
                        <div class="grid gap-1">
                            <span :class="rotulo">Perícias do estilo ({{ e.estilo.pericias?.length ?? 0 }}/{{ estiloEscolhido.pericias }})</span>
                            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Perícias do estilo">
                                <button
                                    v-for="p in PERICIAS_ESCOLHIVEIS"
                                    :key="p.id"
                                    type="button"
                                    :class="[cartao, 'px-2 py-1 text-xs', e.estilo.pericias?.includes(p.id) ? ativo : inativo]"
                                    :aria-pressed="!!e.estilo.pericias?.includes(p.id)"
                                    @click="alternarPericiaDoEstilo(p.id)"
                                >
                                    {{ p.nome }}
                                </button>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <label class="grid gap-1"
                            ><span :class="rotulo">Estilo de luta</span
                            ><input v-model="e.estilo.nome" type="text" maxlength="80" :class="campo" placeholder="Ex.: Espadachim"
                        /></label>
                        <label class="grid gap-1"
                            ><span :class="rotulo">Dado de vida do estilo</span
                            ><select v-model="e.estilo.dado" :class="campo">
                                <option v-for="d in DADOS_DE_VIDA" :key="d" :value="d">{{ d }}</option>
                            </select></label
                        >
                    </template>
                    <p class="text-xs text-preto-400">
                        PV no nível 1 = {{ e.estilo.dado }} no máximo ({{ e.estilo.dado.slice(1) }}) + mod. de Constituição + PV base da espécie ({{
                            fisico?.pv ?? 0
                        }}).
                    </p>
                    <!-- Aptidão Natural: entre as perícias em que já há proficiência (Adaptação e as do estilo) -->
                    <div v-for="pedido in pedidosDeAptidao" :key="pedido.traco.id" class="grid gap-1">
                        <span :class="rotulo"
                            >{{ pedido.traco.nome }}: escolha {{ pedido.quantidade }} perícia em que já seja proficiente (proficiência dobrada)</span
                        >
                        <p v-if="!proficientes.length" class="text-xs text-preto-400">
                            Você ainda não tem nenhuma: escolha as do estilo e de Adaptação antes.
                        </p>
                        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="pedido.traco.nome">
                            <button
                                v-for="p in PERICIAS_ESCOLHIVEIS.filter((x) => proficientes.includes(x.id))"
                                :key="p.id"
                                type="button"
                                :class="[cartao, 'px-2.5 py-1 text-xs', periciasDe(pedido.traco.id).includes(p.id) ? ativo : inativo]"
                                :aria-pressed="periciasDe(pedido.traco.id).includes(p.id)"
                                @click="alternarLista(periciasDe(pedido.traco.id), p.id, pedido.quantidade)"
                            >
                                {{ p.nome }}
                            </button>
                        </div>
                    </div>
                </section>

                <!-- 4b. HABILIDADE BÁSICA -->
                <section v-else-if="etapa === 'habilidades'" class="grid max-w-3xl gap-3" aria-label="Habilidade Básica">
                    <p v-if="!estiloEscolhido" class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                        As Habilidades Básicas acompanham os estilos do catálogo. Com o estilo provisório não há o que escolher: avance.
                    </p>
                    <template v-else>
                        <p class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                            Escolha 1 Habilidade Básica. Você ganha outra no 2º e no 3º nível (pelo "Subir de nível") e a Inata ({{
                                hbPorId(e.estilo.hbInata)?.nome
                            }}) já está garantida. Nenhuma se repete.
                        </p>
                        <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="Habilidades Básicas">
                            <button
                                v-for="h in HABILIDADES_BASICAS"
                                :key="h.id"
                                type="button"
                                :disabled="h.id === e.estilo.hbInata"
                                :class="[cartao, e.hb === h.id ? ativo : inativo, h.id === e.estilo.hbInata ? 'opacity-40' : '']"
                                :aria-pressed="e.hb === h.id"
                                @click="e.hb = h.id"
                            >
                                <span class="font-semibold">{{ h.nome }}</span>
                                <span class="block text-xs text-preto-400">{{ h.resumo }}</span>
                            </button>
                        </div>
                        <div v-if="e.hb && hbPorId(e.hb)?.escolha === 'prodigio'" class="grid gap-1">
                            <span :class="rotulo">Crítico Marcial vale para</span>
                            <div class="flex gap-2" role="group" aria-label="Crítico Marcial">
                                <button
                                    v-for="o in opcoesProdigio"
                                    :key="o.id"
                                    type="button"
                                    :class="[cartao, e.hbOpcoes?.[e.hb]?.[0] === o.id ? ativo : inativo]"
                                    @click="escolherOpcaoDaHB(o.id)"
                                >
                                    {{ o.nome }}
                                </button>
                            </div>
                        </div>
                        <div v-if="e.hb && hbPorId(e.hb)?.escolha === 'quebrador'" class="grid gap-1">
                            <span :class="rotulo">Quebrador de Regras</span>
                            <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="Quebrador de Regras">
                                <button
                                    v-for="o in OPCOES_QUEBRADOR"
                                    :key="o.id"
                                    type="button"
                                    :class="[cartao, e.hbOpcoes?.[e.hb]?.[0] === o.id ? ativo : inativo]"
                                    @click="escolherOpcaoDaHB(o.id)"
                                >
                                    <span class="font-semibold">{{ o.nome }}</span>
                                    <span class="block text-xs text-preto-400">{{ o.descricao }}</span>
                                </button>
                            </div>
                        </div>
                    </template>
                </section>

                <!-- 4c. APTIDÃO PARA HAKI -->
                <section v-else-if="etapa === 'haki'" class="grid max-w-xl gap-3" aria-label="Aptidão para Haki">
                    <p class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                        Escolha o tipo de Haki com o qual você tem mais afinidade. Ao despertá-lo (a partir do 8º nível ou quando o Narrador liberar)
                        você recebe 2 Pontos de Ambição adicionais. O Haki do Rei só pode ser a afinidade se o Narrador já definiu que você o possui
                        (então ajuste na aba Haki).
                    </p>
                    <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="Afinidade com Haki">
                        <button
                            v-for="a in [
                                {
                                    id: 'armamento',
                                    nome: 'Haki do Armamento',
                                    descricao: 'Reveste o corpo e as armas: defesa e ataques fortalecidos.',
                                },
                                { id: 'observacao', nome: 'Haki da Observação', descricao: 'Percebe presenças e prevê movimentos.' },
                            ] as const"
                            :key="a.id"
                            type="button"
                            :class="[cartao, e.hakiAfinidade === a.id ? ativo : inativo]"
                            :aria-pressed="e.hakiAfinidade === a.id"
                            @click="e.hakiAfinidade = a.id"
                        >
                            <span class="font-semibold">{{ a.nome }}</span>
                            <span class="block text-xs text-preto-400">{{ a.descricao }}</span>
                        </button>
                    </div>
                </section>

                <!-- 5. ATRIBUTOS -->
                <section v-else-if="etapa === 'atributos'" class="grid gap-4" aria-label="Atributos">
                    <div class="grid gap-2 sm:grid-cols-3" role="group" aria-label="Método">
                        <button
                            v-for="m in metodos"
                            :key="m.id"
                            type="button"
                            :class="[cartao, e.atributos.metodo === m.id ? ativo : inativo]"
                            :aria-pressed="e.atributos.metodo === m.id"
                            @click="trocarMetodo(m.id)"
                        >
                            <span class="block font-semibold">{{ m.rotulo }}</span
                            ><span class="text-xs text-preto-400">{{ m.ajuda }}</span>
                        </button>
                    </div>
                    <div v-if="e.atributos.metodo === 'compra'" class="text-sm" :class="pontosRestantes < 0 ? 'text-red-300' : 'text-ouro-100'">
                        Pontos restantes: <strong class="tabular-nums">{{ pontosRestantes }}</strong> de {{ PONTOS_DE_COMPRA }}
                    </div>
                    <div v-if="e.atributos.metodo === 'rolagem'" class="flex flex-wrap items-center gap-3">
                        <Button type="button" :disabled="ocupado || !!e.rolados" @click="rolar"
                            ><Dices class="size-4" /> {{ e.rolados ? 'Já rolado' : 'Rolar 6 × 4d6 (descarta o menor)' }}</Button
                        >
                        <span v-if="e.rolados" class="font-mono text-sm text-ouro-100">{{ e.rolados.join(' · ') }}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <div v-for="a in ATRIBUTOS" :key="a.id" class="rounded-lg border border-preto-700 bg-preto-950 p-2 text-center">
                            <span class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">{{ a.sigla }}</span>
                            <div v-if="e.atributos.metodo === 'compra'" class="my-1 flex items-center justify-center gap-1">
                                <button
                                    type="button"
                                    class="rounded border border-preto-600 p-1 hover:border-ouro-400"
                                    :aria-label="`Diminuir ${a.nome}`"
                                    @click="ajustar(a.id, -1)"
                                >
                                    <Minus class="size-3" />
                                </button>
                                <span class="w-7 text-lg font-semibold tabular-nums">{{ e.atributos.base[a.id] }}</span>
                                <button
                                    type="button"
                                    class="rounded border border-preto-600 p-1 hover:border-ouro-400"
                                    :aria-label="`Aumentar ${a.nome}`"
                                    @click="ajustar(a.id, 1)"
                                >
                                    <Plus class="size-3" />
                                </button>
                            </div>
                            <select
                                v-else
                                v-model.number="e.atributos.base[a.id]"
                                :class="campo"
                                class="my-1 w-full text-center"
                                :aria-label="`Valor de ${a.nome}`"
                            >
                                <option v-for="(v, i) in e.atributos.metodo === 'padrao' ? VALORES_PADRAO : (e.rolados ?? [])" :key="i" :value="v">
                                    {{ v }}
                                </option>
                            </select>
                            <p class="text-xs text-preto-400">
                                espécie {{ e.ajuste.atributos.includes(a.id) ? (e.ajuste.tipo === 'um' ? '+2' : '+1') : '+0' }}
                            </p>
                            <p class="font-serif text-lg font-bold text-ouro-100">
                                {{ finais[a.id] }} <span class="text-sm text-preto-300">({{ comSinal(modificador(finais[a.id])) }})</span>
                            </p>
                        </div>
                    </div>
                </section>

                <!-- 6. RESUMO -->
                <section v-else class="grid gap-4" aria-label="Resumo">
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div class="rounded-lg border border-preto-700 bg-preto-950 p-3">
                            <span :class="rotulo">Espécie</span>
                            <p class="font-serif text-lg font-semibold">{{ fisico?.nome }}</p>
                            <p class="text-xs text-preto-400">{{ fisico?.categoria }} · preconceito {{ fisico?.preconceito.toLowerCase() }}</p>
                        </div>
                        <div class="rounded-lg border border-preto-700 bg-preto-950 p-3">
                            <span :class="rotulo">Estilo de luta</span>
                            <p class="font-serif text-lg font-semibold">{{ e.estilo.nome }}</p>
                            <p class="text-xs text-preto-400">
                                dado de vida {{ e.estilo.dado }}<template v-if="estiloEscolhido"> · {{ e.estilo.armaFavorita }}</template>
                            </p>
                        </div>
                        <div class="rounded-lg border border-preto-700 bg-preto-950 p-3">
                            <span :class="rotulo">Antecedente</span>
                            <p class="font-serif text-lg font-semibold">{{ antecedenteEscolhido?.nome }}</p>
                            <p class="text-xs text-preto-400">
                                {{ PERICIAS.find((x) => x.id === e.antecedente?.pericia)?.nome }} · +2 {{ e.antecedente?.atributo?.toUpperCase() }} ·
                                {{
                                    (e.antecedente?.personalizado && e.antecedente.caracteristicaDe
                                        ? antecedentePorId(e.antecedente.caracteristicaDe)
                                        : antecedenteEscolhido
                                    )?.caracteristica.nome
                                }}
                            </p>
                        </div>
                        <div class="rounded-lg border border-preto-700 bg-preto-950 p-3">
                            <span :class="rotulo">Profissão</span>
                            <p class="font-serif text-lg font-semibold">{{ semProfissao ? SEM_PROFISSAO.nome : profissaoEscolhida?.nome }}</p>
                            <p class="text-xs text-preto-400">
                                {{ (e.profissao?.pericias ?? []).map((id) => PERICIAS.find((x) => x.id === id)?.nome).join(' e ')
                                }}{{ semProfissao ? '' : ' · Ofício treinado' }}
                            </p>
                        </div>
                        <div class="rounded-lg border border-preto-700 bg-preto-950 p-3">
                            <span :class="rotulo">PV (nível 1)</span>
                            <p class="font-serif text-lg font-semibold text-red-300">{{ pvInicial(e) }}</p>
                            <p class="text-xs text-preto-400">
                                {{ e.estilo.dado.slice(1) }} + CON {{ comSinal(modificador(finais.con)) }} + espécie {{ fisico?.pv }}
                            </p>
                        </div>
                        <div class="rounded-lg border border-preto-700 bg-preto-950 p-3">
                            <span :class="rotulo">Deslocamento</span>
                            <p class="font-serif text-lg font-semibold">{{ fisico ? textoDeMovimento(fisico.movimento) : '' }}</p>
                            <p class="text-xs text-preto-400">PP no nível 1: 4</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        <div v-for="a in ATRIBUTOS" :key="a.id" class="rounded-lg border border-preto-700 bg-preto-950 p-2 text-center">
                            <span class="text-[11px] font-semibold text-ouro-400">{{ siglas[a.id] }}</span>
                            <p class="font-serif text-lg font-bold">
                                {{ finais[a.id] }} <span class="text-sm text-preto-300">({{ comSinal(modificador(finais[a.id])) }})</span>
                            </p>
                        </div>
                    </div>
                    <div>
                        <h3 :class="rotulo">Características que a ficha vai receber</h3>
                        <ul class="grid gap-1.5 sm:grid-cols-2">
                            <li
                                v-for="(c, i) in (resultado.campos.caracteristicas as Caracteristica[]).filter((x) => x.builder)"
                                :key="i"
                                class="rounded-lg border border-preto-700 p-2 text-sm"
                            >
                                <span class="font-semibold">{{ c.nome }}</span> <span class="text-xs text-preto-400">· {{ c.origem }}</span
                                ><span v-if="c.usos" class="ml-1 text-[10px] uppercase text-sky-300">{{
                                    c.usos.porNivel ? 'usos = nível' : c.usos.max + ' usos'
                                }}</span>
                            </li>
                        </ul>
                    </div>
                    <ul
                        v-if="resultado.avisos.length"
                        class="grid gap-1 rounded-lg border border-ouro-500/30 bg-ouro-500/10 p-3 text-xs text-ouro-100"
                    >
                        <li v-for="(a, i) in resultado.avisos" :key="i">{{ a }}</li>
                    </ul>
                    <p class="text-xs text-preto-400">
                        Ao concluir, as características criadas antes por este assistente são substituídas e as que você criou à mão ficam. Perícias e
                        salvaguardas vêm das escolhas acima.
                    </p>
                </section>
            </div>

            <footer class="flex flex-wrap items-center gap-3 border-t border-preto-800 px-5 py-3">
                <ul v-if="problemas.length" class="mr-auto grid gap-0.5 text-xs text-red-300" aria-live="polite">
                    <li v-for="p in problemas" :key="p">{{ p }}</li>
                </ul>
                <p v-else-if="erro" class="mr-auto text-xs text-red-300" role="alert">{{ erro }}</p>
                <span v-else class="mr-auto" />
                <Button type="button" variant="outline" :disabled="indice === 0 || ocupado" @click="voltar">Voltar</Button>
                <Button v-if="etapa !== 'resumo'" type="button" :disabled="problemas.length > 0 || ocupado" @click="avancar">Avançar</Button>
                <Button v-else type="button" :disabled="ocupado || !!resultado.avisos.includes('Escolha a espécie.')" @click="concluir"
                    >Concluir e preencher a ficha</Button
                >
            </footer>
        </DialogContent>
    </Dialog>
</template>
