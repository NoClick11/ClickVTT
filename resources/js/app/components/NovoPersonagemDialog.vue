<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Jogador, Personagem } from '@/site/types';
import { computed, ref, watch } from 'vue';

/**
 * O mestre cria um personagem de dentro do jogo: nome, cor e quais jogadores o controlam (nenhum = NPC, só o mestre
 * controla). Quem salva é a mesa (`criar`); o diálogo só mostra o erro, se houver.
 */
const props = defineProps<{
    open: boolean;
    jogadores: Jogador[];
    criar: (dados: { nome: string; cor: string; jogadores: number[] }) => Promise<Personagem>;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; criado: [Personagem] }>();

const CORES = ['#d4a843', '#dc2626', '#ea580c', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777'];
const nome = ref('');
const cor = ref(CORES[0]);
const marcados = ref<number[]>([]);
const erro = ref('');
const ocupado = ref(false);
const candidatos = computed(() => props.jogadores.filter((j) => j.papel === 'jogador'));

watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        nome.value = '';
        cor.value = CORES[Math.floor(Math.random() * CORES.length)];
        marcados.value = [];
        erro.value = '';
        ocupado.value = false;
    },
    { immediate: true },
);

const alternar = (id: number, on: boolean) => (marcados.value = on ? [...new Set([...marcados.value, id])] : marcados.value.filter((x) => x !== id));

async function enviar() {
    erro.value = '';
    if (!nome.value.trim()) return (erro.value = 'Dê um nome ao personagem.');
    ocupado.value = true;
    try {
        const personagem = await props.criar({ nome: nome.value.trim(), cor: cor.value, jogadores: marcados.value });
        emit('criado', personagem);
        emit('update:open', false);
    } catch (e) {
        erro.value = e instanceof Error ? e.message : 'Não foi possível criar o personagem.';
    } finally {
        ocupado.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Novo personagem</DialogTitle>
                <DialogDescription
                    >A ficha nasce com os valores padrão do sistema e abre em seguida. Quem você marcar controla o personagem; sem ninguém marcado, é
                    um NPC e só você o controla.</DialogDescription
                >
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="enviar">
                <label class="grid gap-1.5 text-sm">
                    <span class="font-medium">Nome</span>
                    <input
                        v-model="nome"
                        type="text"
                        maxlength="60"
                        autofocus
                        required
                        aria-label="Nome do personagem"
                        class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                    />
                </label>
                <fieldset class="grid gap-1.5">
                    <legend class="mb-1 text-sm font-medium">Cor</legend>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="c in CORES"
                            :key="c"
                            type="button"
                            class="size-7 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="cor === c ? 'scale-110 border-white' : 'border-transparent opacity-80 hover:opacity-100'"
                            :style="{ backgroundColor: c }"
                            :aria-label="`Cor ${c}`"
                            :aria-pressed="cor === c"
                            @click="cor = c"
                        />
                    </div>
                </fieldset>
                <fieldset class="grid gap-1.5">
                    <legend class="mb-1 text-sm font-medium">Jogadores deste personagem</legend>
                    <p v-if="!candidatos.length" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Nenhum jogador nesta mesa ainda: o personagem será um NPC. Você pode atribuir jogadores depois.
                    </p>
                    <label
                        v-for="j in candidatos"
                        :key="j.id"
                        class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:border-ouro-500/50"
                    >
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="marcados.includes(j.id)"
                            @change="alternar(j.id, ($event.target as HTMLInputElement).checked)"
                        />
                        <span class="size-3 rounded-full" :style="{ backgroundColor: j.cor }" />
                        <span class="text-sm">{{ j.nome }}</span>
                    </label>
                </fieldset>
                <p v-if="erro" role="alert" class="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{{ erro }}</p>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="ocupado">Criar personagem</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
