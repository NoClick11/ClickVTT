<script setup lang="ts">
import { Flame, Footprints, Heart, Shield, Sparkle, Sparkles, Swords, Zap } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import DadoIcone from '../../../components/DadoIcone.vue';
import type { PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import { iconeDoStatus } from '../../../nucleo/status';
import AreaRolavel from '../../../nucleo/ui/AreaRolavel.vue';
import CampoNumero from '../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../nucleo/ui/CampoTexto.vue';
import IndicadorD20 from '../../../nucleo/ui/IndicadorD20.vue';
import { condicaoPorId } from '../condicoes';
import { estilos, useFicha } from '../contexto';
import EfeitosDialog from '../EfeitosDialog.vue';
import { itemDoCatalogo } from '../itens';
import { municoesDaArma } from '../itens/municoes';
import { camposDoDadoDeVida, comSinal, DADOS_DE_VIDA, hakiDesligado, textoDeMovimento, type FichaOnePiece } from '../regras';

const props = defineProps<{ ficha: FichaOnePiece; personagem: PersonagemFicha }>();
const { editar, calc, salvar, rolar, d20, modoDe, armas, origens, acoes, rodada, itens } = useFicha();
/** Ataques com arma: o 1º gasta a Ação; os seguintes valem até o limite (Ataque Extra e afins, mais os extras do turno). */
const ataquesDaAcao = (distancia: boolean) =>
    Math.max(1, (calc.value['ataques.acao'] ?? 1) + (distancia ? (calc.value['ataques.distancia'] ?? 0) : 0));
const ataquePermitido = (a: { distancia: boolean }) => acoes.ataque(ataquesDaAcao(a.distancia));
/** O contador do turno (a melhor arma é a referência: a de distância soma o Engatilhado). */
const contador = computed(() => acoes.ataque(Math.max(...armas.value.map((a) => ataquesDaAcao(a.distancia)), ataquesDaAcao(false))));
/**
 * Arma por munição (pistola, mosquete, arco...): o clique abre a lista das munições do inventário que servem a ela (pelo nome, Cap. 8); a escolhida dá o
 * dado e o tipo do dano e gasta 1 unidade. O servidor confere tudo de novo.
 */
const escolhendoMunicao = ref<number | null>(null);
interface PilhaDeMunicao {
    itemId: number;
    nome: string;
    qtd: number;
    dano: string | null;
    tipoDano: string | null;
}
const municoesDa = (a: { catalogoId: string | null }): PilhaDeMunicao[] => {
    const aceitas = municoesDaArma(a.catalogoId);
    const pilhas: PilhaDeMunicao[] = [];
    for (const secao of props.ficha.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens.value[ref.item_id];
            if (!item || ref.qtd <= 0) continue;
            const dados = item.dados as { catalogo?: { id?: string }; municao?: { dano: string; tipoDano?: string | null } } | null | undefined;
            if (dados?.municao) {
                // munição criada à mão: serve a qualquer arma por munição
                pilhas.push({
                    itemId: ref.item_id,
                    nome: item.nome,
                    qtd: ref.qtd,
                    dano: dados.municao.dano,
                    tipoDano: dados.municao.tipoDano ?? null,
                });
                continue;
            }
            const idDoCatalogo = dados?.catalogo?.id;
            if (!idDoCatalogo || !aceitas.includes(idDoCatalogo)) continue;
            const entrada = itemDoCatalogo(idDoCatalogo);
            pilhas.push({
                itemId: ref.item_id,
                nome: entrada?.nome ?? 'Munição',
                qtd: ref.qtd,
                dano: entrada?.arma?.dano ?? null,
                tipoDano: entrada?.arma?.tipoDano ?? null,
            });
        }
    }

    return pilhas;
};
function atacarComArma(evento: MouseEvent, a: { itemId: number; nome: string; municao: boolean }) {
    if (!a.municao) return d20(evento, `arma.${a.itemId}.ataque`, a.nome, { categoria: 'padrao' });
    escolhendoMunicao.value = escolhendoMunicao.value === a.itemId ? null : a.itemId;
}
function atirar(evento: MouseEvent, a: { itemId: number; nome: string }, pilha: PilhaDeMunicao) {
    escolhendoMunicao.value = null;
    d20(evento, `arma.${a.itemId}.ataque`, `${a.nome} (${pilha.nome})`, { categoria: 'padrao' }, pilha.itemId);
}
/** Só com o combate em curso o contador de ataques do turno faz sentido. */
const emCombate = computed(() => rodada.value !== null);

