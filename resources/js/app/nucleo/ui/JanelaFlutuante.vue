<script setup lang="ts">
import { Maximize2, Minimize2, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
    titulo: string;
    nome?: string;
    cor?: string;
    x: number;
    y: number;
    largura: number;
    altura: number;
    z: number;
    minLargura?: number;
    minAltura?: number;
}>();
const emit = defineEmits<{ fechar: []; focar: [] }>();

const TOPO = 48; // altura da barra superior da mesa
const LARGURA_MINIMIZADA = 240;
const ALTURA_MINIMIZADA = 36;
const minL = props.minLargura ?? 640;
const minA = props.minAltura ?? 420;
const pos = ref({ x: props.x, y: props.y });
const tam = ref({ w: props.largura, h: props.altura });
const tamSalvo = ref({ w: props.largura, h: props.altura });
const minimizado = ref(false);

const tituloExibicao = computed(() => {
    if (minimizado.value) {
        return props.nome || props.titulo.replace(/^Ficha\s*·\s*/, '');
    }
    return props.titulo;
});

/** Mantém a janela inteira dentro da tela (as alças de redimensionar nunca ficam fora de alcance). */
function limitar() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const maxL = W - 8;
    const maxA = H - TOPO - 4;

    if (minimizado.value) {
        pos.value.x = Math.min(Math.max(pos.value.x, 4), W - LARGURA_MINIMIZADA - 4);
        pos.value.y = Math.min(Math.max(pos.value.y, TOPO), H - ALTURA_MINIMIZADA - 4);
        return;
    }

    tam.value.w = Math.min(Math.max(tam.value.w, Math.min(minL, maxL)), maxL);
    tam.value.h = Math.min(Math.max(tam.value.h, Math.min(minA, maxA)), maxA);
    pos.value.x = Math.min(Math.max(pos.value.x, 4), W - tam.value.w - 4);
    pos.value.y = Math.min(Math.max(pos.value.y, TOPO), H - tam.value.h - 4);
}

let ultimaAlternancia = 0;
function alternarMinimizado() {
    const agora = performance.now();
    if (agora - ultimaAlternancia < 200) return;
    ultimaAlternancia = agora;

    minimizado.value = !minimizado.value;
    if (!minimizado.value) {
        tam.value = { ...tamSalvo.value };
    } else {
        tamSalvo.value = { w: tam.value.w, h: tam.value.h };
    }
    limitar();
    emit('focar');
}

onMounted(() => {
    limitar();
    window.addEventListener('resize', limitar);
});
onBeforeUnmount(() => window.removeEventListener('resize', limitar));

type Modo = 'mover' | 'e' | 's' | 'se';
const modo = ref<Modo | null>(null);
let origem = { px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 };
let posPointerDown = { x: 0, y: 0 };
let ultimoPointerUp = 0;

function iniciar(e: PointerEvent, m: Modo) {
    modo.value = m;
    origem = { px: e.clientX, py: e.clientY, x: pos.value.x, y: pos.value.y, w: tam.value.w, h: tam.value.h };
    posPointerDown = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    emit('focar');
}
function mover(e: PointerEvent) {
    if (!modo.value) return;
    const dx = e.clientX - origem.px;
    const dy = e.clientY - origem.py;
    if (modo.value === 'mover') {
        pos.value = { x: origem.x + dx, y: origem.y + dy };
    } else {
        if (modo.value === 'e' || modo.value === 'se') tam.value.w = origem.w + dx;
        if (modo.value === 's' || modo.value === 'se') tam.value.h = origem.h + dy;
    }
    limitar();
}
function soltar(e: PointerEvent) {
    if (modo.value === 'mover') {
        const dist = Math.hypot(e.clientX - posPointerDown.x, e.clientY - posPointerDown.y);
        const agora = performance.now();
        if (dist < 6 && agora - ultimoPointerUp < 350) {
            alternarMinimizado();
            ultimoPointerUp = 0;
            modo.value = null;
            const alvo = e.currentTarget as HTMLElement;
            if (alvo.hasPointerCapture(e.pointerId)) alvo.releasePointerCapture(e.pointerId);
            return;
        }
        ultimoPointerUp = agora;
    }
    modo.value = null;
    const alvo = e.currentTarget as HTMLElement;
    if (alvo.hasPointerCapture(e.pointerId)) alvo.releasePointerCapture(e.pointerId);
}
</script>

