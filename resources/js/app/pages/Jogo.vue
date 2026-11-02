<script setup lang="ts">
import AppLogoIcon from '@/components/AppLogoIcon.vue';
import { Button } from '@/components/ui/button';
import { PAPEIS, type Personagem } from '@/site/types';
import { Head, router } from '@inertiajs/vue3';

defineProps<{ mesa: { nome: string; capa: string | null }; personagem: Personagem; sairUrl: string }>();
</script>

<template>
    <Head :title="mesa.nome" />
    <div class="flex min-h-screen flex-col items-center justify-center gap-5 bg-preto-950 p-6 text-center text-preto-100">
        <AppLogoIcon class="size-14 text-ouro-400" />
        <h1 class="font-serif text-3xl text-ouro-50">{{ mesa.nome }}</h1>
        <p class="text-preto-300">
            Você entrou como <strong class="text-ouro-300">{{ personagem.nome }}</strong> ({{ PAPEIS[personagem.papel] }}).
        </p>
        <p class="max-w-sm text-sm text-preto-400">A mesa de jogo ainda está em construção. O acesso por convite já funciona.</p>
        <Button variant="outline" @click="router.post(sairUrl)">Sair da mesa</Button>
    </div>
</template>
