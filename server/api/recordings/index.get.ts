export default defineEventHandler(async () => {
  const { prisma } = await import('~/server/utils/prisma')
  const recordings = await prisma.recording.findMany({
    orderBy: { createdAt: 'desc' },
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
    data: recordings
  }
})
