<script setup lang="ts">
import { ref, watch } from 'vue';
import { EXPERTISES, KOKUTO, MAX_FIO, MEITO, TIPOS_DE_DANO_FISICO, YOTO, meitoPorId, yotoPorId, type ForjaDaArma } from '../../itens/forja';

/**
 * Forja e lendas de uma arma: Meito (qualidade), Kokuto, Yoto, Expertise (até 2), Densidade, Dureza, Balanço e Fio.
 * Vale só na ficha que a ajusta (engrenagem do inventário); o `v-model` é a forja pronta, ou null quando não sobra nada.
 */
const props = defineProps<{ modelValue: ForjaDaArma | null | undefined }>();
const emit = defineEmits<{ 'update:modelValue': [forja: ForjaDaArma | null] }>();

const f0 = (props.modelValue ?? {}) as ForjaDaArma;
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

/** Os dados de forja preenchidos (null = arma sem forja). */
function montar(): ForjaDaArma | null {
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
watch(forja, () => emit('update:modelValue', montar()), { deep: true });

const campo =
    'w-full rounded-md border border-preto-700 bg-preto-950 px-2.5 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
</script>

<template>
    <div class="grid gap-2" role="group" aria-label="Forja e lendas">
        <p class="text-xs text-preto-400">
            Tudo aqui vale sozinho com a arma equipada: dado mínimo, acerto, crítico e Fio mudam o ataque e o dano; a Expertise aparece no card do
            acerto crítico (com proficiência); Densidade e Balanço passam por cima de resistência e invulnerabilidade ao aplicar o dano.
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
                ><span :class="rotulo" title="Cada passo sobe o dado de dano: 1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 3d6">Fio (passos)</span>
                <input v-model.number="forja.fio" type="number" min="0" :max="MAX_FIO" :class="campo" aria-label="Fio: passos de dado" />
            </label>
        </div>
    </div>
</template>
