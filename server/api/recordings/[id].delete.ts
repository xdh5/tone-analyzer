export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recording id' })
  }

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: { id: true, userId: true }
  })

  if (!recording || recording.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Recording not found' })
  }

  await prisma.recording.delete({
    where: { id }
  })

  return {
    success: true
  }
})
