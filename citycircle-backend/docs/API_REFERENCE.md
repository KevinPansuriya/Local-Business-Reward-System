# CityCircle Backend API Reference

Base URL (local): `http://localhost:4000/api`

This document summarizes the active API routes defined in `citycircle-backend/server.js`, with practical request/response examples for common flows.

---

## Authentication

Most protected routes require:

```http
Authorization: Bearer <token>
```

Token types:

- User token (`role: user`)
- Store token (`role: store`)
- Admin token (`role: admin`)

---

## Common Response Patterns

Success:

```json
{
  "success": true
}
```

Error:

```json
{
  "error": "Human readable error message"
}
```

Some routes also return `details`, `message`, or data-specific fields.

---

## User APIs

### 1) Signup

`POST /users/signup`

Request:

```json
{
  "phone": "5512345678",
  "email": "user@example.com",
  "password": "secret123",
  "name": "Kevin",
  "address": "Union City, NJ"
}
```

Response (example):

```json
{
  "token": "<jwt>",
  "userId": 12,
  "qrCode": "USER:5512345678:abc123...",
  "needsLocation": true
}
```

### 2) Login

`POST /users/login`

Request:

```json
{
  "phone": "5512345678",
  "password": "secret123"
}
```

Response:

```json
{
  "token": "<jwt>",
  "userId": 12
}
```

### 3) Forgot Password

`POST /users/forgot-password`

Request:

```json
{
  "phone": "5512345678"
}
```

Response (example):

```json
{
  "success": true,
  "message": "If the account exists, a reset code was sent."
}
```

### 4) Reset Password

`POST /users/reset-password`

Request:

```json
{
  "phone": "5512345678",
  "code": "123456",
  "newPassword": "newSecret123"
}
```

Response:

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### 5) Get Current User

`GET /users/me` (auth user)

Response (trimmed example):

```json
{
  "user": {
    "id": 12,
    "name": "Kevin",
    "phone": "5512345678",
    "plan": "STARTER",
    "loops_balance": 250
  },
  "transactions": []
}
```

### 6) Feed

`GET /users/feed` (auth user)

Query params (optional):

- `radius` (default 10)
- `type` (`all|promotion|update|post`)
- `limit`
- `scope` (`local|discovery`)
- `category`
- `local_radius`

Example:

`GET /users/feed?scope=local&type=all&radius=10&limit=50`

Response (trimmed):

```json
{
  "content": [
    {
      "type": "promotion",
      "id": 11,
      "store_id": 4,
      "store_name": "Exxon Shop",
      "title": "QA Promo",
      "description": "10% off",
      "created_at": "2026-03-03T20:04:11.000Z",
      "like_count": 0,
      "liked_by_me": false
    }
  ]
}
```

### 7) Store Request by User

`POST /users/store-requests` (auth user)

Request:

```json
{
  "requested_store_name": "Hanaa Banana",
  "requested_store_ref": "optional-place-id",
  "note": "Please add this store"
}
```

Response (example):

```json
{
  "success": true,
  "request": {
    "id": 25,
    "requested_store_name": "Hanaa Banana",
    "status": "pending"
  }
}
```

### 8) Notifications

- `GET /users/notifications`
- `POST /users/notifications/:id/read`
- `POST /users/notifications/read-all`
- `GET /users/notification-preferences`
- `POST /users/notification-preferences`

---

## Store APIs

### 1) Store Signup (claim)

`POST /stores/signup`

Request:

```json
{
  "claimCode": "AB12CD34",
  "email": "owner@store.com",
  "phone": "5511112222",
  "password": "ownerSecret"
}
```

Response (example):

```json
{
  "token": "<store-jwt>",
  "storeId": 4,
  "name": "Exxon Shop"
}
```

### 2) Store Login

`POST /stores/login`

Request:

```json
{
  "phone": "5511112222",
  "password": "ownerSecret"
}
```

### 3) Store Profile / Me

- `GET /stores/me` (auth store)
- `PUT /stores/profile` (auth store)
- `PUT /stores/location` (auth store)

### 4) Store Content CRUD

Promotions:

- `GET /stores/promotions`
- `POST /stores/promotions`
- `PUT /stores/promotions/:id`
- `DELETE /stores/promotions/:id`

Updates:

- `GET /stores/updates`
- `POST /stores/updates`
- `PUT /stores/updates/:id`
- `DELETE /stores/updates/:id`

Posts:

- `GET /stores/posts`
- `POST /stores/posts`
- `PUT /stores/posts/:id`
- `DELETE /stores/posts/:id`

Archive helpers:

- `POST /stores/content/:type/:id/archive`
- `POST /stores/content/:type/:id/unarchive`

Create promotion request example:

```json
{
  "title": "Future Promo",
  "description": "Not yet",
  "discount_type": "percent",
  "discount_value": 10,
  "media_urls": []
}
```

### 5) Store Customers / Transactions

- `POST /stores/scan-customer`
- `GET /stores/customer/:userId`
- `GET /stores/customers-today`
- `POST /stores/transaction`
- `GET /stores/members`

