<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { computed, ref } from 'vue';
import { DADOS, type Dado, type VisibilidadeRolagem } from '../tipos-mesa';
import DadoIcone from './DadoIcone.vue';

const props = defineProps<{ mestre: boolean; rolando: boolean }>();
const emit = defineEmits<{ rolar: [dado: Dado, quantidade: number, visibilidade: VisibilidadeRolagem]; fechar: [] }>();

const dado = ref<Dado>('d20');
const quantidade = ref(1);
const visibilidade = ref<VisibilidadeRolagem>('todos');

const opcoes = computed<{ id: VisibilidadeRolagem; rotulo: string; dica: string }[]>(() =>
    props.mestre
        ? [
              { id: 'todos', rotulo: 'Para todos', dica: 'Todos veem o resultado' },
              { id: 'mestre', rotulo: 'Para mim', dica: 'Só você (mestre) vê' },
              { id: 'secreto', rotulo: 'Em segredo', dica: 'Só você vê o resultado; os jogadores veem apenas que houve uma rolagem' },
          ]
        : [
              { id: 'todos', rotulo: 'Para todos', dica: 'Todos veem o resultado' },
              { id: 'mestre', rotulo: 'Para mim e o mestre', dica: 'Só você e o mestre veem' },
          ],
);
</script>

<template>
    <section class="pointer-events-auto absolute left-16 top-16 z-20 w-72 rounded-lg border border-ouro-500/30 bg-preto-950/95 p-3 text-sm text-preto-100 shadow-xl backdrop-blur" aria-label="Rolar dados">
        <div class="mb-2 flex items-center justify-between">
            <h2 class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Rolar dados</h2>
            <button type="button" class="rounded px-1.5 text-preto-300 hover:text-ouro-200" aria-label="Fechar" @click="emit('fechar')">✕</button>
        </div>

        <div class="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Tipo de dado">
            <button
                v-for="d in DADOS"
                :key="d"
                type="button"
                role="radio"
                :aria-checked="dado === d"
                class="flex flex-col items-center rounded-md border p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="dado === d ? 'border-ouro-400 bg-ouro-500/15' : 'border-preto-700 hover:border-ouro-500/50'"
                @click="dado = d"
            >
                <span class="size-9"><DadoIcone :dado="d" /></span>
                <span class="text-xs" :class="dado === d ? 'font-semibold text-ouro-200' : 'text-preto-300'">{{ d }}</span>
            </button>
        </div>

        <p class="mb-1 mt-3 text-xs text-preto-300">Quantidade</p>
        <div class="flex gap-1.5" role="radiogroup" aria-label="Quantidade de dados">
            <button
                v-for="n in 6"
                :key="n"
                type="button"
                role="radio"
                :aria-checked="quantidade === n"
                class="size-8 flex-1 rounded-md border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="quantidade === n ? 'border-ouro-400 bg-ouro-500 font-semibold text-preto-950' : 'border-preto-700 text-preto-200 hover:border-ouro-500/50'"
                @click="quantidade = n"
            >
                {{ n }}
            </button>
        </div>

        <p class="mb-1 mt-3 text-xs text-preto-300">Mostrar para</p>
        <div class="grid gap-1" role="radiogroup" aria-label="Quem vê a rolagem">
            <button
                v-for="o in opcoes"
                :key="o.id"
                type="button"
                role="radio"
                :aria-checked="visibilidade === o.id"
                :title="o.dica"
                class="rounded-md border px-2.5 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="visibilidade === o.id ? 'border-ouro-400 bg-ouro-500/15 text-ouro-100' : 'border-preto-700 text-preto-200 hover:border-ouro-500/50'"
                @click="visibilidade = o.id"
            >
                {{ o.rotulo }}
            </button>
        </div>

        <Button class="mt-3 w-full bg-ouro-500 font-semibold text-preto-950 hover:bg-ouro-400" :disabled="rolando" @click="emit('rolar', dado, quantidade, visibilidade)">
            Rolar {{ quantidade }}{{ dado }}
        </Button>
    </section>
</template>
