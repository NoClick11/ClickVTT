<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { computed, reactive, ref, watch } from 'vue';
import { estiloPorId } from '../construtor/dados/estilos';
import { HABILIDADES_BASICAS, hbPorId, OPCOES_APRIMORAMENTO, OPCOES_QUEBRADOR } from '../construtor/dados/habilidades-basicas';
import { maestriaPorId, MAESTRIAS, problemasDaMaestria } from '../construtor/dados/maestrias';
import {
    camposDoNivel,
    hbsTidas,
    limiteDeAtributo,
    pendenciasDoNivel,
    problemasDoNivel,
    pvPelaMedia,
    TROCAS_DE_AVA,
    trocasFeitas,
    type EscolhasDoNivel,
} from '../construtor/nivel';
import { useFicha } from '../contexto';
import { NIVEIS_DE_PROFISSAO } from '../profissoes/dados';
import { ATRIBUTOS, modificador, type FichaOnePiece } from '../regras';

/**
 * "Subir de nível": o jogador escolhe a Habilidade Básica (2º e 3º nível), o Aumento no Valor de Atributo (ou, pela regra
 * opcional, uma HB no lugar dele), a segunda característica do Quebrador de Regras (6º) e os PV; a ficha é atualizada junto
 * (PP, técnicas do estilo, dado de vida). Só vale para fichas feitas pelo assistente com um estilo do catálogo.
 */
const props = defineProps<{ open: boolean; ficha: FichaOnePiece }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const { salvar, calc } = useFicha();

const novo = computed(() => props.ficha.nivel + 1);
const estilo = computed(() => estiloPorId(props.ficha.estiloId));
const pend = computed(() => pendenciasDoNivel(props.ficha, novo.value));
const modCon = computed(() => modificador(calc.value['atributos.con'] ?? props.ficha.atributos.con));
const media = computed(() => pvPelaMedia(props.ficha.dadosVida.tipo, modCon.value));

const esc = reactive<EscolhasDoNivel>({ hb: null, ava: null, trocarAva: false, pvGanho: 1 });
const hbId = ref('');
const hbOpcao = ref('');
const avaTipo = ref<'dois' | 'um'>('dois');
const avaAtributos = ref<string[]>([]);
const erro = ref('');
const maestriaId = ref('');
const tracoId = ref('');
const confirmou = ref(false);
const principal = ref<'armamento' | 'observacao' | ''>('');
const maestriaAtual = computed(() => maestriaPorId(props.ficha.maestria || maestriaId.value));
const tracosTidos = computed(() => (props.ficha.tracosDeMaestria ?? []).map((t) => t.id));
/** Maestrias com o motivo de não poderem ser aprendidas agora (atributo mínimo). */
const motivoDaMaestria = (id: string) => problemasDaMaestria(maestriaPorId(id)!, props.ficha.atributos, true)[0] ?? '';

watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        hbId.value = '';
        hbOpcao.value = '';
        maestriaId.value = '';
        tracoId.value = '';
        confirmou.value = false;
        principal.value = '';
        avaTipo.value = 'dois';
        avaAtributos.value = [];
        esc.trocarAva = false;
        esc.pvGanho = media.value;
        erro.value = '';
    },
);

const tidas = computed(() => hbsTidas(props.ficha));
/** Disponíveis: as que ainda não tem (no 6º, o Quebrador escolhe outra característica dele). */
const hbsDisponiveis = computed(() =>
    pend.value.quebrador
        ? HABILIDADES_BASICAS.filter((h) => h.id === 'quebrador-de-regras')
        : HABILIDADES_BASICAS.filter((h) => !tidas.value.has(h.id)),
);
const precisaHB = computed(() => pend.value.hbObrigatoria || pend.value.quebrador || (pend.value.ava && esc.trocarAva));
const escolhaDaHB = computed(() => (pend.value.quebrador ? 'quebrador' : hbPorId(hbId.value)?.escolha));
const opcoesDaHB = computed(() => {
    if (escolhaDaHB.value === 'prodigio')
        return [
            { id: 'corpo', nome: 'Corpo a corpo', descricao: '' },
            { id: 'distancia', nome: 'À distância', descricao: '' },
        ];
    if (escolhaDaHB.value === 'aprimoramento') return OPCOES_APRIMORAMENTO;
    if (escolhaDaHB.value === 'quebrador') {
        const ja = props.ficha.habilidadesBasicas.filter((h) => h.id === 'quebrador-de-regras').map((h) => h.opcao);
        return OPCOES_QUEBRADOR.filter((o) => !ja.includes(o.id));
    }
    return [];
});

