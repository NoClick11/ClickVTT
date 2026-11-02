<script setup lang="ts">
import AppLogoIcon from '@/components/AppLogoIcon.vue';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/vue3';
import { LogOut, Settings } from 'lucide-vue-next';
import { computed } from 'vue';

const user = computed(() => (usePage().props as unknown as SharedData).auth.user);
const iniciais = computed(() => user.value.name.slice(0, 2).toUpperCase());
</script>

<template>
    <header class="sticky top-0 z-20 border-b border-ouro-500/20 bg-preto-950/90 backdrop-blur">
        <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link href="/" class="flex items-center gap-2.5">
                <AppLogoIcon class="size-8 text-ouro-400" />
                <span class="font-serif text-lg font-semibold tracking-wide text-ouro-100">ClickVTT</span>
            </Link>
            <DropdownMenu>
                <DropdownMenuTrigger class="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ouro-400">
                    <span class="hidden text-sm text-preto-300 sm:inline">{{ user.name }}</span>
                    <Avatar class="size-8 border border-ouro-500/40"><AvatarFallback class="bg-preto-800 text-xs text-ouro-200">{{ iniciais }}</AvatarFallback></Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-52">
                    <DropdownMenuLabel class="truncate">{{ user.email }}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem as-child>
                        <Link :href="route('profile.edit')" class="w-full cursor-pointer"><Settings class="mr-2 size-4" /> Configurações</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="router.post(route('logout'))"><LogOut class="mr-2 size-4" /> Sair</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </header>
</template>
