<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-vue-next';

defineProps<{ escala: number }>();
defineEmits<{ mais: []; menos: []; ajustar: [] }>();
</script>

<template>
    <div class="pointer-events-auto absolute bottom-4 right-3 z-10 flex items-center gap-1 rounded-lg border border-ouro-500/20 bg-preto-950/90 p-1 backdrop-blur">
        <Button size="icon" variant="ghost" class="size-8" aria-label="Diminuir zoom" @click="$emit('menos')"><ZoomOut class="size-4" /></Button>
        <span class="w-12 text-center text-xs tabular-nums text-preto-200">{{ Math.round(escala * 100) }}%</span>
        <Button size="icon" variant="ghost" class="size-8" aria-label="Aumentar zoom" @click="$emit('mais')"><ZoomIn class="size-4" /></Button>
        <Button size="icon" variant="ghost" class="size-8" aria-label="Ajustar à tela" @click="$emit('ajustar')"><Maximize class="size-4" /></Button>
    </div>
</template>
