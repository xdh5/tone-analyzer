<template>
  <section class="tracker-page">
    <header class="tracker-header">
      <NuxtLink class="header-button" :to="analyzerBackTo" aria-label="返回" title="返回">
        <i class="bi bi-chevron-left"></i>
      </NuxtLink>
      <h1>{{ analyzerTitle }}</h1>
      <span aria-hidden="true"></span>
    </header>

    <div ref="trackerShell" class="tracker-shell">
      <div class="pitch-board" :style="{ height: `${boardHeight}px` }" @pointerdown="startTimelinePan">
        <canvas ref="canvasRef" class="pitch-canvas"></canvas>
        <div
          class="playhead"
          :style="{ left: `${playheadX}px` }"
          role="slider"
          aria-label="播放进度"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(totalDuration)"
          :aria-valuenow="Math.round(playbackCursor)"
          @pointerdown.stop="startPlayheadSeek"
        ></div>
        <div class="pitch-axis" aria-label="音高轴">
          <div
            v-for="note in axisNotes"
            :key="note.midi"
            class="axis-row"
            :class="{ c: note.pitchClass === 'C', a: note.pitchClass === 'A' }"
          >
            <span v-if="note.isLabel">{{ note.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="time-bar">
      <span class="time-label">{{ playbackTimeLabel }}</span>
    </div>

    <nav class="bottom-toolbar" aria-label="工具栏">
      <button class="tool-button" type="button" title="清空" aria-label="清空" :disabled="isReadOnlyPlayback" @click="clearTrack">
        <i class="bi bi-trash3"></i>
      </button>
      <button
        class="tool-button"
        type="button"
        :disabled="isReadOnlyPlayback || !recordedAudioUrl"
        :title="isRecordingPlaybackActive ? '暂停回放' : '播放录音'"
        :aria-label="isRecordingPlaybackActive ? '暂停回放' : '播放录音'"
        @click="toggleRecordingPlayback"
      >
        <i :class="isRecordingPlaybackActive ? 'bi bi-pause-fill' : 'bi bi-play-fill'"></i>
      </button>
      <button
        class="tool-button primary"
        type="button"
        :disabled="isAccompanimentEnded"
        :title="primaryButtonTitle"
        :aria-label="primaryButtonTitle"
        @click="handlePrimaryAction"
      >
        <i :class="primaryButtonIcon"></i>
      </button>
      <button
        class="tool-button"
        type="button"
        :disabled="isReadOnlyPlayback || !recordedAudioUrl || isSavingRecording"
        title="保存录音"
        aria-label="保存录音"
        @click="saveRecording"
      >
        <i :class="isSavingRecording ? 'bi bi-hourglass-split' : 'bi bi-save2'"></i>
      </button>
      <button class="tool-button" type="button" title="分享" aria-label="分享" @click="shareTracker">
        <i class="bi bi-share"></i>
      </button>
    </nav>

    <audio
      ref="backingAudioRef"
      :src="backingTrackUrl || undefined"
      preload="auto"
      @loadedmetadata="handleBackingMetadata"
      @ended="handleBackingEnded"
    ></audio>
    <audio
      ref="recordPlaybackRef"
      :src="recordedAudioUrl || undefined"
      preload="auto"
      @timeupdate="handleRecordPlaybackTime"
      @ended="handleRecordPlaybackEnded"
    ></audio>
  </section>
</template>

<script setup lang="ts">
import Pitchfinder from 'pitchfinder'
import { useToast } from '~/composables/useToast'

type PitchPoint = {
  time: number
  midi: number | null
}

type PitchSource = 'YIN' | 'Macleod'

type DetectorResult = {
  frequency: number | null
  source: PitchSource | null
}

type AxisNote = {
  midi: number
  name: string
  pitchClass: string
  isLabel: boolean
}

type AnalyzerMode = 'record' | 'practice' | 'playback'

const props = defineProps<{
  mode: AnalyzerMode
  accompanimentId?: number
  recordingId?: number
}>()

const { showToast } = useToast()

const MIN_MIDI = 24
const MAX_MIDI = 108
const NOTE_COUNT = MAX_MIDI - MIN_MIDI + 1
const DETECT_MIN_MIDI = 36
const DETECT_MAX_MIDI = 84
const ROW_HEIGHT = 22
const AXIS_WIDTH = 92
const PIXELS_PER_SECOND = 92
const BUFFER_SIZE = 2048
const MIN_RMS = 0.0008
const SAMPLE_INTERVAL_MS = 90
const DRAW_INTERVAL_MS = 66
const MAX_CANVAS_RATIO = 1.5
const MAX_MIDI_JUMP = 10
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const recordPlaybackRef = ref<HTMLAudioElement | null>(null)
const backingAudioRef = ref<HTMLAudioElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const trackerShell = ref<HTMLElement | null>(null)

const isRunning = ref(false)
const isRecordingPlaybackActive = ref(false)
const hasVoice = ref(false)
const elapsed = ref(0)
const recordingDuration = ref(0)
const backingDuration = ref(0)
const playbackCursor = ref(0)
const viewportStartTime = ref(0)
const backingTrackUrl = ref<string | null>(null)
const recordedAudioUrl = ref<string | null>(null)
const isSavingRecording = ref(false)
const isAccompanimentEnded = ref(false)

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let yinDetector: ((buffer: Float32Array) => number | null) | null = null
let macleodDetector: ((buffer: Float32Array) => { probability: number; freq: number }) | null = null
let sampleBuffer: Float32Array | null = null
let processedBuffer: Float32Array | null = null
let rafId = 0
let recordPlaybackRafId = 0
let startedAt = 0
let pausedAt = 0
let lastSampledAt = 0
let lastDrawAt = 0
let lastDetectedMidi: number | null = null
let lastFollowedMidi: number | null = null
let scrollTargetTop: number | null = null
let missedPitchFrames = 0
let pitchPoints: PitchPoint[] = []
let recordChunks: Blob[] = []
let recorderMimeType = ''
let isClearingRecording = false
let isFollowingTimelineEnd = true
let canvasResizeObserver: ResizeObserver | null = null
let gridCacheCanvas: HTMLCanvasElement | null = null
let gridCacheWidth = 0
let gridCacheRatio = 0

const boardHeight = NOTE_COUNT * ROW_HEIGHT

const axisNotes = computed<AxisNote[]>(() => {
  const notes: AxisNote[] = []
  for (let midi = MAX_MIDI; midi >= MIN_MIDI; midi -= 1) {
    const name = midiToNoteName(midi)
    const pitchClass = midiToPitchClass(midi)
    notes.push({
      midi,
      name,
      pitchClass,
      isLabel: true
    })
  }
  return notes
})

const totalDuration = computed(() => {
  if (isAccompanimentMode.value) return Math.max(backingDuration.value, recordingDuration.value, elapsed.value)
  return Math.max(recordingDuration.value, elapsed.value)
})
const playbackTimeLabel = computed(() => `${formatTime(playbackCursor.value)}/${formatTime(totalDuration.value)}`)
const recordingId = computed(() => Number(props.recordingId || 0))
const accompanimentId = computed(() => Number(props.accompanimentId || 0))
const isReadOnlyPlayback = computed(() => props.mode === 'playback' && Number.isFinite(recordingId.value) && recordingId.value > 0)
const isAccompanimentMode = computed(() => props.mode === 'practice' && Number.isFinite(accompanimentId.value) && accompanimentId.value > 0)
const analyzerBackTo = computed(() => {
  if (props.mode === 'playback') return '/recordings'
  if (props.mode === 'practice') return '/accompaniments'
  return '/'
})
const analyzerTitle = computed(() => {
  if (props.mode === 'playback') return '录音回放'
  if (props.mode === 'practice') return '伴奏跟唱'
  return '音高分析'
})
const primaryButtonTitle = computed(() => {
  if (isReadOnlyPlayback.value) return isRecordingPlaybackActive.value ? '暂停播放' : '播放录音'
  if (isAccompanimentEnded.value) return '伴奏已结束'
  return isRunning.value ? '暂停录制' : '录制'
})
const primaryButtonIcon = computed(() => {
  if (isReadOnlyPlayback.value) return isRecordingPlaybackActive.value ? 'bi bi-pause-fill' : 'bi bi-play-fill'
  return isRunning.value ? 'bi bi-pause-fill' : 'bi bi-mic-fill'
})
const playheadX = computed(() => {
  return Math.min(getCanvasWidth(), Math.max(0, (playbackCursor.value - viewportStartTime.value) * PIXELS_PER_SECOND))
})

onMounted(async () => {
  try {
    await loadAnalyzerMode()
  } catch (error) {
    if (isUnauthorized(error)) {
      showToast('请先登录后使用账号内容', 'info')
      await navigateTo('/')
    } else {
      showToast('内容加载失败', 'error')
      await navigateTo(analyzerBackTo.value)
    }
    return
  }
  resizeCanvas()
  draw(true)
  requestAnimationFrame(() => {
    scrollToMidi(60, false)
    draw(true)
  })
  if (trackerShell.value) {
    canvasResizeObserver = new ResizeObserver(() => {
      resizeCanvas()
      draw(true)
    })
    canvasResizeObserver.observe(trackerShell.value)
  }
})

onBeforeUnmount(() => {
  pause()
  stopRecordingPlayback()
  stopMicrophone()
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  canvasResizeObserver?.disconnect()
})

async function loadAnalyzerMode() {
  if (isReadOnlyPlayback.value) {
    const response = await $fetch<{ data: { duration: number } }>(`/api/recordings/${recordingId.value}`)
    recordingDuration.value = response.data.duration || 0
    playbackCursor.value = 0
    viewportStartTime.value = 0
    recordedAudioUrl.value = `/api/recordings/${recordingId.value}/audio`
    return
  }

  if (isAccompanimentMode.value) {
    const response = await $fetch<{ data: { duration: number } }>(`/api/accompaniments/${accompanimentId.value}`)
    backingDuration.value = response.data.duration || 0
    backingTrackUrl.value = `/api/accompaniments/${accompanimentId.value}/audio`
  }
}

async function start() {
  if (isReadOnlyPlayback.value) {
    await toggleRecordingPlayback()
    return
  }
  if (isAccompanimentEnded.value) return

  try {
    await ensureMicrophone()
  } catch (error) {
    console.warn(formatMicrophoneError(error))
    return
  }

  if (!audioContext || !analyser || !sampleBuffer) return

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  stopRecordingPlayback()
  resumeClock()
  isRunning.value = true
  isFollowingTimelineEnd = true
  followTimelineEnd()
  startRecordingSegment()
  await startBackingTrack()

  startAnalysisLoop()
}

function togglePlayback() {
  if (isRunning.value) {
    pause()
    return
  }

  start()
}

function handlePrimaryAction() {
  if (isReadOnlyPlayback.value) {
    toggleRecordingPlayback()
    return
  }

  togglePlayback()
}

function pause() {
  if (!isRunning.value) return
  isRunning.value = false
  pausedAt = elapsed.value
  hasVoice.value = false
  recordingDuration.value = Math.max(recordingDuration.value, elapsed.value)
  playbackCursor.value = recordingDuration.value
  followTimelineEnd()
  pauseRecordingSegment()
  backingAudioRef.value?.pause()
  cancelAnimationFrame(rafId)
  rafId = 0
  draw()
}

function clearTrack() {
  pitchPoints = []
  hasVoice.value = false
  elapsed.value = 0
  recordingDuration.value = 0
  playbackCursor.value = 0
  viewportStartTime.value = 0
  isFollowingTimelineEnd = true
  pausedAt = 0
  startedAt = 0
  lastDetectedMidi = null
  lastFollowedMidi = null
  scrollTargetTop = null
  missedPitchFrames = 0
  isClearingRecording = true
  stopRecordingSegment()
  if (!mediaRecorder) isClearingRecording = false
  stopRecordingPlayback()
  recordChunks = []
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  recordedAudioUrl.value = null
  isAccompanimentEnded.value = false
  if (backingAudioRef.value) {
    backingAudioRef.value.pause()
    backingAudioRef.value.currentTime = 0
  }
  draw(true)
  scrollToMidi(60, true)
}

async function startBackingTrack() {
  const audio = backingAudioRef.value
  if (!audio || !isAccompanimentMode.value) return

  audio.currentTime = Math.min(elapsed.value, Math.max(0, (backingDuration.value || audio.duration || 0) - 0.05))
  await audio.play().catch(() => {})
}

function handleBackingMetadata() {
  const duration = backingAudioRef.value?.duration
  if (duration && Number.isFinite(duration)) {
    backingDuration.value = duration
  }
}

function handleBackingEnded() {
  if (!isAccompanimentMode.value) return

  isAccompanimentEnded.value = true
  if (isRunning.value) {
    isRunning.value = false
    elapsed.value = backingDuration.value || elapsed.value
    recordingDuration.value = Math.max(recordingDuration.value, elapsed.value)
    playbackCursor.value = recordingDuration.value
    followTimelineEnd()
    pauseRecordingSegment()
    cancelAnimationFrame(rafId)
    rafId = 0
    draw()
  }
}

function startRecordingSegment() {
  if (!mediaStream || typeof MediaRecorder === 'undefined') return
  isClearingRecording = false
  if (mediaRecorder?.state === 'recording') return
  if (mediaRecorder?.state === 'paused') {
    mediaRecorder.resume()
    return
  }

  recorderMimeType ||= getRecorderMimeType()
  mediaRecorder = new MediaRecorder(mediaStream, recorderMimeType ? { mimeType: recorderMimeType } : undefined)
  mediaRecorder.ondataavailable = (event) => {
    if (isClearingRecording) return
    if (event.data.size > 0) {
      recordChunks.push(event.data)
      refreshRecordedAudio()
    }
  }
  mediaRecorder.onstop = () => {
    refreshRecordedAudio()
    mediaRecorder = null
    isClearingRecording = false
  }
  mediaRecorder.start()
}

function pauseRecordingSegment() {
  if (mediaRecorder?.state !== 'recording') return
  mediaRecorder.requestData()
  mediaRecorder.pause()
}

function stopRecordingSegment() {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.requestData()
    mediaRecorder.stop()
    return
  }
  if (mediaRecorder?.state === 'paused') {
    mediaRecorder.stop()
  }
}

function refreshRecordedAudio() {
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  if (recordChunks.length === 0) {
    recordedAudioUrl.value = null
    return
  }

  const type = recorderMimeType || recordChunks[0]?.type || 'audio/webm'
  recordedAudioUrl.value = URL.createObjectURL(getRecordedBlob(type))
}

async function saveRecording() {
  if (recordChunks.length === 0 || isSavingRecording.value) return

  pause()
  stopRecordingPlayback()
  isSavingRecording.value = true

  try {
    const blob = getRecordedBlob()
    const formData = new FormData()
    formData.append('name', formatRecordingName(new Date()))
    formData.append('duration', String(recordingDuration.value))
    formData.append('mimeType', blob.type || 'audio/webm')
    if (isAccompanimentMode.value) formData.append('accompanimentId', String(accompanimentId.value))
    formData.append('audio', blob, 'recording.webm')
    await $fetch('/api/recordings', {
      method: 'POST',
      body: formData
    })
    showToast('录音已保存', 'success')
  } catch (error) {
    if (isUnauthorized(error)) {
      showToast('请先登录后保存录音', 'info')
      await navigateTo('/')
    } else {
      showToast('录音保存失败', 'error')
    }
  } finally {
    isSavingRecording.value = false
  }
}

function getRecordedBlob(type = recorderMimeType || recordChunks[0]?.type || 'audio/webm') {
  return new Blob(recordChunks, { type })
}

async function toggleRecordingPlayback() {
  if (!recordedAudioUrl.value || !recordPlaybackRef.value) return

  if (isRecordingPlaybackActive.value) {
    recordPlaybackRef.value.pause()
    isRecordingPlaybackActive.value = false
    stopPlaybackCursorLoop()
    return
  }

  pause()
  const startAt = playbackCursor.value >= recordingDuration.value - 0.05 ? 0 : playbackCursor.value
  recordPlaybackRef.value.currentTime = startAt
  await recordPlaybackRef.value.play().then(() => {
    isRecordingPlaybackActive.value = true
    startPlaybackCursorLoop()
  }).catch(() => {
    isRecordingPlaybackActive.value = false
  })
}

function stopRecordingPlayback() {
  const audio = recordPlaybackRef.value
  if (audio) audio.pause()
  isRecordingPlaybackActive.value = false
  stopPlaybackCursorLoop()
}

function handleRecordPlaybackTime() {
  const audio = recordPlaybackRef.value
  if (!audio || isRunning.value || !isRecordingPlaybackActive.value) return
  playbackCursor.value = Math.min(audio.currentTime, recordingDuration.value)
  keepCursorInTimelineView()
  draw()
}

function handleRecordPlaybackEnded() {
  isRecordingPlaybackActive.value = false
  stopPlaybackCursorLoop()
  playbackCursor.value = recordingDuration.value
}

function startPlaybackCursorLoop() {
  if (recordPlaybackRafId) return
  const sync = () => {
    handleRecordPlaybackTime()
    recordPlaybackRafId = isRecordingPlaybackActive.value ? requestAnimationFrame(sync) : 0
  }
  recordPlaybackRafId = requestAnimationFrame(sync)
}

function stopPlaybackCursorLoop() {
  cancelAnimationFrame(recordPlaybackRafId)
  recordPlaybackRafId = 0
}

function startPlayheadSeek(event: PointerEvent) {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  stopRecordingPlayback()
  seekPlayhead(event)
  target.addEventListener('pointermove', seekPlayhead)
  target.addEventListener('pointerup', stopPlayheadSeek, { once: true })
  target.addEventListener('pointercancel', stopPlayheadSeek, { once: true })
}

function stopPlayheadSeek(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  target.releasePointerCapture(event.pointerId)
  target.removeEventListener('pointermove', seekPlayhead)
}

function seekPlayhead(event: PointerEvent) {
  const shell = trackerShell.value
  if (!shell) return

  const rect = shell.getBoundingClientRect()
  const width = getCanvasWidth()
  const x = Math.min(width, Math.max(0, event.clientX - rect.left))
  const value = Math.min(totalDuration.value, Math.max(0, viewportStartTime.value + x / PIXELS_PER_SECOND))
  playbackCursor.value = Number.isFinite(value) ? value : 0
  if (recordPlaybackRef.value) {
    recordPlaybackRef.value.currentTime = playbackCursor.value
  }
  draw()
}

function startTimelinePan(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('.playhead, .pitch-axis')) return

  const target = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startViewport = viewportStartTime.value
  isFollowingTimelineEnd = false
  target.setPointerCapture(event.pointerId)

  const move = (moveEvent: PointerEvent) => {
    const deltaSeconds = (startX - moveEvent.clientX) / PIXELS_PER_SECOND
    viewportStartTime.value = clampViewportStart(startViewport + deltaSeconds)
    draw()
  }

  const stop = (stopEvent: PointerEvent) => {
    target.releasePointerCapture(stopEvent.pointerId)
    target.removeEventListener('pointermove', move)
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', stop, { once: true })
  target.addEventListener('pointercancel', stop, { once: true })
}

function getRecorderMimeType() {
  const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

async function shareTracker() {
  const shareData = {
    title: '实时音高追踪器',
    text: '打开实时音高追踪器',
    url: window.location.href
  }

  if (navigator.share) {
    await navigator.share(shareData).catch(() => {})
    return
  }

  await navigator.clipboard?.writeText(window.location.href).catch(() => {})
}

async function ensureMicrophone() {
  if (audioContext && analyser && sampleBuffer && processedBuffer) return

  if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风采集。请使用 Chrome 或 Edge 打开本地页面。')
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })

  audioContext = new AudioContext()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = BUFFER_SIZE
  analyser.smoothingTimeConstant = 0

  const source = audioContext.createMediaStreamSource(mediaStream)
  source.connect(analyser)

  yinDetector = Pitchfinder.YIN({
    sampleRate: audioContext.sampleRate,
    threshold: 0.18,
    probabilityThreshold: 0.02
  })
  macleodDetector = Pitchfinder.Macleod({
    sampleRate: audioContext.sampleRate,
    bufferSize: BUFFER_SIZE,
    cutoff: 0.82
  })

  sampleBuffer = new Float32Array(BUFFER_SIZE)
  processedBuffer = new Float32Array(BUFFER_SIZE)
}

