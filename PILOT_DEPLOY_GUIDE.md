# CityCircle Pilot Deploy Guide (Backend + Frontend)

This guide gets your pilot online with minimum friction.

## Recommended stack for pilot

- **Backend**: Railway (Node + SQLite file on volume)
- **Frontend**: Vercel (Vite React static build)

You can use other providers, but this combo is fast for pilot.

---

## 0) Before you deploy

- Ensure local smoke test passes:
  - `cd citycircle-backend`
  - `node subscription_promo_smoke_test.js`
- Keep SMS optional for pilot:
  - `STORE_DIRECT_PROMO_SMS_ENABLED=0`

---

## 1) Deploy backend on Railway

## 1.1 Create project

1. Open Railway dashboard.
2. New Project -> Deploy from GitHub Repo.
3. Select this repository.
4. Set **Root Directory** to: `citycircle-backend`

## 1.2 Service settings

- Start command: `npm start`
- Port: Railway injects `PORT` automatically (already supported).

## 1.3 Add environment variables

Set these in Railway -> Variables:

- `JWT_SECRET` = long random string (required)
- `NODE_ENV` = `production`
- `FRONTEND_URL` = your Vercel URL (after frontend deploy)
- `APP_URL` = your Vercel URL
- `STORE_SUBSCRIPTION_TRIAL_DAYS` = `14`
- `STORE_DIRECT_PROMO_SMS_ENABLED` = `0`
- `STORE_NOTIFY_SMS_ENABLED` = `0`
- `STORE_NOTIFY_COOLDOWN_HOURS` = `24`

Optional (only if using email):

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `ADMIN_FROM_EMAIL`
- `ADMIN_EMAILS`

Optional (only if using extra integrations):

- `GOOGLE_PLACES_API_KEY`
- `TOMTOM_API_KEY`
- `VONAGE_*` / `TWILIO_*`

## 1.4 Persistent storage for SQLite

Your backend uses `citycircle-backend/citycircle.db`.  
Make sure Railway service keeps this file on persistent storage (volume/mount).

If you do not persist it, data can reset on redeploy/restart.

## 1.5 Get backend URL

Copy service URL, e.g.:

- `https://citycircle-backend-production.up.railway.app`

Backend API base for frontend will be:

- `https://citycircle-backend-production.up.railway.app/api`

---

## 2) Deploy frontend on Vercel

## 2.1 Create project

1. Open Vercel dashboard.
2. New Project -> Import GitHub repo.
3. Set **Root Directory** to: `citycircle-frontend`

## 2.2 Build settings

- Build command: `npm run build`
- Output directory: `dist`

## 2.3 Frontend env var

Set:

- `VITE_API_URL` = `https://<your-backend-domain>/api`

Redeploy frontend after setting this.

## 2.4 Copy frontend URL

Example:

- `https://citycircle-pilot.vercel.app`

Then update backend vars:

- `FRONTEND_URL`
- `APP_URL`

---

## 3) Post-deploy verification (must do)

## 3.1 Backend health check

Open in browser:

- `https://<backend-domain>/api/stores/subscription`

Expected without token: `401` (this confirms route exists in prod).

## 3.2 App checks

From frontend URL:

1. Admin login
2. Open store details
3. Change subscription (admin password required)
4. Confirm audit log appears
5. Store login
6. Test Subscription & Pricing tab
7. Test quick reward mode (scan customer -> quick reward)
8. Trial masking vs Starter full access checks

---

## 4) Pilot invite setup

Prepare:

- 3-5 store owner accounts
- 10-20 customer test accounts
- 1 admin account

Share:

- frontend URL
- each user’s login credentials
- short instructions (2 min setup)

---

## 5) Daily pilot operations

Track daily:

- active stores
- quick reward usage count
- trial -> starter upgrades
- direct promo sends
- support issues

Roll forward every 48h with small fixes only.

---

## 6) Rollback plan

If major issue:

1. Roll back to previous backend deployment.
2. Keep frontend as-is or roll back to previous Vercel deployment.
3. Restore DB from backup if needed.

---

## Notes

- For pilot scale, SQLite is acceptable if persisted and backed up.
- For larger rollout, move backend DB to managed Postgres.
