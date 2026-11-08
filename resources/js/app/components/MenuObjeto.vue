<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { CAMADAS, type Camada, type ObjetoDto } from '../engine/tipos';

/**
 * Menu do botão direito sobre um objeto do mapa (só o mestre): mover o objeto entre as camadas Mapa, Mestre e Jogadores.
 * A camada atual aparece marcada; a iluminação (luzes e paredes) não entra, porque só aceita esses tipos.
 */
const props = defineProps<{ objeto: ObjetoDto; x: number; y: number }>();
const emit = defineEmits<{ mover: [camada: Camada]; abrir: []; fechar: [] }>();

/** O loot só vive oculto (Mestre) ou aberto aos jogadores (Jogadores). */
const camadas = computed(() => CAMADAS.filter((c) => c.id !== 'iluminacao' && (props.objeto.tipo !== 'loot' || c.id !== 'mapa')));
const titulo = computed(() => props.objeto.nome || 'Objeto');
/** Mantém o menu dentro da janela. */
const posicao = computed(() => ({
    left: Math.min(props.x, window.innerWidth - 220) + 'px',
    top: Math.min(props.y, window.innerHeight - 40 - camadas.value.length * 36) + 'px',
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
        :aria-label="`Opções de ${titulo}`"
    >
        <p class="truncate px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400" :title="titulo">{{ titulo }}</p>
        <button
            v-if="objeto.tipo === 'loot'"
            type="button"
            role="menuitem"
            class="mb-1 flex w-full items-center rounded-md bg-ouro-500/15 px-2 py-1.5 text-left text-sm text-ouro-100 transition hover:bg-ouro-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            @click="emit('abrir')"
        >
            Abrir loot
        </button>
        <p class="px-2 pb-1 text-[10px] text-preto-500">Mover para a camada</p>
        <button
            v-for="c in camadas"
            :key="c.id"
            type="button"
            role="menuitem"
            :disabled="c.id === objeto.camada"
            class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            :class="c.id === objeto.camada ? 'text-ouro-200' : 'text-preto-100 hover:bg-ouro-500/15'"
            :title="c.dica"
            @click="emit('mover', c.id)"
        >
            {{ c.nome }}
            <Check v-if="c.id === objeto.camada" class="size-4" aria-label="camada atual" />
        </button>
    </div>
</template>
