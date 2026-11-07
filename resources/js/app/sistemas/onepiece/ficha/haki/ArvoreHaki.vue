<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { DESENHOS, arestasDoTipo, formasDoTalento, talentoPorId, talentosDoTipo, type TalentoHaki, type TipoHaki } from '../../haki/dados';
import { podeComprar, type HakiFicha } from '../../haki/regras';

/**
 * Árvore de talentos de um tipo de Haki, desenhada em SVG a partir do livro: faixas Inexperiente / Treinado / Perito,
 * corrente à esquerda, nós com a estrela ☆ (Forma Dominada) e ★ (Forma Avançada) e o custo em PA. Mostra e emite: quem
 * compra e salva é `AbaHaki`. O nó comprado fica aceso e a corda entre dois talentos comprados também.
 */
const props = defineProps<{ tipo: TipoHaki; haki: HakiFicha; nivel: number; selecionado: string | null; bonus?: number; ajustar?: boolean }>();
const emit = defineEmits<{ selecionar: [id: string] }>();

const PALETA: Record<TipoHaki, { faixas: [string, string, string]; corda: string; cordaClara: string; destaque: string; texto: string }> = {
    armamento: { faixas: ['#dfe3e4', '#a9a3a7', '#6c7379'], corda: '#5b5e63', cordaClara: '#e6e6e6', destaque: '#f59e0b', texto: '#1f2937' },
    observacao: { faixas: ['#fde2e4', '#f19ea3', '#cc5b60'], corda: '#a61c1c', cordaClara: '#f4c7c7', destaque: '#facc15', texto: '#450a0a' },
    rei: { faixas: ['#f1e6fb', '#9c9cf0', '#5a6fd6'], corda: '#1d3b66', cordaClara: '#a9c1e8', destaque: '#facc15', texto: '#1e1b4b' },
};
const cor = computed(() => PALETA[props.tipo]);
const d = computed(() => DESENHOS[props.tipo]);
const talentos = computed(() => talentosDoTipo(props.tipo));
const arestas = computed(() => arestasDoTipo(props.tipo));
const zoom = ref(1);
/** Modo "ajustar" (modal): a árvore inteira cabe na área disponível (zoom 100% = cabe tudo); os botões ampliam e a área rola. */
const area = ref<HTMLElement | null>(null);
const caixa = ref({ w: 0, h: 0 });
let observador: ResizeObserver | null = null;
onMounted(() => {
    if (!props.ajustar || !area.value) return;
    observador = new ResizeObserver(([e]) => (caixa.value = { w: e.contentRect.width, h: e.contentRect.height }));
    observador.observe(area.value);
});
onBeforeUnmount(() => observador?.disconnect());
const larguraSvg = computed(() => {
    if (!props.ajustar || caixa.value.w <= 0) return Math.max(720, 1000) * zoom.value;
    const escala = Math.min((caixa.value.w - 4) / d.value.largura, (caixa.value.h - 4) / d.value.altura);

    return Math.max(280, Math.floor(d.value.largura * escala * zoom.value));
});

const formas = (id: string) => props.haki.talentos.find((t) => t.id === id)?.formas ?? (id === 'rei' && props.haki.rei ? 1 : 0);
const comprado = (id: string) => formas(id) >= 1;
const posDe = (id: string) => talentoPorId(id)!.pos;

/** bloqueado (não dá para comprar agora) ou disponível */
const estado = (t: TalentoHaki): 'comprado' | 'completo' | 'disponivel' | 'bloqueado' => {
    const n = formas(t.id);
    if (n >= formasDoTalento(t)) return 'completo';
    if (n >= 1 && !podeComprar(props.haki, props.nivel, t.id, props.bonus ?? 0).ok) return 'comprado';
    if (n >= 1) return 'comprado';
    return podeComprar(props.haki, props.nivel, t.id, props.bonus ?? 0).ok ? 'disponivel' : 'bloqueado';
};

const LARG = 134;
const ALT = 64;
function corda(de: string, para: string): string {
    const a = posDe(de);
    const b = posDe(para);
    const y1 = a.y + ALT / 2;
    const y2 = b.y - ALT / 2;
    const dy = Math.max(30, (y2 - y1) * 0.55);

    return `M ${a.x} ${y1} C ${a.x} ${y1 + dy}, ${b.x} ${y2 - dy}, ${b.x} ${y2}`;
}
const acesa = (de: string, para: string) => comprado(de) && comprado(para);

