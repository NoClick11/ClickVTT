<script setup lang="ts">
import { Anchor, Check, Coins, Hammer, Package, Ship, Trash2, Users, Wrench, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import type { ItemDto } from '../../../tipos-mesa';
import {
    ANCORAS,
    CANHOES,
    COMODOS,
    CONDICOES_DO_NAVIO,
    FORTIFICACOES,
    FUNCOES,
    LEMES,
    MADEIRAS,
    MASTROS,
    MAX_FUNCOES,
    MOTORES,
    TAMANHOS,
    type Canhao,
} from './dados';
import {
    calcularNavio,
    consertoDoNavio,
    custoDaObra,
    efetivoDoNavio,
    problemaDaObra,
    problemaDaTripulacao,
    tipoEfetivo,
    type Grupo,
    type GrupoDeLista,
    type GrupoUnico,
    type Modo,
    type NavioFicha,
    type Tripulante,
} from './regras';

/**
 * Ficha do navio (cap. 13 e 14), de toda a mesa: os jogadores constroem, mexem na tripulação, guardam e retiram itens e Belly.
 * Só mostra e pede: quem valida, debita e move é o servidor (`acao`). PV, ajustes e concluir obra são do mestre.
 */
const props = defineProps<{
    personagem: PersonagemFicha;
    ficha: Record<string, unknown>;
    itens: ItemDto[];
    mestre: boolean;
    /** Dia do calendário da mesa (as obras ficam prontas por ele). */
    dia: number;
    /** Personagens que este participante pode usar na carga e no tesouro, com a ficha. */
    personagens: { id: number; nome: string; ficha: Record<string, unknown> }[];
    /** Personagens da mesa que podem ser ligados a um tripulante. */
    tripulaveis: { id: number; nome: string }[];
    /** Executa a ação no servidor; devolve o motivo quando ele recusa. */
    acao: (nome: string, dados?: Record<string, unknown>) => Promise<string | null>;
}>();
const emit = defineEmits<{ renomear: [nome: string] }>();

interface RefDeItem {
    item_id: number;
    qtd: number;
}
type Inventario = { secao: string; itens: RefDeItem[] }[];

const navio = computed(() => props.ficha.navio as NavioFicha);
const pv = computed(() => (props.ficha.pv ?? { atual: 0, temp: 0 }) as { atual: number; temp?: number });
const tesouro = computed(() => Number(props.ficha.belly ?? 0));
const calc = computed(() => calcularNavio(navio.value, pv.value.atual));
const tamanho = computed(() => TAMANHOS.find((t) => t.id === navio.value.tamanho) ?? TAMANHOS[0]);
const condicao = computed(() => CONDICOES_DO_NAVIO.find((c) => c.id === calc.value.condicao)!);
const efetivo = computed(() => efetivoDoNavio(navio.value));
const bellys = (n: number) => `฿ ${n.toLocaleString('pt-BR')}`;

type AbaId = 'resumo' | 'construcao' | 'tripulacao' | 'carga';
const abas = [
    { id: 'resumo' as AbaId, rotulo: 'Resumo', icone: Ship },
    { id: 'construcao' as AbaId, rotulo: 'Construção', icone: Hammer },
    { id: 'tripulacao' as AbaId, rotulo: 'Tripulação', icone: Users },
    { id: 'carga' as AbaId, rotulo: 'Carga e tesouro', icone: Package },
];
const aba = ref<AbaId>('resumo');

// --- pedir ao servidor: um por vez, com o motivo da recusa à vista ---------------------------------------------------------
const erro = ref<string | null>(null);
const ocupado = ref(false);
async function fazer(nome: string, dados: Record<string, unknown> = {}): Promise<boolean> {
    if (ocupado.value) return false;
    ocupado.value = true;
    erro.value = await props.acao(nome, dados);
    ocupado.value = false;

    return erro.value === null;
}
watch(aba, () => (erro.value = null));

const nome = ref(props.personagem.nome);
watch(
    () => props.personagem.nome,
    (n) => (nome.value = n),
);

// --- PV (mestre) ----------------------------------------------------------------------------------------------------------
const dano = ref(0);
const aplicarBr = ref(true);
const reparo = ref(0);
const paralelos = ref(0);
const pctPv = computed(() => Math.max(0, Math.min(100, Math.round((pv.value.atual * 100) / calc.value.pvMax))));
const corDaCondicao: Record<string, string> = {
    integro: 'border-green-400/50 bg-green-500/15 text-green-200',
    danificado: 'border-ouro-400/50 bg-ouro-500/15 text-ouro-100',
    avariado: 'border-orange-400/50 bg-orange-500/15 text-orange-200',
    'muito-danificado': 'border-red-400/50 bg-red-500/15 text-red-200',
    irreparavel: 'border-red-500 bg-red-600/30 text-red-100',
};

// --- conserto ---------------------------------------------------------------------------------------------------------------
const consertoCarpinteiro = computed(() => consertoDoNavio(navio.value, pv.value.atual, 'carpinteiro'));
const consertoEstaleiro = computed(() => consertoDoNavio(navio.value, pv.value.atual, 'estaleiro'));
const diasDoCarpinteiro = ref(1);
const valorDoEstaleiro = ref(0);

// --- construção -------------------------------------------------------------------------------------------------------------
/** Só o mestre: põe a peça sem custo, pronta na hora e sem os limites do livro. */
const semCusto = ref(false);
interface Pendente {
    grupo: Grupo;
    tipo: string;
    modo: Modo;
    nome: string;
    custo: number;
    dias: number;
}
const pendente = ref<Pendente | null>(null);
function pedirObra(grupo: Grupo, tipo: string, modo: Modo, nomeDaPeca: string) {
    const obra = custoDaObra(navio.value, grupo, tipo, modo);
    if (!obra) return;
    erro.value = null;
    pendente.value = { grupo, tipo, modo, nome: nomeDaPeca, custo: semCusto.value ? 0 : obra.custo, dias: semCusto.value ? 0 : obra.dias };
}
async function confirmarObra() {
    const p = pendente.value;
    if (!p) return;
    const extra = props.mestre && semCusto.value ? { valor: 0, dias: 0, ignorar_limites: true } : {};
    if (await fazer('construir', { grupo: p.grupo, tipo: p.tipo, modo: p.modo, ...extra })) pendente.value = null;
}
const problema = (grupo: Grupo, tipo: string) => (props.mestre && semCusto.value ? null : problemaDaObra(navio.value, grupo, tipo));
const custo = (grupo: Grupo, tipo: string, modo: Modo) => custoDaObra(navio.value, grupo, tipo, modo);
const prazo = (dias: number) => (dias > 0 ? `${dias} dia${dias > 1 ? 's' : ''}` : 'na hora');
const emObra = (prontoDia: number | null) => prontoDia !== null;

/** As partes únicas do casco, com o que vale agora, a obra em andamento e as opções de troca. */
const partes = computed(() => {
    const grupo = (id: GrupoUnico, rotulo: string, opcoes: { id: string; nome: string; info: string }[], removivel = false) => {
        const parte = navio.value[id];
        const atual = tipoEfetivo(parte);

        return {
            id,
            rotulo,
            removivel,
            atual: opcoes.find((o) => o.id === atual)?.nome ?? 'Não tem',
            obra: emObra(parte.pronto_dia) ? { nome: opcoes.find((o) => o.id === parte.tipo)?.nome ?? '', dia: parte.pronto_dia! } : null,
            tem: atual !== null,
            opcoes: opcoes.filter((o) => o.id !== parte.tipo),
        };
    };

    return [
        grupo(
            'madeira',
            'Madeira do casco',
            MADEIRAS.map((m) => ({ id: m.id, nome: m.nome, info: `CR ${m.cr} · BR ${m.br}` })),
        ),
        grupo(
            'fortificacao',
            'Fortificação',
            FORTIFICACOES.map((f) => ({ id: f.id, nome: f.nome, info: `+${f.cr} CR` })),
            true,
        ),
        grupo('kairoseki', 'Casco de kairoseki', [{ id: 'kairoseki', nome: 'Revestimento de Kairoseki', info: '+1 CR' }], true),
        grupo(
            'ancora',
            'Âncora',
            ANCORAS.map((a) => ({ id: a.id, nome: a.nome, info: '' })),
        ),
        grupo(
            'leme',
            'Leme',
            LEMES.map((l) => ({ id: l.id, nome: l.nome, info: l.texto ?? '' })),
        ),
    ];
});

/** Mastros, motores e canhões: o que está instalado e o que dá para pôr. */
const listas = computed(() => {
    const grupo = (id: GrupoDeLista, rotulo: string, pecas: { id: string; nome: string; info: string }[], limite: number | null) => ({
        id,
        rotulo,
        limite,
        instaladas: navio.value[id].map((p) => ({ ...p, nome: pecas.find((x) => x.id === p.tipo)?.nome ?? p.tipo })),
        pecas,
    });

    return [
        grupo(
            'mastros',
            'Mastros',
            MASTROS.map((m) => ({ id: m.id, nome: m.nome, info: `+${m.nos} nós` })),
            tamanho.value.mastros,
        ),
        grupo(
            'motores',
            'Motores',
            MOTORES.map((m) => ({ id: m.id, nome: m.nome, info: [m.nos ? `+${m.nos} nós` : '', m.texto ?? ''].filter(Boolean).join(' · ') })),
            null,
        ),
        grupo(
            'canhoes',
            'Canhões',
            CANHOES.map((c: Canhao) => ({
                id: c.id,
                nome: c.nome,
                info: `${c.alcance} · acerto ${c.acerto} · dano: ${c.dano}${c.texto ? ` · ${c.texto}` : ''}`,
            })),
            tamanho.value.canhoes,
        ),
    ];
});

/** Todos os cômodos do livro: os que o navio tem (com cada unidade) e os que não tem. */
const comodos = computed(() =>
    COMODOS.map((c) => ({ ...c, unidades: navio.value.comodos.filter((x) => x.tipo === c.id) })).sort(
        (a, b) => Number(b.unidades.length > 0) - Number(a.unidades.length > 0),
    ),
);

// --- tripulação: edita-se um rascunho e salva-se a lista inteira --------------------------------------------------------------
const rascunho = ref<Tripulante[]>([]);
const mudou = ref(false);
const copiarTripulacao = () => {
    rascunho.value = JSON.parse(JSON.stringify(navio.value.tripulacao ?? []));
    mudou.value = false;
};
copiarTripulacao();
watch(
    () => navio.value.tripulacao,
    () => !mudou.value && copiarTripulacao(),
    { deep: true },
);
const uid = () => Math.random().toString(36).slice(2, 12);
function novoTripulante(personagemId: number | null = null) {
    const p = props.tripulaveis.find((x) => x.id === personagemId);
    rascunho.value.push({ uid: uid(), nome: p?.nome ?? '', personagem_id: p?.id ?? null, qtd: 1, funcoes: [] });
    mudou.value = true;
}
function alternarFuncao(t: Tripulante, id: string) {
    t.funcoes = t.funcoes.includes(id) ? t.funcoes.filter((f) => f !== id) : t.funcoes.length < MAX_FUNCOES ? [...t.funcoes, id] : t.funcoes;
    mudou.value = true;
}
const problemaDoRascunho = computed(() => problemaDaTripulacao(rascunho.value));
const livres = computed(() => props.tripulaveis.filter((p) => !rascunho.value.some((t) => t.personagem_id === p.id)));
async function salvarTripulacao() {
    if (await fazer('tripulacao', { lista: rascunho.value })) mudou.value = false;
}
const corDaSituacao = { ok: 'text-green-300', minimo: 'text-ouro-200', 'sem-minimo': 'text-red-300' };
const rotuloDaSituacao = { ok: 'Completo', minimo: 'Só o mínimo', 'sem-minimo': 'Abaixo do mínimo' };

// --- carga e tesouro ----------------------------------------------------------------------------------------------------------
const personagemId = ref<number | null>(props.personagens[0]?.id ?? null);
watch(
    () => props.personagens,
    (l) => {
        if (!l.some((p) => p.id === personagemId.value)) personagemId.value = l[0]?.id ?? null;
    },
);
const agente = computed(() => props.personagens.find((p) => p.id === personagemId.value) ?? null);
const nomeDoItem = (id: number) => props.itens.find((i) => i.id === id)?.nome ?? 'Item';
const pilhas = (inventario: unknown) =>
    ((inventario ?? []) as Inventario)
        .flatMap((s) => s.itens)
        .filter((r) => r.qtd > 0)
        .map((r) => ({ id: r.item_id, qtd: r.qtd, nome: nomeDoItem(r.item_id) }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
const carga = computed(() => pilhas(props.ficha.inventario));
const mochila = computed(() => pilhas(agente.value?.ficha.inventario));
const saldoDoPersonagem = computed(() => Number(agente.value?.ficha.belly ?? 0));
const quantia = ref(0);
/** Quantidade a mover de cada pilha (padrão: 1). */
const qtds = ref<Record<string, number>>({});
const qtdDe = (chave: string, maximo: number) => Math.max(1, Math.min(maximo, Math.floor(qtds.value[chave] ?? 1)));
async function moverBelly(sacar: boolean) {
    if (personagemId.value === null || quantia.value < 1) return;
    if (await fazer(sacar ? 'sacar' : 'depositar', { personagem_id: personagemId.value, qtd: Math.floor(quantia.value) })) quantia.value = 0;
}
const moverItem = (guardar: boolean, itemId: number, qtd: number) =>
    personagemId.value !== null && fazer(guardar ? 'guardar' : 'retirar', { personagem_id: personagemId.value, item_id: itemId, qtd });

const cartao = 'rounded-lg border border-preto-800 bg-preto-900/60';
const titulo = 'border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
const rotulo = 'text-[10px] font-semibold uppercase tracking-wider text-preto-500';
const campo =
    'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const botao =
    'rounded-md border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:cursor-not-allowed disabled:opacity-40';
const botaoOuro = `${botao} border-ouro-400 bg-ouro-500/20 text-ouro-100 hover:bg-ouro-500/30`;
const botaoNeutro = `${botao} border-preto-600 text-preto-200 hover:bg-preto-800`;
const botaoMestre = `${botao} border-ouro-500/50 text-ouro-100 hover:bg-ouro-500/20`;
</script>

<template>
    <div class="flex h-full min-h-0 flex-col text-preto-100">
        <!-- cabeçalho: nome, tamanho, condição e os números principais -->
        <header class="flex shrink-0 flex-wrap items-center gap-3 border-b border-ouro-500/20 px-4 py-2.5">
            <Ship class="size-6 shrink-0 text-ouro-300" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <input
                    v-if="mestre"
                    v-model="nome"
                    type="text"
                    maxlength="60"
                    aria-label="Nome do navio"
                    class="w-full border-b border-transparent bg-transparent font-serif text-xl font-semibold text-ouro-200 focus-visible:border-ouro-400 focus-visible:outline-none"
                    @change="emit('renomear', nome)"
                />
                <h2 v-else class="truncate font-serif text-xl font-semibold text-ouro-200">{{ personagem.nome }}</h2>
                <p class="text-xs text-preto-400">
                    Navio {{ tamanho.nome }} · {{ tamanho.dimensao }} · {{ tamanho.deques }} deque(s) · dia {{ dia }}
                </p>
            </div>
            <span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" :class="corDaCondicao[condicao.id]">{{ condicao.nome }}</span>
            <dl class="flex gap-4 text-center">
                <div>
                    <dt :class="rotulo">PV</dt>
                    <dd class="font-serif text-lg font-semibold tabular-nums">{{ pv.atual }}/{{ calc.pvMax }}</dd>
                </div>
                <div>
                    <dt :class="rotulo">CR</dt>
                    <dd class="font-serif text-lg font-semibold tabular-nums">{{ calc.cr }}</dd>
                </div>
                <div>
                    <dt :class="rotulo">BR</dt>
                    <dd class="font-serif text-lg font-semibold tabular-nums">{{ calc.br }}</dd>
                </div>
                <div>
                    <dt :class="rotulo">Tesouro</dt>
                    <dd class="font-serif text-lg font-semibold tabular-nums text-ouro-200">{{ bellys(tesouro) }}</dd>
                </div>
            </dl>
        </header>

        <nav class="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ouro-500/20 px-2 pt-1.5" role="tablist" aria-label="Seções do navio">
            <button
                v-for="a in abas"
                :key="a.id"
                type="button"
                role="tab"
                :aria-selected="aba === a.id"
                class="flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="
                    aba === a.id
                        ? 'border-ouro-500/40 bg-preto-900 font-semibold text-ouro-200'
                        : 'border-transparent text-preto-300 hover:text-ouro-200'
                "
                @click="aba = a.id"
            >
                <component :is="a.icone" class="size-4" /> {{ a.rotulo }}
            </button>
        </nav>

        <p v-if="erro" class="shrink-0 border-b border-red-400/40 bg-red-500/10 px-4 py-1.5 text-xs text-red-200" role="alert">{{ erro }}</p>

        <div class="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
            <!-- ============================== RESUMO ============================== -->
            <div v-if="aba === 'resumo'" class="grid gap-4">
                <section :class="cartao">
                    <h3 :class="titulo">Pontos de Vida</h3>
                    <div class="grid gap-2 p-3">
                        <div
                            class="h-4 overflow-hidden rounded-full border border-preto-700 bg-preto-950"
                            role="progressbar"
                            :aria-valuenow="pctPv"
                            aria-valuemin="0"
                            aria-valuemax="100"
                        >
                            <div
                                class="h-full bg-green-600 transition-all"
                                :class="pctPv <= 50 ? 'bg-red-600' : pctPv <= 80 ? 'bg-orange-500' : ''"
                                :style="{ width: pctPv + '%' }"
                            />
                        </div>
                        <p class="text-sm">
                            <b class="tabular-nums">{{ pv.atual }}</b> de {{ calc.pvMax }} PV ({{ pctPv }}%)
                            <template v-if="pv.temp">
                                · <b class="tabular-nums text-sky-200">{{ pv.temp }}</b> PV paralelos (consumidos antes)</template
                            >
                            <template v-if="calc.reducaoPorDano"> · −{{ calc.reducaoPorDano }} nós pelo dano</template>
                        </p>
                        <p v-if="navio.conserto" class="text-xs text-ouro-100">
                            <Wrench class="mr-1 inline size-3.5" />Conserto em andamento: os PV voltam no dia {{ navio.conserto.pronto_dia }}.
                        </p>
                        <div v-if="mestre" class="flex flex-wrap items-end gap-2 border-t border-preto-800 pt-2">
                            <label class="grid gap-0.5 text-xs text-preto-300">
                                Dano
                                <input v-model.number="dano" type="number" min="0" :class="campo" class="w-24" />
                            </label>
                            <label class="flex items-center gap-1.5 pb-1.5 text-xs text-preto-300">
                                <input v-model="aplicarBr" type="checkbox" class="accent-ouro-500" /> descontar BR ({{ calc.br }})
                            </label>
                            <button
                                type="button"
                                :class="botaoMestre"
                                :disabled="ocupado || dano < 1"
                                @click="fazer('pv', { dano, aplicar_br: aplicarBr }).then((ok) => ok && (dano = 0))"
                            >
                                Aplicar dano
                            </button>
                            <label class="ml-3 grid gap-0.5 text-xs text-preto-300">
                                Reparo
                                <input v-model.number="reparo" type="number" min="0" :class="campo" class="w-24" />
                            </label>
                            <button
                                type="button"
                                :class="botaoMestre"
                                :disabled="ocupado || reparo < 1"
                                @click="fazer('pv', { reparo }).then((ok) => ok && (reparo = 0))"
                            >
                                Reparar
                            </button>
                            <label class="ml-3 grid gap-0.5 text-xs text-preto-300">
                                PV paralelos
                                <input v-model.number="paralelos" type="number" min="0" :class="campo" class="w-24" />
                            </label>
                            <button
                                type="button"
                                :class="botaoMestre"
                                :disabled="ocupado"
                                title="Reparo Emergencial (30d10 + 50) ou os 200 do Klabautermann: substitui os PV paralelos atuais"
                                @click="fazer('pv', { temp: paralelos })"
                            >
                                Definir
                            </button>
                        </div>
                    </div>
                </section>

                <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Números do navio">
                    <div :class="cartao" class="p-3">
                        <span :class="rotulo">Deslocamento</span>
                        <p class="font-serif text-xl font-semibold text-ouro-200">{{ calc.velocidade }} nós</p>
                        <p class="text-xs text-preto-400">
                            {{ calc.velocidade * 2 }} km/h · {{ calc.metrosPorRodada }} m por rodada<template v-if="calc.turbina">
                                · +{{ calc.turbina }} com a turbina</template
                            >
                        </p>
                    </div>
                    <div :class="cartao" class="p-3">
                        <span :class="rotulo">Tripulação</span>
                        <p class="font-serif text-xl font-semibold" :class="efetivo.total > efetivo.lotacao ? 'text-red-300' : 'text-ouro-200'">
                            {{ efetivo.total }} / {{ efetivo.lotacao }}
                        </p>
                        <p class="text-xs" :class="efetivo.naoNavega ? 'text-red-300' : efetivo.skeletonCrew ? 'text-ouro-100' : 'text-preto-400'">
                            {{ efetivo.naoNavega ? 'Sem efetivo para navegar' : efetivo.skeletonCrew ? 'Skeleton Crew' : 'Efetivo completo' }}
                        </p>
                    </div>
                    <div :class="cartao" class="p-3">
                        <span :class="rotulo">Cômodos e canhões</span>
                        <p class="font-serif text-xl font-semibold text-ouro-200">{{ calc.comodosUsados }} / {{ calc.comodosMax }}</p>
                        <p class="text-xs text-preto-400">espaços de cômodo · {{ calc.canhoes }} de {{ calc.canhoesMax }} canhões</p>
                    </div>
                    <div :class="cartao" class="p-3">
                        <span :class="rotulo">Despesas semanais</span>
                        <p class="font-serif text-xl font-semibold" :class="navio.manutencao.em_dia ? 'text-ouro-200' : 'text-red-300'">
                            {{ bellys(calc.despesa) }}
                        </p>
                        <p class="text-xs text-preto-400">próxima cobrança no dia {{ navio.manutencao.proxima_dia }}</p>
                    </div>
                </section>

                <p
                    v-if="!navio.manutencao.em_dia"
                    class="flex flex-wrap items-center gap-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100"
                    role="status"
                >
                    O tesouro não cobriu as despesas: os cômodos estão sem benefício até a manutenção ser paga.
                    <button type="button" :class="botaoOuro" :disabled="ocupado" @click="fazer('pagar')">
                        Pagar {{ bellys(calc.despesa) }} agora
                    </button>
                </p>

                <section v-if="consertoCarpinteiro.pv > 0 && !navio.conserto" :class="cartao">
                    <h3 :class="titulo">Consertar ({{ consertoCarpinteiro.pv }} PV a recuperar)</h3>
                    <div class="grid gap-3 p-3 sm:grid-cols-2">
                        <div class="grid content-start gap-1.5 text-sm">
                            <p class="font-semibold">Pelo Carpinteiro da tripulação</p>
                            <p v-if="consertoCarpinteiro.motivo" class="text-xs text-preto-400">{{ consertoCarpinteiro.motivo }}</p>
                            <template v-else>
                                <p class="text-xs text-preto-300">
                                    Custo: {{ bellys(consertoCarpinteiro.custo) }}. Role {{ consertoCarpinteiro.dado }} e informe os dias.
                                </p>
                                <div class="flex items-end gap-2">
                                    <label class="grid gap-0.5 text-xs text-preto-300">
                                        Dias ({{ consertoCarpinteiro.dado }})
                                        <input
                                            v-model.number="diasDoCarpinteiro"
                                            type="number"
                                            min="1"
                                            :max="consertoCarpinteiro.dias"
                                            :class="campo"
                                            class="w-20"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        :class="botaoOuro"
                                        :disabled="ocupado"
                                        @click="fazer('consertar', { modo: 'carpinteiro', dias: diasDoCarpinteiro })"
                                    >
                                        Consertar
                                    </button>
                                </div>
                            </template>
                        </div>
                        <div class="grid content-start gap-1.5 text-sm">
                            <p class="font-semibold">Em estaleiro (profissionais contratados)</p>
                            <p v-if="consertoEstaleiro.motivo" class="text-xs text-preto-400">{{ consertoEstaleiro.motivo }}</p>
                            <template v-else>
                                <p class="text-xs text-preto-300">
                                    {{ consertoEstaleiro.dias }} dias. O valor é combinado com o mestre, até {{ bellys(consertoEstaleiro.custo) }}.
                                </p>
                                <div class="flex items-end gap-2">
                                    <label class="grid gap-0.5 text-xs text-preto-300">
                                        Valor combinado (฿)
                                        <input
                                            v-model.number="valorDoEstaleiro"
                                            type="number"
                                            min="0"
                                            :max="consertoEstaleiro.custo"
                                            :class="campo"
                                            class="w-36"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        :class="botaoOuro"
                                        :disabled="ocupado"
                                        @click="fazer('consertar', { modo: 'estaleiro', valor: valorDoEstaleiro })"
                                    >
                                        Consertar
                                    </button>
                                </div>
                            </template>
                        </div>
                    </div>
                </section>

                <section v-if="calc.bateriasMax > 0" :class="cartao">
                    <h3 :class="titulo">Baterias do gerador</h3>
                    <div class="flex flex-wrap items-center gap-2 p-3 text-sm">
                        <span
                            ><b class="tabular-nums">{{ navio.baterias }}</b> de {{ calc.bateriasMax }} carregadas (recarregam a cada dia de
                            viagem)</span
                        >
                        <button
                            v-for="n in [1, 2, 5]"
                            :key="n"
                            type="button"
                            :class="botaoNeutro"
                            :disabled="ocupado || navio.baterias < n"
                            @click="fazer('bateria', { gastar: n })"
                        >
                            Gastar {{ n }}
                        </button>
                        <span class="text-xs text-preto-400">1: turbina (2 h) · 2: propulsão a jato · 5: canhão de energia</span>
                    </div>
                </section>

                <section
                    v-if="
                        calc.resistencias.length ||
                        navio.klabautermann ||
                        navio.oficios.carpinteiro ||
                        navio.oficios.timoneiro ||
                        navio.feito_por_carpinteiro
                    "
                    :class="cartao"
                >
                    <h3 :class="titulo">Características</h3>
                    <ul class="grid gap-1 p-3 text-sm">
                        <li v-for="r in calc.resistencias" :key="r">{{ r }}</li>
                        <li v-if="navio.feito_por_carpinteiro">Eficácia do Carpinteiro: +12 nós e +3 de CR (já somados).</li>
                        <li v-if="navio.oficios.carpinteiro">
                            Carpinteiro na tripulação: −40% nos custos de construção e adicionais; conserto pelo carpinteiro.
                        </li>
                        <li v-if="navio.oficios.timoneiro && navio.oficios.carpinteiro">
                            Timoneiro ajudando o Carpinteiro: obras na metade do tempo.
                        </li>
                        <li v-if="navio.oficios.timoneiroNaNavegacao">
                            Timoneiro na navegação: efetivo mínimo −10 e sem redução de velocidade por dano.
                        </li>
                        <li v-if="navio.klabautermann">
                            Klabautermann: recupera {{ calc.autoReparo }} PV ao fim de cada dia. Extra Vida (200 PV paralelos abaixo da metade) e
                            Chamado ao Resgate ficam com a mesa.
                        </li>
                    </ul>
                </section>

                <section v-if="mestre" class="rounded-lg border border-ouro-500/40 bg-ouro-500/5 p-3" aria-label="Controles do mestre">
                    <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ouro-300">Mestre</h3>
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            :class="[
                                botao,
                                navio.klabautermann
                                    ? 'border-green-400 bg-green-500/20 text-green-100'
                                    : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                            ]"
                            :aria-pressed="navio.klabautermann"
                            @click="fazer('config', { klabautermann: !navio.klabautermann })"
                        >
                            Klabautermann
                        </button>
                        <button
                            type="button"
                            :class="[
                                botao,
                                navio.feito_por_carpinteiro
                                    ? 'border-green-400 bg-green-500/20 text-green-100'
                                    : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                            ]"
                            :aria-pressed="navio.feito_por_carpinteiro"
                            title="Eficácia: embarcação construída por um carpinteiro da tripulação ganha +12 nós e +3 de CR"
                            @click="fazer('config', { feito_por_carpinteiro: !navio.feito_por_carpinteiro })"
                        >
                            Construído por carpinteiro
                        </button>
                        <button type="button" :class="botaoMestre" :disabled="ocupado" @click="fazer('pv', { atual: calc.pvMax })">
                            PV no máximo
                        </button>
                        <button type="button" :class="botaoMestre" :disabled="ocupado" @click="fazer('concluir')">Concluir todas as obras</button>
                    </div>
                </section>
            </div>

            <!-- ============================== CONSTRUÇÃO ============================== -->
            <div v-else-if="aba === 'construcao'" class="grid gap-4">
                <div class="flex flex-wrap items-center gap-3 text-xs text-preto-300">
                    <span
                        ><Coins class="mr-1 inline size-3.5 text-ouro-300" />Tesouro: <b class="text-ouro-200">{{ bellys(tesouro) }}</b></span
                    >
                    <span>Comprar: preço cheio, pronto na hora. Construir: mais barato, com prazo.</span>
                    <label v-if="mestre" class="ml-auto flex items-center gap-1.5 rounded-md border border-ouro-500/40 px-2 py-1 text-ouro-100">
                        <input v-model="semCusto" type="checkbox" class="accent-ouro-500" /> Mestre: sem custo, pronto na hora e sem limites
                    </label>
                </div>

                <!-- confirmação da obra -->
                <div
                    v-if="pendente"
                    class="flex flex-wrap items-center gap-3 rounded-lg border border-ouro-400/60 bg-ouro-500/10 p-3 text-sm"
                    role="alertdialog"
                    aria-label="Confirmar obra"
                >
                    <span class="min-w-0 flex-1">
                        {{ pendente.modo === 'comprar' ? 'Comprar' : 'Construir' }} <b>{{ pendente.nome }}</b> por
                        <b class="text-ouro-200">{{ bellys(pendente.custo) }}</b
                        >{{ pendente.dias > 0 ? `, pronto no dia ${dia + pendente.dias}` : ', pronto na hora' }}?
                    </span>
                    <button type="button" :class="botaoOuro" :disabled="ocupado || pendente.custo > tesouro" @click="confirmarObra">
                        <Check class="mr-1 inline size-3.5" />{{ pendente.custo > tesouro ? 'Tesouro insuficiente' : 'Confirmar' }}
                    </button>
                    <button type="button" :class="botaoNeutro" @click="pendente = null">Cancelar</button>
                </div>

                <section :class="cartao">
                    <h3 :class="titulo"><Anchor class="mr-1 inline size-3.5" />Casco e manejo</h3>
                    <ul class="divide-y divide-preto-800">
                        <li v-for="p in partes" :key="p.id" class="grid gap-1.5 px-3 py-2 text-sm">
                            <div class="flex flex-wrap items-center gap-2">
                                <span :class="rotulo" class="w-36 shrink-0">{{ p.rotulo }}</span>
                                <span class="font-semibold" :class="p.tem ? 'text-preto-100' : 'text-preto-500'">{{ p.atual }}</span>
                                <span v-if="p.obra" class="rounded-full border border-ouro-400/50 bg-ouro-500/10 px-2 py-0.5 text-xs text-ouro-100">
                                    em obra: {{ p.obra.nome }}, pronto no dia {{ p.obra.dia }}
                                </span>
                                <button
                                    v-if="p.obra && mestre"
                                    type="button"
                                    :class="botaoMestre"
                                    :disabled="ocupado"
                                    @click="fazer('concluir', { grupo: p.id })"
                                >
                                    Concluir
                                </button>
                                <button
                                    v-if="p.obra"
                                    type="button"
                                    :class="botaoNeutro"
                                    :disabled="ocupado"
                                    @click="fazer('remover', { grupo: p.id })"
                                >
                                    Cancelar obra
                                </button>
                                <button
                                    v-else-if="p.removivel && p.tem"
                                    type="button"
                                    :class="botaoNeutro"
                                    :disabled="ocupado"
                                    @click="fazer('remover', { grupo: p.id })"
                                >
                                    <Trash2 class="mr-1 inline size-3.5" />Remover
                                </button>
                            </div>
                            <div v-if="!p.obra" class="flex flex-wrap gap-1.5 pl-0 sm:pl-[9.5rem]">
                                <template v-for="o in p.opcoes" :key="o.id">
                                    <button
                                        v-for="modo in (p.id === 'ancora' || p.id === 'leme' ? ['comprar', 'construir'] : ['construir']) as Modo[]"
                                        :key="modo"
                                        type="button"
                                        :class="botaoNeutro"
                                        :disabled="ocupado || !!problema(p.id, o.id) || !custo(p.id, o.id, modo)"
                                        :title="problema(p.id, o.id) ?? o.info"
                                        @click="pedirObra(p.id, o.id, modo, o.nome)"
                                    >
                                        {{
                                            p.id === 'ancora' || p.id === 'leme'
                                                ? modo === 'comprar'
                                                    ? 'Comprar'
                                                    : 'Construir'
                                                : p.tem
                                                  ? 'Trocar por'
                                                  : 'Instalar'
                                        }}
                                        {{ o.nome }}
                                        <span v-if="custo(p.id, o.id, modo)" class="ml-1 font-normal text-preto-400">
                                            {{ bellys(custo(p.id, o.id, modo)!.custo) }} · {{ prazo(custo(p.id, o.id, modo)!.dias) }}
                                        </span>
                                    </button>
                                </template>
                            </div>
                        </li>
                    </ul>
                </section>

                <section v-for="l in listas" :key="l.id" :class="cartao">
                    <h3 :class="titulo">
                        {{ l.rotulo }}
                        <span class="font-normal text-preto-400">({{ l.instaladas.length }}{{ l.limite !== null ? ` de ${l.limite}` : '' }})</span>
                    </h3>
                    <div class="grid gap-2 p-3">
                        <ul v-if="l.instaladas.length" class="flex flex-wrap gap-1.5">
                            <li
                                v-for="p in l.instaladas"
                                :key="p.uid"
                                class="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
                                :class="
                                    emObra(p.pronto_dia)
                                        ? 'border-ouro-400/50 bg-ouro-500/10 text-ouro-100'
                                        : 'border-green-400/40 bg-green-500/10 text-green-100'
                                "
                            >
                                {{ p.nome }}<template v-if="emObra(p.pronto_dia)"> · pronto no dia {{ p.pronto_dia }}</template>
                                <button
                                    v-if="emObra(p.pronto_dia) && mestre"
                                    type="button"
                                    class="text-ouro-300 hover:text-ouro-100"
                                    title="Concluir agora (mestre)"
                                    @click="fazer('concluir', { grupo: l.id, uid: p.uid })"
                                >
                                    <Check class="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    class="text-preto-300 hover:text-red-300"
                                    :aria-label="`Remover ${p.nome}`"
                                    title="Remover (sem reembolso)"
                                    @click="fazer('remover', { grupo: l.id, uid: p.uid })"
                                >
                                    <X class="size-3.5" />
                                </button>
                            </li>
                        </ul>
                        <p v-else class="text-xs text-preto-500">Nenhum instalado.</p>
                        <ul class="grid gap-1.5 lg:grid-cols-2">
                            <li v-for="o in l.pecas" :key="o.id" class="rounded-md border border-preto-800 bg-preto-950/40 p-2 text-sm">
                                <p class="font-semibold">{{ o.nome }}</p>
                                <p class="text-xs text-preto-400">{{ o.info }}</p>
                                <p v-if="problema(l.id, o.id)" class="mt-1 text-xs text-red-300/90">{{ problema(l.id, o.id) }}</p>
                                <div class="mt-1.5 flex flex-wrap gap-1.5">
                                    <template v-for="modo in ['comprar', 'construir'] as Modo[]" :key="modo">
                                        <button
                                            v-if="custo(l.id, o.id, modo)"
                                            type="button"
                                            :class="botaoNeutro"
                                            :disabled="ocupado || !!problema(l.id, o.id)"
                                            @click="pedirObra(l.id, o.id, modo, o.nome)"
                                        >
                                            {{ modo === 'comprar' ? 'Comprar' : 'Construir' }}
                                            <span class="ml-1 font-normal text-preto-400"
                                                >{{ bellys(custo(l.id, o.id, modo)!.custo) }} · {{ prazo(custo(l.id, o.id, modo)!.dias) }}</span
                                            >
                                        </button>
                                    </template>
                                </div>
                            </li>
                        </ul>
                    </div>
                </section>

                <section :class="cartao">
                    <h3 :class="titulo">
                        Cômodos
                        <span class="font-normal text-preto-400"
                            >({{ calc.comodosUsados }} de {{ calc.comodosMax }} espaços · despesas de {{ bellys(calc.despesa) }} por semana)</span
                        >
                    </h3>
                    <ul class="grid gap-2 p-3 lg:grid-cols-2">
                        <li
                            v-for="c in comodos"
                            :key="c.id"
                            class="grid content-start gap-1 rounded-md border p-2.5 text-sm"
                            :class="c.unidades.length ? 'border-green-400/40 bg-green-500/5' : 'border-preto-800 bg-preto-950/40 opacity-80'"
                        >
                            <div class="flex items-center gap-2">
                                <span class="font-semibold" :class="c.unidades.length ? 'text-green-100' : 'text-preto-200'">{{ c.nome }}</span>
                                <span
                                    class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
                                    :class="c.unidades.length ? 'border-green-400/50 text-green-200' : 'border-preto-600 text-preto-400'"
                                >
                                    {{ c.unidades.length ? (c.unidades.length > 1 ? `tem ${c.unidades.length}` : 'tem') : 'não tem' }}
                                </span>
                            </div>
                            <p class="text-xs text-preto-400">{{ c.descricao }}</p>
                            <p class="text-xs text-preto-200"><b>Benefício:</b> {{ c.beneficio }}</p>
                            <p class="text-xs text-preto-400">
                                {{ bellys(custo('comodos', c.id, 'construir')!.custo) }} · {{ prazo(custo('comodos', c.id, 'construir')!.dias) }} ·
                                {{ bellys(c.despesa) }}/semana ·
                                {{ c.espacos === 0 ? 'não ocupa espaço' : `${c.espacos} espaço${c.espacos > 1 ? 's' : ''}` }}
                            </p>
                            <ul v-if="c.unidades.length" class="flex flex-wrap gap-1.5">
                                <li
                                    v-for="u in c.unidades"
                                    :key="u.uid"
                                    class="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                                    :class="
                                        emObra(u.pronto_dia)
                                            ? 'border-ouro-400/50 bg-ouro-500/10 text-ouro-100'
                                            : 'border-green-400/40 text-green-100'
                                    "
                                >
                                    {{ emObra(u.pronto_dia) ? `em obra até o dia ${u.pronto_dia}` : 'pronto' }}
                                    <button
                                        v-if="emObra(u.pronto_dia) && mestre"
                                        type="button"
                                        class="text-ouro-300 hover:text-ouro-100"
                                        title="Concluir agora (mestre)"
                                        @click="fazer('concluir', { grupo: 'comodos', uid: u.uid })"
                                    >
                                        <Check class="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        class="text-preto-300 hover:text-red-300"
                                        :aria-label="`Remover ${c.nome}`"
                                        title="Remover (sem reembolso)"
                                        @click="fazer('remover', { grupo: 'comodos', uid: u.uid })"
                                    >
                                        <X class="size-3.5" />
                                    </button>
                                </li>
                            </ul>
                            <p v-if="problema('comodos', c.id)" class="text-xs text-red-300/90">{{ problema('comodos', c.id) }}</p>
                            <button
                                v-else
                                type="button"
                                :class="botaoNeutro"
                                class="justify-self-start"
                                :disabled="ocupado"
                                @click="pedirObra('comodos', c.id, 'construir', c.nome)"
                            >
                                <Hammer class="mr-1 inline size-3.5" />Construir{{ c.unidades.length ? ' outro' : '' }}
                            </button>
                        </li>
                    </ul>
                </section>
            </div>

            <!-- ============================== TRIPULAÇÃO ============================== -->
            <div v-else-if="aba === 'tripulacao'" class="grid gap-4">
                <section :class="cartao">
                    <h3 :class="titulo">
                        Efetivo <span class="font-normal text-preto-400">({{ efetivo.total }} a bordo, lotação de {{ efetivo.lotacao }})</span>
                    </h3>
                    <table class="w-full text-sm">
                        <thead class="text-left text-[10px] uppercase tracking-wider text-preto-500">
                            <tr>
                                <th class="px-3 py-1.5 font-semibold">Função</th>
                                <th class="px-2 py-1.5 text-center font-semibold">Tem</th>
                                <th class="px-2 py-1.5 text-center font-semibold">Mínimo</th>
                                <th class="px-2 py-1.5 text-center font-semibold">Necessário</th>
                                <th class="px-3 py-1.5 font-semibold">Situação</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-preto-800">
                            <tr v-for="l in efetivo.linhas" :key="l.id">
                                <td class="px-3 py-1.5 font-medium">
                                    {{ l.nome }}
                                    <span v-if="l.detalhe" class="block text-xs font-normal text-preto-400">{{ l.detalhe }}</span>
                                </td>
                                <td class="px-2 py-1.5 text-center tabular-nums">{{ l.atual }}</td>
                                <td class="px-2 py-1.5 text-center tabular-nums">{{ l.minimo }}</td>
                                <td class="px-2 py-1.5 text-center tabular-nums">{{ l.necessario }}</td>
                                <td class="px-3 py-1.5">
                                    <span class="font-semibold" :class="corDaSituacao[l.situacao]">{{ rotuloDaSituacao[l.situacao] }}</span>
                                    <span v-if="l.consequencia" class="block text-xs text-preto-400">{{ l.consequencia }}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-if="efetivo.total > efetivo.lotacao" class="border-t border-preto-800 px-3 py-1.5 text-xs text-red-300">
                        Há mais tripulantes do que o navio comporta ({{ efetivo.total }} de {{ efetivo.lotacao }}).
                    </p>
                </section>

                <section :class="cartao">
                    <h3 :class="titulo">Tripulantes</h3>
                    <div class="grid gap-2 p-3">
                        <p class="text-xs text-preto-400">
                            Cada tripulante acumula até {{ MAX_FUNCOES }} funções (uma só de comando). Um grupo de tripulantes iguais entra numa linha
                            só, com a quantidade.
                        </p>
                        <ul class="grid gap-2">
                            <li v-for="(t, i) in rascunho" :key="t.uid" class="grid gap-1.5 rounded-md border border-preto-800 bg-preto-950/40 p-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <input
                                        v-model="t.nome"
                                        type="text"
                                        maxlength="60"
                                        placeholder="Nome ou grupo (ex.: Marujos)"
                                        :class="campo"
                                        class="min-w-0 flex-1"
                                        :readonly="t.personagem_id !== null"
                                        @input="mudou = true"
                                    />
                                    <span
                                        v-if="t.personagem_id !== null"
                                        class="rounded-full border border-sky-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-200"
                                        >personagem</span
                                    >
                                    <label v-else class="flex items-center gap-1 text-xs text-preto-300">
                                        Qtd
                                        <input
                                            v-model.number="t.qtd"
                                            type="number"
                                            min="1"
                                            max="5000"
                                            :class="campo"
                                            class="w-20"
                                            @input="mudou = true"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        class="text-preto-400 hover:text-red-300"
                                        :aria-label="`Tirar ${t.nome || 'tripulante'} da tripulação`"
                                        @click="(rascunho.splice(i, 1), (mudou = true))"
                                    >
                                        <Trash2 class="size-4" />
                                    </button>
                                </div>
                                <div class="flex flex-wrap gap-1" role="group" :aria-label="`Funções de ${t.nome || 'tripulante'}`">
                                    <button
                                        v-for="f in FUNCOES"
                                        :key="f.id"
                                        type="button"
                                        class="rounded-full border px-2 py-0.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                        :class="
                                            t.funcoes.includes(f.id)
                                                ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100'
                                                : 'border-preto-700 text-preto-400 hover:text-preto-100'
                                        "
                                        :aria-pressed="t.funcoes.includes(f.id)"
                                        :title="f.texto"
                                        @click="alternarFuncao(t, f.id)"
                                    >
                                        {{ f.nome }}
                                    </button>
                                </div>
                            </li>
                        </ul>
                        <p v-if="!rascunho.length" class="text-xs text-preto-500">Ninguém a bordo ainda.</p>
                        <div class="flex flex-wrap items-center gap-2">
                            <button type="button" :class="botaoNeutro" @click="novoTripulante()">+ Tripulante ou grupo</button>
                            <select
                                v-if="livres.length"
                                :class="campo"
                                aria-label="Adicionar um personagem da mesa"
                                @change="
                                    (novoTripulante(Number(($event.target as HTMLSelectElement).value)),
                                    (($event.target as HTMLSelectElement).value = ''))
                                "
                            >
                                <option value="">+ Personagem da mesa…</option>
                                <option v-for="p in livres" :key="p.id" :value="p.id">{{ p.nome }}</option>
                            </select>
                            <span v-if="problemaDoRascunho" class="text-xs text-red-300">{{ problemaDoRascunho }}</span>
                            <button v-if="mudou" type="button" :class="botaoNeutro" class="ml-auto" @click="copiarTripulacao">Desfazer</button>
                            <button
                                type="button"
                                :class="[botaoOuro, mudou ? '' : 'ml-auto']"
                                :disabled="ocupado || !mudou || !!problemaDoRascunho"
                                @click="salvarTripulacao"
                            >
                                Salvar tripulação
                            </button>
                        </div>
                        <p class="text-xs text-preto-400">
                            Carpinteiro e Timoneiro contam quando o tripulante é um personagem da mesa com a profissão.
                        </p>
                    </div>
                </section>
            </div>

            <!-- ============================== CARGA E TESOURO ============================== -->
            <div v-else class="grid gap-4">
                <label v-if="personagens.length" class="flex flex-wrap items-center gap-2 text-sm">
                    Agindo com
                    <select v-model.number="personagemId" :class="campo" aria-label="Personagem que guarda e retira">
                        <option v-for="p in personagens" :key="p.id" :value="p.id">{{ p.nome }}</option>
                    </select>
                    <span class="text-xs text-preto-400">{{ bellys(saldoDoPersonagem) }} com ele</span>
                </label>
                <p v-else class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                    Você não tem um personagem nesta mesa para guardar ou retirar. A carga e o tesouro aparecem abaixo.
                </p>

                <section :class="cartao">
                    <h3 :class="titulo"><Coins class="mr-1 inline size-3.5" />Tesouro do navio: {{ bellys(tesouro) }}</h3>
                    <div v-if="agente" class="flex flex-wrap items-end gap-2 p-3">
                        <label class="grid gap-0.5 text-xs text-preto-300">
                            Quantia (฿)
                            <input v-model.number="quantia" type="number" min="0" :class="campo" class="w-40" />
                        </label>
                        <button
                            type="button"
                            :class="botaoOuro"
                            :disabled="ocupado || quantia < 1 || quantia > saldoDoPersonagem"
                            @click="moverBelly(false)"
                        >
                            Depositar
                        </button>
                        <button type="button" :class="botaoNeutro" :disabled="ocupado || quantia < 1 || quantia > tesouro" @click="moverBelly(true)">
                            Sacar para {{ agente.nome }}
                        </button>
                    </div>
                </section>

                <div class="grid gap-4 lg:grid-cols-2">
                    <section :class="cartao">
                        <h3 :class="titulo">Carga do navio</h3>
                        <ul class="divide-y divide-preto-800">
                            <li v-for="i in carga" :key="i.id" class="flex items-center gap-2 px-3 py-1.5 text-sm">
                                <span class="min-w-0 flex-1 truncate">{{ i.nome }}</span>
                                <span class="tabular-nums text-preto-400">×{{ i.qtd }}</span>
                                <template v-if="agente">
                                    <input
                                        v-if="i.qtd > 1"
                                        v-model.number="qtds[`c${i.id}`]"
                                        type="number"
                                        min="1"
                                        :max="i.qtd"
                                        placeholder="1"
                                        :class="campo"
                                        class="w-16"
                                        :aria-label="`Quantidade de ${i.nome} a retirar`"
                                    />
                                    <button
                                        type="button"
                                        :class="botaoNeutro"
                                        :disabled="ocupado"
                                        @click="moverItem(false, i.id, qtdDe(`c${i.id}`, i.qtd))"
                                    >
                                        Retirar
                                    </button>
                                </template>
                            </li>
                            <li v-if="!carga.length" class="px-3 py-3 text-center text-xs text-preto-500">A carga está vazia.</li>
                        </ul>
                        <p v-if="mestre" class="border-t border-preto-800 px-3 py-1.5 text-xs text-preto-400">
                            Mestre: arraste um item da aba Itens para esta janela para pô-lo na carga.
                        </p>
                    </section>
                    <section v-if="agente" :class="cartao">
                        <h3 :class="titulo">Inventário de {{ agente.nome }}</h3>
                        <ul class="divide-y divide-preto-800">
                            <li v-for="i in mochila" :key="i.id" class="flex items-center gap-2 px-3 py-1.5 text-sm">
                                <span class="min-w-0 flex-1 truncate">{{ i.nome }}</span>
                                <span class="tabular-nums text-preto-400">×{{ i.qtd }}</span>
                                <input
                                    v-if="i.qtd > 1"
                                    v-model.number="qtds[`m${i.id}`]"
                                    type="number"
                                    min="1"
                                    :max="i.qtd"
                                    placeholder="1"
                                    :class="campo"
                                    class="w-16"
                                    :aria-label="`Quantidade de ${i.nome} a guardar`"
                                />
                                <button
                                    type="button"
                                    :class="botaoNeutro"
                                    :disabled="ocupado"
                                    @click="moverItem(true, i.id, qtdDe(`m${i.id}`, i.qtd))"
                                >
                                    Guardar
                                </button>
                            </li>
                            <li v-if="!mochila.length" class="px-3 py-3 text-center text-xs text-preto-500">Nada no inventário.</li>
                        </ul>
                    </section>
                </div>

                <section :class="cartao">
                    <h3 :class="titulo">Registro</h3>
                    <ul class="divide-y divide-preto-800 text-sm">
                        <li v-for="(r, i) in navio.registro" :key="i" class="flex items-center gap-3 px-3 py-1.5">
                            <span class="w-14 shrink-0 text-xs text-preto-500">dia {{ r.dia }}</span>
                            <span class="min-w-0 flex-1">{{ r.texto }}</span>
                            <span v-if="r.valor" class="shrink-0 tabular-nums" :class="r.valor < 0 ? 'text-red-300' : 'text-green-300'"
                                >{{ r.valor < 0 ? '−' : '+' }}{{ bellys(Math.abs(r.valor)) }}</span
                            >
                        </li>
                        <li v-if="!navio.registro.length" class="px-3 py-3 text-center text-xs text-preto-500">Nenhum lançamento ainda.</li>
                    </ul>
                </section>
            </div>
        </div>
    </div>
</template>
