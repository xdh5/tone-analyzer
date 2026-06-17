<template>
  <main class="tone-menu">
    <section class="tone-shell">
      <header class="menu-header">
        <div>
          <p>TONE</p>
          <h1>声音工具</h1>
        </div>
        <div v-if="user" class="user-actions" aria-label="账号操作">
          <span class="username-badge">{{ user.username }}</span>
          <button class="logout-button" type="button" title="退出登录" @click="logout">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </header>

      <div v-if="!authReady" class="auth-loading" aria-label="正在检查登录状态">
        <span></span>
      </div>

      <form v-else-if="!user" class="auth-card" @submit.prevent="submitAuth">
        <div class="auth-tabs" role="tablist" aria-label="账号入口">
          <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">登录</button>
          <button type="button" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">注册</button>
        </div>

        <label>
          <span>用户名</span>
          <input v-model.trim="username" type="text" autocomplete="username" placeholder="请输入用户名" />
        </label>

        <label>
          <span>密码</span>
          <input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
        </label>

        <button class="auth-submit" type="submit" :disabled="authBusy">
          <i :class="authBusy ? 'bi bi-hourglass-split' : 'bi bi-box-arrow-in-right'"></i>
          <span>{{ authMode === 'login' ? '登录' : '注册并登录' }}</span>
        </button>
      </form>

      <nav v-if="user" class="module-list" aria-label="TONE 功能菜单">
        <NuxtLink class="module-row primary" to="/record">
          <span class="module-icon"><i class="bi bi-mic-fill"></i></span>
          <span class="module-copy">
            <strong>自由录音</strong>
            <small>录音、回放、保存你的音高曲线</small>
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
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

type User = {
  id: number
  username: string
  name: string
}

const user = ref<User | null>(null)
const authMode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const authBusy = ref(false)
const authReady = ref(false)
const { showToast } = useToast()

onMounted(() => {
  refreshUser()
    .catch(() => showToast('登录状态加载失败', 'error'))
    .finally(() => {
      authReady.value = true
    })
})

async function refreshUser() {
  const response = await $fetch<{ data: User | null }>('/api/auth/me')
  user.value = response.data
}

async function submitAuth() {
  if (authBusy.value) return

  authBusy.value = true
  try {
    await $fetch(authMode.value === 'login' ? '/api/auth/login' : '/api/auth/register', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value
      }
    })
    password.value = ''
    await refreshUser()
    showToast(authMode.value === 'login' ? '登录成功' : '注册成功', 'success')
  } catch {
    showToast(authMode.value === 'login' ? '用户名或密码错误' : '注册失败，请换一个用户名', 'error')
  } finally {
    authBusy.value = false
  }
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

.user-actions {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.username-badge {
  display: block;
  max-width: 116px;
  overflow: hidden;
  color: #3d4856;
  font-size: 0.84rem;
  font-weight: 850;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  color: #172033;
  background: #fff;
  text-decoration: none;
}

.logout-button {
  width: 36px;
  height: 36px;
  font-size: 1rem;
}

.auth-card {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #f8fafc;
}

.auth-loading {
  display: grid;
  height: 118px;
  place-items: center;
}

.auth-loading span {
  width: 26px;
  height: 26px;
  border: 3px solid #dce5ef;
  border-top-color: #ffc43d;
  border-radius: 999px;
  animation: auth-spin 780ms linear infinite;
}

@keyframes auth-spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  background: #fff;
}

.auth-tabs button {
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #66758a;
  font-size: 0.86rem;
  font-weight: 850;
}

.auth-tabs button.active {
  background: #ffc43d;
  color: #172033;
}

.auth-card label {
  display: grid;
  gap: 6px;
}

.auth-card label span {
  color: #506070;
  font-size: 0.78rem;
  font-weight: 800;
}

.auth-card input {
  width: 100%;
  height: 40px;
  border: 1px solid #d6dfeb;
  border-radius: 8px;
  padding: 0 10px;
  color: #172033;
  font-size: 16px;
  background: #fff;
}

.auth-submit {
  display: inline-flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 8px;
  background: #172033;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 850;
}

.auth-submit:disabled {
  opacity: 0.58;
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
