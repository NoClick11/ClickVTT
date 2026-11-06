<script setup lang="ts">
import { Skull } from 'lucide-vue-next';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import { useFicha } from '../../contexto';
import type { FichaOnePiece } from '../../regras';

defineProps<{ ficha: FichaOnePiece }>();
const { editar, salvar } = useFicha();
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="flex items-center gap-4 rounded-lg border border-red-400/40 bg-red-500/10 p-4" aria-label="Recompensa">
            <Skull class="size-10 shrink-0 text-red-300" aria-hidden="true" />
            <label class="min-w-0 flex-1">
                <span class="block text-[11px] font-semibold uppercase tracking-wider text-red-300">Recompensa pela cabeça</span>
                <span class="flex items-center gap-1 font-serif text-4xl font-semibold tabular-nums text-ouro-100"
                    >฿
                    <CampoNumero
                        :model-value="ficha.recompensa"
                        :min="0"
                        :max="1000000000000"
                        :somente-leitura="!editar"
                        aria-label="Recompensa em Belly"
                        class="w-full border-b border-transparent bg-transparent read-only:cursor-default focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ recompensa: $event })"
                    />
                </span>
            </label>
        </section>
    </div>
</template>
