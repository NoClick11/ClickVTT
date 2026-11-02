<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string }>();
const style = computed(() => {
    const url = `url(/img/icones/${props.name}.svg)`;
    return { maskImage: url, WebkitMaskImage: url };
});
</script>

<template>
    <span class="inline-block size-5 shrink-0 bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]" :style="style" aria-hidden="true" />
</template>
