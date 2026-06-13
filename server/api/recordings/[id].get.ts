export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recording id' })
  }

  const recording = await prisma.recording.findUnique({
    where: { id },
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

  if (!recording) {
    throw createError({ statusCode: 404, statusMessage: 'Recording not found' })
  }

  return {
    success: true,
    data: recording
  }
})
