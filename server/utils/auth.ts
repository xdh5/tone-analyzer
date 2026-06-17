import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const sessionCookieName = 'tone_session'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

export type CurrentUser = {
  id: number
  username: string
  name: string
}

const builtinUsers = [
  { username: 'admin', password: '111111' },
  { username: 'wangcai', password: '666888' }
]

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url')
  const hash = scryptSync(password, salt, 64).toString('base64url')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false

  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false

  const expected = Buffer.from(hash, 'base64url')
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function ensureBuiltinUsers() {
  const { prisma } = await import('~/server/utils/prisma')
  for (const user of builtinUsers) {
    const username = normalizeUsername(user.username)
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    })
    if (existing) continue

    await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(user.password),
        name: username
      }
    })
  }
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
          username: true,
          name: true
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

export async function requireCurrentUser(event: H3Event): Promise<CurrentUser> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login required'
    })
  }
  return user
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000)
}
