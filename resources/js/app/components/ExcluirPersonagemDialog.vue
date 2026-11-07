<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Confirmação de excluir um personagem (ficha, tokens e lugar no combate somem; não dá para desfazer). Quem exclui é a mesa. */
defineProps<{ open: boolean; nome: string; ocupado: boolean }>();
const emit = defineEmits<{ 'update:open': [boolean]; confirmar: [] }>();
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Excluir {{ nome }}?</DialogTitle>
                <DialogDescription>
                    A ficha, os tokens em todas as páginas e o lugar no combate são apagados. Os itens da mesa não mudam. Não dá para desfazer.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2">
                <Button type="button" variant="outline" :disabled="ocupado" @click="emit('update:open', false)">Cancelar</Button>
                <Button type="button" variant="destructive" :disabled="ocupado" @click="emit('confirmar')">Excluir</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
