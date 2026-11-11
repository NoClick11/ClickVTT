<script setup lang="ts">
import { Crosshair, Eye } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted } from 'vue';

const props = defineProps<{
    x: number;
    y: number;
}>();

const emit = defineEmits<{
    pingNormal: [];
    pingFoco: [];
    fechar: [];
}>();

const posicao = computed(() => ({
    left: Math.min(props.x, window.innerWidth - 180) + 'px',
    top: Math.min(props.y, window.innerHeight - 90) + 'px',
}));

const aoTecla = (e: KeyboardEvent) => e.key === 'Escape' && emit('fechar');
onMounted(() => window.addEventListener('keydown', aoTecla));
onBeforeUnmount(() => window.removeEventListener('keydown', aoTecla));
</script>

<template>
    <!-- Película transparente que fecha ao clicar fora -->
    <div class="pointer-events-auto fixed inset-0 z-40" @pointerdown="emit('fechar')" @contextmenu.prevent="emit('fechar')" />

    <div
        class="pointer-events-auto fixed z-50 w-44 rounded-lg border border-ouro-500/30 bg-preto-950/95 p-1.5 shadow-xl shadow-black/60 backdrop-blur"
        :style="posicao"
        role="menu"
        aria-label="Opções de Ping"
    >
        <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-preto-100 transition hover:bg-ouro-500/20 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ouro-400"
            @click="
                emit('pingNormal');
                emit('fechar');
            "
        >
            <Crosshair class="size-4 text-ouro-400" />
            Ping
        </button>

        <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-preto-100 transition hover:bg-ouro-500/20 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ouro-400"
            @click="
                emit('pingFoco');
                emit('fechar');
            "
        >
            <Eye class="size-4 text-amber-400" />
            Ping com foco
        </button>
    </div>
</template>
