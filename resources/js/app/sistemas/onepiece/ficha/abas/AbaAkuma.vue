<script setup lang="ts">
import { Apple } from 'lucide-vue-next';
import { computed } from 'vue';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../../nucleo/ui/CampoTexto.vue';
import { estilos, useFicha } from '../../contexto';
import { TIPOS_AKUMA, type FichaOnePiece, type TipoAkuma } from '../../regras';
import ListaTecnicas from './ListaTecnicas.vue';

/**
 * Akuma no Mi: a fruta do personagem (nome, tipo, despertar) e os poderes dela. É a aba de Técnicas aplicada à fruta:
 * os poderes gastam os mesmos pontos de poder, e a CD é a mesma das técnicas.
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { editar, calc, salvar } = useFicha();

const tipo = computed(() => TIPOS_AKUMA.find((t) => t.id === props.ficha.akuma.tipo)?.nome ?? 'Sem tipo');
const caixa = 'rounded-lg border border-violet-400/30 bg-preto-950 px-2 py-1.5 text-center';
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="rounded-lg border border-violet-400/40 bg-violet-500/10 p-3" aria-label="Akuma no Mi">
            <div class="flex items-center gap-3">
                <Apple class="size-8 shrink-0 text-violet-300" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                    <span :class="estilos.rotulo" class="block !text-violet-300">Akuma no Mi</span>
                    <CampoTexto
                        :model-value="ficha.fruta"
                        :maximo="80"
                        :somente-leitura="!editar"
                        placeholder="Sem fruta"
                        aria-label="Nome da fruta"
                        class="w-full border-b border-transparent bg-transparent font-serif text-xl font-semibold text-ouro-50 read-only:cursor-default focus-visible:border-violet-300 focus-visible:outline-none"
                        @salvar="salvar({ fruta: $event })"
                    />
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1 text-xs">
                    <select
                        v-if="editar"
                        :value="ficha.akuma.tipo"
                        aria-label="Tipo da fruta"
                        class="rounded border border-preto-700 bg-preto-950 px-1.5 py-1 text-xs"
                        @change="salvar({ 'akuma.tipo': ($event.target as HTMLSelectElement).value as TipoAkuma })"
                    >
                        <option v-for="t in TIPOS_AKUMA" :key="t.id" :value="t.id">{{ t.nome }}</option>
                    </select>
                    <span v-else class="rounded-full border border-violet-400/60 px-2.5 py-0.5 font-semibold text-violet-200">{{ tipo }}</span>
                    <button
                        type="button"
                        class="rounded-full border px-2.5 py-0.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :class="
                            ficha.akuma.despertada
                                ? 'border-ouro-400 bg-ouro-500/20 text-ouro-200'
                                : 'border-preto-700 text-preto-400 hover:text-ouro-200'
                        "
                        :aria-pressed="ficha.akuma.despertada"
                        title="Despertar da fruta"
                        @click="salvar({ 'akuma.despertada': !ficha.akuma.despertada })"
                    >
                        {{ ficha.akuma.despertada ? 'Despertada' : 'Não despertada' }}
                    </button>
                </div>
            </div>
        </section>

        <section class="grid grid-cols-2 gap-2" aria-label="CD e pontos de poder">
            <div :class="caixa">
                <p :class="estilos.rotulo">CD</p>
                <p class="font-serif text-lg font-semibold text-ouro-100" title="A mesma CD das técnicas">{{ calc.cd }}</p>
            </div>
            <div :class="caixa">
                <p :class="estilos.rotulo">Pontos de Poder</p>
                <p
                    class="flex items-center justify-center gap-1 font-serif text-lg font-semibold tabular-nums text-violet-300"
                    title="Os mesmos PP das técnicas"
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
            </div>
        </section>

        <ListaTecnicas
            :ficha="ficha"
            caminho="akuma.lista"
            :lista="ficha.akuma.lista"
            titulo="Poderes da Fruta"
            nova="Novo poder"
            vazio="Nenhum poder da fruta."
            tom="violet"
        />
    </div>
</template>
