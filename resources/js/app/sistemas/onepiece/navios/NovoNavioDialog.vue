<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { computed, ref, watch } from 'vue';
import { MADEIRAS, MODELOS, TAMANHOS, type TamanhoId } from './dados';
import { calcularNavio, navioDoModelo, navioPadrao } from './regras';

/** "Novo navio" (só o mestre): um modelo pronto do livro (14.6) ou um casco em branco (tamanho e madeira). */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
    'update:open': [boolean];
    criar: [dados: { nome: string; modelo?: string | null; tamanho?: string; madeira?: string }];
}>();

const nome = ref('');
const modelo = ref<string | null>(MODELOS[0].id);
const tamanho = ref<TamanhoId>('pequeno');
const madeira = ref('cedro');
watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        nome.value = '';
        modelo.value = MODELOS[0].id;
    },
);

/** O navio como ficaria, para mostrar os números antes de criar. */
const previa = computed(() => {
    let i = 0;
    const navio = modelo.value ? navioDoModelo(modelo.value, () => `p${i++}`) : navioPadrao(tamanho.value, madeira.value);
    if (!navio) return null;
    const c = calcularNavio(navio, 99999);
    const t = TAMANHOS.find((x) => x.id === navio.tamanho)!;

    return { c, t, navio };
});
const escolhido = computed(() => MODELOS.find((m) => m.id === modelo.value) ?? null);
const bellys = (n: number) => `฿ ${n.toLocaleString('pt-BR')}`;

function criar() {
    const n = nome.value.trim() || escolhido.value?.nome || 'Navio';
    emit('criar', modelo.value ? { nome: n, modelo: modelo.value } : { nome: n, tamanho: tamanho.value, madeira: madeira.value });
}
const opcao =
    'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
const campo =
    'rounded border border-preto-700 bg-preto-950 px-2 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Novo navio</DialogTitle>
                <DialogDescription>
                    Escolha um modelo do livro, já montado e com os cômodos vazios, ou comece só com o casco. Tudo pode ser trocado depois na ficha.
                </DialogDescription>
            </DialogHeader>
            <label class="grid gap-1 text-xs text-preto-300">
                Nome do navio
                <input v-model="nome" type="text" maxlength="60" :placeholder="escolhido?.nome ?? 'Navio'" :class="campo" />
            </label>
            <div class="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
                <ul class="grid content-start gap-1" aria-label="Modelos de embarcação">
                    <li v-for="m in MODELOS" :key="m.id">
                        <button
                            type="button"
                            :class="[
                                opcao,
                                modelo === m.id ? 'border-ouro-400 bg-ouro-500/10' : 'border-preto-800 bg-preto-900/60 hover:border-preto-600',
                            ]"
                            :aria-pressed="modelo === m.id"
                            @click="modelo = m.id"
                        >
                            <span class="min-w-0 flex-1 truncate font-medium">{{ m.nome }}</span>
                            <span v-if="m.preco" class="shrink-0 text-xs text-preto-400">{{ bellys(m.preco) }}</span>
                        </button>
                    </li>
                    <li>
                        <button
                            type="button"
                            :class="[
                                opcao,
                                modelo === null ? 'border-ouro-400 bg-ouro-500/10' : 'border-preto-800 bg-preto-900/60 hover:border-preto-600',
                            ]"
                            :aria-pressed="modelo === null"
                            @click="modelo = null"
                        >
                            <span class="font-medium">Em branco (só o casco)</span>
                        </button>
                    </li>
                </ul>

                <div class="rounded-md border border-preto-800 bg-preto-900/40 p-3 text-sm">
                    <div v-if="modelo === null" class="mb-3 grid grid-cols-2 gap-2">
                        <label class="grid gap-1 text-xs text-preto-300">
                            Tamanho
                            <select v-model="tamanho" :class="campo">
                                <option v-for="t in TAMANHOS" :key="t.id" :value="t.id">{{ t.nome }}</option>
                            </select>
                        </label>
                        <label class="grid gap-1 text-xs text-preto-300">
                            Madeira
                            <select v-model="madeira" :class="campo">
                                <option v-for="m in MADEIRAS" :key="m.id" :value="m.id">{{ m.nome }} (CR {{ m.cr }}, BR {{ m.br }})</option>
                            </select>
                        </label>
                    </div>
                    <template v-if="previa">
                        <h3 class="font-serif text-lg font-semibold text-ouro-300">{{ escolhido?.nome ?? `Navio ${previa.t.nome}` }}</h3>
                        <p v-if="escolhido" class="mb-2 text-xs text-preto-400">{{ escolhido.texto }}</p>
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <dt class="text-preto-400">Classe de Resistência</dt>
                            <dd class="text-right font-semibold text-preto-100">{{ previa.c.cr }}</dd>
                            <dt class="text-preto-400">Bônus de Resistência</dt>
                            <dd class="text-right font-semibold text-preto-100">{{ previa.c.br }}</dd>
                            <dt class="text-preto-400">Pontos de Vida</dt>
                            <dd class="text-right font-semibold text-preto-100">{{ previa.c.pvMax }}</dd>
                            <dt class="text-preto-400">Deslocamento</dt>
                            <dd class="text-right font-semibold text-preto-100">
                                {{ previa.c.velocidade }} nós · {{ previa.c.metrosPorRodada }} m/rodada
                            </dd>
                            <dt class="text-preto-400">Cômodos</dt>
                            <dd class="text-right font-semibold text-preto-100">até {{ previa.c.comodosMax }}</dd>
                            <dt class="text-preto-400">Tripulantes</dt>
                            <dd class="text-right font-semibold text-preto-100">até {{ previa.c.lotacao }}</dd>
                            <dt class="text-preto-400">Canhões</dt>
                            <dd class="text-right font-semibold text-preto-100">{{ previa.c.canhoes }} de {{ previa.c.canhoesMax }}</dd>
                            <dt class="text-preto-400">Dimensão (L × C × A)</dt>
                            <dd class="text-right font-semibold text-preto-100">{{ previa.t.dimensao }}</dd>
                        </dl>
                        <p v-if="modelo === null" class="mt-2 text-xs text-preto-400">
                            Sem mastros nem canhões: instale-os pela aba Construção (o mestre pode pôr peças sem custo).
                        </p>
                    </template>
                    <Button type="button" class="mt-3 w-full bg-ouro-500 font-semibold text-preto-950 hover:bg-ouro-400" @click="criar"
                        >Criar navio</Button
                    >
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
