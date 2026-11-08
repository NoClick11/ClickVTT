<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from 'lucide-vue-next';
import { computed } from 'vue';
import { CAMADAS, type Camada, type CamposGeometria, type ObjetoDto, type PaginaDto, type TipoParede } from '../engine/tipos';

const props = defineProps<{ objeto: ObjetoDto; pagina: PaginaDto }>();
const emit = defineEmits<{ atualizar: [campos: Partial<ObjetoDto>]; remover: [] }>();

const t = computed(() => props.pagina.tamanho_quadrado);
const camadasPossiveis = computed(() => CAMADAS.filter((c) => c.id !== 'iluminacao'));
const emQuadrados = (px: number) => Math.round((px / t.value) * 100) / 100;
const distancia = (px: number) => Math.round((px / t.value) * props.pagina.distancia_quadrado * 100) / 100;

function tamanho(campo: 'largura' | 'altura', e: Event) {
    const q = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));
    if (!Number.isFinite(q) || q <= 0) return;
    emit('atualizar', { [campo]: q * t.value } as CamposGeometria);
}
const campo = 'h-8 border-ouro-500/20 bg-preto-900 px-2 text-sm';
</script>

<template>
    <aside
        class="bg-preto-950/92 pointer-events-auto absolute right-3 top-16 z-10 w-64 rounded-lg border border-ouro-500/20 p-3 text-sm text-preto-100 backdrop-blur"
        aria-label="Objeto selecionado"
    >
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
            {{
                { token: 'Token', luz: 'Luz', parede: 'Parede, porta ou janela', imagem: 'Imagem', traco: 'Desenho', texto: 'Texto', loot: 'Loot' }[
                    objeto.tipo
                ]
            }}
        </p>
        <div class="grid gap-3">
            <label v-if="objeto.tipo !== 'parede' && objeto.tipo !== 'texto' && objeto.tipo !== 'traco'" class="grid gap-1">
                <span class="text-xs text-preto-300">Nome</span>
                <Input
                    :class="campo"
                    :model-value="objeto.nome ?? ''"
                    @change="(e: Event) => emit('atualizar', { nome: (e.target as HTMLInputElement).value })"
                />
            </label>
            <template v-if="objeto.tipo === 'parede'">
                <label class="grid gap-1">
                    <span class="text-xs text-preto-300">Tipo</span>
                    <select
                        :class="[campo, 'rounded-md border']"
                        :value="objeto.dados?.tipo ?? 'parede'"
                        @change="(e) => emit('atualizar', { dados: { tipo: (e.target as HTMLSelectElement).value as TipoParede } })"
                    >
                        <option value="parede">Parede</option>
                        <option value="porta">Porta</option>
                        <option value="janela">Janela</option>
                    </select>
                </label>
                <label v-if="objeto.dados?.tipo === 'porta'" class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        class="size-4 accent-ouro-500"
                        :checked="!!objeto.dados?.aberta"
                        @change="(e) => emit('atualizar', { dados: { aberta: (e.target as HTMLInputElement).checked } })"
                    />
                    <span>Aberta <span class="text-xs text-preto-400">(duplo clique alterna)</span></span>
                </label>
            </template>
            <template v-else-if="objeto.tipo === 'texto'">
                <label class="grid gap-1">
                    <span class="text-xs text-preto-300">Texto</span>
                    <Input
                        :class="campo"
                        :model-value="objeto.dados?.texto ?? ''"
                        @change="(e: Event) => emit('atualizar', { dados: { texto: (e.target as HTMLInputElement).value } })"
                    />
                </label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="grid gap-1">
                        <span class="text-xs text-preto-300">Tamanho</span>
                        <Input
                            :class="campo"
                            type="number"
                            min="6"
                            max="400"
                            :model-value="objeto.dados?.tamanho ?? 28"
                            @change="(e: Event) => emit('atualizar', { dados: { tamanho: Number((e.target as HTMLInputElement).value) } })"
                        />
                    </label>
                    <label class="grid gap-1">
                        <span class="text-xs text-preto-300">Cor</span>
                        <Input
                            type="color"
                            class="h-8 p-1"
                            :model-value="objeto.dados?.cor ?? '#ffffff'"
                            @change="(e: Event) => emit('atualizar', { dados: { cor: (e.target as HTMLInputElement).value } })"
                        />
                    </label>
                </div>
            </template>
            <template v-else>
                <label v-if="objeto.tipo === 'traco'" class="grid gap-1">
                    <span class="text-xs text-preto-300">Cor do traço</span>
                    <Input
                        type="color"
                        class="h-8 p-1"
                        :model-value="objeto.dados?.cor ?? '#ef4444'"
                        @change="(e: Event) => emit('atualizar', { dados: { cor: (e.target as HTMLInputElement).value } })"
                    />
                </label>
                <label v-if="objeto.tipo === 'luz'" class="grid gap-1">
                    <span class="text-xs text-preto-300">Cor da luz</span>
                    <Input
                        type="color"
                        class="h-8 p-1"
                        :model-value="objeto.dados?.cor ?? '#ffd27a'"
                        @change="(e: Event) => emit('atualizar', { dados: { cor: (e.target as HTMLInputElement).value } })"
                    />
                </label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="grid gap-1">
                        <span class="text-xs text-preto-300">Largura (q)</span>
                        <Input :class="campo" inputmode="decimal" :model-value="emQuadrados(objeto.largura)" @change="tamanho('largura', $event)" />
                    </label>
                    <label class="grid gap-1">
                        <span class="text-xs text-preto-300">Altura (q)</span>
                        <Input :class="campo" inputmode="decimal" :model-value="emQuadrados(objeto.altura)" @change="tamanho('altura', $event)" />
                    </label>
                </div>
                <p class="-mt-1 text-xs text-preto-400">{{ distancia(objeto.largura) }} × {{ distancia(objeto.altura) }} {{ pagina.unidade }}</p>
            </template>
            <label v-if="objeto.tipo !== 'luz' && objeto.tipo !== 'parede'" class="grid gap-1">
                <span class="text-xs text-preto-300">Camada</span>
                <select
                    :class="[campo, 'rounded-md border']"
                    :value="objeto.camada"
                    @change="(e) => emit('atualizar', { camada: (e.target as HTMLSelectElement).value as Camada })"
                >
                    <option v-for="c in camadasPossiveis" :key="c.id" :value="c.id">{{ c.nome }}</option>
                </select>
            </label>
            <div class="flex items-center justify-between gap-1">
                <div class="flex gap-1">
                    <Button
                        size="icon"
                        variant="outline"
                        class="size-8 border-ouro-500/20"
                        aria-label="Trazer para frente"
                        title="Trazer para frente"
                        @click="emit('atualizar', { z: objeto.z + 1 })"
                        ><ArrowUpToLine class="size-4"
                    /></Button>
                    <Button
                        size="icon"
                        variant="outline"
                        class="size-8 border-ouro-500/20"
                        aria-label="Enviar para trás"
                        title="Enviar para trás"
                        @click="emit('atualizar', { z: objeto.z - 1 })"
                        ><ArrowDownToLine class="size-4"
                    /></Button>
                </div>
                <Button size="sm" variant="ghost" class="text-red-400 hover:text-red-300" @click="emit('remover')"
                    ><Trash2 class="size-4" /> Excluir</Button
                >
            </div>
        </div>
    </aside>
</template>
