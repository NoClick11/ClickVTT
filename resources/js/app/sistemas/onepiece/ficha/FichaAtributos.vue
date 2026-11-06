<script setup lang="ts">
import AreaRolavel from '../../../nucleo/ui/AreaRolavel.vue';
import CampoNumero from '../../../nucleo/ui/CampoNumero.vue';
import IndicadorD20 from '../../../nucleo/ui/IndicadorD20.vue';
import { useFicha } from '../contexto';
import { ATRIBUTOS, comSinal, type FichaOnePiece } from '../regras';

defineProps<{ ficha: FichaOnePiece }>();
const { editar, calc, salvar, d20, modoDe } = useFicha();
</script>

<template>
    <section class="grid shrink-0 grid-cols-3 gap-2 border-b border-ouro-500/20 p-3 sm:grid-cols-6" aria-label="Atributos">
        <!-- Jogar: o cartão inteiro rola o teste. Editar: o cartão tem o campo do valor e não rola. -->
        <AreaRolavel
            v-for="a in ATRIBUTOS"
            :key="a.id"
            :rotulo="`teste de ${a.nome}`"
            :ativa="!editar"
            :modo="modoDe(`mod.${a.id}`)"
            class="relative flex flex-col items-center rounded-lg border border-preto-700 bg-preto-950 px-1 pb-4 pt-2 text-center"
            @rolar="d20($event, `mod.${a.id}`, `Teste de ${a.nome}`)"
        >
            <span class="text-[10px] font-semibold uppercase tracking-wider text-ouro-400" :title="a.nome">{{ a.sigla }}</span>
            <span class="font-serif text-2xl font-bold leading-none text-ouro-50">{{ comSinal(calc[`mod.${a.id}`]) }}</span>
            <IndicadorD20
                v-if="!editar"
                :modo="modoDe(`mod.${a.id}`)"
                class="absolute right-1 top-1 size-5 opacity-40 transition group-hover:scale-110 group-hover:opacity-100"
            />
            <!-- valor do atributo, em "pílula" na base do cartão: editável no modo Editar; no Jogar só mostra o valor efetivo -->
            <CampoNumero
                v-if="editar"
                :model-value="ficha.atributos[a.id]"
                :min="1"
                :max="30"
                :aria-label="`Valor de ${a.nome}`"
                class="absolute -bottom-2.5 w-10 rounded-full border border-ouro-500/50 bg-preto-900 text-center text-xs font-semibold tabular-nums text-ouro-100 focus-visible:border-ouro-300 focus-visible:outline-none"
                @salvar="salvar({ [`atributos.${a.id}`]: $event })"
            />
            <span
                v-else
                class="absolute -bottom-2.5 w-10 rounded-full border bg-preto-900 text-center text-xs font-semibold tabular-nums"
                :class="calc[`atributos.${a.id}`] !== ficha.atributos[a.id] ? 'border-ouro-300 text-ouro-300' : 'border-ouro-500/50 text-ouro-100'"
                :title="
                    calc[`atributos.${a.id}`] !== ficha.atributos[a.id]
                        ? `Base ${ficha.atributos[a.id]}; com os efeitos dos itens, ${calc[`atributos.${a.id}`]}`
                        : `Valor de ${a.nome}`
                "
                >{{ calc[`atributos.${a.id}`] }}</span
            >
        </AreaRolavel>
    </section>
</template>
