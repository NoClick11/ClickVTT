<script setup lang="ts">
import { Apple, Backpack, Flame, GraduationCap, Hammer, ListChecks, Settings, Skull, Sparkles, Waves } from 'lucide-vue-next';
import { computed, inject, provide, ref, type Component, type ComputedRef } from 'vue';
import type { AbrirEditorItem, PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import type { ItemDto } from '../../../tipos-mesa';
import { CHAVE_FICHA, type DanoDaTecnica, type EfeitoSecundario, type ServicosDaFicha, type UsoDeTecnica } from '../contexto';
import { abaDoHakiVisivel } from '../haki/regras';
import { analisar, armasAtivas, modoDaRolagem, type AcaoCaracteristica, type FichaOnePiece } from '../regras';
import AbaAkuma from './abas/AbaAkuma.vue';
import AbaCaracteristicas from './abas/AbaCaracteristicas.vue';
import AbaDetalhes from './abas/AbaDetalhes.vue';
import AbaHaki from './abas/AbaHaki.vue';
import AbaIndividualidades from './abas/AbaIndividualidades.vue';
import AbaInventario from './abas/AbaInventario.vue';
import AbaProfissoes from './abas/AbaProfissoes.vue';
import AbaRecompensa from './abas/AbaRecompensa.vue';
import AbaTecnicas from './abas/AbaTecnicas.vue';
import AbaTreinamentos from './abas/AbaTreinamentos.vue';
import FichaAtributos from './FichaAtributos.vue';
import FichaCabecalho from './FichaCabecalho.vue';
import FichaLateral from './FichaLateral.vue';

/**
 * Ficha de One Piece (mesmo layout da ficha de D&D 5e, com técnicas e pontos de poder no lugar das magias). Só mostra e emite: `salvar(campos)` e
 * `rolar(expressao, rotulo)`. Os valores derivados (CA, bônus, CD...) são calculados aqui (`calcular`) e
 * os ajustes manuais ficam em `ficha.ajustes`.
 */
const props = defineProps<{
    personagem: PersonagemFicha;
    ficha: FichaOnePiece;
    itens: ItemDto[];
    mestre: boolean;
    servicos?: ServicosDaFicha;
    construtorConcluido?: boolean;
}>();
const emit = defineEmits<{
    salvar: [campos: Record<string, unknown>];
    rolar: [
        expressao: string,
        rotulo: string,
        aoRolar?: (total: number) => void,
        dano?: { tipo: string | null; fator?: number; fonte?: string },
        acao?: { categoria: string; tecnica?: boolean },
        alvoPersonagemId?: number | null,
        tecnica?: { nome: string; dano?: DanoDaTecnica | null; secundaria?: EfeitoSecundario | null },
        municaoItemId?: number,
    ];
    /** Usar uma Técnica: a mesa escolhe os alvos (a área no mapa), cobra o custo e rola ou abre a Salvaguarda no chat. */
    usarTecnica: [uso: UsoDeTecnica];
    editorItem: Parameters<AbrirEditorItem>;
    /** O jogador quer abrir o assistente de criação. */
    construtor: [];
    /** Botão de uma característica (condição no alvo mirado, hospedar-se): a mesa executa. */
    acao: [acao: AcaoCaracteristica];
}>();

const editar = ref(false);
const itensPorId = computed(() => Object.fromEntries(props.itens.map((i) => [i.id, i])) as Record<number, ItemDto>);
const analise = computed(() => analisar(props.ficha, itensPorId.value));
const calc = computed(() => analise.value.valores);
const armas = computed(() => armasAtivas(props.ficha, itensPorId.value, calc.value));
const modoDe = (variavel: string) => modoDaRolagem(analise.value.efeitos, variavel);

// A rodada do combate vem da mesa (provida por quem hospeda a ficha); sem ela, nada é limitado por rodada.
const rodada = inject<ComputedRef<number | null>>(
    'rodadaDoCombate',
    computed(() => null),
);

// O alvo mirado para ataques (só com combate em curso): a mesa o usa para abrir a janela de reação.
const alvoDoAtaque = inject<ComputedRef<number | null>>(
    'alvoDoAtaque',
    computed(() => null),
);

// Economia de ações do combate (provida pela mesa); sem ela (ficha fora do jogo), nada é bloqueado.
const acoesDoCombate = inject<{
    categorias: ComputedRef<{ id: string; nome: string }[]>;
    pode: (personagemId: number, categoria: string | undefined, tecnica?: boolean) => { ok: boolean; motivo?: string };
    gastar: (personagemId: number, categoria: string | undefined, tecnica?: boolean) => Promise<boolean>;
    ataque: (personagemId: number, ataquesPorAcao: number) => { ok: boolean; motivo?: string; feitos: number; max: number; extras: number };
    darExtras: ((personagemId: number, n: number) => Promise<void>) | null;
    ativas: (personagemId: number) => { id: string; nome: string; rodadas: number; concentracao: boolean; tipo?: 'vigia' }[];
    encerrarAtiva: ((id: string) => Promise<void>) | null;
    moverVigia?: ((personagemId: number, id: string) => void) | null;
}>('acoesDoCombate', {
    categorias: computed(() => []),
    pode: () => ({ ok: true }),
    gastar: async () => true,
    ataque: (_id, ataquesPorAcao) => ({ ok: true, feitos: 0, max: ataquesPorAcao, extras: 0 }),
    darExtras: null,
    ativas: () => [],
    encerrarAtiva: null,
    moverVigia: null,
});

provide(CHAVE_FICHA, {
    editar,
    rodada,
    acao: (a) => emit('acao', a),
    calc,
    origens: computed(() => analise.value.origens),
    efeitos: computed(() => analise.value.efeitos),
    modoDe,
    armas,
    itens: itensPorId,
    mestre: props.mestre,
    servicos: props.servicos ?? null,
    personagemId: props.personagem.id,
    abrirEditorItem: (itemId, aoSalvar) => emit('editorItem', itemId, aoSalvar),
    salvar: (campos) => emit('salvar', campos),
    rolar: (expressao, rotulo, aoRolar, dano, acao) => emit('rolar', expressao, rotulo, aoRolar, dano, acao),
    usarTecnica: (uso) => emit('usarTecnica', uso),
    acoes: {
        pode: (categoria, tecnica) => acoesDoCombate.pode(props.personagem.id, categoria, tecnica),
        gastar: (categoria, tecnica) => acoesDoCombate.gastar(props.personagem.id, categoria, tecnica),
        rotulo: (categoria) => acoesDoCombate.categorias.value.find((c) => c.id === categoria)?.nome ?? '',
        ataque: (ataquesPorAcao) => acoesDoCombate.ataque(props.personagem.id, ataquesPorAcao),
        darExtras: acoesDoCombate.darExtras ? (n) => acoesDoCombate.darExtras!(props.personagem.id, n) : null,
        ativas: () => acoesDoCombate.ativas(props.personagem.id),
        encerrarAtiva: acoesDoCombate.encerrarAtiva,
        moverVigia: acoesDoCombate.moverVigia ? (id) => acoesDoCombate.moverVigia!(props.personagem.id, id) : null,
        todas: () => acoesDoCombate.categorias.value,
    },
    // Shift = vantagem, Ctrl/Alt = desvantagem (manual vence); sem tecla, valem os efeitos dos itens.
    d20: (evento, variavel, rotulo, acao, municaoItemId) => {
        const manual = evento.shiftKey ? 'vantagem' : evento.ctrlKey || evento.altKey ? 'desvantagem' : null;
        const modo = manual ?? modoDe(variavel);
        const dados = modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20';
        // Ataque (arma ou técnica) contra o alvo mirado: a mesa abre a janela de reação e resolve o acerto
        const ehAtaque = variavel === 'ataque' || /^arma\.\d+\.ataque$/.test(variavel);
        emit(
            'rolar',
            `${dados}+@${variavel}`,
            modo ? `${rotulo} (${modo})` : rotulo,
            undefined,
            undefined,
            acao,
            ehAtaque ? alvoDoAtaque.value : null,
            undefined,
            municaoItemId,
        );
    },
});

type AbaId =
    | 'detalhes'
    | 'inventario'
    | 'caracteristicas'
    | 'tecnicas'
    | 'akuma'
    | 'haki'
    | 'treinamentos'
    | 'profissoes'
    | 'individualidades'
    | 'recompensa';
const todasAsAbas: { id: AbaId; rotulo: string; icone: Component }[] = [
    { id: 'detalhes', rotulo: 'Detalhes', icone: Settings },
    { id: 'inventario', rotulo: 'Inventário', icone: Backpack },
    { id: 'caracteristicas', rotulo: 'Características', icone: ListChecks },
    { id: 'tecnicas', rotulo: 'Técnicas', icone: Flame },
    { id: 'akuma', rotulo: 'Akuma no Mi', icone: Apple },
    { id: 'haki', rotulo: 'Haki', icone: Waves },
    { id: 'profissoes', rotulo: 'Profissões', icone: Hammer },
    { id: 'treinamentos', rotulo: 'Treinamentos', icone: GraduationCap },
    { id: 'individualidades', rotulo: 'Singularidades', icone: Sparkles },
    { id: 'recompensa', rotulo: 'Recompensa', icone: Skull },
];
/** A aba Haki só aparece ao jogador depois do despertar (8º nível ou liberada pelo mestre); o mestre a vê sempre. */
const abas = computed(() =>
    todasAsAbas.filter((a) => a.id !== 'haki' || abaDoHakiVisivel(props.ficha.haki, Number(props.ficha.nivel), props.mestre)),
);
const aba = ref<AbaId>('detalhes');
const conteudo: Record<AbaId, Component> = {
    detalhes: AbaDetalhes,
    inventario: AbaInventario,
    caracteristicas: AbaCaracteristicas,
    tecnicas: AbaTecnicas,
    akuma: AbaAkuma,
    haki: AbaHaki,
    profissoes: AbaProfissoes,
    treinamentos: AbaTreinamentos,
    individualidades: AbaIndividualidades,
    recompensa: AbaRecompensa,
};
</script>

<template>
    <div class="flex h-full min-h-0 flex-col text-preto-100">
        <FichaCabecalho
            :ficha="ficha"
            :personagem="personagem"
            :construtor-concluido="construtorConcluido"
            @update:editar="editar = $event"
            @construtor="emit('construtor')"
        />
        <div class="flex min-h-0 flex-1">
            <FichaLateral :ficha="ficha" :personagem="personagem" />
            <div class="flex min-w-0 flex-1 flex-col">
                <FichaAtributos :ficha="ficha" />
                <nav
                    class="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ouro-500/20 px-2 pt-1.5"
                    role="tablist"
                    aria-label="Seções da ficha"
                >
                    <button
                        v-for="a in abas"
                        :key="a.id"
                        type="button"
                        role="tab"
                        :aria-selected="aba === a.id"
                        :id="`ficha-aba-${a.id}`"
                        class="flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :class="
                            aba === a.id
                                ? 'border-ouro-500/40 bg-preto-900 font-semibold text-ouro-200'
                                : 'border-transparent text-preto-300 hover:text-ouro-200'
                        "
                        @click="aba = a.id"
                    >
                        <component :is="a.icone" class="size-4" /> {{ a.rotulo }}
                    </button>
                </nav>
                <div class="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden" role="tabpanel" :aria-labelledby="`ficha-aba-${aba}`">
                    <component :is="conteudo[aba]" :ficha="ficha" />
                </div>
            </div>
        </div>
    </div>
</template>
