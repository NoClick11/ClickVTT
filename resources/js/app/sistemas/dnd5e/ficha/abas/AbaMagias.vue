<script setup lang="ts">
import { computed, ref } from 'vue';
import { clonar } from '../../../../nucleo/ficha/caminho';
import AreaRolavel from '../../../../nucleo/ui/AreaRolavel.vue';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import IndicadorD20 from '../../../../nucleo/ui/IndicadorD20.vue';
import { estilos, useFicha } from '../../contexto';
import { ATRIBUTOS, comSinal, type AtributoId, type FichaDnd5e } from '../../regras';

const props = defineProps<{ ficha: FichaDnd5e }>();
const { editar, calc, salvar, d20, modoDe } = useFicha();

const atributo = computed(() => ATRIBUTOS.find((a) => a.id === props.ficha.magias.atributo));
const rotuloNivel = (n: number) => (n === 0 ? 'Truques' : `${n}º nível`);
const caixa = 'rounded-lg border border-preto-700 bg-preto-950 px-2 py-1.5 text-center';
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';

// espaços de magia: lista salva por inteiro
type Espacos = FichaDnd5e['magias']['espacos'];
function mudarEspacos(fn: (e: Espacos) => void) {
    const espacos = clonar(props.ficha.magias.espacos);
    fn(espacos);
    espacos.sort((a, b) => a.nivel - b.nivel);
    salvar({ 'magias.espacos': espacos });
}
/** Clicar na bolinha N deixa N espaços disponíveis; clicar de novo no último disponível gasta mais um. */
const gastar = (i: number, e: Espacos[number], n: number) =>
    mudarEspacos((l) => (l[i].usados = e.total - n === e.usados ? e.total - n + 1 : e.total - n));
const nivelNovoEspaco = ref(1);
const niveisLivres = computed(() => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !props.ficha.magias.espacos.some((e) => e.nivel === n)));
const espacoDe = (nivel: number) => props.ficha.magias.espacos.find((e) => e.nivel === nivel);

