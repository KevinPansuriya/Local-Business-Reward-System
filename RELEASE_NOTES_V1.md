# Release Notes (V1.0.0)

## Release Decision
- **Decision:** GO
- **Release Type:** Version 1 (web)
- **Date:** 2026-03-14

## Highlights
- Tracking tab simplified and corrected with reliable source-of-truth counts.
- Store requests list grouped by store name with request counts.
- High-demand store outreach flow added (`Notify store`) with backend cooldown protection.
- Customer feed enhanced with posted date + time labels.
- SMTP (Gmail) configured and verified for admin/store outreach notifications.

## Key V1 Deliverables

### Admin / Tracking
- `Store requests` KPI now uses `store_onboarding_requests` row count.
- `Stores claimed` KPI now uses `stores` where `claimed_at IS NOT NULL`.
- `Store requests (recent)` shows grouped rows with `request_count`.
- `Notify store` action added for `request_count >= 10`.
- Notify cooldown implemented (default `24h`) to prevent duplicate outreach.

### Customer
- Feed cards now display posted info with relative day and exact date/time.
- Store profile content cards also show posted date/time.

### Email / Outreach
- Gmail SMTP integrated and verified (`smtp.gmail.com:587`).
- Admin notification emails operational.
- Store outreach email operational when store email exists.
- SMS outreach kept disabled for V1 via feature flag.

## Test Summary (Pre-Release)

### Pre-flight
- PASS: Env validation (JWT, SMTP, cooldown flags)
- PASS: DB present and accessible
- PASS: Backend/frontend running
- PASS: SMTP verify check

### Functional QA
- PASS: Section 1 Auth & Session (user/store/admin)
- PASS: Section 2 Tracking KPI correctness + grouped requests
- PASS: Section 3 Notify flow + cooldown behavior
- PASS: Section 4 Feed timestamp support (API + UI code paths)
- PASS: Section 5 Store content CRUD (promotion/update/post)
- PASS: Section 6 Check-in + pending points + transaction/rewards
- PASS: Section 7 Notifications list/read/read-all
- PASS: Section 8 SMTP/email verification
- PASS: Section 9 Regression smoke (core APIs + frontend prod build)

## Environment Notes (V1)
- `STORE_NOTIFY_SMS_ENABLED=0` (intentionally disabled for now)
- `STORE_NOTIFY_COOLDOWN_HOURS=24`
- `SMTP_HOST/PORT/USER/PASS` configured and verified
- `JWT_SECRET` configured with strong random value

## Known Limitations
- SMS outreach exists in code but is disabled by feature flag for V1.
- Large frontend bundle warning exists (non-blocking; optimization follow-up).
- Final visual/manual UI polish checks remain post-deploy monitoring items.

## Post-Deploy Verification Checklist (Production)
- Admin login + tracking dashboard loads correctly.
- Notify store works and cooldown blocks repeats.
- Customer feed shows posted date/time on all card types.
- No critical server errors in logs during first 60 minutes.
