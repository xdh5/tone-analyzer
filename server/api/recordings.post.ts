export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing recording form data'
    })
  }

  const name = getField(formData, 'name') || new Date().toISOString()
  const mimeType = getField(formData, 'mimeType') || 'audio/webm'
  const duration = Number(getField(formData, 'duration') || 0)
  const accompanimentId = Number(getField(formData, 'accompanimentId') || 0)
  const audioPart = formData.find((part) => part.name === 'audio')

  if (!audioPart?.data?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing recording audio'
    })
  }

  const safeAccompanimentId = Number.isFinite(accompanimentId) && accompanimentId > 0 ? accompanimentId : null
  if (safeAccompanimentId) {
    const accompaniment = await prisma.accompaniment.findUnique({
      where: { id: safeAccompanimentId },
      select: { id: true, userId: true }
    })
    if (!accompaniment || accompaniment.userId !== user.id) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Accompaniment not found'
      })
    }
  }

  const recording = await prisma.recording.create({
    data: {
      name,
      mimeType,
      duration: Number.isFinite(duration) ? duration : 0,
      audio: audioPart.data,
      size: audioPart.data.length,
      userId: user.id,
      accompanimentId: safeAccompanimentId
    },
    select: {
      id: true,
      name: true,
      duration: true,
      size: true,
      createdAt: true
    }
  })

  return {
    success: true,
    data: recording
  }
})

function getField(formData: NonNullable<Awaited<ReturnType<typeof readMultipartFormData>>>, name: string) {
  const field = formData.find((part) => part.name === name)
  return field?.data?.toString('utf8')
}
