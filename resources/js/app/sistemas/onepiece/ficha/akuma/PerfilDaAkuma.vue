<script setup lang="ts">
import { computed, ref } from 'vue';
import {
    ASPECTOS,
    CATEGORIAS_DO_FRUTO,
    MP_ESPECIAIS,
    PROPRIEDADES,
    TIPOS_DE_DESPERTAR,
    manifestacoesDoFruto,
    mpEspecialPorId,
    type SubtipoZoan,
    type TipoDeDespertar,
} from '../../akuma/dados';
import {
    camposDaAkuma,
    despertarAtendido,
    manifestacoesCriaveis,
    mpEspecialLiberada,
    nivelDoPoint,
    normalizarAkuma,
    pointsExtrasDaMitica,
    problemasDaAkuma,
    type AkumaFicha,
    type PointDaFicha,
} from '../../akuma/regras';
import {
    CRIACAO_DE_POINTS,
    MODELOS_DE_POINT,
    TRACOS_ANCESTRAIS,
    TRACOS_COMUNS,
    TRACOS_ESPECIFICOS,
    TRACOS_REPETIVEIS,
    limitesDeTracos,
} from '../../akuma/zoan';
import { estilos, useFicha } from '../../contexto';
import type { OrigemDoCriador } from '../../criador/regras';
import { ATRIBUTOS, type FichaOnePiece } from '../../regras';
import CriadorDeTecnicas from '../criador/CriadorDeTecnicas.vue';

/**
 * Perfil da Akuma no Mi (cap. 6): categoria, propriedades, tipo de usuário e de despertar, Aspecto Inato, MPs Especiais e,
 * nas Zoan, Traços, Predador e Points. As características geradas entram na lista de características da ficha.
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { salvar, mestre, editar } = useFicha();

const a = computed<AkumaFicha>(() => normalizarAkuma(props.ficha));
const nivel = computed(() => Number(props.ficha.nivel) || 1);
const problemas = computed(() => problemasDaAkuma(props.ficha));
const zoan = computed(() => a.value.tipo === 'zoan');
const mpsDaFruta = computed(() => props.ficha.caracteristicas?.filter((c) => c.builder === 'fruta') ?? []);
const mpTotal = computed(() => manifestacoesDoFruto(a.value.tipo, a.value.zoan, a.value.usuario, a.value.despertada));
const mpLivres = computed(() => Math.max(0, manifestacoesCriaveis(a.value) - mpsDaFruta.value.length));
const atributos = computed(() => Object.fromEntries(ATRIBUTOS.map((id) => [id, props.ficha.atributos[id]])));
const despertar = computed(() => despertarAtendido(a.value, atributos.value));
const limTracos = computed(() => (a.value.zoan ? limitesDeTracos(a.value.zoan, a.value.predador, a.value.despertada) : null));

/** Definidos pelo fruto (Narrador): o jogador só preenche enquanto estão vazios. */
const podeDefinir = (valor: unknown): boolean => mestre.value || valor === '' || (Array.isArray(valor) && valor.length === 0);

function aplicar(patch: Partial<AkumaFicha>) {
    salvar(camposDaAkuma(props.ficha, patch));
}

const alternar = (lista: string[], id: string): string[] => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
function alternarTraco(grupo: 'comuns' | 'especificos' | 'ancestrais', id: string) {
    const atual = a.value.tracos[grupo];
    const max = TRACOS_REPETIVEIS[id] ?? 1;
    const n = atual.filter((x) => x === id).length;
    const nova = n === 0 ? [...atual, id] : n < max ? [...atual, id] : atual.filter((x) => x !== id);
    aplicar({ tracos: { ...a.value.tracos, [grupo]: nova } });
}
const vezes = (grupo: 'comuns' | 'especificos' | 'ancestrais', id: string): number => a.value.tracos[grupo].filter((x) => x === id).length;

