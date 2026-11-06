<script setup lang="ts">
import { ref } from 'vue';
import { clonar } from '../../../../nucleo/ficha/caminho';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../../nucleo/ui/CampoTexto.vue';
import { estilos, useFicha } from '../../contexto';
import { camposDoGastoDePP, type FichaOnePiece, type Tecnica } from '../../regras';

/**
 * Lista de técnicas que gastam pontos de poder. Serve às Técnicas (`tecnicas.lista`) e aos poderes da Akuma no Mi
 * (`akuma.lista`): muda o `caminho` salvo, o título e a cor de destaque (`tom`).
 */
const props = defineProps<{
    ficha: FichaOnePiece;
    caminho: string;
    lista: Tecnica[];
    titulo: string;
    nova: string;
    vazio: string;
    tom: 'sky' | 'violet';
}>();
const { editar, salvar, rolar } = useFicha();

const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
const cor =
    props.tom === 'violet'
        ? { texto: 'text-violet-300', botao: 'border-violet-400/60 text-violet-100 hover:bg-violet-500/20' }
        : { texto: 'text-sky-300', botao: 'border-sky-400/60 text-sky-100 hover:bg-sky-500/20' };

/** A lista é salva por inteiro: edita-se uma cópia e envia. */
function mudar(fn: (lista: Tecnica[]) => void) {
    const copia = clonar(props.lista);
    fn(copia);
    salvar({ [props.caminho]: copia });
}

const podeUsar = (t: Tecnica) => props.ficha.pp.atual >= t.custo;

/** Usar: gasta os PP e, se há rolagem, rola no chat. Sem PP suficiente não faz nada. */
function usar(t: Tecnica) {
    const campos = camposDoGastoDePP(props.ficha, t.custo);
    if (!campos) return;
    salvar(campos);
    if (t.rolagem.trim()) rolar(t.rolagem.trim(), t.nome);
}

const vazia = () => ({ nome: '', origem: '', custo: 1, alcance: '', efeito: '', rolagem: '', descricao: '' });
const novo = ref(vazia());
function adicionar() {
    const nome = novo.value.nome.trim();
    if (!nome) return;
    mudar((l) =>
        l.push({
            nome,
            origem: novo.value.origem.trim(),
            custo: Math.max(0, Math.min(99, Math.floor(Number(novo.value.custo) || 0))),
            alcance: novo.value.alcance.trim(),
            efeito: novo.value.efeito.trim(),
            rolagem: novo.value.rolagem.trim(),
            descricao: novo.value.descricao.trim(),
        }),
    );
    novo.value = vazia();
}
</script>

