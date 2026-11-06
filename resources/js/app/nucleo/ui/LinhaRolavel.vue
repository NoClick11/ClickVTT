<script setup lang="ts">
import IndicadorD20 from './IndicadorD20.vue';

/**
 * Linha de uma lista da ficha (perícia, salvaguarda...) que rola ao clicar em QUALQUER ponto dela, como no Foundry.
 * Mostra um d20 discreto à direita (que acende ao passar o mouse) e o badge V/D quando há vantagem ou desvantagem.
 * Com `ativa = false` (ex.: modo Editar, em que a linha tem controles próprios) vira uma linha comum, sem rolar.
 * Emite o clique para o sistema olhar teclas modificadoras (Shift = vantagem, Ctrl = desvantagem).
 */
const props = withDefaults(defineProps<{ rotulo: string; ativa?: boolean; modo?: 'vantagem' | 'desvantagem' | null }>(), { ativa: true, modo: null });
const emit = defineEmits<{ rolar: [evento: MouseEvent] }>();

const clicar = (evento: MouseEvent) => props.ativa && emit('rolar', evento);
</script>

<template>
    <component
        :is="ativa ? 'button' : 'div'"
        :type="ativa ? 'button' : undefined"
        class="group flex min-h-8 w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left transition"
        :class="
            ativa
                ? 'cursor-pointer hover:border-ouro-500/40 hover:bg-ouro-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 active:scale-[0.99]'
                : 'hover:bg-preto-800/60'
        "
        :aria-label="ativa ? `Rolar ${rotulo}${modo ? ` com ${modo}` : ''}` : undefined"
        :title="ativa ? `Clique para rolar ${rotulo}. Shift = vantagem, Ctrl = desvantagem.${modo ? ` (${modo} por efeito ativo)` : ''}` : undefined"
        @click="clicar"
    >
        <slot />
        <IndicadorD20 v-if="ativa" :modo="modo" class="size-5 opacity-40 transition group-hover:scale-110 group-hover:opacity-100" />
    </component>
</template>
