export default defineEventHandler(async (event) => {
  const { getCurrentUser } = await import('~/server/utils/auth')
  const user = await getCurrentUser(event)

  return {
    success: true,
    data: user
  }
})
