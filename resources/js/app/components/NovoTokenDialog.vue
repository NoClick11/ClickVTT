<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Campo from '@/site/components/Campo.vue';
import type { Personagem } from '@/site/types';
import { ref, watch } from 'vue';

const props = defineProps<{ open: boolean; personagens: Personagem[]; camadaNome: string }>();
const emit = defineEmits<{
    'update:open': [boolean];
    criar: [dados: { nome: string; personagem_id: number | null; cor: string; tamanho: number; arquivo: File | null }];
}>();

const personagemId = ref<number | null>(null);
const nome = ref('');
const tamanho = ref(1);
const arquivo = ref<File | null>(null);
const cor = ref('#d4a843');
const campo = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

watch(() => props.open, (aberto) => {
    if (!aberto) return;
    personagemId.value = null;
    nome.value = '';
    tamanho.value = 1;
    arquivo.value = null;
    cor.value = '#d4a843';
});
watch(personagemId, (id) => {
    const p = props.personagens.find((x) => x.id === id);
    if (p) {
        nome.value = p.nome;
        cor.value = p.cor;
    }
});

function criar() {
    emit('criar', { nome: nome.value.trim() || 'Token', personagem_id: personagemId.value, cor: cor.value, tamanho: tamanho.value, arquivo: arquivo.value });
    emit('update:open', false);
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Novo token</DialogTitle>
                <DialogDescription>Será colocado no centro da vista, na camada {{ camadaNome }}.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="criar">
                <Campo label="Personagem" for="t-pers" dica="Vincule a um personagem para os jogadores dele poderem mover o token.">
                    <select id="t-pers" v-model="personagemId" :class="campo">
                        <option :value="null">Token avulso (monstro, NPC…)</option>
                        <option v-for="p in personagens" :key="p.id" :value="p.id">{{ p.nome }}</option>
                    </select>
                </Campo>
                <Campo label="Nome" for="t-nome"><Input id="t-nome" v-model="nome" /></Campo>
                <div class="grid grid-cols-2 gap-3">
                    <Campo label="Tamanho (quadrados)" for="t-tam"><Input id="t-tam" v-model.number="tamanho" type="number" min="0.5" step="0.5" /></Campo>
                    <Campo label="Cor" for="t-cor"><Input id="t-cor" v-model="cor" type="color" class="h-9 p-1" /></Campo>
                </div>
                <Campo label="Imagem (opcional)" for="t-img" dica="PNG, JPG, WebP ou GIF. Sem imagem, o token mostra a inicial.">
                    <Input id="t-img" type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="(e: Event) => (arquivo = (e.target as HTMLInputElement).files?.[0] ?? null)" />
                </Campo>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400">Criar token</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
