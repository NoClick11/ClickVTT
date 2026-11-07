<script setup lang="ts">
import { Pencil, Plus } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { resumoEfeito } from '../../../../nucleo/efeitos/resumo';
import { clonar } from '../../../../nucleo/ficha/caminho';
import { formatoDeResumo } from '../../alvos';
import { estilos, useFicha } from '../../contexto';
import EditorCaracteristicaDialog from '../../EditorCaracteristicaDialog.vue';
import {
    comBuffAlternado,
    expandirRolagem,
    hakiDesligado,
    usosMax,
    type AcaoCaracteristica,
    type Caracteristica,
    type FichaOnePiece,
} from '../../regras';

const props = defineProps<{ ficha: FichaOnePiece }>();
const { editar, salvar, calc, rolar, rodada, acao: executarAcao, acoes, modoDe, mestre } = useFicha();
/** Ligar uma característica gasta a categoria de ação dela (se tiver): só liga se puder agir agora. */
const podeLigar = (c: Caracteristica) => (c.ativa ? { ok: true } : acoes.pode(c.acao));

// índices da lista completa (a lista é salva por inteiro), agrupados por tipo
/** Em cada grupo, na frente: as ligadas, depois as que se usam ou ligam (usos, interruptor, ações, alternativa); o resto segue a ordem da ficha. */
const prioridade = (c: Caracteristica) =>
    c.ativa === true ? 0 : c.usos || c.alternativo || c.acoes?.length || (c.tipo === 'ativa' && c.efeitos?.length) ? 1 : 2;
const doTipo = (tipo: 'ativa' | 'passiva') =>
    props.ficha.caracteristicas
        .map((c, i) => ({ c, i }))
        .filter((x) => x.c.tipo === tipo)
        .sort((a, b) => prioridade(a.c) - prioridade(b.c) || a.i - b.i);
const grupos = computed(() => [
    { titulo: 'Ativas', itens: doTipo('ativa') },
    { titulo: 'Passivas', itens: doTipo('passiva') },
]);

function mudar(fn: (lista: Caracteristica[]) => void) {
    const lista = clonar(props.ficha.caracteristicas);
    fn(lista);
    salvar({ caracteristicas: lista });
}
/** Clicar no uso N marca até N usos restantes; clicar de novo no último marcado gasta mais um. */
const usar = (i: number, atual: number, n: number) => mudar((l) => (l[i].usos!.atual = atual === n ? n - 1 : n));
/**
 * Liga ou desliga o buff de uma característica ativa (vale na hora, em jogo: não depende do modo Editar). Ligar gasta um
 * uso, se ela tem usos; sem usos restantes não liga (ver `comBuffAlternado`).
 */
