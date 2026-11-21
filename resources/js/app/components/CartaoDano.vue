<script setup lang="ts">
import { Droplet, HeartPulse, Shield, ShieldAlert, Skull, Swords } from 'lucide-vue-next';
import { computed, type Component } from 'vue';
import type { Mensagem } from '../tipos-mesa';

/**
 * Card de dano no chat (tipo `dano`): o dano aplicado a um alvo (botão "Aplicar", zonas, hóspede...) e os resultados do Dano Brutal
 * (salvaguarda, redução dos PV máximos, morte, tratamento). Só mostra: quem decide e aplica é o servidor.
 */
const props = defineProps<{ mensagem: Mensagem }>();

type Variante = 'dano' | 'brutal' | 'brutal_morte' | 'brutal_evitou' | 'brutal_falhou' | 'tratamento';
const d = computed(
    () =>
        (props.mensagem.dados ?? {}) as unknown as {
            variante?: Variante;
            alvo?: string;
            final?: number;
            total?: number;
            tipo?: string | null;
            modo?: 'normal' | 'imune' | 'imune_metade' | 'resistido' | 'vulneravel';
            aviso?: string | null;
            origem?: string | null;
            pv_max?: number;
            severidade?: 'grave' | 'critico' | 'mortal' | null;
            cd?: number;
            salvaguarda?: number;
        },
);
const variante = computed<Variante>(() => d.value.variante ?? 'dano');

const SEVERIDADE: Record<string, string> = { grave: 'grave', critico: 'crítico', mortal: 'mortal' };
const MODO: Record<string, string> = {
    imune: 'imune: nenhum dano',
    imune_metade: 'invulnerável: o golpe causa metade',
    resistido: 'resistência: metade',
    vulneravel: 'vulnerável: dobro',
};

/** Ícone, cores, título e o número em destaque de cada variante. */
const visual = computed<{ icone: Component; borda: string; faixa: string; numero: string; titulo: string; rotuloNumero: string; valor: string }>(
    () => {
        const v = variante.value;
        const sev = d.value.severidade ? ` (${SEVERIDADE[d.value.severidade] ?? d.value.severidade})` : '';
        switch (v) {
            case 'brutal':
                return {
                    icone: Droplet,
                    borda: 'border-red-600/60',
                    faixa: 'bg-red-600',
                    numero: 'text-red-200',
                    titulo: `Dano Brutal aplicado${sev}`,
                    rotuloNumero: 'PV máx.',
                    valor: `−${d.value.final ?? 0}`,
                };
            case 'brutal_morte':
                return {
                    icone: Skull,
                    borda: 'border-red-700/70',
                    faixa: 'bg-red-800',
                    numero: 'text-red-100',
                    titulo: 'Morte pelo Dano Brutal',
                    rotuloNumero: 'PV máx.',
                    valor: '0',
                };
            case 'brutal_evitou':
                return {
                    icone: Shield,
                    borda: 'border-sky-500/50',
                    faixa: 'bg-sky-500',
                    numero: 'text-sky-200',
                    titulo: `Evitou o Dano Brutal${sev}`,
                    rotuloNumero: `CON CD ${d.value.cd ?? 16}`,
                    valor: String(d.value.salvaguarda ?? ''),
                };
            case 'brutal_falhou':
                return {
                    icone: ShieldAlert,
                    borda: 'border-amber-500/50',
                    faixa: 'bg-amber-500',
                    numero: 'text-amber-200',
                    titulo: `Falhou contra o Dano Brutal${sev}`,
                    rotuloNumero: `CON CD ${d.value.cd ?? 16}`,
                    valor: String(d.value.salvaguarda ?? ''),
                };
            case 'tratamento':
                return {
                    icone: HeartPulse,
                    borda: 'border-emerald-500/50',
                    faixa: 'bg-emerald-500',
                    numero: 'text-emerald-200',
                    titulo: 'Ferida brutal tratada',
                    rotuloNumero: 'PV máx.',
                    valor: `+${d.value.final ?? 0}`,
                };
            default:
                return {
                    icone: Swords,
                    borda: 'border-red-500/40',
                    faixa: 'bg-red-500',
                    numero: 'text-red-200',
                    titulo: d.value.origem ? d.value.origem : 'Dano aplicado',
                    rotuloNumero: 'dano',
                    valor: String(d.value.final ?? 0),
                };
        }
    },
);

/** A linha de baixo: o que aconteceu com o valor (defesa do tipo, reduções, PV máximos novos). */
const detalhe = computed(() => {
    const v = variante.value;
    if (v === 'brutal') return `PV máximos agora: ${d.value.pv_max ?? 0}. Só cura com tratamento médico.`;
    if (v === 'brutal_morte') return 'Os PV máximos chegaram a 0: morte instantânea.';
    if (v === 'brutal_evitou') return `Passou na Salvaguarda de Constituição (${d.value.salvaguarda}).`;
    if (v === 'brutal_falhou') return `Falhou na Salvaguarda de Constituição (${d.value.salvaguarda}). O mestre decide aplicar.`;
    if (v === 'tratamento') return `PV máximos restaurados para ${d.value.pv_max ?? 0}.`;
    const partes: string[] = [];
    const modo = d.value.modo && d.value.modo !== 'normal' ? MODO[d.value.modo] : '';
    if (modo) partes.push(`${modo} (${d.value.total ?? 0} rolado)`);
    if (d.value.aviso) partes.push(d.value.aviso);

    return partes.join(' · ');
});
</script>

<template>
    <article
        class="relative overflow-hidden rounded-lg border bg-gradient-to-br from-preto-900 via-preto-950 to-preto-950 shadow-md shadow-black/40"
        :class="visual.borda"
        :aria-label="`${visual.titulo}: ${d.alvo}`"
    >
        <span class="absolute inset-y-0 left-0 w-1" :class="visual.faixa" aria-hidden="true" />
        <div class="flex items-center gap-3 py-2 pl-3.5 pr-3">
            <component :is="visual.icone" class="size-5 shrink-0 text-preto-300" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <p class="truncate text-[11px] uppercase tracking-wider text-preto-400">{{ visual.titulo }}</p>
                <p class="truncate text-sm text-preto-100">
                    <strong class="text-white">{{ d.alvo }}</strong>
                    <span v-if="variante === 'dano' && d.tipo" class="ml-1 rounded bg-preto-800 px-1.5 py-px text-[10px] capitalize text-preto-300">{{
                        d.tipo
                    }}</span>
                </p>
                <p v-if="detalhe" class="mt-0.5 text-[11px] leading-snug text-preto-400">{{ detalhe }}</p>
            </div>
            <div class="shrink-0 text-right">
                <p class="font-serif text-2xl font-bold tabular-nums leading-none" :class="visual.numero">{{ visual.valor }}</p>
                <p class="mt-0.5 text-[10px] uppercase tracking-widest text-preto-500">{{ visual.rotuloNumero }}</p>
            </div>
        </div>
    </article>
</template>
