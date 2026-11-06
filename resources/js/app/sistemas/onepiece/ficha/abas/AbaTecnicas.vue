<script setup lang="ts">
import { computed } from 'vue';
import AreaRolavel from '../../../../nucleo/ui/AreaRolavel.vue';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import IndicadorD20 from '../../../../nucleo/ui/IndicadorD20.vue';
import { estilos, useFicha } from '../../contexto';
import { ATRIBUTOS, comSinal, PP_POR_NIVEL, type AtributoId, type FichaOnePiece } from '../../regras';
import ListaTecnicas from './ListaTecnicas.vue';

const props = defineProps<{ ficha: FichaOnePiece }>();
const { editar, calc, salvar, d20, modoDe } = useFicha();

const atributo = computed(() => ATRIBUTOS.find((a) => a.id === props.ficha.tecnicas.atributo));
const caixa = 'rounded-lg border border-preto-700 bg-preto-950 px-2 py-1.5 text-center';
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Técnicas: atributo, CD e ataque">
            <div :class="caixa">
                <p :class="estilos.rotulo">Atributo</p>
                <select
                    v-if="editar"
                    :value="ficha.tecnicas.atributo"
                    aria-label="Atributo das técnicas"
                    class="bg-transparent font-serif text-lg font-semibold text-ouro-100"
                    @change="salvar({ 'tecnicas.atributo': ($event.target as HTMLSelectElement).value as AtributoId })"
                >
                    <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id" class="bg-preto-950 text-sm">{{ a.sigla }}</option>
                </select>
                <p v-else class="font-serif text-lg font-semibold text-ouro-100">{{ atributo?.sigla }}</p>
            </div>
            <div :class="caixa">
                <p :class="estilos.rotulo">CD</p>
                <p class="font-serif text-lg font-semibold text-ouro-100" title="8 + proficiência + modificador + ajuste">{{ calc.cd }}</p>
                <CampoNumero
                    v-if="editar"
                    :model-value="ficha.ajustes?.cd ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste da CD"
                    title="Ajuste manual"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.cd': $event })"
                />
            </div>
            <AreaRolavel
                rotulo="ataque de técnica"
                :ativa="!editar"
                :modo="modoDe('ataque')"
                :class="caixa"
                @rolar="d20($event, 'ataque', 'Ataque de técnica')"
            >
                <span :class="estilos.rotulo" class="block">Ataque</span>
                <span
                    class="flex items-center justify-center gap-1 font-serif text-lg font-semibold text-ouro-100"
                    title="proficiência + modificador + ajuste"
                >
                    {{ comSinal(calc.ataque) }}
                    <IndicadorD20
                        v-if="!editar"
                        :modo="modoDe('ataque')"
                        class="size-5 opacity-40 transition group-hover:scale-110 group-hover:opacity-100"
                    />
                </span>
                <CampoNumero
                    v-if="editar"
                    :model-value="ficha.ajustes?.ataque ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste do ataque de técnica"
                    title="Ajuste manual"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.ataque': $event })"
                />
            </AreaRolavel>
            <div :class="caixa">
                <p :class="estilos.rotulo">Pontos de Poder</p>
                <p
                    class="flex items-center justify-center gap-1 font-serif text-lg font-semibold tabular-nums text-sky-300"
                    :title="`Disponíveis / máximo (${ficha.nivel} × ${ficha.pp.porNivel} por nível, mais os efeitos). Voltam no descanso longo.`"
                >
                    <CampoNumero
                        :model-value="ficha.pp.atual"
                        :min="0"
                        :max="9999"
                        aria-label="PP atuais"
                        :class="estilos.num"
                        @salvar="salvar({ 'pp.atual': $event })"
                    />
                    / {{ calc['pp.max'] }}
                </p>
                <label v-if="editar" class="mt-1 flex items-center justify-center gap-1 text-xs text-preto-400"
                    >por nível
                    <select
                        :value="ficha.pp.porNivel"
                        aria-label="Pontos de poder por nível"
                        class="rounded border border-preto-700 bg-preto-950 text-xs"
                        @change="salvar({ 'pp.porNivel': Number(($event.target as HTMLSelectElement).value) })"
                    >
                        <option v-for="n in PP_POR_NIVEL" :key="n" :value="n">{{ n }}</option>
                    </select>
                </label>
            </div>
        </section>

        <ListaTecnicas
            :ficha="ficha"
            caminho="tecnicas.lista"
            :lista="ficha.tecnicas.lista"
            titulo="Técnicas"
            nova="Nova técnica"
            vazio="Nenhuma técnica."
            tom="sky"
        />
    </div>
</template>
