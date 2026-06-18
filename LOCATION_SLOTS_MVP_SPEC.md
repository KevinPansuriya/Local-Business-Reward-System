## Product Spec: Store Slots + Nearby Discovery (Local-Only)

### 1) Summary
Replace fixed bundles with **store slots** tied to plan, and show nearby **local-only** stores. Users activate stores by first check‑in, and can keep earning for the cycle. Discovery uses multi‑anchors (home/work/frequent zone) with privacy‑safe storage.

---

## 2) Goals
- Increase perceived fairness and control
- Reduce frustration from forced store lists
- Enable real‑world flexibility (home + work + commute)
- Prioritize local businesses (no chains yet)

---

## 3) Non‑Goals (MVP)
- No franchise/chain support
- No guest passes
- No exposure budget optimization
- No auto chain detection

---

## 4) User Stories

### Customer
- As a user, I can see nearby local stores based on my plan (3/5/7).
- As a user, I can activate a store by checking in the first time.
- As a user, I can keep earning at activated stores for the cycle.
- As a user, I can see which stores are active vs not active.

### Store
- As a store, I want to be visible to nearby users if I’m local.

### Admin
- As an admin, I can mark a store as local or not.

---

## 5) Plan Limits (MVP)
```
STARTER/BASIC: 3 stores
PLUS: 5 stores
PREMIUM: 7 stores
```

---

## 6) Core Concepts

### Store Slot
An available slot allows a user to **activate** one store for the cycle.

### Active Store
An activated store is eligible for full rewards.

### Cycle
**Monthly** by default (MVP).

---

## 7) MVP Flow

### Discovery (AI‑Ranked)
1. User sets home location (required).
2. App fetches local stores near home.
3. AI ranks stores using signals (distance, category affinity, past visits).
4. Shows top N stores based on plan.

### Activation
1. User checks in at a store.
2. If store not active and slots remain → activate automatically.
3. If no slots → block check‑in with a clear message.

---

## 8) Data Model (MVP)

### New fields
`stores.is_local` (boolean, default true)

### New table
`store_slots`
```
id
user_id
store_id
cycle_month (YYYY-MM)
status ('active', 'inactive')
activated_at
```

---

## 9) API Endpoints (MVP)

### 1) Nearby stores
`GET /api/stores/nearby`
- Uses user home lat/lng
- Filters `is_local = 1`
- Limits by plan (3/5/7)

### 2) Active stores
`GET /api/users/:id/active-stores`
- Return list of active stores for this cycle

### 3) Activate on check‑in
`POST /api/users/check-in`
- If store not active:
  - If slots available → activate and proceed
  - Else → return error “No slots left”

---

## 10) UI (MVP)

### Home Tab
Card: “Stores Near You”
- Show limit: “You can activate 3 stores”
- Show list of stores with distance + category
- Badge: “Active” or “Available”

### Check‑in
If store inactive:
- If slots available → “Activated & Earned”
- Else → “No slots left. Upgrade or swap (future).”

---

## 11) MVP Risks
- Users may want to swap stores → defer to phase 2
- Users may move → add optional work anchor later
- Local vs chain edge cases → admin manual override first

---

# MVP Roadmap (Implementation Plan)

## Phase 0: Prep (1–2 days)
- Add `is_local` to `stores`
- Add admin toggle UI (simple)
- Add `VITE_TOMTOM_API_KEY` to frontend `.env` for TomTom tiles/nearby API

## Phase 1: Core (3–5 days)
- Create `store_slots` table
- Build `/api/stores/nearby`
- Add slot check into `POST /users/check-in`
- Add UI for “Stores Near You” list
 - Add AI ranking baseline (rule‑based weights, extensible)

## Phase 2: UX Polish (2–3 days)
- “Active” badge
- Empty state if no local stores
- Upgrade CTA if slots full

## Phase 3: Enhancements (Later)
- Store swap
- Guest pass
- Multi‑anchor discovery
- Exposure budget ranking
 - Promotions/discount personalization

---

## MVP Acceptance Criteria
- Basic user sees exactly 3 stores
- Plus user sees 5 stores
- Premium user sees 7 stores
- User cannot earn at non‑active stores if no slots left
- Store admin can mark `is_local` off
