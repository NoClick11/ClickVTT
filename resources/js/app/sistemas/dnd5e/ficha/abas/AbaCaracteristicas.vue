<script setup lang="ts">
import { computed, ref } from 'vue';
import { clonar } from '../../../../nucleo/ficha/caminho';
import { estilos, useFicha } from '../../contexto';
import type { Caracteristica, FichaDnd5e } from '../../regras';

const props = defineProps<{ ficha: FichaDnd5e }>();
const { editar, salvar } = useFicha();

// índices da lista completa (a lista é salva por inteiro), agrupados por tipo
const grupos = computed(() => [
    { titulo: 'Ativas', itens: props.ficha.caracteristicas.map((c, i) => ({ c, i })).filter((x) => x.c.tipo === 'ativa') },
    { titulo: 'Passivas', itens: props.ficha.caracteristicas.map((c, i) => ({ c, i })).filter((x) => x.c.tipo === 'passiva') },
]);

function mudar(fn: (lista: Caracteristica[]) => void) {
    const lista = clonar(props.ficha.caracteristicas);
    fn(lista);
    salvar({ caracteristicas: lista });
}
/** Clicar no uso N marca até N usos restantes; clicar de novo no último marcado gasta mais um. */
const usar = (i: number, atual: number, n: number) => mudar((l) => (l[i].usos!.atual = atual === n ? n - 1 : n));

const nova = ref({ nome: '', origem: '', tipo: 'ativa' as Caracteristica['tipo'], usos: 0 });
function adicionar() {
    const nome = nova.value.nome.trim();
    if (!nome) return;
    mudar((l) =>
        l.push({
            nome,
            origem: nova.value.origem.trim() || '—',
            tipo: nova.value.tipo,
            ...(nova.value.usos > 0 ? { usos: { atual: nova.value.usos, max: nova.value.usos } } : {}),
        }),
    );
    nova.value = { nome: '', origem: '', tipo: nova.value.tipo, usos: 0 };
}
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="flex items-center gap-3 rounded-lg border border-ouro-500/30 bg-preto-900/60 p-3" aria-label="Classe">
            <span
                class="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ouro-500/50 bg-preto-950 font-serif text-xl font-semibold text-ouro-200"
                >{{ ficha.nivel }}</span
            >
            <div class="min-w-0">
                <p class="font-serif text-lg font-semibold text-ouro-50">{{ ficha.classe || 'Sem classe' }}</p>
                <p class="text-xs text-preto-400">{{ ficha.subclasse || 'Sem subclasse' }} · dado de vida {{ ficha.dadosVida.tipo }}</p>
            </div>
        </section>

        <section v-for="g in grupos" :key="g.titulo" :class="estilos.cartao" :aria-label="g.titulo">
            <h3 :class="estilos.titulo">{{ g.titulo }}</h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="{ c, i } in g.itens" :key="i" class="flex items-center gap-3 px-3 py-2">
                    <span class="min-w-0 flex-1"
                        ><span class="block truncate">{{ c.nome }}</span
                        ><span class="block truncate text-xs text-preto-400">{{ c.origem }}</span></span
                    >
                    <span v-if="c.usos" class="flex shrink-0 gap-1" role="group" :aria-label="`${c.usos.atual} de ${c.usos.max} usos`"
                        ><button
                            v-for="n in c.usos.max"
                            :key="n"
                            type="button"
                            class="size-3.5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="n <= c.usos.atual ? 'border-ouro-400 bg-ouro-500' : 'border-preto-600'"
                            :aria-label="`Uso ${n}`"
                            :aria-pressed="n <= c.usos.atual"
                            @click="usar(i, c.usos.atual, n)"
                    /></span>
                    <button
                        v-if="editar"
                        type="button"
                        class="text-xs text-preto-500 hover:text-red-300"
                        :aria-label="`Remover ${c.nome}`"
                        @click="mudar((l) => l.splice(i, 1))"
                    >
                        ✕
                    </button>
                </li>
                <li v-if="!g.itens.length" class="px-3 py-2 text-xs text-preto-500">Nenhuma característica.</li>
            </ul>
        </section>

        <form v-if="editar" class="flex flex-wrap gap-1.5" @submit.prevent="adicionar">
            <input
                v-model="nova.nome"
                type="text"
                maxlength="120"
                placeholder="Nova característica"
                aria-label="Nome da característica"
                :class="campo"
                class="min-w-40 flex-1"
            />
            <input
                v-model="nova.origem"
                type="text"
                maxlength="120"
                placeholder="Origem (ex.: Clérigo 2)"
                aria-label="Origem"
                :class="campo"
                class="min-w-32 flex-1"
            />
            <select v-model="nova.tipo" aria-label="Tipo" :class="campo">
                <option value="ativa">Ativa</option>
                <option value="passiva">Passiva</option>
            </select>
            <input
                v-model.number="nova.usos"
                type="number"
                min="0"
                max="20"
                aria-label="Usos (0 = sem usos)"
                title="Usos por descanso (0 = sem usos)"
                :class="campo"
                class="w-16"
            />
            <button type="submit" class="rounded bg-ouro-500 px-3 text-xs font-semibold text-preto-950 hover:bg-ouro-400">Adicionar</button>
        </form>
    </div>
</template>