function stopMicrophone() {
  stopRecordingSegment()
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  audioContext?.close()
  audioContext = null
  analyser = null
  yinDetector = null
  macleodDetector = null
  sampleBuffer = null
  processedBuffer = null
}

function tick() {
  if (!isRunning.value || !analyser || !sampleBuffer || !processedBuffer) {
    rafId = 0
    return
  }

  const now = performance.now()
  elapsed.value = Math.max(0, (now - startedAt) / 1000)
  recordingDuration.value = Math.max(recordingDuration.value, elapsed.value)
  playbackCursor.value = elapsed.value
  if (isFollowingTimelineEnd) followTimelineEnd()

  if (now - lastSampledAt >= SAMPLE_INTERVAL_MS) {
    lastSampledAt = now
    analyser.getFloatTimeDomainData(sampleBuffer)
    prepareAudioBuffer(sampleBuffer, processedBuffer)

    const rms = getRms(processedBuffer)
    const result = detectPitch(processedBuffer, rms)
    addPitchSample(result.frequency)
  }

  updatePitchScroll()

  if (now - lastDrawAt >= DRAW_INTERVAL_MS) {
    lastDrawAt = now
    draw()
  }

  rafId = requestAnimationFrame(tick)
}

function startAnalysisLoop() {
  if (rafId) return
  tick()
}

