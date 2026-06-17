export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const { prisma } = await import('~/server/utils/prisma')
  const {
    createSessionToken,
    getSessionExpiresAt,
    hashPassword,
    hashSessionToken,
    normalizeUsername,
    setSessionCookie
  } = await import('~/server/utils/auth')

  const username = normalizeUsername(body.username || '')
  const password = body.password || ''

  if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username must be 3-24 letters, numbers, underscores, or dashes'
    })
  }

  if (password.length < 6 || password.length > 64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be 6-64 characters'
    })
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true }
  })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Username already exists' })
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      name: username
    },
    select: {
      id: true
    }
  })

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
