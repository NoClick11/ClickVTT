<script setup lang="ts">
import { Calendar, ChevronDown, Clock, Minus, Moon, Plus, Sun, Sunrise, Sunset } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { adicionarTempo, formatarHora, periodoDoDia, rotuloPeriodo, type TempoMesa } from '../nucleo/tempo/tempo';

const props = defineProps<{
    tempo: TempoMesa;
    mestre: boolean;
}>();

const emit = defineEmits<{
    atualizar: [tempo: TempoMesa];
}>();

const aberto = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

// Estado animado para interpolação contínua dos números passando aumentando/diminuindo
const tempoAnimado = ref<TempoMesa>({ ...props.tempo });
let idAnimacao: number | null = null;

function cancelarAnimacao() {
    if (idAnimacao !== null) {
        cancelAnimationFrame(idAnimacao);
        idAnimacao = null;
    }
}

watch(
    () => props.tempo,
    (novo, antigo) => {
        if (!antigo) {
            tempoAnimado.value = { ...novo };
            return;
        }

        // Calcula minutos absolutos desde o dia 1 às 00:00
        const minutosDe = (tempoAnimado.value.dia - 1) * 1440 + tempoAnimado.value.hora * 60 + tempoAnimado.value.minuto;
        const minutosPara = (novo.dia - 1) * 1440 + novo.hora * 60 + novo.minuto;
        const delta = minutosPara - minutosDe;

        if (delta === 0) {
            tempoAnimado.value = { ...novo };
            return;
        }

        cancelarAnimacao();

        const inicio = performance.now();
        // Duração suave e cadenciada para acompanhar os números passando com clareza (850ms a 1500ms)
        const duracao = Math.min(1500, Math.max(850, Math.abs(delta) * 1.4));

        const animar = (agora: number) => {
            const decorrido = agora - inicio;
            const t = Math.min(1, decorrido / duracao);
            // Easing suave (easeInOutCubic) para início gradual e término suave
            const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const atualMinutos = Math.round(minutosDe + delta * e);

            const totalDias = Math.floor(atualMinutos / 1440);
            let resto = atualMinutos % 1440;
            if (resto < 0) resto += 1440;

            tempoAnimado.value = {
                dia: Math.max(1, 1 + totalDias),
                hora: Math.floor(resto / 60),
                minuto: resto % 60,
            };

            if (t < 1) {
                idAnimacao = requestAnimationFrame(animar);
            } else {
                tempoAnimado.value = { ...novo };
                idAnimacao = null;
            }
        };

        idAnimacao = requestAnimationFrame(animar);
    },
    { deep: true },
);

const iconePeriodo = computed(() => {
    switch (periodoDoDia(tempoAnimado.value.hora)) {
        case 'manha':
            return Sunrise;
        case 'tarde':
            return Sun;
        case 'noite':
            return Sunset;
        case 'madrugada':
            return Moon;
    }
});

const corPeriodo = computed(() => {
    switch (periodoDoDia(tempoAnimado.value.hora)) {
        case 'manha':
            return 'text-amber-400';
        case 'tarde':
            return 'text-yellow-400';
        case 'noite':
            return 'text-orange-400';
        case 'madrugada':
            return 'text-sky-300';
    }
});

function alternarPainel() {
    if (!props.mestre) return;
    aberto.value = !aberto.value;
}

function somarMinutos(delta: number) {
    if (!props.mestre) return;
    emit('atualizar', adicionarTempo(props.tempo, delta));
}

function definirMomento(hora: number, minuto = 0) {
    if (!props.mestre) return;
    emit('atualizar', {
        dia: props.tempo.dia,
        hora,
        minuto,
    });
}

function mudarDia(delta: number) {
    if (!props.mestre) return;
    emit('atualizar', {
        ...props.tempo,
        dia: Math.max(1, props.tempo.dia + delta),
    });
}

function aoClicarFora(e: MouseEvent) {
    if (aberto.value && containerRef.value && !containerRef.value.contains(e.target as Node)) {
        aberto.value = false;
    }
}

onMounted(() => window.addEventListener('pointerdown', aoClicarFora));
onBeforeUnmount(() => {
    cancelarAnimacao();
    window.removeEventListener('pointerdown', aoClicarFora);
});
</script>