function addPitchSample(frequency: number | null) {
  const midi = frequency ? frequencyToMidi(frequency) : null
  const isValid = Boolean(frequency && midi !== null && midi >= DETECT_MIN_MIDI && midi <= DETECT_MAX_MIDI)

  if (!isValid || midi === null || frequency === null) {
    missedPitchFrames += 1
    hasVoice.value = false
    if (missedPitchFrames >= 4) {
      lastDetectedMidi = null
      pushPitchPoint({ time: elapsed.value, midi: null })
    }
    return
  }

  if (lastDetectedMidi !== null && Math.abs(midi - lastDetectedMidi) > MAX_MIDI_JUMP) {
    missedPitchFrames += 1
    return
  }

  missedPitchFrames = 0
  const smoothedMidi = lastDetectedMidi === null ? midi : lastDetectedMidi * 0.78 + midi * 0.22
  lastDetectedMidi = smoothedMidi
  hasVoice.value = true
  pushPitchPoint({ time: elapsed.value, midi: smoothedMidi })
  followPitch(smoothedMidi)
}

function followPitch(midi: number) {
  if (lastFollowedMidi !== null && Math.abs(midi - lastFollowedMidi) < 0.35) return
  lastFollowedMidi = midi
  scrollTargetTop = getScrollTopForMidi(midi)
}

