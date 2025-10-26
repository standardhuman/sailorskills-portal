# Sailorskills Customer Portal

**Customer-facing portal for authenticated service access**

## Important Notes

- Use login standardhuman@gmail.com and pw KLRss!650 for any authentication needs
- Always test in Playwright MCP before pushing
- Always push to git after successful tests

## Product Overview

The **Customer Portal** is the customer-facing authentication hub where Sailorskills customers can view service history, invoices, submit requests, and manage their accounts.

**Role in Suite:** Customer self-service portal with authenticated access to their boats, services, invoices, and account information.

## Production Deployment

- **URL:** https://portal.sailorskills.com
- **Platform:** Vercel (static deployment)
- **Auto-deploy:** Pushes to `main` branch trigger production deployment

## Tech Stack

- **Framework:** Vite (ES modules, dev server, build system)
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (email/password, magic links)

## Key Features

### Authentication
- Email/password login
- Magic link login
- Password reset flow
- Secure session management
- Customer-only access (RLS enforced)

### Service History
- View all past services for customer's boats
- Current vessel condition display
- Anode replacement tracking
- Service photos from Supabase Storage

### Invoices
- View all invoices
- Payment history
- Outstanding balance
- Stripe integration for payments

### Service Requests
- Submit new service requests
- Track request status
- Request history

### Account Management
- Update contact information
- Manage boat details
- Communication preferences

## Project Structure

```
sailorskills-portal/
├── login.html               # Login page (entry point)
├── signup.html              # Customer signup
├── reset-password.html      # Password reset
├── portal.html              # Main portal dashboard
├── portal-services.html     # Service history
├── portal-invoices.html     # Invoice listing
├── portal-messages.html     # Customer messages
├── portal-account.html      # Account settings
├── portal-request-service.html   # Service request form
├── portal-request-history.html   # Request tracking
├── vite.config.js           # Vite configuration
├── vercel.json              # Vercel routing
├── package.json             # Dependencies
├── src/
│   ├── auth/
│   │   ├── login.js         # Login logic
│   │   ├── signup.js        # Signup logic
│   │   ├── reset-password.js # Password reset
│   │   └── auth.js          # Customer auth utilities
│   ├── views/
│   │   ├── portal.js        # Portal dashboard
│   │   ├── service-history.js  # Service history view
│   │   ├── invoices.js      # Invoice view
│   │   ├── messages.js      # Messages view
│   │   ├── request-service.js  # Service request form
│   │   ├── request-history.js  # Request tracking
│   │   └── account-settings.js # Account management
│   ├── api/
│   │   ├── service-logs.js  # Customer service queries
│   │   ├── invoices.js      # Invoice queries
│   │   ├── messages.js      # Message queries
│   │   ├── service-requests.js # Request queries
│   │   └── account.js       # Account queries
│   └── lib/
│       └── supabase.js      # Supabase client
└── shared/                  # Git submodule (@sailorskills/shared)
```

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:5174)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Vercel
vercel --prod
```

## Environment Variables

Required in Vercel project settings and local `.env`:

```env
VITE_SUPABASE_URL=https://fzygakldvvzxmahkdylq.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Database Access

### Row-Level Security (RLS)
The portal uses the same Supabase database as Operations but RLS policies ensure:
- Customers see only their own data
- Queries filtered by authenticated user's customer_id
- No admin data exposed

### Key Tables
- `customers` - Customer account data
- `boats` - Customer boats
- `service_logs` - Service history
- `invoices` - Invoice data
- `service_requests` - Customer requests
- `messages` - Customer-admin messages

## Integration Points

### ← sailorskills-operations
- **Provides**: Service logs, condition data
- **Portal reads**: Service history, current conditions
- **Flow**: Operations creates service logs → Portal displays to customers

### ← sailorskills-billing
- **Provides**: Invoices, payment data
- **Portal reads**: Invoice list, payment history
- **Flow**: Billing creates invoices → Portal displays to customers

## Development Workflow

**IMPORTANT**: Always follow these steps after making code changes:

1. **Test Locally**: Run `npm run dev` and manually test changes
2. **Test with Playwright**: Run Playwright MCP tests to verify functionality
3. **Build**: Run `npm run build` to ensure production build works
4. **Commit**: Commit changes with clear message
5. **Push to GitHub**: Push to `main` branch (triggers Vercel deployment)

## Testing

### Playwright Tests
This repo uses Playwright MCP for end-to-end testing.

**Test Flow:**
1. Load login page
2. Test authentication (login/signup/reset)
3. Navigate portal pages
4. Verify customer data isolation
5. Test service request submission
6. Verify Supabase queries

## Common Tasks

### Adding New Portal Page
1. Create HTML file (portal-*.html)
2. Add to vite.config.js rollupOptions.input
3. Create view JS file in src/views/
4. Add navigation link
5. Test authentication guard

### Adding New API Query
1. Create API file in src/api/
2. Implement customer-scoped query (RLS)
3. Handle error cases
4. Test data isolation

## Related Services

- **Operations**: https://github.com/standardhuman/sailorskills-operations (admin)
- **Billing**: https://github.com/standardhuman/sailorskills-billing
- **Shared Package**: https://github.com/standardhuman/sailorskills-shared

## Development Guidelines

1. ✅ **Always test with Playwright MCP** before pushing
2. ✅ **Always push to GitHub** after successful tests
3. ✅ Use shared package for common utilities
4. ✅ Enforce customer data isolation (RLS)
5. ✅ Mobile-friendly UI (field/boat use)
6. ✅ Handle auth state consistently
7. ✅ Clear error messages for customers

---

**Part of the Sailorskills service architecture - separated from Operations for security and clarity**
