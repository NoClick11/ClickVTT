<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Mensagem } from '../tipos-mesa';
import DadoIcone from './DadoIcone.vue';

const props = defineProps<{ mensagem: Mensagem }>();
const emit = defineEmits<{ fim: [] }>();

const d = props.mensagem.dados!;
const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const raiz = ref<HTMLElement | null>(null);
const dadosEl = ref<HTMLElement[]>([]);
const mostrados = ref<(number | string)[]>(d.resultados.map(() => '?'));
const terminou = ref(false);
const timers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];

const destaque = (v: number) => (d.faces === 20 && v === 20 ? 'critico' : d.faces === 20 && v === 1 ? 'falha' : null);

onMounted(async () => {
    await nextTick();
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    const n = d.resultados.length;
    const passo = 96;

    dadosEl.value.forEach((el, i) => {
        // Entra pela esquerda, quica pelo meio e para na linha central, levemente espalhado.
        const alvoX = (i - (n - 1) / 2) * passo;
        const alvoY = (i % 2 === 0 ? -10 : 18);
        const origemX = -(largura / 2) - 120;
        const origemY = -altura * 0.25 + i * 20;
        const giro = (360 * (2 + (i % 3))) * (i % 2 === 0 ? 1 : -1);
        const tempo = reduzir ? 1 : 1150 + i * 90;
        el.animate(
            [
                { transform: `translate(${origemX}px, ${origemY}px) rotate(0deg) scale(.7)`, opacity: 0 },
                { transform: `translate(${origemX * 0.35}px, ${alvoY - 120}px) rotate(${giro * 0.45}deg) scale(1.1)`, opacity: 1, offset: 0.35 },
                { transform: `translate(${alvoX * 0.7}px, ${alvoY}px) rotate(${giro * 0.8}deg) scale(.95)`, offset: 0.58 },
                { transform: `translate(${alvoX}px, ${alvoY - 40}px) rotate(${giro * 0.92}deg) scale(1.04)`, offset: 0.78 },
                { transform: `translate(${alvoX}px, ${alvoY}px) rotate(${giro}deg) scale(1)`, opacity: 1 },
            ],
            { duration: tempo, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
        );
        // Enquanto rola, o número "embaralha"; ao parar, mostra o resultado real.
        const faces = d.faces;
        const giroNumeros = setInterval(() => (mostrados.value[i] = 1 + Math.floor(Math.random() * faces)), 70);
        timers.push(giroNumeros);
        timers.push(setTimeout(() => {
            clearInterval(giroNumeros);
            mostrados.value[i] = d.resultados[i];
        }, tempo * 0.92));
    });

    const total = (reduzir ? 1 : 1150) + n * 90 + 200;
    timers.push(setTimeout(() => (terminou.value = true), total));
    timers.push(setTimeout(() => raiz.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }), total + 2300));
    timers.push(setTimeout(() => emit('fim'), total + 2800));
});

onBeforeUnmount(() => timers.forEach((t) => (clearTimeout(t as number), clearInterval(t as number))));
</script>

<template>
    <div ref="raiz" :data-mensagem-id="mensagem.id" class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center" aria-hidden="true">
        <div class="relative h-0 w-0">
            <div
                v-for="(_, i) in d.resultados"
                :key="i"
                :ref="(el) => { if (el) dadosEl[i] = el as HTMLElement; }"
                class="absolute -left-10 -top-10 size-20 drop-shadow-[0_8px_10px_rgba(0,0,0,0.6)]"
                style="opacity: 0"
            >
                <DadoIcone :dado="d.dado" :valor="mostrados[i]" :destaque="terminou ? destaque(d.resultados[i]) : null" />
            </div>
        </div>
        <div v-if="terminou" class="absolute mt-44 rounded-full border border-ouro-500/40 bg-preto-950/90 px-4 py-1.5 text-sm text-ouro-100 shadow-lg">
            <span :style="{ color: mensagem.autor?.cor }" class="font-semibold">{{ mensagem.autor?.nome ?? 'Alguém' }}</span>
            rolou {{ mensagem.texto }}
            <strong v-if="d.quantidade > 1" class="ml-1 text-ouro-300">= {{ d.total }}</strong>
        </div>
    </div>
</template>
