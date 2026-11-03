<script setup lang="ts">
import { computed } from 'vue';
import BotaoD20 from '../BotaoD20.vue';
import { ATRIBUTOS, comSinal, modificador, PERICIAS, type AtributoId, type FichaDnd5e, type Proficiencia } from '../dnd5e';

const props = defineProps<{ ficha: FichaDnd5e }>();

const mod = (a: AtributoId) => modificador(props.ficha.atributos[a]);
const bonus = (a: AtributoId, p: Proficiencia) => mod(a) + p * props.ficha.bonusProficiencia;
const sigla = (a: AtributoId) => ATRIBUTOS.find((x) => x.id === a)!.sigla;
const pericias = computed(() => PERICIAS.map((p) => ({ ...p, prof: (props.ficha.pericias[p.id] ?? 0) as Proficiencia })).map((p) => ({ ...p, bonus: bonus(p.atributo, p.prof), passiva: 10 + bonus(p.atributo, p.prof) })));
const salvas = computed(() => ATRIBUTOS.map((a) => ({ ...a, prof: (props.ficha.salvaguardas.includes(a.id) ? 1 : 0) as Proficiencia, bonus: bonus(a.id, props.ficha.salvaguardas.includes(a.id) ? 1 : 0) })));

const cartao = 'rounded-lg border border-preto-800 bg-preto-900/60';
const titulo = 'border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
</script>

<template>
    <div class="grid gap-3 p-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        <!-- coluna: perícias e ferramentas -->
        <div class="grid content-start gap-3">
            <section :class="cartao" aria-label="Perícias">
                <h3 :class="titulo">Perícias</h3>
                <ul class="p-1.5 text-sm">
                    <li v-for="p in pericias" :key="p.id" class="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-preto-800/60">
                        <span class="flex size-3.5 shrink-0 items-center justify-center rounded-full border" :class="p.prof === 2 ? 'border-ouro-300 bg-ouro-400' : p.prof === 1 ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600'" :title="p.prof === 2 ? 'Especialista' : p.prof === 1 ? 'Proficiente' : 'Sem proficiência'" role="img" :aria-label="p.prof === 2 ? 'Especialista' : p.prof === 1 ? 'Proficiente' : 'Sem proficiência'"><span v-if="p.prof === 2" class="size-1.5 rounded-full bg-preto-950" /></span>
                        <span class="w-8 shrink-0 text-[10px] font-semibold uppercase text-preto-500">{{ sigla(p.atributo) }}</span>
                        <span class="min-w-0 flex-1 truncate" :class="p.prof ? 'text-preto-100' : 'text-preto-300'">{{ p.nome }}</span>
                        <span class="w-7 shrink-0 text-right font-semibold tabular-nums text-ouro-100">{{ comSinal(p.bonus) }}</span>
                        <span class="w-6 shrink-0 text-right text-xs tabular-nums text-preto-500" :title="`Passiva ${p.passiva}`">{{ p.passiva }}</span>
                        <BotaoD20 :rotulo="p.nome" />
                    </li>
                </ul>
            </section>
            <section :class="cartao" aria-label="Ferramentas">
                <h3 :class="titulo">Ferramentas</h3>
                <ul class="p-1.5 text-sm">
                    <li v-for="f in ficha.ferramentas" :key="f.nome" class="flex items-center gap-2 rounded px-1.5 py-0.5">
                        <span class="size-3.5 shrink-0 rounded-full border" :class="f.prof ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600'" />
                        <span class="w-8 shrink-0 text-[10px] font-semibold uppercase text-preto-500">{{ sigla(f.atributo) }}</span>
                        <span class="min-w-0 flex-1 truncate">{{ f.nome }}</span>
                        <span class="w-7 text-right font-semibold tabular-nums text-ouro-100">{{ comSinal(bonus(f.atributo, f.prof)) }}</span>
                        <BotaoD20 :rotulo="f.nome" />
                    </li>
                    <li v-if="!ficha.ferramentas.length" class="px-1.5 py-1 text-xs text-preto-500">Nenhuma ferramenta.</li>
                </ul>
            </section>
        </div>

        <!-- coluna: salvaguardas e características de traços -->
        <div class="grid content-start gap-3">
            <section :class="cartao" aria-label="Salvaguardas">
                <h3 :class="titulo">Testes de Resistência</h3>
                <ul class="p-1.5 text-sm">
                    <li v-for="s in salvas" :key="s.id" class="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-preto-800/60">
                        <span class="size-3.5 shrink-0 rounded-full border" :class="s.prof ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600'" role="img" :aria-label="s.prof ? 'Proficiente' : 'Sem proficiência'" />
                        <span class="min-w-0 flex-1 truncate">{{ s.nome }}</span>
                        <span class="w-7 text-right font-semibold tabular-nums text-ouro-100">{{ comSinal(s.bonus) }}</span>
                        <BotaoD20 :rotulo="`resistência de ${s.nome}`" />
                    </li>
                </ul>
            </section>

            <section :class="cartao" aria-label="Sentidos e defesas">
                <h3 :class="titulo">Sentidos e Defesas</h3>
                <dl class="grid gap-2 p-3 text-sm">
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Sentidos</dt><dd>{{ ficha.sentidos.join(', ') || '—' }}</dd></div>
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Resistências</dt><dd>{{ ficha.resistencias.join(', ') || '—' }}</dd></div>
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Imunidades</dt><dd>{{ ficha.imunidades.join(', ') || '—' }}</dd></div>
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Vulnerabilidades</dt><dd>{{ ficha.vulnerabilidades.join(', ') || '—' }}</dd></div>
                </dl>
            </section>

            <section :class="cartao" aria-label="Proficiências e idiomas">
                <h3 :class="titulo">Proficiências e Idiomas</h3>
                <dl class="grid gap-2 p-3 text-sm">
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Armaduras</dt><dd>{{ ficha.proficienciasArmaduras.join(', ') || '—' }}</dd></div>
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Armas</dt><dd>{{ ficha.proficienciasArmas.join(', ') || '—' }}</dd></div>
                    <div><dt class="text-[10px] font-semibold uppercase tracking-wider text-preto-500">Idiomas</dt><dd>{{ ficha.idiomas.join(', ') || '—' }}</dd></div>
                </dl>
            </section>
        </div>
    </div>
</template>