// lista de magias: salva por inteiro
type Lista = FichaDnd5e['magias']['lista'];
function mudarLista(fn: (l: Lista) => void) {
    const lista = clonar(props.ficha.magias.lista);
    fn(lista);
    salvar({ 'magias.lista': lista.filter((g) => g.magias.length).sort((a, b) => a.nivel - b.nivel) });
}
const nova = ref({ nome: '', nivel: 0, escola: '' });
function adicionar() {
    const nome = nova.value.nome.trim();
    if (!nome) return;
    const magia = { nome, escola: nova.value.escola.trim() || '—', preparada: nova.value.nivel === 0 };
    mudarLista((l) => {
        const grupo = l.find((g) => g.nivel === nova.value.nivel);
        if (grupo) grupo.magias.push(magia);
        else l.push({ nivel: nova.value.nivel, magias: [magia] });
    });
    nova.value.nome = '';
}
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Conjuração">
            <div :class="caixa">
                <p :class="estilos.rotulo">Atributo</p>
                <select
                    v-if="editar"
                    :value="ficha.magias.atributo"
                    aria-label="Atributo de conjuração"
                    class="bg-transparent font-serif text-lg font-semibold text-ouro-100"
                    @change="salvar({ 'magias.atributo': ($event.target as HTMLSelectElement).value as AtributoId })"
                >
                    <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id" class="bg-preto-950 text-sm">{{ a.sigla }}</option>
                </select>
                <p v-else class="font-serif text-lg font-semibold text-ouro-100">{{ atributo?.sigla }}</p>
            </div>
            <div :class="caixa">
                <p :class="estilos.rotulo">CD</p>
                <p class="font-serif text-lg font-semibold text-ouro-100" title="8 + proficiência + modificador + ajuste">{{ calc.cd }}</p>
                <CampoNumero
                    v-if="editar"
                    :model-value="ficha.ajustes?.cd ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste da CD"
                    title="Ajuste manual"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.cd': $event })"
                />
            </div>
            <!-- Jogar: a caixa inteira rola o ataque de magia. Editar: tem o campo de ajuste e não rola. -->
            <AreaRolavel
                rotulo="ataque de magia"
                :ativa="!editar"
                :modo="modoDe('ataque')"
                :class="caixa"
                @rolar="d20($event, 'ataque', 'Ataque de magia')"
            >
                <span :class="estilos.rotulo" class="block">Ataque</span>
                <span
                    class="flex items-center justify-center gap-1 font-serif text-lg font-semibold text-ouro-100"
                    title="proficiência + modificador + ajuste"
                >
                    {{ comSinal(calc.ataque) }}
                    <IndicadorD20
                        v-if="!editar"
                        :modo="modoDe('ataque')"
                        class="size-5 opacity-40 transition group-hover:scale-110 group-hover:opacity-100"
                    />
                </span>
                <CampoNumero
                    v-if="editar"
                    :model-value="ficha.ajustes?.ataque ?? 0"
                    :min="-20"
                    :max="20"
                    aria-label="Ajuste do ataque de magia"
                    title="Ajuste manual"
                    :class="estilos.ajuste"
                    @salvar="salvar({ 'ajustes.ataque': $event })"
                />
            </AreaRolavel>
            <div :class="caixa">
                <p :class="estilos.rotulo">Preparadas</p>
                <p
                    class="flex items-center justify-center gap-1 font-serif text-lg font-semibold tabular-nums text-ouro-100"
                    title="Magias preparadas (truques não contam) / limite"
                >
                    {{ calc['preparadas.atual'] }} /
                    <CampoNumero
                        :model-value="ficha.magias.preparadas.max"
                        :min="0"
                        :max="200"
                        :somente-leitura="!editar"
                        aria-label="Limite de magias preparadas"
                        class="w-9 rounded border border-transparent bg-transparent text-center read-only:cursor-default focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ 'magias.preparadas.max': $event })"
                    />
                </p>
            </div>
        </section>

        <section :class="estilos.cartao" aria-label="Espaços de magia">
            <h3 :class="estilos.titulo">Espaços de Magia</h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="(e, i) in ficha.magias.espacos" :key="e.nivel" class="flex items-center gap-3 px-3 py-1.5">
                    <span class="w-16 text-preto-300">{{ rotuloNivel(e.nivel) }}</span>
                    <span
                        class="flex flex-1 flex-wrap gap-1"
                        role="group"
                        :aria-label="`${e.total - e.usados} de ${e.total} espaços de ${rotuloNivel(e.nivel)} disponíveis`"
                        ><button
                            v-for="n in e.total"
                            :key="n"
                            type="button"
                            class="size-3.5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="n <= e.total - e.usados ? 'border-ouro-400 bg-ouro-500' : 'border-preto-600'"
                            :aria-label="`Espaço ${n}`"
                            :aria-pressed="n <= e.total - e.usados"
                            @click="gastar(i, e, n)"
                    /></span>
                    <template v-if="editar">
                        <CampoNumero
                            :model-value="e.total"
                            :min="0"
                            :max="99"
                            :aria-label="`Total de espaços de ${rotuloNivel(e.nivel)}`"
                            :class="estilos.ajuste"
                            @salvar="
                                mudarEspacos((l) => {
                                    l[i].total = $event;
                                    l[i].usados = Math.min(l[i].usados, $event);
                                })
                            "
                        />
                        <button
                            type="button"
                            class="text-xs text-preto-500 hover:text-red-300"
                            :aria-label="`Remover ${rotuloNivel(e.nivel)}`"
                            @click="mudarEspacos((l) => l.splice(i, 1))"
                        >
                            ✕
                        </button>
                    </template>
                </li>
                <li v-if="!ficha.magias.espacos.length" class="px-3 py-2 text-xs text-preto-500">Sem espaços de magia.</li>
            </ul>
            <form
                v-if="editar && niveisLivres.length"
                class="flex gap-1.5 border-t border-preto-800 p-1.5"
                @submit.prevent="mudarEspacos((l) => l.push({ nivel: nivelNovoEspaco, usados: 0, total: 1 }))"
            >
                <select v-model.number="nivelNovoEspaco" aria-label="Nível do novo espaço" :class="campo">
                    <option v-for="n in niveisLivres" :key="n" :value="n">{{ rotuloNivel(n) }}</option>
                </select>
                <button type="submit" class="rounded bg-ouro-500 px-2 text-xs font-semibold text-preto-950 hover:bg-ouro-400">
                    Adicionar espaço
                </button>
            </form>
        </section>

        <section v-for="(g, gi) in ficha.magias.lista" :key="g.nivel" :class="estilos.cartao" :aria-label="rotuloNivel(g.nivel)">
            <h3 :class="estilos.titulo" class="flex items-center justify-between">
                <span>{{ rotuloNivel(g.nivel) }}</span>
                <span v-if="espacoDe(g.nivel)" class="normal-case tracking-normal text-preto-300"
                    >{{ espacoDe(g.nivel)!.total - espacoDe(g.nivel)!.usados }}/{{ espacoDe(g.nivel)!.total }} espaços</span
                >
            </h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="(m, mi) in g.magias" :key="mi" class="flex items-center gap-3 px-3 py-1.5">
                    <button
                        type="button"
                        class="size-3.5 shrink-0 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :class="m.preparada ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600'"
                        :aria-label="`${m.nome}: ${m.preparada ? 'preparada' : 'não preparada'}`"
                        :aria-pressed="m.preparada"
                        @click="mudarLista((l) => (l[gi].magias[mi].preparada = !m.preparada))"
                    />
                    <span class="min-w-0 flex-1 truncate" :class="m.preparada ? '' : 'text-preto-400'">{{ m.nome }}</span>
                    <span class="shrink-0 rounded bg-preto-800 px-1.5 text-[10px] uppercase text-preto-300">{{ m.escola }}</span>
                    <button
                        v-if="editar"
                        type="button"
                        class="text-xs text-preto-500 hover:text-red-300"
                        :aria-label="`Remover ${m.nome}`"
                        @click="mudarLista((l) => l[gi].magias.splice(mi, 1))"
                    >
                        ✕
                    </button>
                </li>
            </ul>
        </section>
        <p v-if="!ficha.magias.lista.length" class="py-3 text-center text-xs text-preto-500">
            Nenhuma magia conhecida.{{ editar ? '' : ' No modo Editar você adiciona magias.' }}
        </p>

        <form v-if="editar" class="flex flex-wrap gap-1.5" @submit.prevent="adicionar">
            <input
                v-model="nova.nome"
                type="text"
                maxlength="120"
                placeholder="Nova magia"
                aria-label="Nome da magia"
                :class="campo"
                class="min-w-40 flex-1"
            />
            <select v-model.number="nova.nivel" aria-label="Nível da magia" :class="campo">
                <option v-for="n in 10" :key="n" :value="n - 1">{{ rotuloNivel(n - 1) }}</option>
            </select>
            <input v-model="nova.escola" type="text" maxlength="40" placeholder="Escola" aria-label="Escola" :class="campo" class="w-28" />
            <button type="submit" class="rounded bg-ouro-500 px-3 text-xs font-semibold text-preto-950 hover:bg-ouro-400">Adicionar magia</button>
        </form>
    </div>
</template>
