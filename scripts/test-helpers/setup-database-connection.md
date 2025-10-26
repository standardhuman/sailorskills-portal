# Setup Database Connection

Follow these steps to enable SQL query execution from Claude Code:

## Step 1: Get Your Database Connection String

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: **Sailor Skills** (`fzygakldvvzxmahkdylq`)
3. Click **Project Settings** (gear icon in bottom left)
4. Go to **Database** section
5. Click the **Connection String** tab
6. **Select "Session mode"** (recommended for testing) - uses port 5432
7. Click the **URI** tab if not already selected
8. Copy the connection string - it looks like:
   ```
   postgresql://postgres.fzygakldvvzxmahkdylq:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

## Step 2: Get Your Database Password

**The database password is NOT the same as your API keys!**

If you don't know your database password:

1. In the same **Database** settings page
2. Scroll to **Database password** section
3. Click **Reset database password** if needed (this will generate a new one)
4. Copy the password shown (you won't be able to see it again)

## Step 3: Add to .env File

1. Open your `.env` file in the project root
2. Add this line (replace `[YOUR-PASSWORD]` with the actual password):
   ```
   DATABASE_URL=postgresql://postgres.fzygakldvvzxmahkdylq:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

**Example:**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://fzygakldvvzxmahkdylq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Connection
DATABASE_URL=postgresql://postgres.fzygakldvvzxmahkdylq:MySecurePassword123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

## Step 4: Test the Connection

Run the test script:
```bash
node scripts/test-helpers/db-query.mjs
```

Expected output:
```
✓ Connected to database successfully
✓ Query executed successfully
  Database: postgres
  Server time: 2025-10-26...
✓ Found 6 tables:
  - boats
  - customers
  - invoices
  ...
✓ All tests passed!
```

## Step 5: Test psql Connection

Test the PostgreSQL command-line client:
```bash
psql "$DATABASE_URL" -c "SELECT current_database(), current_user"
```

Expected output:
```
 current_database | current_user
------------------+---------------------------
 postgres         | postgres.fzygakldvvzxmahkdylq
```

## Troubleshooting

### "DATABASE_URL not found"
- Make sure you added the line to your `.env` file
- Restart your terminal/shell to reload environment variables
- Check for typos in the variable name

### "password authentication failed"
- Your database password might be wrong
- Try resetting it in Supabase dashboard
- Make sure you copied the full password (no spaces)

### "could not connect to server"
- Check your internet connection
- Verify the connection string is complete
- Make sure you're using the correct region (aws-0-us-east-1 or similar)

### "relation does not exist"
- You might be connected to the wrong database
- Verify you're using the Session pooler connection string
- Check the database name in the URL is `postgres`

## Security Notes

- ✅ Never commit `.env` file to git (it's already in `.gitignore`)
- ✅ Database password is sensitive - keep it secret
- ✅ This is for testing/development only
- ✅ Connection uses SSL for security

## Next Steps

Once connected, try these:

**Verify customer data:**
```bash
node scripts/test-helpers/example-verify-customer.mjs standardhuman@gmail.com
```

**Check database schema:**
```bash
node scripts/test-helpers/example-check-schema.mjs
```

**Run quick query:**
```bash
node scripts/test-helpers/example-quick-query.mjs "SELECT COUNT(*) FROM customers"
```

**Interactive psql session:**
```bash
psql "$DATABASE_URL"
```

---

**You're all set! You can now run SQL queries directly from Claude Code.**
