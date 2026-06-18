# CityCircle: Customer & Store Tracking, Analysis, and Growth Strategy

This document describes **what you track today**, **gaps for analysis/automation**, **how to track new visitors**, and **strategies to reach more store owners and customers**.

---

## 1. What You Track Today

### Customers (already in the system)

| Data | Where | Use |
|------|--------|-----|
| **Identity** | `users` (phone, email, name, address, plan, loops_balance, total_loops_earned) | Who they are, tier, balance |
| **Check-ins** | `check_in_sessions` (user_id, store_id, checked_in_at, status) | Visit frequency, which stores, when |
| **Location** | `location_history` (session_id, lat/lng) | CIV, proximity |
| **Earn/Spend** | `loops_ledger` (EARN, REDEEM + meta) | Points earned and redeemed |
| **Pending points** | `pending_points` | Delayed rewards, unlock triggers |
| **Store membership** | `store_slots`, `store_memberships`, `store_unlocks` | Which stores they’re in, free vs paid |
| **Store requests** | `store_onboarding_requests` (user_id, store ref/name, status) | Demand signals, lead scoring |
| **Notifications** | `notifications` (user_id, type, title, message, is_read) | What they were told, read state |
| **Gift cards** | `gift_cards`, `gift_card_transactions` | Creation, usage, value |
| **Content engagement** | `store_content_likes` | Likes on promotions/updates/posts |

**Note:** If `users` does not have `created_at`, add it (migration) so you can measure “new signups” and cohort age.

### Store owners (already in the system)

| Data | Where | Use |
|------|--------|-----|
| **Identity** | `stores` (name, zone, category, claimed_at, qr_code) | Partner vs unclaimed, category |
| **Claim/signup** | `claimed_at`, claim_code usage | When they joined CityCircle |
| **Reward config** | `store_offers`, `store_reward_point_schedules`, `store_reward_preferences` | How they reward customers |
| **Holiday actions** | `store_reward_holiday_actions` | Response to holiday reminders |
| **Content** | `store_promotions`, `store_updates`, `store_posts` | Engagement and activity |
| **Store requests** | `store_onboarding_requests` (by store ref/place_id) | Demand for that store (hot leads) |

You can already do **analysis** on: visit counts, loops per user/store, top stores, top customers, store request counts (lead heat), and reward schedule usage.

---

## 2. Gaps for Deeper Analysis and Automation

- **No “first touch” for users**  
  You don’t know how someone arrived (e.g. link, ad, referral, “new user on website”) until they sign up. So you can’t attribute signups to channel or campaign.

- **No funnel events**  
  You have outcomes (signup, check-in, redeem) but not a unified funnel like: `landing_view → signup_start → signup_complete → first_checkin → first_redeem`. That limits funnel analysis and automation triggers.

- **No anonymous/visitor tracking**  
  Before login, you don’t track: page/screen views, time on site, or “started signup but didn’t finish.” So you can’t optimize landing or signup flow.

- **No marketing automation triggers**  
  You have notifications (in-app), but no structured “when X happens, send email/SMS or run campaign” (e.g. new user → welcome series; inactive 7 days → re-engagement).

- **No UTM / source fields**  
  You don’t store where a user or store came from (utm_source, utm_medium, utm_campaign, referral). So you can’t measure which channels drive signups.

Fixing these (see below) enables **analysis** (funnels, cohorts, retention) and **automation** (welcome, re-engagement, store-owner nudges).

---

## 3. How to Track New Visitors and Signups (Website/App)

Goal: know when a **new user** (or store) hits your website/app and what they do before and after signup.

### Option A: Lightweight – backend-only events

1. **Add an events table** (e.g. `user_events` or `analytics_events`):
   - `id`, `event_type`, `actor_type` ('anonymous' | 'user' | 'store'), `actor_id` (nullable), `session_id` (browser/app session), `payload` (JSON), `utm_source`, `utm_medium`, `utm_campaign`, `created_at`.
