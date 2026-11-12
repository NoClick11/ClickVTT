<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { onBeforeUnmount, ref, watch } from 'vue';
import { converterParaWebp } from '../../nucleo/imagens/webp';

/** O mestre sobe uma imagem (com texto opcional) como folheto. Fica escondido dos jogadores até ele liberar. */
const props = defineProps<{ open: boolean; criar: (dados: FormData) => Promise<unknown> }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const nome = ref('');
const texto = ref('');
const arquivo = ref<File | null>(null);
const previa = ref<string | null>(null);
const erro = ref('');
const ocupado = ref(false);

const limparPrevia = () => {
    if (previa.value) URL.revokeObjectURL(previa.value);
    previa.value = null;
};
watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        nome.value = '';
        texto.value = '';
        arquivo.value = null;
        limparPrevia();
        erro.value = '';
        ocupado.value = false;
    },
    { immediate: true },
);
onBeforeUnmount(limparPrevia);

function escolher(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    arquivo.value = f;
    limparPrevia();
    if (f) {
        previa.value = URL.createObjectURL(f);
        if (!nome.value.trim()) nome.value = f.name.replace(/\.[^.]+$/, '').slice(0, 80);
    }
}

async function enviar() {
    erro.value = '';
    if (!arquivo.value) return (erro.value = 'Escolha uma imagem.');
    if (!nome.value.trim()) return (erro.value = 'Dê um nome ao folheto.');
    ocupado.value = true;
    try {
        const arquivoFinal = await converterParaWebp(arquivo.value);
        const dados = new FormData();
        dados.append('nome', nome.value.trim());
        dados.append('imagem', arquivoFinal);
        if (texto.value.trim()) dados.append('texto', texto.value.trim());
        await props.criar(dados);
        emit('update:open', false);
    } catch (e) {
        erro.value = e instanceof Error ? e.message : 'Não foi possível criar o folheto.';
    } finally {
        ocupado.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Novo folheto</DialogTitle>
                <DialogDescription>Os jogadores só o veem depois que você liberar ou mostrar.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="enviar">
                <label class="grid gap-1.5 text-sm">
                    <span class="font-medium">Imagem</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="Imagem do folheto"
                        class="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-ouro-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-preto-950"
                        @change="escolher"
                    />
                </label>
                <img v-if="previa" :src="previa" alt="Prévia do folheto" class="max-h-48 w-full rounded-md border border-preto-700 object-contain" />
                <label class="grid gap-1.5 text-sm">
                    <span class="font-medium">Nome</span>
                    <input
                        v-model="nome"
                        type="text"
                        maxlength="80"
                        aria-label="Nome do folheto"
                        class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                    />
                </label>
                <label class="grid gap-1.5 text-sm">
                    <span class="font-medium">Texto <span class="font-normal text-preto-400">(opcional)</span></span>
                    <textarea
                        v-model="texto"
                        rows="3"
                        maxlength="5000"
                        aria-label="Texto do folheto"
                        class="rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none"
                    />
                </label>
                <p v-if="erro" role="alert" class="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{{ erro }}</p>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="ocupado">Criar folheto</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
