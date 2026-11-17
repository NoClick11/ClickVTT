<script setup lang="ts">
import { computed } from 'vue';
import { TIPOS_DE_DANO_ONE_PIECE } from '../nucleo/combate/tiposDano';
import SelectTipoDano from '../nucleo/ui/SelectTipoDano.vue';

/** O que a próxima zona criada com a ferramenta Zona terá: forma, tamanho (m), dano (dado e tipo), terreno difícil e se nasce visível. */
export interface OpcoesDaZona {
    forma: 'esfera' | 'cone' | 'linha' | 'retangulo';
    metros: number;
    largura_m: number;
    dano_dados: string;
    dano_tipo: string;
    terreno_dificil: boolean;
    visivel: boolean;
    /** Tamanho máximo (m) ao arrastar (ex.: o fio da Teia vai até 9 m); null = sem limite. */
    limite: number | null;
}

const props = defineProps<{ modelValue: OpcoesDaZona }>();
const emit = defineEmits<{ 'update:modelValue': [OpcoesDaZona] }>();
const mudar = (campos: Partial<OpcoesDaZona>) => emit('update:modelValue', { ...props.modelValue, limite: null, ...campos });
/** Predefinição da Teia da Vipera: um fio de aço (linha de até 9 m) oculto que corta quem o atravessa; arraste uma vez para cada fio. */
const teia = () =>
    emit('update:modelValue', {
        forma: 'linha',
        metros: 9,
        largura_m: 3,
        dano_dados: '2d6',
        dano_tipo: 'cortante',
        terreno_dificil: false,
        visivel: false,
        limite: 9,
    });
const num = (e: Event) => Math.max(0.5, Number((e.target as HTMLInputElement).value) || 0.5);
const formas = [
    { id: 'esfera', rotulo: 'Círculo' },
    { id: 'cone', rotulo: 'Cone' },
    { id: 'linha', rotulo: 'Linha' },
    { id: 'retangulo', rotulo: 'Retângulo' },
] as const;
const rotuloMetros = computed(() => (props.modelValue.forma === 'esfera' ? 'Raio (m)' : 'Comprimento (m)'));
const campo =
    'w-full rounded border border-preto-700 bg-preto-950 px-1.5 py-1 text-xs text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <div
        class="bg-preto-950/92 pointer-events-auto absolute left-16 top-16 z-10 grid w-56 gap-2 rounded-lg border border-ouro-500/20 p-2 text-xs backdrop-blur"
        role="group"
        aria-label="Opções da zona"
    >
        <div class="flex flex-wrap gap-1" role="radiogroup" aria-label="Forma">
            <button
                v-for="f in formas"
                :key="f.id"
                type="button"
                role="radio"
                :aria-checked="modelValue.forma === f.id"
                class="rounded-md border px-2 py-1"
                :class="modelValue.forma === f.id ? 'border-ouro-400 bg-ouro-500/15 text-ouro-200' : 'border-preto-700 text-preto-200'"
                @click="mudar({ forma: f.id })"
            >
                {{ f.rotulo }}
            </button>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
            <label class="grid gap-0.5 text-preto-300"
                >{{ rotuloMetros
                }}<input :value="modelValue.metros" type="number" min="0.5" step="0.5" :class="campo" @change="mudar({ metros: num($event) })"
            /></label>
            <label v-if="modelValue.forma === 'retangulo'" class="grid gap-0.5 text-preto-300"
                >Largura (m)<input
                    :value="modelValue.largura_m"
                    type="number"
                    min="0.5"
                    step="0.5"
                    :class="campo"
                    @change="mudar({ largura_m: num($event) })"
            /></label>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
            <label class="grid gap-0.5 text-preto-300"
                >Dano (dado)<input
                    :value="modelValue.dano_dados"
                    type="text"
                    maxlength="12"
                    placeholder="2d6 (vazio = sem dano)"
                    :class="campo"
                    @change="mudar({ dano_dados: ($event.target as HTMLInputElement).value.trim() })"
            /></label>
            <label class="grid gap-0.5 text-preto-300"
                >Tipo<SelectTipoDano
                    :model-value="modelValue.dano_tipo"
                    :opcoes="TIPOS_DE_DANO_ONE_PIECE"
                    vazio="Sem tipo"
                    :class="campo"
                    @update:model-value="mudar({ dano_tipo: $event })"
            /></label>
        </div>
        <label class="flex items-center gap-2 text-preto-200"
            ><input
                type="checkbox"
                class="size-4 accent-ouro-500"
                :checked="modelValue.terreno_dificil"
                @change="mudar({ terreno_dificil: ($event.target as HTMLInputElement).checked })"
            />
            Terreno difícil (só desenhado)</label
        >
        <label class="flex items-center gap-2 text-preto-200"
            ><input
                type="checkbox"
                class="size-4 accent-ouro-500"
                :checked="modelValue.visivel"
                @change="mudar({ visivel: ($event.target as HTMLInputElement).checked })"
            />
            Visível aos jogadores</label
        >
        <button
            type="button"
            class="rounded-md border border-preto-700 px-2 py-1 text-left text-preto-200 hover:border-ouro-400"
            title="Fio de aço: linha de até 9 m, 2d6 cortante, oculta. Arraste entre dois pilares; repita para cada fio."
            @click="teia"
        >
            Predefinição: Teia da Vipera (fio de aço)
        </button>
        <p class="text-[11px] text-preto-400">
            Clique cria no tamanho acima; <strong>arraste</strong> para definir o tamanho e a direção. O dano vale ao entrar na zona e no início do
            turno de quem está dentro (combate em curso).
        </p>
    </div>
</template>
