export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recording id' })
  }

  const body = await readBody<{ name?: string }>(event)
  const name = body.name?.trim()

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Recording name is required' })
  }

  if (name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Recording name is too long' })
  }

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: { id: true, userId: true }
  })

  if (!recording || recording.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Recording not found' })
  }

  const updated = await prisma.recording.update({
    where: { id },
    data: { name },
    select: {
      id: true,
      name: true,
      mimeType: true,
      duration: true,
      size: true,
      accompanimentId: true,
      createdAt: true
    }
  })

  return {
    success: true,
    data: updated
  }
})
