<script setup lang="ts">
/**
 * Uma área da ficha (cartão de atributo, iniciativa, ataque de magia...) que rola ao clicar em QUALQUER ponto dela,
 * como no Foundry: vira um botão com realce, foco e "afundar" ao clicar. Com `ativa = false` (ex.: modo Editar, em que
 * a área tem campos próprios) é um bloco comum, sem rolar. O layout e as cores vêm de quem usa (`class`).
 * Emite o clique para o sistema olhar teclas modificadoras (Shift = vantagem, Ctrl = desvantagem).
 * Dentro do botão só cabe conteúdo de texto corrido (`span`), nunca `p`, `div` ou campos.
 */
const props = withDefaults(defineProps<{ rotulo: string; ativa?: boolean; modo?: 'vantagem' | 'desvantagem' | null }>(), { ativa: true, modo: null });
const emit = defineEmits<{ rolar: [evento: MouseEvent] }>();

const clicar = (evento: MouseEvent) => props.ativa && emit('rolar', evento);
</script>

<template>
    <component
        :is="ativa ? 'button' : 'div'"
        :type="ativa ? 'button' : undefined"
        :class="
            ativa
                ? 'group cursor-pointer transition hover:border-ouro-400 hover:bg-ouro-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 active:scale-[0.98]'
                : ''
        "
        :aria-label="ativa ? `Rolar ${rotulo}${modo ? ` com ${modo}` : ''}` : undefined"
        :title="ativa ? `Clique para rolar ${rotulo}. Shift = vantagem, Ctrl = desvantagem.${modo ? ` (${modo} por efeito ativo)` : ''}` : undefined"
        @click="clicar"
    >
        <slot />
    </component>
</template>
