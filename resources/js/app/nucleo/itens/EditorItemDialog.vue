<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ref, watch } from 'vue';
import type { ItemDto, NovoItem } from '../../tipos-mesa';
import EditorEfeitos from '../efeitos/EditorEfeitos.vue';
import type { EfeitoBruto } from '../efeitos/efeitos';
import { erroDosEfeitos } from '../efeitos/validacao';
import { clonar } from '../ficha/caminho';
import type { ModuloSistema } from '../sistemas/tipos';

/**
 * Editor de item do mestre (criar e editar). Genérico: nome, peso, descrição, equipável, sintonia e a lista de
 * efeitos são do núcleo; o que só o sistema entende (armadura, arma...) vem do `EditorDadosItem` do módulo.
 * Quem salva e exclui é a mesa (as funções recebidas): o diálogo só mostra o erro, se houver.
 */
const props = defineProps<{
    open: boolean;
    /** O item a editar; `null` = novo. */
    item: ItemDto | null;
    modulo: ModuloSistema | null;
    salvar: (campos: NovoItem, id: number | null) => Promise<ItemDto>;
    /**
     * Item do catálogo/loja: mostra categoria, raridade e preço (o `item` editado traz esses campos) e os envia junto. As
     * listas vêm do catálogo do sistema.
     */
    loja?: { categorias: { id: string; nome: string; grupo: string }[]; raridades: { id: string; nome: string }[]; moeda: string };
    excluir: (id: number) => Promise<void>;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; salvo: [ItemDto] }>();

const nome = ref('');
const descricao = ref('');
const peso = ref(0);
const equipavel = ref(true);
const sintonia = ref(false);
const efeitos = ref<EfeitoBruto[]>([]);
const dados = ref<Record<string, unknown> | null>(null);
const categoria = ref('');
const raridade = ref('comum');
const preco = ref(0);
const erro = ref('');
const ocupado = ref(false);
const confirmandoExclusao = ref(false);

watch(
    () => [props.open, props.item] as const,
    ([aberto, item]) => {
        if (!aberto) return;
        nome.value = item?.nome ?? '';
        descricao.value = item?.descricao ?? '';
        peso.value = item?.peso ?? 0;
        equipavel.value = item?.equipavel ?? true;
        sintonia.value = item?.requer_sintonia ?? false;
        efeitos.value = clonar(item?.efeitos ?? []);
        dados.value = clonar(item?.dados ?? null);
        const extra = item as unknown as { categoria?: string; raridade?: string; preco?: number } | null;
        categoria.value = extra?.categoria ?? props.loja?.categorias[0]?.id ?? '';
        raridade.value = extra?.raridade ?? 'comum';
        preco.value = extra?.preco ?? 0;
        erro.value = '';
        ocupado.value = false;
        confirmandoExclusao.value = false;
    },
    { immediate: true },
);

async function enviar() {
    erro.value = '';
    if (!nome.value.trim()) return (erro.value = 'Dê um nome ao item.');
    if (!(peso.value >= 0)) return (erro.value = 'O peso não pode ser negativo.');
    const erroEfeitos = erroDosEfeitos(efeitos.value, props.modulo?.variaveisDeEfeito);
    if (erroEfeitos) return (erro.value = erroEfeitos);

    ocupado.value = true;
    try {
        const salvo = await props.salvar(
            {
                nome: nome.value.trim(),
                descricao: descricao.value.trim() || null,
                peso: Number(peso.value),
                equipavel: equipavel.value,
                requer_sintonia: sintonia.value,
                efeitos: efeitos.value,
                dados: dados.value,
                ...(props.loja
                    ? { categoria: categoria.value, raridade: raridade.value, preco: Math.max(0, Math.floor(Number(preco.value) || 0)) }
                    : {}),
            } as NovoItem,
            props.item?.id ?? null,
        );
        emit('salvo', salvo);
        emit('update:open', false);
    } catch (e) {
        erro.value = e instanceof Error ? e.message : 'Não foi possível salvar.';
    } finally {
        ocupado.value = false;
    }
}

