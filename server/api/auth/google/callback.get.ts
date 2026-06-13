type GoogleTokenResponse = {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}

type GoogleUserInfo = {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''
  const savedState = getCookie(event, 'tone_oauth_state')

  deleteCookie(event, 'tone_oauth_state', { path: '/' })

  if (!code || !state || !savedState || state !== savedState) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Google login state'
    })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing Google OAuth environment variables'
    })
  }

  const requestUrl = getRequestURL(event)
  const redirectUri = `${requestUrl.origin}/api/auth/google/callback`

  const tokenResponse = await $fetch<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  })

  const profile = await $fetch<GoogleUserInfo>('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`
    }
  })

  if (!profile.sub || !profile.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Google profile is incomplete'
    })
  }

  const { prisma } = await import('~/server/utils/prisma')
  const { createSessionToken, getSessionExpiresAt, hashSessionToken, setSessionCookie } = await import('~/server/utils/auth')

  const user = await prisma.user.upsert({
    where: { googleId: profile.sub },
    create: {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.picture || null
    },
    update: {
      email: profile.email,
      name: profile.name || profile.email,
      avatarUrl: profile.picture || null
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
  return sendRedirect(event, '/tone')
})
