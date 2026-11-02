<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { router } from '@inertiajs/vue3';
import { Check, Copy, RefreshCw } from 'lucide-vue-next';
import { ref } from 'vue';

const props = defineProps<{ open: boolean; mesaId: number; url: string }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const copiado = ref(false);
const confirmando = ref(false);

async function copiar() {
    try {
        await navigator.clipboard.writeText(props.url);
        copiado.value = true;
        setTimeout(() => (copiado.value = false), 1500);
    } catch {
        /* clipboard indisponível (http sem localhost): o campo permite copiar à mão */
    }
}
function novoLink() {
    router.post(route('mesas.convite', props.mesaId), {}, { preserveScroll: true, onFinish: () => (confirmando.value = false) });
}
</script>

<template>
    <Dialog :open="open" @update:open="(v) => { emit('update:open', v); confirmando = false; }">
        <DialogContent>
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Convidar jogadores</DialogTitle>
                <DialogDescription>Envie este link. O jogador escolhe o personagem e digita a senha que você definiu.</DialogDescription>
            </DialogHeader>
            <div class="flex gap-2">
                <Input :model-value="url" readonly aria-label="Link de convite" @focus="($event.target as HTMLInputElement).select()" />
                <Button size="icon" variant="outline" aria-label="Copiar link" @click="copiar"><Check v-if="copiado" class="size-4" /><Copy v-else class="size-4" /></Button>
            </div>
            <div class="border-t pt-4">
                <template v-if="!confirmando">
                    <Button variant="ghost" size="sm" class="text-muted-foreground" @click="confirmando = true"><RefreshCw class="size-4" /> Gerar novo link</Button>
                </template>
                <div v-else class="flex flex-wrap items-center gap-2 text-sm">
                    <span class="text-muted-foreground">O link atual deixará de funcionar.</span>
                    <Button size="sm" variant="destructive" @click="novoLink">Gerar novo link</Button>
                    <Button size="sm" variant="ghost" @click="confirmando = false">Cancelar</Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
