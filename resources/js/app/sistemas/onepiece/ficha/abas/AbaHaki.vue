<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Network, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { estilos, useFicha } from '../../contexto';
import { NOMES_ESTAGIO, TIPOS_HAKI, formasDoTalento, talentoPorId, type TipoHaki } from '../../haki/dados';
import {
    MAX_PA_OCIOSOS,
    comprar,
    devolver,
    hakiDesperto,
    podeComprar,
    podeDevolver,
    refazerCaracteristicasDoHaki,
    resumoDosPA,
    type HakiFicha,
} from '../../haki/regras';
import { paDeHakiDasIndividualidades } from '../../individualidades/regras';
import type { FichaOnePiece } from '../../regras';
import { paDeHakiDosTreinamentos } from '../../treinamentos/regras';
import ArvoreHaki from '../haki/ArvoreHaki.vue';

/**
 * Aba Haki: PA, estágio, Haki Principal e afinidade, as árvores de talentos (Armamento, Observação e, se revelado, Rei) e,
 * para o mestre, os controles que liberam o Haki e dão PA. As compras e as escolhas são do dono da ficha; liberar, dar PA e
 * devolver talentos são só do mestre (o servidor confere).
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { salvar, mestre, editar } = useFicha();

const h = computed<HakiFicha>(() => props.ficha.haki);
const nivel = computed(() => Number(props.ficha.nivel));
const desperto = computed(() => hakiDesperto(h.value, nivel.value));
const bonusDeHaki = computed(() => paDeHakiDosTreinamentos(props.ficha) + paDeHakiDasIndividualidades(props.ficha));
const pa = computed(() => resumoDosPA(h.value, nivel.value, bonusDeHaki.value));
const estagioNome = computed(() => NOMES_ESTAGIO[pa.value.estagio]);

const tiposVisiveis = computed(() => TIPOS_HAKI.filter((t) => t.id !== 'rei' || h.value.rei));
const tipo = ref<TipoHaki>('armamento');
watch(tiposVisiveis, (l) => {
    if (!l.some((t) => t.id === tipo.value)) tipo.value = 'armamento';
});
const selecionado = ref<string | null>(null);
const talento = computed(() => talentoPorId(selecionado.value));
const mensagem = ref('');
const aberta = ref(false);
const comprados = computed(() => h.value.talentos.length);
function abrir(t: TipoHaki) {
    tipo.value = t;
    aberta.value = true;
}

/** Salva o novo estado do Haki junto das características dos talentos (refeitas) e, se preciso, outros campos. */
function gravar(novo: HakiFicha, extras: Record<string, unknown> = {}) {
    salvar({
        'haki.talentos': novo.talentos,
        caracteristicas: refazerCaracteristicasDoHaki(props.ficha.caracteristicas, novo, nivel.value),
        ...extras,
    });
}

function comprarForma(id: string) {
    const r = podeComprar(h.value, nivel.value, id, bonusDeHaki.value);
    if (!r.ok) {
        mensagem.value = r.motivo ?? '';
        return;
    }
    mensagem.value = '';
    gravar(comprar(h.value, id));
}
function devolverForma(id: string) {
    const r = podeDevolver(h.value, id);
    if (!r.ok) {
        mensagem.value = r.motivo ?? '';
        return;
    }
    mensagem.value = '';
    gravar(devolver(h.value, id));
}
function resetar() {
    gravar({ ...h.value, talentos: [] });
    selecionado.value = null;
}

const formaAtual = (id: string) => h.value.talentos.find((t) => t.id === id)?.formas ?? (id === 'rei' && h.value.rei ? 1 : 0);
const compra = computed(() => (talento.value ? podeComprar(h.value, nivel.value, talento.value.id, bonusDeHaki.value) : null));
const textoForma = computed(() => {
    const t = talento.value;
    if (!t) return [];

    return [
        { n: 1, rotulo: 'Forma base', texto: t.base.texto, custo: t.custo },
        ...(t.dominada ? [{ n: 2, rotulo: '☆ Forma Dominada', texto: t.dominada.texto, custo: t.custo }] : []),
        ...(t.avancada ? [{ n: 3, rotulo: '★ Forma Avançada', texto: t.avancada.texto, custo: t.custo }] : []),
    ];
});

