<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next';
import { computed } from 'vue';
import type { AlvoEfeito, VariavelEfeito } from '../sistemas/tipos';
import { dadosValidos, MODOS, type EfeitoBruto, type ModoEfeito } from './efeitos';
import { efeitoValido } from './validacao';

/**
 * Editor de uma lista de efeitos (`{alvo, modo, valor}`), genérico: os alvos, os modos de cada um e as variáveis que
 * o valor pode usar vêm do sistema. O valor é um número fixo, uma variável da ficha (ex.: o modificador de um
 * atributo) ou uma fórmula livre (`14+min(@mod.des,2)`; sem dados). Vantagem e desvantagem não têm valor. O modo "dano
 * extra" acrescenta dados (`3d6`) à rolagem do alvo.
 */
const props = defineProps<{
    modelValue: EfeitoBruto[];
    alvos: AlvoEfeito[];
    /** Variáveis que o valor pode usar neste alvo (depende do alvo). */
    variaveis?: (alvo: string) => VariavelEfeito[];
    maximo?: number;
}>();
const emit = defineEmits<{ 'update:modelValue': [EfeitoBruto[]] }>();

const ROTULOS: Record<ModoEfeito, string> = {
    soma: 'Soma',
    base: 'Valor base',
    min: 'Mínimo',
    max: 'Máximo',
    vantagem: 'Vantagem',
    desvantagem: 'Desvantagem',
    dados: 'Dano extra (dados)',
};
const DICAS: Record<ModoEfeito, string> = {
    soma: 'Soma ao valor (ex.: +1 de CA)',
    base: 'Substitui o valor de partida; entre vários, vale o maior (ex.: armadura define a CA)',
    min: 'Eleva ao mínimo (ex.: Força vira pelo menos 21)',
    max: 'Limita ao máximo',
    vantagem: 'Os botões de rolagem do alvo usam vantagem',
    desvantagem: 'Os botões de rolagem do alvo usam desvantagem',
    dados: 'Acrescenta estes dados ao dano das armas (ex.: Ataque Furtivo, 3d6); eles dobram no crítico',
};
const NUMERO = '__numero';
const FORMULA = '__formula';

const limite = computed(() => props.maximo ?? 30);
const alvoDe = (id: string) => props.alvos.find((a) => a.id === id);
const modosDe = (id: string): ModoEfeito[] => (alvoDe(id)?.modos ?? MODOS).filter((m) => MODOS.includes(m));
const semValor = (modo: ModoEfeito) => modo === 'vantagem' || modo === 'desvantagem';
const variaveisDe = (alvo: string): VariavelEfeito[] => props.variaveis?.(alvo) ?? [];

/** De onde vem o valor: número fixo, uma variável oferecida (`@mod.sab` exato) ou fórmula livre. */
function origemDe(e: EfeitoBruto): string {
    if (e.valor === undefined || e.valor === null || e.valor === '' || typeof e.valor === 'number') return NUMERO;
    const texto = e.valor.trim().toLowerCase();

    return variaveisDe(e.alvo).find((v) => texto === `@${v.id}`)?.id ?? FORMULA;
}
/** As variáveis agrupadas para o seletor (`optgroup`); as sem grupo ficam soltas. */
function opcoesDe(alvo: string) {
    const grupos = new Map<string, VariavelEfeito[]>();
    for (const v of variaveisDe(alvo)) grupos.set(v.grupo ?? '', [...(grupos.get(v.grupo ?? '') ?? []), v]);

    return [...grupos].map(([grupo, itens]) => ({ grupo, itens }));
}

/** Número digitado vira número; qualquer outra coisa é fórmula (texto). */
const converter = (texto: string): number | string => (/^-?\d+(\.\d+)?$/.test(texto.trim()) ? Number(texto) : texto);
const valida = efeitoValido;
/** Uma variável que o alvo atual não oferece (ex.: trocou para atributos) deixaria o efeito sem efeito. */
const variavelIndisponivel = (e: EfeitoBruto) => {
    if (typeof e.valor !== 'string') return false;
    const usadas = [...e.valor.toLowerCase().matchAll(/@([a-z0-9_.]+)/g)].map((m) => m[1]);
    const oferecidas = new Set(variaveisDe(e.alvo).map((v) => v.id));

    return props.variaveis !== undefined && usadas.some((u) => !oferecidas.has(u));
};

