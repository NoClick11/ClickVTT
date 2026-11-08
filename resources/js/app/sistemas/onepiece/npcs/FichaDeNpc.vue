<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Minus, Pencil, Plus, RotateCcw, Save, Swords, Trash2, X, Zap } from 'lucide-vue-next';
import { computed, inject, ref, type ComputedRef } from 'vue';
import type { UsoDeTecnica } from '../contexto';
import {
    alcanceDoAtaque,
    camposDoNpc,
    comSinalNpc,
    copiar,
    dadoDeAtaque,
    lerNpc,
    limiteDeUsos,
    margemDeCritico,
    usoDaTecnica,
    usosDa,
    type NpcDados,
} from './ficha';
import { ATRIBUTOS_NPC, modificador, ROTULO_ATRIBUTO_NPC, type AtaqueNpc, type TecnicaNpc, type TextoNpc } from './tipos';

/**
 * A ficha de um NPC numa tela só: CR, PV, PP, atributos, ataques, técnicas e características. Ataques e técnicas saem pelo mesmo
 * fluxo dos jogadores (alvo mirado, alcance e área no mapa, salvaguarda, dano). Só o mestre vê e edita.
 */
const props = defineProps<{
    personagem: { id: number; nome: string; cor: string };
    ficha: Record<string, unknown>;
    mestre: boolean;
}>();
const emit = defineEmits<{
    salvar: [campos: Record<string, unknown>];
    rolar: [
        expressao: string,
        rotulo: string,
        aoRolar: undefined,
        dano: undefined,
        acao: { categoria: string } | undefined,
        alvoPersonagemId: number | null | undefined,
        tecnica:
            | { nome: string; dano: { expressao: string; tipo: string | null }; semTecnica?: boolean; margem?: number; ataque?: boolean }
            | undefined,
    ];
    usarTecnica: [uso: UsoDeTecnica];
}>();

const alvoDoAtaque = inject<ComputedRef<number | null>>(
    'alvoDoAtaque',
    computed(() => null),
);

const npc = computed<NpcDados>(() => lerNpc(props.ficha)!);
const pv = computed(() => (props.ficha.pv ?? { atual: 0, max: 0, temp: 0 }) as { atual: number; max: number; temp: number });
const pp = computed(() => (props.ficha.pp as { atual?: number } | undefined)?.atual ?? 0);
const modo = (e: MouseEvent | KeyboardEvent) => (e.shiftKey ? 'vantagem' : e.ctrlKey || e.altKey ? 'desvantagem' : null);

// --- PV e PP -------------------------------------------------------------------------------------------------------------
const ajuste = ref<number | null>(null);
const pctPv = computed(() => (pv.value.max ? Math.max(0, Math.min(100, (pv.value.atual / pv.value.max) * 100)) : 0));
const corPv = computed(() => (pctPv.value > 50 ? 'bg-emerald-500' : pctPv.value > 20 ? 'bg-amber-500' : 'bg-red-500'));
const definirPv = (n: number) => emit('salvar', { 'pv.atual': Math.max(0, Math.min(pv.value.max, Math.round(n))) });
function aplicarAjuste(sinal: 1 | -1) {
    if (!ajuste.value) return;
    definirPv(pv.value.atual + sinal * Math.abs(ajuste.value));
    ajuste.value = null;
}
const definirPp = (n: number) => emit('salvar', { 'pp.atual': Math.max(0, Math.min(9999, Math.round(n))) });