2. **Add optional columns to `users` (and optionally `stores`):**
   - `created_at` (if missing), `signup_source` (e.g. 'web', 'app', 'referral'), `utm_source`, `utm_medium`, `utm_campaign`, `first_touch_at`.
3. **Expose a public (no-auth) endpoint:** e.g. `POST /api/events` or `POST /api/track`:
   - Body: `{ event_type, session_id, payload?, utm_source?, utm_medium?, utm_campaign? }`.
   - Validate and rate-limit by IP/session; insert into events table. For anonymous users, `actor_id` = null; after login, you can backfill or link by `session_id` if you store it at login.
4. **On signup (customer or store):**
   - Persist `signup_source` and UTM from the last event or from query/body (e.g. app sends UTM from deep link or web sends from URL). Set `created_at` / `first_touch_at`.
5. **Frontend (website/app):**
   - On load: read UTM from URL (or from app deep link) and send one “page_view” or “app_open” event with UTM.
   - On “Sign up” click: send “signup_started”.
   - Backend on successful signup: record “signup_completed” (with user_id).
   - After first check-in: record “first_checkin” (you can do this in existing check-in handler).

Result: you can analyze **new visitors** (anonymous events), **signup funnel** (started → completed), and **source** (UTM) for each signup.

### Option B: Use a third-party analytics tool

- **Web:** Google Analytics 4, Plausible, PostHog, Mixpanel, etc.  
  - Track: page views, scrolls, “Sign up” clicks, and (if you send user_id after login) link to same user across anonymous → signed-in.  
  - Pass UTM from URL into the tool; optionally send “signup_completed” and “first_checkin” as server-side or client events.
- **App:** Same tools often have mobile SDKs; or use Firebase Analytics / Amplitude.  
  - Send “app_open”, “signup_started”, “signup_completed”, “first_checkin” with optional UTM/referrer.

Recommendation: do **Option A** for a single source of truth and full control (funnels, automation, UTM in your DB). Option B can run in parallel for dashboards and no-code analysis.

---

## 4. Strategy to Reach More Customers

- **Attract**
  - **Landing page + UTM:** One clear landing (e.g. “Earn rewards at local stores”) with UTM on all links (social, ads, email). Track visits and signups by UTM so you know what works.
  - **Local SEO / content:** “Rewards at [city] stores,” “Support local [category].” Drives organic traffic; track via UTM or referrer.
  - **Referrals:** “Invite a friend – you both get X Loops.” Store referrer_id in `users` or in events; reward both sides. Use events to measure referral signups and first check-in.

- **Convert**
  - **Simplify signup:** Short form (phone + name + password). Track “signup_started” vs “signup_completed” to find drop-off.
  - **First check-in incentive:** Extra points or badge for first check-in in first 7 days. Trigger in-app (and later email/SMS if you add it) from “signup_completed” and “first_checkin” events.

- **Retain**
  - **Segments from existing data:** New (e.g. created_at &lt; 7 days), Active (check-in in last 7/30 days), Dormant (no check-in 30+ days), Power (e.g. 5+ stores or 3+ check-ins/week). Use `check_in_sessions` and `users.created_at`.
  - **Automation (once you have events):**  
    - New: welcome in-app message + optional email/SMS “Complete your first visit to unlock points.”  
    - Dormant: “We miss you – here are 3 stores near you” (use location + nearby-eligible).  
  - **Notifications you already have:** Use them for new promotions, “Store you requested just joined,” points unlocked. Keep pushing value, not noise.

- **Re-engage**
  - **Pending points:** Remind users with pending points (e.g. “Return to [store] to unlock X Loops”). You already have the data in `pending_points`.
  - **Store requests:** When a requested store joins, you already auto-join and notify; highlight that in messaging (“You asked, they joined – start earning today”).

---

## 5. Strategy to Reach More Store Owners

- **Prove demand**
  - **Store request leads:** You already have `store_onboarding_requests`. Use counts per store/place_id as “X customers want you on CityCircle.” Show this in sales materials and in admin lead queue (hot scoring).
  - **Category/zone reports:** “In your zone, Y stores like yours are on CityCircle and see Z visits/month.” Use aggregates from `check_in_sessions` and `stores` (no PII).

