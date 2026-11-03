<script setup lang="ts">
import AppLogoIcon from '@/components/AppLogoIcon.vue';
import { Button } from '@/components/ui/button';
import { PAPEIS, type Jogador, type Personagem } from '@/site/types';
import { BookOpen, Crown, LogOut } from 'lucide-vue-next';

defineProps<{ mesaNome: string; paginaNome: string; jogador: Jogador; ativo: Personagem | null; mestre: boolean }>();
defineEmits<{ paginas: []; sair: [] }>();
</script>

<template>
    <header class="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-ouro-500/20 bg-preto-950/90 px-3 backdrop-blur">
        <div class="flex min-w-0 items-center gap-2.5">
            <AppLogoIcon class="size-7 shrink-0 text-ouro-400" />
            <span class="truncate font-serif text-base font-semibold text-ouro-100">{{ mesaNome }}</span>
        </div>
        <div class="flex items-center gap-2">
            <Button v-if="mestre" size="sm" variant="outline" class="border-ouro-500/40 text-ouro-100" @click="$emit('paginas')">
                <BookOpen class="size-4" /> Páginas
                <span class="max-w-40 truncate text-xs text-preto-300">· {{ paginaNome }}</span>
            </Button>
            <span v-else class="max-w-48 truncate text-sm text-preto-300">{{ paginaNome }}</span>
        </div>
        <div class="flex items-center gap-2">
            <span class="flex items-center gap-1.5 text-sm text-preto-200">
                <span class="size-2.5 rounded-full" :style="{ backgroundColor: ativo?.cor ?? jogador.cor }" />
                {{ jogador.nome }}
                <span v-if="ativo" class="text-xs text-preto-400" title="Personagem ativo: chat e dados saem como ele">como <span :style="{ color: ativo.cor }">{{ ativo.nome }}</span></span>
                <Crown v-if="mestre" class="size-3.5 text-ouro-400" :aria-label="PAPEIS.mestre" />
            </span>
            <Button size="icon" variant="ghost" class="size-8" aria-label="Sair da mesa" @click="$emit('sair')"><LogOut class="size-4" /></Button>
        </div>
    </header>
</template>
