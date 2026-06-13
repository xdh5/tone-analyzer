<template>
  <ToneAnalyzer mode="practice" :accompaniment-id="accompanimentId" />
</template>

<script setup lang="ts">
const route = useRoute()
const accompanimentId = computed(() => Number(route.params.accompanimentId || 0))
</script>
