<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Personagem } from '@/site/types';
import { computed, ref, watch } from 'vue';

/**
 * O mestre divide um total de XP, em partes iguais, entre os personagens dos jogadores que escolher (2700 para 3 = 900 cada).
 * Quem salva é a mesa (`distribuir`); o diálogo só mostra a conta e o erro, se houver.
 */
const props = defineProps<{
    open: boolean;
    /** Só os personagens com jogador (NPC não recebe XP). */
    personagens: Personagem[];
    distribuir: (ids: number[], total: number) => Promise<{ por_cabeca: number; sobra: number }>;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const marcados = ref<number[]>([]);
const total = ref<number | null>(null);
const erro = ref('');
const ocupado = ref(false);
watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        marcados.value = props.personagens.map((p) => p.id);
        total.value = null;
        erro.value = '';
        ocupado.value = false;
    },
    { immediate: true },
);

const alternar = (id: number, on: boolean) => (marcados.value = on ? [...new Set([...marcados.value, id])] : marcados.value.filter((x) => x !== id));
const inteiro = computed(() => (total.value !== null && Number.isInteger(total.value) && total.value > 0 ? total.value : 0));
const porCabeca = computed(() => (marcados.value.length ? Math.floor(inteiro.value / marcados.value.length) : 0));
const sobra = computed(() => (marcados.value.length ? inteiro.value - porCabeca.value * marcados.value.length : 0));
const pode = computed(() => !ocupado.value && marcados.value.length > 0 && porCabeca.value >= 1);

async function enviar() {
    if (!pode.value) return;
    erro.value = '';
    ocupado.value = true;
    try {
        await props.distribuir(marcados.value, inteiro.value);
        emit('update:open', false);
    } catch (e) {
        erro.value = e instanceof Error ? e.message : 'Não foi possível distribuir o XP.';
    } finally {
        ocupado.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Distribuir XP</DialogTitle>
                <DialogDescription
                    >O total é dividido em partes iguais entre os personagens marcados. Os jogadores só veem o XP, não o editam.</DialogDescription
                >
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="enviar">
                <fieldset class="grid gap-1.5">
                    <legend class="mb-1 text-sm font-medium">Personagens</legend>
                    <p v-if="!personagens.length" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Nenhum personagem de jogador nesta mesa.
                    </p>
                    <label
                        v-for="p in personagens"
                        :key="p.id"
                        class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:border-ouro-500/50"
                    >
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="marcados.includes(p.id)"
                            @change="alternar(p.id, ($event.target as HTMLInputElement).checked)"
                        />
                        <span class="size-3 rounded-full" :style="{ backgroundColor: p.cor }" />
                        <span class="min-w-0 flex-1 truncate text-sm">{{ p.nome }}</span>
                        <span class="shrink-0 text-xs text-preto-400">{{ p.jogadores.map((j) => j.nome).join(', ') }}</span>
                    </label>
                </fieldset>
                <label class="grid gap-1.5 text-sm">
                    <span class="font-medium">XP total</span>
                    <input
                        v-model.number="total"
                        type="number"
                        min="1"
                        step="1"
                        inputmode="numeric"
                        placeholder="ex.: 2700"
                        aria-label="XP total a dividir"
                        class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                    />
                </label>
                <p class="text-sm" aria-live="polite">
                    <template v-if="porCabeca >= 1"
                        >Cada um recebe <strong class="text-ouro-300">{{ porCabeca.toLocaleString('pt-BR') }} XP</strong
                        ><span v-if="sobra" class="text-preto-400"> (sobram {{ sobra }}, que não são distribuídos)</span>.</template
                    >
                    <span v-else class="text-preto-400">Marque os personagens e informe um total inteiro.</span>
                </p>
                <p v-if="erro" role="alert" class="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{{ erro }}</p>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="!pode">Distribuir</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
