<script setup lang="ts">
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from '@inertiajs/vue3';
import { ImagePlus, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Mesa, Sistema } from '../types';
import Campo from './Campo.vue';

const props = defineProps<{ open: boolean; mesa: Mesa | null; sistemas: Sistema[] }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const edicao = computed(() => props.mesa !== null);
const form = useForm<{
    nome: string;
    slug: string;
    sistema_id: number | null;
    descricao: string;
    tema_entrada: string;
    capa: File | null;
    remover_capa: boolean;
}>({ nome: '', slug: '', sistema_id: null, descricao: '', tema_entrada: 'padrao', capa: null, remover_capa: false });

const arquivo = ref<HTMLInputElement | null>(null);
const previa = ref<string | null>(null);
const campo =
    'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

function limparPrevia() {
    if (previa.value?.startsWith('blob:')) URL.revokeObjectURL(previa.value);
}

watch(
    () => [props.open, props.mesa] as const,
    ([aberto, mesa]) => {
        if (!aberto) return;
        form.clearErrors();
        form.defaults({
            nome: mesa?.nome ?? '',
            slug: mesa?.slug ?? '',
            sistema_id: mesa?.sistema_id ?? props.sistemas[0]?.id ?? null,
            descricao: mesa?.descricao ?? '',
            tema_entrada: mesa?.tema_entrada ?? 'padrao',
            capa: null,
            remover_capa: false,
        }).reset();
        limparPrevia();
        previa.value = mesa?.capa ?? null;
        if (arquivo.value) arquivo.value.value = '';
    },
);
onBeforeUnmount(limparPrevia);

function escolherArquivo(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    limparPrevia();
    form.capa = f;
    form.remover_capa = false;
    previa.value = URL.createObjectURL(f);
}
function removerCapa() {
    limparPrevia();
    form.capa = null;
    form.remover_capa = true;
    previa.value = null;
    if (arquivo.value) arquivo.value.value = '';
}

function slugify(t: string) {
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// Reage ao valor já atualizado (o evento @input dispara antes do v-model, deixando o slug uma letra atrás).
watch(
    () => form.nome,
    (nome) => {
        if (!edicao.value) form.slug = slugify(nome);
    },
);

function salvar() {
    const opcoes = { preserveScroll: true, forceFormData: true, onSuccess: () => emit('update:open', false) };
    if (props.mesa) {
        // Upload exige multipart; PUT real não chega com arquivos, então usamos POST + _method.
        form.transform(({ slug, sistema_id, ...resto }) => ({ ...resto, _method: 'put' })).post(route('mesas.update', props.mesa.id), opcoes);
    } else {
        form.transform((d) => d).post(route('mesas.store'), opcoes);
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{ edicao ? 'Editar mesa' : 'Criar nova mesa' }}</DialogTitle>
                <DialogDescription>{{ edicao ? 'Altere os dados da campanha.' : 'Defina o sistema e os detalhes da sua campanha.' }}</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="salvar">
                <Campo label="Título da mesa" for="m-nome" obrigatorio>
                    <Input id="m-nome" v-model="form.nome" placeholder="A Maldição de Strahd" />
                    <InputError :message="form.errors.nome" />
                </Campo>
                <div class="grid gap-4 sm:grid-cols-2">
                    <Campo label="Identificador" for="m-slug" obrigatorio dica="Usado na URL. Não pode ser alterado depois.">
                        <Input id="m-slug" v-model="form.slug" :disabled="edicao" />
                        <InputError :message="form.errors.slug" />
                    </Campo>
                    <Campo label="Sistema de jogo" for="m-sistema" obrigatorio dica="Não pode ser alterado depois.">
                        <select id="m-sistema" v-model="form.sistema_id" :disabled="edicao" :class="campo">
                            <option v-for="s in sistemas" :key="s.id" :value="s.id">{{ s.nome }}</option>
                        </select>
                        <InputError :message="form.errors.sistema_id" />
                    </Campo>
                </div>
                <Campo label="Imagem de capa" for="m-capa" dica="JPG, PNG ou WebP, até 5 MB. Recomendado 1920×1080.">
                    <div class="flex items-center gap-3">
                        <div
                            class="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-ouro-500/40 bg-preto-900 bg-cover bg-center text-ouro-500/60"
                            :style="previa ? { backgroundImage: `url(${previa})` } : {}"
                        >
                            <ImagePlus v-if="!previa" class="size-7" />
                        </div>
                        <div class="flex flex-col gap-2">
                            <Button type="button" variant="outline" size="sm" @click="arquivo?.click()"><ImagePlus class="size-4" /> {{ previa ? 'Trocar imagem' : 'Enviar imagem' }}</Button>
                            <Button v-if="previa" type="button" variant="ghost" size="sm" class="text-red-400" @click="removerCapa"><X class="size-4" /> Remover</Button>
                        </div>
                        <input id="m-capa" ref="arquivo" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" @change="escolherArquivo" />
                    </div>
                    <InputError :message="form.errors.capa" />
                </Campo>
                <Campo label="Tema da página de entrada" for="m-tema">
                    <select id="m-tema" v-model="form.tema_entrada" :class="campo"><option value="padrao">Padrão</option><option value="minimo">Mínimo</option></select>
                </Campo>
                <Campo label="Descrição" for="m-desc">
                    <textarea id="m-desc" v-model="form.descricao" rows="3" :class="campo" placeholder="Resumo, regras da casa, horários…" />
                </Campo>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="form.processing">{{ edicao ? 'Salvar alterações' : 'Criar mesa' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
