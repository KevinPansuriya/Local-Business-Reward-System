# QA Checklist (V1)

## Scope
- End-to-end smoke tests (critical paths)
- Validation and error handling
- Content lifecycle logic
- Responsiveness (mobile/tablet/desktop)
- Role-based access and auth

## Environments
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Smoke Tests (Critical Paths)
- [x] Customer signup (phone/email/password + address + DOB)
- [x] Customer login
- [ ] Customer forgot/reset password (OTP)
- [x] Store signup (claim code + contact + address)
- [x] Store login
- [ ] Store forgot/reset password (OTP)
- [x] Store profile update (opened month/year + profile image URL)
- [x] Create promotion (no file upload)
- [x] Create update (rich text + media upload)
- [x] Create post (text + multi-media upload)
- [x] Manage content: edit/arch/archive/unarchive/delete
- [x] Customer feed loads (Local + Discovery)
- [x] Customer feed: like/unlike + share
- [x] Store profile modal opens from feed

## Validation & Error Handling
- [x] Required fields show errors
- [x] Phone/email format validation
- [x] DOB required/format validation
- [x] Address fields removed from customer signup (N/A)
- [x] Upload size/type restrictions (image/video)
- [x] Graceful empty states (no content, no nearby stores)
- [x] API error messages surfaced in UI

## Content Lifecycle Logic
- [x] Scheduled content stays private until start
- [x] Active content visible in feed
- [x] Expired content auto-archived
- [x] Archive/unarchive works and reflects in manage view
- [x] Like counts update correctly

## Responsiveness
- [ ] 375px (mobile) - feed cards + media carousel + tabs
- [ ] 768px (tablet)
- [ ] 1280px (desktop)
- [ ] Modals scroll correctly on small screens

## Role & Security
- [x] Customer endpoints reject store/admin tokens
- [x] Store endpoints reject user/admin tokens
- [x] Protected endpoints require auth

## Findings Log
- `store_profile_update` response omitted `profile_image_url` even when provided; fixed and verified after backend restart.
- `GET /api/users/stores/:id/profile` returned `total_loops_given` as `undefined`; fixed and verified after backend restart.
- OTP flows verified in UI (customer + store).
- Media upload validation verified in UI (type/size).
- Responsive UI checks completed (mobile/tablet/desktop).

## UI Validation Log (Manual)
### Feed Cards
- [X] 375px: header layout, spacing, buttons alignment
- [X] 768px: header layout, spacing, buttons alignment
- [X] 1280px: header layout, spacing, buttons alignment

### Media Carousel
- [X] 375px: 4:5 cards, swipe, no cut-off
- [X] 768px: 4:5 cards, swipe, no cut-off

### Store Profile Modal
- [X] 375px: modal scroll + avatar sizing
- [X] 768px: modal scroll + avatar sizing

