<script setup lang="ts">
import { computed } from 'vue';
import { resumoEfeito } from '../../../../nucleo/efeitos/resumo';
import { CONDICOES, condicaoPorId } from '../../condicoes';
import { estilos, useFicha } from '../../contexto';
import type { FichaDnd5e } from '../../regras';

const props = defineProps<{ ficha: FichaDnd5e }>();
const { efeitos, salvar } = useFicha();

const ativas = computed(() => props.ficha.condicoes ?? []);
const ligada = (id: string) => ativas.value.includes(id);
/** Liga/desliga uma condição (vale na hora, em jogo: não depende do modo Editar). Salva a lista inteira. */
const alternar = (id: string) => salvar({ condicoes: ligada(id) ? ativas.value.filter((c) => c !== id) : [...ativas.value, id] });

/** Condições ativas com o que cada uma faz sozinha (as demais regras o jogador aplica à mão). */
const detalhes = computed(() => ativas.value.map((id) => condicaoPorId(id)).filter((c) => c !== undefined));

/** Os efeitos ativos agrupados pela fonte (item, condição, ajuste manual), na ordem em que contam. */
const porFonte = computed(() => {
    const grupos = new Map<string, string[]>();
    for (const e of efeitos.value) grupos.set(e.fonte, [...(grupos.get(e.fonte) ?? []), resumoEfeito(e)]);

    return [...grupos].map(([fonte, resumos]) => ({ fonte, resumos }));
});
</script>

<template>
    <div class="grid gap-3 p-3">
        <section :class="estilos.cartao" aria-label="Condições">
            <h3 :class="estilos.titulo">Condições</h3>
            <div class="flex flex-wrap gap-1.5 p-3">
                <button
                    v-for="c in CONDICOES"
                    :key="c.id"
                    type="button"
                    class="rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    :class="ligada(c.id) ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-preto-700 text-preto-300 hover:border-ouro-500/50'"
                    :aria-pressed="ligada(c.id)"
                    :title="c.descricao"
                    @click="alternar(c.id)"
                >
                    {{ c.nome }}
                </button>
            </div>
            <ul v-if="detalhes.length" class="divide-y divide-preto-800/70 border-t border-preto-800 text-sm">
                <li v-for="c in detalhes" :key="c.id" class="grid gap-0.5 px-3 py-2">
                    <span class="font-semibold text-red-200">{{ c.nome }}</span>
                    <span class="text-xs text-preto-300">{{ c.descricao }}</span>
                    <span class="text-[11px]" :class="c.efeitos.length ? 'text-green-300' : 'text-preto-500'">
                        {{
                            c.efeitos.length
                                ? 'Automático: ajusta sozinho as vantagens e desvantagens dos botões de rolagem.'
                                : 'Sem efeito automático: aplique as regras à mão.'
                        }}
                    </span>
                </li>
            </ul>
        </section>

        <section :class="estilos.cartao" aria-label="Efeitos ativos">
            <h3 :class="estilos.titulo">Efeitos Ativos</h3>
            <ul v-if="porFonte.length" class="divide-y divide-preto-800/70 text-sm">
                <li v-for="g in porFonte" :key="g.fonte" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span class="min-w-28 font-semibold text-preto-100">{{ g.fonte }}</span>
                    <span class="flex flex-wrap gap-1"
                        ><span v-for="(r, i) in g.resumos" :key="i" class="rounded bg-preto-800 px-1.5 py-0.5 text-[11px] text-ouro-200">{{
                            r
                        }}</span></span
                    >
                </li>
            </ul>
            <p v-else class="px-3 py-6 text-center text-xs text-preto-500">
                Nenhum efeito ativo. Itens equipados (e sintonizados, se exigirem), condições e ajustes manuais aparecem aqui.
            </p>
        </section>
    </div>
</template>