// --- Points
const novoPonto = ref(1);
const novoModelo = ref('custom');
const pointsDisponiveis = computed(() => {
    const usados = new Set(a.value.points.filter((p) => p.genialidade === undefined).map((p) => p.ponto));
    const extras = a.value.zoan === 'mitica' ? pointsExtrasDaMitica(nivel.value, a.value.despertada) : 0;
    return CRIACAO_DE_POINTS.filter((p) => nivel.value >= p.nivel && (!usados.has(p.ponto) || extras > 0));
});
function adicionarPoint() {
    const ponto = novoPonto.value;
    aplicar({ points: [...a.value.points, { ponto, modelo: novoModelo.value }] });
}
function removerPoint(i: number) {
    aplicar({ points: a.value.points.filter((_, j) => j !== i) });
}
const modelosLivres = computed(() => MODELOS_DE_POINT.filter((m) => !a.value.points.some((p) => p.modelo === m.id)));
const nomeDoPoint = (p: PointDaFicha) =>
    p.modelo === 'custom' ? 'Point criado por você' : (MODELOS_DE_POINT.find((m) => m.id === p.modelo)?.nome ?? p.modelo);

// --- criador
const criador = ref<{ aberto: boolean; origem: OrigemDoCriador; tipo: 'combate' | 'auxiliar' | 'mp' }>({
    aberto: false,
    origem: { tipo: 'nivel' },
    tipo: 'combate',
});
function abrirCriador(origem: OrigemDoCriador, tipo: 'combate' | 'auxiliar' | 'mp') {
    criador.value = { aberto: true, origem, tipo };
}

const chip = (ativo: boolean, bloqueado = false) =>
    [
        'rounded-full border px-2 py-0.5 text-xs transition',
        ativo ? 'border-violet-300 bg-violet-500/20 text-violet-100' : 'border-preto-600 text-preto-300 hover:bg-preto-800',
        bloqueado ? 'cursor-not-allowed opacity-40' : '',
    ].join(' ');
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-violet-300 focus-visible:outline-none';
const botao = 'rounded border border-violet-400/60 px-2 py-1 text-xs font-semibold text-violet-100 hover:bg-violet-500/20';
const aspectoNome = computed(() => (a.value.tipo ? ASPECTOS[a.value.tipo][0]?.nome : ''));
</script>

