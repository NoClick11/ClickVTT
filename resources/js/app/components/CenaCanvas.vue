<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Cena } from '../engine/Cena';
import type { Camada, CamposGeometria, EstiloPintura, Ferramenta, ObjetoDto, PaginaDto, TipoParede } from '../engine/tipos';
import type { AreaDeEfeito } from '../nucleo/combate/area';

const props = defineProps<{
    pagina: PaginaDto;
    objetos: ObjetoDto[];
    camada: Camada;
    ferramenta: Ferramenta;
    mestre: boolean;
    jogadorId: number | null;
    personagensPermitidos: number[];
    estilo: EstiloPintura;
    margemDireita: number;
    /** Token mirado por este jogador (id do objeto), desenhado com a mira. */
    alvoId?: number | null;
    /** Deslocamento do turno do token que se move (metros), com a régua do arrasto; null = sem limite medido. */
    movimento?: { objetoId: number; usado: number; total: number; limitar: boolean } | null;
    /** Gabarito de área da Técnica em uso: a forma, o tamanho e o token (id do objeto) de onde parte; null = sem gabarito. */
    gabarito?: { area: AreaDeEfeito; origem: number; excluir?: number[] } | null;
    /** Marcar o centro de uma esfera (Vigília): de onde parte (pixels), alcance máximo e raio (metros); null = desligado. */
    ponto?: { de: { x: number; y: number }; maximo: number; raio: number } | null;
    /** Esferas persistentes no mapa (Vigília), visíveis para todos. */
    zonas?: { id: string; x: number; y: number; raio: number; cor: string }[];
}>();

const emit = defineEmits<{
    selecionar: [id: number | null];
    selecao: [ids: number[]];
    alterar: [id: number, campos: CamposGeometria, final: boolean];
    zoom: [escala: number];
    criarLuz: [x: number, y: number];
    criarTraco: [traco: { x: number; y: number; largura: number; altura: number; pontos: number[] }];
    criarTexto: [x: number, y: number, tela: { x: number; y: number }];
    criarParede: [pontos: [number, number, number, number], tipo: TipoParede];
    alternarPorta: [id: number];
    menuObjeto: [id: number, tela: { x: number; y: number }];
    mirar: [id: number | null];
    gabarito: [personagemIds: number[] | null];
    ponto: [ponto: { x: number; y: number } | null];
}>();

const host = ref<HTMLDivElement | null>(null);
let cena: Cena | null = null;
let destruido = false;

onMounted(async () => {
    const nova = new Cena({
        mestre: props.mestre,
        jogadorId: props.jogadorId,
        personagensPermitidos: props.personagensPermitidos,
        eventos: {
            selecionar: (id) => emit('selecionar', id),
            selecao: (ids) => emit('selecao', ids),
            alterar: (id, campos, final) => emit('alterar', id, campos, final),
            zoom: (e) => emit('zoom', e),
            criarLuz: (x, y) => emit('criarLuz', x, y),
            criarTraco: (t) => emit('criarTraco', t),
            criarTexto: (x, y, tela) => emit('criarTexto', x, y, tela),
            criarParede: (pontos, tipo) => emit('criarParede', pontos, tipo),
            alternarPorta: (id) => emit('alternarPorta', id),
            menuObjeto: (id, tela) => emit('menuObjeto', id, tela),
            mirar: (id) => emit('mirar', id),
            gabarito: (ids) => emit('gabarito', ids),
            ponto: (p) => emit('ponto', p),
        },
    });
    await nova.iniciar(host.value!);
    if (destruido) {
        nova.destruir();
        return;
    }
    cena = nova;
    nova.setPagina(props.pagina);
    nova.setCamadaAtiva(props.camada);
    nova.setFerramenta(props.ferramenta);
    nova.setMargemDireita(props.margemDireita);
    nova.setEstilo(props.estilo);
    nova.setObjetos(props.objetos);
    nova.setAlvo(props.alvoId ?? null);
    nova.setMovimento(props.movimento ?? null);
    nova.setGabarito(props.gabarito ?? null);
    nova.setPonto(props.ponto ?? null);
    nova.setZonas(props.zonas ?? []);
});

onBeforeUnmount(() => {
    destruido = true;
    cena?.destruir();
    cena = null;
});

watch(
    () => props.pagina,
    (p) => cena?.setPagina(p),
    { deep: true },
);
watch(
    () => props.objetos,
    (o) => cena?.setObjetos(o),
    { deep: true },
);
watch(
    () => props.movimento,
    (m) => cena?.setMovimento(m ?? null),
    { deep: true },
);
watch(
    () => props.gabarito,
    (g) => cena?.setGabarito(g ?? null),
);
watch(
    () => props.ponto,
    (p) => cena?.setPonto(p ?? null),
);
watch(
    () => props.zonas,
    (z) => cena?.setZonas(z ?? []),
    { deep: true },
);
watch(
    () => props.alvoId,
    (id) => cena?.setAlvo(id ?? null),
);
watch(
    () => props.camada,
    (c) => cena?.setCamadaAtiva(c),
);
watch(
    () => props.ferramenta,
    (f) => cena?.setFerramenta(f),
);
watch(
    () => props.personagensPermitidos,
    (ids) => cena?.setPersonagensPermitidos(ids),
    { deep: true },
);
watch(
    () => props.margemDireita,
    (m) => cena?.setMargemDireita(m),
);
watch(
    () => props.estilo,
    (e) => cena?.setEstilo(e),
    { deep: true },
);

defineExpose({
    ajustar: () => cena?.ajustarVista(),
    zoomPor: (f: number) => cena?.zoomPor(f),
    centro: () => cena?.centroDaVista() ?? { x: 0, y: 0 },
    /** Ponto do mundo sob uma posição da tela (clientX/clientY). */
    pontoDoMundo: (cx: number, cy: number) => {
        const r = host.value?.getBoundingClientRect();

        return cena?.pontoDoMundo(cx - (r?.left ?? 0), cy - (r?.top ?? 0)) ?? { x: 0, y: 0 };
    },
    selecionar: (id: number | null) => cena?.selecionar(id),
    selecionarTodos: () => cena?.selecionarTodos(),
    focar: (id: number, selecionar = false) => cena?.focar(id, selecionar),
});
</script>

<template>
    <div ref="host" class="absolute inset-0 overflow-hidden bg-preto-950" />
</template>
