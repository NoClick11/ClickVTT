<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface AlvoCandidato {
    id: number;
    nome: string;
    imagem?: string | null;
    cor?: string;
    pvAtual?: number;
    pvMax?: number;
}

defineProps<{
    open: boolean;
    tecnicaNome: string;
    alvos: AlvoCandidato[];
}>();

const emit = defineEmits<{
    'update:open': [boolean];
    escolher: [number];
}>();
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Escolha o Alvo</DialogTitle>
                <DialogDescription>
                    A técnica <strong class="text-foreground">{{ tecnicaNome }}</strong> atinge um único alvo. Selecione quem deseja acertar:
                </DialogDescription>
            </DialogHeader>

            <div class="grid max-h-72 gap-2 overflow-y-auto py-2">
                <button
                    v-for="alvo in alvos"
                    :key="alvo.id"
                    type="button"
                    class="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-left transition hover:border-primary hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary"
                    @click="emit('escolher', alvo.id)"
                >
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-background text-sm font-bold shadow-sm"
                        :style="{ borderColor: alvo.cor ?? '#888' }"
                    >
                        <img v-if="alvo.imagem" :src="alvo.imagem" :alt="alvo.nome" class="h-full w-full object-cover" />
                        <span v-else :style="{ color: alvo.cor ?? '#fff' }">{{ alvo.nome.slice(0, 2).toUpperCase() }}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="truncate font-medium text-foreground">{{ alvo.nome }}</div>
                        <div v-if="alvo.pvMax" class="text-xs text-muted-foreground">PV: {{ alvo.pvAtual ?? alvo.pvMax }} / {{ alvo.pvMax }}</div>
                    </div>
                    <Button size="sm" variant="secondary" class="pointer-events-none shrink-0"> Escolher </Button>
                </button>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" @click="emit('update:open', false)">Cancelar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
