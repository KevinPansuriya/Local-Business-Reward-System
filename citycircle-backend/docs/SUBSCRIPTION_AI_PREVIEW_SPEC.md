# Subscription + AI Preview Spec (Pre-Billing Phase)

## Purpose

Define a subscription-ready product model now, without implementing payment yet.  
Goal: launch plan structure, trial UX, and AI preview usage data so billing can be plugged in later.

---

## Current Stage Decision

- **Do now:** plan model, feature gating, trial state, AI preview (limited/manual approval)
- **Do later:** payment gateway, invoicing, failed payment handling, proration

---

## Proposed Plan Structure (No Payment Yet)

### Plan IDs

- `trial`
- `starter`
- `growth`
- `pro`

### Customer-facing labels (Store Portal)

- `Trial (14 days)`
- `Starter (Coming soon)`
- `Growth (Coming soon)`
- `Pro (Coming soon)`

---

## Feature Matrix (Draft)

| Feature | Trial | Starter | Growth | Pro |
|---|---|---|---|---|
| Store profile setup | Yes | Yes | Yes | Yes |
| Promotions / updates / posts | Limited | Yes | Yes | Yes |
| Content scheduling | Basic | Basic | Advanced | Advanced |
| Notification controls | Basic | Yes | Yes | Yes |
| Analytics window | 7 days | 30 days | 90 days | 365 days |
| Team members | 1 | 2 | 5 | 15+ |
| AI caption generator | Limited beta | Monthly credits | Higher credits | Highest credits |
| AI rewrite tones | Limited beta | Yes | Yes | Yes |
| AI campaign ideas | Limited beta | Yes | Yes | Yes |
| Priority support | No | No | Yes | Yes |
| Multi-location controls | No | No | No | Yes |

---

## AI Scope for Current Phase (Recommended)

## Keep

- AI caption generator for promotion/update/post
- AI rewrite assistant (shorter/friendlier/urgent)
- AI promo idea suggestions (3 options)
- Human review required before publish

## Avoid for now

- Fully automated campaign publishing
- Predictive churn modeling as a promised feature
- Complex cross-channel orchestration

---

## Usage Limits (Pre-Billing)

Use soft limits now to simulate paid tiers and collect data:

- Trial: `5` AI generations/day
- Starter mock: `100` AI generations/month
- Growth mock: `300` AI generations/month
- Pro mock: `1000` AI generations/month

If limit reached, show:
- `You reached your AI preview limit. Upgrade options coming soon.`

---

## Data Model Changes (Phase: Pre-Billing)

Add store subscription state fields (new table recommended):

Table: `store_subscriptions`

- `id`
- `store_id` (unique)
- `plan_id` (`trial|starter|growth|pro`)
- `plan_status` (`active|trialing|past_due|canceled`)
- `trial_start_at`
- `trial_end_at`
- `current_period_start_at` (nullable for now)
- `current_period_end_at` (nullable for now)
- `ai_quota_monthly`
- `ai_used_current_period`
- `created_at`
- `updated_at`

No payment provider columns required yet.

---

## Backend Implementation Steps (Now)

1. Add `store_subscriptions` table + migration.
2. Seed existing stores into `trial` status.
3. Add helper:
   - `getStorePlan(storeId)`
   - `canUseFeature(storeId, featureKey)`
   - `consumeAiCredits(storeId, amount=1)`
4. Gate selected endpoints:
   - content creation frequency/limits
   - analytics range
   - AI generation endpoint usage
5. Add admin visibility endpoint:
   - `GET /api/admins/store-subscriptions` (plan/trial usage)

---

## Frontend Implementation Steps (Now)

Store Portal:

1. Add `Plan & Usage` card:
   - plan name
   - trial days left
   - AI usage consumed/limit
2. Show feature lock badges:
   - `Growth feature (coming soon)`
3. Add AI assistant panel in content composer:
   - generate caption
   - rewrite tone
   - suggestions list
4. Keep manual approval workflow:
   - user inserts AI text explicitly

---

## Metrics to Track Before Billing

- Stores activated trial
- Trial day-1/day-7 retention
- AI feature usage rate
- Avg AI generations/store/week
- Posts published with AI assistance
- Top requested “locked” features

These metrics will guide final pricing and tier boundaries.

---

## Release Phasing

### Phase A (now)
- Subscription model + gating + AI preview
- No payment

### Phase B
- Stripe (or equivalent) checkout
- Plan upgrade/downgrade
- Billing webhooks

### Phase C
- AI automation upgrades
- Advanced segmentation and campaign recommendations

---

## Risks / Mitigations

- **Risk:** users expect paid plans immediately  
  **Mitigation:** label clearly as `Coming soon`, keep trial messaging explicit.

- **Risk:** AI quality inconsistency  
  **Mitigation:** require human review + feedback thumbs up/down.

- **Risk:** overbuilding before PMF  
  **Mitigation:** ship small AI scope first and measure usage.

