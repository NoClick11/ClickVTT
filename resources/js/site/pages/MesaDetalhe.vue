<script setup lang="ts">
import { Button } from '@/components/ui/button';
import ConviteDialog from '@/site/components/ConviteDialog.vue';
import GameIcon from '@/site/components/GameIcon.vue';
import JogadorDialog from '@/site/components/JogadorDialog.vue';
import PersonagemDialog from '@/site/components/PersonagemDialog.vue';
import SiteHeader from '@/site/components/SiteHeader.vue';
import { PAPEIS, type Jogador, type Personagem, type Sistema } from '@/site/types';
import { Head, Link, router } from '@inertiajs/vue3';
import { ArrowLeft, Crown, KeyRound, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-vue-next';
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
const props = defineProps<{ mesa: MesaDetalhe; jogadores: Jogador[]; personagens: Personagem[] }>();

const convite = ref(false);
const excluindo = ref<string | null>(null);

// Jogadores (quem entra pelo convite)
const jogadorAberto = ref(false);
const jogadorSelecionado = ref<Jogador | null>(null);
function novoJogador() {
    jogadorSelecionado.value = null;
    jogadorAberto.value = true;
}
function editarJogador(j: Jogador) {
    jogadorSelecionado.value = j;
    jogadorAberto.value = true;
}
function excluirJogador(j: Jogador) {
    router.delete(route('jogadores.destroy', [props.mesa.id, j.id]), { preserveScroll: true, onFinish: () => (excluindo.value = null) });
}

// Personagens (fichas) e os jogadores de cada um
const personagemAberto = ref(false);
const personagemSelecionado = ref<Personagem | null>(null);
function novoPersonagem() {
    personagemSelecionado.value = null;
    personagemAberto.value = true;
}
function editarPersonagem(p: Personagem) {
    personagemSelecionado.value = p;
    personagemAberto.value = true;
}
function excluirPersonagem(p: Personagem) {
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

        <main class="mx-auto grid max-w-5xl gap-12 px-4 py-8">
            <!-- Jogadores: quem entra pelo link de convite -->
            <section aria-labelledby="titulo-jogadores">
                <div class="mb-5 flex items-center justify-between">
                    <h2 id="titulo-jogadores" class="font-serif text-2xl text-ouro-50">Jogadores</h2>
                    <Button variant="outline" class="border-ouro-500/40" @click="novoJogador"><Plus class="size-4" /> Novo jogador</Button>
                </div>
                <ul v-if="jogadores.length" class="grid gap-3 sm:grid-cols-2">
                    <li v-for="j in jogadores" :key="j.id" class="flex items-center gap-3 rounded-lg border border-ouro-500/20 bg-preto-900/80 p-3">
                        <div class="flex size-11 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold text-preto-950" :style="{ backgroundColor: j.cor }">{{ j.nome.slice(0, 1).toUpperCase() }}</div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-medium text-ouro-50">{{ j.nome }}</p>
                            <p class="flex items-center gap-3 text-xs text-preto-300">
                                <span class="flex items-center gap-1"><Crown v-if="j.papel === 'mestre'" class="size-3 text-ouro-400" />{{ PAPEIS[j.papel] }}</span>
                                <span class="flex items-center gap-1" :class="j.tem_senha ? 'text-ouro-300' : 'text-preto-400'"><KeyRound class="size-3" />{{ j.tem_senha ? 'com senha' : 'sem senha' }}</span>
                            </p>
                        </div>
                        <template v-if="excluindo !== `j${j.id}`">
                            <Button size="icon" variant="ghost" aria-label="Editar jogador" @click="editarJogador(j)"><Pencil class="size-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Excluir jogador" @click="excluindo = `j${j.id}`"><Trash2 class="size-4 text-red-400" /></Button>
                        </template>
                        <template v-else>
                            <Button size="sm" variant="destructive" @click="excluirJogador(j)">Excluir</Button>
                            <Button size="sm" variant="ghost" @click="excluindo = null">Cancelar</Button>
                        </template>
                    </li>
                </ul>
                <div v-else class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ouro-500/30 bg-preto-900/50 px-6 py-12 text-center">
                    <GameIcon name="crown" class="!size-12 text-ouro-500/70" />
                    <p class="text-sm text-preto-300">Nenhum jogador ainda. Crie o mestre e os jogadores, cada um com sua senha.</p>
                    <Button class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="novoJogador"><Plus class="size-4" /> Novo jogador</Button>
                </div>
            </section>

            <!-- Personagens: fichas, com os jogadores de cada um -->
            <section aria-labelledby="titulo-personagens">
                <div class="mb-5 flex items-center justify-between">
                    <h2 id="titulo-personagens" class="font-serif text-2xl text-ouro-50">Personagens</h2>
                    <Button variant="outline" class="border-ouro-500/40" @click="novoPersonagem"><Plus class="size-4" /> Novo personagem</Button>
                </div>
                <ul v-if="personagens.length" class="grid gap-3 sm:grid-cols-2">
                    <li v-for="p in personagens" :key="p.id" class="flex items-center gap-3 rounded-lg border border-ouro-500/20 bg-preto-900/80 p-3">
                        <div class="flex size-11 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold text-preto-950" :style="{ backgroundColor: p.cor }">{{ p.nome.slice(0, 1).toUpperCase() }}</div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-medium text-ouro-50">{{ p.nome }}</p>
                            <p class="flex flex-wrap items-center gap-1 text-xs text-preto-300">
                                <Users class="size-3" />
                                <template v-if="p.jogadores.length"><span v-for="j in p.jogadores" :key="j.id" class="rounded-full border border-preto-700 px-1.5" :style="{ color: j.cor }">{{ j.nome }}</span></template>
                                <span v-else class="text-preto-400">sem jogador (NPC do mestre)</span>
                            </p>
                        </div>
                        <template v-if="excluindo !== `p${p.id}`">
                            <Button size="icon" variant="ghost" aria-label="Editar personagem" @click="editarPersonagem(p)"><Pencil class="size-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Excluir personagem" @click="excluindo = `p${p.id}`"><Trash2 class="size-4 text-red-400" /></Button>
                        </template>
                        <template v-else>
                            <Button size="sm" variant="destructive" @click="excluirPersonagem(p)">Excluir</Button>
                            <Button size="sm" variant="ghost" @click="excluindo = null">Cancelar</Button>
                        </template>
                    </li>
                </ul>
                <div v-else class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ouro-500/30 bg-preto-900/50 px-6 py-12 text-center">
                    <GameIcon name="castle" class="!size-12 text-ouro-500/70" />
                    <p class="text-sm text-preto-300">Nenhum personagem ainda. Crie as fichas e escolha quais jogadores controlam cada uma.</p>
                    <Button class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="novoPersonagem"><Plus class="size-4" /> Novo personagem</Button>
                </div>
            </section>
        </main>

        <JogadorDialog v-model:open="jogadorAberto" :mesa-id="mesa.id" :jogador="jogadorSelecionado" />
        <PersonagemDialog v-model:open="personagemAberto" :mesa-id="mesa.id" :personagem="personagemSelecionado" :jogadores="jogadores" />
        <ConviteDialog v-model:open="convite" :mesa-id="mesa.id" :url="mesa.convite_url" />
    </div>
</template>