async function alternar(i: number) {
    const c = props.ficha.caracteristicas[i];
    // Um uso por rodada para o grupo (Heat, Electro...): ligar fora do limite não faz nada.
    if (!c.ativa && naRodadaBloqueada(c)) return;
    // Ligar gasta a ação da característica (o servidor recusa fora do turno ou com a ação já usada).
    if (!c.ativa && !(await acoes.gastar(c.acao))) return;
    const nova = comBuffAlternado(c, calc.value.prof, calc.value.nivel);
    if (nova) mudar((l) => (l[i] = marcarRodada(nova)));
}
/** Outra característica do mesmo grupo já foi usada nesta rodada (só vale com combate ativo). */
function naRodadaBloqueada(c: Caracteristica): boolean {
    if (!c.grupoRodada || rodada.value === null) return false;

    return props.ficha.caracteristicas.some((o) => o !== c && o.grupoRodada === c.grupoRodada && o.usadoNaRodada === rodada.value);
}
const marcarRodada = (c: Caracteristica): Caracteristica => (c.grupoRodada && rodada.value !== null ? { ...c, usadoNaRodada: rodada.value } : c);
/** Forma alternativa: junto da jogada de ataque, sem ação bônus. Gasta um uso do total e um do contador próprio. */
async function usarAlternativo(i: number) {
    const c = props.ficha.caracteristicas[i];
    if (!c.alternativo || c.alternativo.atual <= 0 || c.ativa || naRodadaBloqueada(c) || !c.usos || c.usos.atual <= 0) return;
    if (!(await acoes.gastar('livre'))) return; // junto da jogada de ataque, sem ação bônus
    mudar((l) => {
        l[i] = marcarRodada({
            ...c,
            ativa: true,
            usos: { ...c.usos!, atual: c.usos!.atual - 1 },
            alternativo: { ...c.alternativo!, atual: c.alternativo!.atual - 1 },
        });
    });
}
/** Botão de ação (condição, hospedar): gasta a categoria dele e só então age. */
async function agirComAcao(a: AcaoCaracteristica, i: number) {
    const c = props.ficha.caracteristicas[i];
    if (a.usa && (!c.usos || c.usos.atual <= 0)) return;
    if (!(await acoes.gastar(a.acao))) return;
    if (a.usa && c.usos) mudar((l) => (l[i] = { ...c, usos: { ...c.usos!, atual: c.usos!.atual - 1 } }));
    const f = props.ficha;
    if (a.tipo === 'recuperar' && a.rolagem && a.recurso) {
        const recurso = a.recurso; // pv | pp
        rolar(expandirRolagem(a.rolagem, calc.value, a.passo), `${c.nome}`, (total) => {
            const max = calc.value[`${recurso}.max`];
            const atual = recurso === 'pv' ? f.pv.atual : f.pp.atual;
            salvar({ [`${recurso}.atual`]: Math.min(max, atual + total) });
        });
    } else if (a.tipo === 'rolar' && a.rolagem) {
        const modo = a.vantagemAlvo ? modoDe(a.vantagemAlvo) : null;
        const expr =
            modo === 'vantagem' ? a.rolagem.replace(/^1d20/, '2d20kh1') : modo === 'desvantagem' ? a.rolagem.replace(/^1d20/, '2d20kl1') : a.rolagem;
        rolar(expr, c.nome);
    } else if (a.tipo === 'deslocar' || a.tipo === 'socorrer' || a.tipo === 'condicao' || a.tipo === 'hospedar') {
        executarAcao(a);
    }
}
/** Dado extra de dano (Poder Maligno): rola 1 dado à escolha; até o 12º nível o mesmo dano volta em você, sem defesa. */
const dadoEscolhido = ref('d6');
const DADOS_EXTRA = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
async function rolarDadoExtra(i: number, categoria?: string) {
    const c = props.ficha.caracteristicas[i];
    if (!c.usos || c.usos.atual <= 0 || naRodadaBloqueada(c)) return;
    if (!(await acoes.gastar(categoria))) return;
    const nivel = props.ficha.nivel;
    mudar((l) => (l[i] = marcarRodada({ ...c, usos: { ...c.usos!, atual: c.usos!.atual - 1 } })));
    rolar(
        `1${dadoEscolhido.value}`,
        `${c.nome} (dano adicional)`,
        (total) => {
            if (nivel < 12) salvar({ 'pv.atual': Math.max(0, props.ficha.pv.atual - total) }); // sem defesa nem redução
        },
        { tipo: 'geral' },
    );
}
/** Máximo de usos agora (fixo ou igual ao bônus de proficiência). */
const maxUsos = (c: Caracteristica) => usosMax(c, calc.value.prof, calc.value.nivel);
const gastaUso = (c: Caracteristica) => !c.ativa && !!c.usos && maxUsos(c) > 0;
const semUsos = (c: Caracteristica) => gastaUso(c) && c.usos!.atual <= 0;
/** Os efeitos de uma ativa desligada não contam: aparecem apagados. */
const apagada = (c: Caracteristica) => hakiDesligado(c, props.ficha);
const conta = (c: Caracteristica) => !apagada(c) && (c.tipo === 'passiva' || c.ativa === true);

