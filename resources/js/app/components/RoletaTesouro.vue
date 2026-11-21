<script setup lang="ts">
import {
    Apple,
    Ban,
    BookOpen,
    Cog,
    Coins,
    Compass,
    Crosshair,
    Disc3,
    FlaskConical,
    Gem,
    Grid3x3,
    Link,
    Phone,
    Shield,
    Sparkles,
    Sprout,
    Sword,
    Wine,
    Wrench,
    X,
} from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import type { CasaDaRoleta, RoletaDoTesouro } from '../tipos-mesa';

/**
 * Roleta do baú do tesouro, estilo abertura de caixa do CS: a faixa horizontal passa rápido sob a trava do meio, desacelera devagar e para na
 * casa sorteada. A faixa e o ponto da parada vêm prontos do servidor, então todos da mesa veem a mesma animação, não importa quem abriu.
 * Um "tic" a cada casa que passa pela trava; no fim, a casa vencedora brilha na cor da raridade.
 */
const props = defineProps<{ roleta: RoletaDoTesouro }>();
const emit = defineEmits<{ fim: [] }>();

/** Largura de cada casa (px) e a duração do giro; com movimento reduzido, o giro é curto. */
const LARGURA = 132;
const reduzido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const DURACAO = reduzido ? 1400 : 7800;

/** As cores de raridade do CS (consumer, mil-spec, restricted, classified, covert/ouro). */
const COR: Record<CasaDaRoleta['tier'], string> = {
    comum: '#b0c3d9',
    incomum: '#4b69ff',
    raro: '#8847ff',
    epico: '#d32ce6',
    lendario: '#e4ae39',
};
const NOME_TIER: Record<CasaDaRoleta['tier'], string> = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' };
const ICONE: Record<string, Component> = {
    nada: Ban,
    moeda: Coins,
    joia: Gem,
    garrafa: Wine,
    livro: BookOpen,
    semente: Sprout,
    kit: Wrench,
    dial: Disc3,
    veneno: FlaskConical,
    espada: Sword,
    bussola: Compass,
    caracol: Phone,
    algema: Link,
    rede: Grid3x3,
    fruta: Apple,
    engrenagem: Cog,
    municao: Crosshair,
    armadura: Shield,
};
const icone = (c: CasaDaRoleta) => ICONE[c.icone] ?? Sparkles;

const janela = ref<HTMLElement | null>(null);
const trilho = ref<HTMLElement | null>(null);
const parou = ref(false);
const resultado = computed(() => props.roleta.resultado);
const corDoResultado = computed(() => COR[resultado.value.tier]);

// --- som: um tic curto por casa e um acorde no fim (Web Audio; se o navegador bloquear, segue sem som) ---------------------------
let audio: AudioContext | null = null;
function somar(freq: number, duracao: number, volume: number, tipo: OscillatorType = 'square', quando = 0) {
    try {
        audio ??= new AudioContext();
        if (audio.state === 'suspended') void audio.resume();
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = tipo;
        o.frequency.value = freq;
        const t = audio.currentTime + quando;
        g.gain.setValueAtTime(volume, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + duracao + 0.02);
    } catch {
        // sem áudio: só a animação
    }
}
const tic = () => somar(1900, 0.035, 0.035);
function fanfarra(tier: CasaDaRoleta['tier']) {
    const notas = { comum: [392], incomum: [440, 554], raro: [440, 554, 659], epico: [523, 659, 784], lendario: [523, 659, 784, 1047] }[tier];
    notas.forEach((f, i) => somar(f, 0.5, 0.06, 'triangle', i * 0.09));
}

// --- giro ---------------------------------------------------------------------------------------------------------------------------
let animacao: Animation | null = null;
let quadro = 0;
let fechar: ReturnType<typeof setTimeout> | undefined;

/** O deslocamento atual do trilho (px), lido da animação em andamento. */
function posicaoAtual(): number {
    if (!trilho.value) return 0;
    const m = new DOMMatrixReadOnly(getComputedStyle(trilho.value).transform);

    return m.m41;
}

