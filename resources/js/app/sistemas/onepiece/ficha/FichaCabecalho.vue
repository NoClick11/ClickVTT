<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ArrowUpCircle, Coffee, Moon, Star, WandSparkles } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import CampoNumero from '../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../nucleo/ui/CampoTexto.vue';
import { estilos, useFicha } from '../contexto';
import { camposDoDescanso, type FichaOnePiece, type TipoDescanso } from '../regras';
import SubirDeNivel from './SubirDeNivel.vue';

const props = defineProps<{ ficha: FichaOnePiece; personagem: PersonagemFicha; construtorConcluido?: boolean }>();
const emit = defineEmits<{ 'update:editar': [boolean]; construtor: [] }>();
const { editar, calc, salvar, mestre, permissoes } = useFicha();
/** O mestre marca um NPC como aliado dos jogadores: eles não o atingem (sem fogo amigo). */
/** O construtor só se usa uma vez: depois de concluído o jogador não o abre de novo (o mestre pode, para corrigir). */
const construtorBloqueado = computed(() => !!props.construtorConcluido && !mestre);
const podeMarcarAliado = computed(() => mestre && !(props.personagem.jogadores?.length ?? 0));

const subindo = ref(false);
/** O jogador só sobe com o XP do nível completo e a liberação do mestre; o mestre nunca é barrado. */
const xpCompleto = computed(() => props.ficha.xp.atual >= calc.value['xp.proximo']);
const podeSubir = computed(() => mestre || (permissoes.value.subirNivel && xpCompleto.value));
const motivoSemSubir = computed(() =>
    !xpCompleto.value ? 'Falta XP para o próximo nível.' : !permissoes.value.subirNivel ? 'O mestre ainda não liberou subir de nível.' : '',
);
const podeDescansar = (tipo: TipoDescanso) => mestre || (tipo === 'curto' ? permissoes.value.descansoCurto : permissoes.value.descansoLongo);
const xpPct = computed(() => Math.min(100, Math.round((props.ficha.xp.atual / calc.value['xp.proximo']) * 100)));

/**
 * Descansos (ver `camposDoDescanso`): os dois desligam os buffs ativos e restauram os usos das características (o curto, só
 * as de descanso curto); o longo também restaura PV e pontos de poder (até o máximo efetivo), dados de vida e exaustão.
 */
function descansar(tipo: TipoDescanso) {
    if (!podeDescansar(tipo)) return;
    const campos = camposDoDescanso(props.ficha, tipo, calc.value['pv.max'], calc.value['pp.max']);
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

            <label
                v-if="podeMarcarAliado"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-preto-700 px-2 py-1 text-xs text-preto-300"
                title="NPC aliado dos jogadores: os jogadores não o atingem (sem fogo amigo). Só o mestre marca."
            >
                <input
                    type="checkbox"
                    class="size-3.5 accent-ouro-500"
                    :checked="!!ficha.aliado"
                    aria-label="Aliado dos jogadores"
                    @change="salvar({ aliado: ($event.target as HTMLInputElement).checked })"
                />
                Aliado dos jogadores
            </label>

            <div class="min-w-48 flex-1">
                <h2 class="font-serif text-2xl font-semibold leading-tight text-ouro-50" :style="{ textShadow: `0 0 18px ${personagem.cor}55` }">
                    {{ personagem.nome }}
                </h2>
                <p v-if="!editar" class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ouro-400">
                    {{ ficha.estilo || 'Sem estilo de luta' }} {{ ficha.nivel }}
                    <span v-if="ficha.profissao" class="text-preto-400">· {{ ficha.profissao }}</span>
                </p>
                <div v-else class="flex items-center gap-2 text-sm">
                    <CampoTexto
                        :model-value="ficha.estilo"
                        :maximo="80"
                        placeholder="Estilo de luta"
                        aria-label="Estilo de luta"
                        :class="estilos.campo"
                        @salvar="salvar({ estilo: $event })"
                    />
                    <CampoTexto
                        :model-value="ficha.profissao"
                        :maximo="80"
                        placeholder="Profissão"
                        aria-label="Profissão"
                        :class="estilos.campo"
                        @salvar="salvar({ profissao: $event })"
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
                    :disabled="construtorBloqueado"
                    :title="
                        construtorBloqueado
                            ? 'O construtor já foi usado nesta ficha'
                            : 'Construtor: escolha espécie, variante e atributos e a ficha é preenchida'
                    "
                    aria-label="Construtor de personagem"
                    @click="emit('construtor')"
                    ><WandSparkles class="size-4"
                /></Button>
                <Button
                    v-if="ficha.estiloId && ficha.nivel < 20"
                    size="icon"
                    variant="outline"
                    class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200"
                    :disabled="!podeSubir"
                    :title="podeSubir ? 'Subir de nível: Habilidade Básica, AVA, PV, PP e técnicas do estilo' : motivoSemSubir"
                    aria-label="Subir de nível"
                    @click="subindo = true"
                    ><ArrowUpCircle class="size-4"
                /></Button>
                <Button
                    size="icon"
                    variant="outline"
                    class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200"
                    :disabled="!podeDescansar('curto')"
                    :title="
                        podeDescansar('curto')
                            ? 'Descanso curto: desliga os buffs ativos e restaura os usos das características de descanso curto'
                            : 'O mestre ainda não liberou o descanso curto.'
                    "
                    aria-label="Descanso curto"
                    @click="descansar('curto')"
                    ><Coffee class="size-4"
                /></Button>
                <Button
                    size="icon"
                    variant="outline"
                    class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200"
                    :disabled="!podeDescansar('longo')"
                    :title="
                        podeDescansar('longo')
                            ? 'Descanso longo: PV e pontos de poder ao máximo, dados de vida, -1 de exaustão, usos das características; desliga os buffs ativos'
                            : 'O mestre ainda não liberou o descanso longo.'
                    "
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
                    :model-value="ficha.fruta"
                    :maximo="80"
                    :somente-leitura="!editar"
                    placeholder="Nenhuma"
                    :class="estilos.campo"
                    @salvar="salvar({ fruta: $event })"
                /><span :class="estilos.rotulo" class="mt-0.5 block">Fruta do Diabo</span></label
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
                        :somente-leitura="!mestre"
                        aria-label="XP atual"
                        class="w-16 border-b border-transparent bg-transparent text-right text-preto-300 focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ 'xp.atual': $event })"
                    />
                    / {{ calc['xp.proximo'].toLocaleString('pt-BR') }}</span
                >
            </div>
        </div>
        <SubirDeNivel v-model:open="subindo" :ficha="ficha" />
    </header>
</template>
