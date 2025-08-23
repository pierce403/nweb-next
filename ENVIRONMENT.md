# Environment Variables for nweb Analyst

## Required Environment Variables

### Database Configuration

The analyst application supports two database options:

#### Option 1: PostgreSQL (Recommended for production)
```bash
POSTGRES_URL=postgresql://username:password@host:port/database
```

Examples:
```bash
# Local PostgreSQL
POSTGRES_URL=postgresql://nweb_user:password@localhost:5432/nweb_analyst

# Remote PostgreSQL (e.g., Supabase, Railway, etc.)
POSTGRES_URL=postgresql://user:pass@host.supabase.co:5432/postgres

# Connection string format
POSTGRES_URL=postgres://username:password@host:port/database
```

#### Option 2: PGLite (Fallback - SQLite-compatible)
If `POSTGRES_URL` is not provided, the application will automatically use PGLite, a local PostgreSQL-compatible database.

```bash
# No POSTGRES_URL needed - PGLite will be used automatically
# Optional: Custom database file location
PGLITE_DB_PATH=./nweb-analyst.db
```

### Other Environment Variables

```bash
# Node Environment
NODE_ENV=development  # or 'production'

# Vercel/Deployment specific (set automatically)
VERCEL_ENV=production
VERCEL_URL=https://your-app.vercel.app
```

## Usage

1. **Local Development:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ./run-analyst.sh
   ```

2. **Vercel Deployment:**
   - Set environment variables in your Vercel dashboard
   - If no `POSTGRES_URL` is provided, PGLite will be used

## Database Schema

The application expects these tables:
- `submissions` - Scan submissions
- `records` - Individual scan records
- `indexer_state` - Indexer synchronization state

## Troubleshooting

- **Connection errors**: Check your PostgreSQL connection string
- **PGLite fallback**: Ensure write permissions in the deployment directory
- **Vercel deployment**: Set environment variables in the Vercel dashboard