// --- ataques e técnicas ------------------------------------------------------------------------------------------------------
function atacar(e: MouseEvent, a: AtaqueNpc) {
    const m = modo(e);
    emit('rolar', dadoDeAtaque(a.bonus, m), m ? `${a.nome} (${m})` : a.nome, undefined, undefined, { categoria: 'padrao' }, alvoDoAtaque.value, {
        nome: a.nome,
        dano: { expressao: a.dano, tipo: a.tipoDano },
        semTecnica: true,
        ataque: true, // bônus próprio da ficha do NPC (sem `@ataque`): o servidor o trata como ataque e rola contra a defesa do alvo
        margem: margemDeCritico(npc.value, a),
    });
}
function testar(e: MouseEvent, rotulo: string, bonus: number) {
    const m = modo(e);
    emit('rolar', dadoDeAtaque(bonus, m), m ? `${rotulo} (${m})` : rotulo, undefined, undefined, undefined, undefined, undefined);
}
const tipoEscolhido = ref<Record<string, string>>({});
const tipoDe = (t: TecnicaNpc) => tipoEscolhido.value[t.nome] ?? t.tipoDano[0] ?? '';
const esgotada = (t: TecnicaNpc) => {
    const lim = limiteDeUsos(t.usos);

    return lim !== null && usosDa(npc.value, t.nome) >= lim;
};
function usar(t: TecnicaNpc) {
    if (pp.value < t.pp || esgotada(t)) return;
    // o uso (N/dia) é gravado junto com os PP gastos: a mesa salva os dois no mesmo lote
    const gasta = limiteDeUsos(t.usos) !== null;
    const extras = gasta ? { npc: { ...npc.value, usos: { ...(npc.value.usos ?? {}), [t.nome]: usosDa(npc.value, t.nome) + 1 } } } : {};
    emit('usarTecnica', usoDaTecnica(npc.value, t, pp.value, tipoDe(t), extras));
}
function gravarUso(nome: string, delta: number) {
    const usos = { ...(npc.value.usos ?? {}) };
    usos[nome] = Math.max(0, (usos[nome] ?? 0) + delta);
    if (!usos[nome]) delete usos[nome];
    emit('salvar', { npc: { ...npc.value, usos } });
}
function usarTexto(t: TextoNpc) {
    if (t.pp && pp.value < t.pp) return;
    const usos = { ...(npc.value.usos ?? {}) };
    if (t.usos && 'max' in t.usos) usos[t.nome] = (usos[t.nome] ?? 0) + 1;
    emit('salvar', { npc: { ...npc.value, usos }, ...(t.pp ? { 'pp.atual': pp.value - t.pp } : {}) });
}
const usosDoTexto = (t: TextoNpc) => (t.usos && 'max' in t.usos ? { gastos: usosDa(npc.value, t.nome), max: t.usos.max } : null);
function zerarUsos() {
    emit('salvar', { npc: { ...npc.value, usos: {}, lendarias_usadas: 0 } });
}
const lendariasRestantes = computed(() => (npc.value.lendarias ? npc.value.lendarias.n - (npc.value.lendarias_usadas ?? 0) : 0));
const gastarLendaria = (d: number) =>
    emit('salvar', {
        npc: { ...npc.value, lendarias_usadas: Math.max(0, Math.min(npc.value.lendarias?.n ?? 0, (npc.value.lendarias_usadas ?? 0) + d)) },
    });

const descricaoDaTecnica = (t: TecnicaNpc) => {
    const partes: string[] = [];
    if (t.modo === 'ataque') partes.push(`${t.ataque!.tipo === 'corpo' ? 'Corpo a corpo' : 'À distância'} ${comSinalNpc(t.ataque!.bonus)}`);
    partes.push(
        t.area
            ? `${t.area.forma === 'cone' ? 'Cone' : 'Linha'} ${String(t.alcance).replace('.', ',')} m`
            : `alcance ${String(t.alcance).replace('.', ',')} m`,
    );
    if (t.dano) partes.push(`${t.dano} ${t.tipoDano.join('/')}`);
    if (t.salvaguarda) partes.push(`Salv. ${ROTULO_ATRIBUTO_NPC[t.salvaguarda.atributo]} CD ${t.salvaguarda.cd}`);

    return partes.join(' · ');
};

// --- edição ---------------------------------------------------------------------------------------------------------------
const editando = ref(false);
const rascunho = ref<NpcDados | null>(null);
function editar() {
    rascunho.value = copiar(npc.value);
    editando.value = true;
}
function salvarEdicao() {
    const r = rascunho.value;
    if (!r) return;
    const max = Math.max(0, Math.round(r.pv.medio));
    emit('salvar', camposDoNpc(r, { atual: Math.min(pv.value.atual, max) }));
    editando.value = false;
    rascunho.value = null;
}
function cancelar() {
    editando.value = false;
    rascunho.value = null;
}
const novoAtaque = (): AtaqueNpc => ({ nome: 'Ataque', tipo: 'corpo', arma: true, bonus: 0, alcance: 1.5, dano: '1d6', tipoDano: 'Cortante' });
const novaTecnica = (): TecnicaNpc => ({
    nome: 'Técnica',
    grau: 1,
    pp: 1,
    modo: 'ataque',
    ataque: { tipo: 'corpo', bonus: 0 },
    alcance: 1.5,
    dano: '2d10',
    tipoDano: ['Contundente'],
});
const novoTexto = (): TextoNpc => ({ nome: 'Nome', texto: '' });
const tiposTexto = (t: TecnicaNpc) => t.tipoDano.join(', ');
const lerTipos = (t: TecnicaNpc, v: string) =>
    (t.tipoDano = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean));