const pvPct = computed(() => (calc.value['pv.max'] > 0 ? Math.max(0, Math.min(100, (props.ficha.pv.atual / calc.value['pv.max']) * 100)) : 0));
const pvCor = computed(() => (pvPct.value > 50 ? '#22c55e' : pvPct.value > 25 ? '#eab308' : '#ef4444'));
const dvPct = computed(() => (calc.value['dv.max'] > 0 ? (props.ficha.dadosVida.restantes / calc.value['dv.max']) * 100 : 0));

/** Dado de vida: rola `1dX + mod. CON` e o total sorteado pelo servidor cura PV e gasta um dado. */
const gastarDadoDeVida = () =>
    rolar(`1${props.ficha.dadosVida.tipo}+@mod.con`, 'Dado de vida', (total) => salvar(camposDoDadoDeVida(props.ficha, total, calc.value['pv.max'])));
const dadoDeVidaDisponivel = computed(() => props.ficha.dadosVida.restantes > 0 && props.ficha.pv.atual < calc.value['pv.max']);

/** Clicar na bolinha N marca até N; clicar de novo na última marcada desmarca. */
const marcar = (campo: string, atual: number, i: number) => salvar({ [campo]: atual === i ? i - 1 : i });
const titulo = estilos.rotulo;
/** Deslocamento: com efeitos ativos nele (Forma Sulong...) vale o calculado; senão, o texto da ficha. */
const deslocamentoTexto = computed(() => {
    if (!Object.keys(origens.value).some((k) => k.startsWith('movimento.'))) return props.ficha.deslocamento || '—';
    const m = (t: string) => (calc.value[`movimento.${t}`] ?? 0) / 10;

    return textoDeMovimento({ normal: m('normal'), nado: m('nado'), escalada: m('escalada'), voo: m('voo') });
});
const alcanceCorpo = computed(() => String((calc.value['alcance.corpo'] ?? 15) / 10).replace('.', ',') + ' m');
/** Etiquetas de combate das características que valem agora (passivas e ativas ligadas). */
const etiquetas = computed(() => [
    ...new Set(
        props.ficha.caracteristicas
            .filter((c) => !hakiDesligado(c, props.ficha) && (c.tipo === 'passiva' || c.ativa === true))
            .flatMap((c) => c.etiquetas ?? []),
    ),
]);
const efeitosAberto = ref(false);
const condicoesAtivas = computed(() => (props.ficha.condicoes ?? []).map((id) => condicaoPorId(id)).filter((c) => c !== undefined));
</script>

