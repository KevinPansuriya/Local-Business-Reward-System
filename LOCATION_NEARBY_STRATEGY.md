## Location & Nearby Stores Strategy (Customer Home Address)

### Goal
Show nearby local businesses where customers can earn rewards, based on:
- Customer home address (primary location)
- Subscription plan limits (3, 5, or 7 stores)
- Local-only businesses (exclude chains/franchises for now)

---

## 1) Core Rules (Business Logic)

### Plan-based store limits
- **BASIC**: show 3 nearby stores
- **PLUS**: show 5 nearby stores
- **PREMIUM**: show 7 nearby stores

### Local-only filter
Until chains are supported:
- **Include**: independent/local businesses
- **Exclude**: franchise chains, national brands, multi-location corporate

---

## 2) Data Requirements

### Current fields (already in DB)
- `stores.latitude`
- `stores.longitude`
- `stores.category`
- `stores.address`

### Add/confirm fields for local-only filtering
Add to `stores` (or maintain in admin UI):
- `is_local` (boolean, default true)
- `brand_name` (string, optional)
- `chain_id` (nullable)

**Filtering rule (phase 1):**
```
WHERE is_local = 1
```

---

## 3) Distance Calculation (Haversine)
Compute distance from customer home coordinates to store coordinates.
Sort by distance ascending.

**Example**:
- Customer home: (lat, lng)
- Store A: 0.6 miles
- Store B: 1.3 miles
- Store C: 2.1 miles
Return the closest N (N depends on plan)

---

## 4) Clustering Concept (3/5/7-store “cluster”)

We define a **cluster** as:
> The closest N local stores within a radius that adapts to density (dense city vs suburb), ranked by distance.

### Density‑based radius (recommended defaults)
- **Dense city** (NYC, SF, etc.): **0.5–1.0 mile**
- **Urban**: **1.5–2.5 miles**
- **Suburban**: **3–5 miles**
- **Rural**: **5–10 miles**

### How to classify density
Pick one (start simple):
1. **City‑based list** (fastest):
   - If `user.city` in `DENSE_CITIES`, use 0.5–1.0 miles
2. **Store density** (better):
   - Count stores within 1 mile of user
   - If count ≥ 20 → dense city radius
   - If count 10–19 → urban radius
   - If count 4–9 → suburban radius
   - If count ≤ 3 → rural radius

### Radius fallback
If radius returns fewer than plan limit:
- Expand radius by +1 mile (max 10)
- Repeat until limit reached or max radius hit

### If fewer stores in radius
Return all that exist, and show a friendly message:
> “We found 4 local stores near you. More coming soon.”

---

## 5) Recommendation Tie‑Breakers (Optional)
If multiple stores at similar distance:
1. Higher customer rating (future)
2. Higher visit frequency (future)
3. Category mix to avoid duplicates (optional)

Default for now: **distance only**

---

## 6) UI/UX Strategy (Customer)

### Home tab card
Show:
- “Stores Near You” header
- “You can access up to X stores” (based on plan)
- List of store cards with:
  - Name + category
  - Distance (miles)
  - “Earn loops here” badge
  - CTA: “View store” or “Check in”

### Map view (optional later)
Show cluster on a map with pins.

---

## 7) Backend API Design

### Endpoint
`GET /api/stores/nearby?limit=3`

**Inputs**:
- Customer home coordinates (from user profile)
- Plan tier to determine limit

**Logic**:
1. Validate customer has home location.
2. Get limit from plan.
3. Filter: `is_local = 1`.
4. Compute distance and return top N.

**Response**
```
{
  "limit": 5,
  "stores": [
    { "id": 1, "name": "Grove Coffee", "category": "coffee", "distance_miles": 0.7 },
    ...
  ]
}
```

---

## 8) Plan Limit Mapping

```
const planStoreLimit = {
  STARTER: 3,
  BASIC: 3,
  PLUS: 5,
  PREMIUM: 7
}
```

---

## 9) Customer Home Location

### Source of truth
Use user profile home address:
- `users.address`
- `users.latitude`
- `users.longitude`

### If missing
Fallback options:
1. Prompt customer to set home location
2. Allow temporary location via GPS (optional)

---

## 10) Admin & Store Setup

### Store onboarding
During store signup:
- Require address + lat/lng
- Ask “Is this a local independent business?”

### Admin moderation
If unclear, admins can override `is_local`.

---

## 11) Rollout Plan

### Phase 1 (Now)
- Local-only filter
- Distance ranking
- Plan-based limit (3/5/7)
- Simple list UI

### Phase 2
- Category balance
- Rating signals
- Map view

### Phase 3
- Add franchises as separate “chain” mode

---

## 12) Example User Flows

### BASIC User
1. Open app
2. “Stores Near You” shows 3 closest local stores
3. Can earn loops only at those stores

### PREMIUM User
1. Open app
2. Sees 7 stores nearby
3. More store variety across categories

---

## 13) Next Engineering Tasks

1. Add `is_local` field to `stores`
2. Create `/api/stores/nearby` endpoint
3. Add plan-based limit in backend
4. Add “Stores Near You” UI on customer home screen
5. Add admin control to set `is_local`
