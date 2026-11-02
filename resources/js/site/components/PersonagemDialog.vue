<script setup lang="ts">
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from '@inertiajs/vue3';
import { computed, watch } from 'vue';
import { PAPEIS, type Personagem } from '../types';
import Campo from './Campo.vue';

const props = defineProps<{ open: boolean; mesaId: number; personagem: Personagem | null }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const edicao = computed(() => props.personagem !== null);
const form = useForm({ nome: '', papel: 'jogador', cor: '#d4a843', senha: '', remover_senha: false });
const cores = ['#d4a843', '#dc2626', '#ea580c', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777'];
const campo = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

watch(
    () => [props.open, props.personagem] as const,
    ([aberto, p]) => {
        if (!aberto) return;
        form.clearErrors();
        form.defaults({ nome: p?.nome ?? '', papel: p?.papel ?? 'jogador', cor: p?.cor ?? cores[Math.floor(Math.random() * cores.length)], senha: '', remover_senha: false }).reset();
    },
);

function salvar() {
    const opcoes = { preserveScroll: true, onSuccess: () => emit('update:open', false) };
    if (props.personagem) form.put(route('personagens.update', [props.mesaId, props.personagem.id]), opcoes);
    else form.post(route('personagens.store', props.mesaId), opcoes);
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{ edicao ? 'Editar personagem' : 'Novo personagem' }}</DialogTitle>
                <DialogDescription>O jogador escolhe este personagem no link de convite e digita a senha.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="salvar">
                <Campo label="Nome" for="p-nome" obrigatorio>
                    <Input id="p-nome" v-model="form.nome" autofocus />
                    <InputError :message="form.errors.nome" />
                </Campo>
                <Campo label="Papel" for="p-papel" dica="O Mestre controla a mesa; o Jogador joga com o personagem.">
                    <select id="p-papel" v-model="form.papel" :class="campo"><option v-for="(rotulo, k) in PAPEIS" :key="k" :value="k">{{ rotulo }}</option></select>
                    <InputError :message="form.errors.papel" />
                </Campo>
                <Campo label="Cor">
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="c in cores"
                            :key="c"
                            type="button"
                            class="size-7 rounded-full border-2 transition"
                            :class="form.cor === c ? 'scale-110 border-white' : 'border-transparent opacity-80 hover:opacity-100'"
                            :style="{ backgroundColor: c }"
                            :aria-label="`Cor ${c}`"
                            :aria-pressed="form.cor === c"
                            @click="form.cor = c"
                        />
                    </div>
                    <InputError :message="form.errors.cor" />
                </Campo>
                <Campo label="Senha" for="p-senha" :dica="edicao && personagem?.tem_senha ? 'Deixe em branco para manter a senha atual.' : 'Opcional, mas recomendada (mínimo 4 caracteres).'">
                    <Input id="p-senha" v-model="form.senha" type="text" autocomplete="off" placeholder="Senha do personagem" />
                    <InputError :message="form.errors.senha" />
                    <label v-if="edicao && personagem?.tem_senha" class="flex items-center gap-2 text-sm text-muted-foreground">
                        <input v-model="form.remover_senha" type="checkbox" class="size-4 accent-ouro-500" /> Remover senha (entrar sem senha)
                    </label>
                </Campo>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="form.processing">{{ edicao ? 'Salvar' : 'Criar personagem' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