- **Lower friction**
  - **Claim flow:** Short claim flow (e.g. code → store details → QR). Track “claim_started” vs “claim_completed” (events or store `claimed_at`) to optimize.
  - **Guided rewards:** You have “guided” and “auto” modes; push “set up in one tap” and holiday reminders so lazy owners still get value.

- **Nurture**
  - **Lifecycle:** New (just claimed), Active (regular check-ins at their store), Inactive (no check-ins for 14+ days). Use `check_in_sessions` and `stores.claimed_at`.
  - **Automation:**  
    - New: “Add your first promotion” or “Turn on holiday rewards.”  
    - Inactive: “Your store had no scans last week – try a 1.2× weekend boost” (use existing recommendation logic).

- **Expand**
  - **Multi-location:** If one owner has several locations, show performance per store and “replicate rewards” from best-performing store.
  - **Local partnerships:** Use zone/category to suggest “Stores like yours” or local events to join (future feature; tracking zone/category supports it).

---

## 6. Suggested Implementation Order

1. **Add `created_at` to `users` (and optionally `stores`)** if missing – migration only.  
2. **Add UTM/source to signup:**  
   - Optional columns on `users` (and `stores`): `signup_source`, `utm_source`, `utm_medium`, `utm_campaign`.  
   - Accept these in signup API from frontend (URL params or body); store on the user/store row.  
3. **Add a simple events table + `POST /api/events`:**  
   - Event types: e.g. `page_view`, `app_open`, `signup_started`, `signup_completed`, `first_checkin`, `store_request`.  
   - Include `session_id`, optional `actor_id`, and UTM.  
4. **Frontend:** On landing/app open, send one event with UTM; on signup click send `signup_started`; backend sends `signup_completed` (and later `first_checkin` in check-in handler).  
5. **Analysis:** Build small dashboards or SQL views: signups by day, by UTM; funnel signup_started → signup_completed → first_checkin; store requests by store/zone.  
6. **Automation:** Use events + segments (new/dormant users; new/inactive stores) to trigger in-app notifications first; add email/SMS later if you have channels.

This gives you **tracking** (who came, from where, what they did), **analysis** (funnels, cohorts, retention), and **automation** (welcome, re-engagement, store nudges) without a big bang.

---

## 7. Summary Table

| Goal | What you have | What to add |
|------|----------------|-------------|
| Track customers | users, check_ins, ledger, pending, slots, requests, notifications | `created_at`, UTM/source on signup, optional events |
| Track store owners | stores (claimed_at), reward config, holiday actions, store_requests | `created_at`, UTM/source on claim, optional events |
| New visitor / funnel | Nothing | Events table + `POST /api/events`, UTM, signup_started/completed, first_checkin |
| Analysis | Analytics endpoints (customer/store/system) | Funnel and cohort views using events + created_at |
| Automation | In-app notifications | Triggers based on events + segments (new, dormant, inactive store) |
| Reach more customers | Notifications, store requests | UTM, referral, first-check-in incentive, dormant re-engagement |
| Reach more store owners | Store request leads, reward tools | Demand reports, claim funnel tracking, new/inactive store nudges |

---

## 8. Admin: Who sees tracking and who gets emails

- **Admin sees all tracking:** Events, funnel, and activity are available only to authenticated admins via:
  - `GET /api/admins/analytics/events` – raw events (with filters).
  - `GET /api/admins/analytics/funnel` – funnel counts.
  - `GET /api/admins/activity` – digest (new users, new stores, store requests, recent events).
- **Admin email notifications:** When a **new customer** signs up, a **new store** is claimed, or a **store request** is submitted, the backend sends an email to all admin emails (from `admins` table or `ADMIN_EMAILS` env). SMTP is configured via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `ADMIN_FROM_EMAIL`.
- See **`docs/ADMIN_TRACKING_AND_EMAILS.md`** for full structure (what admin sees, when emails are sent, and how to configure).
