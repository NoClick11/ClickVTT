<script setup lang="ts">
import { computed, ref, unref, watch } from 'vue';
import { estilos, useFicha } from '../../contexto';
import {
    INDIVIDUALIDADES,
    NIVEIS_DE_INDIVIDUALIDADE,
    espacosDe,
    type Individualidade,
    type TipoDeIndividualidade,
} from '../../individualidades/dados';
import {
    camposDasIndividualidades,
    espacosDaFicha,
    espacosDeDefeitos,
    espacosUsados,
    normalizarIndividualidades,
    problemasDasIndividualidades,
    saldoDeDefeitos,
    type IndividualidadesFicha,
} from '../../individualidades/regras';
import type { FichaOnePiece } from '../../regras';

/**
 * Individualidades (regra opcional do cap. 5.5): Singularidades e Defeitos Suaves, Médias e Fortes. Nada é obrigatório. O jogador
 * monta um rascunho (5 espaços; um Defeito de mesmo nível por Singularidade) e salva quando estiver válido; o mestre libera Defeitos
 * Variáveis, dá espaços extras, aprova a "Ambição do Rei" e trava as escolhas depois da criação.
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { salvar, mestre } = useFicha();
const ehMestre = computed(() => (typeof mestre === 'boolean' ? mestre : (unref(mestre) ?? false)));

const salvas = computed(() => normalizarIndividualidades(props.ficha));
const rascunho = ref<IndividualidadesFicha>(clonar(salvas.value));
const sujo = ref(false);
function clonar(i: IndividualidadesFicha): IndividualidadesFicha {
    return { ...i, singularidades: i.singularidades.map((x) => ({ ...x })), defeitos: i.defeitos.map((x) => ({ ...x })) };
}
watch(salvas, (nova) => {
    if (!sujo.value) rascunho.value = clonar(nova);
});

const travada = computed(() => salvas.value.travada && !ehMestre.value);
const problemas = computed(() => problemasDasIndividualidades({ pericias: props.ficha.pericias, individualidades: rascunho.value }));
const usados = computed(() => espacosUsados(rascunho.value));
const disponiveis = computed(() => espacosDaFicha(rascunho.value));
const saldo = computed(() => saldoDeDefeitos(rascunho.value));
const defeitosEspacos = computed(() => espacosDeDefeitos(rascunho.value));

const lista = (tipo: TipoDeIndividualidade) => (tipo === 'singularidade' ? rascunho.value.singularidades : rascunho.value.defeitos);
const escolhido = (tipo: TipoDeIndividualidade, id: string) => lista(tipo).find((x) => x.id === id);
function alternar(d: Individualidade) {
    if (travada.value) return;
    const l = lista(d.tipo);
    const i = l.findIndex((x) => x.id === d.id);
    if (i >= 0) l.splice(i, 1);
    else l.push(d.escolha?.opcoes ? { id: d.id, escolha: d.escolha.opcoes[0].id } : { id: d.id });
    sujo.value = true;
}
const bloqueada = (d: Individualidade) => travada.value || (d.aprovacaoDoMestre && !ehMestre.value && !escolhido(d.tipo, d.id));

function salvarRascunho() {
    if (problemas.value.length && !ehMestre.value) return;
    salvar(camposDasIndividualidades(props.ficha, clonar(rascunho.value)));
    sujo.value = false;
}
function descartar() {
    rascunho.value = clonar(salvas.value);
    sujo.value = false;
}
/** Regras do Narrador: salvam na hora, junto do que já estava salvo. */
function mestreMuda(patch: Partial<IndividualidadesFicha>) {
    salvar(camposDasIndividualidades(props.ficha, { ...clonar(salvas.value), ...patch }));
    rascunho.value = { ...rascunho.value, ...patch };
}

