<script setup lang="ts">
import { Crosshair, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { iconeDoStatus } from '../nucleo/status';

/**
 * Painel do alvo mirado (flutua na base da tela): quem é, os efeitos que ele tem e um formulário para aplicar um efeito
 * (com duração em turnos ou até receber dano) ou tirá-lo. Só mostra e emite; quem fala com o servidor é a mesa.
 */
const props = defineProps<{
    nome: string;
    cor: string;
    /** Condições do sistema (vazio = o sistema não tem condições). */
    condicoes: { id: string; nome: string; descricao: string }[];
    /** Ids dos efeitos que o alvo tem agora. */
    ativas: string[];
    ocupado: boolean;
    /** Atributos do sistema para a salvaguarda do alvo (vazio = sem salvaguarda). */
    atributos?: { id: string; sigla: string }[];
}>();
const emit = defineEmits<{
    limpar: [];
    aplicar: [dados: { condicao: string; turnos?: string; ao_dano: boolean; salvaguarda?: { atributo: string; cd: number } }];
    remover: [condicao: string];
}>();

const condicao = ref('');
const turnos = ref('');
const cd = ref<number | ''>('');
const atributo = ref('for');
const aoDano = ref(false);
const nomeDe = (id: string) => props.condicoes.find((c) => c.id === id)?.nome ?? id;
const descricao = computed(() => props.condicoes.find((c) => c.id === condicao.value)?.descricao ?? '');

function aplicar() {
    if (!condicao.value) return;
    emit('aplicar', {
        condicao: condicao.value,
        ...(turnos.value.trim() ? { turnos: turnos.value.trim() } : {}),
        ao_dano: aoDano.value,
        ...(cd.value ? { salvaguarda: { atributo: atributo.value, cd: Number(cd.value) } } : {}),
    });
}
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <section
        class="pointer-events-auto absolute bottom-16 left-1/2 z-10 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-red-400/50 bg-preto-950/95 p-2.5 shadow-xl backdrop-blur"
        aria-label="Alvo mirado"
    >
        <div class="flex items-center gap-2">
            <Crosshair class="size-4 shrink-0 text-red-400" aria-hidden="true" />
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: cor }" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-preto-100">Alvo: {{ nome }}</span>
            <button
                type="button"
                class="rounded p-1 text-preto-400 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                aria-label="Limpar o alvo"
                title="Limpar o alvo (Esc)"
                @click="emit('limpar')"
            >
                <X class="size-4" />
            </button>
        </div>

        <ul v-if="ativas.length" class="mt-1.5 flex flex-wrap gap-1" aria-label="Efeitos do alvo">
            <li
                v-for="id in ativas"
                :key="id"
                class="flex items-center gap-1 rounded-full border border-red-400/60 bg-red-500/15 py-0.5 pl-1.5 pr-1 text-[11px] font-semibold text-red-200"
            >
                <span aria-hidden="true">{{ iconeDoStatus(id).icone }}</span> {{ nomeDe(id) }}
                <button
                    type="button"
                    class="rounded-full px-1 hover:bg-red-500/30"
                    :aria-label="`Tirar ${nomeDe(id)}`"
                    :disabled="ocupado"
                    @click="emit('remover', id)"
                >
                    ✕
                </button>
            </li>
        </ul>

        <form v-if="condicoes.length" class="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Aplicar efeito ao alvo" @submit.prevent="aplicar">
            <select v-model="condicao" :class="campo" aria-label="Efeito a aplicar" class="min-w-36 flex-1">
                <option value="">Aplicar efeito…</option>
                <option v-for="c in condicoes" :key="c.id" :value="c.id">{{ c.nome }}</option>
            </select>
            <input
                v-model="turnos"
                type="text"
                maxlength="5"
                placeholder="Turnos (3 ou 1d4)"
                aria-label="Duração em turnos, número ou dados (vazio = até remover)"
                :class="campo"
                class="w-32"
            />
            <template v-if="atributos?.length">
                <input
                    v-model.number="cd"
                    type="number"
                    min="1"
                    max="40"
                    placeholder="CD"
                    aria-label="CD da salvaguarda do alvo (vazio = sem salvaguarda)"
                    :class="campo"
                    class="w-16"
                />
                <select v-model="atributo" :class="campo" aria-label="Atributo da salvaguarda" :disabled="!cd">
                    <option v-for="a in atributos" :key="a.id" :value="a.id">{{ a.sigla }}</option>
                </select>
            </template>
            <label class="flex items-center gap-1 text-xs text-preto-300"
                ><input v-model="aoDano" type="checkbox" class="size-3.5 accent-ouro-500" /> até receber dano</label
            >
            <button
                type="submit"
                :disabled="!condicao || ocupado"
                class="rounded bg-red-500/80 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
                Aplicar
            </button>
        </form>
        <p v-if="descricao" class="mt-1 text-[11px] text-preto-400">{{ descricao }}</p>
    </section>
</template>