<template>
    <section v-if="a.tipo" class="grid gap-3" aria-label="Perfil da Akuma no Mi">
        <div :class="estilos.cartao" class="grid gap-3 p-3">
            <h3 :class="estilos.titulo">Perfil do fruto</h3>
            <div class="grid gap-3 sm:grid-cols-3">
                <label v-if="zoan" class="grid gap-1">
                    <span :class="estilos.rotulo">Tipo de Zoan</span>
                    <select
                        :class="campo"
                        :value="a.zoan"
                        :disabled="!podeDefinir(a.zoan)"
                        @change="aplicar({ zoan: ($event.target as HTMLSelectElement).value as '' | SubtipoZoan })"
                    >
                        <option value="">Escolha</option>
                        <option value="comum">Zoan Comum</option>
                        <option value="ancestral">Zoan Ancestral</option>
                        <option value="mitica">Zoan Mítica</option>
                    </select>
                </label>
                <label class="grid gap-1">
                    <span :class="estilos.rotulo">Categoria do fruto</span>
                    <select
                        :class="campo"
                        :value="a.categoria"
                        :disabled="!podeDefinir(a.categoria)"
                        @change="aplicar({ categoria: ($event.target as HTMLSelectElement).value as AkumaFicha['categoria'] })"
                    >
                        <option value="">—</option>
                        <option v-for="c in CATEGORIAS_DO_FRUTO" :key="c.id" :value="c.id">{{ c.nome }}</option>
                    </select>
                </label>
                <label v-if="!zoan" class="grid gap-1">
                    <span :class="estilos.rotulo">Tipo de despertar do fruto</span>
                    <select
                        :class="campo"
                        :value="a.despertar"
                        :disabled="!podeDefinir(a.despertar)"
                        @change="aplicar({ despertar: ($event.target as HTMLSelectElement).value as '' | TipoDeDespertar })"
                    >
                        <option value="">Indefinido (o Narrador define)</option>
                        <option v-for="d in TIPOS_DE_DESPERTAR" :key="d.id" :value="d.id">{{ d.nome }}</option>
                    </select>
                </label>
                <label class="grid gap-1">
                    <span :class="estilos.rotulo">Aspecto Inato</span>
                    <select
                        :class="campo"
                        :value="a.aspecto"
                        @change="aplicar({ aspecto: ($event.target as HTMLSelectElement).value as AkumaFicha['aspecto'] })"
                    >
                        <option value="padrao">{{ aspectoNome }}</option>
                        <option v-if="zoan && a.zoan === 'mitica'" value="uso-alternativo">Uso Alternativo (Mítica)</option>
                        <option value="mp">Uma MP adicional criada por mim</option>
                    </select>
                </label>
            </div>
            <div class="grid gap-1">
                <span :class="estilos.rotulo">Propriedades</span>
                <div class="flex flex-wrap gap-1.5">
                    <button
                        v-for="p in PROPRIEDADES"
                        :key="p.id"
                        type="button"
                        :class="chip(a.propriedades.includes(p.id), !podeDefinir(a.propriedades) && !a.propriedades.includes(p.id))"
                        :disabled="!podeDefinir(a.propriedades) && a.propriedades.length > 0"
                        @click="aplicar({ propriedades: alternar(a.propriedades, p.id) })"
                    >
                        {{ p.nome }}
                    </button>
                </div>
            </div>
            <p v-if="despertar" class="text-xs" :class="despertar.ok ? 'text-green-300' : 'text-preto-400'">
                Requisito de atributo para despertar (16º nível): {{ despertar.valor }} em
                {{ despertar.atributos.map((x) => x.toUpperCase()).join(' ou ') }} {{ despertar.ok ? '— atendido.' : '— ainda não atendido.' }} Além
                disso, o Narrador exige o "despertar da mente e do corpo". Só o mestre desperta a fruta.
            </p>
            <label v-if="zoan" class="flex items-center gap-2 text-xs text-preto-300">
                <input
                    type="checkbox"
                    class="accent-violet-400"
                    :checked="a.predador"
                    @change="aplicar({ predador: ($event.target as HTMLInputElement).checked })"
                />
                O animal é carnívoro/predador (recebe o traço Predador e até 3 Traços Específicos em vez de 5).
            </label>
            <ul v-if="problemas.length" class="list-disc pl-5 text-xs text-red-300">
                <li v-for="p in problemas" :key="p">{{ p }}</li>
            </ul>
        </div>

        <div v-if="mpsDaFruta.length || a.mpEspeciais.length || editar" :class="estilos.cartao" class="grid gap-3 p-3">
            <h3 :class="estilos.titulo">Manifestações de Poder</h3>

            <!-- Manifestações de Poder da Fruta concedidas à ficha -->
            <div v-if="mpsDaFruta.length" class="grid gap-2" :class="{ 'border-b border-preto-800 pb-3': editar || a.mpEspeciais.length }">
                <span :class="estilos.rotulo">Manifestações de Poder da {{ ficha.fruta || a.fruta || 'Fruta' }} ({{ mpsDaFruta.length }})</span>
                <ul class="grid gap-1.5" aria-label="Manifestações da fruta">
                    <li
                        v-for="c in mpsDaFruta"
                        :key="c.nome"
                        class="rounded border border-violet-500/30 bg-violet-950/20 p-2 text-xs"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-semibold text-violet-200">{{ c.nome }}</span>
                            <span v-if="c.tipo === 'ativa'" class="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                                Ativa (Ação {{ c.acao || 'bônus' }})
                            </span>
                            <span v-else class="text-[10px] text-preto-400">Passiva</span>
                        </div>
                        <p class="mt-1 text-[11px] leading-relaxed text-preto-300">{{ c.descricao }}</p>
                        <div v-if="c.etiquetas?.length" class="mt-1.5 flex flex-wrap gap-1">
                            <span
                                v-for="e in c.etiquetas"
                                :key="e"
                                class="rounded border border-preto-700 bg-preto-900 px-1.5 py-0.5 text-[10px] text-ouro-300"
                            >
                                {{ e }}
                            </span>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- MPs Especiais ativas fora do modo de edição -->
            <div v-if="!editar && a.mpEspeciais.length" class="grid gap-1.5">
                <span :class="estilos.rotulo">Especiais ativas</span>
                <div class="flex flex-wrap gap-1.5">
                    <span
                        v-for="id in a.mpEspeciais"
                        :key="id"
                        class="rounded-full border border-violet-300 bg-violet-500/20 px-2.5 py-0.5 text-xs text-violet-100"
                    >
                        {{ mpEspecialPorId(id)?.traco.nome ?? id }}
                    </span>
                </div>
            </div>

            <!-- Criação e seleção de MPs (exibido apenas no modo de edição) -->
            <template v-if="editar">
                <p class="text-xs text-preto-400">
                    {{ mpTotal }} MP(s) pelo tipo de usuário{{ a.aspecto === 'mp' ? ' + 1 do Aspecto Inato alternativo' : '' }};
                    <template v-if="mpsDaFruta.length">{{ mpsDaFruta.length }} da fruta; </template>
                    {{ a.mpEspeciais.length }} Especial(is); {{ mpLivres }} para criar<template v-if="mpLivres > 0"> (use "Criar técnica" → Manifestação de Poder)</template>.
                </p>
                <div class="flex flex-wrap gap-1.5">
                    <button
                        v-for="m in MP_ESPECIAIS"
                        :key="m.id"
                        type="button"
                        :class="
                            chip(
                                a.mpEspeciais.includes(m.id),
                                !a.mpEspeciais.includes(m.id) && (!mpEspecialLiberada(m.id, a) || a.mpEspeciais.length >= mpTotal),
                            )
                        "
                        :disabled="!a.mpEspeciais.includes(m.id) && (!mpEspecialLiberada(m.id, a) || a.mpEspeciais.length >= mpTotal)"
                        :title="m.traco.descricao"
                        @click="aplicar({ mpEspeciais: alternar(a.mpEspeciais, m.id) })"
                    >
                        {{ m.traco.nome }}
                    </button>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" :class="botao" :disabled="mpLivres < 1" @click="abrirCriador({ tipo: 'nivel' }, 'mp')">
                        Criar Manifestação de Poder
                    </button>
                    <button v-if="a.tipo === 'logia'" type="button" :class="botao" @click="abrirCriador({ tipo: 'aspecto' }, 'auxiliar')">
                        Criar a Auxiliar do Corpo Elemental (Power Up)
                    </button>
                </div>
            </template>
        </div>

        <template v-if="zoan && a.zoan">
            <div :class="estilos.cartao" class="grid gap-3 p-3">
                <h3 :class="estilos.titulo">Traços da Zoan</h3>
                <p v-if="limTracos" class="text-xs text-preto-400">
                    Até {{ limTracos.comuns }} Traços Comuns; {{ limTracos.especificos }} Específicos{{
                        limTracos.ancestrais ? ` e ${limTracos.ancestrais} Ancestral` : ''
                    }}{{ limTracos.troca ? ` (dá para trocar até ${limTracos.troca} Específicos por Ancestrais)` : ''
                    }}{{ limTracos.extra ? `; +${limTracos.extra} Específico ou Ancestral extra (desperta)` : '' }}. Marcados:
                    {{ a.tracos.comuns.length }} / {{ a.tracos.especificos.length }} / {{ a.tracos.ancestrais.length }}.
                </p>
                <div class="grid gap-1">
                    <span :class="estilos.rotulo">Traços Comuns</span>
                    <div class="flex flex-wrap gap-1.5">
                        <button
                            v-for="t in TRACOS_COMUNS"
                            :key="t.id"
                            type="button"
                            :class="chip(vezes('comuns', t.id) > 0)"
                            :title="t.descricao"
                            @click="alternarTraco('comuns', t.id)"
                        >
                            {{ t.nome }}{{ vezes('comuns', t.id) > 1 ? ` ×${vezes('comuns', t.id)}` : '' }}
                        </button>
                    </div>
                </div>
                <div v-for="g in TRACOS_ESPECIFICOS" :key="g.id" class="grid gap-1">
                    <span :class="estilos.rotulo">Específicos — {{ g.nome }}</span>
                    <div class="flex flex-wrap gap-1.5">
                        <button
                            v-for="t in g.tracos"
                            :key="t.id"
                            type="button"
                            :class="chip(vezes('especificos', t.id) > 0)"
                            :title="t.descricao"
                            @click="alternarTraco('especificos', t.id)"
                        >
                            {{ t.nome }}{{ vezes('especificos', t.id) > 1 ? ` ×${vezes('especificos', t.id)}` : '' }}
                        </button>
                    </div>
                </div>
                <div v-if="a.zoan !== 'comum'" class="grid gap-1">
                    <span :class="estilos.rotulo">Traços Ancestrais</span>
                    <div class="flex flex-wrap gap-1.5">
                        <button
                            v-for="t in TRACOS_ANCESTRAIS"
                            :key="t.id"
                            type="button"
                            :class="chip(vezes('ancestrais', t.id) > 0)"
                            :title="t.descricao"
                            @click="alternarTraco('ancestrais', t.id)"
                        >
                            {{ t.nome }}
                        </button>
                    </div>
                </div>
            </div>

            <div :class="estilos.cartao" class="grid gap-3 p-3">
                <h3 :class="estilos.titulo">Points</h3>
                <p class="text-xs text-preto-400">
                    Você escolhe ou cria um Point no 1º, 3º, 6º, 9º e 12º nível. A Técnica de um Modelo Especial só pode ser usada quando você tem o
                    nível do grau dela.
                    <template v-if="a.zoan === 'mitica'"
                        >Na Zoan Mítica, cada Point substitui a Técnica de mesmo grau; desperta, ganha "Point qualquer" no 16º e 20º nível.</template
                    >
                </p>
                <ul v-if="a.points.length" class="grid gap-1.5">
                    <li
                        v-for="(p, i) in a.points"
                        :key="i"
                        class="flex flex-wrap items-center gap-2 rounded border border-preto-700 bg-preto-950/60 p-2 text-sm"
                    >
                        <span class="font-semibold text-violet-100">{{ p.ponto }}º Point</span>
                        <span class="text-xs text-preto-300">{{ nomeDoPoint(p) }}</span>
                        <span v-if="p.genialidade" class="text-xs text-ouro-200">(Genialidade Inusitada nº {{ p.genialidade }})</span>
                        <span class="text-xs text-preto-500">nível {{ nivelDoPoint(p.ponto) }}</span>
                        <template v-if="p.modelo === 'custom'">
                            <button
                                type="button"
                                :class="botao"
                                @click="
                                    abrirCriador(
                                        { tipo: 'point', ponto: p.ponto, ...(p.genialidade ? { genialidade: p.genialidade } : {}) },
                                        'combate',
                                    )
                                "
                            >
                                Técnica
                            </button>
                            <button
                                type="button"
                                :class="botao"
                                :disabled="CRIACAO_DE_POINTS[p.ponto - 1]?.tracos === 0"
                                @click="
                                    abrirCriador({ tipo: 'point', ponto: p.ponto, ...(p.genialidade ? { genialidade: p.genialidade } : {}) }, 'mp')
                                "
                            >
                                Traço Realçado
                            </button>
                        </template>
                        <button type="button" class="ml-auto text-xs text-red-300 hover:underline" @click="removerPoint(i)">Remover</button>
                    </li>
                </ul>
                <form class="flex flex-wrap items-center gap-2" @submit.prevent="adicionarPoint">
                    <select v-model.number="novoPonto" :class="campo" aria-label="Posição do Point">
                        <option v-for="p in pointsDisponiveis" :key="p.ponto" :value="p.ponto">{{ p.ponto }}º Point (nível {{ p.nivel }})</option>
                    </select>
                    <select v-model="novoModelo" :class="campo" aria-label="Modelo do Point">
                        <option value="custom">Criar o meu próprio Point</option>
                        <option v-for="m in modelosLivres" :key="m.id" :value="m.id">{{ m.nome }} — {{ m.nota }}</option>
                    </select>
                    <button type="submit" :class="botao" :disabled="!pointsDisponiveis.length">Adicionar Point</button>
                </form>
            </div>
        </template>

        <CriadorDeTecnicas
            v-model:open="criador.aberto"
            :ficha="ficha"
            destino="akuma"
            :origem-inicial="criador.origem"
            :tipo-inicial="criador.tipo"
        />
    </section>
</template>
