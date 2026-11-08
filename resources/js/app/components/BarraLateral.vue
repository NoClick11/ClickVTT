<script setup lang="ts">
import { Cherry, ChevronsRight, MessageSquare, Music, Package, Settings, Users } from 'lucide-vue-next';
import { computed, type Component } from 'vue';

export type AbaLateral = 'chat' | 'personagens' | 'musica' | 'itens' | 'frutas' | 'configuracoes';

const props = defineProps<{ aba: AbaLateral; aberta: boolean; naoLidas: number; mestre?: boolean; temFrutas?: boolean }>();
const emit = defineEmits<{ 'update:aba': [AbaLateral]; 'update:aberta': [boolean] }>();

const abas = computed<{ id: AbaLateral; rotulo: string; icone: Component }[]>(() => [
    { id: 'chat', rotulo: 'Chat', icone: MessageSquare },
    { id: 'personagens', rotulo: 'Personagens', icone: Users },
    { id: 'musica', rotulo: 'Música de Fundo', icone: Music },
    // Os itens (e seus efeitos) são do mestre: só ele vê e edita o catálogo.
    ...(props.mestre ? [{ id: 'itens' as const, rotulo: 'Itens', icone: Package }] : []),
    // As frutas prontas (e a entrega delas) também são do mestre, nos sistemas que as têm.
    ...(props.mestre && props.temFrutas ? [{ id: 'frutas' as const, rotulo: 'Frutas', icone: Cherry }] : []),
    // As regras da mesa (fogo amigo, liberações e XP) são do mestre.
    ...(props.mestre ? [{ id: 'configuracoes' as const, rotulo: 'Configurações', icone: Settings }] : []),
]);
</script>

<template>
    <!-- Barra lateral à direita (Foundry/Roll20): abas no topo e o conteúdo da aba abaixo. Recolhida, sobra só a barra de abas. -->
    <aside
        class="pointer-events-auto absolute right-0 top-12 z-10 flex flex-col border-l border-ouro-500/25 bg-preto-950/95 backdrop-blur"
        :class="aberta ? 'bottom-0 w-[min(20rem,85vw)] shadow-2xl' : 'rounded-bl-lg border-b'"
        aria-label="Barra lateral"
    >
        <nav
            class="flex h-11 shrink-0 items-center gap-1 px-1.5"
            :class="aberta ? 'border-b border-preto-800' : ''"
            role="tablist"
            aria-label="Abas da barra lateral"
        >
            <button
                v-for="a in abas"
                :key="a.id"
                type="button"
                role="tab"
                :id="`aba-${a.id}`"
                :aria-selected="aberta && aba === a.id"
                :aria-controls="`painel-${a.id}`"
                :title="a.rotulo"
                :aria-label="a.rotulo"
                class="relative flex h-8 w-10 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="aberta && aba === a.id ? 'bg-ouro-500 text-preto-950' : 'text-preto-300 hover:bg-preto-800 hover:text-ouro-200'"
                @click="aberta && aba === a.id ? emit('update:aberta', false) : (emit('update:aba', a.id), emit('update:aberta', true))"
            >
                <component :is="a.icone" class="size-5" />
                <span
                    v-if="a.id === 'chat' && naoLidas"
                    class="absolute -right-1 -top-1 min-w-4 rounded-full bg-ouro-500 px-1 text-center text-[10px] font-semibold leading-4 text-preto-950 ring-2 ring-preto-950"
                    >{{ naoLidas > 99 ? '99+' : naoLidas }}</span
                >
            </button>
            <button
                v-if="aberta"
                type="button"
                class="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-preto-400 transition hover:bg-preto-800 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                aria-label="Recolher barra lateral"
                title="Recolher"
                @click="emit('update:aberta', false)"
            >
                <ChevronsRight class="size-4" />
            </button>
        </nav>

        <div v-show="aberta" class="flex min-h-0 flex-1 flex-col">
            <section v-show="aba === 'chat'" class="flex min-h-0 flex-1 flex-col" role="tabpanel" id="painel-chat" aria-labelledby="aba-chat">
                <slot name="chat" />
            </section>
            <section
                v-show="aba === 'personagens'"
                class="flex min-h-0 flex-1 flex-col"
                role="tabpanel"
                id="painel-personagens"
                aria-labelledby="aba-personagens"
            >
                <slot name="personagens" />
            </section>
            <section v-show="aba === 'musica'" class="flex min-h-0 flex-1 flex-col" role="tabpanel" id="painel-musica" aria-labelledby="aba-musica">
                <slot name="musica" />
            </section>
            <section
                v-if="mestre"
                v-show="aba === 'itens'"
                class="flex min-h-0 flex-1 flex-col"
                role="tabpanel"
                id="painel-itens"
                aria-labelledby="aba-itens"
            >
                <slot name="itens" />
            </section>
            <section
                v-if="mestre && temFrutas"
                v-show="aba === 'frutas'"
                class="flex min-h-0 flex-1 flex-col"
                role="tabpanel"
                id="painel-frutas"
                aria-labelledby="aba-frutas"
            >
                <slot name="frutas" />
            </section>
            <section
                v-if="mestre"
                v-show="aba === 'configuracoes'"
                class="flex min-h-0 flex-1 flex-col"
                role="tabpanel"
                id="painel-configuracoes"
                aria-labelledby="aba-configuracoes"
            >
                <slot name="configuracoes" />
            </section>
        </div>
    </aside>
</template>