function detectPitch(buffer: Float32Array, rms: number): DetectorResult {
  if (rms < MIN_RMS) {
    return { frequency: null, source: null }
  }

  const yinFrequency = yinDetector?.(buffer) || null
  if (isValidFrequency(yinFrequency)) {
    return { frequency: yinFrequency, source: 'YIN' }
  }

  const macleod = macleodDetector?.(buffer)
  if (macleod?.freq && macleod.probability >= 0.55 && isValidFrequency(macleod.freq)) {
    return { frequency: macleod.freq, source: 'Macleod' }
  }

  return { frequency: null, source: null }
}

function isValidFrequency(frequency: number | null | undefined, midi = frequency ? frequencyToMidi(frequency) : Number.NaN) {
  if (!frequency || !Number.isFinite(frequency)) return false
  return midi >= DETECT_MIN_MIDI && midi <= DETECT_MAX_MIDI
}

function prepareAudioBuffer(source: Float32Array, target: Float32Array) {
  let mean = 0
  for (const sample of source) mean += sample
  mean /= source.length

  for (let index = 0; index < source.length; index += 1) {
    const centered = source[index] - mean
    target[index] = Math.abs(centered) < 0.002 ? centered * 0.35 : centered
  }
}

function pushPitchPoint(point: PitchPoint) {
  pitchPoints.push(point)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const cssWidth = getCanvasWidth()
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_RATIO)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${boardHeight}px`
  canvas.width = Math.floor(cssWidth * ratio)
  canvas.height = Math.floor(boardHeight * ratio)

  const ctx = canvas.getContext('2d', { alpha: false })
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  buildGridCache(cssWidth, ratio)
}

function draw(full = false) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d', { alpha: false })
  if (!canvas || !ctx) return

  const width = getCanvasWidth()
  const ratio = gridCacheRatio || Math.min(window.devicePixelRatio || 1, MAX_CANVAS_RATIO)
  const { top, height, bottom } = getDrawBounds(full)
  ctx.clearRect(0, top, width, height)
  if (gridCacheCanvas) {
    ctx.drawImage(
      gridCacheCanvas,
      0,
      top * ratio,
      width * ratio,
      height * ratio,
      0,
      top,
      width,
      height
    )
  } else {
    drawGrid(ctx, width, top, bottom)
  }
  drawPitchCurve(ctx, width, top, bottom)
}

function buildGridCache(width: number, ratio: number) {
  if (gridCacheCanvas && gridCacheWidth === width && gridCacheRatio === ratio) return

  gridCacheWidth = width
  gridCacheRatio = ratio
  gridCacheCanvas = document.createElement('canvas')
  gridCacheCanvas.width = Math.floor(width * ratio)
  gridCacheCanvas.height = Math.floor(boardHeight * ratio)

  const ctx = gridCacheCanvas.getContext('2d', { alpha: false })
  if (!ctx) return

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  drawGrid(ctx, width)
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, top = 0, bottom = boardHeight) {
  const firstRow = Math.max(0, Math.floor(top / ROW_HEIGHT))
  const lastRow = Math.min(NOTE_COUNT - 1, Math.ceil(bottom / ROW_HEIGHT))
  for (let index = firstRow; index <= lastRow; index += 1) {
    const y = index * ROW_HEIGHT
    const midi = MAX_MIDI - index
    const pitchClass = midiToPitchClass(midi)
    ctx.fillStyle = pitchClass.includes('#') ? '#fff8e7' : '#ffffff'
    ctx.fillRect(0, y, width, ROW_HEIGHT)
    ctx.strokeStyle = pitchClass === 'C' ? '#cbd7e8' : '#ecf0f5'
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
    ctx.stroke()
  }
}

function drawPitchCurve(ctx: CanvasRenderingContext2D, width: number, top: number, bottom: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, top, width, bottom - top)
  ctx.clip()
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#f59f00'

  let hasSegment = false
  let previousX = 0
  let previousY = 0
  let lastX = 0
  let lastY = 0
  let segmentPointCount = 0
  const startSegment = (x: number, y: number) => {
    ctx.beginPath()
    ctx.moveTo(x, y)
    previousX = x
    previousY = y
    lastX = x
    lastY = y
    segmentPointCount = 1
    hasSegment = true
  }

  const finishSegment = () => {
    if (!hasSegment) return
    if (segmentPointCount > 1) {
      ctx.lineTo(lastX, lastY)
      ctx.stroke()
    }
    hasSegment = false
    segmentPointCount = 0
  }

  for (const point of pitchPoints) {
    const x = (point.time - viewportStartTime.value) * PIXELS_PER_SECOND
    if (x < -8) continue
    if (x > width + 8) break

    if (point.midi === null) {
      finishSegment()
      continue
    }

    const y = midiToY(point.midi)
    if (!hasSegment) {
      startSegment(x, y)
      continue
    }

    ctx.quadraticCurveTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2)
    previousX = x
    previousY = y
    lastX = x
    lastY = y
    segmentPointCount += 1
  }
  finishSegment()
  ctx.restore()
}

function getDrawBounds(full: boolean) {
  if (full) {
    return { top: 0, height: boardHeight, bottom: boardHeight }
  }

  const shell = trackerShell.value
  const padding = ROW_HEIGHT * 3
  const top = Math.max(0, (shell?.scrollTop || 0) - padding)
  const bottom = Math.min(boardHeight, top + (shell?.clientHeight || boardHeight) + padding * 2)
  return { top, height: bottom - top, bottom }
}

function getCanvasWidth() {
  const shellWidth = trackerShell.value?.clientWidth || 900
  return Math.max(320, shellWidth - AXIS_WIDTH)
}

function getTimelineWindowSeconds() {
  return getCanvasWidth() / PIXELS_PER_SECOND
}

function clampViewportStart(value: number) {
  const maxStart = Math.max(0, totalDuration.value - getTimelineWindowSeconds())
  return Math.min(maxStart, Math.max(0, value))
}

function followTimelineEnd() {
  const activeEndTime = Math.max(playbackCursor.value, elapsed.value, recordingDuration.value)
  viewportStartTime.value = clampViewportStart(activeEndTime - getTimelineWindowSeconds())
}

function keepCursorInTimelineView() {
  const windowSeconds = getTimelineWindowSeconds()
  if (playbackCursor.value < viewportStartTime.value) {
    viewportStartTime.value = clampViewportStart(playbackCursor.value)
    return
  }
  if (playbackCursor.value > viewportStartTime.value + windowSeconds) {
    viewportStartTime.value = clampViewportStart(playbackCursor.value - windowSeconds)
  }
}

function midiToY(midi: number) {
  return (MAX_MIDI - midi + 0.5) * ROW_HEIGHT
}

function scrollToMidi(midi: number, smooth: boolean) {
  const shell = trackerShell.value
  if (!shell) return

  const target = getScrollTopForMidi(midi)
  shell.scrollTo({
    top: target,
    behavior: smooth ? 'smooth' : 'auto'
  })
}

function updatePitchScroll() {
  const shell = trackerShell.value
  if (!shell || scrollTargetTop === null) return

  const distance = scrollTargetTop - shell.scrollTop
  if (Math.abs(distance) < 0.5) {
    shell.scrollTop = scrollTargetTop
    scrollTargetTop = null
    return
  }

  shell.scrollTop += distance * 0.16
}

function getScrollTopForMidi(midi: number) {
  const shell = trackerShell.value
  if (!shell) return 0

  const toolbarReserve = 82
  const target = midiToY(midi) - (shell.clientHeight - toolbarReserve) / 2
  const maxScroll = Math.max(0, shell.scrollHeight - shell.clientHeight)
  return Math.min(maxScroll, Math.max(0, target))
}

function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440)
}

function midiToNoteName(midi: number) {
  const rounded = Math.round(midi)
  const octave = Math.floor(rounded / 12) - 1
  return `${midiToPitchClass(rounded)}${octave}`
}

function midiToPitchClass(midi: number) {
  return noteNames[((Math.round(midi) % 12) + 12) % 12]
}

function getRms(buffer: Float32Array) {
  let sum = 0
  for (const sample of buffer) sum += sample * sample
  return Math.sqrt(sum / buffer.length)
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatRecordingName(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function resumeClock() {
  if (!startedAt) {
    startedAt = performance.now() - pausedAt * 1000
    return
  }

  startedAt = performance.now() - elapsed.value * 1000
}

function formatMicrophoneError(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '没有找到可用麦克风，请确认系统输入设备已启用。'
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '麦克风权限被拒绝，请在浏览器权限设置中允许此页面使用麦克风。'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '麦克风当前无法读取，可能被其他应用占用。'
  }
  return error instanceof Error ? error.message : '无法访问麦克风，请检查浏览器权限。'
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
.tracker-page {
  position: relative;
  --header-height: 54px;
  --toolbar-height: calc(58px + env(safe-area-inset-bottom));
  --timebar-height: 22px;
  width: 100vw;
  height: 100dvh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #fff;
}

.tracker-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 21;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  height: var(--header-height);
  gap: 8px;
  padding: 7px 14px;
  border-bottom: 1px solid #dde5ef;
  background: #fff;
  box-sizing: border-box;
}

.tracker-header h1 {
  margin: 0;
  color: #162033;
  font-size: 1.05rem;
  font-weight: 850;
  text-align: center;
}

.header-button {
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

.bottom-toolbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  height: var(--toolbar-height);
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 6px 14px calc(6px + env(safe-area-inset-bottom));
  border: 0;
  border-top: 1px solid #dde5ef;
  background: #fff;
  box-shadow: 0 -10px 28px rgba(15, 23, 42, 0.12);
  box-sizing: border-box;
}

.time-bar {
  position: fixed;
  right: 0;
  bottom: var(--toolbar-height);
  left: 0;
  z-index: 19;
  height: var(--timebar-height);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  background: #5f6670;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  box-sizing: border-box;
}

.time-label {
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.tool-button {
  display: grid;
  place-items: center;
  height: 36px;
  width: 36px;
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  background: #fff;
  color: #3d4856;
  font-size: 1rem;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.tool-button:hover {
  border-color: #9fb2cc;
  background: #f4f7fb;
}

.tool-button.primary {
  border-color: #ffc43d;
  background: #ffc43d;
  color: #172033;
  font-size: 1.18rem;
}

.tool-button:disabled {
  opacity: 0.42;
}

.tracker-shell {
  width: 100%;
  height: calc(100% - var(--header-height) - var(--toolbar-height) - var(--timebar-height));
  margin-top: var(--header-height);
  overflow-x: hidden;
  overflow-y: auto;
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.tracker-shell::-webkit-scrollbar {
  display: none;
}

.pitch-board {
  position: relative;
  display: flex;
  overflow: hidden;
  background: #fff;
  cursor: grab;
  touch-action: pan-y;
}

.pitch-canvas {
  display: block;
  flex: 1 1 auto;
  height: 100%;
}

.playhead {
  position: absolute;
  top: 0;
  z-index: 8;
  width: 28px;
  height: 100%;
  cursor: ew-resize;
  touch-action: none;
  transform: translateX(-50%);
}

.playhead::after {
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 100%;
  background: #ff8a00;
  box-shadow: 0 0 0 1px rgba(255, 138, 0, 0.12);
  content: "";
  transform: translateX(-50%);
}

.playhead::before {
  position: absolute;
  top: -1px;
  left: 50%;
  z-index: 1;
  width: 0;
  height: 0;
  border-right: 7px solid transparent;
  border-left: 7px solid transparent;
  border-top: 11px solid #ff8a00;
  content: "";
  transform: translateX(-50%);
}

.pitch-axis {
  flex: 0 0 92px;
  width: 92px;
  border-left: 1px solid #b7d9e6;
  background: #d5eff7;
  cursor: default;
}

.axis-row {
  position: relative;
  display: flex;
  align-items: center;
  height: 22px;
  padding-left: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.48);
  color: #4b5b68;
  font-size: 0.76rem;
  font-weight: 700;
}

.axis-row.c {
  background: rgba(126, 163, 255, 0.24);
}

.axis-row.a {
  background: rgba(88, 230, 151, 0.22);
}

.axis-row span {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

@media (max-width: 720px) {
  .tracker-page {
    width: 100vw;
  }

  .bottom-toolbar {
    gap: 12px;
  }

}
</style>