### 6) Store Reward Automation

- `PUT /stores/offer`
- `GET /stores/reward-schedules`
- `POST /stores/reward-schedules`
- `PUT /stores/reward-schedules/:id`
- `GET /stores/reward-preferences`
- `PUT /stores/reward-preferences`
- `GET /stores/reward-recommendations`
- `POST /stores/reward-recommendations/:recommendationId/apply`
- `GET /stores/reward-holiday-reminders`
- `POST /stores/reward-holiday-reminders/:reminderId/respond`

### 7) Store Password Reset

- `POST /stores/forgot-password`
- `POST /stores/reset-password`

### 8) Store Blacklist

- `GET /stores/blacklist`
- `POST /stores/blacklist`
- `DELETE /stores/blacklist/:userId`

---

## Admin APIs

### 1) Admin Auth

- `POST /admins/signup`
- `POST /admins/login`
- `GET /admins/me`

### 2) Admin User Management

- `GET /admins/users`
- `GET /admins/users/:id`
- `PUT /admins/users/:id`
- `DELETE /admins/users/:id`
- `GET /admins/users/:id/stores`

### 3) Admin Store Management

- `GET /admins/stores`
- `GET /admins/stores/:id`
- `PUT /admins/stores/:id`
- `DELETE /admins/stores/:id`
- `GET /admins/stores/:id/customers`
- `PUT /admins/stores/:id/offer`
- `POST /admins/stores/backfill-phones`
- `POST /admins/stores/:id/claim-code`
- `GET /admins/stores/:id/reward-profile`
- `PUT /admins/stores/:id/reward-profile`
- `DELETE /admins/stores/:id/reward-profile`

### 4) Admin Category Profiles

- `GET /admins/category-profiles`
- `PUT /admins/category-profiles/:category`

### 5) Admin Tracking / Analytics

- `GET /admins/analytics/events`
- `GET /admins/analytics/events/by-actor/:actorType/:actorId`
- `GET /admins/analytics/summary`
- `GET /admins/analytics/funnel`
- `GET /admins/activity`

### 6) Admin Store Requests

- `GET /admins/store-requests`
- `PUT /admins/store-requests/:id/status`
- `POST /admins/store-requests/notify`

Notify request example:

```json
{
  "requested_store_name": "Hanaa Banana",
  "request_count": 12
}
```

Notify response example:

```json
{
  "success": true,
  "sentToStore": true,
  "sentEmail": true,
  "sentSms": false,
  "cooldown_hours": 24,
  "message": "email sent to owner@example.com"
}
```

Cooldown response example (`429`):

```json
{
  "error": "Store was already notified recently. Please try again after cooldown.",
  "cooldown_active": true,
  "cooldown_until": "2026-03-04T02:17:00.000Z"
}
```

### 7) Admin Missing Reward Reports

- `GET /admins/missing-reward-reports`
- `PUT /admins/missing-reward-reports/:id/status`

---

## Gift Card / Nearby / Discovery APIs

User gift cards:

- `POST /users/gift-cards/create`
- `GET /users/gift-cards/eligibility`
- `GET /users/gift-cards`
- `GET /users/gift-cards/:id`

Store gift cards:

- `POST /stores/scan-gift-card`
- `GET /stores/pending-physical-gift-cards`
- `POST /stores/issue-physical-gift-card/:id`
- `POST /stores/use-gift-card`

Discovery / nearby:

- `GET /stores/nearby`
- `GET /stores/nearby-osm`
- `GET /stores/nearby-eligible`
- `GET /stores/nearby-google`
- `GET /stores/google-details`
- `GET /stores/list`
- `POST /stores/unlock`
- `POST /stores/activate-slot`

---

## Full Route Index (Method + Path)

### User

- `POST /api/users/signup`
- `POST /api/users/login`
- `POST /api/users/forgot-password`
- `POST /api/users/reset-password`
- `GET /api/users/plan-tier`
- `POST /api/users/plan`
- `GET /api/users/me`
- `PUT /api/users/profile`
- `POST /api/users/location`
- `POST /api/users/location-by-address`
- `POST /api/users/check-in`
- `POST /api/users/scan-store`
- `POST /api/users/check-in/location`
- `POST /api/users/check-in/complete`
- `GET /api/users/pending-points`
- `POST /api/users/webauthn/register/start`
- `POST /api/users/webauthn/register/finish`
- `POST /api/users/webauthn/authenticate/start`
- `POST /api/users/webauthn/authenticate/finish`
- `GET /api/users/webauthn/status`
- `DELETE /api/users/webauthn/credentials/:credentialId`
- `GET /api/users/feed`
- `GET /api/users/notifications`
- `GET /api/users/store-requests`
- `POST /api/users/store-requests`
- `POST /api/users/missing-reward-reports`
- `POST /api/users/notifications/:id/read`
- `POST /api/users/notifications/read-all`
- `GET /api/users/notification-preferences`
- `POST /api/users/notification-preferences`
- `GET /api/users/content/:type/:id`
- `GET /api/users/stores/:id/profile`
- `POST /api/users/redeem`
- `POST /api/users/gift-cards/create`
- `GET /api/users/gift-cards/eligibility`
- `GET /api/users/gift-cards`
- `GET /api/users/gift-cards/:id`
- `POST /api/users/enroll-store`
- `GET /api/users/:id/active-stores`
- `POST /api/users/check-settlement`

