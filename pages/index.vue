<template>
  <div class="redirect-page"></div>
</template>

<script setup lang="ts">
await navigateTo('/tone', { replace: true })
</script>

<style scoped>
.redirect-page {
  min-height: 100dvh;
  background: #eef3f8;
}
</style>
