export default defineEventHandler(async (event) => {
  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)
  const accompaniments = await prisma.accompaniment.findMany({
    where: { userId: user.id },
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