// criar e editar (diálogo)
const dialogoAberto = ref(false);
const editando = ref<number | null>(null);
const caracteristicaEditada = computed(() => (editando.value === null ? null : (props.ficha.caracteristicas[editando.value] ?? null)));
function abrir(indice: number | null) {
    editando.value = indice;
    dialogoAberto.value = true;
}
function aoSalvar(c: Caracteristica) {
    mudar((l) => (editando.value === null ? l.push(c) : (l[editando.value] = c)));
}
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="flex items-center gap-3 rounded-lg border border-ouro-500/30 bg-preto-900/60 p-3" aria-label="Estilo de luta">
            <span
                class="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ouro-500/50 bg-preto-950 font-serif text-xl font-semibold text-ouro-200"
                >{{ ficha.nivel }}</span
            >
            <div class="min-w-0">
                <p class="font-serif text-lg font-semibold text-ouro-50">{{ ficha.estilo || 'Sem estilo de luta' }}</p>
                <p class="text-xs text-preto-400">
                    {{ ficha.profissao || 'Sem profissão' }}{{ ficha.fruta ? ' · ' + ficha.fruta : '' }} · dado de vida {{ ficha.dadosVida.tipo }}
                </p>
            </div>
        </section>

        <section v-for="g in grupos" :key="g.titulo" :class="estilos.cartao" :aria-label="g.titulo">
            <h3 :class="estilos.titulo">{{ g.titulo }}</h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="{ c, i } in g.itens" :key="i" class="px-3 py-2">
                    <div class="flex items-center gap-3">
                        <span class="min-w-0 flex-1"
                            ><span class="block truncate"
                                >{{ c.nome
                                }}<span
                                    v-if="c.acao"
                                    class="ml-1.5 rounded bg-preto-800 px-1 text-[9px] font-normal uppercase tracking-wide text-preto-300"
                                    title="Categoria de ação que esta característica gasta"
                                    >{{ acoes.rotulo(c.acao) }}</span
                                ></span
                            ><span class="block truncate text-xs text-preto-400"
                                >{{ c.origem }}<template v-if="apagada(c)"> · Haki desligado</template></span
                            ></span
                        >
                        <!-- interruptor do buff: só para ativas que têm efeitos -->
                        <button
                            v-if="c.tipo === 'ativa' && c.efeitos?.length"
                            type="button"
                            role="switch"
                            :aria-checked="c.ativa === true"
                            :aria-label="`${c.nome}: ${c.ativa ? 'ligada' : 'desligada'}`"
                            class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="
                                c.ativa
                                    ? 'border-green-400 bg-green-500/20 text-green-200 hover:bg-green-500/30'
                                    : semUsos(c)
                                      ? 'cursor-not-allowed border-preto-700 text-preto-500 opacity-60'
                                      : 'border-preto-600 text-preto-300 hover:border-ouro-500/50 hover:text-ouro-100'
                            "
                            :disabled="semUsos(c) || !podeLigar(c).ok || apagada(c)"
                            :title="
                                !podeLigar(c).ok
                                    ? podeLigar(c).motivo
                                    : c.ativa
                                      ? 'Ligada: os efeitos valem. Clique para desligar (o uso gasto não volta; só no descanso).'
                                      : semUsos(c)
                                        ? 'Sem usos restantes: descanse para recuperá-los.'
                                        : gastaUso(c)
                                          ? 'Desligada. Clique para ligar (gasta 1 uso) e os efeitos passarem a valer.'
                                          : 'Desligada. Clique para ligar e os efeitos passarem a valer.'
                            "
                            @click="alternar(i)"
                        >
                            {{ c.ativa ? 'Ligada' : 'Desligada' }}
                        </button>
                        <span
                            v-if="c.usos"
                            class="shrink-0 text-[10px] uppercase text-preto-500"
                            :title="`Os usos voltam no descanso ${c.descanso === 'curto' ? 'curto (e no longo)' : 'longo'}${c.usos.porProf ? ' · usos = bônus de proficiência' : ''}${c.usos.porNivel ? ' · usos = nível' : ''}`"
                            >↻ {{ c.descanso === 'curto' ? 'curto' : 'longo' }}</span
                        >
                        <span v-if="c.usos" class="flex shrink-0 gap-1" role="group" :aria-label="`${c.usos.atual} de ${maxUsos(c)} usos`"
                            ><button
                                v-for="n in maxUsos(c)"
                                :key="n"
                                type="button"
                                class="size-3.5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:cursor-default"
                                :class="n <= c.usos.atual ? 'border-ouro-400 bg-ouro-500' : 'border-preto-600'"
                                :aria-label="`Uso ${n}`"
                                :aria-pressed="n <= c.usos.atual"
                                :disabled="!mestre"
                                :title="mestre ? undefined : 'Os usos são gastos ao usar a característica e voltam no descanso'"
                                @click="usar(i, c.usos.atual, n)"
                        /></span>
                        <template v-if="editar">
                            <button
                                type="button"
                                class="shrink-0 text-preto-500 hover:text-ouro-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :aria-label="`Editar ${c.nome}`"
                                title="Editar nome, tipo, usos e efeitos"
                                @click="abrir(i)"
                            >
                                <Pencil class="size-3.5" />
                            </button>
                            <button
                                type="button"
                                class="shrink-0 text-xs text-preto-500 hover:text-red-300"
                                :aria-label="`Remover ${c.nome}`"
                                @click="mudar((l) => l.splice(i, 1))"
                            >
                                ✕
                            </button>
                        </template>
                    </div>
                    <!-- botões da característica: limite por rodada, forma alternativa, ações no alvo, dado extra -->
                    <div v-if="c.alternativo || c.acoes?.length" class="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <button
                            v-if="c.alternativo"
                            type="button"
                            class="rounded-md border border-sky-400/50 px-2 py-0.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:cursor-not-allowed disabled:opacity-40"
                            :disabled="c.alternativo.atual <= 0 || !!c.ativa || naRodadaBloqueada(c) || !c.usos || c.usos.atual <= 0"
                            title="Forma alternativa: junto da jogada de ataque, sem ação bônus. Gasta um uso e um do contador (máx. 5 por descanso longo)."
                            @click="usarAlternativo(i)"
                        >
                            Alternativa ({{ c.alternativo.atual }}/{{ c.alternativo.max }})
                        </button>
                        <template v-for="(a, ai) in c.acoes ?? []" :key="ai">
                            <span v-if="a.tipo === 'dadoExtra'" class="flex items-center gap-1">
                                <select
                                    v-model="dadoEscolhido"
                                    class="rounded border border-preto-700 bg-preto-950 px-1 py-0.5 text-xs"
                                    aria-label="Dado extra"
                                >
                                    <option v-for="d in DADOS_EXTRA" :key="d" :value="d">{{ d }}</option>
                                </select>
                                <button
                                    type="button"
                                    class="rounded-md border border-red-400/50 px-2 py-0.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-40"
                                    :disabled="apagada(c) || !c.usos || c.usos.atual <= 0 || naRodadaBloqueada(c) || !acoes.pode(a.acao).ok"
                                    :title="acoes.pode(a.acao).ok ? undefined : acoes.pode(a.acao).motivo"
                                    @click="rolarDadoExtra(i, a.acao)"
                                >
                                    {{ a.rotulo }}
                                </button>
                            </span>
                            <button
                                v-else
                                type="button"
                                class="rounded-md border border-ouro-500/50 px-2 py-0.5 text-xs font-semibold text-ouro-100 transition hover:bg-ouro-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :disabled="apagada(c) || !acoes.pode(a.acao).ok || (a.usa && (!c.usos || c.usos.atual <= 0))"
                                :title="
                                    acoes.pode(a.acao).ok
                                        ? a.alvo === 'mirado'
                                            ? 'Age sobre o alvo mirado (botão Mirar ou tecla T + clique)'
                                            : 'Age sobre você'
                                        : acoes.pode(a.acao).motivo
                                "
                                @click="agirComAcao(a, i)"
                            >
                                {{ a.rotulo }}
                            </button>
                        </template>
                    </div>
                    <p v-if="c.descricao" class="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-preto-300">{{ c.descricao }}</p>
                    <p v-if="c.efeitos?.length" class="mt-1.5 flex flex-wrap gap-1" :class="conta(c) ? '' : 'opacity-40'">
                        <span v-for="(e, n) in c.efeitos" :key="n" class="rounded bg-preto-800 px-1.5 py-0.5 text-[11px] text-ouro-200">{{
                            resumoEfeito(e, formatoDeResumo)
                        }}</span>
                    </p>
                </li>
                <li v-if="!g.itens.length" class="px-3 py-2 text-xs text-preto-500">Nenhuma característica.</li>
            </ul>
        </section>

        <div v-if="editar">
            <button
                type="button"
                class="flex items-center gap-1.5 rounded-md bg-ouro-500 px-3 py-1.5 text-xs font-semibold text-preto-950 hover:bg-ouro-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-300"
                @click="abrir(null)"
            >
                <Plus class="size-3.5" /> Nova característica
            </button>
        </div>

        <EditorCaracteristicaDialog v-model:open="dialogoAberto" :caracteristica="caracteristicaEditada" @salvar="aoSalvar" />
    </div>
</template>
