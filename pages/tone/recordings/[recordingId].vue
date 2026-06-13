<template>
  <ToneAnalyzer mode="playback" :recording-id="recordingId" />
</template>

<script setup lang="ts">
const route = useRoute()
const recordingId = computed(() => Number(route.params.recordingId || 0))
</script>
