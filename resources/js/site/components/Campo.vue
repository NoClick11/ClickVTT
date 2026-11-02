<script setup lang="ts">
import { Label } from '@/components/ui/label';

defineProps<{ label: string; for?: string; obrigatorio?: boolean; dica?: string }>();
</script>

<template>
    <div class="grid gap-2">
        <Label :for="$props.for">{{ label }}<span v-if="obrigatorio" class="text-destructive"> *</span></Label>
        <slot />
        <p v-if="dica" class="text-xs text-muted-foreground">{{ dica }}</p>
    </div>
</template>
