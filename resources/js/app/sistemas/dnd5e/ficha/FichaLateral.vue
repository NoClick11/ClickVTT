<script setup lang="ts">
import { Camera, Flame, Footprints, Heart, Shield, Skull, Sparkles, Swords, Zap } from 'lucide-vue-next';
import { computed, inject } from 'vue';
import DadoIcone from '../../../components/DadoIcone.vue';
import type { PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import AreaRolavel from '../../../nucleo/ui/AreaRolavel.vue';
import CampoNumero from '../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../nucleo/ui/CampoTexto.vue';
import IndicadorD20 from '../../../nucleo/ui/IndicadorD20.vue';
import { condicaoPorId } from '../condicoes';
import { estilos, useFicha } from '../contexto';
import { camposDoDadoDeVida, camposDoTesteContraMorte, comSinal, DADOS_DE_VIDA, type FichaDnd5e } from '../regras';

const props = defineProps<{ ficha: FichaDnd5e; personagem: PersonagemFicha }>();
const { editar, calc, salvar, rolar, d20, modoDe, armas } = useFicha();

const abrirAlterarFoto = inject<((p: { id: number; nome: string; foto?: string | null; fotoToken?: string | null; ehNpc?: boolean }) => void) | null>(
    'abrirAlterarFoto',
    null,
);
const foto = computed(() => (props.ficha as any).foto ?? props.personagem.foto ?? null);
const fotoToken = computed(() => (props.ficha as any).foto_token ?? props.personagem.foto_token ?? null);
function aoClicarFoto() {
    abrirAlterarFoto?.({
        id: props.personagem.id,
        nome: props.personagem.nome,
        foto: foto.value,
        fotoToken: fotoToken.value,
        ehNpc: false,
    });
}

const pvPct = computed(() => (calc.value['pv.max'] > 0 ? Math.max(0, Math.min(100, (props.ficha.pv.atual / calc.value['pv.max']) * 100)) : 0));
const pvCor = computed(() => (pvPct.value > 50 ? '#22c55e' : pvPct.value > 25 ? '#eab308' : '#ef4444'));
const dvPct = computed(() => (calc.value['dv.max'] > 0 ? (props.ficha.dadosVida.restantes / calc.value['dv.max']) * 100 : 0));

/** Dado de vida: rola `1dX + mod. CON` e o total sorteado pelo servidor cura PV e gasta um dado. */
const gastarDadoDeVida = () =>
    rolar(`1${props.ficha.dadosVida.tipo}+@mod.con`, 'Dado de vida', (total) => salvar(camposDoDadoDeVida(props.ficha, total, calc.value['pv.max'])));
/** Teste contra a morte: d20 puro; o resultado marca sucesso/falha (20 devolve 1 PV). */
const testeContraMorte = () => rolar('1d20', 'Teste contra a morte', (d) => salvar(camposDoTesteContraMorte(props.ficha, d)));
const dadoDeVidaDisponivel = computed(() => props.ficha.dadosVida.restantes > 0 && props.ficha.pv.atual < calc.value['pv.max']);

/** Clicar na bolinha N marca até N; clicar de novo na última marcada desmarca. */
const marcar = (campo: string, atual: number, i: number) => salvar({ [campo]: atual === i ? i - 1 : i });
const titulo = estilos.rotulo;
const condicoesAtivas = computed(() => (props.ficha.condicoes ?? []).map((id) => condicaoPorId(id)).filter((c) => c !== undefined));
</script>

<template>
    <aside
        class="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-ouro-500/20 bg-preto-900/40 p-3 [&>*]:shrink-0"
        aria-label="Resumo do personagem"
    >
        <!-- retrato (foto ou inicial na cor do personagem) -->
        <div
            class="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-ouro-500/30 transition hover:border-ouro-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            :style="{ background: foto ? undefined : `radial-gradient(circle at 30% 25%, ${personagem.cor}, #0d0a12 85%)` }"
            role="button"
            tabindex="0"
            :aria-label="`Alterar foto de ${personagem.nome}`"
            title="Clique para alterar a foto do personagem"
            @click="aoClicarFoto"
            @keydown.enter="aoClicarFoto"
            @keydown.space.prevent="aoClicarFoto"
        >
            <img v-if="foto" :src="foto" :alt="`Retrato de ${personagem.nome}`" class="h-full w-full object-cover" />
            <span v-else class="font-serif text-7xl font-semibold text-preto-950/80 mix-blend-overlay">{{
                personagem.nome.slice(0, 1).toUpperCase()
            }}</span>

            <!-- Overlay de hover com ícone de câmera -->
            <div
                class="absolute inset-0 flex flex-col items-center justify-center bg-preto-950/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100"
                aria-hidden="true"
            >
                <Camera class="mb-1 size-6 text-ouro-300" />
                <span class="text-[11px] font-medium text-ouro-100">Alterar foto</span>
            </div>

            <!-- CA (calculada: 10 + mod. de Destreza + ajuste) -->
            <div
                class="pointer-events-none absolute -bottom-px left-1/2 z-10 flex -translate-x-1/2 translate-y-1/3 items-center justify-center"
                title="Classe de Armadura: 10 + modificador de Destreza + ajuste"
                aria-label="Classe de Armadura"
            >
                <Shield class="size-16 fill-preto-950 stroke-ouro-400" stroke-width="1.5" />
                <span class="absolute flex flex-col items-center leading-none"
                    ><span class="font-serif text-2xl font-bold text-ouro-100">{{ calc.ca }}</span
                    ><span class="text-[8px] font-semibold uppercase tracking-wider text-preto-400">CA</span></span
                >
            </div>
        </div>

        <!-- ajustes manuais (modo Editar): somam ao valor calculado -->
        <div
            v-if="editar"
            class="mt-4 grid grid-cols-2 gap-x-2 gap-y-1 rounded-md border border-preto-700 bg-preto-950 p-2 text-xs"
            role="group"
            aria-label="Ajustes manuais"
        >
            <p class="col-span-2" :class="titulo">Ajustes (somam ao calculado)</p>
            <label class="flex items-center justify-between gap-1 text-preto-300"
                >CA
                <CampoNumero
                    :model-value="ficha.ajustes?.ca ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste de CA"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.ca': $event })"
            /></label>
            <label class="flex items-center justify-between gap-1 text-preto-300"
                >Inic.
                <CampoNumero
                    :model-value="ficha.ajustes?.iniciativa ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste de iniciativa"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.iniciativa': $event })"
            /></label>
            <label class="col-span-2 flex items-center justify-between gap-1 text-preto-300"
                >Proficiência
                <CampoNumero
                    :model-value="ficha.ajustes?.proficiencia ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste de proficiência"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.proficiencia': $event })"
            /></label>
        </div>

        <!-- exaustão -->
        <!-- exaustão: 6 níveis; clicar no N marca até N, clicar de novo no último desmarca -->
        <div
            class="flex items-center justify-between gap-2 rounded-lg border bg-preto-950/70 px-2.5 py-1.5"
            :class="[editar ? '' : 'mt-4', ficha.exaustao > 0 ? 'border-red-400/50' : 'border-preto-700']"
            role="group"
            aria-label="Exaustão"
            title="Exaustão: cada nível piora os testes; no 6º o personagem morre"
        >
            <span class="flex items-center gap-1.5" :class="titulo"
                ><Flame class="size-3.5" :class="ficha.exaustao > 0 ? 'text-red-400' : 'text-preto-500'" /> Exaustão</span
            >
            <span class="flex items-center gap-1"
                ><button
                    v-for="i in 6"
                    :key="i"
                    type="button"
                    class="size-3.5 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    :class="
                        i <= ficha.exaustao
                            ? 'border-red-400 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                            : 'border-preto-600 hover:border-red-400/60'
                    "
                    :aria-label="`Exaustão ${i}`"
                    :aria-pressed="i <= ficha.exaustao"
                    @click="marcar('exaustao', ficha.exaustao, i)"
            /></span>
        </div>

        <!-- condições ativas (ligam e desligam na aba Efeitos) -->
        <ul v-if="condicoesAtivas.length" class="flex flex-wrap gap-1" aria-label="Condições ativas">
            <li
                v-for="c in condicoesAtivas"
                :key="c.id"
                class="rounded-full border border-red-400/60 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200"
                :title="c.descricao"
            >
                {{ c.nome }}
            </li>
        </ul>

        <!-- iniciativa e proficiência lado a lado; o deslocamento (texto livre) ocupa a linha de baixo -->
        <div class="grid grid-cols-2 gap-1.5 text-center">
            <!-- a caixa inteira rola a iniciativa (Shift = vantagem, Ctrl = desvantagem) -->
            <AreaRolavel
                rotulo="iniciativa"
                :modo="modoDe('iniciativa')"
                class="group relative rounded-lg border border-preto-700 bg-gradient-to-b from-preto-800/70 to-preto-950 px-2 py-2 text-center transition hover:border-ouro-400"
                @rolar="d20($event, 'iniciativa', 'Iniciativa')"
            >
                <Zap class="mx-auto size-4 text-ouro-400" aria-hidden="true" />
                <span class="mt-0.5 block font-serif text-2xl font-bold leading-none text-ouro-100">{{ comSinal(calc.iniciativa) }}</span>
                <span :class="titulo" class="mt-1 block">Iniciativa</span>
                <IndicadorD20
                    :modo="modoDe('iniciativa')"
                    class="absolute right-1 top-1 block size-4 opacity-30 transition group-hover:scale-110 group-hover:opacity-100"
                />
            </AreaRolavel>
            <div class="rounded-lg border border-preto-700 bg-gradient-to-b from-preto-800/70 to-preto-950 px-2 py-2" title="Bônus de proficiência">
                <Sparkles class="mx-auto size-4 text-ouro-400" aria-hidden="true" />
                <p class="mt-0.5 font-serif text-2xl font-bold leading-none text-ouro-100">{{ comSinal(calc.prof) }}</p>
                <p :class="titulo" class="mt-1">Proficiência</p>
            </div>
            <div
                class="col-span-2 flex items-center gap-2.5 rounded-lg border border-preto-700 bg-gradient-to-b from-preto-800/70 to-preto-950 px-2.5 py-2 text-left"
            >
                <Footprints class="size-4 shrink-0 text-ouro-400" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                    <p :class="titulo">Deslocamento</p>
                    <!-- Editar: campo com borda para ficar claro que dá para mudar. Jogar: texto que quebra em até duas linhas. -->
                    <CampoTexto
                        v-if="editar"
                        :model-value="ficha.deslocamento"
                        :maximo="80"
                        aria-label="Deslocamento"
                        title="Deslocamento: escreva como quiser (ex.: 9 m, 12 m, voo 18 m)"
                        class="mt-0.5 w-full rounded border border-preto-600 bg-preto-900 px-1.5 font-serif text-base font-semibold text-ouro-100 hover:border-ouro-500/60 focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ deslocamento: $event })"
                    />
                    <p
                        v-else
                        class="line-clamp-2 break-words font-serif text-base font-semibold leading-tight text-ouro-100"
                        :title="ficha.deslocamento"
                        aria-label="Deslocamento"
                    >
                        {{ ficha.deslocamento || '—' }}
                    </p>
                </div>
            </div>
        </div>

        <!-- pontos de vida -->
        <section aria-label="Pontos de vida">
            <p :class="titulo" class="mb-1 flex items-center gap-1"><Heart class="size-3 text-red-400" /> Pontos de Vida</p>
            <div
                class="relative h-7 overflow-hidden rounded-md border border-preto-700 bg-preto-950"
                role="progressbar"
                :aria-valuenow="ficha.pv.atual"
                aria-valuemin="0"
                :aria-valuemax="calc['pv.max']"
                aria-label="Pontos de vida"
            >
                <div class="absolute inset-y-0 left-0 transition-all" :style="{ width: pvPct + '%', backgroundColor: pvCor, opacity: 0.55 }" />
                <div class="absolute inset-0 flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                    <CampoNumero
                        :model-value="ficha.pv.atual"
                        :min="0"
                        :max="9999"
                        aria-label="PV atuais"
                        :class="estilos.num"
                        @salvar="salvar({ 'pv.atual': $event })"
                    />
                    <span class="text-preto-400">/</span>
                    <CampoNumero
                        :model-value="editar ? ficha.pv.max : calc['pv.max']"
                        :min="0"
                        :max="9999"
                        :somente-leitura="!editar"
                        :title="calc['pv.max'] !== ficha.pv.max ? `Base ${ficha.pv.max}; com os efeitos dos itens, ${calc['pv.max']}` : undefined"
                        aria-label="PV máximos"
                        :class="estilos.num"
                        @salvar="salvar({ 'pv.max': $event })"
                    />
                </div>
            </div>
            <label class="mt-1 flex items-center justify-between text-xs text-preto-400"
                >PV temporários
                <CampoNumero
                    :model-value="ficha.pv.temp"
                    :min="0"
                    :max="9999"
                    aria-label="PV temporários"
                    :class="estilos.num"
                    @salvar="salvar({ 'pv.temp': $event })"
            /></label>
        </section>

        <!-- ataques (como no Foundry): a linha inteira da arma é o botão que rola o ataque; o dano vem depois, pelos botões do
             card do chat (Dano e, no crítico, Dano crítico). Shift = vantagem, Ctrl/Alt = desvantagem. -->
        <section aria-label="Ataques">
            <p :class="titulo" class="mb-1 flex items-center gap-1"><Swords class="size-3" /> Ataques</p>
            <!-- coluna flexível (não grade): o nome comprido da arma é cortado com "…" em vez de esticar a barra -->
            <ul v-if="armas.length" class="flex flex-col gap-1.5">
                <li v-for="a in armas" :key="a.itemId" class="min-w-0">
                    <button
                        type="button"
                        class="group flex min-h-12 w-full items-center gap-2.5 rounded-lg border border-preto-700 bg-gradient-to-br from-preto-800/70 to-preto-950 px-2 py-1.5 text-left transition hover:border-ouro-400 hover:from-ouro-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 active:scale-[0.98]"
                        :aria-label="`Atacar com ${a.nome}: ${comSinal(a.ataque)} para acertar, dano ${a.dano}${a.danoBonus ? comSinal(a.danoBonus) : ''}`"
                        :title="`Clique para atacar com ${a.nome}. Shift = vantagem, Ctrl = desvantagem.`"
                        @click="d20($event, `arma.${a.itemId}.ataque`, a.nome)"
                    >
                        <span class="relative size-8 shrink-0 transition group-hover:scale-110">
                            <DadoIcone :faces="20" />
                            <span
                                v-if="modoDe(`arma.${a.itemId}.ataque`)"
                                class="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold leading-none text-preto-950"
                                :class="modoDe(`arma.${a.itemId}.ataque`) === 'vantagem' ? 'bg-green-400' : 'bg-red-400'"
                                :title="`${modoDe(`arma.${a.itemId}.ataque`)} (efeito ativo)`"
                                aria-hidden="true"
                                >{{ modoDe(`arma.${a.itemId}.ataque`) === 'vantagem' ? 'V' : 'D' }}</span
                            >
                        </span>
                        <span class="min-w-0 flex-1">
                            <span
                                class="line-clamp-2 break-words text-sm font-semibold leading-tight text-preto-100 group-hover:text-ouro-100"
                                :title="a.nome"
                                >{{ a.nome }}</span
                            >
                            <span class="mt-0.5 block truncate font-mono text-[11px] text-preto-400"
                                >{{ a.dano }}{{ a.danoBonus ? comSinal(a.danoBonus) : ''
                                }}<template v-if="a.tipoDano"> · {{ a.tipoDano }}</template></span
                            >
                        </span>
                        <span class="shrink-0 text-right">
                            <span class="block font-serif text-xl font-bold tabular-nums leading-none text-ouro-100">{{ comSinal(a.ataque) }}</span>
                            <span
                                v-if="a.margem < 20"
                                class="mt-0.5 block text-[9px] font-semibold uppercase text-ouro-300"
                                :title="`Crítico com ${a.margem} ou mais no d20 (margem crítica da arma)`"
                                >crít. {{ a.margem }}–20</span
                            >
                        </span>
                    </button>
                </li>
            </ul>
            <p v-else class="text-[10px] text-preto-500">Equipe uma arma (o mestre cria o item com dado de dano) e ela aparece aqui.</p>
        </section>

        <!-- dados de vida (máximo = nível) -->
        <section aria-label="Dados de vida">
            <p :class="titulo" class="mb-1">Dados de Vida</p>
            <div class="relative h-6 overflow-hidden rounded-md border border-preto-700 bg-preto-950">
                <div class="absolute inset-y-0 left-0 bg-ouro-500/40" :style="{ width: dvPct + '%' }" />
                <div class="absolute inset-0 flex items-center justify-center gap-0.5 text-xs font-semibold tabular-nums">
                    <CampoNumero
                        :model-value="ficha.dadosVida.restantes"
                        :min="0"
                        :max="calc['dv.max']"
                        aria-label="Dados de vida restantes"
                        class="w-7 rounded border border-transparent bg-transparent text-center focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ 'dadosVida.restantes': $event })"
                    />
                    / {{ calc['dv.max'] }}
                    <select
                        v-if="editar"
                        :value="ficha.dadosVida.tipo"
                        aria-label="Tipo do dado de vida"
                        class="ml-0.5 rounded border border-preto-700 bg-preto-950 text-xs"
                        @change="salvar({ 'dadosVida.tipo': ($event.target as HTMLSelectElement).value })"
                    >
                        <option v-for="d in DADOS_DE_VIDA" :key="d" :value="d">{{ d }}</option>
                    </select>
                    <span v-else>{{ ficha.dadosVida.tipo }}</span>
                </div>
            </div>
            <button
                v-if="!editar"
                type="button"
                :disabled="!dadoDeVidaDisponivel"
                class="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-ouro-500/40 py-1 text-xs font-semibold text-ouro-100 transition hover:bg-ouro-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:cursor-not-allowed disabled:opacity-40"
                :title="
                    dadoDeVidaDisponivel
                        ? `Gasta um dado de vida: rola 1${ficha.dadosVida.tipo} + mod. CON e recupera esse tanto de PV`
                        : 'Sem dados de vida ou com os PV no máximo'
                "
                @click="gastarDadoDeVida"
            >
                <span class="size-4"><DadoIcone :faces="Number(ficha.dadosVida.tipo.slice(1))" /></span> Rolar dado de vida
            </button>
        </section>

        <!-- testes contra a morte -->
        <section aria-label="Testes contra a morte">
            <p :class="titulo" class="mb-1 flex items-center gap-1"><Skull class="size-3" /> Testes contra a Morte</p>
            <button
                v-if="!editar"
                type="button"
                class="mb-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-ouro-500/40 py-1 text-xs font-semibold text-ouro-100 transition hover:bg-ouro-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                title="Rola 1d20: 10 ou mais é sucesso, 9 ou menos é falha, 1 são duas falhas, 20 volta com 1 PV"
                @click="testeContraMorte"
            >
                <span class="size-4"><DadoIcone :faces="20" /></span> Rolar teste
            </button>
            <div class="grid gap-1 text-xs">
                <div class="flex items-center justify-between">
                    <span class="text-preto-400">Sucessos</span
                    ><span class="flex gap-1"
                        ><button
                            v-for="i in 3"
                            :key="i"
                            type="button"
                            class="size-3.5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="i <= ficha.morte.sucessos ? 'border-green-400 bg-green-500' : 'border-preto-600'"
                            :aria-label="`Sucesso ${i}`"
                            :aria-pressed="i <= ficha.morte.sucessos"
                            @click="marcar('morte.sucessos', ficha.morte.sucessos, i)"
                    /></span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-preto-400">Falhas</span
                    ><span class="flex gap-1"
                        ><button
                            v-for="i in 3"
                            :key="i"
                            type="button"
                            class="size-3.5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="i <= ficha.morte.falhas ? 'border-red-400 bg-red-500' : 'border-preto-600'"
                            :aria-label="`Falha ${i}`"
                            :aria-pressed="i <= ficha.morte.falhas"
                            @click="marcar('morte.falhas', ficha.morte.falhas, i)"
                    /></span>
                </div>
            </div>
        </section>
    </aside>
</template>
