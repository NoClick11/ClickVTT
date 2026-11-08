<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Presentation, Trash2 } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import type { FolhetoDto } from '../../tipos-mesa';

/** Vê um folheto. O mestre também edita nome e texto, libera aos jogadores, mostra a todos agora ou exclui. */
const props = defineProps<{ folheto: FolhetoDto | null; mestre: boolean }>();
const emit = defineEmits<{
    fechar: [];
    salvar: [id: number, campos: { nome?: string; texto?: string | null; visivel?: boolean }];
    mostrar: [id: number];
    excluir: [id: number];
}>();

const nome = ref('');
const texto = ref('');
watch(
    () => props.folheto?.id,
    () => {
        nome.value = props.folheto?.nome ?? '';
        texto.value = props.folheto?.texto ?? '';
    },
    { immediate: true },
);
const mudou = () => !!props.folheto && (nome.value.trim() !== props.folheto.nome || texto.value !== (props.folheto.texto ?? ''));
const salvar = () => {
    if (!props.folheto || !nome.value.trim() || !mudou()) return;
    emit('salvar', props.folheto.id, { nome: nome.value.trim(), texto: texto.value.trim() || null });
};
</script>

<template>
    <Dialog :open="!!folheto" @update:open="(v: boolean) => !v && emit('fechar')">
        <DialogContent v-if="folheto" class="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{ folheto.nome }}</DialogTitle>
                <DialogDescription class="sr-only">Folheto</DialogDescription>
            </DialogHeader>
            <img :src="folheto.imagem" :alt="folheto.nome" class="max-h-[60vh] w-full rounded-md border border-preto-700 object-contain" />
            <p v-if="!mestre && folheto.texto" class="whitespace-pre-wrap text-sm">{{ folheto.texto }}</p>
            <template v-if="mestre">
                <label class="grid gap-1 text-sm">
                    <span class="font-medium">Nome</span>
                    <input
                        v-model="nome"
                        type="text"
                        maxlength="80"
                        aria-label="Nome do folheto"
                        class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                        @blur="salvar"
                    />
                </label>
                <label class="grid gap-1 text-sm">
                    <span class="font-medium">Texto</span>
                    <textarea
                        v-model="texto"
                        rows="3"
                        maxlength="5000"
                        aria-label="Texto do folheto"
                        class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                        @blur="salvar"
                    />
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        class="size-4 accent-ouro-500"
                        :checked="folheto.visivel"
                        @change="emit('salvar', folheto.id, { visivel: ($event.target as HTMLInputElement).checked })"
                    />
                    Os jogadores veem este folheto na lista
                </label>
                <div class="flex flex-wrap justify-between gap-2">
                    <Button type="button" variant="ghost" class="text-red-300 hover:text-red-200" @click="emit('excluir', folheto.id)">
                        <Trash2 class="size-4" /> Excluir
                    </Button>
                    <Button type="button" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="emit('mostrar', folheto.id)">
                        <Presentation class="size-4" /> Mostrar aos jogadores agora
                    </Button>
                </div>
            </template>
        </DialogContent>
    </Dialog>
</template>
