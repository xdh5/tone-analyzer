export default defineEventHandler(async () => {
  const { prisma } = await import('~/server/utils/prisma')
  const accompaniments = await prisma.accompaniment.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      mimeType: true,
      duration: true,
      size: true,
      createdAt: true
    }
  })

  return {
    success: true,
    data: accompaniments
  }
})
