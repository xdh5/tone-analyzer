export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const { prisma } = await import('~/server/utils/prisma')
  const {
    createSessionToken,
    ensureBuiltinUsers,
    getSessionExpiresAt,
    hashSessionToken,
    normalizeUsername,
    setSessionCookie,
    verifyPassword
  } = await import('~/server/utils/auth')

  const username = normalizeUsername(body.username || '')
  const password = body.password || ''

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Username and password are required' })
  }

  await ensureBuiltinUsers()

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      passwordHash: true
    }
  })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }

  const token = createSessionToken()
  await prisma.authSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: getSessionExpiresAt()
    }
  })

  setSessionCookie(event, token)

  return {
    success: true
  }
})
