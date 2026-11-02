<script setup lang="ts">
import { Button } from '@/components/ui/button';
import ConviteDialog from '@/site/components/ConviteDialog.vue';
import GameIcon from '@/site/components/GameIcon.vue';
import PersonagemDialog from '@/site/components/PersonagemDialog.vue';
import SiteHeader from '@/site/components/SiteHeader.vue';
import { PAPEIS, type Personagem, type Sistema } from '@/site/types';
import { Head, Link, router } from '@inertiajs/vue3';
import { ArrowLeft, Crown, KeyRound, Pencil, Plus, Trash2, UserPlus } from 'lucide-vue-next';
import { ref } from 'vue';

interface MesaDetalhe {
    id: number;
    slug: string;
    nome: string;
    descricao: string | null;
    capa: string | null;
    sistema: Pick<Sistema, 'nome' | 'icone'>;
    convite_url: string;
}
const props = defineProps<{ mesa: MesaDetalhe; personagens: Personagem[] }>();

const convite = ref(false);
const formAberto = ref(false);
const selecionado = ref<Personagem | null>(null);
const excluindo = ref<number | null>(null);

function novo() {
    selecionado.value = null;
    formAberto.value = true;
}
function editar(p: Personagem) {
    selecionado.value = p;
    formAberto.value = true;
}
function excluir(p: Personagem) {
    router.delete(route('personagens.destroy', [props.mesa.id, p.id]), { preserveScroll: true, onFinish: () => (excluindo.value = null) });
}
</script>

<template>
    <Head :title="mesa.nome" />
    <div class="min-h-screen bg-preto-950 text-preto-100">
        <SiteHeader />

        <section class="relative overflow-hidden border-b border-ouro-500/20">
            <div class="absolute inset-0 bg-preto-900 bg-cover bg-center opacity-40" :style="mesa.capa ? { backgroundImage: `url(${mesa.capa})` } : {}" />
            <div class="absolute inset-0 bg-gradient-to-t from-preto-950 via-preto-950/70 to-preto-950/30" />
            <div class="relative mx-auto max-w-5xl px-4 pb-8 pt-8">
                <Link href="/" class="inline-flex items-center gap-1 text-sm text-preto-300 hover:text-ouro-300"><ArrowLeft class="size-4" /> Minhas mesas</Link>
                <div class="mt-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-ouro-400"><GameIcon :name="mesa.sistema.icone ?? 'dice-twenty-faces-twenty'" class="!size-4" /> {{ mesa.sistema.nome }}</p>
                        <h1 class="mt-2 font-serif text-4xl font-semibold text-ouro-50">{{ mesa.nome }}</h1>
                        <p v-if="mesa.descricao" class="mt-2 max-w-xl text-sm text-preto-300">{{ mesa.descricao }}</p>
                    </div>
                    <Button size="lg" class="bg-ouro-500 font-semibold text-preto-950 hover:bg-ouro-400" @click="convite = true"><UserPlus class="size-5" /> Convidar jogadores</Button>
                </div>
            </div>
        </section>

        <main class="mx-auto max-w-5xl px-4 py-8">
            <div class="mb-5 flex items-center justify-between">
                <h2 class="font-serif text-2xl text-ouro-50">Personagens</h2>
                <Button variant="outline" class="border-ouro-500/40" @click="novo"><Plus class="size-4" /> Novo personagem</Button>
            </div>

            <ul v-if="personagens.length" class="grid gap-3 sm:grid-cols-2">
                <li v-for="p in personagens" :key="p.id" class="flex items-center gap-3 rounded-lg border border-ouro-500/20 bg-preto-900/80 p-3">
                    <div class="flex size-11 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold text-preto-950" :style="{ backgroundColor: p.cor }">{{ p.nome.slice(0, 1).toUpperCase() }}</div>
                    <div class="min-w-0 flex-1">
                        <p class="truncate font-medium text-ouro-50">{{ p.nome }}</p>
                        <p class="flex items-center gap-3 text-xs text-preto-300">
                            <span class="flex items-center gap-1"><Crown v-if="p.papel === 'mestre'" class="size-3 text-ouro-400" />{{ PAPEIS[p.papel] }}</span>
                            <span class="flex items-center gap-1" :class="p.tem_senha ? 'text-ouro-300' : 'text-preto-400'"><KeyRound class="size-3" />{{ p.tem_senha ? 'com senha' : 'sem senha' }}</span>
                        </p>
                    </div>
                    <template v-if="excluindo !== p.id">
                        <Button size="icon" variant="ghost" aria-label="Editar personagem" @click="editar(p)"><Pencil class="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Excluir personagem" @click="excluindo = p.id"><Trash2 class="size-4 text-red-400" /></Button>
                    </template>
                    <template v-else>
                        <Button size="sm" variant="destructive" @click="excluir(p)">Excluir</Button>
                        <Button size="sm" variant="ghost" @click="excluindo = null">Cancelar</Button>
                    </template>
                </li>
            </ul>
            <div v-else class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ouro-500/30 bg-preto-900/50 px-6 py-14 text-center">
                <GameIcon name="crown" class="!size-12 text-ouro-500/70" />
                <p class="text-sm text-preto-300">Nenhum personagem ainda. Crie o personagem do mestre e os dos jogadores, cada um com sua senha.</p>
                <Button class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="novo"><Plus class="size-4" /> Novo personagem</Button>
            </div>
        </main>

        <PersonagemDialog v-model:open="formAberto" :mesa-id="mesa.id" :personagem="selecionado" />
        <ConviteDialog v-model:open="convite" :mesa-id="mesa.id" :url="mesa.convite_url" />
    </div>
</template>
