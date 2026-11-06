<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ref, watch } from 'vue';
import EditorEfeitos from '../../nucleo/efeitos/EditorEfeitos.vue';
import type { EfeitoBruto } from '../../nucleo/efeitos/efeitos';
import { erroDosEfeitos } from '../../nucleo/efeitos/validacao';
import { clonar } from '../../nucleo/ficha/caminho';
import { ALVOS_DE_EFEITO, variaveisParaAlvo } from './alvos';
import type { Caracteristica } from './regras';

/**
 * Cria ou edita uma característica (de classe, espécie, talento... ou totalmente custom) com os seus buffs: os mesmos
 * efeitos dos itens (CA, iniciativa, dano das armas, atributos, perícias, vantagem...). A passiva sempre vale; a ativa
 * vale enquanto o interruptor da ficha estiver ligado (ex.: Fúria). Quem salva é a ficha (`salvar`).
 */
const props = defineProps<{ open: boolean; caracteristica: Caracteristica | null }>();
const emit = defineEmits<{ 'update:open': [boolean]; salvar: [Caracteristica] }>();

const nome = ref('');
const origem = ref('');
const tipo = ref<Caracteristica['tipo']>('passiva');
const usos = ref(0);
const descanso = ref<'curto' | 'longo'>('longo');
const efeitos = ref<EfeitoBruto[]>([]);
const erro = ref('');

watch(
    () => [props.open, props.caracteristica] as const,
    ([aberto, c]) => {
        if (!aberto) return;
        nome.value = c?.nome ?? '';
        origem.value = c && c.origem !== '—' ? c.origem : '';
        tipo.value = c?.tipo ?? 'passiva';
        usos.value = c?.usos?.max ?? 0;
        descanso.value = c?.descanso ?? 'longo';
        efeitos.value = clonar(c?.efeitos ?? []);
        erro.value = '';
    },
    { immediate: true },
);

function enviar() {
    erro.value = '';
    if (!nome.value.trim()) return (erro.value = 'Dê um nome à característica.');
    const max = Math.max(0, Math.min(20, Math.floor(Number(usos.value) || 0)));
    const erroEfeitos = erroDosEfeitos(efeitos.value, variaveisParaAlvo);
    if (erroEfeitos) return (erro.value = erroEfeitos);

    const anterior = props.caracteristica;
    emit('salvar', {
        nome: nome.value.trim(),
        origem: origem.value.trim() || '—',
        tipo: tipo.value,
        ...(max > 0 ? { usos: { atual: Math.min(anterior?.usos?.atual ?? max, max), max }, descanso: descanso.value } : {}),
        ...(efeitos.value.length ? { efeitos: efeitos.value } : {}),
        // O interruptor só existe para ativa com efeitos; editar não liga nem desliga um buff que já estava de um jeito.
        ...(tipo.value === 'ativa' && efeitos.value.length ? { ativa: anterior?.tipo === 'ativa' ? (anterior.ativa ?? false) : false } : {}),
    });
    emit('update:open', false);
}

const campo =
    'w-full rounded-md border border-preto-700 bg-preto-950 px-2.5 py-1.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{ caracteristica ? 'Editar característica' : 'Nova característica' }}</DialogTitle>
                <DialogDescription
                    >Uma característica pode dar buffs: bônus de CA, de iniciativa, de dano das armas, nos atributos, nas perícias, vantagem... Os
                    mesmos efeitos dos itens.</DialogDescription
                >
            </DialogHeader>

            <form class="grid gap-3" @submit.prevent="enviar">
                <div class="grid gap-3 sm:grid-cols-2">
                    <label
                        ><span :class="rotulo">Nome</span
                        ><input
                            v-model="nome"
                            type="text"
                            maxlength="120"
                            required
                            placeholder="Fúria"
                            :class="campo"
                            aria-label="Nome da característica"
                    /></label>
                    <label
                        ><span :class="rotulo">Origem</span
                        ><input
                            v-model="origem"
                            type="text"
                            maxlength="120"
                            placeholder="Bárbaro 1"
                            :class="campo"
                            aria-label="Origem da característica"
                    /></label>
                </div>

                <fieldset class="grid gap-1.5">
                    <legend :class="rotulo">Tipo</legend>
                    <div class="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Tipo da característica">
                        <button
                            type="button"
                            role="radio"
                            :aria-checked="tipo === 'passiva'"
                            class="rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="
                                tipo === 'passiva'
                                    ? 'border-ouro-400 bg-ouro-500/15 text-ouro-100'
                                    : 'border-preto-700 text-preto-300 hover:border-ouro-500/50'
                            "
                            @click="tipo = 'passiva'"
                        >
                            <span class="block font-semibold">Passiva</span>
                            <span class="block text-xs text-preto-400">Sempre vale (ex.: Estilo de Luta, Alerta)</span>
                        </button>
                        <button
                            type="button"
                            role="radio"
                            :aria-checked="tipo === 'ativa'"
                            class="rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="
                                tipo === 'ativa'
                                    ? 'border-ouro-400 bg-ouro-500/15 text-ouro-100'
                                    : 'border-preto-700 text-preto-300 hover:border-ouro-500/50'
                            "
                            @click="tipo = 'ativa'"
                        >
                            <span class="block font-semibold">Ativa</span>
                            <span class="block text-xs text-preto-400">Você liga e desliga na ficha (ex.: Fúria)</span>
                        </button>
                    </div>
                </fieldset>

                <div class="flex flex-wrap items-end gap-3">
                    <label class="grid max-w-48 gap-1"
                        ><span :class="rotulo">Usos por descanso</span
                        ><input
                            v-model.number="usos"
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            :class="campo"
                            aria-label="Usos por descanso (0 = sem usos)"
                            title="0 = sem controle de usos"
                    /></label>
                    <label v-if="usos > 0" class="grid gap-1"
                        ><span :class="rotulo">Os usos voltam no</span
                        ><select v-model="descanso" :class="campo" aria-label="Descanso em que os usos voltam">
                            <option value="longo">Descanso longo</option>
                            <option value="curto">Descanso curto</option>
                        </select></label
                    >
                </div>

                <section aria-label="Efeitos">
                    <h3 :class="rotulo">Efeitos (buffs)</h3>
                    <EditorEfeitos v-model="efeitos" :alvos="ALVOS_DE_EFEITO" :variaveis="variaveisParaAlvo" />
                    <p v-if="tipo === 'ativa' && efeitos.length" class="mt-1.5 text-xs text-preto-400">
                        Os efeitos só valem com a característica ligada.
                    </p>
                </section>

                <p v-if="erro" role="alert" class="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{{ erro }}</p>

                <div class="flex justify-end gap-2">
                    <Button type="button" variant="ghost" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="submit" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400">{{ caracteristica ? 'Salvar' : 'Criar' }}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
