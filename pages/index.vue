<template>
  <main class="tone-menu">
    <section class="tone-shell">
      <header class="menu-header">
        <div>
          <p>TONE</p>
          <h1>声音工具</h1>
        </div>
        <button v-if="user" class="avatar-button" type="button" title="退出登录" @click="logout">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" />
          <i v-else class="bi bi-person-fill"></i>
        </button>
        <a v-else class="login-button" href="/api/auth/google">
          <i class="bi bi-google"></i>
          <span>登录</span>
        </a>
      </header>

      <div v-if="user" class="account-card">
        <span>
          <strong>{{ user.name }}</strong>
          <small>{{ user.email }}</small>
        </span>
        <button type="button" @click="logout">退出</button>
      </div>

      <nav class="module-list" aria-label="TONE 功能菜单">
        <NuxtLink class="module-row primary" to="/recording">
          <span class="module-icon"><i class="bi bi-grid-fill"></i></span>
          <span class="module-copy">
            <strong>录音模块</strong>
            <small>进入录音相关功能</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>

        <NuxtLink class="module-row" to="/record">
          <span class="module-icon"><i class="bi bi-mic-fill"></i></span>
          <span class="module-copy">
            <strong>自由录音</strong>
            <small>直接打开音高画布</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>

        <NuxtLink class="module-row" to="/accompaniments">
          <span class="module-icon"><i class="bi bi-music-note-beamed"></i></span>
          <span class="module-copy">
            <strong>伴奏跟唱</strong>
            <small>上传或选择伴奏</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>

        <NuxtLink class="module-row" to="/recordings">
          <span class="module-icon"><i class="bi bi-collection-play"></i></span>
          <span class="module-copy">
            <strong>录音记录</strong>
            <small>播放已保存作品</small>
          </span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>

        <div class="module-row disabled" aria-disabled="true">
          <span class="module-icon"><i class="bi bi-bullseye"></i></span>
          <span class="module-copy">
            <strong>音准训练</strong>
            <small>待开发</small>
          </span>
          <i class="bi bi-lock"></i>
        </div>

        <div class="module-row disabled" aria-disabled="true">
          <span class="module-icon"><i class="bi bi-music-player"></i></span>
          <span class="module-copy">
            <strong>歌曲库</strong>
            <small>待开发</small>
          </span>
          <i class="bi bi-lock"></i>
        </div>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

type User = {
  id: number
  email: string
  name: string
  avatarUrl: string | null
}

const user = ref<User | null>(null)
const { showToast } = useToast()

onMounted(() => {
  refreshUser().catch(() => showToast('登录状态加载失败', 'error'))
})

async function refreshUser() {
  const response = await $fetch<{ data: User | null }>('/api/auth/me')
  user.value = response.data
}

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    showToast('已退出登录', 'success')
  } catch {
    showToast('退出登录失败', 'error')
  }
}
</script>

<style scoped>
.tone-menu {
  min-height: 100dvh;
  background: #eef3f8;
}

.tone-shell {
  min-height: 100dvh;
  max-width: 520px;
  margin: 0 auto;
  padding: 22px 14px 28px;
  background: #fff;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.menu-header p {
  margin: 0 0 4px;
  color: #627083;
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.menu-header h1 {
  margin: 0;
  color: #162033;
  font-size: 1.45rem;
  font-weight: 900;
}

.login-button,
.avatar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  color: #172033;
  background: #fff;
  text-decoration: none;
}

.login-button {
  height: 38px;
  gap: 7px;
  padding: 0 12px;
  font-size: 0.88rem;
  font-weight: 800;
}

.avatar-button {
  width: 40px;
  height: 40px;
  overflow: hidden;
}

.avatar-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #f8fafc;
}

.account-card span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.account-card strong,
.account-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card strong {
  color: #1d2938;
  font-size: 0.92rem;
}

.account-card small {
  color: #66758a;
  font-size: 0.76rem;
}

.account-card button {
  flex: 0 0 auto;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  background: #fff;
  color: #3d4856;
  font-size: 0.8rem;
}

.module-list {
  display: grid;
  gap: 10px;
}

.module-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 20px;
  align-items: center;
  min-height: 68px;
  gap: 10px;
  padding: 10px 12px;
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

.module-row.disabled {
  color: #8b98a9;
  background: #f5f7fa;
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
