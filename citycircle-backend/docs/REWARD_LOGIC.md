# CityCircle Reward Logic — Reference

This document describes how reward (Loops) points are calculated and applied in CityCircle, for future reference.

---

## 1. When points are earned (check-in)

On **check-in** (`POST /api/users/check-in`), the system:

1. **Resolves the store** (from QR or `storeId`) and ensures the user is allowed to check in (e.g. `canCheckIn` / category profile).
2. **Gets the base points** for that store:
   - **Store override:** `store_offers.reward_points` if set and > 0  
   - **Else:** category profile `base_points` (default **10**)
3. **Applies the store’s active reward schedule** via `getEffectiveStoreRewardPoints(storeId, fallbackBaseLoops)`:
   - Looks up **one** active row in `store_reward_point_schedules` where **now** is between `start_at` and `end_at` and `is_active = 1`.
   - **If no schedule:** effective base = fallback (from step 2).
   - **If schedule mode = `"multiplier"`:**  
     `effectivePoints = round(fallback × multiplier)` (multiplier clamped 0.5–2.0).
   - **If schedule mode = `"fixed"`:**  
     `effectivePoints = schedule.fixed_points` (points clamped 5–50).
4. **Applies user multipliers:**
   - **Plan:** STARTER=1.0, BASIC=1.1, PLUS=1.15, PREMIUM=1.2  
   - **Loyalty tier:** from `users.total_loops_earned` → Bronze 1.0, Silver 1.05, Gold 1.1, Platinum 1.2, Diamond 1.35  

   **Formula:**  
   `totalLoops = round(baseLoops × planMultiplier × tierMultiplier)`  
   where `baseLoops = effectivePoints` from step 3.
5. **Splits into instant vs pending** using the category profile’s `pending_ratio` (0 = all instant, 1 = all pending):
   - `instantLoops = round(totalLoops × (1 - pending_ratio))`  
   - `pendingLoops = totalLoops - instantLoops`
6. **Credits instant points** to `users.loops_balance` and `users.total_loops_earned`, and logs in `loops_ledger` as `EARN`.
7. **If `pendingLoops > 0`:** inserts a row in `pending_points` (linked to the check-in session), with `expires_at` = now + profile’s `dvs_expiry_days` (e.g. 7 days). Later, when the session is completed, **CIV (location) score** can reduce the pending amount (e.g. 100%/70%/30% based on confidence) before it becomes eligible to unlock.

So: **one check-in → one “base” from store/category, modified by store schedule and user plan/tier, then split into instant + pending.**

---

## 2. Store-level reward schedules (effective base)

- **Table:** `store_reward_point_schedules`  
  Fields: `store_id`, `name`, `reason`, `mode` (`fixed` | `multiplier`), `fixed_points`, `multiplier`, `start_at`, `end_at`, `is_active`.
- **Active schedule:** The single row where `store_id`, `is_active = 1`, and **current time** is in `[start_at, end_at]` (picked with `ORDER BY start_at DESC, created_at DESC LIMIT 1`).
- **Guardrails:**
  - Fixed points: clamped to **5–50**.
  - Multiplier: clamped to **0.5–2.0**.

Store owners can run promotions (e.g. “Holiday 15 pts” or “1.2×”) that change the **base** used in the formula above; the same plan and tier multipliers always apply on top.

---

## 3. Loyalty tiers (user multiplier)

- **Tiers:** Bronze (0), Silver (500+), Gold (2k+), Platinum (6k+), Diamond (15k+), based on **lifetime** `total_loops_earned`.
- **Multipliers:** 1.0, 1.05, 1.1, 1.2, 1.35.
- Tier is derived by `getTierProgress(total_loops_earned)` and applied as `tierMultiplier` in the check-in formula above.  
So **second and later visits** use the same formula; if the user has earned more total Loops, their tier (and thus multiplier) can be higher on later visits.

---

## 4. Pending points and when they unlock

- **Pending** = points that are not added to balance immediately; they sit in `pending_points` with `status = 'pending'` and an expiry.
- They **unlock** when **any** of these settlement triggers fires (checked by `checkSettlementTriggers`):
  1. **Return visit:** Another check-in at the **same store** within 7 days of the pending row’s `created_at`.
  2. **Reward redemption:** User redeems (spends Loops) at that store within 7 days.
  3. **Another purchase:** Another **transaction** at that store within 7 days.
  4. **Related visit:** A check-in at another store in the **same category** within 7 days.

When a trigger fires, `unlockPoints()` sets the row to `unlocked`, sets `loops_unlocked = loops_pending`, adds that amount to `users.loops_balance` and `total_loops_earned`, logs in `loops_ledger`, and emits a `points-unlocked` event.  
If they’re not unlocked before `expires_at`, they are marked **expired** and never credited.

---

## 5. End-to-end flow (summary)

```
Store base (store_offers or category base_points)
    → Apply active store schedule (fixed override or multiplier on that base)
    → baseLoops
    → × planMultiplier × tierMultiplier
    → totalLoops
    → Split by pending_ratio → instantLoops + pendingLoops
    → Instant: credit balance + total_loops_earned + ledger
    → Pending: insert pending_points; later unlock by return visit / redemption / purchase / related visit, or expire
```

**In short:** reward logic = store base (with optional schedule) × plan × tier, then instant vs pending with DVS-style unlock rules.

---

## Key code locations (server.js)

| Concept | Location (approx) |
|--------|--------------------|
| Loyalty tiers | `LOYALTY_TIERS`, `getTierProgress`, `getPlanMultiplier`, `getTierMultiplier` |
| Check-in reward calculation | `POST /api/users/check-in` (base, effective schedule, plan/tier, instant/pending split) |
| Effective store points | `getEffectiveStoreRewardPoints`, `getActiveRewardScheduleForStore` |
| Schedule guardrails | `normalizeScheduleFixedPoints`, `normalizeScheduleMultiplier` (5–50 pts, 0.5–2.0 mult) |
| Pending unlock triggers | `checkSettlementTriggers`, `unlockPoints` |
| Expired pending | `checkExpiredPendingPoints` |
