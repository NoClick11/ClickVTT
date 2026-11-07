<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { dadosValidos } from '../../nucleo/efeitos/efeitos';
import { EXPERTISES, KOKUTO, MAX_FIO, MEITO, TIPOS_DE_DANO_FISICO, YOTO, meitoPorId, yotoPorId, type ForjaDaArma } from './itens/forja';
import { ATRIBUTOS, type DadosItemOnePiece } from './regras';

/**
 * Editor dos `dados` de um item de D&D 5e: item comum, armadura (tipo + CA base, ou bônus do escudo) ou arma (dado de
 * dano, atributos do ataque e do dano, proficiência, bônus de acerto e de dano, margem crítica e dados extras de dano).
 * Recebe e emite os `dados` (`null` = item comum).
 */
const props = defineProps<{ modelValue: Record<string, unknown> | null }>();
const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown> | null] }>();

type Tipo = 'comum' | 'armadura' | 'arma' | 'municao';
const inicial = (props.modelValue ?? {}) as DadosItemOnePiece;

const tipo = ref<Tipo>(inicial.armadura ? 'armadura' : inicial.arma ? 'arma' : inicial.municao ? 'municao' : 'comum');
/** Munição criada à mão: serve a qualquer arma por munição; ao atacar dá o dado e o tipo do dano e gasta 1 unidade. */
const municao = ref({ dano: inicial.municao?.dano ?? '1d6', tipoDano: inicial.municao?.tipoDano ?? '', nota: inicial.municao?.nota ?? '' });
const armadura = ref({ tipo: inicial.armadura?.tipo ?? 'leve', base: inicial.armadura?.base ?? 11 });
const arma = ref({
    dano: inicial.arma?.dano ?? '1d8',
    /** Arma por munição: o dado e o tipo do dano vêm da munição escolhida ao atacar. */
    municao: inicial.arma?.municao === true,
    atributo: inicial.arma?.atributo ?? 'for',
    /** Vazio = o dano usa o mesmo atributo do ataque. */
    atributoDano: (inicial.arma?.atributoDano ?? '') as string,
    tipoDano: inicial.arma?.tipoDano ?? '',
    proficiente: inicial.arma?.proficiente ?? true,
    // Armas antigas só têm `bonusMagico` (um valor para os dois): ele preenche acerto e dano ao abrir.
    bonusAtaque: inicial.arma?.bonusAtaque ?? inicial.arma?.bonusMagico ?? 0,
    bonusDano: inicial.arma?.bonusDano ?? inicial.arma?.bonusMagico ?? 0,
    margemCritica: inicial.arma?.margemCritica ?? 20,
    /** Arma à distância (o anão com Armas Reduzidas causa metade do dano) e tamanho da arma (gigantes só usam armas de gigante). */
    distancia: inicial.arma?.distancia ?? false,
    /** Alcance em metros (obrigatório): à distância, o normal e o máximo; corpo a corpo, o alcance da arma nos dois (1,5 m; 3 m com a propriedade Alcance). */
    alcanceNormal: inicial.arma?.alcanceNormal ?? (inicial.arma?.distancia ? 9 : 1.5),
    alcanceMaximo: inicial.arma?.alcanceMaximo ?? (inicial.arma?.distancia ? 18 : 1.5),
    tamanho: (inicial.arma?.tamanho ?? 'padrao') as 'padrao' | 'gigante',
    /** Dados extras só desta arma (ex.: +2d6 de fogo), até 3. */
    danoExtra: (inicial.arma?.danoExtra ?? []).map((x) => ({ dados: x.dados, tipo: x.tipo ?? '' })),
});
/** O alcance é obrigatório: os dois valores existem, são positivos e o máximo não é menor que o normal. */
const alcanceInvalido = computed(() => {
    const n = Number(arma.value.alcanceNormal);
    const m = Number(arma.value.alcanceMaximo);

    return !(n >= 0.5 && m >= 0.5 && m >= n);
});
/** Trocar entre corpo a corpo e à distância sugere o alcance típico (só enquanto ainda é o valor padrão do outro tipo). */
watch(
    () => arma.value.distancia,
    (aDistancia) => {
        const a = arma.value;
        if (aDistancia && a.alcanceNormal === 1.5 && a.alcanceMaximo === 1.5) [a.alcanceNormal, a.alcanceMaximo] = [9, 18];
        else if (!aDistancia && a.alcanceNormal === 9 && a.alcanceMaximo === 18) [a.alcanceNormal, a.alcanceMaximo] = [1.5, 1.5];
    },
);
const MAX_DANO_EXTRA = 3;