<template>
    <section
        role="group"
        :aria-label="titulo"
        class="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-ouro-500/40 bg-preto-950 shadow-2xl shadow-black/60"
        :class="[modo ? '' : 'transition-[width,height] duration-150 ease-out', minimizado ? 'hover:border-ouro-400/70' : '']"
        :style="{
            left: pos.x + 'px',
            top: pos.y + 'px',
            width: (minimizado ? LARGURA_MINIMIZADA : tam.w) + 'px',
            height: (minimizado ? ALTURA_MINIMIZADA : tam.h) + 'px',
            zIndex: z,
        }"
        @pointerdown="emit('focar')"
    >
        <header
            class="flex h-9 shrink-0 cursor-grab touch-none select-none items-center justify-between gap-1.5 px-3 active:cursor-grabbing"
            :class="minimizado ? 'bg-preto-900/95' : 'border-b border-ouro-500/25 bg-preto-900'"
            :title="minimizado ? `${tituloExibicao} (duplo clique para expandir)` : 'Duplo clique para minimizar'"
            @dblclick="alternarMinimizado"
            @pointerdown="iniciar($event, 'mover')"
            @pointermove="mover"
            @pointerup="soltar"
            @pointercancel="soltar"
        >
            <h2 class="flex min-w-0 flex-1 items-center gap-2 truncate font-serif text-sm font-semibold text-ouro-100">
                <span v-if="cor" class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: cor }" />
                <span class="truncate">{{ tituloExibicao }}</span>
            </h2>
            <div class="flex shrink-0 items-center gap-0.5">
                <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded text-preto-300 hover:bg-preto-800 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    :aria-label="minimizado ? 'Expandir ficha' : 'Minimizar ficha'"
                    :title="minimizado ? 'Expandir ficha' : 'Minimizar ficha'"
                    @pointerdown.stop
                    @click.stop="alternarMinimizado"
                >
                    <component :is="minimizado ? Maximize2 : Minimize2" class="size-3.5" />
                </button>
                <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded text-preto-300 hover:bg-preto-800 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    aria-label="Fechar ficha"
                    title="Fechar ficha"
                    @pointerdown.stop
                    @click.stop="emit('fechar')"
                >
                    <X class="size-4" />
                </button>
            </div>
        </header>

        <div v-show="!minimizado" class="min-h-0 flex-1 overflow-hidden">
            <slot />
        </div>

        <!-- alças de redimensionar: direita, base e canto -->
        <template v-if="!minimizado">
            <div
                class="absolute bottom-0 right-0 top-9 w-1.5 cursor-ew-resize touch-none"
                @pointerdown="iniciar($event, 'e')"
                @pointermove="mover"
                @pointerup="soltar"
                @pointercancel="soltar"
            />
            <div
                class="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize touch-none"
                @pointerdown="iniciar($event, 's')"
                @pointermove="mover"
                @pointerup="soltar"
                @pointercancel="soltar"
            />
            <div
                class="absolute bottom-0 right-0 size-4 cursor-nwse-resize touch-none"
                aria-hidden="true"
                @pointerdown="iniciar($event, 'se')"
                @pointermove="mover"
                @pointerup="soltar"
                @pointercancel="soltar"
            >
                <svg viewBox="0 0 16 16" class="size-4 text-preto-500">
                    <path d="M14 6 6 14M14 10l-4 4M14 2 2 14" stroke="currentColor" stroke-width="1.2" fill="none" />
                </svg>
            </div>
        </template>
    </section>
</template>
