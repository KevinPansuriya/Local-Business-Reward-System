# V1 Release Test Checklist

Use this checklist before deploying V1 to production.

Base URL (local): `http://localhost:4000/api`

---

## 0) Pre-flight

- [ ] Backup DB (`citycircle.db` or production DB snapshot)
- [ ] Backend `.env` is set (JWT, SMTP, cooldown, feature flags)
- [ ] `STORE_NOTIFY_SMS_ENABLED=0` (for now)
- [ ] Backend and frontend both running with latest code

Recommended env for V1:

```env
STORE_NOTIFY_SMS_ENABLED=0
STORE_NOTIFY_COOLDOWN_HOURS=24
```

---

## 1) Auth & Session

### User login
- [ ] Login works with valid phone/password
- [ ] Invalid password returns proper error

### Store login
- [ ] Store login works
- [ ] `/stores/me` returns correct store info

### Admin login
- [ ] Admin login works
- [ ] Admin can open Tracking tab

---

## 2) Tracking / Admin KPIs

- [ ] `Store requests` count matches real rows in `store_onboarding_requests`
- [ ] `Stores claimed` count matches `stores` with `claimed_at IS NOT NULL`
- [ ] Store requests card shows grouped store names (no duplicate rows for same store)
- [ ] Requests column shows correct request count

Quick API checks (admin token):

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:4000/api/admins/analytics/funnel
```

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:4000/api/admins/activity?days=7
```

---

## 3) Notify Store Flow (high-priority)

Precondition: one store request row with `request_count >= 10`.

- [ ] `Notify store` button appears only on `>=10` rows
- [ ] Click sends notification successfully
- [ ] Success message appears in UI
- [ ] Admin email received
- [ ] If store email exists, outreach email sent to store
- [ ] Button becomes `Already notified` after success

### Cooldown behavior

- [ ] Second notify attempt within cooldown returns blocked behavior
- [ ] UI keeps `Already notified`

Direct API test:

```bash
curl -X POST http://localhost:4000/api/admins/store-requests/notify \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"requested_store_name\":\"Hanaa Banana\",\"request_count\":12}"
```

Expected success fields:
- `success`
- `sentToStore`
- `sentEmail`
- `sentSms`
- `cooldown_hours`

Expected cooldown block (repeat call):
- HTTP `429`
- `cooldown_active: true`
- `cooldown_until`

---

## 4) Customer Feed

- [ ] Feed loads for logged-in user
- [ ] Each feed card shows posted label with date + time
- [ ] Label format looks correct (Today / N days ago + date + time)
- [ ] Like/unlike works
- [ ] Share button works (or graceful fallback)
- [ ] Store profile modal opens from feed
- [ ] Store profile content list also shows posted date/time

---

## 5) Store Content CRUD

### Promotions
- [ ] Create promotion
- [ ] Edit promotion
- [ ] Delete promotion

### Updates
- [ ] Create update
- [ ] Edit update
- [ ] Delete update

### Posts
- [ ] Create post
- [ ] Edit post
- [ ] Delete post

- [ ] New active content appears in customer feed

---

## 6) Check-in / Transaction / Rewards

- [ ] User can scan store and start check-in
- [ ] Check-in complete works
- [ ] Pending points endpoint returns expected entries
- [ ] Store transaction works and updates loops
- [ ] User wallet reflects updated balance

---

## 7) Notifications

- [ ] User receives content notifications for promotion/update (if enabled)
- [ ] Notifications list loads
- [ ] Mark one notification as read works
- [ ] Mark all notifications as read works

---

## 8) SMTP / Email

- [ ] SMTP credentials valid (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- [ ] Admin emails are received for key events
- [ ] No SMTP auth errors in backend logs

Optional quick verify command (run in `citycircle-backend`):

```bash
node -e "require('dotenv').config();const n=require('nodemailer');const h=process.env.SMTP_HOST,p=Number(process.env.SMTP_PORT)||587,u=process.env.SMTP_USER,s=process.env.SMTP_PASS;const sec=(String(process.env.SMTP_SECURE||'').toLowerCase()==='true'||p===465);n.createTransport({host:h,port:p,secure:sec,auth:{user:u,pass:s}}).verify().then(()=>console.log('OK')).catch(e=>console.error(e.message));"
```

---

## 9) Regression Smoke (UI)

- [ ] Customer portal opens without JS errors
- [ ] Store portal opens without JS errors
- [ ] Admin portal opens without JS errors
- [ ] No major broken layout in key tabs

---

## 10) Go / No-Go

Ship only if all are true:

- [ ] No P0/P1 bugs open
- [ ] Notify flow + cooldown verified
- [ ] Feed date/time verified
- [ ] SMTP verified
- [ ] DB backup completed
- [ ] Rollback plan ready

---

## Release Notes Template (fill before go-live)

- Version: `v1.0.0`
- Date:
- Backend commit:
- Frontend commit:
- DB backup file/snapshot:
- Known limitations:
  - SMS outreach disabled (`STORE_NOTIFY_SMS_ENABLED=0`)
- Approved by:

