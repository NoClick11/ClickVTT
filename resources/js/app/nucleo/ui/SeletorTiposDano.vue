<script setup lang="ts">
import { computed } from 'vue';
import { opcoesDeTipos } from '../combate/tiposDano';

/** Vários tipos de dano (resistências, imunidades, vulnerabilidades, tipos de uma técnica): botões que ligam e desligam. */
const props = defineProps<{ modelValue: readonly string[]; opcoes: readonly string[]; rotulo: string }>();
const emit = defineEmits<{ 'update:modelValue': [valor: string[]] }>();

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const lista = computed(() => opcoesDeTipos(props.opcoes, props.modelValue));
const ligado = (o: string) => props.modelValue.some((v) => norm(v) === norm(o));
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function alternar(o: string) {
    emit('update:modelValue', ligado(o) ? props.modelValue.filter((v) => norm(v) !== norm(o)) : [...props.modelValue, o]);
}
</script>

<template>
    <div class="flex flex-wrap gap-1" role="group" :aria-label="rotulo">
        <button
            v-for="o in lista"
            :key="o"
            type="button"
            :aria-pressed="ligado(o)"
            class="rounded border px-1.5 py-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            :class="ligado(o) ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100' : 'border-preto-700 text-preto-400 hover:text-preto-200'"
            @click="alternar(o)"
        >
            {{ maiuscula(o) }}
        </button>
    </div>
</template>
