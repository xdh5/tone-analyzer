<template>
  <main class="stats-page">
    <section class="stats-shell">
      <header class="page-header">
        <NuxtLink class="icon-link" to="/" aria-label="返回" title="返回">
          <i class="bi bi-chevron-left"></i>
        </NuxtLink>
        <h1>练习统计</h1>
        <span aria-hidden="true"></span>
      </header>

      <div v-if="loading" class="loading-row" aria-label="正在加载统计">
        <span></span>
      </div>

      <template v-else>
        <section class="summary-strip" aria-label="练习概览">
          <div>
            <strong>{{ stats.summary.totalCount }}</strong>
            <span>练习次数</span>
          </div>
          <div>
            <strong>{{ formatDuration(stats.summary.totalDuration) }}</strong>
            <span>练习时长</span>
          </div>
          <div>
            <strong>{{ stats.summary.activeDays }}</strong>
            <span>活跃天数</span>
          </div>
        </section>

        <section class="stats-section">
          <div class="section-heading">
            <h2>过去一年</h2>
            <span>颜色越深，练习次数越多</span>
          </div>
          <div ref="heatmapScroller" class="heatmap-scroll">
            <div class="heatmap-grid" role="grid" aria-label="每日练习次数">
              <button
                v-for="cell in calendarCells"
                :key="cell.date"
                class="heat-cell"
                :class="[`level-${cell.level}`, { selected: selectedDate === cell.date }]"
                type="button"
                role="gridcell"
                :title="`${cell.date}：${cell.count} 次`"
                :aria-label="`${cell.date}，练习 ${cell.count} 次`"
                @click="selectedDate = cell.date"
              ></button>
            </div>
          </div>
          <div class="heat-legend" aria-hidden="true">
            <span>少</span>
            <i v-for="level in 5" :key="level" :class="`level-${level - 1}`"></i>
            <span>多</span>
          </div>
        </section>

        <section class="stats-section">
          <div class="section-heading">
            <h2>{{ formatDateLabel(selectedDate) }}</h2>
            <span>{{ selectedDayCount }} 次</span>
          </div>
          <div v-if="selectedSessions.length === 0" class="empty-row">这天没有练习</div>
          <div v-for="session in selectedSessions" :key="session.id" class="detail-row">
            <span class="detail-icon"><i :class="session.accompaniment ? 'bi bi-music-note-beamed' : 'bi bi-mic-fill'"></i></span>
            <span class="detail-copy">
              <strong>{{ session.accompaniment?.name || '自由录音' }}</strong>
              <small>{{ formatClock(session.startedAt) }}</small>
            </span>
            <span class="detail-duration">{{ formatDuration(session.duration) }}</span>
          </div>
        </section>

        <section class="stats-section">
          <div class="section-heading">
            <h2>伴奏练习排行</h2>
            <span>{{ stats.accompaniments.length }} 首</span>
          </div>
          <div v-if="stats.accompaniments.length === 0" class="empty-row">还没有伴奏练习</div>
          <div v-for="(item, index) in stats.accompaniments" :key="item.id" class="ranking-row">
            <span class="ranking-index">{{ index + 1 }}</span>
            <span class="ranking-name">{{ item.name }}</span>
            <span class="ranking-count">{{ item.count }} 次</span>
            <span class="ranking-duration">{{ formatDuration(item.duration) }}</span>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

type PracticeSession = {
  id: number
  date: string
  mode: string
  duration: number
  startedAt: string
  accompaniment: { id: number; name: string } | null
}

type StatsData = {
  summary: { totalCount: number; totalDuration: number; activeDays: number }
  days: Array<{ date: string; count: number; duration: number }>
  sessions: PracticeSession[]
  accompaniments: Array<{ id: number; name: string; count: number; duration: number }>
}

const emptyStats = (): StatsData => ({
  summary: { totalCount: 0, totalDuration: 0, activeDays: 0 },
  days: [],
  sessions: [],
  accompaniments: []
})

const stats = ref<StatsData>(emptyStats())
const loading = ref(true)
const selectedDate = ref(toDateKey(new Date()))
const heatmapScroller = ref<HTMLElement | null>(null)
const { showToast } = useToast()

const dayMap = computed(() => new Map(stats.value.days.map((day) => [day.date, day])))
const selectedSessions = computed(() => stats.value.sessions.filter((session) => session.date === selectedDate.value))
const selectedDayCount = computed(() => dayMap.value.get(selectedDate.value)?.count || 0)
const calendarCells = computed(() => {
  const today = startOfDay(new Date())
  const first = new Date(today)
  first.setDate(first.getDate() - 370)
  first.setDate(first.getDate() - first.getDay())

  const cells: Array<{ date: string; count: number; level: number }> = []
  for (const cursor = new Date(first); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateKey(cursor)
    const count = dayMap.value.get(date)?.count || 0
    cells.push({ date, count, level: getLevel(count) })
  }
  return cells
})

