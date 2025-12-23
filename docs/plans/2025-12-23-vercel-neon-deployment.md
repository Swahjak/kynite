# Vercel + Neon Deployment Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the Family Planner Next.js 16 application to Vercel with Neon PostgreSQL database.

**Architecture:** The application runs on Vercel's edge infrastructure with a serverless PostgreSQL database on Neon. Drizzle ORM handles migrations and database access. Better-Auth provides authentication with Google OAuth support.

**Tech Stack:** Next.js 16, Vercel, Neon PostgreSQL, Drizzle ORM, better-auth, next-intl

---

## Prerequisites

- Vercel account (https://vercel.com)
- Neon account (https://neon.tech)
- Google Cloud Console access for OAuth credentials
- GitHub repository connected (recommended for CI/CD)

---

## Task 1: Create Neon Database

**Goal:** Set up a production PostgreSQL database on Neon.

**Step 1: Create Neon project**

1. Go to https://console.neon.tech
2. Click "New Project"
3. Configure:
   - **Project name:** `family-planner`
   - **PostgreSQL version:** 16 (latest)
   - **Region:** Choose closest to your users (e.g., `eu-central-1` for Europe)
4. Click "Create Project"

**Step 2: Copy the connection string**

1. In the Neon dashboard, go to "Connection Details"
2. Select "Pooled connection" (recommended for serverless)
3. Copy the connection string, it looks like:
   ```
   postgresql://username:password@ep-xxx-yyy-123456.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this - you'll need it for Vercel environment variables

**Step 3: Verify connection (optional)**

Run locally to test the connection string works:

```bash
psql "postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

Expected: Connection succeeds, you see the psql prompt.

---

## Task 2: Create Vercel Project

**Goal:** Set up the Vercel project and connect to the repository.

**Step 1: Import project to Vercel**

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository: `family-planner-v3-project`
4. Click "Import"

**Step 2: Configure project settings**

1. **Framework Preset:** Next.js (auto-detected)
2. **Root Directory:** `.` (default)
3. **Build Command:** `pnpm build` (auto-detected)
4. **Output Directory:** Leave default
5. **Install Command:** `pnpm install`

**Step 3: Skip environment variables for now**

Click "Deploy" - the first build will fail because environment variables aren't set yet. This is expected.

---

## Task 3: Configure Environment Variables in Vercel

**Goal:** Set all required environment variables for production.

**Step 1: Navigate to project settings**

1. In Vercel dashboard, go to your project
2. Click "Settings" tab
3. Click "Environment Variables" in left sidebar

**Step 2: Add DATABASE_URL**

- **Key:** `DATABASE_URL`
- **Value:** Your Neon pooled connection string from Task 1
- **Environment:** Production, Preview, Development
- Click "Save"

**Step 3: Generate and add BETTER_AUTH_SECRET**

Generate a secure secret locally:

```bash
openssl rand -base64 32
```

Add to Vercel:

- **Key:** `BETTER_AUTH_SECRET`
- **Value:** (paste the generated secret)
- **Environment:** Production, Preview, Development

**Step 4: Add BETTER_AUTH_URL**

- **Key:** `BETTER_AUTH_URL`
- **Value:** `https://your-project.vercel.app` (use your actual Vercel domain)
- **Environment:** Production only

For Preview:

- **Key:** `BETTER_AUTH_URL`
- **Value:** `https://${VERCEL_URL}`
- **Environment:** Preview only

**Step 5: Add NEXT_PUBLIC_BETTER_AUTH_URL**

- **Key:** `NEXT_PUBLIC_BETTER_AUTH_URL`
- **Value:** `https://your-project.vercel.app`
- **Environment:** Production only

For Preview:

- **Key:** `NEXT_PUBLIC_BETTER_AUTH_URL`
- **Value:** `https://${VERCEL_URL}`
- **Environment:** Preview only

**Step 6: Add CRON_SECRET**

Generate:

```bash
openssl rand -base64 32
```

- **Key:** `CRON_SECRET`
- **Value:** (paste generated secret)
- **Environment:** Production, Preview

---

## Task 4: Configure Google OAuth for Production

**Goal:** Add production OAuth credentials for Google sign-in.

**Step 1: Access Google Cloud Console**

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project (or create one for Family Planner)

**Step 2: Create OAuth 2.0 Client ID**

1. Click "Create Credentials" > "OAuth client ID"
2. Application type: "Web application"
3. Name: `Family Planner Production`
4. Authorized JavaScript origins:
   - `https://your-project.vercel.app`
5. Authorized redirect URIs:
   - `https://your-project.vercel.app/api/auth/callback/google`
6. Click "Create"

**Step 3: Copy credentials**

Save the:

- **Client ID**
- **Client Secret**

**Step 4: Add to Vercel environment variables**

- **Key:** `GOOGLE_CLIENT_ID`
- **Value:** (your production client ID)
- **Environment:** Production

- **Key:** `GOOGLE_CLIENT_SECRET`
- **Value:** (your production client secret)
- **Environment:** Production

---

## Task 5: Configure Automatic Migrations

**Goal:** Ensure database migrations run automatically during deployment.

**Step 1: Update build script** (already done)

The `package.json` build script has been updated to:

```json
"build": "drizzle-kit push && next build"
```

This ensures migrations run before every deployment.

**Step 2: Commit and push**

```bash
git add package.json
git commit -m "build: add automatic database migrations to build"
git push
```

This will trigger a Vercel deployment that creates all tables automatically.

---

## Task 6: Trigger Vercel Redeploy

**Goal:** Deploy with all environment variables configured.

**Step 1: Trigger redeploy**

In Vercel dashboard:

1. Go to "Deployments" tab
2. Click the three dots on the latest deployment
3. Click "Redeploy"
4. Check "Use existing Build Cache" OFF (uncheck it)
5. Click "Redeploy"

**Step 2: Monitor build**

Watch the build logs for:

- Dependencies installed successfully
- Build completes without errors
- No missing environment variable warnings

Expected: Build succeeds, deployment goes live.

---

## Task 7: Verify Deployment

**Goal:** Confirm the application works in production.

**Step 1: Check homepage loads**

Open `https://your-project.vercel.app` in browser.

Expected: The homepage renders without errors.

**Step 2: Test authentication flow**

1. Click "Sign in with Google"
2. Complete Google OAuth flow
3. Verify redirect back to app
4. Verify user session is created

**Step 3: Check cron job configuration**

In Vercel dashboard:

1. Go to "Settings" > "Crons"
2. Verify `/api/cron/sync-calendars` is listed
3. Schedule should show `*/5 * * * *` (every 5 minutes)

**Step 4: Check API health**

```bash
curl https://your-project.vercel.app/api/auth/session
```

Expected: Returns `{}` or session data (not an error).

---

## Task 8: Configure Custom Domain (Optional)

**Goal:** Set up a custom domain for the application.

**Step 1: Add domain in Vercel**

1. Go to "Settings" > "Domains"
2. Enter your domain (e.g., `family.yourdomain.com`)
3. Click "Add"

**Step 2: Configure DNS**

Add DNS records as shown by Vercel:

- For apex domain: A record pointing to `76.76.21.21`
- For subdomain: CNAME pointing to `cname.vercel-dns.com`

**Step 3: Update environment variables**

Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL` to use your custom domain:

- `https://family.yourdomain.com`

**Step 4: Update Google OAuth**

In Google Cloud Console, add your custom domain to:

- Authorized JavaScript origins
- Authorized redirect URIs

---

## Task 9: Set Up Preview Deployments (Recommended)

**Goal:** Configure preview deployments for pull requests.

**Step 1: Verify preview environment variables**

Ensure these use `${VERCEL_URL}` for Preview environment:

- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_BETTER_AUTH_URL`

**Step 2: Add preview OAuth redirect (optional)**

For full OAuth in previews, add wildcard redirect in Google Console:

- `https://*.vercel.app/api/auth/callback/google`

Note: Google may require domain verification for wildcards.

---

## Environment Variables Summary

| Variable                      | Production                | Preview                 |
| ----------------------------- | ------------------------- | ----------------------- |
| `DATABASE_URL`                | Neon connection string    | Same                    |
| `BETTER_AUTH_SECRET`          | Generated secret          | Same                    |
| `BETTER_AUTH_URL`             | `https://your-domain.com` | `https://${VERCEL_URL}` |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://your-domain.com` | `https://${VERCEL_URL}` |
| `GOOGLE_CLIENT_ID`            | Production OAuth ID       | Same or dev ID          |
| `GOOGLE_CLIENT_SECRET`        | Production OAuth secret   | Same or dev secret      |
| `CRON_SECRET`                 | Generated secret          | Same                    |

---

## Troubleshooting

### Build fails with "DATABASE_URL not found"

- Verify `DATABASE_URL` is set in Vercel environment variables
- Ensure it's enabled for the correct environment (Production/Preview)

### OAuth redirect error

- Check redirect URI matches exactly in Google Console
- Verify `BETTER_AUTH_URL` matches your domain
- Check for trailing slashes (should not have one)

### Database connection errors

- Use pooled connection string from Neon
- Ensure `?sslmode=require` is in the connection string
- Check Neon dashboard for connection limits

### Cron jobs not running

- Verify `vercel.json` is in the repository root
- Check Vercel Crons dashboard for errors
- Ensure `CRON_SECRET` is set

---

## Post-Deployment Checklist

- [ ] Homepage loads without errors
- [ ] Google OAuth sign-in works
- [ ] User can create a family
- [ ] Database operations work (create/read/update)
- [ ] Cron job appears in Vercel dashboard
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (automatic with Vercel)
