import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

const sessionCookieName = 'tone_session'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

export type CurrentUser = {
  id: number
  email: string
  name: string
  avatarUrl: string | null
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: sessionMaxAgeSeconds
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, sessionCookieName, {
    path: '/'
  })
}

export async function getCurrentUser(event: H3Event): Promise<CurrentUser | null> {
  const token = getCookie(event, sessionCookieName)
  if (!token) return null

  const { prisma } = await import('~/server/utils/prisma')
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true
        }
      }
    }
  })

  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {})
    clearSessionCookie(event)
    return null
  }

  return session.user
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000)
}
