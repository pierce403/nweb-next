# nweb Analyst

A modern web interface for exploring and analyzing nweb scan data. Built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Dashboard Overview**: Real-time statistics and activity monitoring
- **Data Exploration**: Browse submissions, IPs, services, and scan records
- **Search Functionality**: Full-text search across all scan data
- **Responsive Design**: Works on desktop and mobile devices
- **Type Safety**: Full TypeScript support with generated database types
- **Performance**: Optimized queries and caching for large datasets

## Quick Start

### Prerequisites

- Node.js 18.17+
- PostgreSQL database with nweb scan data
- Running nweb indexer (for data ingestion)

### Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Set up environment:
```bash
cp .env.example .env.local
# Edit .env.local with your database configuration
```

3. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
analyst/
├── app/                    # Next.js 13+ app directory
│   ├── api/               # API routes
│   ├── components/        # Reusable components
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Dashboard page
├── components/            # Shared components
├── lib/                   # Utility libraries
│   ├── api.ts            # API functions
│   └── database.ts       # Database connection
├── types/                 # TypeScript type definitions
│   └── database.ts       # Database schema types
├── .env.example          # Environment template
├── package.json          # Dependencies and scripts
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

## Pages

- **Dashboard (`/`)**: Overview statistics and recent activity
- **Search (`/search`)**: Search across all scan data
- **IPs (`/ips`)**: Browse IP addresses and their scan history
- **Services (`/services`)**: Explore discovered services and ports
- **Submissions (`/submissions`)**: View scan submissions and their details

## API Routes

- `GET /api/dashboard` - Dashboard statistics
- `GET /api/submissions` - List submissions with filtering
- `GET /api/records` - Browse scan records
- `GET /api/search` - Search endpoints

## Database

The analyst connects to the same PostgreSQL database used by the indexer. It uses Kysely for type-safe SQL queries.

### Schema Overview

- **submissions**: Scan submission metadata and status
- **records**: Individual scan records (IP, port, service data)
- **indexer_state**: Indexer progress tracking

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

### Code Style

- Uses ESLint and Prettier for code formatting
- TypeScript strict mode enabled
- Follows Next.js 13+ app directory conventions
- Tailwind CSS for styling

### Adding New Pages

1. Create new page in `app/` directory
2. Add corresponding API routes in `app/api/`
3. Add navigation links in `components/Navigation.tsx`
4. Update types in `types/database.ts` if needed

## Deployment

### Environment Variables

```env
POSTGRES_URL=postgresql://user:pass@host:port/database
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-domain.com
```

### Build Commands

```bash
npm run build
npm run start
```

### Docker Support

The analyst can be containerized for easy deployment:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Follow the existing code style and conventions
2. Add tests for new features
3. Update documentation as needed
4. Ensure all type checks pass

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check `POSTGRES_URL` in environment
2. **Type errors**: Run `npm run type-check` to identify issues
3. **Build failures**: Ensure all dependencies are installed
4. **Styling issues**: Check Tailwind CSS configuration

### Performance

For large datasets, consider:
- Database indexing on frequently queried columns
- Pagination for large result sets
- Caching with Redis for frequently accessed data
- Database connection pooling