<template>
    <div class="grid gap-3">
        <section :class="estilos.cartao" aria-label="Lista">
            <h3 :class="estilos.titulo">{{ titulo }}</h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="(t, i) in lista" :key="i" class="px-3 py-2">
                    <!-- Jogar: cartão da técnica com o botão Usar. Editar: campos para mudar tudo. -->
                    <div v-if="!editar" class="flex items-start gap-3">
                        <div class="min-w-0 flex-1">
                            <p class="font-semibold text-preto-100">{{ t.nome }}</p>
                            <p class="text-xs text-preto-400">
                                <span v-if="t.origem">{{ t.origem }}</span>
                                <span v-if="t.alcance"> · {{ t.alcance }}</span>
                                <span v-if="t.efeito"> · {{ t.efeito }}</span>
                            </p>
                            <p v-if="t.descricao" class="mt-1 whitespace-pre-wrap break-words text-xs text-preto-300">{{ t.descricao }}</p>
                        </div>
                        <div class="shrink-0 text-right">
                            <p class="font-serif text-base font-bold tabular-nums" :class="cor.texto">{{ t.custo }} PP</p>
                            <button
                                type="button"
                                :disabled="!podeUsar(t)"
                                class="mt-1 rounded-md border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:cursor-not-allowed disabled:opacity-40"
                                :class="cor.botao"
                                :title="
                                    podeUsar(t)
                                        ? `Gasta ${t.custo} PP${t.rolagem ? ' e rola ' + t.rolagem : ''}`
                                        : `Pontos de poder insuficientes (${ficha.pp.atual} de ${t.custo})`
                                "
                                :aria-label="`Usar ${t.nome}, custo ${t.custo} pontos de poder`"
                                @click="usar(t)"
                            >
                                Usar
                            </button>
                        </div>
                    </div>
                    <div v-else class="grid gap-1.5">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <CampoTexto
                                :model-value="t.nome"
                                :maximo="120"
                                aria-label="Nome da técnica"
                                :class="[estilos.campo, 'min-w-40 flex-1 font-semibold']"
                                @salvar="mudar((l) => (l[i].nome = $event))"
                            />
                            <label class="flex items-center gap-1 text-xs text-preto-400"
                                >PP
                                <CampoNumero
                                    :model-value="t.custo"
                                    :min="0"
                                    :max="99"
                                    aria-label="Custo em pontos de poder"
                                    :class="estilos.ajuste"
                                    @salvar="mudar((l) => (l[i].custo = $event))"
                                />
                            </label>
                            <button
                                type="button"
                                class="text-xs text-preto-500 hover:text-red-300"
                                :aria-label="`Remover ${t.nome}`"
                                @click="mudar((l) => l.splice(i, 1))"
                            >
                                ✕
                            </button>
                        </div>
                        <div class="grid gap-1.5 sm:grid-cols-3">
                            <CampoTexto
                                :model-value="t.origem"
                                :maximo="120"
                                placeholder="Origem (estilo, fruta, haki...)"
                                aria-label="Origem"
                                :class="estilos.campo"
                                @salvar="mudar((l) => (l[i].origem = $event))"
                            />
                            <CampoTexto
                                :model-value="t.alcance"
                                :maximo="60"
                                placeholder="Alcance"
                                aria-label="Alcance"
                                :class="estilos.campo"
                                @salvar="mudar((l) => (l[i].alcance = $event))"
                            />
                            <CampoTexto
                                :model-value="t.efeito"
                                :maximo="120"
                                placeholder="Dano ou efeito"
                                aria-label="Dano ou efeito"
                                :class="estilos.campo"
                                @salvar="mudar((l) => (l[i].efeito = $event))"
                            />
                        </div>
                        <CampoTexto
                            :model-value="t.rolagem"
                            :maximo="100"
                            placeholder="Rolagem (opcional), ex.: 3d8+@mod.for"
                            aria-label="Rolagem da técnica"
                            :class="[estilos.campo, 'font-mono']"
                            @salvar="mudar((l) => (l[i].rolagem = $event))"
                        />
                        <CampoTexto
                            :model-value="t.descricao"
                            :maximo="2000"
                            placeholder="Descrição"
                            aria-label="Descrição"
                            :class="estilos.campo"
                            @salvar="mudar((l) => (l[i].descricao = $event))"
                        />
                    </div>
                </li>
                <li v-if="!lista.length" class="px-3 py-3 text-center text-xs text-preto-500">
                    {{ vazio }}{{ editar ? '' : ' No modo Editar você adiciona.' }}
                </li>
            </ul>
        </section>

        <form v-if="editar" class="flex flex-wrap gap-1.5" :aria-label="nova" @submit.prevent="adicionar">
            <input
                v-model="novo.nome"
                type="text"
                maxlength="120"
                :placeholder="nova"
                :aria-label="`Nome: ${nova}`"
                :class="campo"
                class="min-w-40 flex-1"
            />
            <input v-model="novo.origem" type="text" maxlength="120" placeholder="Origem" aria-label="Origem" :class="campo" class="w-32" />
            <input v-model.number="novo.custo" type="number" min="0" max="99" aria-label="Custo em PP" :class="campo" class="w-16" />
            <input v-model="novo.alcance" type="text" maxlength="60" placeholder="Alcance" aria-label="Alcance" :class="campo" class="w-28" />
            <input
                v-model="novo.efeito"
                type="text"
                maxlength="120"
                placeholder="Dano ou efeito"
                aria-label="Dano ou efeito"
                :class="campo"
                class="w-36"
            />
            <input
                v-model="novo.rolagem"
                type="text"
                maxlength="100"
                placeholder="Rolagem (3d8+@mod.for)"
                aria-label="Rolagem"
                :class="campo"
                class="w-44 font-mono"
            />
            <button type="submit" class="rounded bg-ouro-500 px-3 text-xs font-semibold text-preto-950 hover:bg-ouro-400">Adicionar</button>
        </form>
    </div>
</template>
