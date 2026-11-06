<script setup lang="ts">
import { Pencil, Plus } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { resumoEfeito } from '../../../../nucleo/efeitos/resumo';
import { clonar } from '../../../../nucleo/ficha/caminho';
import { formatoDeResumo } from '../../alvos';
import { estilos, useFicha } from '../../contexto';
import EditorCaracteristicaDialog from '../../EditorCaracteristicaDialog.vue';
import { comBuffAlternado, usosMax, type Caracteristica, type FichaOnePiece } from '../../regras';

const props = defineProps<{ ficha: FichaOnePiece }>();
const { editar, salvar, calc } = useFicha();

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
/**
 * Liga ou desliga o buff de uma característica ativa (vale na hora, em jogo: não depende do modo Editar). Ligar gasta um
 * uso, se ela tem usos; sem usos restantes não liga (ver `comBuffAlternado`).
 */
function alternar(i: number) {
    const nova = comBuffAlternado(props.ficha.caracteristicas[i], calc.value.prof);
    if (nova) mudar((l) => (l[i] = nova));
}
/** Máximo de usos agora (fixo ou igual ao bônus de proficiência). */
const maxUsos = (c: Caracteristica) => usosMax(c, calc.value.prof);
const gastaUso = (c: Caracteristica) => !c.ativa && !!c.usos && maxUsos(c) > 0;
const semUsos = (c: Caracteristica) => gastaUso(c) && c.usos!.atual <= 0;
/** Os efeitos de uma ativa desligada não contam: aparecem apagados. */
const conta = (c: Caracteristica) => c.tipo === 'passiva' || c.ativa === true;

// criar e editar (diálogo)
const dialogoAberto = ref(false);
const editando = ref<number | null>(null);
const caracteristicaEditada = computed(() => (editando.value === null ? null : (props.ficha.caracteristicas[editando.value] ?? null)));
function abrir(indice: number | null) {
    editando.value = indice;
    dialogoAberto.value = true;
}
function aoSalvar(c: Caracteristica) {
    mudar((l) => (editando.value === null ? l.push(c) : (l[editando.value] = c)));
}
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="flex items-center gap-3 rounded-lg border border-ouro-500/30 bg-preto-900/60 p-3" aria-label="Estilo de luta">
            <span
                class="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ouro-500/50 bg-preto-950 font-serif text-xl font-semibold text-ouro-200"
                >{{ ficha.nivel }}</span
            >
            <div class="min-w-0">
                <p class="font-serif text-lg font-semibold text-ouro-50">{{ ficha.estilo || 'Sem estilo de luta' }}</p>
                <p class="text-xs text-preto-400">
                    {{ ficha.profissao || 'Sem profissão' }}{{ ficha.fruta ? ' · ' + ficha.fruta : '' }} · dado de vida {{ ficha.dadosVida.tipo }}
                </p>
            </div>
        </section>

        <section v-for="g in grupos" :key="g.titulo" :class="estilos.cartao" :aria-label="g.titulo">
            <h3 :class="estilos.titulo">{{ g.titulo }}</h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="{ c, i } in g.itens" :key="i" class="px-3 py-2">
                    <div class="flex items-center gap-3">
                        <span class="min-w-0 flex-1"
                            ><span class="block truncate">{{ c.nome }}</span
                            ><span class="block truncate text-xs text-preto-400">{{ c.origem }}</span></span
                        >
                        <!-- interruptor do buff: só para ativas que têm efeitos -->
                        <button
                            v-if="c.tipo === 'ativa' && c.efeitos?.length"
                            type="button"
                            role="switch"
                            :aria-checked="c.ativa === true"
                            :aria-label="`${c.nome}: ${c.ativa ? 'ligada' : 'desligada'}`"
                            class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="
                                c.ativa
                                    ? 'border-green-400 bg-green-500/20 text-green-200 hover:bg-green-500/30'
                                    : semUsos(c)
                                      ? 'cursor-not-allowed border-preto-700 text-preto-500 opacity-60'
                                      : 'border-preto-600 text-preto-300 hover:border-ouro-500/50 hover:text-ouro-100'
                            "
                            :disabled="semUsos(c)"
                            :title="
                                c.ativa
                                    ? 'Ligada: os efeitos valem. Clique para desligar (o uso gasto não volta; só no descanso).'
                                    : semUsos(c)
                                      ? 'Sem usos restantes: descanse para recuperá-los.'
                                      : gastaUso(c)
                                        ? 'Desligada. Clique para ligar (gasta 1 uso) e os efeitos passarem a valer.'
                                        : 'Desligada. Clique para ligar e os efeitos passarem a valer.'
                            "
                            @click="alternar(i)"
                        >
                            {{ c.ativa ? 'Ligada' : 'Desligada' }}
                        </button>
                        <span
                            v-if="c.usos"
                            class="shrink-0 text-[10px] uppercase text-preto-500"
                            :title="`Os usos voltam no descanso ${c.descanso === 'curto' ? 'curto (e no longo)' : 'longo'}${c.usos.porProf ? ' · usos = bônus de proficiência' : ''}`"
                            >↻ {{ c.descanso === 'curto' ? 'curto' : 'longo' }}</span
                        >
                        <span v-if="c.usos" class="flex shrink-0 gap-1" role="group" :aria-label="`${c.usos.atual} de ${maxUsos(c)} usos`"
                            ><button
                                v-for="n in maxUsos(c)"
                                :key="n"
                                type="button"
                                class="size-3.5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :class="n <= c.usos.atual ? 'border-ouro-400 bg-ouro-500' : 'border-preto-600'"
                                :aria-label="`Uso ${n}`"
                                :aria-pressed="n <= c.usos.atual"
                                @click="usar(i, c.usos.atual, n)"
                        /></span>
                        <template v-if="editar">
                            <button
                                type="button"
                                class="shrink-0 text-preto-500 hover:text-ouro-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :aria-label="`Editar ${c.nome}`"
                                title="Editar nome, tipo, usos e efeitos"
                                @click="abrir(i)"
                            >
                                <Pencil class="size-3.5" />
                            </button>
                            <button
                                type="button"
                                class="shrink-0 text-xs text-preto-500 hover:text-red-300"
                                :aria-label="`Remover ${c.nome}`"
                                @click="mudar((l) => l.splice(i, 1))"
                            >
                                ✕
                            </button>
                        </template>
                    </div>
                    <p v-if="c.efeitos?.length" class="mt-1.5 flex flex-wrap gap-1" :class="conta(c) ? '' : 'opacity-40'">
                        <span v-for="(e, n) in c.efeitos" :key="n" class="rounded bg-preto-800 px-1.5 py-0.5 text-[11px] text-ouro-200">{{
                            resumoEfeito(e, formatoDeResumo)
                        }}</span>
                    </p>
                </li>
                <li v-if="!g.itens.length" class="px-3 py-2 text-xs text-preto-500">Nenhuma característica.</li>
            </ul>
        </section>

        <div v-if="editar">
            <button
                type="button"
                class="flex items-center gap-1.5 rounded-md bg-ouro-500 px-3 py-1.5 text-xs font-semibold text-preto-950 hover:bg-ouro-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-300"
                @click="abrir(null)"
            >
                <Plus class="size-3.5" /> Nova característica
            </button>
        </div>

        <EditorCaracteristicaDialog v-model:open="dialogoAberto" :caracteristica="caracteristicaEditada" @salvar="aoSalvar" />
    </div>
</template>
