<script setup lang="ts">
import { computed } from 'vue';
import { opcoesDeTipos } from '../combate/tiposDano';

/** Seleção de um tipo de dano (lista fechada). Valor antigo fora da lista continua aparecendo até ser trocado. */
const props = defineProps<{ modelValue: string | null | undefined; opcoes: readonly string[]; vazio?: string }>();
const emit = defineEmits<{ 'update:modelValue': [valor: string] }>();

const lista = computed(() => opcoesDeTipos(props.opcoes, [props.modelValue ?? '']));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const atual = computed(() => lista.value.find((o) => norm(o) === norm(props.modelValue ?? '')) ?? '');
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<template>
    <select :value="atual" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
        <option v-if="vazio !== undefined" value="">{{ vazio }}</option>
        <option v-for="o in lista" :key="o" :value="o">{{ maiuscula(o) }}</option>
    </select>
</template>
