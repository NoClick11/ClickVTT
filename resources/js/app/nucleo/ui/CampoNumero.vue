<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

/**
 * Campo numérico que salva ao sair do campo ou com Enter (campo a campo). Valor fora do intervalo é ajustado
 * ao limite; texto inválido volta ao valor anterior. `somenteLeitura` mostra o valor sem permitir edição.
 * Se `relativo` for true, aceita expressões de soma e subtração relativa como `+10`, `-10`, `-30`.
 */
const props = withDefaults(
    defineProps<{
        modelValue: number;
        min?: number;
        max?: number;
        decimal?: boolean;
        somenteLeitura?: boolean;
        relativo?: boolean;
        autofocus?: boolean;
    }>(),
    {
        decimal: false,
        somenteLeitura: false,
        relativo: false,
        autofocus: false,
    },
);
const emit = defineEmits<{ salvar: [valor: number]; cancelar: [] }>();

const inputRef = ref<HTMLInputElement | null>(null);
const texto = ref(String(props.modelValue));
watch(
    () => props.modelValue,
    (v) => (texto.value = String(v)),
);

onMounted(() => {
    if (props.autofocus) {
        setTimeout(() => {
            inputRef.value?.focus();
            inputRef.value?.select();
        }, 50);
    }
});

function confirmar() {
    if (props.somenteLeitura) return; // só exibe (ex.: valor efetivo): nunca grava
    const str = texto.value.replace(',', '.').trim();
    if (str === '') {
        texto.value = String(props.modelValue);
        return;
    }

    let n: number;
    if (props.relativo && /^[+-]/.test(str)) {
        const delta = Number(str.replace(/\s+/g, ''));
        if (!Number.isFinite(delta)) {
            texto.value = String(props.modelValue);
            return;
        }
        n = props.modelValue + delta;
    } else {
        n = Number(str);
        if (!Number.isFinite(n) || (!props.decimal && !Number.isInteger(n))) {
            texto.value = String(props.modelValue);
            return;
        }
    }

    const ajustado = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, n));
    texto.value = String(ajustado);
    if (ajustado !== props.modelValue) emit('salvar', ajustado);
}
</script>

<template>
    <input
        ref="inputRef"
        v-model="texto"
        type="text"
        :inputmode="decimal ? 'decimal' : 'numeric'"
        :readonly="somenteLeitura"
        autocomplete="off"
        @blur="confirmar"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.escape.prevent="
            texto = String(modelValue);
            emit('cancelar');
        "
        @focus="($event.target as HTMLInputElement).select()"
    />
</template>
