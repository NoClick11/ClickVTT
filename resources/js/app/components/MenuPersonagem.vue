<script setup lang="ts">
import { Pencil, Trash2 } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted } from 'vue';

/** Menu do botão direito sobre um personagem da lista (só o mestre): renomear ou excluir. */
const props = defineProps<{ nome: string; x: number; y: number }>();
const emit = defineEmits<{ renomear: []; excluir: []; fechar: [] }>();

/** Mantém o menu dentro da janela. */
const posicao = computed(() => ({
    left: Math.min(props.x, window.innerWidth - 220) + 'px',
    top: Math.min(props.y, window.innerHeight - 90) + 'px',
}));
const aoTecla = (e: KeyboardEvent) => e.key === 'Escape' && emit('fechar');
onMounted(() => window.addEventListener('keydown', aoTecla));
onBeforeUnmount(() => window.removeEventListener('keydown', aoTecla));
</script>

<template>
    <!-- a película captura o clique fora (e o botão direito fora) para fechar -->
    <div class="pointer-events-auto fixed inset-0 z-40" @pointerdown="emit('fechar')" @contextmenu.prevent="emit('fechar')" />
    <div
        class="pointer-events-auto fixed z-50 w-52 rounded-lg border border-ouro-500/30 bg-preto-950/95 p-1.5 shadow-xl shadow-black/50 backdrop-blur"
        :style="posicao"
        role="menu"
        :aria-label="`Opções de ${nome}`"
    >
        <p class="truncate px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400" :title="nome">{{ nome }}</p>
        <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-preto-200 transition hover:bg-ouro-500/15 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            @click="emit('renomear')"
        >
            <Pencil class="size-4 text-ouro-400" aria-hidden="true" /> Renomear
        </button>
        <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-red-300 transition hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            @click="emit('excluir')"
        >
            <Trash2 class="size-4" aria-hidden="true" /> Excluir personagem
        </button>
    </div>
</template>
