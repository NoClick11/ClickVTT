<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/vue3';
import type { Mesa } from '../types';

const props = defineProps<{ open: boolean; mesa: Mesa | null }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const form = useForm({});

function excluir() {
    if (!props.mesa) return;
    form.delete(route('mesas.destroy', props.mesa.id), { preserveScroll: true, onSuccess: () => emit('update:open', false) });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Excluir mesa</DialogTitle>
                <DialogDescription>
                    Excluir <strong class="text-foreground">{{ mesa?.nome }}</strong>? Esta ação não pode ser desfeita.
                </DialogDescription>
            </DialogHeader>
            <div class="flex justify-end gap-2">
                <Button variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                <Button variant="destructive" :disabled="form.processing" @click="excluir">Excluir</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
