<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownToLine, ArrowUpToLine, Trash2, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { CAMADAS, type Camada, type CamposGeometria, type ObjetoDto, type PaginaDto, type TipoParede } from '../engine/tipos';
import { BLOQUEIO_PADRAO, type CanalDeBloqueio } from '../engine/visao';

const props = defineProps<{ objeto: ObjetoDto; pagina: PaginaDto; paginas?: PaginaDto[] }>();
const emit = defineEmits<{ atualizar: [campos: Partial<ObjetoDto>]; remover: []; fechar: []; navegar: [paginaId: number] }>();

const t = computed(() => props.pagina.tamanho_quadrado);
const camadasPossiveis = computed(() => CAMADAS.filter((c) => c.id !== 'iluminacao'));
const emQuadrados = (px: number) => Math.round((px / t.value) * 100) / 100;
const distancia = (px: number) => Math.round((px / t.value) * props.pagina.distancia_quadrado * 100) / 100;

function tamanho(campo: 'largura' | 'altura', e: Event) {
    const q = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));
    if (!Number.isFinite(q) || q <= 0) return;
    emit('atualizar', { [campo]: q * t.value } as CamposGeometria);
}
const numero = (e: Event): number | null => {
    const v = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));

    return Number.isFinite(v) ? v : null;
};

// --- luz ---
const raioDaLuz = computed(() => props.objeto.dados?.raio ?? Math.min(props.objeto.largura, props.objeto.altura) / 2);
const raioClaro = computed(() => Math.min(raioDaLuz.value, props.objeto.dados?.raio_claro ?? raioDaLuz.value * 0.4));

// --- viagem ---
const paginasDestino = computed(() => (props.paginas ?? []).filter((p) => p.id !== props.pagina.id));
/** Muda o raio mantendo o centro da luz (a caixa do objeto acompanha, e o raio claro não passa do raio). */
function raioTotal(e: Event) {
    const q = numero(e);
    if (q === null || q <= 0) return;
    const r = q * t.value;
    const cx = props.objeto.x + props.objeto.largura / 2;
    const cy = props.objeto.y + props.objeto.altura / 2;
    emit('atualizar', { x: cx - r, y: cy - r, largura: r * 2, altura: r * 2, dados: { raio: r, raio_claro: Math.min(raioClaro.value, r) } });
}

// --- parede ---
const tipoDaParede = computed(() => props.objeto.dados?.tipo ?? 'parede');
const bloqueios = [
    { id: 'movimento', rotulo: 'Barra o movimento' },
    { id: 'visao', rotulo: 'Barra a visão' },
    { id: 'luz', rotulo: 'Barra a luz' },
] as const;
const bloqueiaAgora = (canal: CanalDeBloqueio) => props.objeto.dados?.bloqueio?.[canal] ?? BLOQUEIO_PADRAO[tipoDaParede.value][canal];
function alternarBloqueio(canal: CanalDeBloqueio, ligado: boolean) {
    const atual = Object.fromEntries(bloqueios.map((b) => [b.id, bloqueiaAgora(b.id)]));
    emit('atualizar', { dados: { bloqueio: { ...atual, [canal]: ligado } } });
}
const campo = 'h-8 border-ouro-500/20 bg-preto-900 px-2 text-sm';
</script>

