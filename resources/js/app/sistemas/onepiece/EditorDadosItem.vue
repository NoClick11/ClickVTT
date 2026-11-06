<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { dadosValidos } from '../../nucleo/efeitos/efeitos';
import { ATRIBUTOS, type DadosItemOnePiece } from './regras';

/**
 * Editor dos `dados` de um item de D&D 5e: item comum, armadura (tipo + CA base, ou bônus do escudo) ou arma (dado de
 * dano, atributos do ataque e do dano, proficiência, bônus de acerto e de dano, margem crítica e dados extras de dano).
 * Recebe e emite os `dados` (`null` = item comum).
 */
const props = defineProps<{ modelValue: Record<string, unknown> | null }>();
const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown> | null] }>();

type Tipo = 'comum' | 'armadura' | 'arma';
const inicial = (props.modelValue ?? {}) as DadosItemOnePiece;

const tipo = ref<Tipo>(inicial.armadura ? 'armadura' : inicial.arma ? 'arma' : 'comum');
const armadura = ref({ tipo: inicial.armadura?.tipo ?? 'leve', base: inicial.armadura?.base ?? 11 });
const arma = ref({
    dano: inicial.arma?.dano ?? '1d8',
    atributo: inicial.arma?.atributo ?? 'for',
    /** Vazio = o dano usa o mesmo atributo do ataque. */
    atributoDano: (inicial.arma?.atributoDano ?? '') as string,
    tipoDano: inicial.arma?.tipoDano ?? '',
    proficiente: inicial.arma?.proficiente ?? true,
    // Armas antigas só têm `bonusMagico` (um valor para os dois): ele preenche acerto e dano ao abrir.
    bonusAtaque: inicial.arma?.bonusAtaque ?? inicial.arma?.bonusMagico ?? 0,
    bonusDano: inicial.arma?.bonusDano ?? inicial.arma?.bonusMagico ?? 0,
    margemCritica: inicial.arma?.margemCritica ?? 20,
    /** Dados extras só desta arma (ex.: +2d6 de fogo), até 3. */
    danoExtra: (inicial.arma?.danoExtra ?? []).map((x) => ({ dados: x.dados, tipo: x.tipo ?? '' })),
});
const MAX_DANO_EXTRA = 3;

const TIPOS_DE_ITEM: { id: Tipo; rotulo: string }[] = [
    { id: 'comum', rotulo: 'Comum' },
    { id: 'armadura', rotulo: 'Armadura / escudo' },
    { id: 'arma', rotulo: 'Arma' },
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
    if (tipo.value === 'arma') {
        const a = arma.value;

        return {
            arma: {
                dano: a.dano.trim(),
                atributo: a.atributo,
                ...(a.atributoDano ? { atributoDano: a.atributoDano } : {}),
                ...(a.tipoDano.trim() ? { tipoDano: a.tipoDano.trim() } : {}),
                proficiente: a.proficiente,
                bonusAtaque: Number(a.bonusAtaque) || 0,
                bonusDano: Number(a.bonusDano) || 0,
                margemCritica: Number(a.margemCritica),
                ...(extras(a.danoExtra).length ? { danoExtra: extras(a.danoExtra) } : {}),
            },
        };
    }

    return null;
}
watch([tipo, armadura, arma], () => emit('update:modelValue', montar()), { deep: true });

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

        <div v-if="tipo === 'arma'" class="grid gap-2 sm:grid-cols-3">
            <label
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

        <p v-if="tipo === 'comum'" class="text-xs text-preto-500">Sem regras próprias; só os efeitos abaixo (se houver) valem.</p>
        <p v-else-if="tipo === 'arma'" class="text-xs text-preto-500">
            Os bônus de acerto e de dano são valores simples (1, 2, 3...) somados ao modificador do atributo; use-os para armas +1, +2 e assim por
            diante. O d20 do ataque, igual ou acima da margem crítica, é crítico (20 por padrão; 19 ou 18 em armas específicas): o botão de dano do
            card no chat rola todos os dados em dobro, inclusive os extras.
        </p>
    </section>
</template>
