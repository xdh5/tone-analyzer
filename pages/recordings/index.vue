<template>
  <main class="list-page">
    <section class="list-shell">
      <header class="page-header">
        <NuxtLink class="icon-link" to="/" aria-label="返回" title="返回">
          <i class="bi bi-chevron-left"></i>
        </NuxtLink>
        <h1>录音记录</h1>
        <span aria-hidden="true"></span>
      </header>

      <section class="list-section">
        <h2>已保存录音</h2>
        <div v-if="recordings.length === 0" class="empty-row">还没有保存的录音</div>
        <div v-for="item in recordings" :key="item.id" class="list-row">
          <NuxtLink class="recording-link" :to="`/recordings/${item.id}`">
            <i class="bi bi-play-fill"></i>
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.accompanimentId ? '伴奏录音' : '自由录音' }}</small>
            </span>
            <em>{{ formatTime(item.duration) }}</em>
          </NuxtLink>
          <div class="row-actions">
            <button class="action-button" type="button" :aria-label="`重命名录音 ${item.name}`" title="重命名" @click="openRenameDialog(item)">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="action-button danger" type="button" :aria-label="`删除录音 ${item.name}`" title="删除" @click="openDeleteDialog(item)">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </div>
      </section>
    </section>

    <AppDialog
      :open="dialog.open"
      :title="dialog.title"
      :message="dialog.message"
      :confirm-text="dialog.confirmText"
      :danger="dialog.kind === 'delete'"
      :busy="dialog.busy"
      @cancel="closeDialog"
      @confirm="confirmDialog"
    >
      <label v-if="dialog.kind === 'rename'" class="rename-field">
        <span>名称</span>
        <input v-model.trim="draftName" type="text" maxlength="80" placeholder="输入新名称" @keyup.enter="confirmDialog" />
      </label>
    </AppDialog>
  </main>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

type RecordingItem = {
  id: number
  name: string
  duration: number
  accompanimentId: number | null
}

type User = {
  id: number
  username: string
  name: string
}

type DialogKind = 'rename' | 'delete'

const recordings = ref<RecordingItem[]>([])
const draftName = ref('')
const user = ref<User | null>(null)
const { showToast } = useToast()

const dialog = reactive<{
  open: boolean
  kind: DialogKind | null
  target: RecordingItem | null
  title: string
  message: string
  confirmText: string
  busy: boolean
}>({
  open: false,
  kind: null,
  target: null,
  title: '',
  message: '',
  confirmText: '确认',
  busy: false
})

onMounted(async () => {
  await refreshUser().catch(() => null)
  if (!user.value) {
    showToast('请先登录后查看录音', 'info')
    return
  }
  refreshList().catch((error) => {
    showToast(isUnauthorized(error) ? '请先登录后查看录音' : '录音列表加载失败', 'error')
  })
})

async function refreshUser() {
  const response = await $fetch<{ data: User | null }>('/api/auth/me')
  user.value = response.data
}

async function refreshList() {
  const response = await $fetch<{ data: RecordingItem[] }>('/api/recordings')
  recordings.value = response.data
}

function openRenameDialog(item: RecordingItem) {
  draftName.value = item.name
  dialog.open = true
  dialog.kind = 'rename'
  dialog.target = item
  dialog.title = '重命名录音'
  dialog.message = ''
  dialog.confirmText = '保存'
}

function openDeleteDialog(item: RecordingItem) {
  dialog.open = true
  dialog.kind = 'delete'
  dialog.target = item
  dialog.title = '删除录音'
  dialog.message = `确定删除“${item.name}”？这个操作不能撤销。`
  dialog.confirmText = '删除'
}

function closeDialog() {
  if (dialog.busy) return
  dialog.open = false
  dialog.kind = null
  dialog.target = null
  draftName.value = ''
}

async function confirmDialog() {
  if (!dialog.target || !dialog.kind || dialog.busy) return

  if (dialog.kind === 'rename' && !draftName.value.trim()) {
    showToast('名称不能为空', 'error')
    return
  }

  dialog.busy = true

  try {
    if (dialog.kind === 'rename') {
      const response = await $fetch<{ data: RecordingItem }>(`/api/recordings/${dialog.target.id}`, {
        method: 'PATCH',
        body: { name: draftName.value.trim() }
      })
      recordings.value = recordings.value.map((item) => item.id === response.data.id ? response.data : item)
      showToast('录音已重命名', 'success')
    } else {
      await $fetch(`/api/recordings/${dialog.target.id}`, { method: 'DELETE' })
      recordings.value = recordings.value.filter((item) => item.id !== dialog.target?.id)
      showToast('录音已删除', 'success')
    }
    dialog.open = false
    dialog.kind = null
    dialog.target = null
  } catch {
    showToast(dialog.kind === 'rename' ? '重命名失败' : '删除失败', 'error')
  } finally {
    dialog.busy = false
  }
}

function isUnauthorized(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && ('statusCode' in error || 'status' in error)
    && ((error as { statusCode?: number; status?: number }).statusCode === 401
      || (error as { statusCode?: number; status?: number }).status === 401)
}

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = Math.floor(safeSeconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.list-page {
  min-height: 100dvh;
  background: #eef3f8;
}

.list-shell {
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
  margin-bottom: 14px;
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

.list-section h2 {
  margin: 0 0 8px;
  color: #506070;
  font-size: 0.9rem;
  font-weight: 800;
}

.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 54px;
  border-bottom: 1px solid #edf1f5;
}

.recording-link {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 54px;
  min-width: 0;
  color: #1d2938;
  text-decoration: none;
}

.recording-link span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.recording-link strong,
.recording-link small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recording-link strong {
  font-size: 0.94rem;
}

.recording-link small,
.recording-link em {
  color: #66758a;
  font-size: 0.78rem;
  font-style: normal;
}

.recording-link em {
  font-variant-numeric: tabular-nums;
}

.row-actions {
  display: flex;
  gap: 6px;
  padding-left: 8px;
}

.action-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  color: #66758a;
  background: #fff;
}

.action-button.danger {
  color: #dc2626;
}

.empty-row {
  display: flex;
  align-items: center;
  min-height: 54px;
  border-bottom: 1px solid #edf1f5;
  color: #8a97a7;
}

.rename-field {
  display: grid;
  gap: 6px;
  padding: 0 16px 4px;
}

.rename-field span {
  color: #506070;
  font-size: 0.78rem;
  font-weight: 800;
}

.rename-field input {
  width: 100%;
  height: 38px;
  border: 1px solid #d6dfeb;
  border-radius: 8px;
  padding: 0 10px;
  color: #172033;
  font-size: 0.92rem;
}
</style>
