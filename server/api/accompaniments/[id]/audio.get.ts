export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid accompaniment id' })
  }

  const accompaniment = await prisma.accompaniment.findUnique({
    where: { id },
    select: {
      audio: true,
      mimeType: true
    }
  })

  if (!accompaniment) {
    throw createError({ statusCode: 404, statusMessage: 'Accompaniment not found' })
  }

  setHeader(event, 'Content-Type', accompaniment.mimeType)
  setHeader(event, 'Cache-Control', 'no-store')
  return accompaniment.audio
})
