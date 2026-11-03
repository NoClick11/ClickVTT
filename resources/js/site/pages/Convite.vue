<script setup lang="ts">
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLogoIcon from '@/components/AppLogoIcon.vue';
import Campo from '@/site/components/Campo.vue';
import { PAPEIS, type Jogador } from '@/site/types';
import { Head, useForm } from '@inertiajs/vue3';
import { Crown, LoaderCircle } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
    token: string;
    mesa: { slug: string; nome: string; descricao: string | null; capa: string | null; tema_entrada: 'padrao' | 'minimo'; sistema: string };
    jogadores: Jogador[];
    jaEntrou: number[];
}>();

const form = useForm({ jogador_id: props.jogadores[0]?.id ?? (null as number | null), senha: '' });
const escolhido = computed(() => props.jogadores.find((p) => p.id === form.jogador_id));
const jaEntrou = computed(() => !!form.jogador_id && props.jaEntrou.includes(form.jogador_id));
const minimo = computed(() => props.mesa.tema_entrada === 'minimo');

const entrar = () => form.post(route('convite.entrar', props.token), { onFinish: () => form.reset('senha') });
</script>

<template>
    <Head :title="`Entrar em ${mesa.nome}`" />
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-preto-950 bg-cover bg-center p-4 text-preto-100" :style="mesa.capa ? { backgroundImage: `url(${mesa.capa})` } : {}">
        <div class="absolute inset-0 bg-preto-950/70" />
        <div class="relative w-full max-w-md rounded-xl border border-ouro-500/30 p-7 shadow-2xl" :class="minimo ? 'bg-transparent shadow-none border-transparent' : 'bg-preto-950/85 backdrop-blur'">
            <header class="mb-6 text-center">
                <AppLogoIcon class="mx-auto mb-3 size-10 text-ouro-400" />
                <p class="text-xs uppercase tracking-[0.25em] text-ouro-400">{{ mesa.sistema }}</p>
                <h1 class="mt-1 font-serif text-3xl font-semibold text-ouro-50">{{ mesa.nome }}</h1>
                <p v-if="mesa.descricao" class="mt-2 text-sm text-preto-300">{{ mesa.descricao }}</p>
            </header>

            <p v-if="!jogadores.length" class="rounded-md border border-dashed border-ouro-500/30 p-4 text-center text-sm text-preto-300">O mestre ainda não criou jogadores para esta mesa.</p>

            <form v-else class="grid gap-4" @submit.prevent="entrar">
                <Campo label="Jogador" for="c-pers">
                    <div class="grid gap-2" role="radiogroup" aria-label="Jogador">
                        <label
                            v-for="p in jogadores"
                            :key="p.id"
                            class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition"
                            :class="form.jogador_id === p.id ? 'border-ouro-400 bg-ouro-500/10' : 'border-preto-700 hover:border-ouro-500/50'"
                        >
                            <input v-model="form.jogador_id" type="radio" name="jogador" :value="p.id" class="sr-only" />
                            <span class="flex size-8 items-center justify-center rounded-full text-sm font-semibold text-preto-950" :style="{ backgroundColor: p.cor }">{{ p.nome.slice(0, 1).toUpperCase() }}</span>
                            <span class="flex-1 truncate">{{ p.nome }}</span>
                            <span class="flex items-center gap-1 text-xs text-preto-300"><Crown v-if="p.papel === 'mestre'" class="size-3 text-ouro-400" />{{ PAPEIS[p.papel] }}</span>
                        </label>
                    </div>
                    <InputError :message="form.errors.jogador_id" />
                </Campo>
                <p v-if="jaEntrou" class="rounded-md border border-ouro-500/30 bg-ouro-500/10 px-3 py-2 text-sm text-ouro-100">
                    {{ escolhido?.nome }} já entrou neste navegador (talvez em outra aba).
                    <a :href="route('jogo', [mesa.slug, form.jogador_id!])" class="font-semibold underline">Continuar</a>
                </p>
                <Campo v-if="escolhido?.tem_senha" label="Senha" for="c-senha">
                    <Input id="c-senha" v-model="form.senha" type="password" autocomplete="current-password" autofocus />
                    <InputError :message="form.errors.senha" />
                </Campo>
                <Button type="submit" size="lg" class="bg-ouro-500 font-semibold text-preto-950 hover:bg-ouro-400" :disabled="form.processing || !form.jogador_id">
                    <LoaderCircle v-if="form.processing" class="size-4 animate-spin" /> Entrar na mesa
                </Button>
            </form>
        </div>
    </div>
</template>