/** Forja da arma: Meito (qualidade), Kokuto, Yoto, Expertise (até 2), Densidade, Dureza, Balanço e Fio. Valem sozinhos com a arma equipada. */
const f0 = (inicial.arma?.forja ?? {}) as ForjaDaArma;
const forja = ref({
    meito: (f0.meito ?? '') as string,
    kokuto: f0.kokuto ?? false,
    yoto: (f0.yoto ?? '') as string,
    expertise1: f0.expertise?.[0] ?? '',
    expertise2: f0.expertise?.[1] ?? '',
    densidade: (f0.densidade ?? '') as string,
    dureza: f0.dureza ?? false,
    balanco: f0.balanco ?? false,
    fio: f0.fio ?? 0,
});
const forjaAberta = ref(!!inicial.arma?.forja);
/** Os dados de forja preenchidos (vazio = arma sem forja). */
function montarForja(): ForjaDaArma | null {
    const x = forja.value;
    const expertise = [x.expertise1, x.expertise2].filter((e, i, l) => e && l.indexOf(e) === i);
    const f: ForjaDaArma = {
        ...(x.meito ? { meito: x.meito as ForjaDaArma['meito'] } : {}),
        ...(x.meito && x.kokuto ? { kokuto: true } : {}),
        ...(x.meito && x.yoto ? { yoto: x.yoto as ForjaDaArma['yoto'] } : {}),
        ...(expertise.length ? { expertise } : {}),
        ...(x.densidade ? { densidade: x.densidade } : {}),
        ...(x.dureza ? { dureza: true } : {}),
        ...(x.densidade && x.balanco ? { balanco: true } : {}),
        ...(Number(x.fio) > 0 ? { fio: Math.min(MAX_FIO, Math.floor(Number(x.fio))) } : {}),
    };

    return Object.keys(f).length ? f : null;
}

const TIPOS_DE_ITEM: { id: Tipo; rotulo: string }[] = [
    { id: 'comum', rotulo: 'Comum' },
    { id: 'armadura', rotulo: 'Armadura / escudo' },
    { id: 'arma', rotulo: 'Arma' },
    { id: 'municao', rotulo: 'Munição' },
];
const TIPOS_ARMADURA = [
    { id: 'leve', rotulo: 'Leve', dica: 'CA = base + modificador de Destreza' },
    { id: 'media', rotulo: 'Média', dica: 'CA = base + Destreza (no máximo +2)' },
    { id: 'pesada', rotulo: 'Pesada', dica: 'CA = base, sem Destreza' },
    { id: 'escudo', rotulo: 'Escudo', dica: 'Soma o bônus à CA' },
] as const;

/** Os dados extras preenchidos (linhas em branco não contam). */
const extras = (lista: { dados: string; tipo: string }[]) =>
    lista.map((x) => ({ dados: x.dados.trim().toLowerCase(), ...(x.tipo.trim() ? { tipo: x.tipo.trim() } : {}) })).filter((x) => x.dados !== '');
const adicionarExtra = () => arma.value.danoExtra.push({ dados: '1d6', tipo: '' });
const removerExtra = (i: number) => arma.value.danoExtra.splice(i, 1);

