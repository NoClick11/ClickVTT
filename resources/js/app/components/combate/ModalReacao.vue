<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { textoDoCusto, textoDoEfeito, viraOErro, type OfertaDeReacao } from '../../nucleo/combate/reacoes';

/**
 * Modal de reação: aparece para o jogador (ou o mestre, nos NPCs) quando alguém é atacado e ele tem uma reação que serve
 * (ao próprio personagem ou a um aliado). Mostra o ataque e as opções; escolher uma usa a reação, "Passar" deixa o ataque
 * seguir. Genérico: o servidor manda título, contexto e opções (serve depois para reações que curam, absorvem dano...).
 */
const props = defineProps<{ ofertas: OfertaDeReacao[]; ocupado: boolean }>();
const emit = defineEmits<{ reagir: [eventoId: number, personagemId: number, opcao: string | null, extra?: number] }>();

/** PP a mais que o jogador escolheu gastar em cada opção (Kiri Shigure: +1d8 de redução por PP). */
const extras = ref<Record<string, number>>({});
const extraDe = (id: string) => extras.value[id] ?? 0;
const mudarExtra = (id: string, max: number, delta: number) =>
    (extras.value = { ...extras.value, [id]: Math.max(0, Math.min(max, extraDe(id) + delta)) });

/** Uma oferta por vez (a mais antiga); as outras esperam a sua vez. */
const oferta = computed(() => props.ofertas[0] ?? null);
const defesaDoAlvo = computed(() => oferta.value?.contexto.defesa ?? 0);
/** Dano sem jogada de ataque (Técnica de Salvaguarda, área): não há acerto a mostrar, só o que vem. */
const aoDano = computed(() => oferta.value?.contexto.tipo === 'dano');
watch(oferta, () => (extras.value = {}));
</script>

<template>
    <Dialog :open="oferta !== null">
        <DialogContent v-if="oferta" class="sm:max-w-lg" @interact-outside.prevent @escape-key-down.prevent>
            <DialogHeader>
                <DialogTitle class="flex items-center gap-2 font-serif text-xl"
                    ><Shield class="size-5 text-sky-300" /> {{ oferta.titulo }}</DialogTitle
                >
                <DialogDescription v-if="aoDano">
                    <strong class="text-ouro-100">{{ oferta.contexto.atacante }}</strong> usa
                    <strong class="text-ouro-100">{{ oferta.contexto.rotulo }}</strong> em
                    <strong class="text-ouro-100">{{ oferta.contexto.alvo }}</strong
                    ><template v-if="oferta.contexto.detalhe"> ({{ oferta.contexto.detalhe }})</template>. O dano ainda não saiu: a reação vale para
                    ele.
                </DialogDescription>
                <DialogDescription v-else>
                    <strong class="text-ouro-100">{{ oferta.contexto.atacante }}</strong> ataca
                    <strong class="text-ouro-100">{{ oferta.contexto.alvo }}</strong> ({{ oferta.contexto.rotulo }}):
                    <strong class="tabular-nums text-red-300">{{ oferta.contexto.total }}</strong> contra defesa
                    <strong class="tabular-nums text-sky-300">{{ defesaDoAlvo }}</strong
                    >. {{ (oferta.contexto.total ?? 0) >= defesaDoAlvo ? 'O ataque acerta.' : 'O ataque erra.' }}
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
                        @click="emit('reagir', oferta.evento_id, oferta.personagem_id, o.id, extraDe(o.id))"
                    >
                        <span class="flex items-baseline justify-between gap-2">
                            <span class="font-semibold text-preto-100">{{ o.rotulo }}</span>
                            <span class="text-xs text-sky-200">{{ textoDoCusto(o.custo) }}</span>
                        </span>
                        <span class="block text-xs text-ouro-200"
                            >{{ textoDoEfeito(o)
                            }}<span v-if="!aoDano && viraOErro(o, oferta.contexto.total ?? 0, defesaDoAlvo)" class="ml-1 font-semibold text-green-300"
                                >· faz o ataque errar</span
                            ></span
                        >
                        <span v-if="o.descricao" class="mt-1 block text-xs text-preto-300">{{ o.descricao }}</span>
                    </button>
                    <div
                        v-if="o.extraMax"
                        class="mt-1 flex items-center justify-between gap-2 rounded-lg border border-sky-400/30 bg-preto-950/60 px-3 py-1.5 text-xs"
                    >
                        <span class="text-preto-300"
                            >PP a mais (+{{ o.maisPorPp }} de redução cada, até {{ o.extraMax }}):
                            <strong class="tabular-nums text-sky-200">{{ extraDe(o.id) }}</strong></span
                        >
                        <span class="flex items-center gap-1">
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                class="size-6"
                                :disabled="ocupado || extraDe(o.id) <= 0"
                                aria-label="Menos 1 PP"
                                @click="mudarExtra(o.id, o.extraMax, -1)"
                                >−</Button
                            >
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                class="size-6"
                                :disabled="ocupado || extraDe(o.id) >= o.extraMax"
                                aria-label="Mais 1 PP"
                                @click="mudarExtra(o.id, o.extraMax, 1)"
                                >+</Button
                            >
                        </span>
                    </div>
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
