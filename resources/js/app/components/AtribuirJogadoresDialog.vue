<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Jogador, Personagem } from '@/site/types';
import { computed, ref, watch } from 'vue';

const props = defineProps<{ open: boolean; personagem: Personagem | null; jogadores: Jogador[] }>();
const emit = defineEmits<{ 'update:open': [boolean]; salvar: [personagemId: number, jogadores: number[]] }>();

const marcados = ref<number[]>([]);
const candidatos = computed(() => props.jogadores.filter((j) => j.papel === 'jogador'));

watch(
    () => [props.open, props.personagem] as const,
    ([aberto, p]) => {
        if (aberto && p) marcados.value = p.jogadores.map((j) => j.id);
    },
);

const alternar = (id: number, on: boolean) => (marcados.value = on ? [...new Set([...marcados.value, id])] : marcados.value.filter((x) => x !== id));
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Jogadores de {{ personagem?.nome }}</DialogTitle>
                <DialogDescription>Quem marcar poderá mover o token e jogar com este personagem. Sem ninguém, só o mestre o controla.</DialogDescription>
            </DialogHeader>
            <p v-if="!candidatos.length" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Nenhum jogador nesta mesa.</p>
            <div class="grid gap-1.5">
                <label v-for="j in candidatos" :key="j.id" class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:border-ouro-500/50">
                    <input type="checkbox" class="size-4 accent-ouro-500" :checked="marcados.includes(j.id)" @change="alternar(j.id, ($event.target as HTMLInputElement).checked)" />
                    <span class="size-3 rounded-full" :style="{ backgroundColor: j.cor }" />
                    <span class="text-sm">{{ j.nome }}</span>
                </label>
            </div>
            <div class="flex justify-end gap-2">
                <Button variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                <Button class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="personagem && emit('salvar', personagem.id, marcados)">Salvar</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
