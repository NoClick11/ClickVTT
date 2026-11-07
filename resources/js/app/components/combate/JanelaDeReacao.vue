<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Hourglass } from 'lucide-vue-next';
import type { ResumoEvento } from '../../nucleo/combate/reacoes';

/** Aviso, para todos, de que um ataque espera reações (quem ataca, quem é o alvo e quem ainda não respondeu); o mestre encerra a janela. */
defineProps<{ janelas: ResumoEvento[]; mestre: boolean }>();
const emit = defineEmits<{ encerrar: [eventoId: number] }>();
</script>

<template>
    <div
        v-if="janelas.length"
        class="pointer-events-auto absolute left-1/2 top-28 z-20 grid -translate-x-1/2 gap-1.5"
        role="status"
        aria-live="polite"
    >
        <div
            v-for="j in janelas"
            :key="j.id"
            class="flex items-center gap-2 rounded-full border border-sky-400/60 bg-preto-950/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur"
        >
            <Hourglass class="size-3.5 shrink-0 text-sky-300" aria-hidden="true" />
            <span
                ><strong class="text-ouro-100">{{ j.atacante }}</strong> ataca <strong class="text-ouro-100">{{ j.alvo }}</strong
                >: aguardando reação de <strong class="text-sky-200">{{ j.aguardando.join(', ') || '…' }}</strong></span
            >
            <Button
                v-if="mestre"
                type="button"
                size="sm"
                variant="outline"
                class="h-6 border-sky-400/50 px-2 text-[11px]"
                title="Fecha a janela e resolve o ataque (quem não respondeu passa)"
                @click="emit('encerrar', j.id)"
                >Encerrar</Button
            >
        </div>
    </div>
</template>
