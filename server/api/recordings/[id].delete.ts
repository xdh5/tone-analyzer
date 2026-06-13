export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recording id' })
  }

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: { id: true }
  })

  if (!recording) {
    throw createError({ statusCode: 404, statusMessage: 'Recording not found' })
  }

  await prisma.recording.delete({
    where: { id }
  })

  return {
    success: true
  }
})
