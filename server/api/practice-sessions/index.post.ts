export default defineEventHandler(async (event) => {
  const body = await readBody<{ mode?: string; accompanimentId?: number }>(event)
  const mode = body.mode === 'practice' ? 'practice' : 'record'
  const accompanimentId = Number(body.accompanimentId || 0)

  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)

  const safeAccompanimentId = Number.isInteger(accompanimentId) && accompanimentId > 0
    ? accompanimentId
    : null

  if (mode === 'practice' && !safeAccompanimentId) {
    throw createError({ statusCode: 400, statusMessage: 'Accompaniment is required' })
  }

  if (safeAccompanimentId) {
    const accompaniment = await prisma.accompaniment.findUnique({
      where: { id: safeAccompanimentId },
      select: { userId: true }
    })
    if (!accompaniment || accompaniment.userId !== user.id) {
      throw createError({ statusCode: 404, statusMessage: 'Accompaniment not found' })
    }
  }

  const session = await prisma.practiceSession.create({
    data: {
      mode,
      userId: user.id,
      accompanimentId: safeAccompanimentId
    },
    select: {
      id: true,
      startedAt: true
    }
  })

  return { success: true, data: session }
})
