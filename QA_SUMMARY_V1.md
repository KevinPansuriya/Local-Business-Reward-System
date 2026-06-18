# QA Summary (V1)

## Scope
- End-to-end smoke tests (API + UI)
- Validation and error handling
- Content lifecycle logic
- Responsiveness (mobile/tablet/desktop)
- Role-based access checks

## Environment
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Results
- Smoke tests: **PASS**
- Validation/errors: **PASS**
- Content lifecycle: **PASS**
- Responsiveness: **PASS**
- Role/security: **PASS**

## Verified Highlights
- Customer + store auth flows (signup/login/reset).
- Feed (local/discovery), likes, share, and store profile modal.
- Promotions/updates/posts creation and management.
- Scheduled content stays private; expired content auto-archives.
- Media uploads enforce type/size; UI displays error states.

## Fixes Verified During QA
- `PUT /api/stores/profile` now returns saved `profile_image_url`.
- Store profile returns `total_loops_given` as a number.

## Limitations / Notes
- No automated test suite yet (manual QA only).
- SMS/Verify provider dependency for OTP flows.

## Checklist Reference
- See `QA_CHECKLIST.md` for itemized pass/fail details.
