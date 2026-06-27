type DaySummary = {
  date: string
  count: number
  duration: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const days = Math.min(371, Math.max(28, Number(query.days || 371)))
  const timezoneOffset = Math.min(840, Math.max(-840, Number(query.timezoneOffset || 0)))
  const from = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000)

  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)

  const sessions = await prisma.practiceSession.findMany({
    where: {
      userId: user.id,
      startedAt: { gte: from }
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      mode: true,
      duration: true,
      startedAt: true,
      accompaniment: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  const dayMap = new Map<string, DaySummary>()
  const accompanimentMap = new Map<number, {
    id: number
    name: string
    count: number
    duration: number
  }>()

  const data = sessions.map((session) => {
    const date = toLocalDateKey(session.startedAt, timezoneOffset)
    const day = dayMap.get(date) || { date, count: 0, duration: 0 }
    day.count += 1
    day.duration += session.duration
    dayMap.set(date, day)

    if (session.accompaniment) {
      const item = accompanimentMap.get(session.accompaniment.id) || {
        id: session.accompaniment.id,
        name: session.accompaniment.name,
        count: 0,
        duration: 0
      }
      item.count += 1
      item.duration += session.duration
      accompanimentMap.set(item.id, item)
    }

    return {
      id: session.id,
      date,
      mode: session.mode,
      duration: session.duration,
      startedAt: session.startedAt,
      accompaniment: session.accompaniment
    }
  })

  const activeDays = dayMap.size
  const totalDuration = data.reduce((total, session) => total + session.duration, 0)

  return {
    success: true,
    data: {
      summary: {
        totalCount: data.length,
        totalDuration,
        activeDays
      },
      days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      sessions: data,
      accompaniments: [...accompanimentMap.values()].sort((a, b) => b.count - a.count || b.duration - a.duration)
    }
  }
})

function toLocalDateKey(date: Date, timezoneOffset: number) {
  return new Date(date.getTime() - timezoneOffset * 60 * 1000).toISOString().slice(0, 10)
}
