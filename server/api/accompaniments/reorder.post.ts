export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: unknown }>(event)
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : []

  if (ids.length === 0 || ids.length !== new Set(ids).size) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid accompaniment order' })
  }

  const { prisma } = await import('~/server/utils/prisma')
  const { requireCurrentUser } = await import('~/server/utils/auth')
  const user = await requireCurrentUser(event)

  const ownedItems = await prisma.accompaniment.findMany({
    where: {
      userId: user.id,
      id: { in: ids }
    },
    select: { id: true }
  })

  if (ownedItems.length !== ids.length) {
    throw createError({ statusCode: 403, statusMessage: 'Cannot reorder these accompaniments' })
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.accompaniment.update({
      where: { id },
      data: { sortOrder: index }
    }))
  )

  return {
    success: true
  }
})
