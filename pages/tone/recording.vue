<template>
  <main class="module-menu">
    <section class="module-shell">
      <header class="page-header">
        <NuxtLink class="icon-link" to="/tone" aria-label="返回" title="返回">
          <i class="bi bi-chevron-left"></i>
        </NuxtLink>
        <h1>录音模块</h1>
        <span></span>
      </header>

      <nav class="module-list" aria-label="录音模块菜单">
        <NuxtLink class="module-row primary" to="/tone/record">
          <span class="module-icon"><i class="bi bi-mic-fill"></i></span>
          <span class="module-copy">
            <strong>自由录音</strong>
            <small>不使用伴奏，直接录制音高曲线</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>

        <NuxtLink class="module-row" to="/tone/accompaniments">
          <span class="module-icon"><i class="bi bi-music-note-beamed"></i></span>
          <span class="module-copy">
            <strong>伴奏跟唱</strong>
            <small>上传伴奏或选择已有伴奏</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>

        <NuxtLink class="module-row" to="/tone/recordings">
          <span class="module-icon"><i class="bi bi-collection-play"></i></span>
          <span class="module-copy">
            <strong>录音记录</strong>
            <small>查看和播放保存的录音</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.module-menu {
  min-height: 100dvh;
  background: #eef3f8;
}

.module-shell {
  min-height: 100dvh;
  max-width: 520px;
  margin: 0 auto;
  padding: 14px 14px 28px;
  background: #fff;
}

.page-header {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.page-header h1 {
  margin: 0;
  color: #162033;
  font-size: 1.22rem;
  font-weight: 850;
  text-align: center;
}

.icon-link {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  color: #303b4d;
  background: #fff;
  text-decoration: none;
}

.module-list {
  display: grid;
  gap: 10px;
}

.module-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 20px;
  align-items: center;
  min-height: 72px;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  color: #1d2938;
  background: #f8fafc;
  text-decoration: none;
}

.module-row.primary {
  border-color: #ffc43d;
  background: #fff9e8;
}

.module-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font-size: 1.1rem;
}

.primary .module-icon {
  background: #ffc43d;
  color: #172033;
}

.module-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.module-copy strong,
.module-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-copy strong {
  font-size: 0.98rem;
  font-weight: 850;
}

.module-copy small {
  color: #66758a;
  font-size: 0.78rem;
}
</style>
