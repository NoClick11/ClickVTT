<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronUp, Crosshair, Dices, Shield, Sword, Target, Zap } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import type { Atalho } from '../nucleo/sistemas/tipos';

/**
 * A barra de atalhos (as macros do Foundry): embaixo do mapa, um botão por ataque, técnica, salvaguarda, perícia ou teste do personagem
 * ativo. Um clique rola (Shift = vantagem, Ctrl = desvantagem); as teclas 1 a 9 e 0 usam os dez primeiros botões diretos.
 */
const props = defineProps<{ atalhos: Atalho[]; nome: string; cor: string }>();

/** Só os ataques ficam como botões diretos; os outros grupos (técnicas, salvaguardas, perícias, testes) são menus que abrem para cima. */
const DIRETOS = ['Ataques'];
const diretos = computed(() => props.atalhos.filter((a) => DIRETOS.includes(a.grupo)));
const menus = computed(() =>
    [...new Set(props.atalhos.filter((a) => !DIRETOS.includes(a.grupo)).map((a) => a.grupo))].map((g) => ({
        grupo: g,
        lista: props.atalhos.filter((a) => a.grupo === g),
    })),
);
const visiveis = diretos;

const icones: Record<Atalho['icone'], Component | null> = {
    espada: Sword,
    arco: null, // desenhado à mão (o conjunto de ícones não tem arco)
    'arma-de-fogo': Crosshair,
    tecnica: Zap,
    salvaguarda: Shield,
    pericia: Target,
    teste: Dices,
};

/** O atalho com janelinha de escolha (a munição da arma de fogo) aberto. */
const escolhendo = ref<Atalho | null>(null);
function usar(a: Atalho, e: MouseEvent | KeyboardEvent) {
    if (a.bloqueio) return;
    if (a.opcoes) escolhendo.value = a;
    else a.executar(e as MouseEvent);
}
function escolher(executar: (e: MouseEvent) => void, e: MouseEvent) {
    escolhendo.value = null;
    executar(e);
}