// --- escolhas do dono ---------------------------------------------------------------------------------------------------
const podeEscolher = computed(() => editar.value || mestre);
const precisaDoPrincipal = computed(() => desperto.value && !h.value.principal);
const afinidades = computed(() => TIPOS_HAKI.filter((t) => t.id !== 'rei' || h.value.rei));

// --- mestre ---------------------------------------------------------------------------------------------------------------
const darGeral = ref(1);
const darTipo = ref<TipoHaki>('armamento');
const darRestrito = ref(3);
function alternarRei() {
    const novo: HakiFicha = { ...h.value, rei: !h.value.rei };
    salvar({
        'haki.rei': novo.rei,
        caracteristicas: refazerCaracteristicasDoHaki(props.ficha.caracteristicas, novo, nivel.value),
    });
}
const campo =
    'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const botao =
    'rounded-md border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
const botaoMestre = `${botao} border-ouro-500/50 text-ouro-100 hover:bg-ouro-500/20`;
</script>

<template>
    <div class="grid gap-4 p-4">
        <!-- controles do mestre: sempre visíveis para ele -->
        <section v-if="mestre" class="rounded-lg border border-ouro-500/40 bg-ouro-500/5 p-3" aria-label="Controles do mestre">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ouro-300">Mestre: Haki</h3>
            <div class="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    :class="[
                        botao,
                        h.liberado ? 'border-green-400 bg-green-500/20 text-green-100' : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                    ]"
                    :aria-pressed="h.liberado"
                    title="Despertar manual: a aba aparece para o jogador (no 8º nível ela aparece sozinha)"
                    @click="salvar({ 'haki.liberado': !h.liberado })"
                >
                    {{ h.liberado ? 'Haki liberado' : 'Liberar Haki' }}
                </button>
                <button
                    type="button"
                    :class="[
                        botao,
                        h.rei ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100' : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                    ]"
                    :aria-pressed="h.rei"
                    title="Revelar o Haki do Rei (talento Rei de graça, árvore do Rei e Ambição Crescente)"
                    @click="alternarRei"
                >
                    {{ h.rei ? 'Tem Haki do Rei' : 'Dar Haki do Rei' }}
                </button>
                <button
                    type="button"
                    :class="[
                        botao,
                        h.prematuroNivel ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                    ]"
                    :aria-pressed="h.prematuroNivel > 0"
                    title="Despertar prematuro: 2 PA agora e +2 por nível até o 8º"
                    @click="salvar({ 'haki.prematuroNivel': h.prematuroNivel ? 0 : nivel, 'haki.liberado': true })"
                >
                    {{ h.prematuroNivel ? `Despertar prematuro (desde o ${h.prematuroNivel}º)` : 'Despertar prematuro' }}
                </button>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-preto-300">PA gerais:</span>
                <button type="button" :class="botaoMestre" aria-label="Tirar PA gerais" @click="salvar({ 'haki.extras': h.extras - darGeral })">
                    −
                </button>
                <input v-model.number="darGeral" type="number" min="1" max="99" :class="campo" class="w-16" aria-label="Quantidade de PA gerais" />
                <button type="button" :class="botaoMestre" aria-label="Dar PA gerais" @click="salvar({ 'haki.extras': h.extras + darGeral })">
                    + dar
                </button>
                <span class="text-xs text-preto-400">dados pelo mestre: {{ h.extras }}</span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-preto-300">PA só de um Haki:</span>
                <select v-model="darTipo" :class="campo" aria-label="Tipo do PA restrito">
                    <option v-for="t in TIPOS_HAKI" :key="t.id" :value="t.id">{{ t.nome }}</option>
                </select>
                <input
                    v-model.number="darRestrito"
                    type="number"
                    min="1"
                    max="99"
                    :class="campo"
                    class="w-16"
                    aria-label="Quantidade de PA restritos"
                />
                <button
                    type="button"
                    :class="botaoMestre"
                    @click="salvar({ [`haki.restritos.${darTipo}`]: Math.max(0, h.restritos[darTipo] + darRestrito) })"
                >
                    + dar
                </button>
                <button
                    type="button"
                    :class="botaoMestre"
                    @click="salvar({ [`haki.restritos.${darTipo}`]: Math.max(0, h.restritos[darTipo] - darRestrito) })"
                >
                    − tirar
                </button>
                <span class="text-xs text-preto-400">
                    restritos: HdA {{ h.restritos.armamento }} · HdO {{ h.restritos.observacao }} · HdR {{ h.restritos.rei }}
                </span>
            </div>
            <div class="mt-2">
                <button type="button" :class="botaoMestre" title="Devolve todos os talentos comprados (os PA voltam ao saldo)" @click="resetar">
                    Resetar a árvore
                </button>
            </div>
        </section>

        <p v-if="!desperto && !mestre" class="text-sm text-preto-300">O Haki deste personagem ainda não despertou.</p>
        <template v-if="desperto || mestre">
            <p v-if="!desperto" class="rounded-lg border border-preto-700 bg-preto-900/60 p-3 text-xs text-preto-300">
                O Haki ainda não despertou (nível menor que 8 e não liberado). O jogador não vê esta aba até você liberar.
            </p>

            <!-- resumo -->
            <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do Haki">
                <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                    <span :class="estilos?.rotulo">Estágio</span>
                    <p class="font-serif text-xl font-semibold text-ouro-200">{{ estagioNome }}</p>
                    <p class="text-xs text-preto-400">
                        {{ pa.gastoPorTipo.armamento + pa.gastoPorTipo.observacao + pa.gastoPorTipo.rei }} PA distribuídos
                    </p>
                </div>
                <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                    <span :class="estilos?.rotulo">PA disponíveis</span>
                    <p class="font-serif text-xl font-semibold" :class="pa.disponiveis < 0 ? 'text-red-300' : 'text-ouro-200'">
                        {{ pa.disponiveis }}
                    </p>
                    <p class="text-xs text-preto-400">de {{ pa.ganhosGerais }} ganhos · {{ pa.gastoGeral }} gastos do saldo geral</p>
                </div>
                <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                    <span :class="estilos?.rotulo">PA restritos</span>
                    <p class="text-sm text-preto-100">
                        HdA <b>{{ pa.restritosRestantes.armamento }}</b> · HdO <b>{{ pa.restritosRestantes.observacao }}</b> · HdR
                        <b>{{ pa.restritosRestantes.rei }}</b>
                    </p>
                    <p class="text-xs text-preto-400">só valem naquele tipo de Haki</p>
                </div>
                <div class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                    <span :class="estilos?.rotulo">Haki Principal</span>
                    <div class="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Haki Principal">
                        <button
                            v-for="t in TIPOS_HAKI.filter((x) => x.id !== 'rei')"
                            :key="t.id"
                            type="button"
                            :disabled="!!h.principal && !podeEscolher"
                            :class="[
                                botao,
                                h.principal === t.id
                                    ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100'
                                    : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                                'disabled:opacity-50',
                            ]"
                            :aria-pressed="h.principal === t.id"
                            @click="salvar({ 'haki.principal': t.id })"
                        >
                            {{ t.sigla }}
                        </button>
                    </div>
                    <p class="mt-1 text-xs text-preto-400">O Haki do Rei é sempre secundário.</p>
                </div>
            </section>
            <p v-if="precisaDoPrincipal" class="rounded-lg border border-ouro-500/40 bg-ouro-500/10 p-2 text-xs text-ouro-100" role="status">
                Escolha o seu Haki Principal: Armamento ou Observação. O outro será o secundário.
            </p>
            <p v-if="pa.excedeOciosos" class="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200" role="status">
                Há {{ pa.ociosos }} PA ociosos (o livro permite até {{ MAX_PA_OCIOSOS }}). Gaste na árvore; o excedente seria perdido.
            </p>

            <div class="flex flex-wrap items-center gap-3">
                <div class="flex gap-1" aria-label="Abrir a árvore de talentos">
                    <button
                        v-for="t in tiposVisiveis"
                        :key="t.id"
                        type="button"
                        :class="[botao, 'border-preto-600 text-preto-200 hover:bg-preto-800']"
                        @click="abrir(t.id)"
                    >
                        {{ t.nome }}
                        <span class="ml-1 text-preto-400">({{ pa.gastoPorTipo[t.id] }} PA)</span>
                    </button>
                </div>
                <label class="flex items-center gap-2 text-xs text-preto-300">
                    Afinidade (+2 PA ao despertar esse Haki)
                    <select
                        :value="h.afinidade"
                        :disabled="!!h.afinidade && !podeEscolher"
                        :class="campo"
                        aria-label="Aptidão para Haki"
                        @change="salvar({ 'haki.afinidade': ($event.target as HTMLSelectElement).value })"
                    >
                        <option value="">—</option>
                        <option v-for="t in afinidades" :key="t.id" :value="t.id">{{ t.nome }}</option>
                    </select>
                </label>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <button type="button" :class="[botao, 'border-ouro-400 bg-ouro-500/20 text-ouro-100 hover:bg-ouro-500/30']" @click="abrir(tipo)">
                    <Network class="mr-1 inline size-3.5" aria-hidden="true" /> Abrir árvore de talentos
                </button>
                <span class="text-xs text-preto-400"
                    >{{ comprados }} talento(s) comprado(s) · {{ pa.disponiveis }} PA disponíveis. A árvore abre em tela cheia para você interagir com
                    mais espaço.</span
                >
            </div>
            <Dialog v-model:open="aberta">
                <DialogContent
                    class="flex h-[94vh] w-[97vw] max-w-[97vw] flex-col gap-2 overflow-hidden border-ouro-500/30 bg-preto-900 p-3 text-preto-100 sm:max-w-[97vw]"
                >
                    <DialogHeader class="space-y-0">
                        <DialogTitle class="font-serif text-ouro-200">Árvore de talentos do Haki</DialogTitle>
                        <DialogDescription class="text-xs text-preto-400">
                            Estágio {{ estagioNome }} · {{ pa.disponiveis }} PA disponíveis ({{ pa.gastoGeral }} gastos). Clique em um talento para
                            ver as formas e comprar.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="flex flex-wrap items-center gap-3">
                        <div class="flex gap-1" role="tablist" aria-label="Tipos de Haki">
                            <button
                                v-for="t in tiposVisiveis"
                                :key="t.id"
                                type="button"
                                role="tab"
                                :aria-selected="tipo === t.id"
                                :class="[
                                    botao,
                                    tipo === t.id
                                        ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100'
                                        : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                                ]"
                                @click="tipo = t.id"
                            >
                                {{ t.nome }} <span class="ml-1 text-preto-400">({{ pa.gastoPorTipo[t.id] }} PA)</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
                        <div class="flex min-h-[50vh] min-w-0 flex-1 flex-col">
                            <ArvoreHaki
                                ajustar
                                :tipo="tipo"
                                :haki="h"
                                :nivel="nivel"
                                :selecionado="selecionado"
                                :bonus="bonusDeHaki"
                                @selecionar="selecionado = $event"
                            />
                        </div>
                        <aside class="min-h-0 shrink-0 overflow-y-auto lg:w-[24rem]" aria-label="Talento selecionado">
                            <!-- talento selecionado -->
                            <section v-if="talento" class="rounded-lg border border-preto-700 bg-preto-900/60 p-3" aria-label="Talento selecionado">
                                <div class="flex flex-wrap items-baseline gap-2">
                                    <h3 class="font-serif text-lg font-semibold text-ouro-200">{{ talento.nome }}</h3>
                                    <span class="text-xs text-preto-400">
                                        {{ TIPOS_HAKI.find((t) => t.id === talento!.tipo)?.nome }} · Estágio {{ NOMES_ESTAGIO[talento.estagio] }} ·
                                        {{ talento.custo === 0 ? 'grátis' : `${talento.custo} PA por forma` }}
                                    </span>
                                </div>
                                <ul v-if="talento.requisitos.length" class="mt-1 flex flex-wrap gap-1.5 text-xs" aria-label="Requisitos">
                                    <li
                                        v-for="r in talento.requisitos"
                                        :key="r"
                                        class="flex items-center gap-1 rounded-full border px-2 py-0.5"
                                        :class="formaAtual(r) >= 1 ? 'border-green-400/60 text-green-200' : 'border-preto-600 text-preto-300'"
                                    >
                                        <Check v-if="formaAtual(r) >= 1" class="size-3" /><X v-else class="size-3" /> {{ talentoPorId(r)?.nome }}
                                    </li>
                                </ul>
                                <div
                                    v-for="f in textoForma"
                                    :key="f.n"
                                    class="mt-2 rounded border p-2"
                                    :class="formaAtual(talento.id) >= f.n ? 'border-ouro-400/60 bg-ouro-500/10' : 'border-preto-700'"
                                >
                                    <p
                                        class="flex items-center gap-1 text-xs font-semibold"
                                        :class="formaAtual(talento.id) >= f.n ? 'text-ouro-200' : 'text-preto-300'"
                                    >
                                        <Check v-if="formaAtual(talento.id) >= f.n" class="size-3" /> {{ f.rotulo }}
                                    </p>
                                    <p class="whitespace-pre-wrap text-sm leading-relaxed text-preto-100">{{ f.texto }}</p>
                                </div>
                                <div class="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        v-if="talento.id !== 'rei'"
                                        type="button"
                                        :disabled="!compra?.ok"
                                        :class="[
                                            botao,
                                            'border-ouro-400 bg-ouro-500/20 text-ouro-100 hover:bg-ouro-500/30 disabled:cursor-not-allowed disabled:opacity-40',
                                        ]"
                                        @click="comprarForma(talento.id)"
                                    >
                                        <template v-if="formaAtual(talento.id) >= formasDoTalento(talento)">Todas as formas compradas</template>
                                        <template v-else
                                            >Comprar
                                            {{ ['', 'a forma base', 'a Forma Dominada ☆', 'a Forma Avançada ★'][formaAtual(talento.id) + 1] }} ({{
                                                talento.custo
                                            }}
                                            PA)</template
                                        >
                                    </button>
                                    <button
                                        v-if="mestre && formaAtual(talento.id) >= 1 && talento.id !== 'rei'"
                                        type="button"
                                        :class="botaoMestre"
                                        @click="devolverForma(talento.id)"
                                    >
                                        Devolver a última forma (mestre)
                                    </button>
                                    <span
                                        v-if="compra && !compra.ok && formaAtual(talento.id) < formasDoTalento(talento)"
                                        class="text-xs text-preto-400"
                                        >{{ compra.motivo }}</span
                                    >
                                    <span v-if="mensagem" class="text-xs text-red-300" role="alert">{{ mensagem }}</span>
                                </div>
                            </section>
                            <p v-else class="text-xs text-preto-400">Clique em um talento para ver as formas, os requisitos e comprar.</p>
                        </aside>
                    </div>
                </DialogContent>
            </Dialog>
        </template>
    </div>
</template>
