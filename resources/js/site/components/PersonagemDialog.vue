<script setup lang="ts">
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from '@inertiajs/vue3';
import { computed, watch } from 'vue';
import type { Jogador, Personagem } from '../types';
import Campo from './Campo.vue';

const props = defineProps<{ open: boolean; mesaId: number; personagem: Personagem | null; jogadores: Jogador[] }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const edicao = computed(() => props.personagem !== null);
const form = useForm<{ nome: string; cor: string; jogadores: number[] }>({ nome: '', cor: '#d4a843', jogadores: [] });
const cores = ['#d4a843', '#dc2626', '#ea580c', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777'];
const candidatos = computed(() => props.jogadores.filter((j) => j.papel === 'jogador'));

watch(
    () => [props.open, props.personagem] as const,
    ([aberto, p]) => {
        if (!aberto) return;
        form.clearErrors();
        form.defaults({ nome: p?.nome ?? '', cor: p?.cor ?? cores[Math.floor(Math.random() * cores.length)], jogadores: p?.jogadores.map((j) => j.id) ?? [] }).reset();
    },
);

function alternar(id: number, marcado: boolean) {
    form.jogadores = marcado ? [...new Set([...form.jogadores, id])] : form.jogadores.filter((x) => x !== id);
}

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
                <DialogDescription>A ficha do personagem. Escolha quais jogadores o controlam; sem jogadores, só o mestre o controla (NPC).</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="salvar">
                <Campo label="Nome" for="pj-nome" obrigatorio>
                    <Input id="pj-nome" v-model="form.nome" autofocus />
                    <InputError :message="form.errors.nome" />
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
                <fieldset class="grid gap-2">
                    <legend class="mb-1 text-sm font-medium">Jogadores deste personagem</legend>
                    <p v-if="!candidatos.length" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Nenhum jogador ainda. Crie os jogadores primeiro.</p>
                    <label v-for="j in candidatos" :key="j.id" class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:border-ouro-500/50">
                        <input type="checkbox" class="size-4 accent-ouro-500" :checked="form.jogadores.includes(j.id)" @change="alternar(j.id, ($event.target as HTMLInputElement).checked)" />
                        <span class="size-3 rounded-full" :style="{ backgroundColor: j.cor }" />
                        <span class="text-sm">{{ j.nome }}</span>
                    </label>
                    <InputError :message="form.errors.jogadores" />
                </fieldset>
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="form.processing">{{ edicao ? 'Salvar' : 'Criar personagem' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
