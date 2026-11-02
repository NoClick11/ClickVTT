<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

interface Props {
    className?: HTMLAttributes['class'];
}

defineProps<Props>();
</script>

<template>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" :class="className" v-bind="$attrs" style="fill: none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">
        <path d="M32 3 57 17.500v29L32 61 7 46.500v-29Z" stroke-width="3.500" />
        <path d="M32 15 49 43H15Z" stroke-width="2.500" />
        <path d="M32 3v12M7 17.500 32 15l25 2.500M7 46.500 15 43M57 46.500 49 43M15 43 7 17.500M49 43l8-25.500M15 43l17 18 17-18" stroke-width="1.800" />
    </svg>
</template>
