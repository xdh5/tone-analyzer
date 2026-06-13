<template>
  <div class="redirect-page"></div>
</template>

<script setup lang="ts">
const route = useRoute()

const recordingId = Number(route.query.recordingId || 0)
const accompanimentId = Number(route.query.accompanimentId || 0)

if (Number.isFinite(recordingId) && recordingId > 0) {
  await navigateTo(`/tone/recordings/${recordingId}`, { replace: true })
} else if (Number.isFinite(accompanimentId) && accompanimentId > 0) {
  await navigateTo(`/tone/practice/${accompanimentId}`, { replace: true })
} else {
  await navigateTo('/tone/record', { replace: true })
}
</script>

<style scoped>
.redirect-page {
  min-height: 100dvh;
  background: #fff;
}
</style>