const escolhas = computed<EscolhasDoNivel>(() => ({
    hb:
        precisaHB.value && (hbId.value || pend.value.quebrador)
            ? { id: pend.value.quebrador ? 'quebrador-de-regras' : hbId.value, ...(hbOpcao.value ? { opcao: hbOpcao.value } : {}) }
            : null,
    ava: pend.value.ava && !esc.trocarAva ? { tipo: avaTipo.value, atributos: avaAtributos.value as never } : null,
    trocarAva: esc.trocarAva,
    hakiPrincipal: pend.value.hakiPrincipal && principal.value ? principal.value : null,
    maestria:
        pend.value.maestria && maestriaAtual.value && tracoId.value
            ? { id: maestriaAtual.value.id, traco: tracoId.value, confirmou: confirmou.value }
            : null,
    pvGanho: Number(esc.pvGanho),
}));
const problemas = computed(() => problemasDoNivel(props.ficha, escolhas.value));
const limite = computed(() => limiteDeAtributo(novo.value));

function alternarAtributo(id: string) {
    const n = avaTipo.value === 'dois' ? 1 : 2;
    const i = avaAtributos.value.indexOf(id);
    if (i >= 0) avaAtributos.value.splice(i, 1);
    else if (avaAtributos.value.length < n) avaAtributos.value.push(id);
    else avaAtributos.value = [...avaAtributos.value.slice(1), id];
}
watch(avaTipo, () => (avaAtributos.value = []));

function subir() {
    if (problemas.value.length) return;
    salvar(camposDoNivel(props.ficha, escolhas.value));
    emit('update:open', false);
}