async function remover() {
    if (!props.item) return;
    if (!confirmandoExclusao.value) return (confirmandoExclusao.value = true);
    ocupado.value = true;
    try {
        await props.excluir(props.item.id);
        emit('update:open', false);
    } catch (e) {
        erro.value = e instanceof Error ? e.message : 'Não foi possível excluir.';
    } finally {
        ocupado.value = false;
    }
}
const campo =
    'w-full rounded-md border border-preto-700 bg-preto-950 px-2.5 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{
                    loja ? (item ? 'Editar item do catálogo' : 'Novo item do catálogo') : item ? 'Editar item' : 'Novo item'
                }}</DialogTitle>
                <DialogDescription
                    >Os efeitos valem enquanto o item estiver equipado (e sintonizado, se exigir). Quem tem o item no inventário ganha os bônus na
                    hora.</DialogDescription
                >
            </DialogHeader>

            <form class="grid gap-3" @submit.prevent="enviar">
                <div class="grid gap-3 sm:grid-cols-[1fr_8rem]">
                    <label
                        ><span :class="rotulo">Nome</span
                        ><input v-model="nome" type="text" maxlength="120" required :class="campo" aria-label="Nome do item"
                    /></label>
                    <label
                        ><span :class="rotulo">Peso (kg)</span
                        ><input v-model.number="peso" type="number" min="0" step="0.05" :class="campo" aria-label="Peso de uma unidade, em quilos"
                    /></label>
                </div>
                <div v-if="loja" class="grid gap-3 sm:grid-cols-3" aria-label="Dados da loja">
                    <label
                        ><span :class="rotulo">Categoria da loja</span>
                        <select v-model="categoria" :class="campo" aria-label="Categoria da loja">
                            <optgroup v-for="g in [...new Set(loja.categorias.map((c) => c.grupo))]" :key="g" :label="g">
                                <option v-for="c in loja.categorias.filter((x) => x.grupo === g)" :key="c.id" :value="c.id">{{ c.nome }}</option>
                            </optgroup>
                        </select>
                    </label>
                    <label
                        ><span :class="rotulo">Raridade</span>
                        <select v-model="raridade" :class="campo" aria-label="Raridade">
                            <option v-for="r in loja.raridades" :key="r.id" :value="r.id">{{ r.nome }}</option>
                        </select>
                    </label>
                    <label
                        ><span :class="rotulo">Preço ({{ loja.moeda }})</span
                        ><input v-model.number="preco" type="number" min="0" step="1" :class="campo" aria-label="Preço"
                    /></label>
                </div>
                <label
                    ><span :class="rotulo">Descrição</span
                    ><textarea v-model="descricao" maxlength="2000" rows="2" :class="campo" aria-label="Descrição do item" />
                </label>

                <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                    <label class="flex items-center gap-2"
                        ><input v-model="equipavel" type="checkbox" class="size-4 accent-ouro-500" /> Equipável
                        <span class="text-xs text-preto-400">(os efeitos só valem equipado)</span></label
                    >
                    <label class="flex items-center gap-2"
                        ><input v-model="sintonia" type="checkbox" class="size-4 accent-ouro-500" /> Exige sintonia
                        <span class="text-xs text-preto-400">(no máximo 3 por personagem)</span></label
                    >
                </div>

                <component :is="modulo.EditorDadosItem" v-if="modulo?.EditorDadosItem" v-model="dados" />

                <section aria-label="Efeitos">
                    <h3 :class="rotulo">Efeitos</h3>
                    <EditorEfeitos v-model="efeitos" :alvos="modulo?.alvosDeEfeito ?? []" :variaveis="modulo?.variaveisDeEfeito" />
                </section>

                <p v-if="erro" role="alert" class="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{{ erro }}</p>

                <div class="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        v-if="item"
                        type="button"
                        variant="ghost"
                        class="text-red-300 hover:bg-red-500/15 hover:text-red-200"
                        :disabled="ocupado"
                        @click="remover"
                    >
                        {{ confirmandoExclusao ? 'Confirmar exclusão (tira o item de todos os inventários)' : 'Excluir item' }}
                    </Button>
                    <span v-else />
                    <div class="flex gap-2">
                        <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                        <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="ocupado">{{
                            item ? 'Salvar' : 'Criar'
                        }}</Button>
                    </div>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
