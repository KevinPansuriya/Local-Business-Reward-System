# V1 Test Run Template

Use this while executing `docs/V1_RELEASE_TEST_CHECKLIST.md`.

---

## Test Run Metadata

- Date:
- Tester:
- Environment: (local / staging / production)
- Backend URL:
- Frontend URL:
- Backend commit:
- Frontend commit:

---

## Result Legend

- `PASS` = works as expected
- `FAIL` = broken; needs fix
- `BLOCKED` = cannot test now
- `N/A` = not applicable for this run

---

## Execution Log

| ID | Area | Test Item | Status | Evidence / Notes |
|---|---|---|---|---|
| 1 | Pre-flight | DB backup completed |  |  |
| 2 | Pre-flight | Env vars verified (`SMTP`, cooldown, SMS flag) |  |  |
| 3 | Auth | User login success/failure cases |  |  |
| 4 | Auth | Store login success/failure cases |  |  |
| 5 | Auth | Admin login + access |  |  |
| 6 | Tracking | Store requests KPI correctness |  |  |
| 7 | Tracking | Stores claimed KPI correctness |  |  |
| 8 | Tracking | Grouped store requests list |  |  |
| 9 | Notify | Button appears only for >=10 requests |  |  |
| 10 | Notify | First notify succeeds |  |  |
| 11 | Notify | Cooldown blocks repeat send |  |  |
| 12 | Notify | "Already notified" shown in UI |  |  |
| 13 | Feed | Feed loads with no errors |  |  |
| 14 | Feed | Posted date+time visible on feed cards |  |  |
| 15 | Feed | Posted date+time visible in store profile |  |  |
| 16 | Feed | Like/unlike works |  |  |
| 17 | Content | Promotion create/edit/delete |  |  |
| 18 | Content | Update create/edit/delete |  |  |
| 19 | Content | Post create/edit/delete |  |  |
| 20 | Check-in | Start/check-in flow works |  |  |
| 21 | Rewards | Transaction updates loops correctly |  |  |
| 22 | Notifications | User notification read/read-all works |  |  |
| 23 | SMTP | SMTP verify and email delivery |  |  |
| 24 | UI Smoke | Customer portal no major JS errors |  |  |
| 25 | UI Smoke | Store portal no major JS errors |  |  |
| 26 | UI Smoke | Admin portal no major JS errors |  |  |

---

## Failed Items Summary

List only failed or blocked items here with owner + ETA.

| ID | Issue | Owner | ETA | Fix PR/Commit |
|---|---|---|---|---|
|  |  |  |  |  |

---

## Go / No-Go Decision

- Decision: `GO` / `NO-GO`
- Approved by:
- Approval time:
- Notes:

---

## Post-Deploy Verification (Production)

| Check | Status | Notes |
|---|---|---|
| Admin login works |  |  |
| Tracking dashboard loads |  |  |
| Notify store works |  |  |
| Cooldown behavior works |  |  |
| Customer feed renders posted date+time |  |  |
| No critical backend errors in logs |  |  |

