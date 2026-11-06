<script setup lang="ts">
import { ref, watch } from 'vue';

/**
 * Campo numérico que salva ao sair do campo ou com Enter (campo a campo). Valor fora do intervalo é ajustado
 * ao limite; texto inválido volta ao valor anterior. `somenteLeitura` mostra o valor sem permitir edição.
 */
const props = withDefaults(defineProps<{ modelValue: number; min?: number; max?: number; decimal?: boolean; somenteLeitura?: boolean }>(), {
    decimal: false,
    somenteLeitura: false,
});
const emit = defineEmits<{ salvar: [valor: number] }>();

const texto = ref(String(props.modelValue));
watch(
    () => props.modelValue,
    (v) => (texto.value = String(v)),
);

function confirmar() {
    if (props.somenteLeitura) return; // só exibe (ex.: valor efetivo): nunca grava
    const n = Number(texto.value.replace(',', '.').trim());
    if (texto.value.trim() === '' || !Number.isFinite(n) || (!props.decimal && !Number.isInteger(n))) {
        texto.value = String(props.modelValue);
        return;
    }
    const ajustado = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, n));
    texto.value = String(ajustado);
    if (ajustado !== props.modelValue) emit('salvar', ajustado);
}
</script>

<template>
    <input
        v-model="texto"
        type="text"
        :inputmode="decimal ? 'decimal' : 'numeric'"
        :readonly="somenteLeitura"
        autocomplete="off"
        @blur="confirmar"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.escape.prevent="texto = String(modelValue)"
    />
</template>
