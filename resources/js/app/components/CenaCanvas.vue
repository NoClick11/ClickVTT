<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Cena } from '../engine/Cena';
import type { Camada, CamposGeometria, EstiloPintura, Ferramenta, ObjetoDto, PaginaDto, TipoParede } from '../engine/tipos';

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
}>();

const emit = defineEmits<{
    selecionar: [id: number | null];
    alterar: [id: number, campos: CamposGeometria, final: boolean];
    zoom: [escala: number];
    criarLuz: [x: number, y: number];
    criarTraco: [traco: { x: number; y: number; largura: number; altura: number; pontos: number[] }];
    criarTexto: [x: number, y: number, tela: { x: number; y: number }];
    criarParede: [pontos: [number, number, number, number], tipo: TipoParede];
    alternarPorta: [id: number];
    menuObjeto: [id: number, tela: { x: number; y: number }];
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
            alterar: (id, campos, final) => emit('alterar', id, campos, final),
            zoom: (e) => emit('zoom', e),
            criarLuz: (x, y) => emit('criarLuz', x, y),
            criarTraco: (t) => emit('criarTraco', t),
            criarTexto: (x, y, tela) => emit('criarTexto', x, y, tela),
            criarParede: (pontos, tipo) => emit('criarParede', pontos, tipo),
            alternarPorta: (id) => emit('alternarPorta', id),
            menuObjeto: (id, tela) => emit('menuObjeto', id, tela),
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
    focar: (id: number, selecionar = false) => cena?.focar(id, selecionar),
});
</script>

<template>
    <div ref="host" class="absolute inset-0 overflow-hidden bg-preto-950" />
</template>
