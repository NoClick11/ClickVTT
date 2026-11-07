<script setup lang="ts">
import { Check, Hourglass, X } from 'lucide-vue-next';
import { computed, reactive, ref } from 'vue';
import { camposDaAkuma } from '../../akuma/regras';
import { estilos, useFicha } from '../../contexto';
import type { FichaOnePiece } from '../../regras';
import {
    CODIGOS_DE_HONRA,
    NOMES_CATEGORIA,
    NOMES_DIFICULDADE,
    SITUACOES_DO_CODIGO,
    TREINAMENTOS,
    codigoPorId,
    treinamentoPorId,
    type CategoriaTreinamento,
    type DificuldadeTreinamento,
    type Treinamento,
} from '../../treinamentos/dados';
import {
    camposDaConclusao,
    camposDaRemocao,
    custoDe,
    problemasDoPedido,
    resumoDosPT,
    treinamentoPadrao,
    type TreinamentoFicha,
} from '../../treinamentos/regras';
import CriadorDeTecnicas from '../criador/CriadorDeTecnicas.vue';

/**
 * Aba Treinamentos: PT, catálogo (Gerais, com Arma, de Espécie), Código de Honra e, para o mestre, os controles que dão PT,
 * conferem os pedidos (ferramentas, tutor, dias) e concluem ou recusam. O jogador PEDE; o mestre conclui e só então os PT
 * são gastos e os efeitos entram na ficha. O servidor confere o que é do mestre.
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { salvar, mestre } = useFicha();

/** Genialidade Inusitada: a N-ésima cria uma Técnica de Combate de N-ésimo grau (para o estilo ou para a fruta). */
const criador = reactive<{ aberto: boolean; destino: 'akuma' | 'estilo'; indice: number }>({ aberto: false, destino: 'estilo', indice: 1 });
const indiceDaGenialidade = (i: number): number =>
    (props.ficha.treinamento?.aprendidos ?? []).slice(0, i + 1).filter((a) => a.id === 'genialidade-inusitada').length;
const tecnicaJaCriada = (indice: number): boolean =>
    [...props.ficha.tecnicas.lista, ...props.ficha.akuma.lista].some(
        (t) => t.criador?.origem.tipo === 'genialidade' && t.criador.origem.indice === indice,
    ) || (props.ficha.akuma.points ?? []).some((p) => p.genialidade === indice);
/** Numa Zoan Comum/Ancestral a Genialidade Inusitada (nº ≤ 5) cria um Point próprio, não uma Técnica solta. */
const zoanDePoints = computed(() => props.ficha.akuma.tipo === 'zoan' && props.ficha.akuma.zoan !== 'mitica');
function criarPointDaGenialidade(indice: number) {
    salvar(camposDaAkuma(props.ficha, { points: [...(props.ficha.akuma.points ?? []), { ponto: indice, modelo: 'custom', genialidade: indice }] }));
}
function abrirCriador(destino: 'akuma' | 'estilo', indice: number) {
    Object.assign(criador, { aberto: true, destino, indice });
}

const tr = computed<TreinamentoFicha>(() => ({ ...treinamentoPadrao(), ...(props.ficha.treinamento ?? {}) }));
const pt = computed(() => resumoDosPT({ ...props.ficha, treinamento: tr.value }));
const ficha = computed(() => ({ ...props.ficha, treinamento: tr.value }));

const categoria = ref<CategoriaTreinamento>('geral');
const aberto = ref<string | null>(null);
const opcoes = reactive<Record<string, string>>({});
const mensagem = ref('');
const darPT = ref(1);

const DIFICULDADES: DificuldadeTreinamento[] = ['simples', 'intermediario', 'complexo'];
const doTipo = (c: CategoriaTreinamento, d: DificuldadeTreinamento) => TREINAMENTOS.filter((t) => t.categoria === c && t.dificuldade === d);
const aprendido = (id: string) => tr.value.aprendidos.some((a) => a.id === id);
const pedido = (id: string) => tr.value.pedidos.some((p) => p.id === id);
const custo = (t: Treinamento) => custoDe(t, tr.value.aprendidos);
const motivos = (t: Treinamento) => problemasDoPedido(ficha.value, t.id, opcoes[t.id]);
const nomeDe = (id: string) => treinamentoPorId(id)?.nome ?? id;

function iniciar(t: Treinamento) {
    const m = motivos(t);
    if (m.length) {
        mensagem.value = m[0];
        return;
    }
    mensagem.value = '';
    salvar({ 'treinamento.pedidos': [...tr.value.pedidos, { id: t.id, ...(opcoes[t.id] ? { opcao: opcoes[t.id] } : {}), dias: 0 }] });
}
const cancelar = (i: number) => salvar({ 'treinamento.pedidos': tr.value.pedidos.filter((_, k) => k !== i) });
const marcarDias = (i: number, dias: number) =>
    salvar({
        'treinamento.pedidos': tr.value.pedidos.map((p, k) => (k === i ? { ...p, dias: Math.max(0, Math.min(60, Math.floor(dias) || 0)) } : p)),
    });
