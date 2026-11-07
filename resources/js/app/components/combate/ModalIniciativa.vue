<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dices } from 'lucide-vue-next';
import type { ItemTurno } from '../../nucleo/combate/estado';

/**
 * Aviso que o jogador recebe quando o mestre inicia o combate: um botão por personagem dele que ainda não rolou a
 * iniciativa. A rolagem é do servidor (d20 + bônus da ficha); fecha sozinho quando todos os dele rolam.
 */
defineProps<{ itens: ItemTurno[]; ocupado: boolean }>();
const emit = defineEmits<{ rolar: [itemId: string] }>();
</script>

<template>
    <Dialog :open="itens.length > 0">
        <DialogContent class="sm:max-w-md" @interact-outside.prevent @escape-key-down.prevent>
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Rolar iniciativa</DialogTitle>
                <DialogDescription>O mestre iniciou o combate. Role a iniciativa para entrar na ordem dos turnos.</DialogDescription>
            </DialogHeader>
            <ul class="grid gap-2">
                <li v-for="i in itens" :key="i.id" class="flex items-center gap-3 rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                    <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: i.cor ?? '#ecc96c' }" aria-hidden="true" />
                    <span class="min-w-0 flex-1 truncate font-semibold">{{ i.nome }}</span>
                    <Button type="button" :disabled="ocupado" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="emit('rolar', i.id)">
                        <Dices class="size-4" /> Rolar
                    </Button>
                </li>
            </ul>
        </DialogContent>
    </Dialog>
</template>
