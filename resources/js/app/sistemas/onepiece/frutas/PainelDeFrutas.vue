<script setup lang="ts">
import { computed, ref } from 'vue';
import { normalizarAkuma } from '../akuma/regras';
import type { FichaOnePiece } from '../regras';
import { FRUTAS, type FrutaDados } from './dados';
import { camposDaFruta } from './regras';

/**
 * Aba Frutas do mestre: as frutas prontas do sistema. Entregar uma fruta a um personagem põe o perfil da Akuma e libera só o que o nível dele
 * já alcançou; o resto chega ao subir de nível. Só mostra e emite (`salvar`): a mesa grava a ficha como qualquer outra mudança.
 */
const props = defineProps<{
    personagens: { id: number; nome: string; ficha?: Record<string, unknown> | null }[];
    fichas: Record<number, Record<string, unknown>>;
}>();
const emit = defineEmits<{ salvar: [personagemId: number, campos: Record<string, unknown>] }>();

const aberta = ref<string | null>(null);
const destino = ref<Record<string, number | ''>>({});
const fichaDe = (id: number) => (props.fichas[id] ?? props.personagens.find((p) => p.id === id)?.ficha ?? null) as unknown as FichaOnePiece | null;
/** Só personagens do One Piece com ficha (a de D&D, por exemplo, não tem Akuma). */
const candidatos = computed(() => props.personagens.filter((p) => !!fichaDe(p.id)?.akuma));
const donos = (fruta: FrutaDados) => candidatos.value.filter((p) => normalizarAkuma(fichaDe(p.id)!).fruta === fruta.id);
const nivelDe = (id: number) => Number(fichaDe(id)?.nivel ?? 1);

function entregar(fruta: FrutaDados) {
    const id = Number(destino.value[fruta.id]);
    const ficha = id ? fichaDe(id) : null;
    if (!ficha) return;
    emit('salvar', id, camposDaFruta(ficha, fruta.id));
    destino.value[fruta.id] = '';
}
function retirar(fruta: FrutaDados, personagemId: number) {
    const ficha = fichaDe(personagemId);
    if (!ficha || !confirm(`Tirar a ${fruta.nome} deste personagem? As Técnicas e características dela somem da ficha.`)) return;
    emit('salvar', personagemId, camposDaFruta(ficha, null));
}
const tecnicasPorNivel = (fruta: FrutaDados) =>
    [...fruta.tecnicas]
        .sort((a, b) => a.nivel - b.nivel)
        .map((x) => ({ nivel: x.nivel, nome: x.tecnica.nome, grau: x.grau ? `${x.grau}º Grau` : 'Auxiliar', custo: x.tecnica.custo }));
const campo =
    'min-w-0 flex-1 rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col text-sm text-preto-100">
        <p class="shrink-0 border-b border-preto-800 px-3 py-2 text-xs text-preto-400">
            Frutas prontas · a fruta entregue libera as Técnicas por nível, como numa progressão
        </p>
        <ul class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
            <li v-for="f in FRUTAS" :key="f.id" class="rounded-lg border border-preto-700 bg-preto-900/60">
                <button
                    type="button"
                    class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    :aria-expanded="aberta === f.id"
                    @click="aberta = aberta === f.id ? null : f.id"
                >
                    <span class="min-w-0">
                        <span class="block truncate font-semibold text-ouro-100">{{ f.nome }}</span>
                        <span class="block truncate text-xs text-preto-400"
                            >{{ f.apelido }} · {{ f.tipo }} {{ f.usuario === 'avancado' ? 'avançado' : '' }}</span
                        >
                    </span>
                    <span v-if="donos(f).length" class="shrink-0 rounded-full bg-ouro-500/20 px-2 text-[10px] text-ouro-200"
                        >{{ donos(f).length }} com a fruta</span
                    >
                </button>
                <div v-if="aberta === f.id" class="grid gap-2 border-t border-preto-800 px-3 py-2">
                    <p class="text-xs text-preto-300">{{ f.descricao }}</p>
                    <div v-if="f.tracos?.length" class="grid gap-1">
                        <span class="text-[11px] font-semibold uppercase tracking-wider text-ouro-300/80">Manifestações de Poder</span>
                        <ul class="grid gap-1 text-xs" aria-label="Manifestações de poder">
                            <li v-for="tr in f.tracos" :key="tr.id" class="rounded border border-preto-800 bg-preto-950/70 p-1.5">
                                <div class="font-medium text-ouro-200">{{ tr.nome }}</div>
                                <div class="text-[11px] leading-snug text-preto-400">{{ tr.descricao }}</div>
                            </li>
                        </ul>
                    </div>
                    <div class="grid gap-1">
                        <span class="text-[11px] font-semibold uppercase tracking-wider text-ouro-300/80">Técnicas por Nível</span>
                        <ul class="grid gap-0.5 text-xs" aria-label="Técnicas por nível">
                            <li v-for="t in tecnicasPorNivel(f)" :key="t.nome" class="flex items-center gap-2">
                                <span class="w-9 shrink-0 text-ouro-300">{{ t.nivel }}º</span>
                                <span class="min-w-0 flex-1 truncate">{{ t.nome }}</span>
                                <span class="shrink-0 text-preto-400">{{ t.grau }} · {{ t.custo }} PP</span>
                            </li>
                        </ul>
                    </div>
                    <form class="flex flex-wrap gap-1.5" @submit.prevent="entregar(f)">
                        <select v-model="destino[f.id]" :class="campo" :aria-label="`Personagem que recebe a ${f.nome}`">
                            <option value="" disabled>Entregar a…</option>
                            <option v-for="p in candidatos" :key="p.id" :value="p.id" :disabled="normalizarAkuma(fichaDe(p.id)!).fruta === f.id">
                                {{ p.nome }} (nível {{ nivelDe(p.id) }}){{ normalizarAkuma(fichaDe(p.id)!).fruta === f.id ? ' · já tem' : '' }}
                            </option>
                        </select>
                        <button
                            type="submit"
                            class="rounded bg-ouro-500 px-3 text-xs font-semibold text-preto-950 hover:bg-ouro-400 disabled:opacity-50"
                            :disabled="!destino[f.id]"
                        >
                            Entregar
                        </button>
                    </form>
                    <ul v-if="donos(f).length" class="grid gap-1" aria-label="Quem tem a fruta">
                        <li v-for="p in donos(f)" :key="p.id" class="flex items-center justify-between gap-2 text-xs">
                            <span class="truncate">{{ p.nome }} · nível {{ nivelDe(p.id) }}</span>
                            <button
                                type="button"
                                class="shrink-0 text-preto-500 hover:text-red-300"
                                :aria-label="`Tirar a fruta de ${p.nome}`"
                                @click="retirar(f, p.id)"
                            >
                                Tirar
                            </button>
                        </li>
                    </ul>
                </div>
            </li>
        </ul>
    </div>
</template>
