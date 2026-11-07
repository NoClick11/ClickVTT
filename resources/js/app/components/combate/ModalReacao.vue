<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield } from 'lucide-vue-next';
import { computed } from 'vue';
import { textoDoCusto, textoDoEfeito, viraOErro, type OfertaDeReacao } from '../../nucleo/combate/reacoes';

/**
 * Modal de reação: aparece para o jogador (ou o mestre, nos NPCs) quando alguém é atacado e ele tem uma reação que serve
 * (ao próprio personagem ou a um aliado). Mostra o ataque e as opções; escolher uma usa a reação, "Passar" deixa o ataque
 * seguir. Genérico: o servidor manda título, contexto e opções (serve depois para reações que curam, absorvem dano...).
 */
const props = defineProps<{ ofertas: OfertaDeReacao[]; ocupado: boolean }>();
const emit = defineEmits<{ reagir: [eventoId: number, personagemId: number, opcao: string | null] }>();

/** Uma oferta por vez (a mais antiga); as outras esperam a sua vez. */
const oferta = computed(() => props.ofertas[0] ?? null);
const defesaDoAlvo = computed(() => oferta.value?.contexto.defesa ?? 0);
</script>

<template>
    <Dialog :open="oferta !== null">
        <DialogContent v-if="oferta" class="sm:max-w-lg" @interact-outside.prevent @escape-key-down.prevent>
            <DialogHeader>
                <DialogTitle class="flex items-center gap-2 font-serif text-xl"
                    ><Shield class="size-5 text-sky-300" /> {{ oferta.titulo }}</DialogTitle
                >
                <DialogDescription>
                    <strong class="text-ouro-100">{{ oferta.contexto.atacante }}</strong> ataca
                    <strong class="text-ouro-100">{{ oferta.contexto.alvo }}</strong> ({{ oferta.contexto.rotulo }}):
                    <strong class="tabular-nums text-red-300">{{ oferta.contexto.total }}</strong> contra defesa
                    <strong class="tabular-nums text-sky-300">{{ defesaDoAlvo }}</strong
                    >. {{ oferta.contexto.total >= defesaDoAlvo ? 'O ataque acerta.' : 'O ataque erra.' }}
                </DialogDescription>
            </DialogHeader>
            <p class="text-xs text-preto-400">
                Reagindo como <strong class="text-preto-100">{{ oferta.personagem }}</strong>
            </p>
            <ul class="grid gap-2" aria-label="Reações disponíveis">
                <li v-for="o in oferta.opcoes" :key="o.id">
                    <button
                        type="button"
                        :disabled="ocupado"
                        class="w-full rounded-lg border border-sky-400/50 bg-sky-500/10 p-3 text-left transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-50"
                        @click="emit('reagir', oferta.evento_id, oferta.personagem_id, o.id)"
                    >
                        <span class="flex items-baseline justify-between gap-2">
                            <span class="font-semibold text-preto-100">{{ o.rotulo }}</span>
                            <span class="text-xs text-sky-200">{{ textoDoCusto(o.custo) }}</span>
                        </span>
                        <span class="block text-xs text-ouro-200"
                            >{{ textoDoEfeito(o)
                            }}<span v-if="viraOErro(o, oferta.contexto.total, defesaDoAlvo)" class="ml-1 font-semibold text-green-300"
                                >· faz o ataque errar</span
                            ></span
                        >
                        <span v-if="o.descricao" class="mt-1 block text-xs text-preto-300">{{ o.descricao }}</span>
                    </button>
                </li>
            </ul>
            <Button type="button" variant="outline" :disabled="ocupado" @click="emit('reagir', oferta.evento_id, oferta.personagem_id, null)"
                >Passar</Button
            >
            <p v-if="ofertas.length > 1" class="text-center text-[11px] text-preto-500">
                Mais {{ ofertas.length - 1 }} reaç{{ ofertas.length === 2 ? 'ão espera' : 'ões esperam' }} a sua vez.
            </p>
        </DialogContent>
    </Dialog>
</template>
