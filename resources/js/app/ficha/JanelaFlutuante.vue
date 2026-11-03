<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{ titulo: string; cor?: string; x: number; y: number; largura: number; altura: number; z: number; minLargura?: number; minAltura?: number }>();
const emit = defineEmits<{ fechar: []; focar: [] }>();

const TOPO = 48; // altura da barra superior da mesa
const minL = props.minLargura ?? 640;
const minA = props.minAltura ?? 420;
const pos = ref({ x: props.x, y: props.y });
const tam = ref({ w: props.largura, h: props.altura });

/** Mantém a janela inteira dentro da tela (as alças de redimensionar nunca ficam fora de alcance). */
function limitar() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const maxL = W - 8;
    const maxA = H - TOPO - 4;
    tam.value.w = Math.min(Math.max(tam.value.w, Math.min(minL, maxL)), maxL);
    tam.value.h = Math.min(Math.max(tam.value.h, Math.min(minA, maxA)), maxA);
    pos.value.x = Math.min(Math.max(pos.value.x, 4), W - tam.value.w - 4);
    pos.value.y = Math.min(Math.max(pos.value.y, TOPO), H - tam.value.h - 4);
}
onMounted(() => {
    limitar();
    window.addEventListener('resize', limitar);
});
onBeforeUnmount(() => window.removeEventListener('resize', limitar));

type Modo = 'mover' | 'e' | 's' | 'se';
let modo: Modo | null = null;
let origem = { px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 };

function iniciar(e: PointerEvent, m: Modo) {
    modo = m;
    origem = { px: e.clientX, py: e.clientY, x: pos.value.x, y: pos.value.y, w: tam.value.w, h: tam.value.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    emit('focar');
}
function mover(e: PointerEvent) {
    if (!modo) return;
    const dx = e.clientX - origem.px;
    const dy = e.clientY - origem.py;
    if (modo === 'mover') {
        pos.value = { x: origem.x + dx, y: origem.y + dy };
    } else {
        if (modo === 'e' || modo === 'se') tam.value.w = origem.w + dx;
        if (modo === 's' || modo === 'se') tam.value.h = origem.h + dy;
    }
    limitar();
}
function soltar(e: PointerEvent) {
    modo = null;
    const alvo = e.currentTarget as HTMLElement;
    if (alvo.hasPointerCapture(e.pointerId)) alvo.releasePointerCapture(e.pointerId);
}
</script>

<template>
    <section
        role="group"
        :aria-label="titulo"
        class="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-ouro-500/40 bg-preto-950 shadow-2xl shadow-black/60"
        :style="{ left: pos.x + 'px', top: pos.y + 'px', width: tam.w + 'px', height: tam.h + 'px', zIndex: z }"
        @pointerdown="emit('focar')"
    >
        <header
            class="flex h-9 shrink-0 cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-ouro-500/25 bg-preto-900 px-3 active:cursor-grabbing"
            @pointerdown="iniciar($event, 'mover')"
            @pointermove="mover"
            @pointerup="soltar"
            @pointercancel="soltar"
        >
            <h2 class="flex min-w-0 items-center gap-2 truncate font-serif text-sm font-semibold text-ouro-100">
                <span v-if="cor" class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: cor }" />
                <span class="truncate">{{ titulo }}</span>
            </h2>
            <button type="button" class="flex size-6 items-center justify-center rounded text-preto-300 hover:bg-preto-800 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400" aria-label="Fechar ficha" @pointerdown.stop @click="emit('fechar')">
                <X class="size-4" />
            </button>
        </header>
        <div class="min-h-0 flex-1 overflow-hidden"><slot /></div>

        <!-- alças de redimensionar: direita, base e canto -->
        <div class="absolute bottom-0 right-0 top-9 w-1.5 cursor-ew-resize touch-none" @pointerdown="iniciar($event, 'e')" @pointermove="mover" @pointerup="soltar" @pointercancel="soltar" />
        <div class="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize touch-none" @pointerdown="iniciar($event, 's')" @pointermove="mover" @pointerup="soltar" @pointercancel="soltar" />
        <div class="absolute bottom-0 right-0 size-4 cursor-nwse-resize touch-none" aria-hidden="true" @pointerdown="iniciar($event, 'se')" @pointermove="mover" @pointerup="soltar" @pointercancel="soltar">
            <svg viewBox="0 0 16 16" class="size-4 text-preto-500"><path d="M14 6 6 14M14 10l-4 4M14 2 2 14" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        </div>
    </section>
</template>
