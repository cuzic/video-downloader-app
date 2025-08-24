# ADR-003: Use SQLite with Drizzle ORM

## Status
Accepted

## Context
The application needs a database for storing download tasks, settings, history, and other persistent data. We need to choose between embedded and client-server databases, and select an appropriate ORM.

## Decision
We will use SQLite as the database with Drizzle ORM for type-safe database operations.

## Consequences

### Positive
- **Embedded**: No separate database server required
- **Portability**: Database is a single file, easy to backup/migrate
- **Performance**: Excellent for single-user desktop application
- **Type safety**: Drizzle provides full TypeScript support
- **Migrations**: Drizzle Kit handles schema migrations
- **Developer experience**: SQL-like syntax with TypeScript inference

### Negative
- **Concurrency**: Limited concurrent write capabilities
- **Scalability**: Not suitable if we need multi-user support
- **Features**: Lacks some advanced database features

### Neutral
- Database file stored in user data directory
- Automatic backup system recommended
- Schema defined in TypeScript

## Implementation Details

### Database Location
```typescript
const dbPath = path.join(app.getPath('userData'), 'app.db');
```

### Schema Definition
```typescript
// Using Drizzle schema
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  status: text('status').notNull(),
  // ...
});
```

### Repository Pattern
```typescript
class TaskRepository {
  async create(data: TaskInput): Promise<Task> {
    const result = await db.insert(tasks).values(data).returning();
    return result[0];
  }
}
```

## Alternatives Considered
- **PostgreSQL/MySQL**: Overkill for desktop application
- **LevelDB**: Less querying capabilities
- **JSON files**: No ACID guarantees, poor performance at scale
- **Prisma ORM**: Heavier, requires separate CLI tool
- **TypeORM**: More complex, less type-safe