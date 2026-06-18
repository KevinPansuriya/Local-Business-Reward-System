# Admin: Tracking Visibility & Email Notifications

Admins can see **all tracking** (events, funnel, activity) and receive **email notifications** when new customers or stores join and when major events happen.

---

## How to verify events are stored and tracked

1. **Quick check (summary)**  
   Call **`GET /api/admins/analytics/summary`** with your admin token. The response includes:
   - **`total_events`** – total rows in `analytics_events`
   - **`events_last_24h`** – events in the last 24 hours
   - **`by_type`** – count per `event_type` (e.g. signup_completed, first_checkin, store_claimed, store_request)
   - **`latest_event`** – most recent event (type, actor, time)
   - **`table_exists`** – `true` if the table is present  
   If `total_events` increases after a signup, check-in, or store request, events are being stored.

2. **List recent events**  
   **`GET /api/admins/analytics/events?limit=50`** – returns the latest 50 events (with optional filters: `event_type`, `actor_type`, `from`, `to`).

3. **Funnel counts**  
   **`GET /api/admins/analytics/funnel`** – returns counts per event type (optionally with `from`/`to`). Use this to confirm signup_completed, first_checkin, store_claimed, store_request are all incrementing.

4. **Activity digest**  
   **`GET /api/admins/activity?days=7`** – returns `recent_events` (last 50) plus new users, new stores, store requests. Confirms events appear alongside other activity.

5. **Database (optional)**  
   Query directly:  
   `SELECT event_type, COUNT(*) FROM analytics_events GROUP BY event_type;`  
   and  
   `SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 20;`

---

## 1. What admin can see (tracking)

All of this is available to authenticated **admin** users via the API (and can be surfaced in an admin dashboard).

### Summary (quick health check)

- **Endpoint:** `GET /api/admins/analytics/summary`
- **Auth:** Admin token required.
- **Returns:** `total_events`, `events_last_24h`, `by_type` (count per event_type), `latest_event`, `table_exists`. Use this to confirm that events are being stored.

### Events (raw)

- **Endpoint:** `GET /api/admins/analytics/events`
- **Auth:** Admin token required.
- **Query params:** `event_type`, `actor_type`, `from`, `to`, `limit` (default 100, max 500).
- **Returns:** List of `analytics_events` rows: `id`, `event_type`, `actor_type`, `actor_id`, `session_id`, `payload`, `utm_source`, `utm_medium`, `utm_campaign`, `ip_address`, `created_at`.

So admin can see every tracked event (signups, first check-in, store claimed, store request, etc.) and filter by type or date.

### Funnel (counts)

- **Endpoint:** `GET /api/admins/analytics/funnel`
- **Query params:** `from`, `to` (ISO date/datetime strings).
- **Returns:** Counts per event type, e.g.:
  - `signup_started`
  - `signup_completed` (customer signups)
  - `first_checkin`
  - `store_claimed`
  - `store_request`

Use this for conversion and drop-off analysis.

### Activity (digest)

- **Endpoint:** `GET /api/admins/activity`
- **Query params:** `days` (default 7, max 90).
- **Returns:**
  - `new_users`: recent user signups (id, name, phone, created_at).
  - `new_stores`: recent store claims (id, name, category, created_at = claimed_at).
  - `store_requests`: recent store onboarding requests.
  - `recent_events`: latest analytics events.

Use this for a single “what’s new” view.

---

## 2. When admin gets an email

Emails are sent to **all admin emails** (from `admins` table, or override via `ADMIN_EMAILS` env). Each event type below triggers one email per occurrence (no batching in this version).

| Event | Subject (prefix) | When |
|-------|-------------------|------|
| **New customer signup** | `[CityCircle] New customer signup` | A customer completes `POST /api/users/signup`. Body includes name, phone, signup_source, UTM. |
| **New store claimed** | `[CityCircle] New store claimed` | A store completes `POST /api/stores/signup` (claim). Body includes store name, id, category. |
| **New store request** | `[CityCircle] New store request` | A customer submits a store request (`POST /api/users/store-requests`). Body includes store name, ref, user id. |

So: **new customers**, **new stores**, and **new store requests** all trigger an immediate admin email.

---

## 3. How admin emails are configured

- **Recipients:** All rows in `admins` with non-empty `email`, unless `ADMIN_EMAILS` is set in the environment (comma-separated), in which case only those addresses are used.
- **SMTP:** Configure in `.env`:
  - `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`
  - `SMTP_SECURE` (optional; `true` for 465 SSL, `false` for 587 STARTTLS)
  - `ADMIN_FROM_EMAIL` (optional; defaults to `SMTP_USER` or `noreply@citycircle.app`)
- If SMTP is **not** configured, no email is sent; in non-production the server may log “Would send to: …” instead.
- **Logging:** When the table `admin_email_log` exists, each send is logged (event_type, subject, recipient_count). This is created by the same migration that adds tracking.

### Gmail quick setup

1. Enable **2-Step Verification** on the Gmail account.
2. Create a Gmail **App Password** (Google Account -> Security -> App passwords).
3. Set env values:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_SECURE=false`
   - `SMTP_USER=<your_gmail>@gmail.com`
   - `SMTP_PASS=<16-char app password>`
   - `ADMIN_FROM_EMAIL=<your_gmail>@gmail.com`

---

## 4. Event types stored (for analysis & automation)

These are the `event_type` values stored in `analytics_events` and used in funnel/activity:

| event_type | Description |
|------------|-------------|
| `page_view` | Anonymous or logged-in user viewed a page (sent from frontend). |
| `app_open` | User opened the app (sent from frontend). |
| `signup_started` | User opened or submitted the signup form (sent from frontend). |
| `signup_completed` | Backend recorded a new user (customer). |
| `first_checkin` | User’s first check-in ever (any store). |
| `store_claimed` | Backend recorded a store claim (store signup). |
| `store_request` | Customer submitted a store request. |
| `store_request_duplicate` | Customer tried to request a store they already requested (optional to record). |

Admin can see all of these in **Events** and **Activity**, and use **Funnel** for conversion analysis.

---

## 5. Structure summary

- **Tracking:** Stored in `analytics_events` (and existing tables like `users`, `stores`, `store_onboarding_requests`). Admin sees everything via the three endpoints above.
- **Emails:** Sent only for **new customer signup**, **new store claimed**, and **new store request**. Same events are also stored as `signup_completed`, `store_claimed`, and `store_request` in `analytics_events`.
- **Config:** Admin recipients from DB or `ADMIN_EMAILS`; SMTP from env. Optional `admin_email_log` for audit.

To add more “major events” (e.g. first redemption, or 100th check-in milestone), add a new event type, call `recordAnalyticsEvent` and optionally `sendAdminNotificationEmail` in the right handler, and document it here.
