export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid accompaniment id' })
  }

  const accompaniment = await prisma.accompaniment.findUnique({
    where: { id },
    select: { id: true, userId: true }
  })

  if (!accompaniment || accompaniment.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Accompaniment not found' })
  }

  await prisma.$transaction([
    prisma.recording.updateMany({
      where: { accompanimentId: id, userId: user.id },
      data: { accompanimentId: null }
    }),
    prisma.accompaniment.delete({ where: { id } })
  ])

  return { success: true }
})
