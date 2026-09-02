# MediFlow

Modern pharmacy and drug shop management, simplified.

MediFlow is a production-oriented, multi-tenant Drug Shop Management System built with Next.js and Supabase. It is designed for real businesses — reliable, secure, fast, and offline-resilient.

## Features

### Core (V1)
- **Authentication** — Email/password login, signup, password reset via Supabase Auth
- **Multi-tenancy** — Organization → Branch → User hierarchy with Row Level Security
- **Dashboard** — KPI cards, charts, recent transactions, low-stock alerts
- **Products** — Full product management with categories, units, SKU, barcode
- **Batch Management** — FEFO (First Expiry, First Out), expiry tracking, batch-level pricing
- **Inventory** — Movement-based inventory with audit trail, stock adjustments, low-stock alerts
- **Point of Sale** — Fast POS with cart, discounts, customer selection, receipt generation
- **Purchasing** — Purchase orders with draft → order → receive workflow
- **Suppliers** — Supplier management
- **Sales** — Sales history with void, return, receipt printing
- **Returns** — Return processing with stock reversal
- **Expenses** — Expense tracking by category
- **Customers** — Customer records (optional during POS)
- **Reports** — Sales, financial, inventory, product performance reports
- **Users & Roles** — Role-based access with granular permissions
- **Audit Logs** — Traceable audit trail for all important actions
- **Offline POS** — PWA with IndexedDB for offline sales, sync on reconnect
- **Dark Mode** — Light, dark, and system theme support
- **Responsive** — Works on phones, tablets, laptops, and desktops

### Future
- Multi-branch transfers
- Prescription management
- EFRIS/fiscal integration
- Mobile applications
- Advanced analytics
- E-commerce integration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui-style components |
| Backend | Supabase (PostgreSQL, Auth, RLS, Storage) |
| Validation | Zod, React Hook Form |
| Charts | Recharts |
| Offline | Dexie (IndexedDB), PWA |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/brunocoder256/mediflow.git
cd mediflow
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### Database Setup

Run the Supabase migrations in order from `supabase/migrations/`:

```bash
# Using Supabase CLI
supabase db push

# Or run each migration file manually in the Supabase SQL Editor
```

The migrations will create:
- All database tables with proper constraints
- Row Level Security policies
- Indexes for performance
- Seed data for development

### Development

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
npm run typecheck # Type checking
```

## Project Structure

```
mediflow/
├── public/                    # Static assets, PWA manifest
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Authenticated app routes
│   │   │   ├── dashboard/
│   │   │   ├── pos/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── purchases/
│   │   │   ├── suppliers/
│   │   │   ├── sales/
│   │   │   ├── returns/
│   │   │   ├── expenses/
│   │   │   ├── customers/
│   │   │   ├── reports/
│   │   │   ├── users/
│   │   │   ├── audit/
│   │   │   ├── settings/
│   │   │   └── sync/
│   │   ├── auth/              # Authentication pages
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Public landing page
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   └── layout/            # Layout components (sidebar, topbar)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── supabase/          # Supabase client configuration
│   │   ├── offline/           # IndexedDB, sync engine
│   │   ├── validations/       # Zod schemas
│   │   └── utils.ts           # Utility functions
│   └── types/                 # TypeScript types
├── supabase/
│   └── migrations/            # Database migrations (00001–00025)
├── .env.local                 # Local environment variables (git-ignored)
├── .env.example               # Environment template
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Security

- **Row Level Security (RLS)** enforced on all business tables
- **Multi-tenant isolation** — organizations cannot access each other's data
- **Server-side validation** — all critical operations validated server-side
- **No secrets in browser** — Supabase publishable key is safe; secret key never exposed
- **Audit logging** — important changes are traceable
- **Zod validation** — input validation on both client and server

## Database Schema

The database uses PostgreSQL via Supabase with:

- UUID primary keys
- `numeric(14,2)` for financial amounts
- UTC timestamps
- Foreign keys with appropriate ON DELETE behavior
- Check constraints for status fields
- Composite indexes for query performance

See `supabase/migrations/` for the full schema.

## Deployment

### Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables
4. Deploy

### Supabase

1. Create a Supabase project
2. Run migrations via SQL Editor or Supabase CLI
3. Configure RLS policies
4. Set up Auth providers

## License

Private — All rights reserved.