onMounted(async () => {
  try {
    const response = await $fetch<{ data: StatsData }>('/api/stats', {
      query: {
        days: 371,
        timezoneOffset: new Date().getTimezoneOffset()
      }
    })
    stats.value = response.data
    selectedDate.value = response.data.days.at(-1)?.date || toDateKey(new Date())
    await nextTick()
    if (heatmapScroller.value) {
      heatmapScroller.value.scrollLeft = heatmapScroller.value.scrollWidth
    }
  } catch (error) {
    if (isUnauthorized(error)) {
      showToast('请先登录后查看统计', 'info')
      await navigateTo('/')
    } else {
      showToast('练习统计加载失败', 'error')
    }
  } finally {
    loading.value = false
  }
})

function getLevel(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return `${month}月${day}日`
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value))
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Number(seconds || 0))
  if (safeSeconds < 60) return `${Math.round(safeSeconds)}秒`
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.round((safeSeconds % 3600) / 60)
  if (hours > 0) return `${hours}时${minutes}分`
  return `${minutes}分钟`
}

function isUnauthorized(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && ('statusCode' in error || 'status' in error)
    && ((error as { statusCode?: number; status?: number }).statusCode === 401
      || (error as { statusCode?: number; status?: number }).status === 401)
}
</script>

<style scoped>
.stats-page {
  min-height: 100dvh;
  background: #eef3f8;
}

.stats-shell {
  min-height: 100dvh;
  max-width: 520px;
  margin: 0 auto;
  padding: 14px 14px 32px;
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

.loading-row {
  display: grid;
  min-height: 180px;
  place-items: center;
}

.loading-row span {
  width: 26px;
  height: 26px;
  border: 3px solid #dce5ef;
  border-top-color: #ffc43d;
  border-radius: 999px;
  animation: spin 780ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid #e4eaf1;
  border-bottom: 1px solid #e4eaf1;
}

.summary-strip div {
  display: grid;
  min-width: 0;
  gap: 3px;
  padding: 13px 6px;
  text-align: center;
}

.summary-strip div + div {
  border-left: 1px solid #e4eaf1;
}

.summary-strip strong {
  overflow: hidden;
  color: #172033;
  font-size: 1.05rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-strip span,
.section-heading span {
  color: #718096;
  font-size: 0.74rem;
}

.stats-section {
  padding: 18px 0 4px;
  border-bottom: 1px solid #e4eaf1;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.section-heading h2 {
  margin: 0;
  color: #263244;
  font-size: 0.94rem;
  font-weight: 850;
}

.heatmap-scroll {
  overflow-x: auto;
  padding: 2px 0 8px;
  scrollbar-width: none;
}

.heatmap-scroll::-webkit-scrollbar {
  display: none;
}

.heatmap-grid {
  display: grid;
  width: max-content;
  grid-template-rows: repeat(7, 12px);
  grid-auto-flow: column;
  grid-auto-columns: 12px;
  gap: 3px;
}

.heat-cell {
  width: 12px;
  height: 12px;
  padding: 0;
  border: 1px solid rgba(27, 31, 36, 0.06);
  border-radius: 2px;
}

.heat-cell.selected {
  outline: 2px solid #172033;
  outline-offset: 1px;
}

.level-0 { background: #edf1f5; }
.level-1 { background: #ffe7a3; }
.level-2 { background: #ffc94d; }
.level-3 { background: #f59f00; }
.level-4 { background: #9a5d00; }

.heat-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: #718096;
  font-size: 0.7rem;
}

.heat-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.detail-row,
.ranking-row,
.empty-row {
  min-height: 50px;
  border-top: 1px solid #edf1f5;
}

.detail-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.detail-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 999px;
  color: #374151;
  background: #f1f5f9;
}

.detail-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.detail-copy strong,
.ranking-name {
  overflow: hidden;
  color: #263244;
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-copy small,
.detail-duration,
.ranking-duration {
  color: #718096;
  font-size: 0.74rem;
}

.ranking-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.ranking-index {
  color: #9aa7b7;
  font-size: 0.78rem;
  font-weight: 800;
  text-align: center;
}

.ranking-count {
  color: #172033;
  font-size: 0.8rem;
  font-weight: 800;
}

.empty-row {
  display: flex;
  align-items: center;
  color: #8a97a7;
  font-size: 0.82rem;
}
</style>
