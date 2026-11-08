<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-vue-next';

/**
 * Configurações da mesa (só o mestre): regras do combate e o que os jogadores podem fazer. Só mostra e emite; quem fala com o
 * servidor é a mesa.
 */
type Liberacao = 'descanso_curto' | 'descanso_longo' | 'subir_nivel';
defineProps<{
    /** Fogo amigo da mesa. */
    fogoAmigo: boolean;
    /** O que o mestre liberou aos jogadores. */
    liberacoes: Record<Liberacao, boolean>;
}>();
defineEmits<{
    fogoAmigo: [ligado: boolean];
    liberacao: [chave: Liberacao, ligado: boolean];
    distribuirXp: [];
}>();

const OPCOES: { chave: Liberacao; rotulo: string; dica: string }[] = [
    { chave: 'descanso_curto', rotulo: 'Descanso curto', dica: 'Enquanto travado, os jogadores não conseguem fazer o descanso curto.' },
    { chave: 'descanso_longo', rotulo: 'Descanso longo', dica: 'Enquanto travado, os jogadores não conseguem fazer o descanso longo.' },
    { chave: 'subir_nivel', rotulo: 'Subir de nível', dica: 'Além do XP no máximo do nível, o jogador só sobe quando você libera.' },
];
const linha = 'flex cursor-pointer items-center gap-2 rounded-md border border-preto-700 bg-preto-900/60 px-2.5 py-2 text-xs text-preto-300';
const titulo = 'mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-preto-400';
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm text-preto-100">
        <section class="mb-4" aria-label="Combate">
            <h3 :class="titulo">Combate</h3>
            <label :class="linha" title="Desligado: jogador só acerta NPC (não aliado) e NPC só acerta jogador. Ligado: todos podem se acertar.">
                <input
                    type="checkbox"
                    class="size-3.5 accent-ouro-500"
                    :checked="fogoAmigo"
                    aria-label="Fogo amigo"
                    @change="$emit('fogoAmigo', ($event.target as HTMLInputElement).checked)"
                />
                Fogo amigo
                <span class="ml-auto" :class="fogoAmigo ? 'text-red-300' : 'text-preto-500'">{{ fogoAmigo ? 'ligado' : 'desligado' }}</span>
            </label>
        </section>

        <section class="mb-4" aria-label="Liberar aos jogadores">
            <h3 :class="titulo">Liberar aos jogadores</h3>
            <div class="grid gap-1.5">
                <label v-for="o in OPCOES" :key="o.chave" :class="linha" :title="o.dica">
                    <input
                        type="checkbox"
                        class="size-3.5 accent-ouro-500"
                        :checked="liberacoes[o.chave]"
                        :aria-label="`Liberar ${o.rotulo.toLowerCase()}`"
                        @change="$emit('liberacao', o.chave, ($event.target as HTMLInputElement).checked)"
                    />
                    {{ o.rotulo }}
                    <span class="ml-auto" :class="liberacoes[o.chave] ? 'text-emerald-300' : 'text-preto-500'">{{
                        liberacoes[o.chave] ? 'liberado' : 'travado'
                    }}</span>
                </label>
            </div>
        </section>

        <section aria-label="Experiência">
            <h3 :class="titulo">Experiência</h3>
            <Button
                type="button"
                variant="outline"
                class="h-9 w-full gap-1.5 border-ouro-500/40 text-xs text-ouro-200"
                @click="$emit('distribuirXp')"
            >
                <Star class="size-4" /> Distribuir XP
            </Button>
        </section>
    </div>
</template>
