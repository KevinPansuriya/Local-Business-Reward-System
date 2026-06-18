# Future Implementation Notes

## Feature Flags / Disabled Paths

### NFC (Frontend)
- `citycircle-frontend/src/StoreApp.jsx`
  - `// NFC temporarily disabled`
  - `/* NFC Setup temporarily disabled */`
- `citycircle-frontend/src/CustomerApp.jsx`
  - `/* NFC Scanner temporarily disabled */`

### Blacklist Feature (Backend + Frontend)
- `citycircle-backend/server.js`
  - `// Temporary: blacklist/blocking feature flag (disabled by default)`
  - Endpoints return `503` for blacklist when disabled.
- `citycircle-frontend/src/api.js`
  - `// Handle 503 (feature disabled) gracefully`
  - Errors include "Blacklist feature temporarily disabled"

### Email Verification (Backend)
- `citycircle-backend/server.js`
  - `// Note: Email verification can be added later (OTP/SMS verification)`

### WebAuthn Challenge Storage (Backend)
- `citycircle-backend/server.js`
  - `// Store challenge temporarily (in production, use Redis)`

### Vonage SMS Service Setup (Backend)
- `citycircle-backend/server.js`
  - SMS sending via Vonage requires verified sender configuration
  - **Current Status**: SMS feature is implemented but requires Vonage setup
  - **Manual Workaround**: Claim codes are still generated even if SMS fails - admins can share codes manually via phone/email
  - **To Enable SMS**:
    1. **Option 1 (Recommended)**: Get a verified phone number from Vonage
       - Go to Vonage Dashboard → Numbers → Buy/Verify a number
       - Add to `.env`: `VONAGE_SMS_FROM=+1234567890` (your verified number)
    2. **Option 2**: Get alphanumeric sender ID approved
       - Go to Vonage Dashboard → Settings → SMS Settings → Sender IDs
       - Request approval for your brand name (max 11 chars, e.g., "CityCircle")
       - Add to `.env`: `VONAGE_BRAND=CityCircle`
  - **Error**: "Illegal Sender Address - rejected" means sender ID is not approved
  - **Location**: `citycircle-backend/server.js` line ~24 (sendSMS function), line ~3456 (claim code endpoint)

## Notes
- These comments mark areas where functionality is intentionally paused or uses temporary storage/logic.
- If enabling later, review both server and UI behavior to ensure consistent UX and auth flows.
- **Claim Code Flow**: Even without SMS configured, admins can generate claim codes and share them manually with store owners. The claim code and signup link can be sent via personal phone/email until Vonage is set up.
