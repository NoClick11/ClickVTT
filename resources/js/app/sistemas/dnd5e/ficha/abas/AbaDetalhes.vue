<script setup lang="ts">
import { ref } from 'vue';
import { clonar } from '../../../../nucleo/ficha/caminho';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import CampoTexto from '../../../../nucleo/ui/CampoTexto.vue';
import LinhaRolavel from '../../../../nucleo/ui/LinhaRolavel.vue';
import { estilos, useFicha } from '../../contexto';
import { ATRIBUTOS, comSinal, PERICIAS, type AtributoId, type FichaDnd5e, type Proficiencia } from '../../regras';

const props = defineProps<{ ficha: FichaDnd5e }>();
const { editar, calc, salvar, d20, modoDe } = useFicha();

const sigla = (a: AtributoId) => ATRIBUTOS.find((x) => x.id === a)!.sigla;
const prof = (id: string) => (props.ficha.pericias[id] ?? 0) as Proficiencia;
const proximo = (p: Proficiencia) => ((p + 1) % 3) as Proficiencia;
const rotuloProf = (p: Proficiencia) => (p === 2 ? 'Especialista' : p === 1 ? 'Proficiente' : 'Sem proficiência');
const bolinha = (p: Proficiencia) => (p === 2 ? 'border-ouro-300 bg-ouro-400' : p === 1 ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600');

const ciclarPericia = (id: string) => editar.value && salvar({ [`pericias.${id}`]: proximo(prof(id)) });
function alternarSalvaguarda(id: AtributoId) {
    if (!editar.value) return;
    const atual = props.ficha.salvaguardas;
    salvar({ salvaguardas: atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id] });
}

// ferramentas: lista salva por inteiro
const novaFerramenta = ref({ nome: '', atributo: 'int' as AtributoId });
function ciclarFerramenta(i: number) {
    if (!editar.value) return;
    const lista = clonar(props.ficha.ferramentas);
    lista[i].prof = proximo(lista[i].prof);
    salvar({ ferramentas: lista });
}
function removerFerramenta(i: number) {
    salvar({ ferramentas: props.ficha.ferramentas.filter((_, j) => j !== i) });
}
function adicionarFerramenta() {
    const nome = novaFerramenta.value.nome.trim();
    if (!nome) return;
    salvar({ ferramentas: [...clonar(props.ficha.ferramentas), { nome, prof: 1, atributo: novaFerramenta.value.atributo }] });
    novaFerramenta.value.nome = '';
}

// sentidos, defesas, proficiências e idiomas: listas de texto (no modo Editar, separadas por vírgula)
const listas: {
    campo: 'sentidos' | 'resistencias' | 'imunidades' | 'vulnerabilidades' | 'proficienciasArmaduras' | 'proficienciasArmas' | 'idiomas';
    rotulo: string;
}[] = [
    { campo: 'sentidos', rotulo: 'Sentidos' },
    { campo: 'resistencias', rotulo: 'Resistências' },
    { campo: 'imunidades', rotulo: 'Imunidades' },
    { campo: 'vulnerabilidades', rotulo: 'Vulnerabilidades' },
    { campo: 'proficienciasArmaduras', rotulo: 'Armaduras' },
    { campo: 'proficienciasArmas', rotulo: 'Armas' },
    { campo: 'idiomas', rotulo: 'Idiomas' },
];
const salvarLista = (campo: string, texto: string) =>
    salvar({
        [campo]: texto
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 50),
    });

const titulo = estilos.titulo;
const cartao = estilos.cartao;
</script>

