export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'tone_session')
  if (token) {
    const { prisma } = await import('~/server/utils/prisma')
    const { clearSessionCookie, hashSessionToken } = await import('~/server/utils/auth')
    await prisma.authSession.deleteMany({
      where: {
        tokenHash: hashSessionToken(token)
      }
    })
    clearSessionCookie(event)
  }

  return {
    success: true
  }
})
