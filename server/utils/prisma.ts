import prismaPackage from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const { PrismaClient } = prismaPackage
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
})

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (import.meta.dev) {
  globalForPrisma.prisma = prisma
}