const aberto = ref<string | null>(null);
const chip = (ativo: boolean, bloq: boolean, tipo: TipoDeIndividualidade) =>
    [
        'rounded-lg border px-2 py-1 text-left text-xs transition',
        ativo
            ? tipo === 'singularidade'
                ? 'border-green-400 bg-green-500/15 text-green-100'
                : 'border-red-400 bg-red-500/15 text-red-100'
            : 'border-preto-600 text-preto-300 hover:bg-preto-800',
        bloq ? 'cursor-not-allowed opacity-40' : '',
    ].join(' ');
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
const TITULO: Record<TipoDeIndividualidade, string> = { singularidade: 'Singularidades', defeito: 'Defeitos' };
</script>

<template>
    <div class="grid gap-3 p-3">
        <section :class="estilos.cartao" class="grid gap-2 p-3" aria-label="Resumo das Individualidades">
            <h3 :class="estilos.titulo">Individualidades (regra opcional)</h3>
            <p class="text-xs text-preto-400">
                Tudo aqui é opcional: dá para não escolher nenhuma, escolher só algumas ou ocupar todos os espaços. Singularidades Suaves ocupam 1
                espaço, Médias 3 e Fortes 4; para cada Singularidade você escolhe 1 Defeito do mesmo nível. As escolhas não podem contradizer o
                Estilo, a Profissão ou o Antecedente.
            </p>
            <p class="text-sm">
                Espaços de Singularidade:
                <strong :class="usados > disponiveis ? 'text-red-300' : 'text-ouro-200'">{{ usados }} / {{ disponiveis }}</strong>
                <template v-if="rascunho.variaveis">
                    · Defeitos Variáveis: Defeitos somam <strong class="text-ouro-200">{{ defeitosEspacos }}</strong> espaços (devem ser
                    {{ usados }}).</template
                >
                <template v-else>
                    ·
                    <span
                        v-for="n in NIVEIS_DE_INDIVIDUALIDADE"
                        :key="n.id"
                        class="mr-2 text-xs"
                        :class="saldo[n.id] === 0 ? 'text-preto-400' : 'text-amber-300'"
                    >
                        Defeitos {{ n.nome }}: {{ saldo[n.id] > 0 ? `faltam ${saldo[n.id]}` : saldo[n.id] < 0 ? `sobram ${-saldo[n.id]}` : 'ok' }}
                    </span>
                </template>
            </p>
            <p v-if="travada" class="text-xs text-amber-300">O mestre travou as escolhas deste personagem.</p>
            <div v-if="mestre" class="flex flex-wrap items-center gap-4 rounded border border-ouro-500/30 bg-ouro-500/5 p-2 text-xs text-preto-200">
                <span :class="estilos.rotulo">Mestre</span>
                <label class="flex items-center gap-1.5">
                    <input
                        type="checkbox"
                        class="accent-ouro-500"
                        :checked="salvas.variaveis"
                        @change="mestreMuda({ variaveis: ($event.target as HTMLInputElement).checked })"
                    />
                    Defeitos Variáveis (contam espaços)
                </label>
                <label class="flex items-center gap-1.5">
                    Espaços extras
                    <input
                        type="number"
                        min="0"
                        max="20"
                        :class="campo"
                        class="w-16"
                        :value="salvas.extras"
                        @change="mestreMuda({ extras: Math.max(0, Math.min(20, Number(($event.target as HTMLInputElement).value) || 0)) })"
                    />
                </label>
                <label class="flex items-center gap-1.5">
                    <input
                        type="checkbox"
                        class="accent-ouro-500"
                        :checked="salvas.travada"
                        @change="mestreMuda({ travada: ($event.target as HTMLInputElement).checked })"
                    />
                    Travar as escolhas (depois da criação)
                </label>
            </div>
        </section>

        <section
            v-for="tipo in ['singularidade', 'defeito'] as const"
            :key="tipo"
            :class="estilos.cartao"
            class="grid gap-3 p-3"
            :aria-label="TITULO[tipo]"
        >
            <h3 :class="estilos.titulo">{{ TITULO[tipo] }}</h3>
            <div v-for="n in NIVEIS_DE_INDIVIDUALIDADE" :key="n.id" class="grid gap-1.5">
                <span :class="estilos.rotulo">
                    {{ TITULO[tipo] }} {{ n.nome }}s
                    <template v-if="tipo === 'singularidade'">({{ espacosDe(n.id) }} {{ espacosDe(n.id) === 1 ? 'espaço' : 'espaços' }})</template>
                    <template v-else-if="rascunho.variaveis">({{ espacosDe(n.id) }} {{ espacosDe(n.id) === 1 ? 'espaço' : 'espaços' }})</template>
                </span>
                <div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    <div v-for="d in INDIVIDUALIDADES.filter((x) => x.tipo === tipo && x.nivel === n.id)" :key="d.id" class="grid gap-1">
                        <button
                            type="button"
                            :class="chip(!!escolhido(tipo, d.id), !!bloqueada(d), tipo)"
                            :disabled="!!bloqueada(d)"
                            :aria-pressed="!!escolhido(tipo, d.id)"
                            @click="alternar(d)"
                        >
                            <span class="font-semibold">{{ d.traco.nome }}</span>
                            <span v-if="d.aprovacaoDoMestre" class="ml-1 text-[10px] text-ouro-300">(aprovação do Narrador)</span>
                        </button>
                        <template v-if="escolhido(tipo, d.id) && d.escolha">
                            <select
                                v-if="d.escolha.opcoes"
                                v-model="escolhido(tipo, d.id)!.escolha"
                                :class="campo"
                                :disabled="travada"
                                :aria-label="d.escolha.rotulo"
                                @change="sujo = true"
                            >
                                <option v-for="o in d.escolha.opcoes" :key="o.id" :value="o.id">{{ o.rotulo }}</option>
                            </select>
                            <input
                                v-else
                                v-model="escolhido(tipo, d.id)!.escolha"
                                type="text"
                                maxlength="80"
                                :class="campo"
                                :disabled="travada"
                                :placeholder="d.escolha.rotulo"
                                :aria-label="d.escolha.rotulo"
                                @input="sujo = true"
                            />
                        </template>
                        <button
                            type="button"
                            class="text-left text-[11px] text-preto-500 hover:text-preto-300"
                            @click="aberto = aberto === `${tipo}:${d.id}` ? null : `${tipo}:${d.id}`"
                        >
                            {{ aberto === `${tipo}:${d.id}` ? 'Ocultar texto' : 'Ver texto' }}
                        </button>
                        <p v-if="aberto === `${tipo}:${d.id}`" class="rounded border border-preto-700 bg-preto-950 p-2 text-xs text-preto-300">
                            {{ d.traco.descricao }}
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <section :class="estilos.cartao" class="grid gap-2 p-3" aria-label="Salvar">
            <ul v-if="problemas.length" class="list-disc pl-5 text-xs text-amber-300">
                <li v-for="p in problemas" :key="p">{{ p }}</li>
            </ul>
            <p v-if="ehMestre && sujo && problemas.length" class="text-xs text-ouro-300">
                Como mestre, você tem permissão para salvar mesmo com avisos de espaços/defeitos.
            </p>
            <p v-else-if="sujo" class="text-xs text-green-300">Tudo certo: pode salvar.</p>
            <div class="flex gap-2">
                <button
                    type="button"
                    class="rounded bg-ouro-500 px-3 py-1.5 text-xs font-semibold text-preto-950 hover:bg-ouro-400 disabled:opacity-40"
                    :disabled="!sujo || (problemas.length > 0 && !ehMestre) || travada"
                    @click="salvarRascunho"
                >
                    Salvar Individualidades
                </button>
                <button
                    type="button"
                    class="rounded border border-preto-600 px-3 py-1.5 text-xs text-preto-200 hover:bg-preto-800"
                    :disabled="!sujo"
                    @click="descartar"
                >
                    Descartar mudanças
                </button>
            </div>
        </section>
    </div>
</template>
