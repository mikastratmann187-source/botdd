# Overview

A Discord ticket management system with a web dashboard. The application consists of a Discord bot that handles ticket creation (for questions, mod applications, and supporter applications) and a React-based admin dashboard for viewing and managing tickets. Built with a modern TypeScript stack using Express on the backend and React with Vite on the frontend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (Discord-inspired dark theme)
- **Animations**: Framer Motion for smooth transitions

The frontend follows a standard React SPA pattern with:
- Pages in `client/src/pages/` (Dashboard, TicketDetail, NotFound)
- Reusable components in `client/src/components/`
- Custom hooks in `client/src/hooks/` for data fetching
- UI primitives from shadcn/ui in `client/src/components/ui/`

## Backend Architecture
- **Runtime**: Node.js with TypeScript (tsx for development)
- **Framework**: Express.js
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: Simple REST endpoints with typed route definitions in `shared/routes.ts`

Key backend patterns:
- Storage layer abstraction (`server/storage.ts`) for database operations
- Shared schema and route definitions between frontend and backend in `shared/`
- Vite dev server integration during development (`server/vite.ts`)
- Static file serving in production (`server/static.ts`)

## Discord Bot Integration
- **Library**: discord.js v14
- Handles ticket creation via select menus and modals
- Creates private channels for ticket conversations
- Stores ticket data in the database for dashboard access

## Build System
- Custom build script (`script/build.ts`) using esbuild for server and Vite for client
- Server bundles common dependencies to reduce cold start times
- Output goes to `dist/` directory with static files in `dist/public/`

# External Dependencies

## Database
- **PostgreSQL**: Primary data store
- **Drizzle ORM**: Type-safe database queries and schema management
- **drizzle-kit**: Migration tooling (schema push via `db:push`)
- Connection via `DATABASE_URL` environment variable

## Discord
- **discord.js**: Bot framework for ticket system
- Requires `DISCORD_TOKEN` environment variable
- Uses Gateway Intents: Guilds, GuildMessages, MessageContent

## Third-Party UI Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Lucide React**: Icon library
- **date-fns**: Date formatting
- **cmdk**: Command palette component
- **embla-carousel-react**: Carousel functionality
- **react-day-picker**: Calendar component
- **recharts**: Charting library
- **vaul**: Drawer component

## Development Tools
- **Replit Vite plugins**: Runtime error overlay, cartographer, dev banner
- **TypeScript**: Strict mode enabled with path aliases (@/, @shared/)