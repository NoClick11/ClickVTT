<script setup lang="ts">
import { ref, watch } from 'vue';

/** Campo de texto (ou área, com `multilinha`) que salva ao sair do campo; Enter confirma na versão de uma linha. */
const props = withDefaults(defineProps<{ modelValue: string; multilinha?: boolean; somenteLeitura?: boolean; maximo?: number }>(), {
    multilinha: false,
    somenteLeitura: false,
});
const emit = defineEmits<{ salvar: [valor: string] }>();

const texto = ref(props.modelValue);
watch(
    () => props.modelValue,
    (v) => (texto.value = v),
);

function confirmar() {
    if (props.somenteLeitura) return;
    if (texto.value !== props.modelValue) emit('salvar', texto.value);
}
</script>

<template>
    <textarea v-if="multilinha" v-model="texto" :readonly="somenteLeitura" :maxlength="maximo" @blur="confirmar" />
    <input
        v-else
        v-model="texto"
        type="text"
        :readonly="somenteLeitura"
        :maxlength="maximo"
        autocomplete="off"
        @blur="confirmar"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.escape.prevent="texto = modelValue"
    />
</template>