<template>
    <div ref="containerRef" class="relative inline-flex items-center">
        <!-- Botão / Indicador no topo -->
        <button
            type="button"
            :class="[
                'flex select-none items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                mestre
                    ? 'cursor-pointer border-ouro-500/30 bg-preto-900/80 text-ouro-100 shadow-sm hover:border-ouro-500/60 hover:bg-preto-900'
                    : 'cursor-default border-preto-700/40 bg-preto-950/70 text-preto-200',
            ]"
            :title="
                mestre
                    ? `Tempo da Mesa: Dia ${tempo.dia} · ${rotuloPeriodo(tempo.hora)} (${formatarHora(tempo.hora, tempo.minuto)}) — Clique para gerenciar`
                    : `Tempo da Mesa: Dia ${tempo.dia} · ${rotuloPeriodo(tempo.hora)} (${formatarHora(tempo.hora, tempo.minuto)})`
            "
            @click="alternarPainel"
        >
            <component :is="iconePeriodo" :class="['size-3.5 shrink-0 transition-colors', corPeriodo]" />
            <span class="font-mono font-semibold text-ouro-200">Dia {{ tempoAnimado.dia }}</span>
            <span class="text-preto-400">·</span>
            <span class="font-mono tabular-nums text-preto-100">{{ formatarHora(tempoAnimado.hora, tempoAnimado.minuto) }}</span>
            <ChevronDown v-if="mestre" class="size-3 text-preto-400 transition-transform duration-150" :class="{ 'rotate-180': aberto }" />
        </button>

        <!-- Painel Popover de Gestão de Tempo (Mestre apenas) -->
        <div
            v-if="mestre && aberto"
            class="absolute left-1/2 top-full z-50 mt-1.5 w-72 -translate-x-1/2 rounded-lg border border-ouro-500/40 bg-preto-950/95 p-3 text-preto-100 shadow-2xl backdrop-blur-md"
            @pointerdown.stop
        >
            <div class="mb-2.5 flex items-center justify-between border-b border-ouro-500/20 pb-2">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-ouro-300">
                    <Clock class="size-3.5" />
                    <span>Controle de Tempo</span>
                </div>
                <span class="text-[11px] font-medium" :class="corPeriodo">
                    {{ rotuloPeriodo(tempoAnimado.hora) }}
                </span>
            </div>

            <!-- Controle de Dias -->
            <div class="mb-3 flex items-center justify-between gap-2 rounded-md border border-preto-800 bg-preto-900/60 px-2.5 py-1.5">
                <div class="flex items-center gap-1.5 text-xs text-preto-300">
                    <Calendar class="size-3.5 text-ouro-400" />
                    <span class="font-medium">Dia:</span>
                </div>
                <div class="flex items-center gap-1">
                    <button
                        type="button"
                        class="flex size-6 items-center justify-center rounded bg-preto-800 text-preto-200 hover:bg-ouro-500/20 hover:text-ouro-200"
                        title="Dia anterior (-1)"
                        @click="mudarDia(-1)"
                    >
                        <Minus class="size-3" />
                    </button>
                    <span class="w-10 text-center font-mono text-xs font-bold tabular-nums text-ouro-100">
                        {{ tempoAnimado.dia }}
                    </span>
                    <button
                        type="button"
                        class="flex size-6 items-center justify-center rounded bg-preto-800 text-preto-200 hover:bg-ouro-500/20 hover:text-ouro-200"
                        title="Próximo dia (+1)"
                        @click="mudarDia(1)"
                    >
                        <Plus class="size-3" />
                    </button>
                </div>
            </div>

            <!-- Controle de Horas e Minutos -->
            <div class="mb-3 flex items-center justify-between gap-2 rounded-md border border-preto-800 bg-preto-900/60 px-2.5 py-1.5">
                <div class="flex items-center gap-1.5 text-xs text-preto-300">
                    <Clock class="size-3.5 text-ouro-400" />
                    <span class="font-medium">Horário:</span>
                </div>
                <div class="flex items-center gap-1">
                    <button
                        type="button"
                        class="flex size-6 items-center justify-center rounded bg-preto-800 text-preto-200 hover:bg-ouro-500/20 hover:text-ouro-200"
                        title="Voltar 1 hora (-1h)"
                        @click="somarMinutos(-60)"
                    >
                        <Minus class="size-3" />
                    </button>
                    <span class="w-14 text-center font-mono text-xs font-bold tabular-nums text-white">
                        {{ formatarHora(tempoAnimado.hora, tempoAnimado.minuto) }}
                    </span>
                    <button
                        type="button"
                        class="flex size-6 items-center justify-center rounded bg-preto-800 text-preto-200 hover:bg-ouro-500/20 hover:text-ouro-200"
                        title="Avançar 1 hora (+1h)"
                        @click="somarMinutos(60)"
                    >
                        <Plus class="size-3" />
                    </button>
                </div>
            </div>

            <!-- Passagem rápida de tempo -->
            <div class="mb-3">
                <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-preto-400">Passar tempo</div>
                <div class="grid grid-cols-4 gap-1">
                    <button
                        type="button"
                        class="rounded border border-preto-700 bg-preto-900 px-1 py-1 text-center font-mono text-[11px] font-semibold text-preto-200 hover:border-ouro-500/40 hover:bg-ouro-500/10 hover:text-ouro-100"
                        @click="somarMinutos(10)"
                    >
                        +10m
                    </button>
                    <button
                        type="button"
                        class="rounded border border-preto-700 bg-preto-900 px-1 py-1 text-center font-mono text-[11px] font-semibold text-preto-200 hover:border-ouro-500/40 hover:bg-ouro-500/10 hover:text-ouro-100"
                        @click="somarMinutos(30)"
                    >
                        +30m
                    </button>
                    <button
                        type="button"
                        class="rounded border border-preto-700 bg-preto-900 px-1 py-1 text-center font-mono text-[11px] font-semibold text-preto-200 hover:border-ouro-500/40 hover:bg-ouro-500/10 hover:text-ouro-100"
                        @click="somarMinutos(60)"
                    >
                        +1h
                    </button>
                    <button
                        type="button"
                        class="rounded border border-ouro-500/30 bg-ouro-500/10 px-1 py-1 text-center font-mono text-[11px] font-bold text-ouro-200 hover:bg-ouro-500/20"
                        title="Descanso longo / noite inteira (+8h)"
                        @click="somarMinutos(480)"
                    >
                        +8h
                    </button>
                </div>
            </div>

            <!-- Momentos do dia -->
            <div>
                <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-preto-400">Momentos do dia</div>
                <div class="grid grid-cols-2 gap-1 text-[11px]">
                    <button
                        type="button"
                        class="flex items-center gap-1.5 rounded border border-preto-700 bg-preto-900 px-2 py-1 text-preto-200 hover:border-ouro-500/40 hover:text-ouro-100"
                        @click="definirMomento(6, 0)"
                    >
                        <Sunrise class="size-3 text-amber-400" />
                        <span>Amanhecer (06h)</span>
                    </button>
                    <button
                        type="button"
                        class="flex items-center gap-1.5 rounded border border-preto-700 bg-preto-900 px-2 py-1 text-preto-200 hover:border-ouro-500/40 hover:text-ouro-100"
                        @click="definirMomento(12, 0)"
                    >
                        <Sun class="size-3 text-yellow-400" />
                        <span>Meio-dia (12h)</span>
                    </button>
                    <button
                        type="button"
                        class="flex items-center gap-1.5 rounded border border-preto-700 bg-preto-900 px-2 py-1 text-preto-200 hover:border-ouro-500/40 hover:text-ouro-100"
                        @click="definirMomento(18, 0)"
                    >
                        <Sunset class="size-3 text-orange-400" />
                        <span>Anoitecer (18h)</span>
                    </button>
                    <button
                        type="button"
                        class="flex items-center gap-1.5 rounded border border-preto-700 bg-preto-900 px-2 py-1 text-preto-200 hover:border-ouro-500/40 hover:text-ouro-100"
                        @click="definirMomento(0, 0)"
                    >
                        <Moon class="size-3 text-sky-300" />
                        <span>Meia-noite (00h)</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
