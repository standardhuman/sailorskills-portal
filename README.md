# Sailorskills Customer Portal

**Customer-facing portal for service history, invoices, and account management**

## Overview

The Customer Portal is a secure, authenticated portal where Sailorskills customers can:
- View service history and current vessel condition
- Access invoices and payment history
- Submit service requests
- Manage account settings
- View messages from the Sailorskills team

## Production Deployment

- **URL:** https://portal.sailorskills.com
- **Platform:** Vercel (static deployment)
- **Auto-deploy:** Pushes to `main` branch trigger production deployment

## Tech Stack

- **Framework:** Vite (ES modules, dev server, build system)
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth

## Development

```bash
# Install dependencies
npm install

# Run development server (http://localhost:5174)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://fzygakldvvzxmahkdylq.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Features

### Authentication
- Email/password login
- Magic link login
- Password reset
- Secure session management

### Service History
- View all past services
- See current vessel condition
- Track anode replacements
- View service photos

### Invoices
- View all invoices
- Download PDF invoices
- Payment history
- Outstanding balance tracking

### Service Requests
- Submit new service requests
- Track request status
- View request history

### Account Management
- Update contact information
- Manage boat details
- Communication preferences

## Architecture

This portal shares the same Supabase database with `sailorskills-operations` but uses Row-Level Security (RLS) to ensure customers only see their own data.

### Related Services
- **Operations:** Admin dashboard (ops.sailorskills.com)
- **Billing:** Payment processing and invoicing
- **Shared Package:** Common utilities and design system

## Shared Package

This repo includes the shared package as a git submodule:

```bash
# Initialize submodule (first time)
git submodule update --init --recursive

# Update to latest shared package
cd shared
git pull origin main
cd ..
git add shared
git commit -m "Update shared package"
```

## Testing

Use Playwright for end-to-end testing:

```bash
npx playwright test
```

## Deployment

Deployment is automatic via Vercel:
1. Push to `main` branch
2. Vercel builds and deploys
3. Portal available at portal.sailorskills.com

---

**Part of the Sailorskills service architecture**
