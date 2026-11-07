<script setup lang="ts">
import { Dices } from 'lucide-vue-next';
import { computed, reactive, ref } from 'vue';
import { estilos, useFicha } from '../../contexto';
import { GRADUACOES, NIVEIS_DE_PROFISSAO, PROFISSOES, SEM_PROFISSAO, graduacaoPorId, profissaoPorId } from '../../profissoes/dados';
import {
    avancoDisponivel,
    camposDaGraduacao,
    camposDaNovaProfissao,
    camposDaRemocaoDeProfissao,
    camposDaSegundaProfissao,
    expressaoDoOficio,
    nomeDoOficio,
    problemasDaNovaProfissao,
    problemasDaSegundaProfissao,
    profissoesPadrao,
    resolverModelos,
    temPauParaTodaObra,
    tracosDaProfissao,
    type ProfissoesFicha,
} from '../../profissoes/regras';
import { ATRIBUTOS, PERICIAS, type AtributoId, type FichaOnePiece } from '../../regras';

/**
 * Aba Profissões: a profissão do 1º nível, graduações (Profissional → Especialista → Mestre → Grão-Mestre), as características
 * com o texto da graduação atual e o Ofício, que soma o Bônus de Proficiência em Testes de QUALQUER atributo ligados à profissão.
 * O jogador usa os avanços do 5º, 10º, 15º e 20º nível (nova profissão, se o mestre liberou o Livro, ou Avanço Planejado); o
 * mestre concede Grandes Feitos, libera o livro e remove profissões. O servidor confere o que é do mestre.
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { salvar, mestre, rolar, calc } = useFicha();

const prof = computed<ProfissoesFicha>(() => ({ ...profissoesPadrao(), ...(props.ficha.profissoes ?? {}) }));
const nivel = computed(() => Number(props.ficha.nivel));
const avanco = computed(() => avancoDisponivel(props.ficha));
const mensagem = ref('');

// --- Pau-para-Toda-Obra: a segunda profissão inicial (sem proficiência em perícias nem ferramentas)
const segundaId = ref('');
const podeSegunda = computed(() => temPauParaTodaObra(props.ficha) && !prof.value.semProfissao && prof.value.lista.length === 1);
const problemasSegunda = computed(() => (segundaId.value ? problemasDaSegundaProfissao(props.ficha, segundaId.value) : []));
function escolherSegunda() {
    if (!segundaId.value || problemasSegunda.value.length) return;
    salvar(camposDaSegundaProfissao(props.ficha, segundaId.value));
    segundaId.value = '';
}

// --- Ofício ----------------------------------------------------------------------------------------------------------------
const atributoOficio = ref<AtributoId>('sab');
const profissaoOficio = ref(0);
const alvoDoOficio = computed(() => prof.value.lista[profissaoOficio.value] ?? prof.value.lista[0]);
function rolarOficio(evento: MouseEvent) {
    const modo = evento.shiftKey ? 'vantagem' : evento.ctrlKey || evento.altKey ? 'desvantagem' : null;
    const nome = profissaoPorId(alvoDoOficio.value?.id)?.nome ?? 'Ofício';
    rolar(expressaoDoOficio(atributoOficio.value, modo), `Ofício (${nome}): Teste de ${ATRIBUTOS.find((a) => a.id === atributoOficio.value)?.nome}`);
}
const bonusDoOficio = computed(() => (calc.value[`mod.${atributoOficio.value}`] ?? 0) + (calc.value.prof ?? 0));

// --- avanço (jogador) -------------------------------------------------------------------------------------------------------
const nova = reactive({ id: '', de: '', para: '' });
const novaProfissao = computed(() => profissaoPorId(nova.id));
const disponiveis = computed(() => PROFISSOES.filter((p) => !prof.value.lista.some((x) => x.id === p.id)));
const motivosNova = computed(() => (nova.id ? problemasDaNovaProfissao(props.ficha, nova.id) : []));
const minhasPericias = computed(() => PERICIAS.filter((p) => p.id !== 'oficio' && (props.ficha.pericias[p.id] ?? 0) > 0));
function aprender() {
    if (motivosNova.value.length) {
        mensagem.value = motivosNova.value[0];
        return;
    }
    mensagem.value = '';
    salvar(camposDaNovaProfissao(props.ficha, nova.id, nova.de && nova.para ? { de: nova.de, para: nova.para } : undefined));
    nova.id = nova.de = nova.para = '';
}
const subirPlanejado = (i: number) => salvar(camposDaGraduacao(props.ficha, i, true));

// --- mestre -----------------------------------------------------------------------------------------------------------------
const grandeFeito = (i: number) => salvar(camposDaGraduacao(props.ficha, i, false));
const remover = (i: number) => salvar(camposDaRemocaoDeProfissao(props.ficha, i));

const campo =
    'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const botao =
    'rounded-md border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
const botaoMestre = `${botao} border-ouro-500/50 text-ouro-100 hover:bg-ouro-500/20 disabled:cursor-not-allowed disabled:opacity-40`;
</script>

<template>
    <div class="grid gap-4 p-4">
        <section v-if="podeSegunda" class="rounded-lg border border-green-400/40 bg-green-500/5 p-3" aria-label="Segunda profissão inicial">
            <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-green-300">Pau-para-Toda-Obra: segunda profissão</h3>
            <p class="text-xs text-preto-400">
                Você começa com duas profissões e recebe todos os benefícios iniciais de ambas (características e itens), exceto as proficiências em
                perícias e ferramentas: essas vêm só da primeira.
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
                <select v-model="segundaId" class="rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs" aria-label="Segunda profissão">
                    <option value="">Escolha a segunda profissão</option>
                    <option v-for="p in PROFISSOES.filter((x) => !prof.lista.some((l) => l.id === x.id))" :key="p.id" :value="p.id">
                        {{ p.nome }}
                    </option>
                </select>
                <button
                    type="button"
                    :class="botao"
                    class="border-green-400/60 text-green-100 hover:bg-green-500/20"
                    :disabled="!segundaId || problemasSegunda.length > 0"
                    @click="escolherSegunda"
                >
                    Adicionar
                </button>
            </div>
            <ul v-if="problemasSegunda.length" class="mt-1 list-disc pl-5 text-xs text-amber-300">
                <li v-for="x in problemasSegunda" :key="x">{{ x }}</li>
            </ul>
        </section>

        <!-- controles do mestre -->
        <section v-if="mestre" class="rounded-lg border border-ouro-500/40 bg-ouro-500/5 p-3" aria-label="Controles do mestre">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-ouro-300">Mestre: Profissões</h3>
            <div class="flex flex-wrap items-center gap-2 text-sm">
                <button
                    type="button"
                    :class="[
                        botao,
                        prof.livroLido ? 'border-green-400 bg-green-500/20 text-green-100' : 'border-preto-600 text-preto-200 hover:bg-preto-800',
                    ]"
                    :aria-pressed="prof.livroLido"
                    title="O personagem leu um Livro de Profissão ou teve um tutor (2 h por dia, 90 dias ou 2 níveis): libera uma nova profissão no próximo avanço"
                    @click="salvar({ 'profissoes.livroLido': !prof.livroLido })"
                >
                    {{ prof.livroLido ? 'Livro de Profissão lido' : 'Liberar Livro de Profissão' }}
                </button>
                <span class="text-xs text-preto-400">
                    Avanços usados: {{ prof.usados.length ? prof.usados.map((n) => `${n}º`).join(', ') : 'nenhum' }} ·
                    {{ avanco ? `avanço livre do ${avanco}º nível` : 'nenhum avanço livre' }}
                </span>
            </div>
            <p class="mt-1 text-xs text-preto-400">
                Grande Feito: ação notável ou teste da profissão com CD 26 ou mais numa jogada única, sem vantagem, rerrolagem ou acerto automático.
            </p>
        </section>

        <!-- sem profissão -->
        <section v-if="prof.semProfissao" aria-label="Sem profissão">
            <h3 class="font-serif text-lg font-semibold text-ouro-200">{{ SEM_PROFISSAO.nome }}</h3>
            <p class="text-xs text-preto-400">{{ SEM_PROFISSAO.descricao }}</p>
            <ul class="mt-2 grid gap-2 sm:grid-cols-2">
                <li v-for="t in SEM_PROFISSAO.tracos" :key="t.id" class="rounded-lg border border-preto-700 bg-preto-900/60 p-3">
                    <p class="font-semibold text-ouro-100">{{ t.nome }}</p>
                    <p class="text-xs leading-relaxed text-preto-200">{{ t.descricao }}</p>
                </li>
            </ul>
        </section>
        <p v-else-if="!prof.lista.length" class="text-sm text-preto-300">
            Este personagem ainda não tem profissão. Use o assistente de criação (Construtor) para escolher a do 1º nível.
        </p>

        <!-- Ofício -->
        <section v-if="prof.lista.length" class="rounded-lg border border-preto-700 bg-preto-900/60 p-3" aria-label="Ofício">
            <h3 :class="estilos?.rotulo">{{ nomeDoOficio(ficha) }}</h3>
            <p class="text-xs text-preto-400">
                O Bônus de Proficiência vale em Testes de Atributo de QUALQUER atributo relacionados à profissão. Escolha o atributo e role (Shift =
                vantagem, Ctrl = desvantagem).
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
                <select v-if="prof.lista.length > 1" v-model.number="profissaoOficio" :class="campo" aria-label="Profissão do teste">
                    <option v-for="(x, i) in prof.lista" :key="x.id" :value="i">
                        {{ profissaoPorId(x.id)?.nome }} ({{ graduacaoPorId(x.graduacao).nome }})
                    </option>
                </select>
                <select v-model="atributoOficio" :class="campo" aria-label="Atributo do teste">
                    <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id">{{ a.nome }}</option>
                </select>
                <button
                    type="button"
                    :class="[botao, 'flex items-center gap-1 border-ouro-400 bg-ouro-500/20 text-ouro-100 hover:bg-ouro-500/30']"
                    @click="rolarOficio($event)"
                >
                    <Dices class="size-4" /> Rolar 1d20 {{ bonusDoOficio >= 0 ? '+' : '' }}{{ bonusDoOficio }}
                </button>
                <span v-if="alvoDoOficio && alvoDoOficio.graduacao >= 1" class="text-xs text-preto-400">
                    {{ graduacaoPorId(alvoDoOficio.graduacao).nome }}:
                    {{
                        alvoDoOficio.graduacao === 1
                            ? 'vantagem 3×/descanso longo'
                            : alvoDoOficio.graduacao === 2
                              ? 'd20 de 9 ou menos conta 10 (confira na mesa)'
                              : 'falha vira sucesso 3×'
                    }}
                </span>
            </div>
        </section>

        <!-- avanço do 5º, 10º, 15º e 20º nível -->
        <section
            v-if="prof.lista.length && !prof.semProfissao && avanco !== null"
            class="rounded-lg border border-ouro-500/40 bg-ouro-500/5 p-3"
            aria-label="Avanço de profissão"
        >
            <h3 class="text-xs font-semibold uppercase tracking-wide text-ouro-300">Avanço do {{ avanco }}º nível</h3>
            <p class="text-xs text-preto-300">
                Escolha: subir a graduação de uma profissão (Avanço Planejado) ou aprender uma nova (exige o Livro de Profissão liberado pelo mestre).
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
                <button
                    v-for="(x, i) in prof.lista"
                    :key="x.id"
                    type="button"
                    :disabled="x.graduacao >= 3"
                    :class="[botao, 'border-ouro-500/50 text-ouro-100 hover:bg-ouro-500/20 disabled:opacity-40']"
                    @click="subirPlanejado(i)"
                >
                    Subir {{ profissaoPorId(x.id)?.nome }} para {{ GRADUACOES[Math.min(3, x.graduacao + 1)].nome }}
                </button>
            </div>
            <div class="mt-3 grid gap-2">
                <div class="flex flex-wrap items-center gap-2">
                    <select v-model="nova.id" :class="campo" aria-label="Nova profissão">
                        <option value="">Nova profissão…</option>
                        <option v-for="p in disponiveis" :key="p.id" :value="p.id">{{ p.nome }}</option>
                    </select>
                    <template v-if="novaProfissao">
                        <span class="text-xs text-preto-400">Trocar uma proficiência:</span>
                        <select v-model="nova.de" :class="campo" aria-label="Perícia a trocar">
                            <option value="">(não trocar)</option>
                            <option v-for="p in minhasPericias" :key="p.id" :value="p.id">{{ p.nome }}</option>
                        </select>
                        <select v-model="nova.para" :class="campo" aria-label="Perícia nova">
                            <option value="">por…</option>
                            <option v-for="id in novaProfissao.pericias" :key="id" :value="id">{{ PERICIAS.find((x) => x.id === id)?.nome }}</option>
                        </select>
                    </template>
                    <button
                        type="button"
                        :disabled="!nova.id"
                        :class="[botao, 'border-ouro-400 bg-ouro-500/20 text-ouro-100 disabled:opacity-40']"
                        @click="aprender"
                    >
                        Aprender
                    </button>
                </div>
                <p v-if="nova.id && motivosNova.length" class="text-xs text-preto-400">{{ motivosNova[0] }}</p>
                <p v-if="mensagem" class="text-xs text-red-300" role="alert">{{ mensagem }}</p>
                <p class="text-[11px] text-preto-500">
                    Uma profissão nova não dá perícias nem itens iniciais; só deixa trocar uma proficiência que você já tem por uma da lista dela.
                </p>
            </div>
        </section>
        <p v-else-if="prof.lista.length && !prof.semProfissao" class="text-xs text-preto-500">
            Novas profissões e Avanço Planejado só no {{ NIVEIS_DE_PROFISSAO.join('º, ') }}º nível (você está no {{ nivel }}º).
        </p>

        <!-- as profissões -->
        <section
            v-for="(x, i) in prof.lista"
            :key="x.id"
            class="rounded-lg border border-preto-700 bg-preto-900/40"
            :aria-label="profissaoPorId(x.id)?.nome"
        >
            <template v-if="profissaoPorId(x.id)">
                <header class="flex flex-wrap items-center gap-2 border-b border-preto-800 p-3">
                    <h3 class="font-serif text-lg font-semibold text-ouro-200">{{ profissaoPorId(x.id)!.nome }}</h3>
                    <span class="rounded-full border border-ouro-400/60 px-2 py-0.5 text-xs font-semibold text-ouro-100">{{
                        graduacaoPorId(x.graduacao).nome
                    }}</span>
                    <span class="text-xs text-preto-400">aprendida no {{ x.nivel }}º nível</span>
                    <span v-if="x.graduacao > 0" class="text-xs text-preto-400">
                        Aperfeiçoamento: −{{ graduacaoPorId(x.graduacao).reducaoCd }} nas CDs · {{ graduacaoPorId(x.graduacao).desconto }}% de
                        desconto em Bellys · dados d6 → {{ resolverModelos('{dado:6}', x.graduacao) }}
                    </span>
                    <span v-if="mestre" class="ml-auto flex gap-2">
                        <button type="button" :disabled="x.graduacao >= 3" :class="botaoMestre" @click="grandeFeito(i)">
                            Grande Feito (+1 graduação)
                        </button>
                        <button v-if="x.nivel > 1 || prof.lista.length > 1" type="button" :class="botaoMestre" @click="remover(i)">Remover</button>
                    </span>
                </header>
                <div class="grid gap-3 p-3">
                    <p class="text-xs text-preto-300">
                        <b>{{ profissaoPorId(x.id)!.ferramenta }}</b> (proficiência) · Testes de exemplo:
                        {{ profissaoPorId(x.id)!.testes.join('; ') }}.
                    </p>
                    <details v-if="x.nivel === 1" class="text-xs text-preto-300">
                        <summary class="cursor-pointer font-semibold text-preto-200">Itens iniciais (entregues pelo mestre)</summary>
                        <ul class="mt-1 list-disc pl-5">
                            <li v-for="it in profissaoPorId(x.id)!.itens" :key="it">{{ it }}</li>
                        </ul>
                    </details>
                    <article
                        v-for="t in tracosDaProfissao(profissaoPorId(x.id)!, x.graduacao)"
                        :key="t.id"
                        class="rounded border border-preto-700 bg-preto-950/60 p-3"
                    >
                        <p class="font-semibold text-ouro-100">{{ t.nome }}</p>
                        <p class="whitespace-pre-wrap text-xs leading-relaxed text-preto-200">{{ t.descricao }}</p>
                    </article>
                </div>
            </template>
        </section>
    </div>
</template>