<template>
    <div class="grid gap-3 p-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        <!-- coluna: perícias e ferramentas -->
        <div class="grid content-start gap-3">
            <section :class="cartao" aria-label="Perícias">
                <h3 :class="titulo">
                    Perícias
                    <span v-if="editar" class="font-normal normal-case tracking-normal text-preto-500"
                        >· clique na bolinha para mudar a proficiência</span
                    >
                </h3>
                <ul class="p-1.5 text-sm">
                    <li v-for="p in PERICIAS" :key="p.id">
                        <LinhaRolavel
                            :rotulo="p.nome"
                            :ativa="!editar"
                            :modo="modoDe(`pericia.${p.id}`)"
                            @rolar="d20($event, `pericia.${p.id}`, p.nome)"
                        >
                            <component
                                :is="editar ? 'button' : 'span'"
                                :type="editar ? 'button' : undefined"
                                class="flex size-3.5 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :class="[bolinha(prof(p.id)), editar ? 'cursor-pointer' : '']"
                                :title="rotuloProf(prof(p.id))"
                                :aria-label="`${p.nome}: ${rotuloProf(prof(p.id))}`"
                                @click="ciclarPericia(p.id)"
                            >
                                <span v-if="prof(p.id) === 2" class="size-1.5 rounded-full bg-preto-950" />
                            </component>
                            <span class="w-8 shrink-0 text-[10px] font-semibold uppercase text-preto-500">{{ sigla(p.atributo) }}</span>
                            <span class="min-w-0 flex-1 truncate" :class="prof(p.id) ? 'text-preto-100' : 'text-preto-300'">{{ p.nome }}</span>
                            <CampoNumero
                                v-if="editar"
                                :model-value="ficha.ajustes?.pericias?.[p.id] ?? 0"
                                :min="-20"
                                :max="20"
                                :aria-label="`Ajuste de ${p.nome}`"
                                title="Ajuste manual"
                                :class="estilos.ajuste"
                                @salvar="salvar({ [`ajustes.pericias.${p.id}`]: $event })"
                            />
                            <span class="w-7 shrink-0 text-right font-semibold tabular-nums text-ouro-100">{{
                                comSinal(calc[`pericia.${p.id}`])
                            }}</span>
                            <span class="w-6 shrink-0 text-right text-xs tabular-nums text-preto-500" :title="`Passiva ${calc[`passiva.${p.id}`]}`">{{
                                calc[`passiva.${p.id}`]
                            }}</span>
                        </LinhaRolavel>
                    </li>
                </ul>
            </section>
            <section :class="cartao" aria-label="Ferramentas">
                <h3 :class="titulo">Ferramentas</h3>
                <ul class="p-1.5 text-sm">
                    <li v-for="(f, i) in ficha.ferramentas" :key="i">
                        <LinhaRolavel
                            :rotulo="f.nome"
                            :ativa="!editar"
                            :modo="modoDe(`ferramenta.${i}`)"
                            @rolar="d20($event, `ferramenta.${i}`, f.nome)"
                        >
                            <component
                                :is="editar ? 'button' : 'span'"
                                :type="editar ? 'button' : undefined"
                                class="flex size-3.5 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :class="[bolinha(f.prof), editar ? 'cursor-pointer' : '']"
                                :title="rotuloProf(f.prof)"
                                :aria-label="`${f.nome}: ${rotuloProf(f.prof)}`"
                                @click="ciclarFerramenta(i)"
                            >
                                <span v-if="f.prof === 2" class="size-1.5 rounded-full bg-preto-950" />
                            </component>
                            <span class="w-8 shrink-0 text-[10px] font-semibold uppercase text-preto-500">{{ sigla(f.atributo) }}</span>
                            <span class="min-w-0 flex-1 truncate">{{ f.nome }}</span>
                            <button
                                v-if="editar"
                                type="button"
                                class="text-xs text-preto-500 hover:text-red-300"
                                :aria-label="`Remover ${f.nome}`"
                                @click="removerFerramenta(i)"
                            >
                                ✕
                            </button>
                            <span class="w-7 text-right font-semibold tabular-nums text-ouro-100">{{ comSinal(calc[`ferramenta.${i}`]) }}</span>
                        </LinhaRolavel>
                    </li>
                    <li v-if="!ficha.ferramentas.length" class="px-1.5 py-1 text-xs text-preto-500">Nenhuma ferramenta.</li>
                </ul>
                <form v-if="editar" class="flex gap-1.5 border-t border-preto-800 p-1.5" @submit.prevent="adicionarFerramenta">
                    <input
                        v-model="novaFerramenta.nome"
                        type="text"
                        maxlength="80"
                        placeholder="Nova ferramenta"
                        aria-label="Nome da ferramenta"
                        class="min-w-0 flex-1 rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none"
                    />
                    <select
                        v-model="novaFerramenta.atributo"
                        aria-label="Atributo da ferramenta"
                        class="rounded border border-preto-700 bg-preto-950 text-xs"
                    >
                        <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id">{{ a.sigla }}</option>
                    </select>
                    <button type="submit" class="rounded bg-ouro-500 px-2 text-xs font-semibold text-preto-950 hover:bg-ouro-400">Adicionar</button>
                </form>
            </section>
        </div>

        <!-- coluna: salvaguardas, sentidos e proficiências -->
        <div class="grid content-start gap-3">
            <section :class="cartao" aria-label="Salvaguardas">
                <h3 :class="titulo">Testes de Resistência</h3>
                <ul class="p-1.5 text-sm">
                    <li v-for="a in ATRIBUTOS" :key="a.id">
                        <LinhaRolavel
                            :rotulo="`resistência de ${a.nome}`"
                            :ativa="!editar"
                            :modo="modoDe(`salv.${a.id}`)"
                            @rolar="d20($event, `salv.${a.id}`, `Resistência de ${a.nome}`)"
                        >
                            <component
                                :is="editar ? 'button' : 'span'"
                                :type="editar ? 'button' : undefined"
                                class="size-3.5 shrink-0 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :class="[
                                    ficha.salvaguardas.includes(a.id) ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600',
                                    editar ? 'cursor-pointer' : '',
                                ]"
                                :aria-label="`${a.nome}: ${ficha.salvaguardas.includes(a.id) ? 'proficiente' : 'sem proficiência'}`"
                                @click="alternarSalvaguarda(a.id)"
                            />
                            <span class="min-w-0 flex-1 truncate">{{ a.nome }}</span>
                            <CampoNumero
                                v-if="editar"
                                :model-value="ficha.ajustes?.salvaguardas?.[a.id] ?? 0"
                                :min="-20"
                                :max="20"
                                :aria-label="`Ajuste de resistência de ${a.nome}`"
                                title="Ajuste manual"
                                :class="estilos.ajuste"
                                @salvar="salvar({ [`ajustes.salvaguardas.${a.id}`]: $event })"
                            />
                            <span class="w-7 text-right font-semibold tabular-nums text-ouro-100">{{ comSinal(calc[`salv.${a.id}`]) }}</span>
                        </LinhaRolavel>
                    </li>
                </ul>
            </section>

            <section :class="cartao" aria-label="Sentidos, defesas, proficiências e idiomas">
                <h3 :class="titulo">Sentidos, Defesas e Proficiências</h3>
                <dl class="grid gap-2 p-3 text-sm">
                    <div v-for="l in listas" :key="l.campo">
                        <dt :class="estilos.rotulo">{{ l.rotulo }}</dt>
                        <dd v-if="!editar">{{ ficha[l.campo].join(', ') || '—' }}</dd>
                        <dd v-else>
                            <CampoTexto
                                :model-value="ficha[l.campo].join(', ')"
                                :aria-label="`${l.rotulo} (separe por vírgula)`"
                                class="w-full rounded border border-preto-700 bg-preto-950 px-2 py-1 text-sm focus-visible:border-ouro-400 focus-visible:outline-none"
                                @salvar="salvarLista(l.campo, $event)"
                            />
                        </dd>
                    </div>
                </dl>
            </section>
        </div>
    </div>
</template>
