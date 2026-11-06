<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Coffee, Moon, Star } from 'lucide-vue-next';
import { computed } from 'vue';
import type { PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import CampoNumero from '../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../nucleo/ui/CampoTexto.vue';
import { estilos, useFicha } from '../contexto';
import { camposDoDescanso, type FichaDnd5e, type TipoDescanso } from '../regras';

const props = defineProps<{ ficha: FichaDnd5e; personagem: PersonagemFicha }>();
const emit = defineEmits<{ 'update:editar': [boolean] }>();
const { editar, calc, salvar } = useFicha();

const xpPct = computed(() => Math.min(100, Math.round((props.ficha.xp.atual / calc.value['xp.proximo']) * 100)));

/**
 * Descansos (ver `camposDoDescanso`): os dois desligam os buffs ativos e restauram os usos das características (o curto, só
 * as de descanso curto); o longo também restaura PV (até o máximo efetivo), dados de vida, espaços de magia e exaustão.
 */
function descansar(tipo: TipoDescanso) {
    const campos = camposDoDescanso(props.ficha, tipo, calc.value['pv.max']);
    if (Object.keys(campos).length) salvar(campos);
}
</script>

<template>
    <header class="shrink-0 border-b border-ouro-500/20 bg-preto-900/60 px-4 py-3">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <!-- alternador Jogar/Editar (canto esquerdo, como no Foundry) -->
            <div class="flex shrink-0 overflow-hidden rounded-md border border-preto-700 text-xs" role="group" aria-label="Modo da ficha">
                <button
                    type="button"
                    class="px-2.5 py-1 transition"
                    :class="!editar ? 'bg-ouro-500 font-semibold text-preto-950' : 'text-preto-300 hover:bg-preto-800'"
                    :aria-pressed="!editar"
                    @click="emit('update:editar', false)"
                >
                    Jogar
                </button>
                <button
                    type="button"
                    class="px-2.5 py-1 transition"
                    :class="editar ? 'bg-ouro-500 font-semibold text-preto-950' : 'text-preto-300 hover:bg-preto-800'"
                    :aria-pressed="editar"
                    @click="emit('update:editar', true)"
                >
                    Editar
                </button>
            </div>

            <div class="min-w-48 flex-1">
                <h2 class="font-serif text-2xl font-semibold leading-tight text-ouro-50" :style="{ textShadow: `0 0 18px ${personagem.cor}55` }">
                    {{ personagem.nome }}
                </h2>
                <p v-if="!editar" class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ouro-400">
                    {{ ficha.classe || 'Sem classe' }} {{ ficha.nivel }}
                    <span v-if="ficha.subclasse" class="text-preto-400">· {{ ficha.subclasse }}</span>
                </p>
                <div v-else class="flex items-center gap-2 text-sm">
                    <CampoTexto
                        :model-value="ficha.classe"
                        :maximo="80"
                        placeholder="Classe"
                        aria-label="Classe"
                        :class="estilos.campo"
                        @salvar="salvar({ classe: $event })"
                    />
                    <CampoTexto
                        :model-value="ficha.subclasse"
                        :maximo="80"
                        placeholder="Subclasse"
                        aria-label="Subclasse"
                        :class="estilos.campo"
                        @salvar="salvar({ subclasse: $event })"
                    />
                    <CampoNumero
                        :model-value="ficha.nivel"
                        :min="1"
                        :max="20"
                        aria-label="Nível"
                        :class="estilos.ajuste"
                        @salvar="salvar({ nivel: $event })"
                    />
                </div>
            </div>

            <div class="flex shrink-0 items-center gap-1.5">
                <span
                    class="flex size-9 items-center justify-center rounded-full border-2 border-ouro-500/60 bg-preto-950 font-serif text-lg font-semibold text-ouro-200"
                    title="Nível"
                    aria-label="Nível"
                    >{{ ficha.nivel }}</span
                >
                <button
                    type="button"
                    class="flex size-9 items-center justify-center rounded-full border transition"
                    :class="ficha.inspiracao ? 'border-ouro-400 bg-ouro-500/20 text-ouro-300' : 'border-preto-700 text-preto-500 hover:text-ouro-300'"
                    :aria-pressed="ficha.inspiracao"
                    title="Inspiração"
                    aria-label="Inspiração"
                    @click="salvar({ inspiracao: !ficha.inspiracao })"
                >
                    <Star class="size-4" :class="ficha.inspiracao ? 'fill-current' : ''" />
                </button>
                <Button
                    size="icon"
                    variant="outline"
                    class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200"
                    title="Descanso curto: desliga os buffs ativos e restaura os usos das características de descanso curto"
                    aria-label="Descanso curto"
                    @click="descansar('curto')"
                    ><Coffee class="size-4"
                /></Button>
                <Button
                    size="icon"
                    variant="outline"
                    class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200"
                    title="Descanso longo: PV ao máximo, dados de vida, -1 de exaustão, espaços de magia, usos das características; desliga os buffs ativos"
                    aria-label="Descanso longo"
                    @click="descansar('longo')"
                    ><Moon class="size-4"
                /></Button>
            </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <label
                ><CampoTexto
                    :model-value="ficha.especie"
                    :maximo="80"
                    :somente-leitura="!editar"
                    :class="estilos.campo"
                    @salvar="salvar({ especie: $event })"
                /><span :class="estilos.rotulo" class="mt-0.5 block">Espécie</span></label
            >
            <label
                ><CampoTexto
                    :model-value="ficha.antecedente"
                    :maximo="80"
                    :somente-leitura="!editar"
                    :class="estilos.campo"
                    @salvar="salvar({ antecedente: $event })"
                /><span :class="estilos.rotulo" class="mt-0.5 block">Antecedente</span></label
            >
            <label
                ><CampoTexto
                    :model-value="ficha.alinhamento"
                    :maximo="80"
                    :somente-leitura="!editar"
                    :class="estilos.campo"
                    @salvar="salvar({ alinhamento: $event })"
                /><span :class="estilos.rotulo" class="mt-0.5 block">Alinhamento</span></label
            >
            <div>
                <div
                    class="h-1.5 overflow-hidden rounded-full bg-preto-800"
                    role="progressbar"
                    :aria-valuenow="xpPct"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Experiência"
                >
                    <div class="h-full rounded-full bg-ouro-500" :style="{ width: xpPct + '%' }" />
                </div>
                <span :class="estilos.rotulo" class="mt-0.5 flex items-center gap-1 tabular-nums"
                    >XP
                    <CampoNumero
                        :model-value="ficha.xp.atual"
                        :min="0"
                        :max="10000000"
                        aria-label="XP atual"
                        class="w-16 border-b border-transparent bg-transparent text-right text-preto-300 focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ 'xp.atual': $event })"
                    />
                    / {{ calc['xp.proximo'].toLocaleString('pt-BR') }}</span
                >
            </div>
        </div>
    </header>
</template>
