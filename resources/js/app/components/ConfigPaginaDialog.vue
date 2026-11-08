<script setup lang="ts">
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Campo from '@/site/components/Campo.vue';
import { computed, ref, watch } from 'vue';
import type { PaginaDto } from '../engine/tipos';

const props = defineProps<{ open: boolean; pagina: PaginaDto | null; erro?: string }>();
const emit = defineEmits<{ 'update:open': [boolean]; salvar: [id: number, campos: Partial<PaginaDto>]; limparMemoria: [id: number] }>();

const f = ref({
    nome: '',
    colunas: 25,
    linhas: 25,
    tamanho_quadrado: 100,
    grade_quadrada: true,
    distancia_quadrado: 1.5,
    unidade: 'm',
    iluminacao_ativa: false,
    luz_ambiente: 0,
    visao_padrao: 6,
    usar_visao: true,
    memoria_ativa: true,
});
const campo =
    'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

watch(
    () => [props.open, props.pagina] as const,
    ([aberto, p]) => {
        if (aberto && p) {
            f.value = {
                nome: p.nome,
                colunas: p.colunas,
                linhas: p.linhas,
                tamanho_quadrado: p.tamanho_quadrado,
                grade_quadrada: p.grade_quadrada,
                distancia_quadrado: p.distancia_quadrado,
                unidade: p.unidade,
                iluminacao_ativa: p.iluminacao_ativa,
                luz_ambiente: p.luz_ambiente,
                visao_padrao: p.visao_padrao,
                usar_visao: p.usar_visao,
                memoria_ativa: p.memoria_ativa,
            };
        }
    },
);

/** Atalhos de luz ambiente. */
const predefinicoes = [
    { nome: 'Dia', valor: 100 },
    { nome: 'Entardecer', valor: 60 },
    { nome: 'Penumbra', valor: 30 },
    { nome: 'Noite', valor: 10 },
    { nome: 'Breu', valor: 0 },
];

const resumo = computed(() => {
    const total = Math.round(f.value.colunas * f.value.distancia_quadrado * 100) / 100;
    const alto = Math.round(f.value.linhas * f.value.distancia_quadrado * 100) / 100;

    return `${f.value.colunas} × ${f.value.linhas} quadrados = ${total} × ${alto} ${f.value.unidade}`;
});

function salvar() {
    if (props.pagina) emit('salvar', props.pagina.id, { ...f.value });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Configurações da página</DialogTitle>
                <DialogDescription>Nome, tamanho e grade do mapa.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="salvar">
                <Campo label="Nome da página" for="p-nome" obrigatorio><Input id="p-nome" v-model="f.nome" /></Campo>
                <div class="grid grid-cols-2 gap-3">
                    <Campo label="Colunas" for="p-col"><Input id="p-col" v-model.number="f.colunas" type="number" min="1" max="300" /></Campo>
                    <Campo label="Linhas" for="p-lin"><Input id="p-lin" v-model.number="f.linhas" type="number" min="1" max="300" /></Campo>
                </div>
                <p class="-mt-2 text-xs text-muted-foreground">{{ resumo }}</p>
                <label class="flex items-start gap-3 rounded-md border p-3">
                    <input v-model="f.grade_quadrada" type="checkbox" class="mt-0.5 size-4 accent-ouro-500" />
                    <span>
                        <span class="block text-sm font-medium">Modo quadrado</span>
                        <span class="text-xs text-muted-foreground"
                            >Mostra a grade e prende objetos aos quadrados. Desligado, o posicionamento é livre.</span
                        >
                    </span>
                </label>
                <div class="grid grid-cols-3 gap-3">
                    <Campo label="Pixels / quadrado" for="p-px"
                        ><Input id="p-px" v-model.number="f.tamanho_quadrado" type="number" min="10" max="400"
                    /></Campo>
                    <Campo label="Distância / quadrado" for="p-dist"
                        ><Input id="p-dist" v-model.number="f.distancia_quadrado" type="number" min="0.1" step="0.1"
                    /></Campo>
                    <Campo label="Unidade" for="p-un">
                        <select id="p-un" v-model="f.unidade" :class="campo">
                            <option value="m">metros</option>
                            <option value="ft">pés</option>
                            <option value="km">km</option>
                        </select>
                    </Campo>
                </div>
                <div class="grid gap-3 rounded-md border p-3">
                    <label class="flex items-start gap-3">
                        <input v-model="f.iluminacao_ativa" type="checkbox" class="mt-0.5 size-4 accent-ouro-500" />
                        <span>
                            <span class="block text-sm font-medium">Iluminação dinâmica</span>
                            <span class="text-xs text-muted-foreground"
                                >Os jogadores só veem o que os tokens deles enxergam, iluminado e sem atravessar paredes. Cada um calcula as sombras
                                no próprio computador.</span
                            >
                        </span>
                    </label>
                    <div v-if="f.iluminacao_ativa" class="grid gap-3">
                        <div class="grid gap-1.5">
                            <span class="text-sm font-medium">Luz ambiente: {{ f.luz_ambiente }}%</span>
                            <input
                                v-model.number="f.luz_ambiente"
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                class="accent-ouro-500"
                                aria-label="Luz ambiente"
                            />
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="p in predefinicoes"
                                    :key="p.nome"
                                    type="button"
                                    class="rounded-md border px-2 py-1 text-xs transition hover:bg-accent"
                                    :class="f.luz_ambiente === p.valor ? 'border-ouro-500 text-ouro-300' : ''"
                                    @click="f.luz_ambiente = p.valor"
                                >
                                    {{ p.nome }}
                                </button>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                100% ilumina tudo (dia): ninguém precisa de luz para ver, mas a linha de visão ainda vale. 0% é breu: só luzes e a
                                visão no escuro dos tokens enxergam. Para deixar tudo claro e sem sombras, desligue a iluminação dinâmica.
                            </p>
                        </div>
                        <label class="flex items-start gap-3">
                            <input v-model="f.usar_visao" type="checkbox" class="mt-0.5 size-4 accent-ouro-500" />
                            <span>
                                <span class="block text-sm font-medium">Linha de visão dos tokens</span>
                                <span class="text-xs text-muted-foreground"
                                    >O jogador só vê o que o token dele enxerga em linha reta (paredes e portas fechadas bloqueiam). Desligado, vale
                                    só a luz do mapa.</span
                                >
                            </span>
                        </label>
                        <label v-if="f.usar_visao" class="flex items-start gap-3">
                            <input v-model="f.memoria_ativa" type="checkbox" class="mt-0.5 size-4 accent-ouro-500" />
                            <span>
                                <span class="block text-sm font-medium">Lembrar das áreas exploradas</span>
                                <span class="text-xs text-muted-foreground"
                                    >O que o jogador já viu fica no mapa, esmaecido, sem mostrar quem está lá agora.</span
                                >
                            </span>
                        </label>
                        <Campo label="Visão no escuro dos tokens (quadrados)" for="p-vis"
                            ><Input id="p-vis" v-model.number="f.visao_padrao" type="number" min="0" max="200"
                        /></Campo>
                        <Button
                            v-if="pagina && f.usar_visao && f.memoria_ativa"
                            type="button"
                            variant="outline"
                            size="sm"
                            class="justify-self-start"
                            @click="emit('limparMemoria', pagina.id)"
                            >Apagar a memória de todos os jogadores nesta página</Button
                        >
                    </div>
                </div>
                <InputError :message="erro" />
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400">Salvar</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