function montar(): Record<string, unknown> | null {
    if (tipo.value === 'armadura') return { armadura: { tipo: armadura.value.tipo, base: Number(armadura.value.base) } };
    if (tipo.value === 'municao') {
        const m = municao.value;

        return {
            municao: {
                dano: m.dano.trim().toLowerCase(),
                ...(m.tipoDano.trim() ? { tipoDano: m.tipoDano.trim() } : {}),
                ...(m.nota.trim() ? { nota: m.nota.trim() } : {}),
            },
        };
    }
    if (tipo.value === 'arma') {
        const a = arma.value;

        return {
            arma: {
                ...(a.municao ? { municao: true } : { dano: a.dano.trim() }),
                atributo: a.atributo,
                ...(a.atributoDano ? { atributoDano: a.atributoDano } : {}),
                ...(a.tipoDano.trim() ? { tipoDano: a.tipoDano.trim() } : {}),
                proficiente: a.proficiente,
                bonusAtaque: Number(a.bonusAtaque) || 0,
                bonusDano: Number(a.bonusDano) || 0,
                margemCritica: Number(a.margemCritica),
                ...(a.distancia ? { distancia: true } : {}),
                alcanceNormal: Number(a.alcanceNormal),
                alcanceMaximo: Number(a.alcanceMaximo),
                ...(a.tamanho === 'gigante' ? { tamanho: 'gigante' as const } : {}),
                ...(extras(a.danoExtra).length ? { danoExtra: extras(a.danoExtra) } : {}),
                ...(montarForja() ? { forja: montarForja()! } : {}),
            },
        };
    }

    return null;
}
watch([tipo, armadura, arma, municao], () => emit('update:modelValue', montar()), { deep: true });

const campo =
    'w-full rounded-md border border-preto-700 bg-preto-950 px-2.5 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
/** O mesmo campo sem a largura total: nas linhas de dano extra (dados + tipo + remover) quem define a largura é a própria linha. */
const campoLinha = campo.replace('w-full ', '');
</script>