const num = (e: Event) => Number((e.target as HTMLInputElement).value);
const campo =
    'w-full rounded border border-preto-700 bg-preto-950 px-1.5 py-1 text-xs text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none';
const rotuloSecao = 'mb-1 text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
</script>

<template>
    <div class="h-full overflow-y-auto bg-preto-950 p-3 text-sm text-preto-100">
        <!-- Cabeçalho -->
        <header class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div class="min-w-0 flex-1">
                <h2 class="truncate font-serif text-lg font-semibold" :style="{ color: personagem.cor }">{{ personagem.nome }}</h2>
                <p class="text-xs text-preto-400">
                    ND {{ npc.nd }} · {{ npc.xp.toLocaleString('pt-BR') }} XP<template v-if="npc.faccao"> · {{ npc.faccao }}</template
                    ><template v-if="npc.instancia_de"> · cópia no mapa</template>
                </p>
            </div>
            <div v-if="mestre" class="flex gap-1">
                <template v-if="!editando">
                    <Button
                        size="sm"
                        variant="ghost"
                        class="h-7 gap-1 px-2 text-xs"
                        title="Zera usos por dia e ações lendárias (descanso)"
                        @click="zerarUsos"
                    >
                        <RotateCcw class="size-3.5" /> Descanso
                    </Button>
                    <Button size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" @click="editar"><Pencil class="size-3.5" /> Editar</Button>
                </template>
                <template v-else>
                    <Button size="sm" class="h-7 gap-1 bg-ouro-500 px-2 text-xs text-preto-950 hover:bg-ouro-400" @click="salvarEdicao"
                        ><Save class="size-3.5" /> Salvar</Button
                    >
                    <Button size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" @click="cancelar"><X class="size-3.5" /> Cancelar</Button>
                </template>
            </div>
        </header>

        <!-- Números -->
        <section class="mb-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            <template v-if="!editando">
                <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-center">
                    <div class="text-[10px] uppercase text-preto-400">CR</div>
                    <div class="text-base font-semibold">{{ npc.cr }}</div>
                </div>
                <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-center">
                    <div class="text-[10px] uppercase text-preto-400">CD</div>
                    <div class="text-base font-semibold">{{ npc.cd }}</div>
                </div>
                <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-center">
                    <div class="text-[10px] uppercase text-preto-400">Prof.</div>
                    <div class="text-base font-semibold">{{ comSinalNpc(npc.bp) }}</div>
                </div>
                <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-center">
                    <div class="text-[10px] uppercase text-preto-400">Desloc.</div>
                    <div class="text-base font-semibold">{{ String(npc.deslocamento).replace('.', ',') }} m</div>
                </div>
                <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-center">
                    <div class="text-[10px] uppercase text-preto-400">Nado</div>
                    <div class="text-base font-semibold">{{ String(npc.nado).replace('.', ',') }} m</div>
                </div>
                <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-center">
                    <div class="text-[10px] uppercase text-preto-400">PV (dados)</div>
                    <div class="text-xs font-semibold">{{ npc.pv.dados || '—' }}</div>
                </div>
            </template>
            <template v-else-if="rascunho">
                <label class="text-[10px] uppercase text-preto-400">ND<input v-model="rascunho.nd" :class="campo" /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >XP<input :value="rascunho.xp" type="number" :class="campo" @input="rascunho.xp = num($event)"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >CR<input :value="rascunho.cr" type="number" :class="campo" @input="rascunho.cr = num($event)"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >CD<input :value="rascunho.cd" type="number" :class="campo" @input="rascunho.cd = num($event)"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >Prof.<input :value="rascunho.bp" type="number" :class="campo" @input="rascunho.bp = num($event)"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >PP máx.<input :value="rascunho.pp ?? 0" type="number" :class="campo" @input="rascunho.pp = num($event) || null"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >PV (média)<input :value="rascunho.pv.medio" type="number" :class="campo" @input="rascunho.pv.medio = num($event)"
                /></label>
                <label class="text-[10px] uppercase text-preto-400">PV (dados)<input v-model="rascunho.pv.dados" :class="campo" /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >Desloc. (m)<input
                        :value="rascunho.deslocamento"
                        type="number"
                        step="0.5"
                        :class="campo"
                        @input="rascunho.deslocamento = num($event)"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >Nado (m)<input :value="rascunho.nado" type="number" step="0.5" :class="campo" @input="rascunho.nado = num($event)"
                /></label>
            </template>
        </section>

        <!-- PV e PP -->
        <section class="mb-2 grid gap-2 sm:grid-cols-2">
            <div class="rounded border border-preto-800 bg-preto-900/60 p-2">
                <div class="mb-1 flex items-baseline justify-between">
                    <span class="text-[10px] uppercase text-preto-400">Pontos de Vida</span>
                    <span class="font-semibold tabular-nums"
                        >{{ pv.atual }} <span class="text-preto-400">/ {{ pv.max }}</span
                        ><span v-if="pv.temp" class="ml-1 text-xs text-sky-300">(+{{ pv.temp }} temp.)</span></span
                    >
                </div>
                <div class="mb-1.5 h-2 overflow-hidden rounded bg-preto-800">
                    <div class="h-full transition-all" :class="corPv" :style="{ width: pctPv + '%' }" />
                </div>
                <div class="flex items-center gap-1">
                    <input
                        v-model.number="ajuste"
                        type="number"
                        min="0"
                        placeholder="valor"
                        aria-label="Valor de dano ou cura"
                        :class="campo"
                        @keydown.enter="aplicarAjuste(-1)"
                    />
                    <Button size="sm" variant="ghost" class="h-7 px-2 text-xs text-red-300" title="Tirar do PV" @click="aplicarAjuste(-1)"
                        ><Minus class="size-3.5" /> Dano</Button
                    >
                    <Button size="sm" variant="ghost" class="h-7 px-2 text-xs text-emerald-300" title="Somar ao PV" @click="aplicarAjuste(1)"
                        ><Plus class="size-3.5" /> Cura</Button
                    >
                </div>
            </div>
            <div class="rounded border border-preto-800 bg-preto-900/60 p-2">
                <div class="mb-1 flex items-baseline justify-between">
                    <span class="text-[10px] uppercase text-preto-400">Pontos de Poder</span>
                    <span class="font-semibold tabular-nums"
                        >{{ pp }} <span class="text-preto-400">/ {{ npc.pp ?? 0 }}</span></span
                    >
                </div>
                <div class="flex items-center gap-1">
                    <Button size="icon" variant="ghost" class="size-7" aria-label="Menos 1 PP" @click="definirPp(pp - 1)"
                        ><Minus class="size-3.5"
                    /></Button>
                    <Button size="icon" variant="ghost" class="size-7" aria-label="Mais 1 PP" @click="definirPp(pp + 1)"
                        ><Plus class="size-3.5"
                    /></Button>
                    <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="definirPp(npc.pp ?? 0)">Encher</Button>
                    <span v-if="!npc.pp" class="text-[11px] text-preto-500">sem PP</span>
                </div>
            </div>
        </section>

        <!-- Atributos -->
        <section class="mb-2 grid grid-cols-6 gap-1">
            <div v-for="a in ATRIBUTOS_NPC" :key="a" class="rounded border border-preto-800 bg-preto-900/60 py-1 text-center">
                <div class="text-[10px] font-semibold text-preto-400">{{ ROTULO_ATRIBUTO_NPC[a] }}</div>
                <template v-if="!editando">
                    <button
                        type="button"
                        class="w-full text-base font-semibold hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ouro-400"
                        :title="`Teste de ${ROTULO_ATRIBUTO_NPC[a]} (Shift = vantagem, Ctrl = desvantagem)`"
                        @click="testar($event, `Teste de ${ROTULO_ATRIBUTO_NPC[a]}`, modificador(npc.atributos[a]))"
                    >
                        {{ npc.atributos[a] }}
                    </button>
                    <div class="text-xs text-preto-300">{{ comSinalNpc(modificador(npc.atributos[a])) }}</div>
                </template>
                <input
                    v-else-if="rascunho"
                    :value="rascunho.atributos[a]"
                    type="number"
                    min="1"
                    max="30"
                    :aria-label="ROTULO_ATRIBUTO_NPC[a]"
                    class="mx-auto w-12 rounded border border-preto-700 bg-preto-950 px-1 text-center text-xs"
                    @input="rascunho.atributos[a] = num($event)"
                />
            </div>
        </section>

        <!-- Perícias, salvaguardas e sentidos -->
        <section class="mb-2 grid gap-0.5 text-xs">
            <template v-if="!editando">
                <p v-if="npc.salvaguardas"><span class="font-semibold text-preto-300">Salvaguardas</span> {{ npc.salvaguardas }}</p>
                <p v-if="npc.pericias"><span class="font-semibold text-preto-300">Perícias</span> {{ npc.pericias }}</p>
                <p v-if="npc.sentidos"><span class="font-semibold text-preto-300">Sentidos</span> {{ npc.sentidos }}</p>
            </template>
            <template v-else-if="rascunho">
                <label class="text-[10px] uppercase text-preto-400"
                    >Salvaguardas (ex.: Força +5, Destreza +4)<input v-model="rascunho.salvaguardas" :class="campo"
                /></label>
                <label class="text-[10px] uppercase text-preto-400"
                    >Perícias (ex.: Atletismo +5)<input v-model="rascunho.pericias" :class="campo"
                /></label>
                <label class="text-[10px] uppercase text-preto-400">Sentidos<input v-model="rascunho.sentidos" :class="campo" /></label>
            </template>
        </section>

        <!-- Ataques -->
        <section class="mb-2">
            <h3 :class="rotuloSecao">
                Ataques<span v-if="npc.multiplos" class="ml-2 font-normal normal-case tracking-normal text-preto-400"
                    >{{ npc.multiplos.n }} por turno: {{ npc.multiplos.com }}</span
                >
            </h3>
            <ul v-if="!editando" class="grid gap-1">
                <li v-for="a in npc.ataques" :key="a.nome" class="flex items-center gap-2 rounded border border-preto-800 bg-preto-900/60 px-2 py-1">
                    <Button
                        size="sm"
                        class="h-7 shrink-0 gap-1 bg-ouro-500 px-2 text-xs text-preto-950 hover:bg-ouro-400"
                        :title="`Atacar (Shift = vantagem, Ctrl = desvantagem)${alvoDoAtaque ? '' : ' — mire um alvo com o combate em curso'}`"
                        @click="atacar($event, a)"
                    >
                        <Swords class="size-3.5" /> {{ comSinalNpc(a.bonus) }}
                    </Button>
                    <span class="min-w-0 flex-1"
                        ><span class="font-medium">{{ a.nome }}</span>
                        <span class="block text-[11px] text-preto-400"
                            >{{ a.tipo === 'corpo' ? 'Corpo a corpo' : 'À distância' }}{{ a.arma ? ' com arma' : '' }} · {{ alcanceDoAtaque(a) }} ·
                            {{ a.dano }} {{ a.tipoDano }}</span
                        ></span
                    >
                </li>
                <li v-if="!npc.ataques.length" class="text-xs text-preto-500">Sem ataques.</li>
            </ul>
            <div v-else-if="rascunho" class="grid gap-1">
                <div v-for="(a, i) in rascunho.ataques" :key="i" class="grid grid-cols-12 items-end gap-1 rounded border border-preto-800 p-1">
                    <input v-model="a.nome" :class="[campo, 'col-span-4']" aria-label="Nome do ataque" />
                    <select v-model="a.tipo" :class="[campo, 'col-span-3']" aria-label="Tipo">
                        <option value="corpo">Corpo</option>
                        <option value="distancia">Distância</option>
                    </select>
                    <input
                        :value="a.bonus"
                        type="number"
                        :class="[campo, 'col-span-2']"
                        aria-label="Bônus para atingir"
                        @input="a.bonus = num($event)"
                    />
                    <label class="col-span-3 flex items-center gap-1 text-[10px]"><input v-model="a.arma" type="checkbox" /> arma</label>
                    <input
                        v-if="a.tipo === 'corpo'"
                        :value="a.alcance"
                        type="number"
                        step="0.5"
                        :class="[campo, 'col-span-3']"
                        aria-label="Alcance (m)"
                        @input="a.alcance = num($event)"
                    />
                    <template v-else>
                        <input
                            :value="Array.isArray(a.alcance) ? a.alcance[0] : a.alcance"
                            type="number"
                            :class="[campo, 'col-span-2']"
                            aria-label="Alcance normal"
                            @input="a.alcance = [num($event), Array.isArray(a.alcance) ? a.alcance[1] : 0]"
                        />
                        <input
                            :value="Array.isArray(a.alcance) ? a.alcance[1] : 0"
                            type="number"
                            :class="[campo, 'col-span-2']"
                            aria-label="Alcance máximo"
                            @input="a.alcance = [Array.isArray(a.alcance) ? a.alcance[0] : 0, num($event)]"
                        />
                    </template>
                    <input v-model="a.dano" :class="[campo, 'col-span-3']" placeholder="1d6+2" aria-label="Dano" />
                    <input v-model="a.tipoDano" :class="[campo, 'col-span-3']" aria-label="Tipo de dano" />
                    <Button
                        size="icon"
                        variant="ghost"
                        class="col-span-1 size-7 text-red-300"
                        aria-label="Remover ataque"
                        @click="rascunho.ataques.splice(i, 1)"
                        ><Trash2 class="size-3.5"
                    /></Button>
                </div>
                <Button size="sm" variant="ghost" class="h-7 w-fit gap-1 px-2 text-xs" @click="rascunho.ataques.push(novoAtaque())"
                    ><Plus class="size-3.5" /> Ataque</Button
                >
            </div>
        </section>

        <!-- Técnicas -->
        <section class="mb-2">
            <h3 :class="rotuloSecao">Técnicas</h3>
            <ul v-if="!editando" class="grid gap-1">
                <li v-for="t in npc.tecnicas" :key="t.nome" class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1">
                    <div class="flex items-center gap-2">
                        <Button
                            size="sm"
                            class="h-7 shrink-0 gap-1 bg-ouro-500 px-2 text-xs text-preto-950 hover:bg-ouro-400 disabled:opacity-40"
                            :disabled="pp < t.pp || esgotada(t)"
                            :title="pp < t.pp ? 'PP insuficientes' : esgotada(t) ? 'Sem usos restantes' : 'Usar a técnica'"
                            @click="usar(t)"
                        >
                            <Zap class="size-3.5" /> {{ t.pp }} PP
                        </Button>
                        <span class="min-w-0 flex-1"
                            ><span class="font-medium">{{ t.nome }}</span> <span class="text-[11px] text-preto-400">{{ t.grau }}º grau</span>
                            <span class="block text-[11px] text-preto-400">{{ descricaoDaTecnica(t) }}</span></span
                        >
                        <select
                            v-if="t.tipoDano.length > 1"
                            :value="tipoDe(t)"
                            class="rounded border border-preto-700 bg-preto-950 px-1 py-0.5 text-[11px]"
                            aria-label="Tipo de dano"
                            @change="tipoEscolhido[t.nome] = ($event.target as HTMLSelectElement).value"
                        >
                            <option v-for="d in t.tipoDano" :key="d" :value="d">{{ d }}</option>
                        </select>
                        <span v-if="t.usos && 'max' in t.usos" class="flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums">
                            <button
                                type="button"
                                class="px-1 text-preto-400 hover:text-ouro-200"
                                aria-label="Devolver um uso"
                                @click="gravarUso(t.nome, -1)"
                            >
                                −</button
                            >{{ limiteDeUsos(t.usos)! - usosDa(npc, t.nome) }}/{{ t.usos.max }} dia
                        </span>
                        <span v-else-if="t.usos" class="shrink-0 text-[11px] text-preto-400">recarga {{ t.usos.recarga }}</span>
                    </div>
                    <p v-if="t.efeito" class="mt-0.5 text-[11px] text-preto-300">{{ t.efeito }}</p>
                </li>
                <li v-if="!npc.tecnicas.length" class="text-xs text-preto-500">Sem técnicas.</li>
            </ul>
            <div v-else-if="rascunho" class="grid gap-1">
                <div v-for="(t, i) in rascunho.tecnicas" :key="i" class="grid grid-cols-12 items-end gap-1 rounded border border-preto-800 p-1">
                    <input v-model="t.nome" :class="[campo, 'col-span-5']" aria-label="Nome da técnica" />
                    <input
                        :value="t.grau"
                        type="number"
                        min="1"
                        max="10"
                        :class="[campo, 'col-span-2']"
                        aria-label="Grau"
                        @input="t.grau = num($event)"
                    />
                    <input :value="t.pp" type="number" min="0" :class="[campo, 'col-span-2']" aria-label="Custo em PP" @input="t.pp = num($event)" />
                    <select
                        v-model="t.modo"
                        :class="[campo, 'col-span-3']"
                        aria-label="Modo"
                        @change="
                            t.modo === 'ataque'
                                ? (t.ataque ??= { tipo: 'corpo', bonus: 0 })
                                : (t.salvaguarda ??= { atributo: 'des', cd: npc.cd, metade: true })
                        "
                    >
                        <option value="ataque">Ataque</option>
                        <option value="area">Área</option>
                        <option value="alvo">Alvo (salv.)</option>
                    </select>
                    <template v-if="t.modo === 'ataque' && t.ataque">
                        <select v-model="t.ataque.tipo" :class="[campo, 'col-span-3']" aria-label="Corpo ou distância">
                            <option value="corpo">Corpo</option>
                            <option value="distancia">Distância</option>
                        </select>
                        <input
                            :value="t.ataque.bonus"
                            type="number"
                            :class="[campo, 'col-span-2']"
                            aria-label="Bônus para atingir"
                            @input="t.ataque!.bonus = num($event)"
                        />
                    </template>
                    <template v-else-if="t.salvaguarda">
                        <select v-model="t.salvaguarda.atributo" :class="[campo, 'col-span-3']" aria-label="Atributo da salvaguarda">
                            <option v-for="a in ATRIBUTOS_NPC" :key="a" :value="a">{{ ROTULO_ATRIBUTO_NPC[a] }}</option>
                        </select>
                        <input
                            :value="t.salvaguarda.cd"
                            type="number"
                            :class="[campo, 'col-span-2']"
                            aria-label="CD"
                            @input="t.salvaguarda!.cd = num($event)"
                        />
                    </template>
                    <input
                        :value="t.alcance"
                        type="number"
                        step="0.5"
                        :class="[campo, 'col-span-2']"
                        aria-label="Alcance (m)"
                        @input="t.alcance = num($event)"
                    />
                    <select
                        :value="t.area?.forma ?? ''"
                        :class="[campo, 'col-span-3']"
                        aria-label="Forma"
                        @change="
                            ($event.target as HTMLSelectElement).value
                                ? (t.area = { forma: ($event.target as HTMLSelectElement).value as 'cone' | 'linha' })
                                : (t.area = undefined)
                        "
                    >
                        <option value="">sem forma</option>
                        <option value="cone">Cone</option>
                        <option value="linha">Linha</option>
                    </select>
                    <input
                        :value="t.dano ?? ''"
                        :class="[campo, 'col-span-3']"
                        placeholder="2d10"
                        aria-label="Dano"
                        @input="t.dano = ($event.target as HTMLInputElement).value || undefined"
                    />
                    <input
                        :value="tiposTexto(t)"
                        :class="[campo, 'col-span-4']"
                        placeholder="Cortante, Perfurante"
                        aria-label="Tipos de dano"
                        @input="lerTipos(t, ($event.target as HTMLInputElement).value)"
                    />
                    <input
                        :value="t.usos && 'max' in t.usos ? t.usos.max : 0"
                        type="number"
                        min="0"
                        :class="[campo, 'col-span-2']"
                        title="Usos por dia (0 = ilimitado)"
                        aria-label="Usos por dia"
                        @input="t.usos = num($event) ? { max: num($event), periodo: 'dia' } : undefined"
                    />
                    <input
                        :value="t.efeito ?? ''"
                        :class="[campo, 'col-span-11']"
                        placeholder="Efeito (texto)"
                        aria-label="Efeito"
                        @input="t.efeito = ($event.target as HTMLInputElement).value || undefined"
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        class="col-span-1 size-7 text-red-300"
                        aria-label="Remover técnica"
                        @click="rascunho.tecnicas.splice(i, 1)"
                        ><Trash2 class="size-3.5"
                    /></Button>
                </div>
                <Button size="sm" variant="ghost" class="h-7 w-fit gap-1 px-2 text-xs" @click="rascunho.tecnicas.push(novaTecnica())"
                    ><Plus class="size-3.5" /> Técnica</Button
                >
            </div>
        </section>

        <!-- Aspectos, ações bônus e reações -->
        <template
            v-for="[titulo, chave] in [
                ['Aspectos', 'aspectos'],
                ['Ações bônus', 'acoesBonus'],
                ['Reações', 'reacoes'],
            ] as const"
            :key="chave"
        >
            <section v-if="npc[chave].length || editando" class="mb-2">
                <h3 :class="rotuloSecao">{{ titulo }}</h3>
                <ul v-if="!editando" class="grid gap-1">
                    <li v-for="t in npc[chave]" :key="t.nome" class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-xs">
                        <div class="flex items-start gap-2">
                            <span class="min-w-0 flex-1"
                                ><span class="font-semibold">{{ t.nome }}</span
                                ><span v-if="t.pp" class="ml-1 text-ouro-300">({{ t.pp }} PP)</span
                                ><span v-if="t.usos && 'recarga' in t.usos" class="ml-1 text-preto-400">(recarga {{ t.usos.recarga }})</span>
                                <span class="block text-preto-300">{{ t.texto }}</span></span
                            >
                            <span v-if="usosDoTexto(t)" class="shrink-0 text-[11px] tabular-nums text-preto-400"
                                >{{ usosDoTexto(t)!.max - usosDoTexto(t)!.gastos }}/{{ usosDoTexto(t)!.max }}</span
                            >
                            <Button
                                v-if="t.pp || usosDoTexto(t)"
                                size="sm"
                                variant="ghost"
                                class="h-6 shrink-0 px-2 text-[11px]"
                                :disabled="(!!t.pp && pp < t.pp) || (!!usosDoTexto(t) && usosDoTexto(t)!.gastos >= usosDoTexto(t)!.max)"
                                @click="usarTexto(t)"
                                >Usar</Button
                            >
                        </div>
                    </li>
                </ul>
                <div v-else-if="rascunho" class="grid gap-1">
                    <div v-for="(t, i) in rascunho[chave]" :key="i" class="grid grid-cols-12 gap-1 rounded border border-preto-800 p-1">
                        <input v-model="t.nome" :class="[campo, 'col-span-7']" aria-label="Nome" />
                        <input
                            :value="t.pp ?? 0"
                            type="number"
                            min="0"
                            :class="[campo, 'col-span-2']"
                            title="Custo em PP"
                            aria-label="Custo em PP"
                            @input="t.pp = num($event) || undefined"
                        />
                        <input
                            :value="t.usos && 'max' in t.usos ? t.usos.max : 0"
                            type="number"
                            min="0"
                            :class="[campo, 'col-span-2']"
                            title="Usos por dia (0 = ilimitado)"
                            aria-label="Usos por dia"
                            @input="t.usos = num($event) ? { max: num($event), periodo: 'dia' } : undefined"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            class="col-span-1 size-7 text-red-300"
                            aria-label="Remover"
                            @click="rascunho[chave].splice(i, 1)"
                            ><Trash2 class="size-3.5"
                        /></Button>
                        <textarea v-model="t.texto" rows="2" :class="[campo, 'col-span-12']" aria-label="Texto" />
                    </div>
                    <Button size="sm" variant="ghost" class="h-7 w-fit gap-1 px-2 text-xs" @click="rascunho[chave].push(novoTexto())"
                        ><Plus class="size-3.5" /> Adicionar</Button
                    >
                </div>
            </section>
        </template>

        <!-- Ações lendárias -->
        <section v-if="npc.lendarias && !editando" class="mb-2">
            <h3 :class="rotuloSecao">Ações lendárias</h3>
            <div class="rounded border border-preto-800 bg-preto-900/60 px-2 py-1 text-xs">
                <div class="mb-1 flex items-center gap-2">
                    <span class="text-preto-300">Restantes</span>
                    <span class="font-semibold tabular-nums">{{ lendariasRestantes }}/{{ npc.lendarias.n }}</span>
                    <Button size="icon" variant="ghost" class="size-6" aria-label="Gastar uma ação lendária" @click="gastarLendaria(1)"
                        ><Minus class="size-3"
                    /></Button>
                    <Button size="icon" variant="ghost" class="size-6" aria-label="Devolver uma ação lendária" @click="gastarLendaria(-1)"
                        ><Plus class="size-3"
                    /></Button>
                </div>
                <p class="mb-1 text-preto-400">{{ npc.lendarias.texto }}</p>
                <p v-for="o in npc.lendarias.opcoes" :key="o.nome">
                    <span class="font-semibold">{{ o.nome }}.</span> {{ o.texto }}
                </p>
            </div>
        </section>
    </div>
</template>
