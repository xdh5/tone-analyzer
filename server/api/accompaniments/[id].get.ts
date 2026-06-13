export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid accompaniment id' })
  }

  const accompaniment = await prisma.accompaniment.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      mimeType: true,
      duration: true,
      size: true,
      createdAt: true
    }
  })

  if (!accompaniment) {
    throw createError({ statusCode: 404, statusMessage: 'Accompaniment not found' })
  }

  return {
    success: true,
    data: accompaniment
  }
})