/** As teclas 1 a 9 e 0 (fora de campos de texto) disparam os dez primeiros botões diretos. */
function aoTeclar(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !/^[0-9]$/.test(e.key)) return;
    const alvo = e.target as HTMLElement | null;
    if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;
    const a = visiveis.value[e.key === '0' ? 9 : Number(e.key) - 1];
    if (!a) return;
    e.preventDefault();
    usar(a, e);
}
onMounted(() => window.addEventListener('keydown', aoTeclar));
onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
    <!-- Faixa de largura total (sem o encolhimento do left-50%): a barra centraliza, quebra em linhas e deixa os cantos livres -->
    <div v-if="atalhos.length" class="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4 lg:px-56">
        <div
            class="pointer-events-auto max-w-full rounded-md border border-black bg-black/50 p-1 shadow-xl backdrop-blur"
            role="toolbar"
            :aria-label="`Atalhos de ${nome}`"
        >
            <div class="flex flex-wrap items-stretch gap-0.5">
                <button
                    v-for="(a, i) in diretos"
                    :key="a.id"
                    type="button"
                    class="relative flex size-[3.4rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-sm border border-black bg-black/60 px-0.5 text-center shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-preto-300"
                    :class="a.bloqueio ? 'cursor-not-allowed opacity-40' : 'hover:border-preto-200 hover:bg-black/80 active:scale-95'"
                    :aria-disabled="!!a.bloqueio"
                    :title="`${a.rotulo}${a.detalhe ? ' — ' + a.detalhe : ''}${a.bloqueio ? ' (' + a.bloqueio + ')' : ' · Shift = vantagem, Ctrl = desvantagem'}`"
                    @click="usar(a, $event)"
                >
                    <svg
                        v-if="a.icone === 'arco'"
                        class="size-4 text-preto-200"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M6 3c9 3 9 15 0 18M6 3v18M6 12h15M17 8l4 4-4 4" />
                    </svg>
                    <component :is="icones[a.icone]" v-else class="size-4 text-preto-200" aria-hidden="true" />
                    <span class="w-full truncate text-[9px] font-semibold leading-none text-preto-200">{{ a.rotulo }}</span>
                    <span v-if="i < 10" class="absolute left-1 top-0.5 text-[9px] leading-none text-preto-400" aria-hidden="true">{{
                        (i + 1) % 10
                    }}</span>
                </button>
                <div v-if="diretos.length && menus.length" class="mx-1 w-px self-stretch bg-preto-700" aria-hidden="true" />
                <DropdownMenu v-for="m in menus" :key="m.grupo">
                    <DropdownMenuTrigger as-child>
                        <button
                            type="button"
                            class="relative flex size-[3.4rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-sm border border-black bg-black/60 px-0.5 text-center shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] transition hover:border-preto-200 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-preto-300 data-[state=open]:border-preto-200 data-[state=open]:bg-black/80"
                            :title="`${m.grupo}: abre a lista`"
                        >
                            <component :is="icones[m.lista[0].icone]" class="size-4 text-preto-200" aria-hidden="true" />
                            <span class="w-full truncate text-[9px] font-semibold leading-none text-preto-200">{{ m.grupo }}</span
                            ><ChevronUp class="absolute right-0.5 top-0.5 size-3 text-preto-400" aria-hidden="true" />
                        </button>
                    </DropdownMenuTrigger>
                    <!-- Cartõezinhos em grade, que crescem para cima e quebram em linhas: 10 ou 20 técnicas cabem sem virar uma lista comprida -->
                    <DropdownMenuContent
                        side="top"
                        align="center"
                        :side-offset="6"
                        class="max-h-[min(60dvh,28rem)] w-[min(30rem,calc(100vw-2rem))] max-w-none overflow-y-auto border-black bg-black/85 p-1.5 text-preto-100 backdrop-blur"
                    >
                        <p class="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-preto-400">{{ m.grupo }}</p>
                        <div class="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1">
                            <DropdownMenuItem
                                v-for="a in m.lista"
                                :key="a.id"
                                :disabled="!!a.bloqueio"
                                class="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-sm border border-preto-700 bg-black/60 px-1 py-1 text-center data-[highlighted]:border-preto-200 data-[highlighted]:bg-black data-[highlighted]:text-preto-50 data-[disabled]:opacity-40"
                                :title="`${a.rotulo}${a.bloqueio ? ' (' + a.bloqueio + ')' : ' · Shift = vantagem, Ctrl = desvantagem'}`"
                                @click="usar(a, $event)"
                            >
                                <span class="line-clamp-2 w-full break-words text-[10px] font-semibold leading-tight">{{ a.rotulo }}</span>
                                <span v-if="a.detalhe" class="text-[10px] leading-none text-preto-400">{{ a.detalhe }}</span>
                            </DropdownMenuItem>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    </div>

    <Dialog :open="!!escolhendo" @update:open="(v: boolean) => !v && (escolhendo = null)">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle class="font-serif text-lg">{{ escolhendo?.opcoes?.titulo }}</DialogTitle>
                <DialogDescription>Escolha qual munição usar neste disparo. Shift = vantagem, Ctrl = desvantagem.</DialogDescription>
            </DialogHeader>
            <ul v-if="escolhendo?.opcoes?.lista.length" class="grid gap-1.5">
                <li v-for="o in escolhendo.opcoes.lista" :key="o.id">
                    <button
                        type="button"
                        class="flex w-full items-center justify-between rounded-md border border-preto-700 px-3 py-2 text-left text-sm transition hover:border-preto-300 hover:bg-preto-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-preto-300"
                        @click="escolher(o.executar, $event)"
                    >
                        <span class="font-medium">{{ o.rotulo }}</span>
                        <span v-if="o.detalhe" class="text-xs text-preto-400">{{ o.detalhe }}</span>
                    </button>
                </li>
            </ul>
            <p v-else class="text-sm text-preto-400">{{ escolhendo?.opcoes?.vazio }}</p>
        </DialogContent>
    </Dialog>
</template>