<template>
    <aside
        class="bg-preto-950/92 pointer-events-auto absolute right-3 top-16 z-10 w-64 rounded-lg border border-ouro-500/20 p-3 text-sm text-preto-100 backdrop-blur"
        aria-label="Objeto selecionado"
    >
        <div class="mb-2 flex items-center justify-between">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
                {{
                    {
                        token: 'Token',
                        luz: 'Luz',
                        parede: 'Parede, porta ou janela',
                        imagem: 'Imagem',
                        traco: 'Desenho',
                        texto: 'Texto',
                        loot: 'Loot',
                        viagem: 'Ponto de Viagem',
                    }[objeto.tipo]
                }}
            </p>
            <Button
                type="button"
                size="icon"
                variant="ghost"
                class="size-6 text-preto-400 hover:text-ouro-200"
                aria-label="Fechar configurações"
                @click="emit('fechar')"
            >
                <X class="size-3.5" />
            </Button>
        </div>
        <div class="grid gap-3">
            <label v-if="objeto.tipo !== 'parede' && objeto.tipo !== 'texto' && objeto.tipo !== 'traco'" class="grid gap-1">
                <span class="text-xs text-preto-300">Nome</span>
                <Input
                    :class="campo"
                    :model-value="objeto.nome ?? ''"
                    @change="(e: Event) => emit('atualizar', { nome: (e.target as HTMLInputElement).value })"
                />
            </label>
            <label
                v-if="objeto.tipo === 'token' && pagina.iluminacao_ativa"
                class="flex items-center gap-2"
                title="Desligado: o jogador deste token não enxerga por ele (cego)."
            >
                <input
                    type="checkbox"
                    class="size-4 accent-ouro-500"
                    :checked="objeto.dados?.visao_ativa !== false"
                    @change="(e) => emit('atualizar', { dados: { visao_ativa: (e.target as HTMLInputElement).checked } })"
                />
                <span>Tem visão</span>
            </label>
            <label v-if="objeto.tipo === 'token' && pagina.iluminacao_ativa && objeto.dados?.visao_ativa !== false" class="grid gap-1">
                <span class="text-xs text-preto-300">Visão no escuro (quadrados)</span>
                <Input
                    :class="campo"
                    inputmode="decimal"
                    :placeholder="`padrão da página: ${pagina.visao_padrao}`"
                    :model-value="objeto.dados?.visao ?? ''"
                    @change="
                        (e: Event) => {
                            const v = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));
                            emit('atualizar', { dados: { visao: Number.isFinite(v) && v >= 0 ? v : null } });
                        }
                    "
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
                <template v-if="objeto.dados?.tipo === 'porta' || objeto.dados?.tipo === 'janela'">
                    <label class="flex items-center gap-2">
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="!!objeto.dados?.aberta"
                            @change="(e) => emit('atualizar', { dados: { aberta: (e.target as HTMLInputElement).checked } })"
                        />
                        <span>Aberta <span class="text-xs text-preto-400">(duplo clique alterna)</span></span>
                    </label>
                    <label class="flex items-center gap-2" title="Trancada: os jogadores não conseguem abrir nem fechar.">
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="!!objeto.dados?.trancada"
                            @change="(e) => emit('atualizar', { dados: { trancada: (e.target as HTMLInputElement).checked } })"
                        />
                        <span>Trancada</span>
                    </label>
                </template>
                <fieldset class="grid gap-1.5 rounded-md border border-ouro-500/20 p-2">
                    <legend class="px-1 text-xs text-preto-300">Quando fechada</legend>
                    <label v-for="b in bloqueios" :key="b.id" class="flex items-center gap-2">
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="bloqueiaAgora(b.id)"
                            @change="(e) => alternarBloqueio(b.id, (e.target as HTMLInputElement).checked)"
                        />
                        <span>{{ b.rotulo }}</span>
                    </label>
                    <p class="text-[11px] text-preto-400">
                        Aberta, porta e janela deixam tudo passar. A janela é vidro: barra o corpo, mas deixa ver e iluminar.
                    </p>
                </fieldset>
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
            <template v-else-if="objeto.tipo === 'viagem'">
                <label class="grid gap-1">
                    <span class="text-xs text-preto-300">Mapa de destino</span>
                    <select
                        :class="[campo, 'rounded-md border']"
                        :value="objeto.dados?.destino_pagina_id ?? ''"
                        @change="
                            (e) => {
                                const val = (e.target as HTMLSelectElement).value;
                                const destId = val ? Number(val) : null;
                                const dest = paginasDestino.find((p) => p.id === destId);
                                emit('atualizar', {
                                    dados: {
                                        ...objeto.dados,
                                        destino_pagina_id: destId,
                                        destino_nome: dest?.nome ?? null,
                                    },
                                });
                            }
                        "
                    >
                        <option value="">(Nenhum destino selecionado)</option>
                        <option v-for="p in paginasDestino" :key="p.id" :value="p.id">
                            {{ p.nome }}
                        </option>
                    </select>
                </label>
                <label class="grid gap-1">
                    <span class="text-xs text-preto-300">Cor do portal</span>
                    <Input
                        type="color"
                        class="h-8 p-1"
                        :model-value="objeto.dados?.cor ?? '#6366f1'"
                        @change="(e: Event) => emit('atualizar', { dados: { ...objeto.dados, cor: (e.target as HTMLInputElement).value } })"
                    />
                </label>
                <Button
                    v-if="objeto.dados?.destino_pagina_id"
                    size="sm"
                    variant="outline"
                    class="border-ouro-500/20 text-xs text-ouro-300 hover:bg-ouro-500/10"
                    @click="emit('navegar', objeto.dados.destino_pagina_id)"
                >
                    Ir para este mapa
                </Button>
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
                <template v-if="objeto.tipo === 'luz'">
                    <label class="flex items-center gap-2" title="Apagada, a luz não ilumina nada.">
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="objeto.dados?.ativa !== false"
                            @change="(e) => emit('atualizar', { dados: { ativa: (e.target as HTMLInputElement).checked } })"
                        />
                        <span>Acesa</span>
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="grid gap-1">
                            <span class="text-xs text-preto-300">Alcance (q)</span>
                            <Input :class="campo" inputmode="decimal" :model-value="emQuadrados(raioDaLuz)" @change="raioTotal($event)" />
                        </label>
                        <label class="grid gap-1" title="Até aqui a luz brilha por inteiro; dali ao alcance ela esmaece.">
                            <span class="text-xs text-preto-300">Luz plena (q)</span>
                            <Input
                                :class="campo"
                                inputmode="decimal"
                                :model-value="emQuadrados(raioClaro)"
                                @change="
                                    (e: Event) => {
                                        const q = numero(e);
                                        if (q !== null && q >= 0) emit('atualizar', { dados: { raio_claro: Math.min(q * t, raioDaLuz) } });
                                    }
                                "
                            />
                        </label>
                        <label class="grid gap-1">
                            <span class="text-xs text-preto-300">Intensidade (%)</span>
                            <Input
                                :class="campo"
                                inputmode="numeric"
                                :model-value="Math.round((objeto.dados?.intensidade ?? 1) * 100)"
                                @change="
                                    (e: Event) => {
                                        const q = numero(e);
                                        if (q !== null) emit('atualizar', { dados: { intensidade: Math.max(0, Math.min(100, q)) / 100 } });
                                    }
                                "
                            />
                        </label>
                        <label class="grid gap-1" title="360° = em volta toda; menos que isso vira um cone (lanterna).">
                            <span class="text-xs text-preto-300">Abertura (°)</span>
                            <Input
                                :class="campo"
                                inputmode="numeric"
                                :model-value="objeto.dados?.angulo ?? 360"
                                @change="
                                    (e: Event) => {
                                        const q = numero(e);
                                        if (q !== null) emit('atualizar', { dados: { angulo: Math.max(1, Math.min(360, q)) } });
                                    }
                                "
                            />
                        </label>
                    </div>
                    <label
                        v-if="(objeto.dados?.angulo ?? 360) < 360"
                        class="grid gap-1"
                        title="0° = direita, 90° = para baixo, 180° = esquerda, 270° = para cima."
                    >
                        <span class="text-xs text-preto-300">Direção do cone (°)</span>
                        <Input
                            :class="campo"
                            inputmode="numeric"
                            :model-value="objeto.dados?.direcao ?? 0"
                            @change="
                                (e: Event) => {
                                    const q = numero(e);
                                    if (q !== null) emit('atualizar', { dados: { direcao: q } });
                                }
                            "
                        />
                    </label>
                    <label class="flex items-center gap-2" title="A luz atravessa paredes e portas (um brilho mágico, por exemplo).">
                        <input
                            type="checkbox"
                            class="size-4 accent-ouro-500"
                            :checked="!!objeto.dados?.atravessa"
                            @change="(e) => emit('atualizar', { dados: { atravessa: (e.target as HTMLInputElement).checked } })"
                        />
                        <span>Atravessa paredes</span>
                    </label>
                </template>
                <label v-if="objeto.tipo === 'luz'" class="grid gap-1">
                    <span class="text-xs text-preto-300">Cor da luz</span>
                    <Input
                        type="color"
                        class="h-8 p-1"
                        :model-value="objeto.dados?.cor ?? '#ffd27a'"
                        @change="(e: Event) => emit('atualizar', { dados: { cor: (e.target as HTMLInputElement).value } })"
                    />
                </label>
                <div v-if="objeto.tipo !== 'luz'" class="grid grid-cols-2 gap-2">
                    <label class="grid gap-1">
                        <span class="text-xs text-preto-300">Largura (q)</span>
                        <Input :class="campo" inputmode="decimal" :model-value="emQuadrados(objeto.largura)" @change="tamanho('largura', $event)" />
                    </label>
                    <label class="grid gap-1">
                        <span class="text-xs text-preto-300">Altura (q)</span>
                        <Input :class="campo" inputmode="decimal" :model-value="emQuadrados(objeto.altura)" @change="tamanho('altura', $event)" />
                    </label>
                </div>
                <p v-if="objeto.tipo !== 'luz'" class="-mt-1 text-xs text-preto-400">
                    {{ distancia(objeto.largura) }} × {{ distancia(objeto.altura) }} {{ pagina.unidade }}
                </p>
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
