import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { Database } from '../types/database'

export type DB = Kysely<Database>

let dbInstance: Kysely<Database> | null = null

export async function getDatabase(): Promise<Kysely<Database>> {
  if (dbInstance) {
    return dbInstance
  }

  // Check if PostgreSQL URL is provided, otherwise use SQLite if database file exists
  const useSQLite = !process.env.POSTGRES_URL || process.env.POSTGRES_URL.trim() === ''
  const dbFileExists = require('fs').existsSync('./nweb-analyst.db')
  console.log('🔍 Database check:', { useSQLite, dbFileExists, cwd: process.cwd(), files: require('fs').readdirSync('.') })

  if (useSQLite && dbFileExists) {
    console.log('🗄️  Using SQLite database with existing data')
    try {
      // Dynamic import for better-sqlite3 (Node.js only)
      const DatabaseConstructor = require('better-sqlite3')
      const { SqliteDialect } = require('kysely')

      const dialect = new SqliteDialect({
        database: new DatabaseConstructor('./nweb-analyst.db'),
      })

      dbInstance = new Kysely<Database>({
        dialect,
      })
    } catch (error) {
      console.error('❌ Failed to initialize SQLite:', error)
      console.log('🔄 Falling back to mock database')
      // Fallback to mock database if SQLite fails
      const createMockQuery = () => ({
        select: () => createMockQuery(),
        selectAll: () => createMockQuery(),
        from: () => createMockQuery(),
        where: () => createMockQuery(),
        groupBy: () => createMockQuery(),
        orderBy: () => createMockQuery(),
        limit: () => createMockQuery(),
        offset: () => createMockQuery(),
        execute: async () => [],
        executeTakeFirst: async () => null,
        as: () => createMockQuery()
      })

      const mockDb = {
        selectFrom: () => createMockQuery()
      } as any

      Object.assign(mockDb, { sql })
      dbInstance = mockDb
    }
  } else if (useSQLite && !dbFileExists) {
    console.log('🔄 Using fallback mode - no database file found')
    // No database file exists, use mock database
    const createMockQuery = () => ({
      select: () => createMockQuery(),
      selectAll: () => createMockQuery(),
      from: () => createMockQuery(),
      where: () => createMockQuery(),
      groupBy: () => createMockQuery(),
      orderBy: () => createMockQuery(),
      limit: () => createMockQuery(),
      offset: () => createMockQuery(),
      execute: async () => [],
      executeTakeFirst: async () => null,
      as: () => createMockQuery()
    })

    const mockDb = {
      selectFrom: () => createMockQuery()
    } as any

    Object.assign(mockDb, { sql })
    dbInstance = mockDb
  } else {
    console.log('🗄️  Using PostgreSQL database')
    const dialect = new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.POSTGRES_URL,
        max: 10,
      }),
    })
    dbInstance = new Kysely<Database>({
      dialect,
    })
  }

  return dbInstance
}

// Export a promise that resolves to the database instance
export const db = getDatabase()

// Export sql function for use in API
export { sql }
