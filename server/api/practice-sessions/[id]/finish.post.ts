export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ duration?: number }>(event)
  const duration = Math.min(24 * 60 * 60, Math.max(0, Number(body.duration || 0)))

  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(duration)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid practice session' })
  }

  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)

  const result = await prisma.practiceSession.updateMany({
    where: { id, userId: user.id },
    data: {
      duration,
      endedAt: new Date()
    }
  })

  if (result.count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Practice session not found' })
  }

  return { success: true }
})