### Store

- `POST /api/stores/scan-customer`
- `POST /api/stores/signup`
- `POST /api/stores/login`
- `GET /api/stores/me`
- `GET /api/stores/subscription`
- `POST /api/stores/subscription/activate`
- `PUT /api/stores/offer`
- `GET /api/stores/reward-schedules`
- `POST /api/stores/reward-schedules`
- `PUT /api/stores/reward-schedules/:id`
- `POST /api/stores/upload`
- `GET /api/stores/reward-preferences`
- `PUT /api/stores/reward-preferences`
- `GET /api/stores/reward-recommendations`
- `POST /api/stores/reward-recommendations/:recommendationId/apply`
- `GET /api/stores/reward-holiday-reminders`
- `POST /api/stores/reward-holiday-reminders/:reminderId/respond`
- `GET /api/stores/content`
- `GET /api/stores/promotions`
- `POST /api/stores/promotions`
- `GET /api/stores/updates`
- `POST /api/stores/updates`
- `GET /api/stores/posts`
- `POST /api/stores/posts`
- `PUT /api/stores/promotions/:id`
- `PUT /api/stores/updates/:id`
- `PUT /api/stores/posts/:id`
- `DELETE /api/stores/promotions/:id`
- `DELETE /api/stores/updates/:id`
- `DELETE /api/stores/posts/:id`
- `POST /api/stores/content/:type/:id/archive`
- `POST /api/stores/content/:type/:id/unarchive`
- `PUT /api/stores/profile`
- `GET /api/stores/customer/:userId`
- `GET /api/stores/customers-today`
- `GET /api/stores/blacklist`
- `GET /api/stores/members`
- `POST /api/stores/members/:userId/promo`
- `POST /api/stores/blacklist`
- `POST /api/stores/forgot-password`
- `POST /api/stores/reset-password`
- `DELETE /api/stores/blacklist/:userId`
- `POST /api/stores/transaction`
- `POST /api/stores/scan-gift-card`
- `GET /api/stores/pending-physical-gift-cards`
- `POST /api/stores/issue-physical-gift-card/:id`
- `POST /api/stores/use-gift-card`
- `GET /api/stores/nearby`
- `GET /api/stores/nearby-osm`
- `GET /api/stores/nearby-eligible`
- `POST /api/stores/unlock`
- `POST /api/stores/activate-slot`
- `GET /api/stores/nearby-google`
- `GET /api/stores/google-details`
- `GET /api/stores/list`
- `PUT /api/stores/location`

### Admin

- `POST /api/admins/signup`
- `POST /api/admins/login`
- `GET /api/admins/me`
- `GET /api/admins/users`
- `GET /api/admins/users/:id/stores`
- `GET /api/admins/users/:id`
- `PUT /api/admins/users/:id`
- `DELETE /api/admins/users/:id`
- `GET /api/admins/stores`
- `GET /api/admins/store-requests`
- `PUT /api/admins/store-requests/:id/status`
- `POST /api/admins/store-requests/notify`
- `GET /api/admins/analytics/events`
- `GET /api/admins/analytics/events/by-actor/:actorType/:actorId`
- `GET /api/admins/analytics/summary`
- `GET /api/admins/analytics/funnel`
- `GET /api/admins/activity`
- `GET /api/admins/missing-reward-reports`
- `PUT /api/admins/missing-reward-reports/:id/status`
- `GET /api/admins/stores/:id/customers`
- `GET /api/admins/stores/:id`
- `PUT /api/admins/stores/:id`
- `PUT /api/admins/stores/:id/offer`
- `PUT /api/admins/stores/:id/subscription`
- `GET /api/admins/stores/:id/subscription-audit`
- `GET /api/admins/category-profiles`
- `PUT /api/admins/category-profiles/:category`
- `GET /api/admins/stores/:id/reward-profile`
- `PUT /api/admins/stores/:id/reward-profile`
- `DELETE /api/admins/stores/:id/reward-profile`
- `POST /api/admins/stores/backfill-phones`
- `POST /api/admins/stores/:id/claim-code`
- `DELETE /api/admins/stores/:id`

### Utility / Misc

- `POST /api/events`
- `GET /api/categories`
- `POST /api/content/:type/:id/like`
- `DELETE /api/content/:type/:id/like`
- `POST /api/test-sms`

---

## Notes

- Route-level auth is enforced in `server.js` using `auth("user")`, `authStore`, and `authAdmin`.
- Some endpoints are dev-only or feature-flag influenced (example: `/api/test-sms`, blacklist feature flag).
- Store content creation endpoints can return `403` if trial is expired or monthly plan content limits are reached.
- For production integration, treat this doc as operational reference and validate edge cases against actual route handlers.