onMounted(async () => {
    await nextTick();
    const meio = (janela.value?.clientWidth ?? 600) / 2;
    // a trava (meio da janela) termina sobre a casa `alvo`, no ponto `offset` dela (o mesmo para todos: vem do servidor)
    const destino = meio - (props.roleta.alvo * LARGURA + props.roleta.offset * LARGURA);
    animacao =
        trilho.value?.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(${destino}px)` }], {
            duration: DURACAO,
            easing: 'cubic-bezier(0.08, 0.62, 0.12, 1)',
            fill: 'forwards',
        }) ?? null;
    let ultima = -1;
    const seguir = () => {
        const casa = Math.floor((meio - posicaoAtual()) / LARGURA);
        if (casa !== ultima) {
            if (ultima !== -1 && !reduzido) tic();
            ultima = casa;
        }
        if (!parou.value) quadro = requestAnimationFrame(seguir);
    };
    quadro = requestAnimationFrame(seguir);
    animacao?.finished
        .then(() => {
            parou.value = true;
            fanfarra(resultado.value.tier);
            fechar = setTimeout(() => emit('fim'), 6000);
        })
        .catch(() => undefined);
});

onBeforeUnmount(() => {
    cancelAnimationFrame(quadro);
    clearTimeout(fechar);
    animacao?.cancel();
    void audio?.close().catch(() => undefined);
});
</script>

<template>
    <div
        class="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-label="`${roleta.quem} abriu ${roleta.bau}`"
    >
        <section class="w-full max-w-3xl overflow-hidden rounded-xl border border-ouro-400/30 bg-preto-950 shadow-2xl shadow-black/60">
            <header class="flex items-center gap-2 border-b border-preto-800 px-4 py-2.5">
                <Sparkles class="size-4 shrink-0 text-ouro-300" aria-hidden="true" />
                <p class="min-w-0 flex-1 truncate text-sm text-preto-200">
                    <strong :style="{ color: roleta.cor ?? '#ecc96c' }">{{ roleta.quem }}</strong> abriu
                    <strong class="text-ouro-100">{{ roleta.bau }}</strong>
                </p>
                <button
                    v-if="parou"
                    type="button"
                    class="rounded p-1 text-preto-400 transition hover:bg-preto-800 hover:text-preto-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    aria-label="Fechar"
                    @click="emit('fim')"
                >
                    <X class="size-4" />
                </button>
            </header>

            <!-- a faixa: a trava fica no meio; as bordas somem num degradê -->
            <div ref="janela" class="relative h-40 overflow-hidden bg-gradient-to-b from-preto-900 to-preto-950">
                <div ref="trilho" class="absolute inset-y-0 left-0 flex will-change-transform">
                    <div
                        v-for="(c, i) in roleta.casas"
                        :key="i"
                        class="relative flex h-full shrink-0 items-center justify-center px-1 py-3"
                        :style="{ width: `${LARGURA}px` }"
                    >
                        <div
                            class="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-md border bg-preto-900 transition duration-500"
                            :class="parou && i === roleta.alvo ? 'scale-105' : parou ? 'opacity-40' : ''"
                            :style="{
                                borderColor: `${COR[c.tier]}55`,
                                backgroundImage: `radial-gradient(circle at 50% 35%, ${COR[c.tier]}33, transparent 70%)`,
                                boxShadow: parou && i === roleta.alvo ? `0 0 24px ${COR[c.tier]}aa, inset 0 0 18px ${COR[c.tier]}55` : undefined,
                            }"
                        >
                            <component :is="icone(c)" class="size-9" :style="{ color: COR[c.tier] }" aria-hidden="true" />
                            <p class="mt-2 line-clamp-2 px-1.5 text-center text-[11px] font-semibold leading-tight text-preto-100">{{ c.nome }}</p>
                            <span class="absolute inset-x-0 bottom-0 h-1" :style="{ backgroundColor: COR[c.tier] }" aria-hidden="true" />
                        </div>
                    </div>
                </div>
                <div class="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-preto-950 to-transparent" aria-hidden="true" />
                <div class="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-preto-950 to-transparent" aria-hidden="true" />
                <!-- a trava -->
                <div class="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2" aria-hidden="true">
                    <div class="mx-auto h-0 w-0 border-x-[9px] border-t-[11px] border-x-transparent border-t-ouro-300" />
                    <div class="mx-auto h-[calc(100%-22px)] w-0.5 bg-ouro-300 shadow-[0_0_10px_rgba(236,201,108,0.9)]" />
                    <div class="mx-auto h-0 w-0 border-x-[9px] border-b-[11px] border-x-transparent border-b-ouro-300" />
                </div>
            </div>

            <!-- o resultado, só depois que a roleta para -->
            <footer class="flex min-h-16 items-center justify-center px-4 py-3 text-center" aria-live="polite">
                <p v-if="!parou" class="animate-pulse text-xs uppercase tracking-[0.3em] text-preto-400">Girando…</p>
                <div v-else class="duration-300 animate-in fade-in zoom-in-95">
                    <p class="text-[11px] font-bold uppercase tracking-[0.25em]" :style="{ color: corDoResultado }">
                        {{ NOME_TIER[resultado.tier] }} · d100 = {{ resultado.d100 }}
                    </p>
                    <p class="mt-0.5 font-serif text-lg font-semibold text-preto-50">{{ resultado.texto }}</p>
                </div>
            </footer>
        </section>
    </div>
</template>