<template>
    <aside
        class="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-ouro-500/20 bg-preto-900/40 p-3 [&>*]:shrink-0"
        aria-label="Resumo do personagem"
    >
        <!-- retrato (por enquanto a inicial na cor do personagem) -->
        <div
            class="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-ouro-500/30"
            :style="{ background: `radial-gradient(circle at 30% 25%, ${personagem.cor}, #0d0a12 85%)` }"
            role="img"
            :aria-label="`Retrato de ${personagem.nome}`"
        >
            <span class="font-serif text-7xl font-semibold text-preto-950/80 mix-blend-overlay">{{ personagem.nome.slice(0, 1).toUpperCase() }}</span>
            <!-- CA (calculada: 10 + mod. de Destreza + ajuste) -->
            <div
                class="absolute -bottom-px left-1/2 flex -translate-x-1/2 translate-y-1/3 items-center justify-center"
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

        <!-- efeitos: o botão abre a escolha; os ativos aparecem aqui e como ícones no token do mapa -->
        <section aria-label="Efeitos">
            <button
                type="button"
                class="flex w-full items-center justify-center gap-1.5 rounded-md border border-ouro-500/40 py-1.5 text-xs font-semibold text-ouro-100 transition hover:bg-ouro-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                title="Escolher os efeitos ativos (aparecem como ícones no token)"
                @click="efeitosAberto = true"
            >
                <Sparkle class="size-3.5" /> Efeitos<span
                    v-if="condicoesAtivas.length"
                    class="rounded-full bg-red-500/30 px-1.5 text-[10px] text-red-100"
                    >{{ condicoesAtivas.length }}</span
                >
            </button>
            <ul v-if="condicoesAtivas.length" class="mt-1.5 flex flex-wrap gap-1" aria-label="Efeitos ativos">
                <li
                    v-for="c in condicoesAtivas"
                    :key="c.id"
                    class="flex items-center gap-1 rounded-full border border-red-400/60 bg-red-500/15 py-0.5 pl-1 pr-2 text-[10px] font-semibold text-red-200"
                    :title="c.descricao"
                >
                    <span aria-hidden="true">{{ iconeDoStatus(c.id).icone }}</span> {{ c.nome
                    }}<span
                        v-if="ficha.duracoes?.[c.id]"
                        class="font-normal"
                        :title="ficha.duracoes[c.id].aoDano ? 'Acaba ao receber dano' : 'Turnos que faltam'"
                        >({{ ficha.duracoes[c.id].turnos }}{{ ficha.duracoes[c.id].aoDano ? '·dano' : '' }})</span
                    >
                </li>
            </ul>
            <EfeitosDialog v-model:open="efeitosAberto" :ficha="ficha" />
        </section>

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
                        :title="deslocamentoTexto"
                        aria-label="Deslocamento"
                    >
                        {{ deslocamentoTexto }}
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
            <label v-if="(calc['escudo.max'] ?? 0) > 0" class="mt-1 flex items-center justify-between gap-1 text-xs text-sky-300"
                >Pontos de Escudo
                <span class="flex items-center gap-1">
                    <CampoNumero
                        :model-value="ficha.pv.escudo ?? 0"
                        :min="0"
                        :max="calc['escudo.max']"
                        aria-label="Pontos de Escudo"
                        :class="estilos.num"
                        @salvar="salvar({ 'pv.escudo': $event })"
                    />
                    <span class="text-preto-400">/ {{ calc['escudo.max'] }}</span>
                    <button
                        type="button"
                        class="rounded border border-sky-400/50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-100 hover:bg-sky-500/20"
                        title="Renova os Pontos de Escudo (10 minutos fora de combate; também renovam ao fim do encontro)"
                        @click="salvar({ 'pv.escudo': calc['escudo.max'] })"
                    >
                        Renovar
                    </button>
                </span>
            </label>
        </section>

        <!-- ataques (como no Foundry): a linha inteira da arma é o botão que rola o ataque; o dano vem depois, pelos botões do
             card do chat (Dano e, no crítico, Dano crítico). Shift = vantagem, Ctrl/Alt = desvantagem. -->
        <section aria-label="Ataques">
            <p :class="titulo" class="mb-1 flex items-center gap-1">
                <Swords class="size-3" /> Ataques
                <span class="ml-auto normal-case tracking-normal text-preto-400" title="Alcance dos ataques corpo a corpo"
                    >alcance {{ alcanceCorpo }}</span
                >
            </p>
            <div
                v-if="emCombate"
                class="mb-1.5 flex items-center gap-1.5 rounded-md border border-preto-700 bg-preto-900/60 px-2 py-1 text-[11px] text-preto-300"
                role="status"
                :title="`Ataques com arma neste turno: o 1º gasta a Ação; os outros valem até ${contador.max} (${contador.max - contador.extras} da Ação + ${contador.extras} extra${contador.extras === 1 ? '' : 's'}).`"
            >
                <span>Ataques no turno</span>
                <span class="font-semibold tabular-nums" :class="contador.feitos >= contador.max ? 'text-red-300' : 'text-ouro-200'"
                    >{{ contador.feitos }}/{{ contador.max }}</span
                >
                <span v-if="contador.extras" class="text-sky-300">(+{{ contador.extras }} extra{{ contador.extras === 1 ? '' : 's' }})</span>
                <span v-if="acoes.darExtras" class="ml-auto flex gap-1">
                    <button
                        v-if="contador.extras"
                        type="button"
                        class="rounded border border-preto-700 px-1.5 hover:border-ouro-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        title="Tirar um ataque extra"
                        aria-label="Tirar um ataque extra"
                        @click="acoes.darExtras(-1)"
                    >
                        −1
                    </button>
                    <button
                        type="button"
                        class="rounded border border-sky-400/50 px-1.5 text-sky-200 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        title="Ganhar um ataque extra neste turno (Tempestade de Balas, Alvo Travado, Ataques Múltiplos...)"
                        aria-label="Ganhar um ataque extra neste turno"
                        @click="acoes.darExtras(1)"
                    >
                        +1 ataque extra
                    </button>
                </span>
            </div>
            <ul v-if="etiquetas.length" class="mb-1.5 flex flex-wrap gap-1" aria-label="Traços de combate">
                <li v-for="t in etiquetas" :key="t" class="rounded border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-200">
                    {{ t }}
                </li>
            </ul>
            <!-- coluna flexível (não grade): o nome comprido da arma é cortado com "…" em vez de esticar a barra -->
            <ul v-if="armas.length" class="flex flex-col gap-1.5">
                <li v-for="a in armas" :key="a.itemId" class="min-w-0">
                    <button
                        type="button"
                        class="group flex min-h-12 w-full items-center gap-2.5 rounded-lg border border-preto-700 bg-gradient-to-br from-preto-800/70 to-preto-950 px-2 py-1.5 text-left transition hover:border-ouro-400 hover:from-ouro-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        :aria-label="`Atacar com ${a.nome}: ${comSinal(a.ataque)} para acertar, dano ${a.dano}${a.danoBonus ? comSinal(a.danoBonus) : ''}`"
                        :disabled="!ataquePermitido(a).ok || (a.municao && !municoesDa(a).length)"
                        :aria-expanded="a.municao ? escolhendoMunicao === a.itemId : undefined"
                        :title="
                            a.municao && !municoesDa(a).length
                                ? `Sem munição que sirva a ${a.nome} no inventário`
                                : a.municao
                                  ? `Escolha a munição para atacar com ${a.nome}`
                                  : ataquePermitido(a).ok
                                    ? `Clique para atacar com ${a.nome} (${ataquePermitido(a).feitos > 0 ? 'ataque ' + (ataquePermitido(a).feitos + 1) + ' de ' + ataquePermitido(a).max : 'gasta a ' + acoes.rotulo('padrao').toLowerCase()}). Shift = vantagem, Ctrl = desvantagem.`
                                    : ataquePermitido(a).motivo
                        "
                        @click="atacarComArma($event, a)"
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
                                ><template v-if="a.municao">dano pela munição{{ a.danoBonus ? comSinal(a.danoBonus) : '' }}</template
                                ><template v-else
                                    >{{ a.dano }}{{ a.danoBonus ? comSinal(a.danoBonus) : ''
                                    }}<template v-if="a.tipoDano"> · {{ a.tipoDano }}</template></template
                                ></span
                            >
                            <span
                                v-if="a.etiquetas.length"
                                class="mt-0.5 block truncate text-[10px] text-ouro-300"
                                :title="a.etiquetas.join(' · ')"
                                >{{ a.etiquetas.join(' · ') }}</span
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
                    <ul
                        v-if="a.municao && escolhendoMunicao === a.itemId"
                        class="mt-1 grid gap-1 rounded-lg border border-ouro-500/30 bg-preto-950/90 p-1.5"
                        :aria-label="`Munição para ${a.nome}`"
                    >
                        <li v-for="pilha in municoesDa(a)" :key="pilha.itemId">
                            <button
                                type="button"
                                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-preto-100 transition hover:bg-ouro-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :title="`Atirar com ${pilha.nome}: gasta 1 unidade`"
                                @click="atirar($event, a, pilha)"
                            >
                                <span class="flex-1 font-semibold">{{ pilha.nome }}</span>
                                <span class="font-mono text-[11px] text-preto-400">{{ pilha.dano }} {{ pilha.tipoDano }}</span>
                                <span class="rounded bg-preto-800 px-1.5 text-[11px] tabular-nums text-ouro-200">×{{ pilha.qtd }}</span>
                            </button>
                        </li>
                    </ul>
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
    </aside>
</template>
