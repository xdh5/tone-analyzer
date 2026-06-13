import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing GOOGLE_CLIENT_ID'
    })
  }

  const url = getRequestURL(event)
  const redirectUri = `${url.origin}/api/auth/google/callback`
  const state = randomBytes(24).toString('base64url')

  setCookie(event, 'tone_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: 600
  })

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleUrl.searchParams.set('client_id', clientId)
  googleUrl.searchParams.set('redirect_uri', redirectUri)
  googleUrl.searchParams.set('response_type', 'code')
  googleUrl.searchParams.set('scope', 'openid email profile')
  googleUrl.searchParams.set('state', state)
  googleUrl.searchParams.set('prompt', 'select_account')

  return sendRedirect(event, googleUrl.toString())
})