function linhas(nome: string): string[] {
    const p = nome.split(' ');
    if (p.length < 2 || nome.length <= 12) return [nome];
    let melhor = 1;
    let dif = Infinity;
    for (let i = 1; i < p.length; i++) {
        const x = p.slice(0, i).join(' ').length;
        const y = p.slice(i).join(' ').length;
        if (Math.abs(x - y) < dif) {
            dif = Math.abs(x - y);
            melhor = i;
        }
    }

    return [p.slice(0, melhor).join(' '), p.slice(melhor).join(' ')];
}
const poligono = (linha: [number, number][]) => [...linha, [d.value.largura, d.value.altura], [0, d.value.altura]].map((p) => p.join(',')).join(' ');
const yMedio = (a: number, b: number) => (a + b) / 2;
const CORRENTE_X: Record<TipoHaki, number> = { armamento: 270, observacao: 190, rei: 305 };
const estagios = computed(() => {
    const t = d.value.treinado[0][1];
    const p = d.value.perito[0][1];

    return [
        { nome: 'Inexperiente', y: yMedio(0, t) },
        { nome: 'Treinado', y: yMedio(t, p) },
        { nome: 'Perito', y: yMedio(p, d.value.altura) },
    ];
});
</script>

<template>
    <div class="rounded-lg border border-preto-700 bg-preto-950" :class="ajustar ? 'flex h-full min-h-0 flex-col' : ''">
        <div class="flex items-center justify-end gap-1 border-b border-preto-800 px-2 py-1 text-xs text-preto-400">
            <span>Zoom</span>
            <button
                type="button"
                class="rounded border border-preto-700 px-2 hover:text-ouro-200"
                aria-label="Diminuir o zoom"
                @click="zoom = Math.max(ajustar ? 0.4 : 0.6, zoom - 0.2)"
            >
                −
            </button>
            <button type="button" class="rounded border border-preto-700 px-2 hover:text-ouro-200" aria-label="Zoom normal" @click="zoom = 1">
                {{ Math.round(zoom * 100) }}%
            </button>
            <button
                type="button"
                class="rounded border border-preto-700 px-2 hover:text-ouro-200"
                aria-label="Aumentar o zoom"
                @click="zoom = Math.min(ajustar ? 3 : 2, zoom + 0.2)"
            >
                +
            </button>
        </div>
        <div ref="area" class="overflow-auto" :class="ajustar ? 'min-h-0 flex-1' : ''">
            <svg
                :viewBox="`0 0 ${d.largura} ${d.altura}`"
                :style="{ width: `${larguraSvg}px`, minWidth: ajustar ? undefined : '100%' }"
                class="mx-auto block"
                role="group"
                :aria-label="`Árvore de talentos do ${tipo}`"
            >
                <defs>
                    <filter :id="`rasgado-${tipo}`" x="-10%" y="-20%" width="120%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" result="ruido" />
                        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="7" />
                    </filter>
                    <filter :id="`brilho-${tipo}`" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="b" />
                        <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <!-- faixas de estágio -->
                <rect x="0" y="0" :width="d.largura" :height="d.altura" :fill="cor.faixas[0]" />
                <polygon :points="poligono(d.treinado)" :fill="cor.faixas[1]" />
                <polygon :points="poligono(d.perito)" :fill="cor.faixas[2]" />
                <!-- rótulos dos estágios e corrente -->
                <g :font-family="'Georgia, serif'" font-weight="700" :fill="cor.texto" text-anchor="middle" :font-size="26">
                    <text v-for="e in estagios" :key="e.nome" :x="CORRENTE_X[tipo] / 2" :y="e.y + 8">{{ e.nome }}</text>
                </g>
                <line
                    :x1="CORRENTE_X[tipo]"
                    y1="0"
                    :x2="CORRENTE_X[tipo]"
                    :y2="d.altura"
                    stroke="#111"
                    stroke-width="16"
                    stroke-dasharray="18 6"
                    stroke-linecap="round"
                />
                <line
                    :x1="CORRENTE_X[tipo]"
                    y1="0"
                    :x2="CORRENTE_X[tipo]"
                    :y2="d.altura"
                    stroke="#e5e5e5"
                    stroke-width="5"
                    stroke-dasharray="6 18"
                    stroke-linecap="round"
                />
                <!-- colunas -->
                <text
                    v-for="c in d.colunas"
                    :key="c.rotulo"
                    :x="c.x"
                    y="30"
                    text-anchor="middle"
                    font-family="Georgia, serif"
                    font-weight="700"
                    font-size="26"
                    :fill="cor.texto"
                >
                    {{ c.rotulo }}
                </text>

                <!-- cordas (pré-requisitos) -->
                <g fill="none" stroke-linecap="round">
                    <g v-for="a in arestas" :key="`${a.de}>${a.para}`">
                        <path
                            :d="corda(a.de, a.para)"
                            :stroke="acesa(a.de, a.para) ? cor.destaque : cor.corda"
                            :stroke-width="acesa(a.de, a.para) ? 11 : 9"
                            :filter="acesa(a.de, a.para) ? `url(#brilho-${tipo})` : undefined"
                        />
                        <path
                            :d="corda(a.de, a.para)"
                            :stroke="acesa(a.de, a.para) ? '#fff7d6' : cor.cordaClara"
                            stroke-width="5"
                            stroke-dasharray="4 9"
                        />
                    </g>
                </g>

                <!-- talentos -->
                <g
                    v-for="t in talentos"
                    :key="t.id"
                    :transform="`translate(${t.pos.x} ${t.pos.y})`"
                    class="cursor-pointer outline-none"
                    :opacity="estado(t) === 'bloqueado' ? 0.55 : 1"
                    tabindex="0"
                    role="button"
                    :aria-pressed="selecionado === t.id"
                    :aria-label="`${t.nome}, custo ${t.custo} PA, ${estado(t) === 'bloqueado' ? 'bloqueado' : comprado(t.id) ? 'comprado' : 'disponível'}`"
                    @click="emit('selecionar', t.id)"
                    @keydown.enter.prevent="emit('selecionar', t.id)"
                    @keydown.space.prevent="emit('selecionar', t.id)"
                >
                    <rect
                        :x="-LARG / 2 - 6"
                        :y="-ALT / 2 - 6"
                        :width="LARG + 12"
                        :height="ALT + 12"
                        rx="22"
                        :fill="selecionado === t.id ? '#fff' : 'transparent'"
                        :opacity="selecionado === t.id ? 0.55 : 0"
                    />
                    <rect
                        :x="-LARG / 2"
                        :y="-ALT / 2"
                        :width="LARG"
                        :height="ALT"
                        rx="18"
                        :fill="comprado(t.id) ? cor.destaque : '#fbfbfb'"
                        :stroke="comprado(t.id) ? '#fff' : cor.corda"
                        :stroke-width="comprado(t.id) ? 4 : 3"
                        :filter="`url(#rasgado-${tipo})`"
                    />
                    <text text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="16" fill="#111">
                        <tspan v-for="(l, i) in linhas(t.nome)" :key="i" x="0" :y="linhas(t.nome).length === 1 ? 2 : i * 18 - 6">{{ l }}</tspan>
                    </text>
                    <!-- estrelas: ☆ Forma Dominada, ★ Forma Avançada -->
                    <g font-size="20">
                        <text
                            v-if="t.dominada"
                            x="-62"
                            y="26"
                            text-anchor="middle"
                            :fill="formas(t.id) >= 2 ? '#b45309' : '#fff'"
                            stroke="#111"
                            stroke-width="1"
                        >
                            ★
                        </text>
                        <text
                            v-if="t.avancada"
                            x="-40"
                            y="26"
                            text-anchor="middle"
                            :fill="formas(t.id) >= 3 ? '#b45309' : '#111'"
                            stroke="#111"
                            stroke-width="1"
                        >
                            ★
                        </text>
                    </g>
                    <!-- custo -->
                    <circle cx="56" cy="24" r="16" :fill="estado(t) === 'disponivel' ? '#fde68a' : '#fff'" :stroke="cor.corda" stroke-width="3" />
                    <text x="56" y="30" text-anchor="middle" font-family="Georgia, serif" font-weight="800" font-size="19" fill="#111">
                        {{ t.custo === 0 ? '−' : t.custo }}
                    </text>
                </g>
            </svg>
        </div>
    </div>
</template>