const cartao = 'rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
const ativo = 'border-ouro-400 bg-ouro-500/15 text-ouro-100';
const inativo = 'border-preto-700 bg-preto-950 text-preto-200 hover:border-ouro-500/50';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto border-ouro-500/30 bg-preto-900 text-preto-100">
            <DialogHeader>
                <DialogTitle class="font-serif text-ouro-200">Subir para o {{ novo }}º nível</DialogTitle>
                <DialogDescription class="text-preto-400">{{ estilo?.nome ?? 'Sem estilo do catálogo' }}</DialogDescription>
            </DialogHeader>

            <p v-if="!estilo" class="rounded-lg border border-preto-700 bg-preto-950 p-3 text-sm text-preto-300">
                Esta ficha não foi feita pelo assistente com um estilo do catálogo. Suba o nível à mão, em Editar.
            </p>
            <p v-else-if="ficha.nivel >= 20" class="text-sm text-preto-300">O nível máximo é o 20º.</p>
            <div v-else class="grid gap-4">
                <section v-if="pend.ava" class="grid gap-2" aria-label="Aumento no Valor de Atributo">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-preto-400">Aumento no Valor de Atributo (AVA)</h3>
                    <label v-if="pend.podeTrocar || esc.trocarAva" class="flex items-center gap-2 text-xs text-preto-300">
                        <input v-model="esc.trocarAva" type="checkbox" class="size-3.5 accent-ouro-500" />
                        Trocar o AVA por uma Habilidade Básica (regra opcional, com a permissão do Narrador; {{ trocasFeitas(ficha) }}/{{
                            TROCAS_DE_AVA
                        }}
                        usadas)
                    </label>
                    <template v-if="!esc.trocarAva">
                        <div class="flex gap-2" role="group" aria-label="Tipo de aumento">
                            <button type="button" :class="[cartao, avaTipo === 'dois' ? ativo : inativo]" @click="avaTipo = 'dois'">
                                +2 em um atributo
                            </button>
                            <button type="button" :class="[cartao, avaTipo === 'um' ? ativo : inativo]" @click="avaTipo = 'um'">
                                +1 em dois atributos
                            </button>
                        </div>
                        <div class="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Atributos">
                            <button
                                v-for="a in ATRIBUTOS"
                                :key="a.id"
                                type="button"
                                :class="[cartao, 'text-center', avaAtributos.includes(a.id) ? ativo : inativo]"
                                :aria-pressed="avaAtributos.includes(a.id)"
                                @click="alternarAtributo(a.id)"
                            >
                                <span class="block font-semibold">{{ a.sigla }}</span>
                                <span class="block text-xs text-preto-400">{{ ficha.atributos[a.id] }}</span>
                            </button>
                        </div>
                        <p class="text-xs text-preto-400">Teto de {{ limite }} nesta etapa.</p>
                    </template>
                </section>

                <p
                    v-if="NIVEIS_DE_PROFISSAO.includes(novo) && ficha.profissoes?.lista?.length && !ficha.profissoes?.semProfissao"
                    class="rounded-lg border border-ouro-500/40 bg-ouro-500/10 p-2 text-xs text-ouro-100"
                    role="status"
                >
                    No {{ novo }}º nível você tem um avanço de profissão: depois de subir, use a aba Profissões para aprender uma nova (com o Livro de
                    Profissão liberado pelo mestre) ou fazer o Avanço Planejado (subir uma graduação).
                </p>
                <section v-if="pend.hakiPrincipal" class="grid gap-2" aria-label="Haki Principal">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-preto-400">O Haki desperta: escolha o Haki Principal</h3>
                    <p class="text-xs text-preto-400">
                        No 8º nível você recebe 5 Pontos de Ambição e acesso aos Hakis do Armamento e da Observação. O que você não escolher vira o
                        secundário. Depois distribua os PA na aba Haki.
                    </p>
                    <div class="flex gap-2" role="group" aria-label="Haki Principal">
                        <button type="button" :class="[cartao, principal === 'armamento' ? ativo : inativo]" @click="principal = 'armamento'">
                            Haki do Armamento
                        </button>
                        <button type="button" :class="[cartao, principal === 'observacao' ? ativo : inativo]" @click="principal = 'observacao'">
                            Haki da Observação
                        </button>
                    </div>
                </section>

                <section v-if="pend.maestria" class="grid gap-2" aria-label="Traço de Maestria">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-preto-400">Traço de Maestria</h3>
                    <template v-if="!ficha.maestria">
                        <p class="text-xs text-preto-400">
                            Escolha a sua única Maestria (atributo mínimo e requisito adicional) e o primeiro traço dela.
                        </p>
                        <div class="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2" role="group" aria-label="Maestrias">
                            <button
                                v-for="m in MAESTRIAS"
                                :key="m.id"
                                type="button"
                                :disabled="!!motivoDaMaestria(m.id)"
                                :class="[cartao, maestriaId === m.id ? ativo : inativo, motivoDaMaestria(m.id) ? 'opacity-40' : '']"
                                :aria-pressed="maestriaId === m.id"
                                :title="motivoDaMaestria(m.id)"
                                @click="((maestriaId = m.id), (tracoId = ''), (confirmou = false))"
                            >
                                <span class="font-semibold">{{ m.nome }}</span>
                                <span class="block text-xs text-preto-400"
                                    >{{ m.atributos.map((a) => a.toUpperCase()).join(' ou ') }} {{ m.minimo
                                    }}{{ m.adicional ? ' · ' + m.adicional : '' }}</span
                                >
                            </button>
                        </div>
                        <label v-if="maestriaAtual?.adicional" class="flex items-center gap-2 text-xs text-preto-300">
                            <input v-model="confirmou" type="checkbox" class="size-3.5 accent-ouro-500" />
                            Cumpro o requisito adicional: {{ maestriaAtual.adicional }}
                        </label>
                    </template>
                    <p v-else class="text-xs text-preto-400">Maestria: {{ maestriaAtual?.nome }}. Escolha o próximo traço dela.</p>
                    <div v-if="maestriaAtual" class="grid gap-2" role="group" aria-label="Traços da Maestria">
                        <button
                            v-for="t in maestriaAtual.tracos"
                            :key="t.id"
                            type="button"
                            :disabled="tracosTidos.includes(t.id)"
                            :class="[cartao, tracoId === t.id ? ativo : inativo, tracosTidos.includes(t.id) ? 'opacity-40' : '']"
                            :aria-pressed="tracoId === t.id"
                            @click="tracoId = t.id"
                        >
                            <span class="font-semibold">{{ t.nome }}</span>
                            <span class="block text-xs text-preto-400">{{ t.descricao.slice(0, 160) }}{{ t.descricao.length > 160 ? '…' : '' }}</span>
                        </button>
                    </div>
                </section>

                <section v-if="precisaHB" class="grid gap-2" aria-label="Habilidade Básica">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-preto-400">
                        {{ pend.quebrador ? 'Quebrador de Regras: segunda característica' : 'Habilidade Básica' }}
                    </h3>
                    <div
                        v-if="!pend.quebrador"
                        class="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2"
                        role="group"
                        aria-label="Habilidades Básicas"
                    >
                        <button
                            v-for="h in hbsDisponiveis"
                            :key="h.id"
                            type="button"
                            :class="[cartao, hbId === h.id ? ativo : inativo]"
                            :aria-pressed="hbId === h.id"
                            @click="((hbId = h.id), (hbOpcao = ''))"
                        >
                            <span class="font-semibold">{{ h.nome }}</span>
                            <span class="block text-xs text-preto-400">{{ h.resumo }}</span>
                        </button>
                    </div>
                    <div
                        v-if="opcoesDaHB.length"
                        class="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2"
                        role="group"
                        aria-label="Opção da habilidade"
                    >
                        <button
                            v-for="o in opcoesDaHB"
                            :key="o.id"
                            type="button"
                            :class="[cartao, hbOpcao === o.id ? ativo : inativo]"
                            @click="hbOpcao = o.id"
                        >
                            <span class="font-semibold">{{ o.nome }}</span>
                            <span v-if="o.descricao" class="block text-xs text-preto-400">{{ o.descricao }}</span>
                        </button>
                    </div>
                </section>

                <section class="grid gap-1" aria-label="Pontos de vida">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-preto-400">PV ganhos</h3>
                    <div class="flex items-center gap-2">
                        <input
                            v-model.number="esc.pvGanho"
                            type="number"
                            min="1"
                            max="99"
                            class="w-20 rounded border border-preto-700 bg-preto-950 px-2 py-1 text-sm"
                            aria-label="PV ganhos"
                        />
                        <Button type="button" variant="outline" size="sm" class="border-preto-700" @click="esc.pvGanho = media">
                            Média ({{ ficha.dadosVida.tipo }} → {{ media }})
                        </Button>
                        <span class="text-xs text-preto-400"
                            >{{ ficha.dadosVida.tipo }} + CON ({{ modCon >= 0 ? '+' : '' }}{{ modCon }}); ou digite o resultado da rolagem.</span
                        >
                    </div>
                    <p class="text-xs text-preto-400">
                        PP +{{ ficha.pp.porNivel }}, +1 dado de vida e as técnicas do estilo para o {{ novo }}º nível entram sozinhos.
                    </p>
                </section>

                <ul v-if="problemas.length" class="list-disc pl-5 text-xs text-red-300" role="alert">
                    <li v-for="m in problemas" :key="m">{{ m }}</li>
                </ul>
                <p v-if="erro" class="text-xs text-red-300">{{ erro }}</p>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" class="border-preto-700" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="button" :disabled="problemas.length > 0" @click="subir">Subir para o {{ novo }}º nível</Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