function mudar(i: number, campos: Partial<EfeitoBruto>) {
    const lista = props.modelValue.map((e) => ({ ...e }));
    lista[i] = { ...lista[i], ...campos };
    // Trocou o alvo e o modo não vale mais nele: usa o primeiro que vale.
    if (campos.alvo !== undefined && !modosDe(lista[i].alvo).includes(lista[i].modo)) lista[i].modo = modosDe(lista[i].alvo)[0];
    // O valor padrão do modo só entra quando o MODO (ou o alvo) muda. Ao DIGITAR, o texto fica como está: "3" e "3d" são
    // inválidos no meio da digitação de "3d6" e não podem ser trocados por um padrão.
    const mudouModo = campos.modo !== undefined || campos.alvo !== undefined;
    if (semValor(lista[i].modo)) delete lista[i].valor;
    else if (lista[i].modo === 'dados') {
        if (mudouModo && !dadosValidos(lista[i].valor)) lista[i].valor = '1d6';
    } else if (lista[i].valor === undefined || (mudouModo && dadosValidos(lista[i].valor))) lista[i].valor = 1;
    emit('update:modelValue', lista);
}
/** Trocou a origem do valor: número fixo, uma variável (vira `@id`) ou fórmula livre (mantém o texto atual). */
function mudarOrigem(i: number, origem: string) {
    const e = props.modelValue[i];
    if (origem === NUMERO) mudar(i, { valor: typeof e.valor === 'number' ? e.valor : 1 });
    else if (origem === FORMULA) mudar(i, { valor: typeof e.valor === 'string' ? e.valor : String(e.valor ?? '') });
    else mudar(i, { valor: `@${origem}` });
}
const remover = (i: number) =>
    emit(
        'update:modelValue',
        props.modelValue.filter((_, j) => j !== i),
    );
const adicionar = () =>
    emit('update:modelValue', [
        ...props.modelValue,
        { alvo: props.alvos[0]?.id ?? '', modo: modosDe(props.alvos[0]?.id ?? '')[0] ?? 'soma', valor: 1 },
    ]);