const concluir = (i: number) => salvar(camposDaConclusao(props.ficha, i));
const remover = (i: number) => salvar(camposDaRemocao(props.ficha, i));

const campo =
    'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const botao =
    'rounded-md border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
const botaoMestre = `${botao} border-ouro-500/50 text-ouro-100 hover:bg-ouro-500/20`;
const codigo = computed(() => codigoPorId(tr.value.codigo));
</script>

<template>
    <div class="grid gap-4 p-4">
        <!-- controles do mestre -->
        <section v-if="mestre" class="rounded-lg border border-ouro-500/40 bg-ouro-500/5 p-3" aria-label="Controles do mestre">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ouro-300">Mestre: Treinamentos</h3>
            <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="text-preto-300">PT:</span>
                <button type="button" :class="botaoMestre" aria-label="Tirar PT" @click="salvar({ 'treinamento.extras': tr.extras - darPT })">
                    −
                </button>
                <input v-model.number="darPT" type="number" min="1" max="99" :class="campo" class="w-16" aria-label="Quantidade de PT" />
                <button type="button" :class="botaoMestre" aria-label="Dar PT" @click="salvar({ 'treinamento.extras': tr.extras + darPT })">
                    + dar
                </button>
                <span class="text-xs text-preto-400">dados pelo mestre: {{ tr.extras }}</span>
            </div>
            <div v-if="tr.codigo" class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-preto-300">Seguiu o código ({{ codigo?.nome }}):</span>
                <button
                    v-for="s in SITUACOES_DO_CODIGO"
                    :key="s.id"
                    type="button"
                    :class="botaoMestre"
                    :title="`${s.rotulo}: ${s.pt} PT ao fim do próximo descanso longo`"
                    @click="salvar({ 'treinamento.extras': tr.extras + s.pt })"
                >
                    {{ s.rotulo }} (+{{ s.pt }})
                </button>
            </div>

            <h4 class="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-preto-400">Pedidos em andamento</h4>
            <p v-if="!tr.pedidos.length" class="text-xs text-preto-400">Nenhum pedido.</p>
            <ul class="grid gap-2">
                <li v-for="(p, i) in tr.pedidos" :key="`${p.id}-${i}`" class="rounded border border-preto-700 bg-preto-950 p-2 text-sm">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-semibold text-ouro-100">{{ nomeDe(p.id) }}</span>
                        <span v-if="p.opcao" class="text-xs text-preto-400">({{ p.opcao }})</span>
                        <span class="text-xs text-preto-400"
                            >{{ treinamentoPorId(p.id)?.pt }} PT · {{ treinamentoPorId(p.id)?.dias }} dias ·
                            {{ treinamentoPorId(p.id)?.tutor ? 'com tutor' : 'sem tutor (tutor: metade dos dias)' }}</span
                        >
                    </div>
                    <p v-if="treinamentoPorId(p.id)?.adicional" class="text-xs text-amber-200">Conferir: {{ treinamentoPorId(p.id)?.adicional }}</p>
                    <div class="mt-1 flex flex-wrap items-center gap-2">
                        <label class="flex items-center gap-1 text-xs text-preto-300"
                            >Dias cumpridos
                            <input
                                :value="p.dias"
                                type="number"
                                min="0"
                                max="60"
                                :class="campo"
                                class="w-16"
                                @change="marcarDias(i, Number(($event.target as HTMLInputElement).value))"
                        /></label>
                        <button type="button" :class="[botaoMestre, 'border-green-400/60 text-green-100']" @click="concluir(i)">
                            Concluir (gasta PT)
                        </button>
                        <button type="button" :class="botaoMestre" @click="cancelar(i)">Recusar</button>
                    </div>
                </li>
            </ul>
        </section>

        <!-- resumo -->
        <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo dos treinamentos">
            <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                <span :class="estilos?.rotulo">PT disponíveis</span>
                <p class="font-serif text-xl font-semibold" :class="pt.livres < 0 ? 'text-red-300' : 'text-ouro-200'">{{ pt.livres }}</p>
                <p class="text-xs text-preto-400">
                    {{ pt.comprometidos ? `${pt.comprometidos} reservados em pedidos · ` : '' }}{{ pt.disponiveis }} sem contar os pedidos
                </p>
            </div>
            <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                <span :class="estilos?.rotulo">PT ganhos</span>
                <p class="font-serif text-xl font-semibold text-preto-100">{{ pt.ganhos }}</p>
                <p class="text-xs text-preto-400">3 por nível par até o 10º · Traço Cultural · extras do mestre ({{ pt.extras }})</p>
            </div>
            <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                <span :class="estilos?.rotulo">PT gastos</span>
                <p class="font-serif text-xl font-semibold text-preto-100">{{ pt.gasto }}</p>
                <p class="text-xs text-preto-400">
                    {{ tr.aprendidos.length }} treinamento{{ tr.aprendidos.length === 1 ? '' : 's' }} aprendido{{
                        tr.aprendidos.length === 1 ? '' : 's'
                    }}
                </p>
            </div>
            <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                <span :class="estilos?.rotulo">Código de Honra (opcional)</span>
                <select
                    :value="tr.codigo"
                    :disabled="!!tr.codigo && !mestre"
                    :class="campo"
                    class="mt-1 w-full"
                    aria-label="Código de Honra"
                    @change="salvar({ 'treinamento.codigo': ($event.target as HTMLSelectElement).value })"
                >
                    <option value="">Nenhum</option>
                    <option v-for="c in CODIGOS_DE_HONRA" :key="c.id" :value="c.id">{{ c.nome }}</option>
                </select>
            </div>
        </section>
        <p v-if="codigo" class="rounded-lg border border-preto-700 bg-preto-900/60 p-2 text-xs text-preto-300">
            <b>{{ codigo.nome }}:</b> {{ codigo.texto }} Ao mantê-lo diante de situações que o prejudiquem, o mestre concede PT (1 a 3, conforme a
            situação).
        </p>

        <!-- meus pedidos e aprendidos -->
        <section v-if="tr.pedidos.length && !mestre" aria-label="Pedidos em andamento">
            <h3 :class="estilos?.rotulo">Em andamento</h3>
            <ul class="mt-1 grid gap-1.5">
                <li
                    v-for="(p, i) in tr.pedidos"
                    :key="`${p.id}-${i}`"
                    class="flex flex-wrap items-center gap-2 rounded border border-preto-700 bg-preto-900/60 p-2 text-sm"
                >
                    <Hourglass class="size-4 text-ouro-300" />
                    <span class="font-semibold text-ouro-100">{{ nomeDe(p.id) }}</span>
                    <span class="text-xs text-preto-400">{{ p.dias }} / {{ treinamentoPorId(p.id)?.dias }} dias · aguardando o mestre concluir</span>
                    <button type="button" :class="[botao, 'ml-auto border-preto-600 text-preto-200 hover:bg-preto-800']" @click="cancelar(i)">
                        Cancelar
                    </button>
                </li>
            </ul>
        </section>
        <section v-if="tr.aprendidos.length" aria-label="Treinamentos aprendidos">
            <h3 :class="estilos?.rotulo">Aprendidos</h3>
            <ul class="mt-1 grid gap-1.5 sm:grid-cols-2">
                <li
                    v-for="(a, i) in tr.aprendidos"
                    :key="`${a.id}-${i}`"
                    class="flex items-center gap-2 rounded border border-green-400/40 bg-green-500/5 p-2 text-sm"
                >
                    <Check class="size-4 text-green-300" />
                    <span class="font-semibold text-green-100">{{ nomeDe(a.id) }}</span>
                    <span v-if="a.opcao" class="text-xs text-preto-400">({{ a.opcao }})</span>
                    <span class="text-xs text-preto-400">nível {{ a.nivel }}</span>
                    <template v-if="a.id === 'genialidade-inusitada'">
                        <span v-if="tecnicaJaCriada(indiceDaGenialidade(i))" class="text-xs text-green-300">
                            {{ indiceDaGenialidade(i) }}º grau criada
                        </span>
                        <template v-else>
                            <button
                                type="button"
                                :class="[botao, 'border-sky-400/60 text-sky-100 hover:bg-sky-500/20']"
                                @click="abrirCriador('estilo', indiceDaGenialidade(i))"
                            >
                                Criar ({{ indiceDaGenialidade(i) }}º grau) · estilo
                            </button>
                            <button
                                type="button"
                                :class="[botao, 'border-violet-400/60 text-violet-100 hover:bg-violet-500/20']"
                                :disabled="zoanDePoints && indiceDaGenialidade(i) > 5"
                                @click="
                                    zoanDePoints ? criarPointDaGenialidade(indiceDaGenialidade(i)) : abrirCriador('akuma', indiceDaGenialidade(i))
                                "
                            >
                                {{ zoanDePoints ? 'Point da fruta' : 'fruta' }}
                            </button>
                        </template>
                    </template>
                    <button
                        v-if="mestre"
                        type="button"
                        :class="[botaoMestre, 'ml-auto']"
                        title="Remove o treinamento e devolve os PT"
                        @click="remover(i)"
                    >
                        Remover
                    </button>
                </li>
            </ul>
        </section>

        <!-- catálogo -->
        <section aria-label="Catálogo de treinamentos">
            <div class="flex gap-1" role="tablist" aria-label="Tipos de treinamento">
                <button
                    v-for="(nome, id) in NOMES_CATEGORIA"
                    :key="id"
                    type="button"
                    role="tab"
                    :aria-selected="categoria === id"
                    :class="[
                        botao,
                        categoria === id ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100' : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                    ]"
                    @click="categoria = id as CategoriaTreinamento"
                >
                    {{ nome }}
                </button>
            </div>
            <p v-if="categoria === 'especie'" class="mt-2 text-xs text-preto-400">
                Treinamentos de Espécie só valem para essa espécie (ou mestiços dela).
            </p>
            <div v-for="d in DIFICULDADES" :key="d">
                <template v-if="doTipo(categoria, d).length">
                    <h3 class="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-ouro-400">{{ NOMES_DIFICULDADE[d] }}</h3>
                    <ul class="grid gap-2">
                        <li
                            v-for="t in doTipo(categoria, d)"
                            :key="t.id"
                            class="rounded-lg border bg-preto-900/60"
                            :class="aprendido(t.id) && !t.repetivel ? 'border-green-400/40' : 'border-preto-700'"
                        >
                            <button
                                type="button"
                                class="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 p-2.5 text-left"
                                :aria-expanded="aberto === t.id"
                                @click="aberto = aberto === t.id ? null : t.id"
                            >
                                <span class="font-serif text-base font-semibold text-ouro-100">{{ t.nome }}</span>
                                <span v-if="t.especie" class="rounded bg-preto-800 px-1.5 text-[11px] text-preto-300">{{ t.especie }}</span>
                                <span class="text-xs text-preto-400">
                                    {{ custo(t) }} PT · {{ t.dias }} dias · {{ t.tutor ? 'com tutor' : 'sem tutor' }} ·
                                    {{ t.atributos.length === 6 ? 'qualquer atributo' : t.atributos.map((a) => a.toUpperCase()).join(' ou ') }}
                                    {{ t.minimo }}{{ t.adicional ? ' · ' + t.adicional : '' }}{{ t.requer ? ' · exige ' + nomeDe(t.requer) : '' }}
                                </span>
                                <span v-if="aprendido(t.id)" class="ml-auto text-xs font-semibold text-green-300">aprendido</span>
                                <span v-else-if="pedido(t.id)" class="ml-auto text-xs font-semibold text-ouro-300">em andamento</span>
                            </button>
                            <div v-if="aberto === t.id" class="border-t border-preto-800 p-2.5">
                                <p class="whitespace-pre-wrap text-sm leading-relaxed text-preto-100">{{ t.texto }}</p>
                                <div
                                    v-for="tec in t.tecnicas ?? []"
                                    :key="tec.nome"
                                    class="mt-2 rounded border border-preto-700 p-2 text-xs text-preto-200"
                                >
                                    <b class="text-ouro-200">Técnica: {{ tec.nome }}</b> ({{ tec.custo }} PP · {{ tec.alcance }} · {{ tec.efeito }}).
                                    {{ tec.descricao }}
                                </div>
                                <div class="mt-3 flex flex-wrap items-center gap-2">
                                    <label v-if="t.escolha" class="flex items-center gap-1 text-xs text-preto-300"
                                        >{{ t.escolha.rotulo }}
                                        <select v-model="opcoes[t.id]" :class="campo" :aria-label="t.escolha.rotulo">
                                            <option value="">—</option>
                                            <option v-for="o in t.escolha.opcoes" :key="o.id" :value="o.id">{{ o.nome }}</option>
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        :disabled="motivos(t).length > 0"
                                        :class="[
                                            botao,
                                            'border-ouro-400 bg-ouro-500/20 text-ouro-100 hover:bg-ouro-500/30 disabled:cursor-not-allowed disabled:opacity-40',
                                        ]"
                                        @click="iniciar(t)"
                                    >
                                        Iniciar treinamento ({{ custo(t) }} PT)
                                    </button>
                                    <span v-if="motivos(t).length" class="flex items-center gap-1 text-xs text-preto-400"
                                        ><X class="size-3" /> {{ motivos(t)[0] }}</span
                                    >
                                    <span v-if="mensagem" class="text-xs text-red-300" role="alert">{{ mensagem }}</span>
                                </div>
                                <p class="mt-1 text-[11px] text-preto-500">
                                    O mestre confere ferramentas, tutor e os {{ t.dias }} dias de treino (6 h por dia, sem Profissão nem batalha) e
                                    conclui o treinamento.
                                </p>
                            </div>
                        </li>
                    </ul>
                </template>
            </div>
        </section>
        <CriadorDeTecnicas v-model:open="criador.aberto" :ficha="props.ficha" :destino="criador.destino" :genialidade="criador.indice" />
    </div>
</template>
