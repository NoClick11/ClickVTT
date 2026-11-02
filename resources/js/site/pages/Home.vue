<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcluirMesaDialog from '@/site/components/ExcluirMesaDialog.vue';
import GameIcon from '@/site/components/GameIcon.vue';
import MesaCard from '@/site/components/MesaCard.vue';
import MesaDialog from '@/site/components/MesaDialog.vue';
import SiteHeader from '@/site/components/SiteHeader.vue';
import type { Mesa, Sistema } from '@/site/types';
import { Head, router } from '@inertiajs/vue3';
import { LayoutGrid, List, Plus, Search } from 'lucide-vue-next';
import { computed, ref } from 'vue';

const props = defineProps<{ mesas: Mesa[]; sistemas: Sistema[] }>();

const filtro = ref('');
const modo = ref<'tile' | 'lista'>('tile');
const formAberto = ref(false);
const excluirAberto = ref(false);
const selecionada = ref<Mesa | null>(null);

const visiveis = computed(() => props.mesas.filter((m) => `${m.nome} ${m.sistema.nome}`.toLowerCase().includes(filtro.value.toLowerCase())));

function nova() {
    selecionada.value = null;
    formAberto.value = true;
}
function editar(m: Mesa) {
    selecionada.value = m;
    formAberto.value = true;
}
function excluir(m: Mesa) {
    selecionada.value = m;
    excluirAberto.value = true;
}
const alternar = (rota: 'mesas.favoritar' | 'mesas.travar', m: Mesa) => router.post(route(rota, m.id), {}, { preserveScroll: true });
</script>

<template>
    <Head title="Minhas mesas" />
    <div class="min-h-screen bg-preto-950 text-preto-100">
        <SiteHeader />

        <section class="relative overflow-hidden border-b border-ouro-500/20">
            <div class="absolute inset-0 bg-cover bg-center opacity-40" style="background-image: url(/img/capas/capa-1.jpg)" />
            <div class="absolute inset-0 bg-gradient-to-t from-preto-950 via-preto-950/70 to-preto-950/30" />
            <div class="relative mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pb-8 pt-14">
                <div>
                    <p class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-ouro-400"><GameIcon name="scroll-unfurled" class="!size-4" /> Mesas de jogo</p>
                    <h1 class="mt-2 font-serif text-4xl font-semibold text-ouro-50 sm:text-5xl">Suas campanhas</h1>
                    <p class="mt-2 max-w-xl text-sm text-preto-300">Crie, edite e organize as mesas onde suas aventuras acontecem.</p>
                </div>
                <Button size="lg" class="bg-ouro-500 font-semibold text-preto-950 hover:bg-ouro-400" @click="nova"><Plus class="size-5" /> Criar mesa</Button>
            </div>
        </section>

        <main class="mx-auto max-w-7xl px-4 py-8">
            <div v-if="mesas.length" class="mb-6 flex flex-wrap items-center gap-2">
                <div class="relative min-w-52 flex-1 sm:max-w-xs">
                    <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-preto-500" />
                    <Input v-model="filtro" placeholder="Filtrar por nome ou sistema…" class="border-ouro-500/20 bg-preto-900 pl-9" />
                </div>
                <div class="ml-auto flex gap-1">
                    <Button size="icon" :variant="modo === 'tile' ? 'secondary' : 'ghost'" aria-label="Exibir em cards" @click="modo = 'tile'"><LayoutGrid class="size-4" /></Button>
                    <Button size="icon" :variant="modo === 'lista' ? 'secondary' : 'ghost'" aria-label="Exibir em lista" @click="modo = 'lista'"><List class="size-4" /></Button>
                </div>
            </div>

            <div v-if="visiveis.length" :class="modo === 'tile' ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-3'">
                <MesaCard
                    v-for="m in visiveis"
                    :key="m.id"
                    :mesa="m"
                    :modo="modo"
                    @editar="editar(m)"
                    @favoritar="alternar('mesas.favoritar', m)"
                    @travar="alternar('mesas.travar', m)"
                    @excluir="excluir(m)"
                />
            </div>

            <div v-else class="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-dashed border-ouro-500/30 bg-preto-900/50 px-6 py-16 text-center">
                <GameIcon name="dungeon-gate" class="!size-16 text-ouro-500/70" />
                <template v-if="mesas.length === 0">
                    <h2 class="font-serif text-xl text-ouro-50">Nenhuma mesa ainda</h2>
                    <p class="text-sm text-preto-400">Crie a primeira campanha para reunir seus jogadores.</p>
                    <Button class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="nova"><Plus class="size-4" /> Criar mesa</Button>
                </template>
                <p v-else class="text-sm text-preto-400">Nenhuma mesa corresponde ao filtro.</p>
            </div>
        </main>

        <MesaDialog v-model:open="formAberto" :mesa="selecionada" :sistemas="sistemas" />
        <ExcluirMesaDialog v-model:open="excluirAberto" :mesa="selecionada" />
    </div>
</template>