const campo =
    'h-8 rounded-md border border-preto-700 bg-preto-950 px-2 text-xs text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <div class="grid gap-1.5">
        <ul v-if="modelValue.length" class="grid gap-1.5">
            <li v-for="(e, i) in modelValue" :key="i" class="grid gap-1.5 rounded-md border border-preto-800 bg-preto-900/60 p-1.5">
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
                    <select
                        :value="e.alvo"
                        :class="campo"
                        class="col-span-2 sm:col-span-1"
                        :aria-label="`Alvo do efeito ${i + 1}`"
                        @change="mudar(i, { alvo: ($event.target as HTMLSelectElement).value })"
                    >
                        <option v-if="!alvoDe(e.alvo)" :value="e.alvo">{{ e.alvo }} (desconhecido)</option>
                        <option v-for="a in alvos" :key="a.id" :value="a.id">{{ a.rotulo }}</option>
                    </select>
                    <select
                        :value="e.modo"
                        :class="campo"
                        :aria-label="`Modo do efeito ${i + 1}`"
                        :title="DICAS[e.modo]"
                        @change="mudar(i, { modo: ($event.target as HTMLSelectElement).value as ModoEfeito })"
                    >
                        <option v-for="m in modosDe(e.alvo)" :key="m" :value="m">{{ ROTULOS[m] }}</option>
                    </select>
                    <button
                        type="button"
                        class="flex size-8 items-center justify-center rounded-md text-preto-400 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        :aria-label="`Remover efeito ${i + 1}`"
                        @click="remover(i)"
                    >
                        <Trash2 class="size-4" />
                    </button>
                </div>

                <div v-if="!semValor(e.modo) && e.modo !== 'dados'" class="flex flex-wrap items-center gap-1.5">
                    <select
                        :value="origemDe(e)"
                        :class="campo"
                        class="min-w-0 flex-1 sm:flex-none sm:basis-56"
                        :aria-label="`De onde vem o valor do efeito ${i + 1}`"
                        title="Um número fixo, o modificador de um atributo (ou outra variável da ficha) ou uma fórmula livre"
                        @change="mudarOrigem(i, ($event.target as HTMLSelectElement).value)"
                    >
                        <option :value="NUMERO">Número fixo</option>
                        <template v-for="g in opcoesDe(e.alvo)" :key="g.grupo">
                            <optgroup v-if="g.grupo" :label="g.grupo">
                                <option v-for="v in g.itens" :key="v.id" :value="v.id">{{ v.rotulo }}</option>
                            </optgroup>
                            <option v-for="v in g.grupo ? [] : g.itens" :key="v.id" :value="v.id">{{ v.rotulo }}</option>
                        </template>
                        <option :value="FORMULA">Fórmula livre…</option>
                    </select>
                    <input
                        v-if="origemDe(e) === NUMERO || origemDe(e) === FORMULA"
                        :value="e.valor ?? ''"
                        type="text"
                        maxlength="100"
                        :placeholder="origemDe(e) === NUMERO ? '2' : '14+min(@mod.des,2)'"
                        spellcheck="false"
                        autocomplete="off"
                        :class="[campo, 'min-w-24 flex-1 font-mono', valida(e) && !variavelIndisponivel(e) ? '' : 'border-red-400']"
                        :aria-label="`Valor do efeito ${i + 1}`"
                        :aria-invalid="!valida(e) || variavelIndisponivel(e)"
                        @input="mudar(i, { valor: converter(($event.target as HTMLInputElement).value) })"
                    />
                    <span v-else class="font-mono text-[11px] text-ouro-300">{{ e.valor }}</span>
                    <p v-if="variavelIndisponivel(e)" class="basis-full text-[11px] text-red-300" role="alert">
                        Esta fórmula usa um valor que não existe neste alvo; o efeito seria ignorado.
                    </p>
                    <p v-else-if="!valida(e)" class="basis-full text-[11px] text-red-300" role="alert">Fórmula inválida.</p>
                </div>
                <div v-else-if="e.modo === 'dados'" class="flex flex-wrap items-center gap-1.5">
                    <input
                        :value="e.valor ?? ''"
                        type="text"
                        maxlength="6"
                        placeholder="3d6"
                        spellcheck="false"
                        autocomplete="off"
                        :class="[campo, 'w-28 font-mono', valida(e) ? '' : 'border-red-400']"
                        :aria-label="`Dados do efeito ${i + 1}`"
                        :aria-invalid="!valida(e)"
                        @input="mudar(i, { valor: ($event.target as HTMLInputElement).value.trim().toLowerCase() })"
                    />
                    <span class="text-[11px] text-preto-500">somados ao dano; dobram no crítico</span>
                    <p v-if="!valida(e)" class="basis-full text-[11px] text-red-300" role="alert">
                        Use dados simples, como 3d6 (até 20 dados de 2 a 100 faces).
                    </p>
                </div>
                <p v-else class="px-1 text-[11px] text-preto-500">{{ DICAS[e.modo] }}.</p>
            </li>
        </ul>
        <p v-else class="rounded-md border border-dashed border-preto-700 px-3 py-2 text-xs text-preto-500">
            Sem efeitos. Um item comum só tem nome, peso e descrição.
        </p>
        <button
            type="button"
            class="flex w-fit items-center gap-1 rounded-md border border-ouro-500/40 px-2.5 py-1 text-xs text-ouro-200 hover:bg-ouro-500/10 disabled:opacity-40"
            :disabled="modelValue.length >= limite"
            @click="adicionar"
        >
            <Plus class="size-3.5" /> Efeito
        </button>
    </div>
</template>
