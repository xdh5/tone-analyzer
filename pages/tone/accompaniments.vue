<template>
  <main class="list-page">
    <section class="list-shell">
      <header class="page-header">
        <NuxtLink class="icon-link" to="/tone/recording" aria-label="返回" title="返回">
          <i class="bi bi-chevron-left"></i>
        </NuxtLink>
        <h1>伴奏跟唱</h1>
        <span aria-hidden="true"></span>
      </header>

      <button class="upload-card" type="button" :disabled="uploading" @click="fileInput?.click()">
        <i :class="uploading ? 'bi bi-hourglass-split' : 'bi bi-cloud-arrow-up'"></i>
        <span>
          <strong>{{ uploading ? '正在上传' : '上传伴奏' }}</strong>
          <small>上传后选择伴奏，进入跟唱录音</small>
        </span>
      </button>

      <input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        accept="audio/*"
        @change="uploadAccompaniment"
      />

      <section class="list-section">
        <h2>已上传伴奏</h2>
        <div v-if="accompaniments.length === 0" class="empty-row">还没有伴奏</div>
        <div v-for="item in accompaniments" :key="item.id" class="list-row">
          <NuxtLink class="media-link" :to="`/tone/practice/${item.id}`">
            <i class="bi bi-music-note-beamed"></i>
            <span>{{ item.name }}</span>
            <small>{{ formatTime(item.duration) }}</small>
          </NuxtLink>
          <div class="row-actions">
            <button class="action-button" type="button" :aria-label="`重命名伴奏 ${item.name}`" title="重命名" @click="openRenameDialog(item)">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="action-button danger" type="button" :aria-label="`删除伴奏 ${item.name}`" title="删除" @click="openDeleteDialog(item)">
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

type MediaItem = {
  id: number
  name: string
  duration: number
}

type DialogKind = 'rename' | 'delete'

const fileInput = ref<HTMLInputElement | null>(null)
const accompaniments = ref<MediaItem[]>([])
const uploading = ref(false)
const draftName = ref('')
const { showToast } = useToast()

const dialog = reactive<{
  open: boolean
  kind: DialogKind | null
  target: MediaItem | null
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

onMounted(() => {
  refreshList().catch(() => showToast('伴奏列表加载失败', 'error'))
})

async function refreshList() {
  const response = await $fetch<{ data: MediaItem[] }>('/api/accompaniments')
  accompaniments.value = response.data
}

async function uploadAccompaniment(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || uploading.value) return

  uploading.value = true

  try {
    const duration = await readAudioDuration(file).catch(() => 0)
    const formData = new FormData()
    formData.append('name', file.name.replace(/\.[^.]+$/, ''))
    formData.append('duration', String(duration))
    formData.append('mimeType', file.type || 'audio/mpeg')
    formData.append('audio', file, file.name)

    await $fetch('/api/accompaniments', {
      method: 'POST',
      body: formData
    })

    input.value = ''
    await refreshList()
    showToast('伴奏上传成功', 'success')
  } catch {
    showToast('伴奏上传失败', 'error')
  } finally {
    uploading.value = false
  }
}

function openRenameDialog(item: MediaItem) {
  draftName.value = item.name
  dialog.open = true
  dialog.kind = 'rename'
  dialog.target = item
  dialog.title = '重命名伴奏'
  dialog.message = ''
  dialog.confirmText = '保存'
}

function openDeleteDialog(item: MediaItem) {
  dialog.open = true
  dialog.kind = 'delete'
  dialog.target = item
  dialog.title = '删除伴奏'
  dialog.message = `确定删除“${item.name}”？已有跟唱录音会保留，伴奏关联会清空。`
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
      const response = await $fetch<{ data: MediaItem }>(`/api/accompaniments/${dialog.target.id}`, {
        method: 'PATCH',
        body: { name: draftName.value.trim() }
      })
      accompaniments.value = accompaniments.value.map((item) => item.id === response.data.id ? response.data : item)
      showToast('伴奏已重命名', 'success')
    } else {
      await $fetch(`/api/accompaniments/${dialog.target.id}`, { method: 'DELETE' })
      accompaniments.value = accompaniments.value.filter((item) => item.id !== dialog.target?.id)
      showToast('伴奏已删除', 'success')
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

function readAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Cannot read audio duration'))
    }
    audio.src = url
  })
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

.upload-card {
  display: grid;
  width: 100%;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 72px;
  padding: 12px;
  border: 1px dashed #b7c6da;
  border-radius: 8px;
  color: #1d2938;
  background: #f8fafc;
  text-align: left;
}

.upload-card i {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 999px;
  background: #fff;
  font-size: 1.2rem;
}

.upload-card span {
  display: grid;
  gap: 3px;
}

.upload-card strong {
  font-size: 0.98rem;
}

.upload-card small {
  color: #66758a;
  font-size: 0.78rem;
}

.upload-card:disabled {
  opacity: 0.62;
}

.list-section {
  margin-top: 20px;
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

.media-link {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  min-height: 54px;
  gap: 0;
  color: #1d2938;
  text-decoration: none;
}

.media-link span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-link small {
  color: #66758a;
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

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
