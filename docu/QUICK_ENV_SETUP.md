# Quick Environment Variables Setup Guide

## ⚡ Step-by-Step Instructions

### Your Values (from .env.local):
```bash
SUPABASE_ACCESS_TOKEN=sbp_e796ebb4d69e93682af0a4b33a0e406e74f00541
SUPABASE_PROJECT_REF=xawypsrotrfoyozhrsbb
```

---

## 1. Set Environment Variables in Supabase Dashboard

### For Edge Function: `sync-edge-function-logs`

1. **Navigate to**: [Supabase Dashboard](https://supabase.com/dashboard) → **Edge Functions** → **sync-edge-function-logs** → **Settings** → **Secrets**

2. **Click "Add Secret"** and add the following two secrets:

   **Secret 1:**
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: `sbp_e796ebb4d69e93682af0a4b33a0e406e74f00541`
   - Click **Save**

   **Secret 2:**
   - Name: `SUPABASE_PROJECT_REF`
   - Value: `xawypsrotrfoyozhrsbb`
   - Click **Save**

---

### For Edge Function: `sync-realtime-metrics`

1. **Navigate to**: **Edge Functions** → **sync-realtime-metrics** → **Settings** → **Secrets**

2. **Add the same two secrets**:

   **Secret 1:**
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: `sbp_e796ebb4d69e93682af0a4b33a0e406e74f00541`
   - Click **Save**

   **Secret 2:**
   - Name: `SUPABASE_PROJECT_REF`
   - Value: `xawypsrotrfoyozhrsbb`
   - Click **Save**

---

### For Edge Function: `sync-sentry-errors`

**⚠️ Requires Sentry Setup First**

#### Step 1: Generate Sentry Auth Token

1. Go to [Sentry.io](https://sentry.io) and login
2. Navigate to: **Settings** → **Developer Settings** → **Auth Tokens**
3. Click **"Create New Token"**
4. Token name: `monitoring-sentry-token`
5. Select scopes:
   - ✅ `project:read`
   - ✅ `project:write`
6. Click **Create Token**
7. **Copy the token** (shown only once!)

#### Step 2: Get Organization and Project Slugs

1. In Sentry, go to your project
2. Look at the URL: `https://sentry.io/organizations/{YOUR_ORG}/projects/{YOUR_PROJECT}/`
3. Copy the **organization slug** and **project slug**

#### Step 3: Set Secrets in Supabase

1. **Navigate to**: **Edge Functions** → **sync-sentry-errors** → **Settings** → **Secrets**

2. **Add three secrets**:

   **Secret 1:**
   - Name: `SENTRY_AUTH_TOKEN`
   - Value: `(paste the token from Step 1)`
   - Click **Save**

   **Secret 2:**
   - Name: `SENTRY_ORG`
   - Value: `(your organization slug from Step 2)`
   - Click **Save**

   **Secret 3:**
   - Name: `SENTRY_PROJECT`
   - Value: `(your project slug from Step 2)`
   - Click **Save**

---

## 2. Verify Edge Functions Have Environment Variables

After adding secrets, verify they're set:

```bash
# Check sync-edge-function-logs
curl -X POST https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/sync-edge-function-logs \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response (if environment variables are set):
{
  "success": true,
  "logs_synced": 5,
  "timestamp": "2026-01-23T..."
}

# If environment variables are missing:
{
  "success": true,
  "logs_synced": 0,
  "timestamp": "2026-01-23T..."
}
```

---

## 3. Set Sentry DSN in Frontend (.env.production)

### For Academy Admin

Create or edit `apps/academy-admin/.env.production`:

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

### For Super Admin

Create or edit `apps/super-admin/.env.production`:

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

**To get your Sentry DSN**:
1. Go to Sentry.io → Your Project → **Settings** → **Client Keys (DSN)**
2. Copy the DSN value
3. Paste it into the `.env.production` files

---

## 4. Wait for Cron Jobs to Collect Data

Once environment variables are set, the Cron Jobs will automatically collect data:

- **sync-edge-function-logs**: Runs every 5 minutes
- **sync-realtime-metrics**: Runs every 1 minute
- **sync-sentry-errors**: Runs every 5 minutes

**Wait 5-10 minutes** for the first data collection cycle.

---

## 5. Verify Data Collection

After waiting 5-10 minutes, check the tables:

```sql
-- Check Edge Function logs
SELECT COUNT(*) FROM edge_function_logs;

-- Check Realtime metrics
SELECT COUNT(*) FROM realtime_connection_logs;

-- Check Sentry errors
SELECT COUNT(*) FROM frontend_error_logs;
```

If counts are > 0, data collection is working!

---

## 6. View in Performance Monitoring Page

Navigate to:
```
Super Admin → Performance Monitoring → Overview Tab
```

You should see:
- **Edge Function Stats Card**: Function-level statistics
- **Realtime Stats Card**: Connection metrics
- **Frontend Errors Card**: Sentry error list

---

## ✅ Setup Complete!

Once you see data in the Performance Monitoring page, the entire monitoring infrastructure is fully operational.

**Cron Jobs Status**: ✅ Active (Job IDs: 19, 20, 21)
**Edge Functions**: ✅ Deployed and active
**Frontend Integration**: ✅ Sentry initialized
**Database**: ✅ All tables and RPC functions created

---

## 🔍 Troubleshooting

### Problem: No data after 10 minutes

**Check Edge Function logs**:
1. Supabase Dashboard → **Logs** → **Edge Functions**
2. Filter by: `sync-edge-function-logs`, `sync-realtime-metrics`, `sync-sentry-errors`
3. Look for error messages

**Common issues**:
- Environment variables not set correctly
- Edge Functions need redeployment after adding secrets
- Sentry API token permissions insufficient

**Fix**: Redeploy Edge Functions after adding secrets:
```bash
cd infra/supabase
npx supabase functions deploy sync-edge-function-logs
npx supabase functions deploy sync-realtime-metrics
npx supabase functions deploy sync-sentry-errors
```

---

## 📚 Related Documents

- [CRON_AND_ENV_SETUP_GUIDE.md](CRON_AND_ENV_SETUP_GUIDE.md) - Detailed setup guide
- [MONITORING_VERIFICATION_COMPLETE.md](MONITORING_VERIFICATION_COMPLETE.md) - Verification results
- [FRONTEND_MONITORING_INTEGRATION.md](FRONTEND_MONITORING_INTEGRATION.md) - Frontend integration details
