<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
import { computed } from 'vue';
import type { Mensagem } from '../tipos-mesa';

/**
 * Card da distribuição de XP no chat (tipo `xp`): o total, quanto coube a cada personagem e a barra até o próximo nível, com o aviso de
 * quem já pode subir (subir ainda depende do switch do mestre). Só mostra: quem soma o XP é o servidor.
 */
const props = defineProps<{ mensagem: Mensagem }>();

interface LinhaXp {
    id: number;
    nome: string;
    cor: string | null;
    nivel: number;
    xp: number;
    proximo: number | null;
    pronto: boolean;
}
const d = computed(() => (props.mensagem.dados ?? {}) as unknown as { total: number; por_cabeca: number; sobra: number; personagens: LinhaXp[] });

const fmt = (n: number) => n.toLocaleString('pt-BR');
/** Quanto da barra está cheio (0–100), do XP atual até o do próximo nível. */
const pct = (l: LinhaXp) => (l.proximo ? Math.max(0, Math.min(100, (l.xp / l.proximo) * 100)) : 100);
</script>

<template>
    <article
        class="relative overflow-hidden rounded-lg border border-ouro-400/40 bg-gradient-to-br from-ouro-950/40 via-preto-950 to-preto-950 shadow-md shadow-black/40"
        :aria-label="`Distribuição de XP: ${d.por_cabeca} para cada`"
    >
        <span class="absolute inset-y-0 left-0 w-1 bg-ouro-400" aria-hidden="true" />
        <div class="py-2.5 pl-3.5 pr-3">
            <header class="flex items-center gap-3">
                <Sparkles class="size-5 shrink-0 text-ouro-300" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                    <p class="text-[11px] uppercase tracking-wider text-preto-400">Experiência distribuída</p>
                    <p class="text-xs text-preto-300">
                        {{ fmt(d.total) }} XP entre {{ d.personagens?.length ?? 0 }}
                        <template v-if="d.sobra > 0"> · sobra {{ fmt(d.sobra) }}</template>
                    </p>
                </div>
                <div class="shrink-0 text-right">
                    <p class="font-serif text-2xl font-bold tabular-nums leading-none text-ouro-200">+{{ fmt(d.por_cabeca) }}</p>
                    <p class="mt-0.5 text-[10px] uppercase tracking-widest text-preto-500">para cada</p>
                </div>
            </header>

            <ul class="mt-2.5 grid gap-1.5 border-t border-preto-800/80 pt-2" aria-label="Personagens que receberam XP">
                <li v-for="l in d.personagens" :key="l.id" class="text-xs">
                    <div class="flex items-baseline justify-between gap-2">
                        <span class="truncate font-semibold" :style="{ color: l.cor ?? '#ecc96c' }">{{ l.nome }}</span>
                        <span class="shrink-0 tabular-nums text-preto-400">
                            <span class="text-preto-200">{{ fmt(l.xp) }}</span
                            ><template v-if="l.proximo"> / {{ fmt(l.proximo) }}</template> · nível {{ l.nivel }}
                        </span>
                    </div>
                    <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-preto-800" aria-hidden="true">
                        <div
                            class="h-full rounded-full transition-all"
                            :class="l.pronto ? 'bg-emerald-400' : 'bg-ouro-400'"
                            :style="{ width: `${pct(l)}%` }"
                        />
                    </div>
                    <p v-if="l.pronto" class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Pronto para subir de nível
                    </p>
                </li>
            </ul>
        </div>
    </article>
</template>
