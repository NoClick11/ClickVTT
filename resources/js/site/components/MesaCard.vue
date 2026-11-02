<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from '@inertiajs/vue3';
import { Lock, MoreVertical, Pencil, Play, Star, Trash2, Users } from 'lucide-vue-next';
import { computed } from 'vue';
import type { Mesa } from '../types';
import GameIcon from './GameIcon.vue';

const props = defineProps<{ mesa: Mesa; modo: 'tile' | 'lista' }>();
defineEmits<{ editar: []; favoritar: []; travar: []; excluir: [] }>();

const icone = computed(() => props.mesa.sistema.icone ?? 'dice-twenty-faces-twenty');
</script>

<template>
    <article
        class="group relative overflow-hidden rounded-lg border border-ouro-500/20 bg-preto-900/80 shadow-lg transition hover:border-ouro-400/60 hover:shadow-ouro-900/20"
        :class="modo === 'lista' ? 'flex items-stretch' : 'flex flex-col'"
    >
        <div
            class="relative shrink-0 bg-preto-800 bg-cover bg-center"
            :class="modo === 'lista' ? 'w-40' : 'h-40 w-full'"
            :style="mesa.capa ? { backgroundImage: `url(${mesa.capa})` } : {}"
        >
            <div class="absolute inset-0 bg-gradient-to-t from-preto-900 via-preto-900/20 to-transparent" :class="modo === 'lista' && 'bg-gradient-to-r'" />
            <div class="absolute right-2 top-2 flex gap-1.5">
                <Lock v-if="mesa.travada" class="size-4 text-ouro-200 drop-shadow" aria-label="Travada" />
                <Star class="size-4 drop-shadow" :class="mesa.favorita ? 'fill-ouro-400 text-ouro-400' : 'text-white/70'" />
            </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-3 p-4" :class="modo === 'tile' && '-mt-8 relative'">
            <div class="flex items-start gap-3">
                <div class="flex size-10 shrink-0 items-center justify-center rounded-md border border-ouro-500/40 bg-preto-950 text-ouro-400"><GameIcon :name="icone" /></div>
                <div class="min-w-0">
                    <h3 class="truncate font-serif text-lg font-semibold leading-tight text-ouro-50"><Link :href="route('mesas.show', mesa.slug)" class="after:absolute after:inset-0 hover:text-ouro-300">{{ mesa.nome }}</Link></h3>
                    <p class="text-xs text-ouro-300/80">{{ mesa.sistema.nome }}</p>
                </div>
            </div>
            <p v-if="mesa.descricao" class="line-clamp-2 text-sm text-preto-400">{{ mesa.descricao }}</p>
            <div class="relative z-10 mt-auto flex items-center gap-2 pt-1">
                <Button size="sm" class="flex-1 bg-ouro-500 text-preto-950 hover:bg-ouro-400" disabled title="Em breve"><Play class="size-4" /> Iniciar mesa</Button>
                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <Button size="icon" variant="ghost" class="text-preto-300" aria-label="Mais ações"><MoreVertical class="size-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem as-child><Link :href="route('mesas.show', mesa.slug)" class="w-full cursor-pointer"><Users class="mr-2 size-4" /> Personagens e convite</Link></DropdownMenuItem>
                        <DropdownMenuItem :disabled="mesa.travada" @click="$emit('editar')"><Pencil class="mr-2 size-4" /> Editar mesa</DropdownMenuItem>
                        <DropdownMenuItem @click="$emit('favoritar')"><Star class="mr-2 size-4" /> {{ mesa.favorita ? 'Desfavoritar' : 'Favoritar' }}</DropdownMenuItem>
                        <DropdownMenuItem @click="$emit('travar')"><Lock class="mr-2 size-4" /> {{ mesa.travada ? 'Destravar' : 'Travar' }}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem class="text-red-400 focus:text-red-300" :disabled="mesa.travada" @click="$emit('excluir')"><Trash2 class="mr-2 size-4" /> Excluir mesa</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    </article>
</template>