<template>
    <section class="grid gap-2 rounded-lg border border-preto-800 bg-preto-900/50 p-3" aria-label="Tipo do item (D&D 5e)">
        <h3 :class="rotulo" class="mb-0">Tipo do item</h3>
        <div class="flex gap-1" role="radiogroup" aria-label="Tipo do item">
            <button
                v-for="t in TIPOS_DE_ITEM"
                :key="t.id"
                type="button"
                role="radio"
                :aria-checked="tipo === t.id"
                class="rounded-md border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="
                    tipo === t.id
                        ? 'border-ouro-400 bg-ouro-500/20 font-semibold text-ouro-100'
                        : 'border-preto-700 text-preto-300 hover:border-ouro-500/50'
                "
                @click="tipo = t.id"
            >
                {{ t.rotulo }}
            </button>
        </div>

        <div v-if="tipo === 'armadura'" class="grid gap-2 sm:grid-cols-2">
            <label>
                <span :class="rotulo">Tipo</span>
                <select v-model="armadura.tipo" :class="campo" aria-label="Tipo de armadura">
                    <option v-for="t in TIPOS_ARMADURA" :key="t.id" :value="t.id" :title="t.dica">{{ t.rotulo }} — {{ t.dica }}</option>
                </select>
            </label>
            <label>
                <span :class="rotulo">{{ armadura.tipo === 'escudo' ? 'Bônus de CA' : 'CA base' }}</span>
                <input
                    v-model.number="armadura.base"
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    :class="campo"
                    :aria-label="armadura.tipo === 'escudo' ? 'Bônus de CA do escudo' : 'CA base da armadura'"
                />
            </label>
        </div>

        <div v-if="tipo === 'municao'" class="grid gap-2 sm:grid-cols-3">
            <label
                ><span :class="rotulo">Dano (dados)</span
                ><input
                    v-model="municao.dano"
                    type="text"
                    maxlength="6"
                    placeholder="1d8"
                    spellcheck="false"
                    :class="campo"
                    class="font-mono"
                    aria-label="Dado de dano da munição, ex.: 1d8"
            /></label>
            <label
                ><span :class="rotulo">Tipo de dano</span
                ><input
                    v-model="municao.tipoDano"
                    type="text"
                    maxlength="30"
                    placeholder="perfurante"
                    :class="campo"
                    aria-label="Tipo de dano da munição"
            /></label>
            <label class="sm:col-span-3"
                ><span :class="rotulo">Efeito especial (lembrete no card)</span
                ><input v-model="municao.nota" type="text" maxlength="300" :class="campo" aria-label="Efeito especial da munição"
            /></label>
        </div>

        <div v-if="tipo === 'arma'" class="grid gap-2 sm:grid-cols-3">
            <label class="flex items-center gap-2 text-xs text-preto-200 sm:col-span-3"
                ><input v-model="arma.municao" type="checkbox" class="size-4 accent-ouro-400" />Dano pela munição (pistola, arco...): escolhe a
                munição ao atacar</label
            >
            <label v-if="!arma.municao"
                ><span :class="rotulo">Dano (dados)</span
                ><input
                    v-model="arma.dano"
                    type="text"
                    maxlength="6"
                    placeholder="1d8"
                    spellcheck="false"
                    :class="campo"
                    class="font-mono"
                    aria-label="Dado de dano, ex.: 1d8 (até 50 dados)"
            /></label>
            <label>
                <span :class="rotulo">Atributo do ataque</span>
                <select v-model="arma.atributo" :class="campo" aria-label="Atributo do ataque">
                    <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id">{{ a.nome }}</option>
                    <option value="acuidade">Acuidade (o maior entre Força e Destreza)</option>
                </select>
            </label>
            <label>
                <span :class="rotulo">Atributo do dano</span>
                <select v-model="arma.atributoDano" :class="campo" aria-label="Atributo do dano">
                    <option value="">Igual ao do ataque</option>
                    <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id">{{ a.nome }}</option>
                    <option value="acuidade">Acuidade (o maior entre Força e Destreza)</option>
                    <option value="nenhum">Nenhum (dano sem modificador)</option>
                </select>
            </label>
            <label
                ><span :class="rotulo">Tipo de dano</span
                ><input v-model="arma.tipoDano" type="text" maxlength="30" placeholder="cortante" :class="campo" aria-label="Tipo de dano"
            /></label>
            <label
                ><span :class="rotulo">Bônus de acerto</span
                ><input
                    v-model.number="arma.bonusAtaque"
                    type="number"
                    min="-10"
                    max="20"
                    step="1"
                    :class="campo"
                    aria-label="Bônus somado ao acerto (ex.: 1, 2, 3)"
            /></label>
            <label
                ><span :class="rotulo">Bônus de dano</span
                ><input
                    v-model.number="arma.bonusDano"
                    type="number"
                    min="-10"
                    max="20"
                    step="1"
                    :class="campo"
                    aria-label="Bônus somado ao dano (ex.: 1, 2, 3)"
            /></label>
            <label
                ><span :class="rotulo" title="d20 puro igual ou maior que isto é crítico">Margem crítica</span
                ><input
                    v-model.number="arma.margemCritica"
                    type="number"
                    min="10"
                    max="20"
                    step="1"
                    :class="campo"
                    aria-label="Margem crítica: d20 puro igual ou maior é crítico (20 padrão; 19 ou 18 em armas específicas)"
            /></label>
            <label class="flex items-end gap-2 pb-1.5 text-sm"
                ><input v-model="arma.proficiente" type="checkbox" class="size-4 accent-ouro-500" /> Proficiente</label
            >
            <label class="flex items-end gap-2 pb-1.5 text-sm" title="O anão (Armas Reduzidas) causa só metade do dano com armas à distância"
                ><input v-model="arma.distancia" type="checkbox" class="size-4 accent-ouro-500" /> À distância</label
            >
            <label
                ><span
                    :class="rotulo"
                    title="Alcance normal em metros: à distância, até onde o ataque não sofre desvantagem; corpo a corpo, o alcance da arma (1,5 m; 3 m com a propriedade Alcance)"
                    >Alcance normal (m)</span
                ><input
                    v-model.number="arma.alcanceNormal"
                    type="number"
                    min="0.5"
                    max="1000"
                    step="0.5"
                    required
                    :class="[campo, alcanceInvalido ? 'border-red-400' : '']"
                    aria-label="Alcance normal da arma, em metros (obrigatório)"
            /></label>
            <label
                ><span
                    :class="rotulo"
                    title="Alcance máximo em metros: além dele não se ataca. Limita as áreas das Técnicas que usam o alcance da arma"
                    >Alcance máximo (m)</span
                ><input
                    v-model.number="arma.alcanceMaximo"
                    type="number"
                    min="0.5"
                    max="1000"
                    step="0.5"
                    required
                    :class="[campo, alcanceInvalido ? 'border-red-400' : '']"
                    aria-label="Alcance máximo da arma, em metros (obrigatório, não menor que o normal)"
            /></label>
            <p v-if="alcanceInvalido" class="col-span-full text-xs text-red-300" role="alert">
                O alcance é obrigatório em toda arma: normal e máximo, em metros (o máximo não pode ser menor que o normal).
            </p>
            <label
                ><span :class="rotulo" title="Gigantes só usam armas de gigante, e nenhum outro tamanho usa a arma de um gigante"
                    >Tamanho da arma</span
                ><select v-model="arma.tamanho" :class="campo" aria-label="Tamanho da arma">
                    <option value="padrao">Padrão</option>
                    <option value="gigante">De gigante</option>
                </select></label
            >
        </div>

        <div
            v-if="tipo === 'arma'"
            class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/50 p-2.5"
            role="group"
            aria-label="Forja e lendas"
        >
            <button
                type="button"
                class="flex items-center justify-between text-left"
                :aria-expanded="forjaAberta"
                @click="forjaAberta = !forjaAberta"
            >
                <span :class="rotulo" class="mb-0">Forja e lendas (Meito, Yoto, Expertise, Pontos de Forja)</span>
                <span class="text-xs text-preto-400">{{ forjaAberta ? 'recolher' : 'abrir' }}</span>
            </button>
            <template v-if="forjaAberta">
                <p class="text-xs text-preto-400">
                    Tudo aqui vale sozinho com a arma equipada: dado mínimo, acerto, crítico e Fio mudam o ataque e o dano; a Expertise aparece no
                    card do acerto crítico (com proficiência); Densidade e Balanço passam por cima de resistência e invulnerabilidade ao aplicar o
                    dano.
                </p>
                <div class="grid gap-2 sm:grid-cols-3">
                    <label class="grid gap-1"
                        ><span :class="rotulo">Qualidade Meito</span>
                        <select v-model="forja.meito" :class="campo" aria-label="Qualidade Meito">
                            <option value="">Arma comum</option>
                            <option v-for="m in MEITO" :key="m.id" :value="m.id">{{ m.nome }} ({{ m.pf }} PF)</option>
                        </select>
                    </label>
                    <label class="grid gap-1"
                        ><span :class="rotulo">Maldição Yoto</span>
                        <select v-model="forja.yoto" :disabled="!forja.meito" :class="campo" aria-label="Maldição Yoto">
                            <option value="">Nenhuma</option>
                            <option v-for="y in YOTO" :key="y.id" :value="y.id">{{ y.nome }}</option>
                        </select>
                    </label>
                    <label class="flex items-end gap-2 pb-1.5 text-sm" title="Lâmina negra, extremamente rara mesmo entre as Meito"
                        ><input v-model="forja.kokuto" :disabled="!forja.meito" type="checkbox" class="size-4 accent-ouro-500" /> Espada Kokuto</label
                    >
                </div>
                <p v-if="meitoPorId(forja.meito)" class="text-xs text-preto-300">{{ meitoPorId(forja.meito)!.texto }}</p>
                <p v-if="yotoPorId(forja.yoto)" class="text-xs text-red-200">{{ yotoPorId(forja.yoto)!.texto }}</p>
                <p v-if="forja.kokuto" class="text-xs text-preto-300">{{ KOKUTO }}</p>
                <div class="grid gap-2 sm:grid-cols-2">
                    <label class="grid gap-1"
                        ><span :class="rotulo">Expertise (acerto crítico)</span>
                        <select v-model="forja.expertise1" :class="campo" aria-label="Expertise">
                            <option value="">Nenhuma</option>
                            <option v-for="e in EXPERTISES" :key="e.id" :value="e.id">{{ e.texto }}</option>
                        </select>
                    </label>
                    <label class="grid gap-1"
                        ><span :class="rotulo">Segunda Expertise (Supremacia)</span>
                        <select v-model="forja.expertise2" :disabled="!forja.expertise1" :class="campo" aria-label="Segunda Expertise">
                            <option value="">Nenhuma</option>
                            <option v-for="e in EXPERTISES" :key="e.id" :value="e.id">{{ e.texto }}</option>
                        </select>
                    </label>
                </div>
                <div class="grid gap-2 sm:grid-cols-4">
                    <label class="grid gap-1"
                        ><span :class="rotulo" title="Ignora a resistência ao tipo de dano">Densidade</span>
                        <select v-model="forja.densidade" :class="campo" aria-label="Densidade">
                            <option value="">Nenhuma</option>
                            <option v-for="t in TIPOS_DE_DANO_FISICO" :key="t" :value="t">{{ t }}</option>
                        </select>
                    </label>
                    <label class="flex items-end gap-2 pb-1.5 text-sm" title="Ignora a invulnerabilidade ao tipo da Densidade"
                        ><input v-model="forja.balanco" :disabled="!forja.densidade" type="checkbox" class="size-4 accent-ouro-500" /> Balanço</label
                    >
                    <label class="flex items-end gap-2 pb-1.5 text-sm" title="Indestrutível: nunca perde o fio"
                        ><input v-model="forja.dureza" type="checkbox" class="size-4 accent-ouro-500" /> Dureza</label
                    >
                    <label class="grid gap-1"
                        ><span :class="rotulo" title="Cada passo sobe o dado de dano: 1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 3d6"
                            >Fio (passos)</span
                        >
                        <input v-model.number="forja.fio" type="number" min="0" :max="MAX_FIO" :class="campo" aria-label="Fio: passos de dado" />
                    </label>
                </div>
            </template>
        </div>
        <div v-if="tipo === 'arma'" class="grid gap-1.5" role="group" aria-label="Dano extra em dados">
            <p :class="rotulo" class="mb-0" title="Dados somados ao dano desta arma (ex.: +2d6 de fogo); dobram no crítico">Dano extra em dados</p>
            <ul v-if="arma.danoExtra.length" class="grid gap-1.5">
                <li v-for="(x, i) in arma.danoExtra" :key="i" class="flex items-center gap-1.5">
                    <input
                        v-model="x.dados"
                        type="text"
                        maxlength="6"
                        placeholder="2d6"
                        spellcheck="false"
                        autocomplete="off"
                        :class="[
                            campoLinha,
                            'w-24 shrink-0 font-mono',
                            dadosValidos(x.dados.trim().toLowerCase()) || x.dados.trim() === '' ? '' : 'border-red-400',
                        ]"
                        :aria-label="`Dados do dano extra ${i + 1}`"
                    />
                    <input
                        v-model="x.tipo"
                        type="text"
                        maxlength="30"
                        placeholder="Tipo do dano (fogo)"
                        :class="campoLinha"
                        class="min-w-0 flex-1"
                        :aria-label="`Tipo do dano extra ${i + 1}`"
                    />
                    <button
                        type="button"
                        class="flex size-8 shrink-0 items-center justify-center rounded-md text-preto-400 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        :aria-label="`Remover o dano extra ${i + 1}`"
                        @click="removerExtra(i)"
                    >
                        <X class="size-4" />
                    </button>
                </li>
            </ul>
            <button
                v-if="arma.danoExtra.length < MAX_DANO_EXTRA"
                type="button"
                class="flex w-fit items-center gap-1 rounded-md border border-ouro-500/40 px-2.5 py-1 text-xs text-ouro-200 hover:bg-ouro-500/10"
                @click="adicionarExtra"
            >
                <Plus class="size-3.5" /> Dano extra
            </button>
        </div>

        <p v-if="tipo === 'municao'" class="text-xs text-preto-500">
            Munição criada por você serve a qualquer arma por munição (marque "Dano pela munição" na arma). Ao atacar o jogador a escolhe no
            inventário: ela dá o dado e o tipo do dano e gasta 1 unidade.
        </p>
        <p v-else-if="tipo === 'comum'" class="text-xs text-preto-500">Sem regras próprias; só os efeitos abaixo (se houver) valem.</p>
        <p v-else-if="tipo === 'arma'" class="text-xs text-preto-500">
            Os bônus de acerto e de dano são valores simples (1, 2, 3...) somados ao modificador do atributo; use-os para armas +1, +2 e assim por
            diante. O d20 do ataque, igual ou acima da margem crítica, é crítico (20 por padrão; 19 ou 18 em armas específicas): o botão de dano do
            card no chat rola todos os dados em dobro, inclusive os extras.
        </p>
    </section>
</template>
