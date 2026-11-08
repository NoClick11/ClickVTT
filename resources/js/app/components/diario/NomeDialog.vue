<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ref, watch } from 'vue';

/** Pede só um nome (criar ou renomear uma pasta do diário). Quem salva é a mesa. */
const props = defineProps<{ open: boolean; titulo: string; inicial: string }>();
const emit = defineEmits<{ 'update:open': [boolean]; salvar: [nome: string] }>();

const nome = ref('');
watch(
    () => props.open,
    (aberto) => aberto && (nome.value = props.inicial),
    { immediate: true },
);
const enviar = () => {
    if (!nome.value.trim()) return;
    emit('salvar', nome.value.trim());
    emit('update:open', false);
};
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{ titulo }}</DialogTitle>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="enviar">
                <input
                    v-model="nome"
                    type="text"
                    maxlength="80"
                    required
                    autofocus
                    aria-label="Nome da pasta"
                    class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                />
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400">Salvar</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
