require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Temporary: blacklist/blocking feature flag (disabled by default)
// Set BLACKLIST_ENABLED=1 to enable.
const BLACKLIST_ENABLED = process.env.BLACKLIST_ENABLED === "1";

// SMS Service (Twilio or Vonage - configure in .env)
// For development, we'll use a mock SMS service
// Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
// Vonage SMS: VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_BRAND
// Vonage Verify (OTP): VONAGE_VERIFY=1, VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_BRAND

// Ensure fetch is available for SMS service
const fetch = global.fetch || require("node-fetch");

function sendSMS(phoneNumber, message) {
    // Mock SMS for development - in production, use Twilio
    const useTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const useVonage = !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET);
    
    // Uncomment below to use real Twilio (requires twilio package: npm install twilio)
    /*
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        return client.messages.create({
            body: message,
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER
        });
    }
    */

    // Vonage SMS (no extra dependency)
    if (useVonage) {
        // Vonage SMS requires a verified sender number or alphanumeric sender ID
        // Use VONAGE_SMS_FROM if set (must be a verified phone number like +1234567890)
        // Otherwise use VONAGE_BRAND (must be an approved alphanumeric sender ID, max 11 chars)
        const from = process.env.VONAGE_SMS_FROM || process.env.VONAGE_BRAND;
        
        if (!from) {
            throw new Error("VONAGE_SMS_FROM or VONAGE_BRAND must be set in environment variables. VONAGE_SMS_FROM should be a verified phone number (e.g., +1234567890), or VONAGE_BRAND should be an approved alphanumeric sender ID.");
        }
        
        const payload = new URLSearchParams({
            api_key: process.env.VONAGE_API_KEY,
            api_secret: process.env.VONAGE_API_SECRET,
            to: phoneNumber,
            from: from.length > 11 ? from.substring(0, 11) : from, // Vonage limits sender ID to 11 characters
            text: message,
        });
        
        console.log(`Sending Vonage SMS to ${phoneNumber} from ${from}`);
        
        return fetch("https://rest.nexmo.com/sms/json", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: payload.toString(),
        }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            console.log("Vonage SMS response:", JSON.stringify(data, null, 2));
            
            if (!res.ok) {
                const errorText = `Vonage API error: ${res.status} ${res.statusText}`;
                throw new Error(errorText);
            }
            
            // Check if any message failed
            if (data.messages && Array.isArray(data.messages)) {
                const failedMsg = data.messages.find(m => m.status !== "0");
                if (failedMsg) {
                    const errorText = failedMsg["error-text"] || `Vonage SMS failed with status ${failedMsg.status}`;
                    throw new Error(errorText);
                }
            } else if (data.messages?.[0]?.status !== "0") {
                const errorText = data.messages?.[0]?.["error-text"] || "Vonage SMS failed";
                throw new Error(errorText);
            }
            
            return data;
        }).catch((err) => {
            console.error("Vonage SMS error details:", err);
            throw err;
        });
    }
    
    return Promise.resolve({ sid: 'mock_sms_' + Date.now() });
}
const { createServer } = require("http");
const { Server } = require("socket.io");
const db = require("./db");

// Category profiles service for flexible check-in rules
const {
    canCheckIn,
    getCategoryProfile,
    getAllCategoryProfiles,
    updateCategoryProfile,
    getStoreRewardProfile,
    upsertStoreRewardProfile,
    deleteStoreRewardProfile
} = require("./services/categoryProfiles");

process.on('uncaughtException', (err) => {
});
process.on('unhandledRejection', (reason) => {
});


// WebAuthn for facial recognition
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const {
    isoBase64URL,
    isoUint8Array,
} = require("@simplewebauthn/server/helpers");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").slice(0, 10);
            const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
            cb(null, name);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Debug middleware to log all requests
app.use((req, res, next) => {

    if (req.path === '/api/stores/login' || req.path === '/api/admins/login') {
        try {
            const routeLayers = (app.router?.stack || []).filter(l => l && l.route);
            const routeSummaries = routeLayers.map(l => ({
                path: l.route.path,
                methods: Object.keys(l.route.methods || {}).join(','),
            }));
            const loginLike = routeSummaries.filter(r => String(r.path).includes('login')).slice(0, 20);
        } catch (e) {
        }
    }
    if (req.path.startsWith('/api/stores/login') || req.path.startsWith('/api/admins/login') || req.path.startsWith('/api/stores/signup') || req.path.startsWith('/api/admins/signup')) {
    }
    next();
});

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 10);
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_CACHE_TTL_MS = Number(process.env.GOOGLE_CACHE_TTL_MS || 300000); // 5 min
const GOOGLE_DETAILS_TTL_MS = Number(process.env.GOOGLE_DETAILS_TTL_MS || 86400000); // 24h
const AUTO_BACKFILL_PHONES = process.env.AUTO_BACKFILL_PHONES === "1";
const STORE_SUBSCRIPTION_TRIAL_DAYS = Math.max(1, Number(process.env.STORE_SUBSCRIPTION_TRIAL_DAYS || 14));
const STORE_PLAN_CONFIGS = {
    trial: {
        id: "trial",
        label: "Trial",
        monthly_price_usd: 0,
        list_price_usd: 0,
        launch_price_usd: 0,
        launch_discount_label: "Free trial",
        monthly_content_limit: 20,
        ai_monthly_limit: 25,
        features: [
            "Publish up to 20 content items/month",
            "Basic analytics dashboard",
            "Store profile and QR setup",
            "25 AI assist credits/month",
        ],
    },
    starter: {
        id: "starter",
        label: "Starter",
        monthly_price_usd: 20,
        list_price_usd: 40,
        launch_price_usd: 20,
        launch_discount_label: "Launch 50% off",
        monthly_content_limit: 120,
        ai_monthly_limit: 250,
        features: [
            "Publish up to 120 content items/month",
            "Members and rewards controls",
            "Notification and outreach tools",
            "250 AI assist credits/month",
        ],
    },
    growth: {
        id: "growth",
        label: "Growth",
        monthly_price_usd: 50,
        list_price_usd: 149,
        launch_price_usd: 50,
        launch_discount_label: "Launch special price",
        monthly_content_limit: null,
        ai_monthly_limit: 1200,
        features: [
            "Unlimited content publishing",
            "Advanced growth and loyalty operations",
            "Priority support lane",
            "1200 AI assist credits/month",
        ],
    },
};
const STORE_PLAN_FEATURE_MATRIX = [
    { key: "content_publishing", label: "Publish promotions/updates/posts", values: { trial: "Up to 20/mo", starter: "Up to 120/mo", growth: "Unlimited" } },
    { key: "analytics", label: "Analytics dashboard", values: { trial: "Basic", starter: "Advanced", growth: "Advanced" } },
    { key: "members", label: "Members and customer tools", values: { trial: "Basic", starter: "Full", growth: "Full" } },
    { key: "rewards", label: "Rewards and visibility controls", values: { trial: "Basic", starter: "Full", growth: "Full" } },
    { key: "ai_credits", label: "AI assist credits", values: { trial: "25/mo", starter: "250/mo", growth: "1200/mo" } },
    { key: "support", label: "Support level", values: { trial: "Community", starter: "Standard", growth: "Priority" } },
];
const STORE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "expired", "past_due", "canceled"]);
const googleNearbyCache = new Map();
const googleDetailsCache = new Map();
const googleFindPlaceCache = new Map();

async function fetchGooglePlaceDetailsData(placeId) {
    const cached = getCache(googleDetailsCache, placeId);
    if (cached) return cached;
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }
    const url =
        "https://maps.googleapis.com/maps/api/place/details/json" +
        `?place_id=${encodeURIComponent(placeId)}` +
        "&fields=formatted_phone_number,international_phone_number,website" +
        `&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Places details failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.status !== "OK") {
        throw new Error(`Google Places details status: ${data.status}`);
    }
    const result = data.result || {};
    const details = {
        phone: result.formatted_phone_number || result.international_phone_number || null,
        website: result.website || null,
    };
    setCache(googleDetailsCache, placeId, details, GOOGLE_CACHE_TTL_MS);
    return details;
}

async function fetchGooglePlaceIdFromText(input, { lat, lng, radiusMeters = 1500 } = {}) {
    const cacheKey = `${String(input || "").trim().toLowerCase()}|${lat?.toFixed?.(4) || ""},${lng?.toFixed?.(4) || ""}`;
    const cached = getCache(googleFindPlaceCache, cacheKey);
    if (cached) return cached;
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }
    const locationBias =
        (lat != null && lng != null)
            ? `&locationbias=circle:${radiusMeters}@${lat},${lng}`
            : "";
    const url =
        "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
        `?input=${encodeURIComponent(input)}` +
        "&inputtype=textquery" +
        "&fields=place_id" +
        locationBias +
        `&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google findplace failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.status !== "OK") {
        setCache(googleFindPlaceCache, cacheKey, null, GOOGLE_CACHE_TTL_MS);
        return null;
    }
    const placeId = data.candidates?.[0]?.place_id || null;
    setCache(googleFindPlaceCache, cacheKey, placeId, GOOGLE_CACHE_TTL_MS);
    return placeId;
}

async function fetchGoogleGeocode(address) {
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }
    const url =
        "https://maps.googleapis.com/maps/api/geocode/json" +
        `?address=${encodeURIComponent(address)}` +
        `&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google geocode failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.status !== "OK") {
        return null;
    }
    const result = data.results?.[0];
    if (!result?.geometry?.location) {
        return null;
    }
    return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address || address
    };
}

function buildAddressString({ address_line1, address_line2, city, state, postal_code }) {
    return [
        address_line1,
        address_line2,
        city,
        state,
        postal_code
    ]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(", ");
}

function getCache(cache, key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        cache.delete(key);
        return null;
    }
    return hit.value;
}

function setCache(cache, key, value, ttlMs) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// WebAuthn configuration
// For mobile testing with ngrok:
// 1. Start ngrok: ngrok http 5173
// 2. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
// 3. Set in .env: RP_ID=abc123.ngrok-free.app and ORIGIN=https://abc123.ngrok-free.app
// 4. Restart backend server
const RP_ID = process.env.RP_ID || "localhost"; // Relying Party ID (use ngrok domain for mobile)
const RP_NAME = process.env.RP_NAME || "CityCircle";
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";

// ---------- helpers ----------
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function auth(role) {
    return (req, res, next) => {
        const header = req.headers.authorization;
        if (!header) return res.status(401).json({ error: "No token" });
        const token = header.split(" ")[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (role && decoded.role !== role) {
                return res.status(403).json({ error: "Forbidden" });
            }
            req.user = decoded;
            next();
        } catch {
            return res.status(401).json({ error: "Invalid token" });
        }
    };
}

// Admin authentication middleware
function authAdmin(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Admin access required" });
        }
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}

function authStore(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== "store") {
            return res.status(403).json({ error: "Not a store token" });
        }
        req.storeId = payload.storeId;
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

function toCents(amount) {
    return Math.round(Number(amount) * 100);
}

// Generate unique QR code
function generateQRCode(prefix, id) {
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}:${id}:${random}`;
}

// Validate phone number format (max 10 digits)
function validatePhone(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's exactly 10 digits
    return cleaned.length === 10;
}

function generateClaimCode() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateResetCode() {
    return String(100000 + Math.floor(Math.random() * 900000));
}

function formatSmsPhone(phone) {
    const cleaned = String(phone || "").replace(/\D/g, "");
    if (cleaned.length === 10) return `+1${cleaned}`;
    return phone;
}

const USE_VONAGE_VERIFY = process.env.VONAGE_VERIFY === "1";

async function startVonageVerify(phoneNumber) {
    const payload = new URLSearchParams({
        api_key: process.env.VONAGE_API_KEY || "",
        api_secret: process.env.VONAGE_API_SECRET || "",
        number: phoneNumber,
        brand: process.env.VONAGE_BRAND || "CityCircle",
    });
    const res = await fetch("https://api.nexmo.com/verify/json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "0") {
        const errText = data?.error_text || data?.["error-text"] || "Vonage Verify failed";
        throw new Error(errText);
    }
    return data.request_id;
}

async function checkVonageVerify(requestId, code) {
    const payload = new URLSearchParams({
        api_key: process.env.VONAGE_API_KEY || "",
        api_secret: process.env.VONAGE_API_SECRET || "",
        request_id: requestId,
        code: String(code || "").trim(),
    });
    const res = await fetch("https://api.nexmo.com/verify/check/json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "0") {
        const errText = data?.error_text || data?.["error-text"] || "Invalid verification code";
        throw new Error(errText);
    }
    return data;
}

function isValidDob(value) {
    if (!value) return true;
    const str = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const parsed = new Date(str);
    return !Number.isNaN(parsed.getTime());
}

// ---------- customer auth ----------

app.post("/api/users/signup", async (req, res) => {
    const {
        phone,
        email,
        password,
        name,
        address,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        dob,
        signup_source,
        utm_source,
        utm_medium,
        utm_campaign,
    } = req.body;
    
    // Validation - phone is required for customers
    if (!phone || !password || !name) {
        return res.status(400).json({ error: "Phone number, password, and name are required" });
    }
    
    if (!validatePhone(phone)) {
        return res.status(400).json({ error: "Invalid phone number format" });
    }
    
    // Email is optional but if provided, validate format (must contain @)
    if (email) {
        if (!email.includes("@")) {
            return res.status(400).json({ error: "Email must contain @ symbol" });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
    }
    
    // Note: Email verification can be added later (OTP/SMS verification)
    
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    if (name.trim().length < 2) {
        return res.status(400).json({ error: "Name must be at least 2 characters" });
    }
    if (dob !== undefined && !isValidDob(dob)) {
        return res.status(400).json({ error: "Date of birth must be YYYY-MM-DD" });
    }

    // Clean phone number (remove non-digits)
    const cleanedPhone = phone.replace(/\D/g, '');
    
    // Check if phone number already exists
    db.get("SELECT id FROM users WHERE phone = ?", [cleanedPhone], (err, existingUser) => {
        if (err) {
            return res.status(500).json({ error: "Database error while checking phone number" });
        }
        
        if (existingUser) {
            return res.status(400).json({ error: "Phone number already registered" });
        }
        
        // Generate unique QR code
        const qrCode = generateQRCode("USER", cleanedPhone);
        const composedAddress = buildAddressString({ address_line1, address_line2, city, state, postal_code }) || address || null;

        bcrypt.hash(password, 10).then(hash => {
            const sql =
                "INSERT INTO users (phone, email, password_hash, name, address, dob, address_line1, address_line2, city, state, postal_code, qr_code, signup_source, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            const params = [
                cleanedPhone,
                email || null,
                hash,
                name.trim(),
                composedAddress,
                dob || null,
                address_line1 || null,
                address_line2 || null,
                city || null,
                state || null,
                postal_code || null,
                qrCode,
                String(signup_source || "").trim() || null,
                String(utm_source || "").trim() || null,
                String(utm_medium || "").trim() || null,
                String(utm_campaign || "").trim() || null,
            ];
            db.run(sql, params, async function (err) {
                if (err) {
                    if (err.message.includes("UNIQUE constraint")) {
                        return res.status(400).json({ error: "Phone number or email already registered" });
                    }
                    if (err.message.includes("no such column")) {
                        db.run(
                            "INSERT INTO users (phone, email, password_hash, name, address, dob, address_line1, address_line2, city, state, postal_code, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [cleanedPhone, email || null, hash, name.trim(), composedAddress, dob || null, address_line1 || null, address_line2 || null, city || null, state || null, postal_code || null, qrCode],
                            function (err2) {
                                if (err2) return res.status(400).json({ error: "DB error: " + err2.message });
                                const uid = this.lastID;
                                recordAnalyticsEvent({ event_type: "signup_completed", actor_type: "user", actor_id: uid, utm_source, utm_medium, utm_campaign }, req);
                                sendAdminNotificationEmail("new_customer_signup", "New customer signup", `<p><strong>${name.trim()}</strong> just signed up.</p><p>Phone: ${cleanedPhone}</p><p>Source: ${signup_source || "—"} | UTM: ${utm_source || "—"}/${utm_medium || "—"}/${utm_campaign || "—"}</p>`);
                                res.json({ token: generateToken({ id: uid, role: "user", phone: cleanedPhone, name }), userId: uid, qrCode, needsLocation: true });
                            }
                        );
                        return;
                    }
                    return res.status(400).json({ error: "DB error: " + err.message });
                }
                const uid = this.lastID;
                recordAnalyticsEvent({ event_type: "signup_completed", actor_type: "user", actor_id: uid, utm_source, utm_medium, utm_campaign }, req);
                sendAdminNotificationEmail("new_customer_signup", "New customer signup", `<p><strong>${name.trim()}</strong> just signed up.</p><p>Phone: ${cleanedPhone}</p><p>Source: ${signup_source || "—"} | UTM: ${utm_source || "—"}/${utm_medium || "—"}/${utm_campaign || "—"}</p>`);
                res.json({ token: generateToken({ id: uid, role: "user", phone: cleanedPhone, name }), userId: uid, qrCode, needsLocation: true });
            });
        }).catch(err => {
            return res.status(500).json({ error: "Error processing signup" });
        });
    });
});

// Public analytics event tracking (for funnel: page_view, signup_started, etc.)
app.post("/api/events", (req, res) => {
    const ip = req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : (req.connection && req.connection.remoteAddress) || "";
    if (isEventRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests" });
    }
    const { event_type, session_id, payload, utm_source, utm_medium, utm_campaign, actor_id, actor_type } = req.body || {};
    if (!event_type || !ALLOWED_EVENT_TYPES.has(event_type)) {
        return res.status(400).json({ error: "Invalid or missing event_type" });
    }
    recordAnalyticsEvent({
        event_type,
        actor_type: actor_type || null,
        actor_id: actor_id ? Number(actor_id) : null,
        session_id: session_id || null,
        payload: payload || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
    }, req).then(() => {
        res.json({ ok: true });
    }).catch(() => {
        res.status(500).json({ error: "Failed to record event" });
    });
});

app.post("/api/users/login", (req, res) => {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
        return res.status(400).json({ error: "Phone number and password are required" });
    }
    
    // Clean phone number
    const cleanedPhone = phone.replace(/\D/g, '');
    
    db.get("SELECT * FROM users WHERE phone = ?", [cleanedPhone], async (err, row) => {
        if (err || !row)
            return res.status(400).json({ error: "Invalid phone number or password" });

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return res.status(400).json({ error: "Invalid phone number or password" });

        const token = generateToken({
            id: row.id,
            role: "user",
            phone: row.phone,
            name: row.name,
        });
        res.json({ 
            token, 
            userId: row.id, 
            needsLocation: !row.location_set || !row.latitude || !row.longitude 
        });
    });
});

// Customer password reset via SMS
app.post("/api/users/forgot-password", (req, res) => {
    const { phone } = req.body;
    if (!phone || !validatePhone(phone)) {
        return res.status(400).json({ error: "Valid phone number is required" });
    }
    const cleanedPhone = phone.replace(/\D/g, "");
    db.get("SELECT id, phone FROM users WHERE phone = ?", [cleanedPhone], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (!user) {
            return res.json({ success: true, message: "If the account exists, a reset code was sent." });
        }
        const code = generateResetCode();
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();
        db.serialize(() => {
            db.run(
                "DELETE FROM password_reset_tokens WHERE user_type = ? AND user_id = ?",
                ["user", user.id],
                () => {
                    if (USE_VONAGE_VERIFY) {
                        startVonageVerify(formatSmsPhone(cleanedPhone))
                            .then((requestId) => {
                                db.run(
                                    "INSERT INTO password_reset_tokens (user_type, user_id, phone, code, request_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                                    ["user", user.id, cleanedPhone, code, requestId, expiresAt],
                                    (err2) => {
                                        if (err2) {
                                            return res.status(500).json({
                                                error: "Failed to create reset code",
                                                details: err2.message || String(err2)
                                            });
                                        }
                                        const payload = { success: true, message: "Verification code sent" };
                                        if (process.env.NODE_ENV !== "production") {
                                            payload.dev_code = code;
                                            payload.request_id = requestId;
                                        }
                                        res.json(payload);
                                    }
                                );
                            })
                            .catch((verifyErr) => {
                                if (process.env.NODE_ENV !== "production") {
                                    db.run(
                                        "INSERT INTO password_reset_tokens (user_type, user_id, phone, code, request_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                                        ["user", user.id, cleanedPhone, code, null, expiresAt],
                                        () => {
                                            return res.json({
                                                success: true,
                                                message: "Verify failed. Using dev code.",
                                                dev_code: code,
                                                verify_error: verifyErr?.message || String(verifyErr)
                                            });
                                        }
                                    );
                                    return;
                                }
                                res.status(500).json({
                                    error: "Failed to start verification",
                                    details: verifyErr?.message || String(verifyErr)
                                });
                            });
                        return;
                    }

                    db.run(
                        "INSERT INTO password_reset_tokens (user_type, user_id, phone, code, request_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                        ["user", user.id, cleanedPhone, code, null, expiresAt],
                        (err2) => {
                            if (err2) {
                                return res.status(500).json({
                                    error: "Failed to create reset code",
                                    details: err2.message || String(err2)
                                });
                            }
                            sendSMS(formatSmsPhone(cleanedPhone), `CityCircle reset code: ${code}`)
                                .then((resp) => {
                                    const payload = { success: true, message: "Reset code sent via SMS" };
                                    if (process.env.NODE_ENV !== "production") {
                                        payload.dev_code = code;
                                        payload.sms_response = resp;
                                    }
                                    res.json(payload);
                                })
                                .catch((smsErr) => {
                                    if (process.env.NODE_ENV !== "production") {
                                        return res.json({
                                            success: true,
                                            message: "SMS failed. Using dev code.",
                                            dev_code: code,
                                            sms_error: smsErr?.message || String(smsErr)
                                        });
                                    }
                                    res.status(500).json({
                                        error: "Failed to send SMS",
                                        details: smsErr?.message || String(smsErr)
                                    });
                                });
                        }
                    );
                }
            );
        });
    });
});

app.post("/api/users/reset-password", (req, res) => {
    const { phone, code, newPassword } = req.body;
    if (!phone || !validatePhone(phone)) {
        return res.status(400).json({ error: "Valid phone number is required" });
    }
    if (!code) {
        return res.status(400).json({ error: "Reset code is required" });
    }
    if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const cleanedPhone = phone.replace(/\D/g, "");
    db.get("SELECT id FROM users WHERE phone = ?", [cleanedPhone], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: "Invalid phone or reset code" });
        }
        db.get(
            "SELECT * FROM password_reset_tokens WHERE user_type = ? AND user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
            ["user", user.id],
            (err2, tokenRow) => {
                if (err2 || !tokenRow) {
                    return res.status(400).json({ error: "Invalid or expired reset code" });
                }
                if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
                    return res.status(400).json({ error: "Reset code has expired" });
                }
                const handlePasswordReset = () => {
                    bcrypt.hash(newPassword, 10).then((hash) => {
                        db.run(
                            "UPDATE users SET password_hash = ? WHERE id = ?",
                            [hash, user.id],
                            (err3) => {
                                if (err3) {
                                    return res.status(500).json({ error: "Failed to reset password" });
                                }
                                db.run(
                                    "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
                                    [tokenRow.id],
                                    () => {
                                        res.json({ success: true, message: "Password reset successfully" });
                                    }
                                );
                            }
                        );
                    }).catch(() => {
                        res.status(500).json({ error: "Failed to reset password" });
                    });
                };

                if (USE_VONAGE_VERIFY && tokenRow.request_id) {
                    checkVonageVerify(tokenRow.request_id, code)
                        .then(() => handlePasswordReset())
                        .catch((verifyErr) => {
                            res.status(400).json({
                                error: "Invalid or expired reset code",
                                details: verifyErr?.message || String(verifyErr)
                            });
                        });
                } else {
                    if (String(code || "").trim() !== String(tokenRow.code || "").trim()) {
                        return res.status(400).json({ error: "Invalid or expired reset code" });
                    }
                    handlePasswordReset();
                }
            }
        );
    });
});


const LOYALTY_TIERS = [
    { key: "BRONZE", name: "Bronze", multiplier: 1.0, min: 0, description: "Starting tier" },
    { key: "SILVER", name: "Silver", multiplier: 1.05, min: 500, description: "5% bonus - Earn 500+ total Loops" },
    { key: "GOLD", name: "Gold", multiplier: 1.1, min: 2000, description: "10% bonus - Earn 2,000+ total Loops" },
    { key: "PLATINUM", name: "Platinum", multiplier: 1.2, min: 6000, description: "20% bonus - Earn 6,000+ total Loops" },
    { key: "DIAMOND", name: "Diamond", multiplier: 1.35, min: 15000, description: "35% bonus - Earn 15,000+ total Loops" },
];

function getTierProgress(totalLoopsEarned) {
    const totalEarned = Math.max(0, Number(totalLoopsEarned || 0));
    let currentTier = LOYALTY_TIERS[0];
    for (const tier of LOYALTY_TIERS) {
        if (totalEarned >= tier.min) currentTier = tier;
        else break;
    }

    const currentIndex = LOYALTY_TIERS.findIndex((t) => t.key === currentTier.key);
    const nextTier = currentIndex >= 0 && currentIndex < LOYALTY_TIERS.length - 1
        ? LOYALTY_TIERS[currentIndex + 1]
        : null;
    const currentTierMin = currentTier.min;
    const nextTierMin = nextTier ? nextTier.min : null;
    const tierSpan = nextTier ? Math.max(1, nextTierMin - currentTierMin) : 1;
    const progress = nextTier
        ? Math.min(100, ((totalEarned - currentTierMin) / tierSpan) * 100)
        : 100;
    const pointsNeeded = nextTier ? Math.max(0, nextTierMin - totalEarned) : 0;

    return {
        currentTier: currentTier.key,
        tierDetails: currentTier,
        tierMultiplier: currentTier.multiplier,
        totalEarned,
        currentTierMin,
        nextTier: nextTier ? nextTier.key : null,
        nextTierMin,
        nextTierDetails: nextTier || null,
        progress: Math.round(progress * 100) / 100,
        pointsNeeded,
        nextTierProgress: nextTier
            ? {
                earnedInCurrentTier: Math.max(0, totalEarned - currentTierMin),
                requiredInCurrentTier: tierSpan,
                remainingInCurrentTier: pointsNeeded,
                percent: Math.round(progress * 100) / 100,
            }
            : null,
    };
}

// Get plan and tier information with progress
app.get("/api/users/plan-tier", auth("user"), (req, res) => {
    const userId = req.user.id;
    
    db.get(
        "SELECT plan, total_loops_earned FROM users WHERE id = ?",
        [userId],
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: "User not found" });
            
            const tierProgress = getTierProgress(user.total_loops_earned || 0);
            
            // Calculate plan multipliers
            let planMultiplier = 1;
            if (user.plan === "BASIC") planMultiplier = 1.1;
            else if (user.plan === "PLUS") planMultiplier = 1.15;
            else if (user.plan === "PREMIUM") planMultiplier = 1.2;
            
            // Plan details
            const plans = {
                STARTER: { name: "Starter", multiplier: 1.0, description: "Basic plan" },
                BASIC: { name: "Basic", multiplier: 1.1, description: "10% bonus on all purchases" },
                PLUS: { name: "Plus", multiplier: 1.15, description: "15% bonus on all purchases" },
                PREMIUM: { name: "Premium", multiplier: 1.2, description: "20% bonus on all purchases" }
            };

            res.json({
                currentPlan: user.plan || "STARTER",
                planDetails: plans[user.plan || "STARTER"] || plans.STARTER,
                planMultiplier,
                ...tierProgress,
                combinedMultiplier: (planMultiplier * tierProgress.tierMultiplier).toFixed(2)
            });
        }
    );
});

// User plan upgrade (MVP: BASIC only)
app.post("/api/users/plan", auth("user"), (req, res) => {
    const userId = req.user.id;
    const requestedPlan = String(req.body.plan || "").toUpperCase();

    if (!requestedPlan) {
        return res.status(400).json({ error: "Plan is required" });
    }

    if (requestedPlan !== "BASIC") {
        return res.status(400).json({ error: "Only BASIC is available right now" });
    }

    db.get("SELECT plan FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });
        const currentPlan = (user.plan || "STARTER").toUpperCase();
        if (currentPlan === requestedPlan) {
            return res.json({ success: true, plan: currentPlan, message: "Plan already active" });
        }

        db.run(
            "UPDATE users SET plan = ? WHERE id = ?",
            [requestedPlan, userId],
            (err2) => {
                if (err2) {
                    return res.status(500).json({ error: "Failed to update plan" });
                }

                db.run(
                    "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'PLAN', ?, ?)",
                    [
                        userId,
                        0,
                        JSON.stringify({
                            type: "plan_change",
                            from: currentPlan,
                            to: requestedPlan
                        })
                    ],
                    (err3) => {
                        if (err3) {
                        }
                        res.json({ success: true, plan: requestedPlan });
                    }
                );
            }
        );
    });
});

app.get("/api/users/me", auth("user"), (req, res) => {
    const userId = req.user.id;
    const period = Number(req.query.period || 30);
    const storeId = req.query.store_id ? Number(req.query.store_id) : null;
    
    db.get(
        "SELECT id, phone, email, name, address, dob, address_line1, address_line2, city, state, postal_code, latitude, longitude, primary_zone, secondary_zone, plan, loops_balance, total_loops_earned, qr_code, location_set FROM users WHERE id = ?",
        [userId],
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: "User not found" });

            // Get EARN transactions
            let earnQuery = `SELECT
                   t.id,
                   s.name AS store_name,
                   t.amount_cents,
                   t.loops_earned,
                   strftime('%Y-%m-%dT%H:%M:%S', t.created_at) AS created_at,
                   'EARN' AS transaction_type,
                   NULL AS redeem_type
         FROM transactions t 
         JOIN stores s ON t.store_id = s.id
         WHERE t.user_id = ?`;
            
            const earnParams = [userId];
            
            if (period > 0) {
                // SQLite date calculation - calculate date in JavaScript
                const daysAgo = new Date();
                daysAgo.setDate(daysAgo.getDate() - period);
                const dateStr = daysAgo.toISOString().split('T')[0];
                earnQuery += ` AND date(t.created_at) >= date(?)`;
                earnParams.push(dateStr);
            }
            
            if (storeId && storeId > 0) {
                earnQuery += ` AND t.store_id = ?`;
                earnParams.push(storeId);
            }
            
            // Get REDEEM transactions from loops_ledger
            let redeemQuery = `SELECT
                   ll.id,
                   'Redeemed' AS store_name,
                   0 AS amount_cents,
                   ABS(ll.amount) AS loops_earned,
                   strftime('%Y-%m-%dT%H:%M:%S', ll.created_at) AS created_at,
                   'REDEEM' AS transaction_type,
                   CASE 
                       WHEN ll.meta LIKE 'gift_card:%' THEN 'Gift Card'
                       WHEN ll.meta LIKE 'gift_card_topup:%' THEN 'Gift Card Top-Up'
                       ELSE 'Direct Redemption'
                   END AS redeem_type
         FROM loops_ledger ll
         WHERE ll.user_id = ? AND ll.change_type = 'REDEEM'`;
            
            const redeemParams = [userId];
            
            if (period > 0) {
                // SQLite date calculation - calculate date in JavaScript
                const daysAgo = new Date();
                daysAgo.setDate(daysAgo.getDate() - period);
                const dateStr = daysAgo.toISOString().split('T')[0];
                redeemQuery += ` AND date(ll.created_at) >= date(?)`;
                redeemParams.push(dateStr);
            }
            
            if (storeId && storeId > 0) {
                redeemQuery += ` AND (
                    ll.meta = ? OR ll.meta LIKE ? OR
                    (ll.meta LIKE 'gift_card:%' AND EXISTS (
                        SELECT 1 FROM gift_cards gc
                        WHERE gc.user_id = ll.user_id
                          AND gc.store_id = ?
                          AND ll.meta LIKE ('gift_card:' || gc.id || ':%')
                    )) OR
                    (ll.meta LIKE 'gift_card_topup:%' AND EXISTS (
                        SELECT 1 FROM gift_cards gc
                        WHERE gc.user_id = ll.user_id
                          AND gc.store_id = ?
                          AND ll.meta LIKE ('gift_card_topup:' || gc.id || '%')
                    ))
                )`;
                redeemParams.push(`store:${storeId}`, `store:${storeId}:%`, storeId, storeId);
            }
            
            // Combine both queries using UNION (remove outer parentheses for SQLite compatibility)
            const combinedQuery = `${earnQuery} UNION ALL ${redeemQuery} ORDER BY created_at DESC LIMIT 200`;
            const combinedParams = [...earnParams, ...redeemParams];
            
            db.all(combinedQuery, combinedParams, (err2, txs) => {
                if (err2) {
                    txs = [];
                }

                db.all(
                    `SELECT t.store_id, s.name as store_name, COALESCE(SUM(t.loops_earned), 0) as earned_loops
                     FROM transactions t
                     JOIN stores s ON s.id = t.store_id
                     WHERE t.user_id = ?
                     GROUP BY t.store_id, s.name`,
                    [userId],
                    (err3, earnedRows) => {
                        if (err3) {
                            return res.json({ user, transactions: txs, store_loops_balances: [], store_loops_balance_map: {}, tier_progress: getTierProgress(user.total_loops_earned || 0) });
                        }

                        db.all(
                            `SELECT amount, meta
                             FROM loops_ledger
                             WHERE user_id = ? AND change_type = 'REDEEM'`,
                            [userId],
                            (err4, redeemRows) => {
                                if (err4) {
                                    return res.json({ user, transactions: txs, store_loops_balances: [], store_loops_balance_map: {}, tier_progress: getTierProgress(user.total_loops_earned || 0) });
                                }

                                db.all(
                                    `SELECT gc.store_id, COALESCE(SUM(gct.loops_used), 0) as redeemed_loops
                                     FROM gift_cards gc
                                     JOIN gift_card_transactions gct ON gct.gift_card_id = gc.id
                                     WHERE gc.user_id = ?
                                       AND gc.store_id IS NOT NULL
                                       AND gct.payment_method = 'points'
                                     GROUP BY gc.store_id`,
                                    [userId],
                                    (err5, giftRedeemRows) => {
                                        if (err5) {
                                            return res.json({ user, transactions: txs, store_loops_balances: [], store_loops_balance_map: {}, tier_progress: getTierProgress(user.total_loops_earned || 0) });
                                        }

                                        const balances = new Map();

                                        for (const row of (earnedRows || [])) {
                                            const sid = Number(row.store_id);
                                            if (!sid) continue;
                                            balances.set(sid, {
                                                store_id: sid,
                                                store_name: row.store_name || `Store ${sid}`,
                                                earned_loops: Number(row.earned_loops || 0),
                                                redeemed_loops: 0,
                                                available_loops: Number(row.earned_loops || 0),
                                            });
                                        }

                                        // Direct redeem rows use meta like: store:{storeId}[:...]
                                        for (const row of (redeemRows || [])) {
                                            const meta = String(row.meta || "");
                                            const match = meta.match(/store:(\d+)/i);
                                            const sid = match ? Number(match[1]) : 0;
                                            if (!sid) continue;
                                            const redeemed = Math.abs(Number(row.amount || 0));
                                            const current = balances.get(sid) || {
                                                store_id: sid,
                                                store_name: `Store ${sid}`,
                                                earned_loops: 0,
                                                redeemed_loops: 0,
                                                available_loops: 0,
                                            };
                                            current.redeemed_loops += redeemed;
                                            current.available_loops = Math.max(0, current.earned_loops - current.redeemed_loops);
                                            balances.set(sid, current);
                                        }

                                        // Gift card create/top-up points usage tied to store_id
                                        for (const row of (giftRedeemRows || [])) {
                                            const sid = Number(row.store_id);
                                            if (!sid) continue;
                                            const redeemed = Number(row.redeemed_loops || 0);
                                            const current = balances.get(sid) || {
                                                store_id: sid,
                                                store_name: `Store ${sid}`,
                                                earned_loops: 0,
                                                redeemed_loops: 0,
                                                available_loops: 0,
                                            };
                                            current.redeemed_loops += redeemed;
                                            current.available_loops = Math.max(0, current.earned_loops - current.redeemed_loops);
                                            balances.set(sid, current);
                                        }

                                        const storeLoopsBalances = Array.from(balances.values())
                                            .map((b) => ({
                                                ...b,
                                                earned_loops: Math.max(0, Math.floor(b.earned_loops || 0)),
                                                redeemed_loops: Math.max(0, Math.floor(b.redeemed_loops || 0)),
                                                available_loops: Math.max(0, Math.floor(b.available_loops || 0)),
                                            }))
                                            .sort((a, b) => b.available_loops - a.available_loops);

                                        const storeLoopsBalanceMap = {};
                                        for (const row of storeLoopsBalances) {
                                            storeLoopsBalanceMap[String(row.store_id)] = row.available_loops;
                                        }

                                        return res.json({
                                            user,
                                            transactions: txs,
                                            store_loops_balances: storeLoopsBalances,
                                            store_loops_balance_map: storeLoopsBalanceMap,
                                            tier_progress: getTierProgress(user.total_loops_earned || 0),
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        }
    );
});

// Update user profile
app.put("/api/users/profile", auth("user"), (req, res) => {
    const userId = req.user.id;
    const {
        name,
        email,
        address,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        dob
    } = req.body;
    
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }
    
    const updates = [];
    const params = [];
    
    if (name) {
        updates.push("name = ?");
        params.push(name.trim());
    }

    if (dob !== undefined) {
        if (!isValidDob(dob)) {
            return res.status(400).json({ error: "Date of birth must be YYYY-MM-DD" });
        }
        updates.push("dob = ?");
        params.push(dob ? String(dob).trim() : null);
    }
    
    if (email !== undefined) {
        updates.push("email = ?");
        params.push(email ? email.trim() : null);
    }
    
    const hasAddressParts =
        address_line1 !== undefined ||
        address_line2 !== undefined ||
        city !== undefined ||
        state !== undefined ||
        postal_code !== undefined;

    if (hasAddressParts) {
        updates.push("address_line1 = ?");
        params.push(address_line1 ? String(address_line1).trim() : null);
        updates.push("address_line2 = ?");
        params.push(address_line2 ? String(address_line2).trim() : null);
        updates.push("city = ?");
        params.push(city ? String(city).trim() : null);
        updates.push("state = ?");
        params.push(state ? String(state).trim() : null);
        updates.push("postal_code = ?");
        params.push(postal_code ? String(postal_code).trim() : null);
    }

    if (address !== undefined || hasAddressParts) {
        const composed = buildAddressString({
            address_line1,
            address_line2,
            city,
            state,
            postal_code
        });
        const finalAddress = composed || (address ? String(address).trim() : null);
        updates.push("address = ?");
        params.push(finalAddress);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    
    params.push(userId);
    
    db.run(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        params,
        function(err) {
            if (err) {
                return res.status(500).json({ error: "Failed to update profile" });
            }
            
            // Get updated user
            db.get(
        "SELECT id, phone, email, name, address, dob, address_line1, address_line2, city, state, postal_code, latitude, longitude, primary_zone, secondary_zone, plan, loops_balance, total_loops_earned, qr_code, location_set FROM users WHERE id = ?",
                [userId],
                (err2, user) => {
                    if (err2 || !user) {
                        return res.status(500).json({ error: "Profile updated but failed to retrieve updated data" });
                    }
                    
                    res.json({ 
                        success: true, 
                        message: "Profile updated successfully",
                        user 
                    });
                }
            );
        }
    );
});

// Update user location
app.post("/api/users/location", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude, address } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Invalid coordinates" });
    }
    
    db.run(
        "UPDATE users SET latitude = ?, longitude = ?, address = ?, location_set = 1 WHERE id = ?",
        [lat, lng, address || null, userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Failed to update location" });
            }
            res.json({ success: true, message: "Location updated" });
        }
    );
});

// Update user location using address fields (geocoded)
app.post("/api/users/location-by-address", auth("user"), async (req, res) => {
    const userId = req.user.id;
    const { address_line1, address_line2, city, state, postal_code } = req.body;
    const fullAddress = buildAddressString({ address_line1, address_line2, city, state, postal_code });

    if (!address_line1 || !city || !state || !postal_code) {
        return res.status(400).json({ error: "Address line 1, city, state, and postal code are required" });
    }

    try {
        const geocode = await fetchGoogleGeocode(fullAddress);
        if (!geocode) {
            return res.status(400).json({ error: "Unable to geocode address" });
        }

        db.run(
            "UPDATE users SET address = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, postal_code = ?, latitude = ?, longitude = ?, location_set = 1 WHERE id = ?",
            [
                geocode.formattedAddress || fullAddress,
                address_line1 || null,
                address_line2 || null,
                city || null,
                state || null,
                postal_code || null,
                geocode.lat,
                geocode.lng,
                userId
            ],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: "Failed to update location" });
                }
                res.json({
                    success: true,
                    message: "Location updated",
                    latitude: geocode.lat,
                    longitude: geocode.lng,
                    address: geocode.formattedAddress || fullAddress
                });
            }
        );
    } catch (e) {
        res.status(500).json({ error: e.message || "Failed to update location" });
    }
});

// Scan customer QR code (store scans customer)
app.post("/api/stores/scan-customer", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    const { qrCode } = req.body;
    
    if (!qrCode) {
        return res.status(400).json({ error: "QR code is required" });
    }
    
    // Parse QR code: USER:phone:random
    if (!qrCode.startsWith("USER:")) {
        return res.status(400).json({ error: "Invalid customer QR code format" });
    }
    
    const parts = qrCode.split(":");
    if (parts.length < 2) {
        return res.status(400).json({ error: "Invalid QR code format" });
    }
    
    const phone = parts[1];
    
    db.get("SELECT id, name, phone, email, loops_balance FROM users WHERE phone = ?", [phone], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "Customer not found" });
        }
        
        if (!BLACKLIST_ENABLED) {
            return res.json({
                customer: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    loopsBalance: user.loops_balance,
                    isBlacklisted: false,
                    blacklistReason: null
                }
            });
        }

        // Check if customer is blacklisted
        db.get("SELECT * FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?", [storeId, user.id], (errBlacklist, blacklistEntry) => {
            if (errBlacklist) {
                // Don't fail the scan, just log the error
            }

            res.json({
                customer: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    loopsBalance: user.loops_balance,
                    isBlacklisted: !!blacklistEntry,
                    blacklistReason: blacklistEntry?.reason || null
                }
            });
        });
    });
});

// ---------- Hybrid System: CIV + DVS ----------

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Return in meters
}

// Helper: Analyze CIV (Consumption-Intent Verification) score
function analyzeCIVScore(sessionId, storeLat, storeLng, callback) {
    // Get location history for this session
    db.all(
        "SELECT latitude, longitude, timestamp FROM location_history WHERE session_id = ? ORDER BY timestamp ASC",
        [sessionId],
        (err, locations) => {
            if (err || !locations || locations.length === 0) {
                // No location data yet, return default score
                return callback(0.5); // Medium confidence
            }
            
            let score = 0.5; // Start with medium confidence
            
            // Signal 1: Location Dwell Curve (30% weight)
            if (locations.length >= 3) {
                const firstLocation = locations[0];
                const lastLocation = locations[locations.length - 1];
                const visitDuration = (new Date(lastLocation.timestamp) - new Date(firstLocation.timestamp)) / 1000 / 60; // minutes
                
                // Check if customer moved around (browsing pattern)
                let maxDistance = 0;
                for (let i = 1; i < locations.length; i++) {
                    const dist = calculateDistance(
                        locations[i-1].latitude, locations[i-1].longitude,
                        locations[i].latitude, locations[i].longitude
                    );
                    maxDistance = Math.max(maxDistance, dist);
                }
                
                // Browsing pattern: Multiple stops, varying distances (indicates shopping)
                if (visitDuration >= 3 && maxDistance > 5) { // At least 3 min and moved >5m
                    score += 0.3; // High confidence for browsing
                } else if (visitDuration >= 1) {
                    score += 0.15; // Medium confidence
                }
            }
            
            // Signal 2: Proximity to store (20% weight)
            if (storeLat && storeLng) {
                const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
                const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
                const avgDistance = calculateDistance(avgLat, avgLng, storeLat, storeLng);
                
                if (avgDistance < 50) { // Within 50m of store
                    score += 0.2;
                } else if (avgDistance < 100) {
                    score += 0.1;
                }
            }
            
            // Signal 3: Visit duration (20% weight)
            if (locations.length >= 2) {
                const firstTime = new Date(locations[0].timestamp);
                const lastTime = new Date(locations[locations.length - 1].timestamp);
                const duration = (lastTime - firstTime) / 1000 / 60; // minutes
                
                // Typical visit durations: 3-30 minutes for most stores
                if (duration >= 3 && duration <= 60) {
                    score += 0.2;
                } else if (duration >= 1) {
                    score += 0.1;
                }
            }
            
            // Signal 4: Movement pattern (10% weight)
            if (locations.length >= 5) {
                // Check for browsing pattern (multiple stops)
                let stops = 0;
                for (let i = 1; i < locations.length; i++) {
                    const dist = calculateDistance(
                        locations[i-1].latitude, locations[i-1].longitude,
                        locations[i].latitude, locations[i].longitude
                    );
                    if (dist < 2) { // Stopped (moved less than 2m)
                        stops++;
                    }
                }
                
                if (stops >= 3) { // Multiple stops indicate browsing
                    score += 0.1;
                }
            }
            
            // Signal 5: Return probability (20% weight - will be updated later)
            // This will be calculated when checking for return visits
            // For now, assume medium confidence
            score += 0.1;
            
            // Clamp score between 0 and 1
            score = Math.min(1.0, Math.max(0.0, score));
            
            callback(score);
        }
    );
}

// Helper: Estimate purchase amount based on store average or user history
function estimatePurchaseAmount(storeId, userId, callback) {
    // Try to get user's average at this store
    db.get(
        "SELECT AVG(amount_cents) as avg_amount FROM transactions WHERE user_id = ? AND store_id = ?",
        [userId, storeId],
        (err, userAvg) => {
            if (err || !userAvg || !userAvg.avg_amount) {
                // Fallback to store average
                db.get(
                    "SELECT AVG(amount_cents) as avg_amount FROM transactions WHERE store_id = ?",
                    [storeId],
                    (err2, storeAvg) => {
                        if (err2 || !storeAvg || !storeAvg.avg_amount) {
                            // Default to $10 (1000 cents) if no data
                            return callback(1000);
                        }
                        callback(Math.round(storeAvg.avg_amount));
                    }
                );
            } else {
                callback(Math.round(userAvg.avg_amount));
            }
        }
    );
}

// Helper: Calculate loops based on visit frequency and user plan/tier
// Helper functions for loop calculation
function getPlanMultiplier(plan) {
    if (plan === "BASIC") return 1.1;
    if (plan === "PLUS") return 1.15;
    if (plan === "PREMIUM") return 1.2;
    return 1.0; // STARTER
}

function getTierMultiplier(totalLoopsEarned) {
    return getTierProgress(totalLoopsEarned).tierMultiplier;
}

// Legacy function - kept for backward compatibility, but now uses category profiles
function calculateLoopsBasedOnFrequency(storeId, userId, user, callback) {
    // This function is now deprecated in favor of category-based calculation
    // But kept for any legacy code that might call it
    // Count how many times user has visited this store (completed sessions)
    db.get(
        "SELECT COUNT(*) as visit_count FROM check_in_sessions WHERE user_id = ? AND store_id = ? AND status = 'completed'",
        [userId, storeId],
        (err, result) => {
            if (err) {
                return callback(10); // Default base points
            }
            
            const visitCount = result ? result.visit_count : 0;
            
            // Base points increase with visit frequency
            // First visit: 10 points
            // 2-5 visits: 15 points
            // 6-10 visits: 20 points
            // 11-20 visits: 25 points
            // 21+ visits: 30 points
            let baseLoops = 10;
            if (visitCount >= 21) {
                baseLoops = 30;
            } else if (visitCount >= 11) {
                baseLoops = 25;
            } else if (visitCount >= 6) {
                baseLoops = 20;
            } else if (visitCount >= 1) {
                baseLoops = 15;
            }
            
            // Apply plan multiplier
            const planMultiplier = getPlanMultiplier(user.plan);
            
            // Apply tier multiplier
            const tierMultiplier = getTierMultiplier(user.total_loops_earned || 0);
            
            const finalLoops = Math.round(baseLoops * planMultiplier * tierMultiplier);
            callback(finalLoops);
        }
    );
}

// Check-in endpoint (replaces scan-store) - Updated with category-based rules and NFC support
app.post("/api/users/check-in", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { qrCode, storeId, latitude, longitude, checkInMethod } = req.body || {};

        // Support both QR code and direct storeId (for NFC/Wallet)
        let finalStoreId = storeId;
        if (qrCode) {
            if (!String(qrCode).startsWith("STORE:")) {
        return res.status(400).json({ error: "Invalid store QR code format" });
    }
            const parts = String(qrCode).split(":");
    if (parts.length < 2) {
        return res.status(400).json({ error: "Invalid QR code format" });
    }
            finalStoreId = parseInt(parts[1], 10);
            if (Number.isNaN(finalStoreId)) {
        return res.status(400).json({ error: "Invalid store ID in QR code" });
            }
        }

        if (!finalStoreId) {
            return res.status(400).json({ error: "Store ID or QR code is required" });
        }

        const store = await dbGetAsync(
            "SELECT id, name, category, latitude, longitude FROM stores WHERE id = ?",
            [finalStoreId]
        );
        if (!store) {
            return res.status(404).json({
                error: "This store is not registered with us yet. We will get back soon.",
                unregistered_store: true,
            });
        }
        
        if (BLACKLIST_ENABLED) {
            const blacklistEntry = await dbGetAsync(
                "SELECT id, reason, created_at FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?",
                [finalStoreId, userId]
            );
            if (blacklistEntry) {
                return res.status(403).json({
                    error: "You have been blocked from this store",
                    reason: blacklistEntry.reason || "No reason provided",
                    blocked_at: blacklistEntry.created_at
                });
            }
        }

        const cycleMonth = getCycleMonth();
        const enrolled = await dbGetAsync(
            `SELECT CASE WHEN
                (SELECT COUNT(*) FROM store_memberships WHERE user_id = ? AND store_id = ? AND status = 'active') > 0 OR
                (SELECT COUNT(*) FROM store_slots WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active') > 0 OR
                (SELECT COUNT(*) FROM store_unlocks WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active') > 0
             THEN 1 ELSE 0 END AS is_enrolled`,
            [userId, finalStoreId, userId, finalStoreId, cycleMonth, userId, finalStoreId, cycleMonth]
        );

        if (!enrolled || enrolled.is_enrolled !== 1) {
            const offer = await dbGetAsync(
                "SELECT unlock_cost_cents, unlock_cost_loops, is_locked, min_plan FROM store_offers WHERE store_id = ?",
                [finalStoreId]
            );
            const user = await dbGetAsync("SELECT plan, loops_balance FROM users WHERE id = ?", [userId]);
            const slotLimit = getPlanStoreLimit(user?.plan);
            const slotCountRow = await dbGetAsync(
                "SELECT COUNT(*) as active_count FROM store_slots WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
                [userId, cycleMonth]
            );
            const activeCount = slotCountRow?.active_count || 0;
            const requiresPayment = slotLimit > 0 && activeCount >= slotLimit;
            let unlockCostCents = offer?.unlock_cost_cents || 0;
            let unlockCostLoops = offer?.unlock_cost_loops || 0;
            if (!requiresPayment) {
                unlockCostCents = 0;
                unlockCostLoops = 0;
            }
            if (requiresPayment && unlockCostCents === 0 && unlockCostLoops === 0) {
                unlockCostCents = 299;
                unlockCostLoops = 300;
            }
            return res.status(403).json({
                error: "Store enrollment required",
                requires_enrollment: true,
                requires_payment: requiresPayment,
                active_count: activeCount,
                slot_limit: slotLimit,
                store_id: finalStoreId,
                store_name: store.name,
                unlock_cost_cents: unlockCostCents,
                unlock_cost_loops: unlockCostLoops,
                is_locked: offer?.is_locked === 1,
                min_plan: offer?.min_plan || "STARTER",
                user_plan: user?.plan || null,
                user_loops_balance: user?.loops_balance || 0,
                message: requiresPayment
                    ? "You have reached your free store slots for this month. Unlock this store to continue."
                    : "You must enroll at this store before scanning."
            });
        }

        const existingSession = await dbGetAsync(
            "SELECT id, expires_at FROM check_in_sessions WHERE user_id = ? AND store_id = ? AND status = 'active' AND expires_at > datetime('now')",
            [userId, finalStoreId]
        );
                if (existingSession) {
            const pending = await dbGetAsync(
                "SELECT loops_pending, loops_unlocked FROM pending_points WHERE session_id = ? AND status = 'pending'",
                [existingSession.id]
            );
            const loopsPending = pending ? (pending.loops_pending - (pending.loops_unlocked || 0)) : 0;
            const expiresAtISO = existingSession.expires_at
                ? new Date(existingSession.expires_at).toISOString()
                : new Date(Date.now() + 30 * 60 * 1000).toISOString();
            return res.json({
                        success: true,
                        sessionId: existingSession.id,
                store: { id: store.id, name: store.name, category: store.category },
                loopsInstant: 0,
                loopsPending,
                totalLoops: loopsPending,
                expiresAt: expiresAtISO,
                        message: "Already checked in!"
                    });
        }

        const checkInResult = await new Promise((resolve, reject) => {
            canCheckIn(userId, finalStoreId, store.category, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
        if (!checkInResult?.allowed) {
            return res.status(429).json({
                error: checkInResult?.reason || "Check-in not allowed",
                cooldownMinutes: checkInResult?.cooldownMinutes,
                message: checkInResult?.reason || "Check-in not allowed"
            });
        }

        // Create check-in session
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);
        const method = checkInMethod || "qr";
        const insertSession = await dbRunAsync(
            "INSERT INTO check_in_sessions (user_id, store_id, expires_at, check_in_method) VALUES (?, ?, ?, ?)",
            [userId, finalStoreId, expiresAt.toISOString(), method]
        );
        const sessionId = insertSession.lastID;

        if (latitude != null && longitude != null) {
            await dbRunAsync(
                                    "INSERT INTO location_history (session_id, latitude, longitude) VALUES (?, ?, ?)",
                                    [sessionId, parseFloat(latitude), parseFloat(longitude)]
                                );
                            }
                            
        const user = await dbGetAsync("SELECT * FROM users WHERE id = ?", [userId]);
        if (!user) {
                                    return res.status(500).json({ error: "User not found" });
                                }
                                
        const profile = checkInResult.profile || {};
        const beforeTier = getTierProgress(user.total_loops_earned || 0);
        const storeOffer = await dbGetAsync(
            "SELECT reward_points FROM store_offers WHERE store_id = ?",
            [finalStoreId]
        ).catch(() => null);
        const configuredBasePoints = Number(storeOffer?.reward_points || 0);
        const fallbackBaseLoops = configuredBasePoints > 0
            ? configuredBasePoints
            : Number(profile.base_points || 10);
        const effectiveRewardConfig = await getEffectiveStoreRewardPoints(finalStoreId, fallbackBaseLoops);
        const baseLoops = effectiveRewardConfig.effectivePoints;
        const planMultiplier = getPlanMultiplier(user.plan);
        const tierMultiplier = getTierMultiplier(user.total_loops_earned || 0);
        const totalLoops = Math.round(baseLoops * planMultiplier * tierMultiplier);
        const pendingRatio = profile.pending_ratio || 1.0;
        const instantLoops = Math.round(totalLoops * (1 - pendingRatio));
        const pendingLoops = totalLoops - instantLoops;

        if (instantLoops > 0) {
            await dbRunAsync(
                "UPDATE users SET loops_balance = loops_balance + ?, total_loops_earned = total_loops_earned + ? WHERE id = ?",
                [instantLoops, instantLoops, userId]
            );
            await dbRunAsync(
                "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'EARN', ?, ?)",
                [userId, instantLoops, JSON.stringify({ type: "instant", store_id: finalStoreId, session_id: sessionId })]
            );
        }

        if (pendingLoops > 0) {
            const pendingExpiresAt = new Date();
            const dvsExpiryDays = profile.dvs_expiry_days || 7;
            pendingExpiresAt.setDate(pendingExpiresAt.getDate() + dvsExpiryDays);
            await dbRunAsync(
                "INSERT INTO pending_points (user_id, store_id, session_id, loops_pending, expires_at, civ_score) VALUES (?, ?, ?, ?, ?, ?)",
                [userId, finalStoreId, sessionId, pendingLoops, pendingExpiresAt.toISOString(), 0.5]
            );
                                            setTimeout(() => {
                checkSettlementTriggers(userId, finalStoreId, () => {});
                                            }, 500);
        }

        io.emit("transaction", {
            type: "check-in",
            userId,
            storeId: finalStoreId,
            storeName: store.name,
            loopsInstant: instantLoops,
            loopsPending: pendingLoops > 0 ? pendingLoops : 0
        });

        const sessionCount = await dbGetAsync("SELECT COUNT(*) AS c FROM check_in_sessions WHERE user_id = ?", [userId]).then((r) => r?.c || 0).catch(() => 0);
        if (sessionCount === 1) {
            recordAnalyticsEvent({ event_type: "first_checkin", actor_type: "user", actor_id: userId, payload: { store_id: finalStoreId } }, req);
        }

        const updatedTotalEarned = Number(user.total_loops_earned || 0) + Math.max(0, instantLoops);
        const afterTier = getTierProgress(updatedTotalEarned);
        const levelUp = instantLoops > 0 && beforeTier.currentTier !== afterTier.currentTier
            ? {
                fromTier: beforeTier.currentTier,
                toTier: afterTier.currentTier,
                totalLoopsEarned: updatedTotalEarned,
                message: `Level up! ${beforeTier.currentTier} -> ${afterTier.currentTier}`,
            }
            : null;

        return res.json({
                                                success: true,
                                                sessionId,
            store: { id: store.id, name: store.name, category: store.category },
            loopsInstant: instantLoops,
            loopsPending: pendingLoops > 0 ? pendingLoops : 0,
            totalLoops,
            effectiveBaseLoops: baseLoops,
            activeRewardSchedule: effectiveRewardConfig.activeSchedule,
            expiresAt: expiresAt.toISOString(),
            levelUp,
            message: instantLoops > 0
                ? `You earned ${instantLoops} loops now!${pendingLoops > 0 ? ` ${pendingLoops} more pending.` : ""}`
                : `${pendingLoops} loops pending (unlocks after your visit is confirmed).`
        });
    } catch (e) {
        return res.status(500).json({ error: "Failed to check in" });
    }
});


// Legacy endpoint for backward compatibility
app.post("/api/users/scan-store", auth("user"), (req, res) => {
    // Redirect to check-in endpoint
    req.url = "/api/users/check-in";
    app._router.handle(req, res);
});

// Update location during check-in session (for CIV)
app.post("/api/users/check-in/location", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { sessionId, latitude, longitude, accuracy } = req.body;
    
    if (!sessionId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "sessionId, latitude, and longitude are required" });
    }
    
    // Verify session belongs to user
    db.get(
        "SELECT id FROM check_in_sessions WHERE id = ? AND user_id = ? AND status = 'active'",
        [sessionId, userId],
        (err, session) => {
            if (err || !session) {
                return res.status(404).json({ error: "Session not found or expired" });
            }
            
            // Record location
            db.run(
                "INSERT INTO location_history (session_id, latitude, longitude, accuracy) VALUES (?, ?, ?, ?)",
                [sessionId, parseFloat(latitude), parseFloat(longitude), accuracy ? parseFloat(accuracy) : null],
                (err2) => {
                    if (err2) {
                        return res.status(500).json({ error: "Failed to record location" });
                    }
                    
                    res.json({ success: true });
                }
            );
        }
    );
});

// Complete check-in session and calculate CIV score
app.post("/api/users/check-in/complete", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
    }
    
    // Use a transaction to prevent duplicate completions
    db.serialize(() => {
        // First, try to mark session as completed atomically
        db.run(
            "UPDATE check_in_sessions SET status = 'completed' WHERE id = ? AND user_id = ? AND status = 'active'",
            [sessionId, userId],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: "Failed to complete session" });
                }
                
                // Check if any rows were updated (prevents duplicate completions)
                if (this.changes === 0) {
                    return res.status(404).json({ error: "Session not found, expired, or already completed" });
                }
                
                // Get the session data
    db.get(
                    "SELECT * FROM check_in_sessions WHERE id = ? AND user_id = ?",
        [sessionId, userId],
                    (err2, session) => {
                        if (err2 || !session) {
                            return res.status(404).json({ error: "Session not found" });
            }
            
            // Get store location
                        db.get("SELECT latitude, longitude FROM stores WHERE id = ?", [session.store_id], (err3, store) => {
                            if (err3 || !store) {
                    return res.status(500).json({ error: "Store not found" });
                }
                
                // Calculate CIV score
                analyzeCIVScore(sessionId, store.latitude, store.longitude, (civScore) => {
                    // Update pending points with CIV score
                    db.get(
                        "SELECT * FROM pending_points WHERE session_id = ? AND status = 'pending'",
                        [sessionId],
                                    (err4, pending) => {
                            if (pending) {
                                // Adjust pending points based on CIV score
                                let adjustedLoops = pending.loops_pending;
                                if (civScore >= 0.8) {
                                    // High confidence - keep full amount
                                    adjustedLoops = pending.loops_pending;
                                } else if (civScore >= 0.6) {
                                    // Medium confidence - 70% of amount
                                    adjustedLoops = Math.floor(pending.loops_pending * 0.7);
                                } else {
                                    // Low confidence - 30% of amount
                                    adjustedLoops = Math.floor(pending.loops_pending * 0.3);
                                }
                                
                                db.run(
                                    "UPDATE pending_points SET loops_pending = ?, civ_score = ? WHERE id = ?",
                                    [adjustedLoops, civScore, pending.id]
                                );
                            }
                            
                                        // Session already marked as completed above, just return response
                                    res.json({
                                        success: true,
                                        civScore,
                                        message: "Session completed. Points will unlock when you return!"
                                    });
                                }
                            );
                            });
                        });
                        }
                    );
            });
        }
    );
});

// Get pending points for user
app.get("/api/users/pending-points", auth("user"), (req, res) => {
    const userId = req.user.id;
    
    db.all(
        `SELECT pp.*, s.name as store_name, s.category as store_category 
         FROM pending_points pp
         JOIN stores s ON pp.store_id = s.id
         WHERE pp.user_id = ? AND pp.status = 'pending' AND pp.expires_at > datetime('now')
         ORDER BY pp.created_at DESC`,
        [userId],
        (err, pendingPoints) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            res.json({ pendingPoints: pendingPoints || [] });
        }
    );
});

// ---------- WebAuthn (Facial Recognition) for Customers ----------

// Generate registration options (start facial recognition setup)
app.post("/api/users/webauthn/register/start", auth("user"), async (req, res) => {
    const userId = req.user.id;
    
    // Get existing credentials for this user
    db.all("SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ?", [userId], async (err, credentials) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        const userName = req.user.name || req.user.phone || `User${userId}`;
        const user = {
            id: userId.toString(),
            name: userName,
            displayName: userName,
        };
        
        try {
            // Map existing credentials for exclusion (handle null/undefined)
            const excludeCredentials = (credentials || []).map(cred => {
                try {
                    // credential_id is stored as base64 string, convert to buffer then back to base64URL
                    const credIdBuffer = isoBase64URL.toBuffer(cred.credential_id);
                    return {
                        id: isoBase64URL.fromBuffer(credIdBuffer),
                        type: "public-key",
                    };
                } catch (err) {
                    return null;
                }
            }).filter(Boolean);

            // Validate required fields
            if (!userName || userName.trim().length === 0) {
                return res.status(400).json({ error: "User name is required" });
            }

            // Convert userID to Uint8Array properly
            const userIDBuffer = isoUint8Array.fromUTF8String(userId.toString());
            
            const opts = {
                rpName: RP_NAME,
                rpID: RP_ID,
                userID: userIDBuffer,
                userName: userName.trim(),
                timeout: 60000,
                attestationType: "none",
                excludeCredentials: excludeCredentials,
                authenticatorSelection: {
                    // "platform" works on iOS (Face ID/Touch ID) and Android (Face Unlock/Fingerprint)
                    // On mobile devices, this will use the device's built-in biometric authenticator
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                    // residentKey: "preferred" // Optional: allows passwordless login in future
                },
                supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
            };
            
            
            let options;
            try {
                // In @simplewebauthn/server v13+, generateRegistrationOptions returns a Promise
                const result = generateRegistrationOptions(opts);
                
                // Always await it since v13+ returns a Promise
                if (result && typeof result.then === 'function') {
                    options = await result;
                } else {
                    // Fallback for older versions (shouldn't happen in v13+)
                    options = result;
                }
                
                
                if (!options || !options.challenge) {
                    if (options) {
                    }
                    return res.status(500).json({ error: "Failed to generate valid registration options" });
                }
                
            } catch (genError) {
                return res.status(500).json({ error: "Failed to generate registration options: " + (genError.message || "Unknown error") });
            }
                
                // Store challenge temporarily (in production, use Redis)
                if (!global.webauthnChallenges) global.webauthnChallenges = {};
                global.webauthnChallenges[userId] = {
                    challenge: options.challenge,
                    type: "registration",
                    timestamp: Date.now(),
                };
                
                res.json(options);
            } catch (error) {
                res.status(500).json({ error: "Failed to generate registration options: " + (error.message || "Unknown error") });
            }
    });
});

// Verify registration response (complete facial recognition setup)
app.post("/api/users/webauthn/register/finish", auth("user"), async (req, res) => {
    const userId = req.user.id;
    const { credential, deviceName } = req.body;
    
    if (!credential) {
        return res.status(400).json({ error: "Credential is required" });
    }
    
    // Get stored challenge
    if (!global.webauthnChallenges || !global.webauthnChallenges[userId]) {
        return res.status(400).json({ error: "Registration session expired. Please try again." });
    }
    
    const challengeData = global.webauthnChallenges[userId];
    if (challengeData.type !== "registration") {
        return res.status(400).json({ error: "Invalid challenge type" });
    }
    
    // Check if challenge is expired (5 minutes)
    if (Date.now() - challengeData.timestamp > 5 * 60 * 1000) {
        delete global.webauthnChallenges[userId];
        return res.status(400).json({ error: "Registration session expired. Please try again." });
    }
    
    try {
        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: challengeData.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });
        
        if (!verification.verified) {
            return res.status(400).json({ error: "Verification failed: credential not verified" });
        }
        
        if (!verification.registrationInfo) {
            return res.status(400).json({ error: "Verification failed: missing registration information" });
        }
        
        // Extract from credential object (v13+ structure)
        // The structure is: registrationInfo.credential.id, registrationInfo.credential.publickey, etc.
        // Note: 'credential' is already used for the request body, so we use 'credentialInfo' here
        const credentialInfo = verification.registrationInfo.credential;
        if (!credentialInfo) {
            return res.status(400).json({ error: "Invalid credential: missing credential object" });
        }
        
        const credentialID = credentialInfo.id;
        const credentialPublicKey = credentialInfo.publickey || credentialInfo.publicKey; // Note: lowercase 'publickey' in v13+
        const counter = credentialInfo.counter !== undefined ? credentialInfo.counter : 0;
            
        // Validate that we have the required data
        if (!credentialID) {
            return res.status(400).json({ error: "Invalid credential: missing credential ID" });
        }
        
        if (!credentialPublicKey) {
            return res.status(400).json({ error: "Invalid credential: missing public key" });
        }
        
        // Validate counter (should be a number, default to 0 if missing)
        const credentialCounter = (counter !== undefined && counter !== null) ? counter : 0;
        
        
        // Store credential in database
        // credential.id is already a base64URL string, use it directly
        const credentialIdBase64 = typeof credentialID === 'string' ? credentialID : isoBase64URL.fromBuffer(credentialID);
        
        // credentialPublicKey is already a Buffer/Uint8Array, convert to base64 for storage
        // Handle both Buffer and Uint8Array
        let publicKeyBase64;
        try {
            if (credentialPublicKey instanceof Buffer || credentialPublicKey instanceof Uint8Array) {
                publicKeyBase64 = isoBase64URL.fromBuffer(credentialPublicKey);
            } else if (typeof credentialPublicKey === 'string') {
                // If it's already a string, use it directly
                publicKeyBase64 = credentialPublicKey;
            } else {
                return res.status(400).json({ error: "Invalid credential: unexpected public key format" });
            }
        } catch (keyError) {
            return res.status(400).json({ error: "Failed to process public key: " + keyError.message });
        }
        
        // Validate userId before using it
        if (!userId) {
            return res.status(500).json({ error: "Internal error: user ID not found" });
        }
        
        db.run(
            "INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_name) VALUES (?, ?, ?, ?, ?)",
            [userId, credentialIdBase64, publicKeyBase64, credentialCounter, deviceName || "Face ID"],
                function (err) {
                    if (err) {
                        if (err.message.includes("UNIQUE constraint")) {
                            return res.status(400).json({ error: "This device is already registered" });
                        }
                        return res.status(500).json({ error: "Failed to store credential" });
                    }
                    
                    // Clean up challenge
                    delete global.webauthnChallenges[userId];
                    
                    res.json({ 
                        verified: true, 
                        message: "Facial recognition registered successfully",
                        credentialId: this.lastID 
                    });
                }
            );
    } catch (error) {
        res.status(400).json({ error: error.message || "Verification failed" });
    }
});

// Generate authentication options (start facial recognition login)
app.post("/api/users/webauthn/authenticate/start", (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
    }
    
    const cleanedPhone = phone.replace(/\D/g, '');
    
    // Find user by phone
    db.get("SELECT id, name FROM users WHERE phone = ?", [cleanedPhone], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        if (!user) {
            // Don't reveal if user exists (security)
            return res.status(400).json({ error: "Invalid credentials" });
        }
        
        // Get user's WebAuthn credentials
        db.all("SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ?", [user.id], async (err, credentials) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (credentials.length === 0) {
                return res.status(400).json({ error: "Facial recognition not set up. Please use password login." });
            }
            
            const opts = {
                rpID: RP_ID,
                timeout: 60000,
                allowCredentials: credentials.map(cred => {
                    // credential_id is stored as base64, use it directly
                    return {
                        id: cred.credential_id,
                        type: "public-key",
                    };
                }),
                userVerification: "required",
            };
            
            try {
                // generateAuthenticationOptions might return a Promise in v13+
                let options = generateAuthenticationOptions(opts);
                
                // Check if it's a Promise and await it
                if (options && typeof options.then === 'function') {
                    options = await options;
                }
                
                if (!options || !options.challenge) {
                    return res.status(500).json({ error: "Failed to generate valid authentication options" });
                }
                
                // Store challenge temporarily
                if (!global.webauthnChallenges) global.webauthnChallenges = {};
                global.webauthnChallenges[user.id] = {
                    challenge: options.challenge,
                    type: "authentication",
                    timestamp: Date.now(),
                };
                
                res.json(options);
            } catch (error) {
                res.status(500).json({ error: "Failed to generate authentication options: " + (error.message || "Unknown error") });
            }
        });
    });
});

// Verify authentication response (complete facial recognition login)
app.post("/api/users/webauthn/authenticate/finish", async (req, res) => {
    const { phone, credential } = req.body;
    
    if (!phone || !credential) {
        return res.status(400).json({ error: "Phone number and credential are required" });
    }
    
    const cleanedPhone = phone.replace(/\D/g, '');
    
    // Find user by phone
    db.get("SELECT id, name, phone FROM users WHERE phone = ?", [cleanedPhone], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        
        // Get stored challenge
        if (!global.webauthnChallenges || !global.webauthnChallenges[user.id]) {
            return res.status(400).json({ error: "Authentication session expired. Please try again." });
        }
        
        const challengeData = global.webauthnChallenges[user.id];
        if (challengeData.type !== "authentication") {
            return res.status(400).json({ error: "Invalid challenge type" });
        }
        
        // Check if challenge is expired (5 minutes)
        if (Date.now() - challengeData.timestamp > 5 * 60 * 1000) {
            delete global.webauthnChallenges[user.id];
            return res.status(400).json({ error: "Authentication session expired. Please try again." });
        }
        
        // Get credential from database
        // Validate credential structure
        if (!credential || !credential.id) {
            return res.status(400).json({ error: "Invalid credential: missing credential ID" });
        }
        
        // credential.id is already in base64URL format from the browser
        const credentialIdBase64 = credential.id;
        
        db.get("SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?", 
            [user.id, credentialIdBase64], async (err, dbCredential) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!dbCredential) {
                return res.status(400).json({ error: "Invalid credential" });
            }
            
            // Validate counter (should be a number, default to 0 if missing)
            const credentialCounter = (dbCredential.counter !== undefined && dbCredential.counter !== null) ? dbCredential.counter : 0;
            
            try {
                // public_key is stored as base64, convert back to Buffer
                const publicKeyBuffer = isoBase64URL.toBuffer(dbCredential.public_key);
                
                // Convert credential_id to Buffer for verification
                const credentialIDBuffer = isoBase64URL.toBuffer(dbCredential.credential_id);
                
                // Ensure counter is a valid number (not null/undefined)
                const safeCounter = Number(credentialCounter) || 0;
                
                // In v13+, we use 'credential' instead of 'authenticator'
                // Build credential object with all required fields
                const webauthnCredential = {
                    id: dbCredential.credential_id, // base64url-encoded string
                    publicKey: publicKeyBuffer, // Uint8Array
                    counter: safeCounter, // number
                    // transports is optional - we don't store it, so omit it
                };
                
                // Ensure challenge is a string (not a Buffer)
                const expectedChallenge = typeof challengeData.challenge === 'string' 
                    ? challengeData.challenge 
                    : challengeData.challenge.toString();
                
                const verification = await verifyAuthenticationResponse({
                    response: credential,
                    expectedChallenge: expectedChallenge,
                    expectedOrigin: ORIGIN,
                    expectedRPID: RP_ID,
                    credential: webauthnCredential,
                });
                
                if (verification.verified) {
                    // Update counter if newCounter is available
                    if (verification.authenticationInfo && verification.authenticationInfo.newCounter !== undefined) {
                        db.run(
                            "UPDATE webauthn_credentials SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND credential_id = ?",
                            [verification.authenticationInfo.newCounter, user.id, credentialIdBase64],
                            (err) => {
                                if (err) {
                                }
                            }
                        );
                    }
                    
                    // Clean up challenge
                    delete global.webauthnChallenges[user.id];
                    
                    // Generate JWT token
                    const token = generateToken({
                        id: user.id,
                        role: "user",
                        phone: user.phone,
                        name: user.name,
                    });
                    
                    res.json({ 
                        verified: true, 
                        token,
                        userId: user.id,
                        needsLocation: false // Will be checked separately
                    });
                } else {
                    res.status(400).json({ error: "Verification failed" });
                }
            } catch (error) {
                res.status(400).json({ error: error.message || "Verification failed" });
            }
        });
    });
});

// Check if user has WebAuthn credentials
app.get("/api/users/webauthn/status", auth("user"), (req, res) => {
    const userId = req.user.id;
    
    db.get("SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ?", [userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        res.json({ hasCredentials: result.count > 0 });
    });
});

// Delete WebAuthn credential
app.delete("/api/users/webauthn/credentials/:credentialId", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { credentialId } = req.params;
    
    db.run("DELETE FROM webauthn_credentials WHERE user_id = ? AND id = ?", [userId, credentialId], function (err) {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: "Credential not found" });
        }
        
        res.json({ message: "Credential deleted successfully" });
    });
});


// ---------- store auth ----------

app.post("/api/stores/signup", async (req, res) => {
    const { claimCode, email, phone, password, signup_source, utm_source, utm_medium, utm_campaign } = req.body;
    
    if (!claimCode || !password || (!email && !phone)) {
        return res.status(400).json({ error: "claimCode, password, and email or phone are required" });
    }
    
    // Validate email if provided (must contain @)
    if (email) {
        if (!email.includes("@")) {
            return res.status(400).json({ error: "Email must contain @ symbol" });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
    }
    
    // Validate phone if provided (max 10 digits)
    if (phone && !validatePhone(phone)) {
        return res.status(400).json({ error: "Phone number must be exactly 10 digits" });
    }
    const cleanedPhone = phone ? phone.replace(/\D/g, "") : null;
    
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalizedClaim = String(claimCode).trim().toUpperCase();
    const hash = await bcrypt.hash(password, 10);

    db.get(
        "SELECT id, name, category, base_discount_percent, claimed_at FROM stores WHERE claim_code = ?",
        [normalizedClaim],
        (err, store) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            if (!store) {
                return res.status(400).json({ error: "Invalid claim code" });
            }
            if (store.claimed_at) {
                return res.status(400).json({ error: "This store is already claimed" });
            }

            const signupSource = String(signup_source || "").trim() || null;
            const utmSrc = String(utm_source || "").trim() || null;
            const utmMed = String(utm_medium || "").trim() || null;
            const utmCamp = String(utm_campaign || "").trim() || null;
            const runAfterUpdate = (updateErr) => {
                    if (updateErr) {
                        if (updateErr.message.includes("UNIQUE constraint")) {
                            return res.status(400).json({ error: "Email or phone already registered" });
                        }
                        if (updateErr.message.includes("no such column")) {
                            return db.run(
                                `UPDATE stores SET email = ?, phone = ?, password_hash = ?, claimed_at = CURRENT_TIMESTAMP, claim_code = NULL WHERE id = ?`,
                                [email || null, cleanedPhone || null, hash, store.id],
                                (fallbackErr) => {
                                    if (fallbackErr) return res.status(500).json({ error: "Failed to claim store" });
                                    runCallback();
                                }
                            );
                        }
                        return res.status(500).json({ error: "Failed to claim store" });
                    }
                    runCallback();
                };
            const runCallback = () => {
                    const defaultOffer = getDefaultOfferFromPoints(store.base_discount_percent || 0);
                    db.run(
                        `INSERT INTO store_offers 
                         (store_id, reward_tier, reward_points, unlock_cost_cents, unlock_cost_loops, is_locked, min_plan)
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(store_id) DO NOTHING`,
                        [
                            store.id,
                            defaultOffer.reward_tier,
                            defaultOffer.reward_points,
                            defaultOffer.unlock_cost_cents,
                            defaultOffer.unlock_cost_loops,
                            defaultOffer.is_locked,
                            defaultOffer.min_plan,
                        ],
                        async (offerErr) => {
                            if (offerErr) {
                            }
                            
                            // Auto-join customers who requested this store
                            try {
                                const storeNameNormalized = String(store.name || "").trim().toLowerCase();
                                const requestedUsers = await dbAllAsync(
                                    `SELECT DISTINCT user_id, requested_store_name
                                     FROM store_onboarding_requests
                                     WHERE status = 'pending'
                                       AND (
                                         (? IS NOT NULL AND requested_store_ref = ?)
                                         OR lower(trim(requested_store_name)) = ?
                                       )`,
                                    [store.place_id, store.place_id, storeNameNormalized]
                                );

                                if (requestedUsers && requestedUsers.length > 0) {
                                    const cycleMonth = getCycleMonth();
                                    for (const reqUser of requestedUsers) {
                                        const userId = reqUser.user_id;
                                        
                                        // Check if user already has a slot for this store
                                        const existingSlot = await dbGetAsync(
                                            `SELECT id FROM store_slots 
                                             WHERE user_id = ? AND store_id = ? AND cycle_month = ?`,
                                            [userId, store.id, cycleMonth]
                                        );

                                        if (!existingSlot) {
                                            // Create free slot for the user
                                            await dbRunAsync(
                                                `INSERT INTO store_slots 
                                                 (user_id, store_id, cycle_month, status, created_at)
                                                 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
                                                [userId, store.id, cycleMonth]
                                            );

                                            // Create notification
                                            await dbRunAsync(
                                                `INSERT INTO notifications 
                                                 (user_id, type, title, message, related_store_id, created_at)
                                                 VALUES (?, 'store_joined', ?, ?, ?, CURRENT_TIMESTAMP)`,
                                                [
                                                    userId,
                                                    `${store.name} is now on CityCircle!`,
                                                    `Great news! ${store.name} has joined CityCircle. We've automatically added it to your stores. Start earning rewards!`,
                                                    store.id
                                                ]
                                            );

                                            // Emit socket notification
                                            if (typeof io !== 'undefined' && io) {
                                                try {
                                                    io.emit(`notification:${userId}`, {
                                                        type: "store_joined",
                                                        title: `${store.name} is now on CityCircle!`,
                                                        message: `Great news! ${store.name} has joined CityCircle. We've automatically added it to your stores. Start earning rewards!`,
                                                        storeId: store.id,
                                                        storeName: store.name,
                                                        createdAt: new Date().toISOString(),
                                                    });
                                                } catch (socketErr) {
                                                    console.warn("Failed to emit notification:", socketErr.message);
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (autoJoinErr) {
                                console.error("Error auto-joining requested users:", autoJoinErr.message);
                                // Don't fail the signup if auto-join fails
                            }

                            recordAnalyticsEvent({ event_type: "store_claimed", actor_type: "store", actor_id: store.id, utm_source: utmSrc, utm_medium: utmMed, utm_campaign: utmCamp }, req);
                            const utmLine = [signupSource, utmSrc, utmMed, utmCamp].some(Boolean) ? `<p>Source: ${signupSource || "—"} | UTM: ${utmSrc || "—"}/${utmMed || "—"}/${utmCamp || "—"}</p>` : "";
                            sendAdminNotificationEmail("new_store_claimed", "New store claimed", `<p><strong>${store.name}</strong> just completed signup (claimed).</p><p>Store ID: ${store.id} | Category: ${store.category || "—"}</p>${utmLine}`);
                            const token = jwt.sign(
                                { storeId: store.id, role: "store" },
                                JWT_SECRET,
                                { expiresIn: "7d" }
                            );
                            res.json({ token, storeId: store.id });
                        }
                    );
                };
            db.run(
                `UPDATE stores 
                 SET email = ?, phone = ?, password_hash = ?, claimed_at = CURRENT_TIMESTAMP, claim_code = NULL, signup_source = ?, utm_source = ?, utm_medium = ?, utm_campaign = ?
                 WHERE id = ?`,
                [email || null, cleanedPhone || null, hash, signupSource, utmSrc, utmMed, utmCamp, store.id],
                runAfterUpdate
            );
        }
    );
});

// ---------- Admin Endpoints ----------

// Admin signup (for creating first admin - can be restricted later)
app.post("/api/admins/signup", async (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    
    try {
        const hash = await bcrypt.hash(password, 10);
        
        db.run(
            "INSERT INTO admins (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
            [email, hash, name],
            function (err) {
                if (err) {
                    if (err.message.includes("UNIQUE constraint")) {
                        return res.status(400).json({ error: "Email already registered" });
                    }
                    return res.status(500).json({ error: "Database error" });
                }
                
                const token = generateToken({
                    id: this.lastID,
                    role: "admin",
                    email,
                    name,
                });
                
                res.json({ token, adminId: this.lastID });
            }
        );
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Admin login
app.post("/api/admins/login", (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    db.get(
        "SELECT * FROM admins WHERE email = ?",
        [email],
        async (err, admin) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!admin) {
                return res.status(401).json({ error: "Invalid email or password" });
            }
            
            try {
                const valid = await bcrypt.compare(password, admin.password_hash);
                if (!valid) {
                    return res.status(401).json({ error: "Invalid email or password" });
                }
                
                // Update last login
                db.run(
                    "UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [admin.id]
                );
                
                const token = generateToken({
                    id: admin.id,
                    role: "admin",
                    email: admin.email,
                    name: admin.name,
                });
                
                res.json({ token, adminId: admin.id });
            } catch (error) {
                res.status(500).json({ error: "Server error" });
            }
        }
    );
});

// Get admin info
app.get("/api/admins/me", authAdmin, (req, res) => {
    const adminId = req.user.id;
    
    db.get(
        "SELECT id, email, name, role, created_at, last_login_at FROM admins WHERE id = ?",
        [adminId],
        (err, admin) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!admin) {
                return res.status(404).json({ error: "Admin not found" });
            }
            
            res.json({ admin });
        }
    );
});

// ---------- Admin User Management ----------

// List all users (admin only)
app.get("/api/admins/users", authAdmin, (req, res) => {
    const { search, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    let query = "SELECT id, phone, email, name, address, plan, loops_balance, total_loops_earned FROM users";
    let countQuery = "SELECT COUNT(*) as total FROM users";
    const params = [];
    
    if (search) {
        const searchParam = `%${search}%`;
        query += " WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?";
        countQuery += " WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?";
        params.push(searchParam, searchParam, searchParam);
    }
    
    query += ` ORDER BY id DESC LIMIT ${limitNum} OFFSET ${offset}`;
    
    db.all(countQuery, params.length > 0 ? params.slice(0, 3) : [], (err, countResult) => {
        if (err) {
            return res.status(500).json({ error: "Database error: " + err.message });
        }
        
        const total = countResult[0].total;
        
        db.all(query, params, (err, users) => {
            if (err) {
                return res.status(500).json({ error: "Database error: " + err.message });
            }
            
            res.json({
                users: users || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
        });
    }    );
});

// Get user stores with full details (admin only) - MUST be before /api/admins/users/:id
app.get("/api/admins/users/:id/stores", authAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }
    
    db.all(
        `SELECT 
            s.id as store_id,
            s.name as store_name,
            s.category,
            s.zone,
            s.email as store_email,
            s.phone as store_phone,
            s.address as store_address,
            s.base_discount_percent,
            s.latitude,
            s.longitude,
            COUNT(DISTINCT cis.id) as visit_count,
            COALESCE(SUM(pp.loops_pending), 0) as total_loops_earned,
            MAX(cis.checked_in_at) as last_visit_at,
            MIN(cis.checked_in_at) as first_visit_at
         FROM check_in_sessions cis
         JOIN stores s ON cis.store_id = s.id
         LEFT JOIN pending_points pp ON pp.session_id = cis.id
         WHERE cis.user_id = ? AND cis.status = 'completed'
         GROUP BY s.id, s.name, s.category, s.zone, s.email, s.phone, s.address, s.base_discount_percent, s.latitude, s.longitude
         ORDER BY visit_count DESC`,
        [userId],
        (err, stores) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            res.json({ stores: stores || [] });
        }
    );
});

// Get user details (admin only)
app.get("/api/admins/users/:id", authAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }
    
    // Get user info
    db.get(
        "SELECT * FROM users WHERE id = ?",
        [userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            
            // Get user stats - using check-ins instead of transactions
            db.get(
                `SELECT 
                    COUNT(DISTINCT cis.id) as visit_count,
                    COUNT(DISTINCT cis.store_id) as stores_visited,
                    MAX(cis.checked_in_at) as last_visit_at,
                    COALESCE(SUM(pp.loops_pending), 0) as total_loops_earned
                 FROM check_in_sessions cis
                 LEFT JOIN pending_points pp ON pp.session_id = cis.id
                 WHERE cis.user_id = ? AND cis.status = 'completed'`,
                [userId],
                (err2, stats) => {
                    if (err2) {
                        return res.status(500).json({ error: "Database error" });
                    }
                    
                    // Get store visits with loops earned per store - using check-ins
                    db.all(
                        `SELECT 
                            s.id as store_id,
                            s.name as store_name,
                            s.category,
                            s.zone,
                            COUNT(DISTINCT cis.id) as visit_count,
                            COALESCE(SUM(pp.loops_pending), 0) as total_loops_earned,
                            MAX(cis.checked_in_at) as last_visit_at
                         FROM check_in_sessions cis
                         JOIN stores s ON cis.store_id = s.id
                         LEFT JOIN pending_points pp ON pp.session_id = cis.id
                         WHERE cis.user_id = ? AND cis.status = 'completed'
                         GROUP BY s.id, s.name, s.category, s.zone
                         ORDER BY total_loops_earned DESC`,
                        [userId],
                        (err3, storeVisits) => {
                            if (err3) {
                            }
                            
                            res.json({
                                user,
                                stats: stats || {
                                    visit_count: 0,
                                    stores_visited: 0,
                                    last_visit_at: null,
                                    total_loops_earned: 0
                                },
                                storeVisits: storeVisits || []
                            });
                        }
                    );
                }
            );
        }
    );
});

// Update user (admin only)
app.put("/api/admins/users/:id", authAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    const { name, email, address, plan } = req.body;
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
    }
    if (email !== undefined) {
        updates.push("email = ?");
        params.push(email);
    }
    if (address !== undefined) {
        updates.push("address = ?");
        params.push(address);
    }
    if (plan !== undefined && ['STARTER', 'BASIC', 'PLUS', 'PREMIUM'].includes(plan)) {
        updates.push("plan = ?");
        params.push(plan);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    
    params.push(userId);
    
    db.run(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        params,
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint")) {
                    return res.status(400).json({ error: "Email already in use" });
                }
                return res.status(500).json({ error: "Database error" });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            
            res.json({ success: true, message: "User updated successfully" });
        }
    );
});

// Delete user (admin only)
app.delete("/api/admins/users/:id", authAdmin, (req, res) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }
    
    // Delete related data first (cascading)
    db.serialize(() => {
        db.run("DELETE FROM webauthn_credentials WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM loops_ledger WHERE user_id = ?", [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
        });
        
        db.run("DELETE FROM transactions WHERE user_id = ?", [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
        });
        
        db.run("DELETE FROM pending_points WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM check_in_sessions WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM location_history WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM gift_cards WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        // Finally, delete the user
        db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            
            res.json({ success: true, message: "User deleted successfully" });
        });
    });
});

// ---------- Admin Store Management ----------

// List all stores (admin only)
app.get("/api/admins/stores", authAdmin, async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        await ensureStoreSubscriptionsTable().catch(() => null);

        const baseSelect = `
            WITH ranked AS (
                SELECT
                    id, name, email, phone, category, zone, base_discount_percent, address, place_id, claim_code, claimed_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            CASE
                                WHEN place_id IS NOT NULL AND trim(place_id) != '' THEN 'p:' || place_id
                                WHEN address IS NOT NULL AND trim(address) != '' THEN 'a:' || lower(trim(address)) || '|' || lower(trim(category))
                                ELSE 'n:' || lower(trim(name)) || '|' || lower(trim(category))
                            END
                        ORDER BY
                            (
                                (CASE WHEN phone IS NOT NULL AND trim(phone) != '' THEN 1 ELSE 0 END) +
                                (CASE WHEN address IS NOT NULL AND trim(address) != '' THEN 1 ELSE 0 END) +
                                (CASE WHEN place_id IS NOT NULL AND trim(place_id) != '' THEN 1 ELSE 0 END)
                            ) DESC,
                            id ASC
                    ) AS rn
                FROM stores
            )
        `;

        let query = `${baseSelect}
            SELECT
                r.id, r.name, r.email, r.phone, r.category, r.zone, r.base_discount_percent, r.address, r.claim_code, r.claimed_at,
                COALESCE(ss.plan_id, 'trial') AS subscription_plan_id,
                COALESCE(ss.status, 'trialing') AS subscription_status
            FROM ranked r
            LEFT JOIN store_subscriptions ss ON ss.store_id = r.id
            WHERE r.rn = 1`;
        let countQuery = `${baseSelect} SELECT COUNT(*) as total FROM ranked WHERE rn = 1`;
        const params = [];

        if (search) {
            const searchParam = `%${search}%`;
            query += " AND (r.name LIKE ? OR r.email LIKE ? OR r.phone LIKE ? OR r.category LIKE ?)";
            countQuery += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR category LIKE ?)";
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        query += ` ORDER BY r.id DESC LIMIT ${limitNum} OFFSET ${offset}`;
        const countResult = await dbAllAsync(countQuery, params.length > 0 ? params.slice(0, 4) : []);
        const total = countResult?.[0]?.total || 0;
        const stores = await dbAllAsync(query, params);
        res.json({
            stores: stores || [],
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        res.status(500).json({ error: "Database error: " + err.message });
    }
});

app.get("/api/admins/store-requests", authAdmin, async (req, res) => {
    try {
        const search = String(req.query.search || "").trim().toLowerCase();
        const rows = await dbAllAsync(
            `SELECT id, user_id, requested_store_ref, requested_store_name, note, status, created_at, updated_at
             FROM store_onboarding_requests
             ORDER BY created_at DESC`
        );

        const leadsMap = new Map();
        const now = Date.now();
        for (const row of rows || []) {
            const ref = String(row.requested_store_ref || "").trim();
            const name = String(row.requested_store_name || "").trim();
            const key = ref ? `ref:${ref}` : `name:${name.toLowerCase()}`;
            const createdMs = new Date(row.created_at || 0).getTime();
            const lead = leadsMap.get(key) || {
                leadKey: key,
                storeName: name || "Unknown Store",
                storeRef: ref || null,
                totalRequests: 0,
                uniqueUsers: new Set(),
                requests7d: 0,
                requests30d: 0,
                lastRequestedAt: row.created_at,
                statuses: {},
                sampleRequestIds: [],
            };
            lead.totalRequests += 1;
            lead.uniqueUsers.add(Number(row.user_id));
            if (createdMs >= now - 7 * 24 * 60 * 60 * 1000) lead.requests7d += 1;
            if (createdMs >= now - 30 * 24 * 60 * 60 * 1000) lead.requests30d += 1;
            if (!lead.lastRequestedAt || new Date(row.created_at).getTime() > new Date(lead.lastRequestedAt).getTime()) {
                lead.lastRequestedAt = row.created_at;
            }
            const statusKey = String(row.status || "pending").toLowerCase();
            lead.statuses[statusKey] = (lead.statuses[statusKey] || 0) + 1;
            if (lead.sampleRequestIds.length < 5) lead.sampleRequestIds.push(row.id);
            leadsMap.set(key, lead);
        }

        const leads = Array.from(leadsMap.values())
            .map((lead) => {
                const uniqueRequesters = lead.uniqueUsers.size;
                const hotScore = (uniqueRequesters * 5) + (lead.requests7d * 3) + lead.requests30d;
                let temperature = "cold";
                if (hotScore >= 20) temperature = "hot";
                else if (hotScore >= 10) temperature = "warm";

                let status = "pending";
                if (lead.statuses.onboarded) status = "onboarded";
                else if (lead.statuses.contacted) status = "contacted";
                else if (lead.statuses.in_review) status = "in_review";

                return {
                    leadKey: lead.leadKey,
                    storeName: lead.storeName,
                    storeRef: lead.storeRef,
                    totalRequests: lead.totalRequests,
                    uniqueRequesters,
                    requests7d: lead.requests7d,
                    requests30d: lead.requests30d,
                    lastRequestedAt: lead.lastRequestedAt,
                    status,
                    hotScore,
                    temperature,
                    sampleRequestIds: lead.sampleRequestIds,
                };
            })
            .filter((lead) => {
                if (!search) return true;
                return String(lead.storeName || "").toLowerCase().includes(search) ||
                    String(lead.storeRef || "").toLowerCase().includes(search);
            })
            .sort((a, b) => b.hotScore - a.hotScore);

        res.json({ leads, total: leads.length });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_onboarding_requests")) {
            return res.json({ leads: [], total: 0 });
        }
        res.status(500).json({ error: "Failed to load store requests" });
    }
});

app.put("/api/admins/store-requests/:id/status", authAdmin, async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        const status = String(req.body?.status || "").trim().toLowerCase();
        const allowed = new Set(["pending", "in_review", "contacted", "onboarded", "rejected"]);
        if (!Number.isFinite(requestId) || requestId <= 0) {
            return res.status(400).json({ error: "Invalid request id" });
        }
        if (!allowed.has(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const existing = await dbGetAsync("SELECT id FROM store_onboarding_requests WHERE id = ?", [requestId]);
        if (!existing) {
            return res.status(404).json({ error: "Request not found" });
        }
        await dbRunAsync(
            `UPDATE store_onboarding_requests
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, requestId]
        );
        res.json({ success: true, id: requestId, status });
    } catch (e) {
        res.status(500).json({ error: "Failed to update request status" });
    }
});

// Admin: send notification/email for a high-demand store request (e.g. when request count >= 10)
app.post("/api/admins/store-requests/notify", authAdmin, async (req, res) => {
    try {
        const requestedStoreName = String(req.body?.requested_store_name || "").trim();
        const requestCount = Number(req.body?.request_count) || 0;
        if (!requestedStoreName) {
            return res.status(400).json({ error: "requested_store_name is required" });
        }
        const nameNorm = requestedStoreName.toLowerCase().trim();
        const cooldownHours = Math.max(1, Number(process.env.STORE_NOTIFY_COOLDOWN_HOURS || 24));
        await ensureStoreRequestNotificationsTable();
        const lastNotify = await dbGetAsync(
            `SELECT created_at
             FROM store_request_notifications
             WHERE store_name_normalized = ?
               AND (sent_email = 1 OR sent_sms = 1)
             ORDER BY created_at DESC
             LIMIT 1`,
            [nameNorm]
        ).catch(() => null);
        if (lastNotify?.created_at) {
            const lastTs = new Date(lastNotify.created_at).getTime();
            if (Number.isFinite(lastTs)) {
                const cooldownMs = cooldownHours * 60 * 60 * 1000;
                if ((Date.now() - lastTs) < cooldownMs) {
                    return res.status(429).json({
                        error: "Store was already notified recently. Please try again after cooldown.",
                        cooldown_active: true,
                        cooldown_until: new Date(lastTs + cooldownMs).toISOString(),
                    });
                }
            }
        }
        const store = await dbGetAsync(
            `SELECT id, name, email, phone FROM stores
             WHERE LOWER(TRIM(name)) = ?
             LIMIT 1`,
            [nameNorm]
        );
        let sentToStoreEmail = false;
        let sentToStoreSms = false;
        if (store && store.email) {
            sentToStoreEmail = await sendStoreOutreachEmail(store.email, store.name, requestCount);
        }

        // SMS outreach is feature-flagged off by default until phone verification rollout is ready.
        // Enable later with STORE_NOTIFY_SMS_ENABLED=1 in .env.
        const smsEnabled = process.env.STORE_NOTIFY_SMS_ENABLED === "1";
        const smsConfigured = !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET);
        const smsPhone = store?.phone ? formatSmsPhone(store.phone) : null;
        let smsError = null;
        if (smsEnabled && smsConfigured && smsPhone) {
            try {
                const smsText = `CityCircle: ${requestCount} customers requested ${store.name}. Join now to connect with them.`;
                await sendSMS(smsPhone, smsText);
                sentToStoreSms = true;
            } catch (e) {
                smsError = e?.message || String(e);
            }
        }

        const hasAnyStoreContact = !!(store && ((store.email && String(store.email).trim()) || (store.phone && String(store.phone).trim())));
        const adminSubject = (sentToStoreEmail || sentToStoreSms)
            ? `Store outreach sent: ${requestedStoreName} (${requestCount} requests)`
            : `High demand: ${requestedStoreName} – ${requestCount} requests (${hasAnyStoreContact ? "contact send failed" : "no store contact in system"})`;

        let adminBody = `<p>Store: <strong>${requestedStoreName}</strong></p><p>Request count: <strong>${requestCount}</strong></p>`;
        if (sentToStoreEmail) adminBody += `<p>Outreach email sent to: ${store.email}</p>`;
        else if (store?.email) adminBody += `<p>Email exists but could not be sent to: ${store.email}</p>`;
        else adminBody += "<p>No store email found.</p>";
        if (sentToStoreSms) adminBody += `<p>Outreach SMS sent to: ${smsPhone}</p>`;
        else if (smsPhone && !smsEnabled) adminBody += `<p>Store phone found (${smsPhone}) but SMS outreach is currently disabled (feature flag off).</p>`;
        else if (smsPhone && !smsConfigured) adminBody += `<p>Store phone found (${smsPhone}) but SMS provider is not configured.</p>`;
        else if (smsPhone && smsConfigured && smsError) adminBody += `<p>SMS send failed to ${smsPhone}: ${smsError}</p>`;
        else adminBody += "<p>No store phone found.</p>";

        await sendAdminNotificationEmail("store_request_notify", adminSubject, adminBody);

        const messageParts = [];
        if (sentToStoreEmail && store?.email) messageParts.push(`email sent to ${store.email}`);
        if (sentToStoreSms && smsPhone) messageParts.push(`SMS sent to ${smsPhone}`);
        if (!sentToStoreEmail && !sentToStoreSms) {
            if (!store) messageParts.push("Admins notified (store not found in system)");
            else if (!store.email && !store.phone) messageParts.push("Admins notified (no store email/phone on file)");
            else if (!smsEnabled && store.phone && !store.email) messageParts.push("Admins notified (phone found, SMS currently disabled)");
            else if (!smsConfigured && store.phone && !store.email) messageParts.push("Admins notified (phone found but SMS provider not configured)");
            else messageParts.push("Admins notified (could not send to store contact)");
        }

        if (sentToStoreEmail || sentToStoreSms) {
            await dbRunAsync(
                `INSERT INTO store_request_notifications
                 (store_name_normalized, requested_store_name, request_count, sent_email, sent_sms, admin_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [nameNorm, requestedStoreName, requestCount, sentToStoreEmail ? 1 : 0, sentToStoreSms ? 1 : 0, req.user?.id || null]
            ).catch(() => null);
        }

        res.json({
            success: true,
            sentToStore: sentToStoreEmail || sentToStoreSms,
            sentEmail: sentToStoreEmail,
            sentSms: sentToStoreSms,
            cooldown_hours: cooldownHours,
            message: messageParts.join(" + "),
        });
    } catch (e) {
        console.warn("Store request notify failed:", e.message);
        res.status(500).json({ error: "Failed to send notification" });
    }
});

// Admin: list analytics events (all tracking visible to admin)
app.get("/api/admins/analytics/events", authAdmin, async (req, res) => {
    try {
        const event_type = String(req.query.event_type || "").trim() || null;
        const actor_type = String(req.query.actor_type || "").trim() || null;
        const actor_id = req.query.actor_id != null ? Number(req.query.actor_id) : null;
        const from = String(req.query.from || "").trim() || null;
        const to = String(req.query.to || "").trim() || null;
        const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
        let sql = "SELECT id, event_type, actor_type, actor_id, session_id, payload, utm_source, utm_medium, utm_campaign, ip_address, created_at FROM analytics_events WHERE 1=1";
        const params = [];
        if (event_type) { sql += " AND event_type = ?"; params.push(event_type); }
        if (actor_type) { sql += " AND actor_type = ?"; params.push(actor_type); }
        if (Number.isFinite(actor_id)) { sql += " AND actor_id = ?"; params.push(actor_id); }
        if (from) { sql += " AND created_at >= ?"; params.push(from); }
        if (to) { sql += " AND created_at <= ?"; params.push(to); }
        sql += " ORDER BY created_at DESC LIMIT ?";
        params.push(limit);
        const rows = await dbAllAsync(sql, params);
        res.json({ events: rows || [] });
    } catch (e) {
        if (String(e.message || "").includes("no such table: analytics_events")) {
            return res.json({ events: [] });
        }
        res.status(500).json({ error: "Failed to load events" });
    }
});

// Admin: events for a specific user or store (drill-down)
app.get("/api/admins/analytics/events/by-actor/:actorType/:actorId", authAdmin, async (req, res) => {
    try {
        const actorType = String(req.params.actorType || "").toLowerCase();
        const actorId = Number(req.params.actorId);
        if (!["user", "store"].includes(actorType) || !Number.isFinite(actorId) || actorId <= 0) {
            return res.status(400).json({ error: "Invalid actor type or id" });
        }
        let actorName = null;
        if (actorType === "user") {
            const row = await dbGetAsync("SELECT id, name, phone FROM users WHERE id = ?", [actorId]);
            actorName = row ? (row.name || `User #${actorId}`) : `User #${actorId}`;
        } else {
            const row = await dbGetAsync("SELECT id, name, category FROM stores WHERE id = ?", [actorId]);
            actorName = row ? (row.name || `Store #${actorId}`) : `Store #${actorId}`;
        }
        const events = await dbAllAsync(
            "SELECT id, event_type, actor_type, actor_id, session_id, payload, utm_source, utm_medium, utm_campaign, created_at FROM analytics_events WHERE actor_type = ? AND actor_id = ? ORDER BY created_at DESC LIMIT 200",
            [actorType, actorId]
        ).catch(() => []);
        res.json({ actor: { type: actorType, id: actorId, name: actorName }, events: events || [] });
    } catch (e) {
        if (String(e.message || "").includes("no such table: analytics_events")) {
            return res.json({ actor: { type: req.params.actorType, id: Number(req.params.actorId), name: null }, events: [] });
        }
        res.status(500).json({ error: "Failed to load events" });
    }
});

// Admin: tracking summary (quick check that events are stored)
app.get("/api/admins/analytics/summary", authAdmin, async (req, res) => {
    try {
        const [totalRow, last24hRow, byType, latest] = await Promise.all([
            dbGetAsync("SELECT COUNT(*) AS count FROM analytics_events").catch(() => ({ count: 0 })),
            dbGetAsync(
                "SELECT COUNT(*) AS count FROM analytics_events WHERE created_at >= datetime('now', '-1 day')"
            ).catch(() => ({ count: 0 })),
            dbAllAsync(
                "SELECT event_type, COUNT(*) AS count FROM analytics_events GROUP BY event_type ORDER BY count DESC"
            ).catch(() => []),
            dbGetAsync(
                "SELECT id, event_type, actor_type, actor_id, created_at FROM analytics_events ORDER BY created_at DESC LIMIT 1"
            ).catch(() => null),
        ]);
        res.json({
            total_events: totalRow?.count ?? 0,
            events_last_24h: last24hRow?.count ?? 0,
            by_type: byType || [],
            latest_event: latest
                ? {
                    id: latest.id,
                    event_type: latest.event_type,
                    actor_type: latest.actor_type,
                    actor_id: latest.actor_id,
                    created_at: latest.created_at,
                }
                : null,
            table_exists: true,
        });
    } catch (e) {
        if (String(e.message || "").includes("no such table: analytics_events")) {
            return res.json({
                total_events: 0,
                events_last_24h: 0,
                by_type: [],
                latest_event: null,
                table_exists: false,
            });
        }
        res.status(500).json({ error: "Failed to load summary" });
    }
});

// Admin: funnel counts (signup_started, signup_completed, first_checkin, store_claimed, store_request)
// store_request and store_claimed use real DB counts; other counts from analytics_events
app.get("/api/admins/analytics/funnel", authAdmin, async (req, res) => {
    try {
        const from = String(req.query.from || "").trim() || null;
        const to = String(req.query.to || "").trim() || null;
        let where = "";
        const params = [];
        if (from) { where += " AND created_at >= ?"; params.push(from); }
        if (to) { where += " AND created_at <= ?"; params.push(to); }
        const base = "SELECT event_type, COUNT(*) AS count FROM analytics_events WHERE 1=1" + where + " GROUP BY event_type";
        const rows = await dbAllAsync(base, params);
        const counts = { signup_started: 0, signup_completed: 0, first_checkin: 0, store_signup_started: 0, store_claimed: 0, store_request: 0 };
        (rows || []).forEach((r) => {
            if (counts.hasOwnProperty(r.event_type)) counts[r.event_type] = r.count;
        });
        // Override with real DB counts so dashboard matches actual data
        try {
            const [storeRequestRow, storeClaimedRow] = await Promise.all([
                dbGetAsync("SELECT COUNT(*) AS count FROM store_onboarding_requests").catch(() => null),
                dbGetAsync("SELECT COUNT(*) AS count FROM stores WHERE claimed_at IS NOT NULL").catch(() => null),
            ]);
            if (storeRequestRow != null) counts.store_request = storeRequestRow.count || 0;
            if (storeClaimedRow != null) counts.store_claimed = storeClaimedRow.count || 0;
        } catch (_) {}
        res.json({ funnel: counts, by_type: rows || [] });
    } catch (e) {
        if (String(e.message || "").includes("no such table: analytics_events")) {
            return res.json({ funnel: { signup_started: 0, signup_completed: 0, first_checkin: 0, store_signup_started: 0, store_claimed: 0, store_request: 0 }, by_type: [] });
        }
        res.status(500).json({ error: "Failed to load funnel" });
    }
});

// Admin: activity digest (new signups, new stores, recent store requests, recent events)
app.get("/api/admins/activity", authAdmin, async (req, res) => {
    try {
        const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString();
        const [newUsers, newStores, storeRequests, recentEvents] = await Promise.all([
            dbAllAsync(
                "SELECT id, name, phone, created_at FROM users WHERE created_at >= ? ORDER BY created_at DESC LIMIT 50",
                [sinceStr]
            ).catch(() => []),
            dbAllAsync(
                "SELECT id, name, category, claimed_at AS created_at FROM stores WHERE claimed_at >= ? ORDER BY claimed_at DESC LIMIT 50",
                [sinceStr]
            ).catch(() => []),
            dbAllAsync(
                `SELECT requested_store_name, COUNT(*) AS request_count, MAX(created_at) AS created_at,
                 CASE WHEN SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 'pending' ELSE MAX(status) END AS status
                 FROM store_onboarding_requests GROUP BY requested_store_name ORDER BY MAX(created_at) DESC LIMIT 30`
            ).catch(() => []),
            dbAllAsync(
                "SELECT id, event_type, actor_type, actor_id, payload, created_at FROM analytics_events ORDER BY created_at DESC LIMIT 50"
            ).catch(() => []),
        ]);
        res.json({
            since: sinceStr,
            days,
            new_users: newUsers || [],
            new_stores: newStores || [],
            store_requests: storeRequests || [],
            recent_events: recentEvents || [],
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load activity" });
    }
});

// Get missing reward reports (admin)
app.get("/api/admins/missing-reward-reports", authAdmin, async (req, res) => {
    try {
        const status = req.query.status || null;
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50")));
        const offset = Math.max(0, parseInt(req.query.offset || "0"));

        let query = `SELECT 
            r.id, r.user_id, r.store_id, r.store_name, r.store_address, 
            r.visit_date, r.visit_time, r.note, r.receipt_url, r.status,
            r.admin_note, r.reviewed_by_admin_id, r.reviewed_at, r.created_at, r.updated_at,
            u.name AS user_name, u.phone AS user_phone, u.email AS user_email,
            s.name AS partner_store_name
            FROM missing_reward_reports r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN stores s ON r.store_id = s.id`;
        const params = [];

        if (status) {
            query += " WHERE r.status = ?";
            params.push(status);
        }
        query += " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const reports = await dbAllAsync(query, params);

        const total = await dbGetAsync(
            status
                ? "SELECT COUNT(*) AS count FROM missing_reward_reports WHERE status = ?"
                : "SELECT COUNT(*) AS count FROM missing_reward_reports",
            status ? [status] : []
        );

        res.json({
            reports: reports || [],
            total: total?.count || 0,
            limit,
            offset,
        });
    } catch (e) {
        if (String(e.message || "").includes("no such table: missing_reward_reports")) {
            return res.status(503).json({ error: "Missing reward reports table. Run add-missing-reward-reports.js migration." });
        }
        res.status(500).json({ error: "Failed to load missing reward reports" });
    }
});

// Update missing reward report status (admin)
app.put("/api/admins/missing-reward-reports/:id/status", authAdmin, async (req, res) => {
    try {
        const reportId = Number(req.params.id);
        const { status, admin_note } = req.body || {};
        const allowed = new Set(["pending", "reviewed", "resolved", "dismissed"]);
        if (!Number.isFinite(reportId) || reportId <= 0) {
            return res.status(400).json({ error: "Invalid report id" });
        }
        const statusClean = String(status || "").trim().toLowerCase();
        if (!allowed.has(statusClean)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const existing = await dbGetAsync("SELECT id FROM missing_reward_reports WHERE id = ?", [reportId]);
        if (!existing) {
            return res.status(404).json({ error: "Report not found" });
        }
        await dbRunAsync(
            `UPDATE missing_reward_reports
             SET status = ?, admin_note = ?, reviewed_by_admin_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [statusClean, String(admin_note || "").trim() || null, req.admin.id, reportId]
        );
        res.json({ success: true, id: reportId, status: statusClean });
    } catch (e) {
        res.status(500).json({ error: "Failed to update report status" });
    }
});

// Get store customers (admin only) - MUST be before /api/admins/stores/:id
app.get("/api/admins/stores/:id/customers", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }
    
    db.all(
        `SELECT 
            u.id,
            u.name,
            u.phone,
            u.email,
            u.plan,
            COUNT(DISTINCT cis.id) as visit_count,
            COALESCE(SUM(pp.loops_pending), 0) as total_loops_earned,
            MAX(cis.checked_in_at) as last_visit_at
         FROM check_in_sessions cis
         JOIN users u ON cis.user_id = u.id
         LEFT JOIN pending_points pp ON pp.session_id = cis.id
         WHERE cis.store_id = ? AND cis.status = 'completed'
         GROUP BY u.id, u.name, u.phone, u.email, u.plan
         ORDER BY visit_count DESC`,
        [storeId],
        (err, customers) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            res.json({ customers: customers || [] });
        }
    );
});

// Get store details (admin only)
app.get("/api/admins/stores/:id", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }
    
    // Get store info
    db.get(
        "SELECT * FROM stores WHERE id = ?",
        [storeId],
        (err, store) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!store) {
                return res.status(404).json({ error: "Store not found" });
            }
            
            // Get store stats
            db.get(
                `SELECT 
                    COUNT(DISTINCT t.id) as transaction_count,
                    COALESCE(SUM(t.amount_cents), 0) as total_revenue_cents,
                    COUNT(DISTINCT t.user_id) as unique_customers,
                    MAX(t.created_at) as last_transaction_at
                 FROM transactions t
                 WHERE t.store_id = ?`,
                [storeId],
                (err2, stats) => {
                    if (err2) {
                        return res.status(500).json({ error: "Database error" });
                    }
                    
                    // Get unique customers by period (daily, weekly, monthly, yearly)
                    // Get daily
                    db.get(
                        `SELECT COUNT(DISTINCT user_id) as unique_customers
                         FROM transactions
                         WHERE store_id = ? AND date(created_at, 'localtime') = date('now', 'localtime')`,
                        [storeId],
                        (errDaily, dailyStat) => {
                            
                            // Get weekly
                            db.get(
                                `SELECT COUNT(DISTINCT user_id) as unique_customers
                                 FROM transactions
                                 WHERE store_id = ? AND created_at >= date('now', '-7 days', 'localtime')`,
                                [storeId],
                                (errWeekly, weeklyStat) => {
                                    
                                    // Get monthly
                                    db.get(
                                        `SELECT COUNT(DISTINCT user_id) as unique_customers
                                         FROM transactions
                                         WHERE store_id = ? AND created_at >= date('now', '-30 days', 'localtime')`,
                                        [storeId],
                                        (errMonthly, monthlyStat) => {
                                            
                                            // Get yearly
                                            db.get(
                                                `SELECT COUNT(DISTINCT user_id) as unique_customers
                                                 FROM transactions
                                                 WHERE store_id = ? AND created_at >= date('now', '-365 days', 'localtime')`,
                                                [storeId],
                                                (errYearly, yearlyStat) => {
                                                    
                                                    const customerStats = [
                                                        { period: 'daily', unique_customers: dailyStat?.unique_customers || 0, period_date: new Date().toISOString().split('T')[0] },
                                                        { period: 'weekly', unique_customers: weeklyStat?.unique_customers || 0, period_date: 'Last 7 days' },
                                                        { period: 'monthly', unique_customers: monthlyStat?.unique_customers || 0, period_date: 'Last 30 days' },
                                                        { period: 'yearly', unique_customers: yearlyStat?.unique_customers || 0, period_date: 'Last 365 days' }
                                                    ];
                                                    
                                                    // Get gift cards issued count
                                                    db.get(
                                                        `SELECT 
                                                            COUNT(*) as total_gift_cards_issued,
                                                            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_gift_cards,
                                                            COUNT(CASE WHEN card_type = 'physical' THEN 1 END) as physical_gift_cards,
                                                            COUNT(CASE WHEN card_type = 'digital' THEN 1 END) as digital_gift_cards,
                                                            COALESCE(SUM(original_value), 0) as total_gift_card_value
                                                         FROM gift_cards
                                                         WHERE issued_by_store_id = ? OR (store_id = ? AND created_at IS NOT NULL)`,
                                                        [storeId, storeId],
                                                        (err4, giftCardStats) => {
                                                            if (err4) {
                                                            }
                                                            
                                                            db.get(
                                                                "SELECT reward_tier, reward_points, unlock_cost_cents, unlock_cost_loops, is_locked, min_plan FROM store_offers WHERE store_id = ?",
                                                                [storeId],
                                                                async (offerErr, offer) => {
                                                                    if (offerErr) {
                                                                    }
                                                                    const subscription = await getStoreSubscriptionSnapshot(storeId).catch(() => null);
                                                            res.json({
                                                                        store: {
                                                                            ...store,
                                                                            offer: offer || {
                                                                                reward_tier: "standard",
                                                                                reward_points: 0,
                                                                                unlock_cost_cents: 0,
                                                                                unlock_cost_loops: 0,
                                                                                is_locked: 0,
                                                                                min_plan: "STARTER"
                                                                            },
                                                                            subscription: subscription || null,
                                                                        },
                                                                stats: stats || {
                                                                    transaction_count: 0,
                                                                    total_revenue_cents: 0,
                                                                    unique_customers: 0,
                                                                    last_transaction_at: null
                                                                },
                                                                customerStats: customerStats || [],
                                                                subscription: subscription || null,
                                                                giftCardStats: giftCardStats || {
                                                                    total_gift_cards_issued: 0,
                                                                    active_gift_cards: 0,
                                                                    physical_gift_cards: 0,
                                                                    digital_gift_cards: 0,
                                                                    total_gift_card_value: 0
                                                                }
                                                            });
                                                                }
                                                            );
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// Update store (admin only)
app.put("/api/admins/stores/:id", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    const { name, email, phone, category, zone, base_discount_percent, address, is_local } = req.body;
    
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
    }
    if (email !== undefined) {
        updates.push("email = ?");
        params.push(email);
    }
    if (phone !== undefined) {
        updates.push("phone = ?");
        params.push(phone);
    }
    if (category !== undefined) {
        updates.push("category = ?");
        params.push(category);
    }
    if (zone !== undefined) {
        updates.push("zone = ?");
        params.push(zone);
    }
    if (base_discount_percent !== undefined) {
        const discount = parseInt(base_discount_percent);
        if (discount >= 0 && discount <= 100) {
            updates.push("base_discount_percent = ?");
            params.push(discount);
        }
    }
    if (address !== undefined) {
        updates.push("address = ?");
        params.push(address);
    }
    if (is_local !== undefined) {
        updates.push("is_local = ?");
        params.push(is_local ? 1 : 0);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    
    params.push(storeId);
    
    db.run(
        `UPDATE stores SET ${updates.join(", ")} WHERE id = ?`,
        params,
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint")) {
                    return res.status(400).json({ error: "Email or phone already in use" });
                }
                return res.status(500).json({ error: "Database error" });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "Store not found" });
            }
            
            res.json({ success: true, message: "Store updated successfully" });
        }
    );
});

app.put("/api/admins/stores/:id/offer", authAdmin, async (req, res) => {
    try {
        const storeId = parseInt(req.params.id);
        if (isNaN(storeId)) {
            return res.status(400).json({ error: "Invalid store ID" });
        }

        const {
            reward_tier = "standard",
            reward_points = 0,
            unlock_cost_cents = 0,
            unlock_cost_loops = 0,
            is_locked = 0,
            min_plan = "STARTER",
            news = "No updates yet.",
        } = req.body || {};

        const allowedTiers = ["standard", "boosted", "premium"];
        if (!allowedTiers.includes(String(reward_tier))) {
            return res.status(400).json({ error: "Invalid reward tier" });
        }
        const normalizedPlan = normalizePlan(min_plan);
        const rewardPointsNum = Math.max(0, parseInt(reward_points) || 0);
        const costCentsNum = Math.max(0, parseInt(unlock_cost_cents) || 0);
        const costLoopsNum = Math.max(0, parseInt(unlock_cost_loops) || 0);
        const lockedFlag = is_locked ? 1 : 0;

        await dbRunAsync(
            `INSERT INTO store_offers 
             (store_id, reward_tier, reward_points, unlock_cost_cents, unlock_cost_loops, is_locked, min_plan, news, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(store_id) DO UPDATE SET
                reward_tier = excluded.reward_tier,
                reward_points = excluded.reward_points,
                unlock_cost_cents = excluded.unlock_cost_cents,
                unlock_cost_loops = excluded.unlock_cost_loops,
                is_locked = excluded.is_locked,
                min_plan = excluded.min_plan,
                news = excluded.news,
                updated_at = CURRENT_TIMESTAMP`,
            [
                storeId,
                reward_tier,
                rewardPointsNum,
                costCentsNum,
                costLoopsNum,
                lockedFlag,
                normalizedPlan,
                news,
            ]
        );

        res.json({
            storeId,
            offer: {
                reward_tier,
                reward_points: rewardPointsNum,
                unlock_cost_cents: costCentsNum,
                unlock_cost_loops: costLoopsNum,
                is_locked: lockedFlag,
                min_plan: normalizedPlan,
                news,
            },
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to update store offer" });
    }
});

app.put("/api/admins/stores/:id/subscription", authAdmin, async (req, res) => {
    try {
        const storeId = Number(req.params.id);
        if (!storeId) return res.status(400).json({ error: "Invalid store ID" });

        const { plan_id, status, trial_ends_at, ai_credits_used, admin_password } = req.body || {};
        if (!admin_password || !String(admin_password).trim()) {
            return res.status(400).json({ error: "Admin password is required to update subscription." });
        }
        const adminId = Number(req.user?.id || 0);
        if (!adminId) {
            return res.status(401).json({ error: "Invalid admin session" });
        }
        const admin = await dbGetAsync("SELECT id, password_hash FROM admins WHERE id = ?", [adminId]);
        if (!admin?.password_hash) {
            return res.status(401).json({ error: "Admin account not found" });
        }
        const passwordValid = await bcrypt.compare(String(admin_password), String(admin.password_hash));
        if (!passwordValid) {
            return res.status(401).json({ error: "Invalid admin password" });
        }

        const beforeSnapshot = await getStoreSubscriptionSnapshot(storeId).catch(() => null);
        const row = await ensureStoreSubscriptionRow(storeId);
        if (!row) return res.status(404).json({ error: "Store not found" });

        const updates = [];
        const params = [];
        if (plan_id !== undefined) {
            updates.push("plan_id = ?");
            params.push(normalizeStorePlanId(plan_id));
        }
        if (status !== undefined) {
            const normalizedStatus = String(status || "").trim().toLowerCase();
            if (!STORE_SUBSCRIPTION_STATUSES.has(normalizedStatus)) {
                return res.status(400).json({ error: "Invalid subscription status" });
            }
            updates.push("status = ?");
            params.push(normalizedStatus);
        }
        if (trial_ends_at !== undefined) {
            updates.push("trial_ends_at = ?");
            params.push(toSqlDateTime(trial_ends_at));
        }
        if (ai_credits_used !== undefined) {
            updates.push("ai_credits_used = ?");
            params.push(Math.max(0, Number(ai_credits_used) || 0));
        }
        if (!updates.length) {
            return res.status(400).json({ error: "No fields to update" });
        }

        params.push(storeId);
        await dbRunAsync(
            `UPDATE store_subscriptions
             SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = ?`,
            params
        );
        const snapshot = await getStoreSubscriptionSnapshot(storeId);
        await logStoreSubscriptionChange({
            storeId,
            actorType: "admin",
            actorId: adminId,
            fromSubscription: beforeSnapshot,
            toSubscription: snapshot,
            note: "admin_update",
        });
        res.json({ subscription: snapshot });
    } catch (e) {
        res.status(500).json({ error: "Failed to update store subscription" });
    }
});

app.get("/api/admins/stores/:id/subscription-audit", authAdmin, async (req, res) => {
    try {
        const storeId = Number(req.params.id);
        if (!storeId) return res.status(400).json({ error: "Invalid store ID" });
        await ensureStoreSubscriptionAuditTable();
        const logs = await dbAllAsync(
            `SELECT id, store_id, actor_type, actor_id, from_plan_id, to_plan_id, from_status, to_status, note, created_at
             FROM store_subscription_audit_logs
             WHERE store_id = ?
             ORDER BY datetime(created_at) DESC
             LIMIT 200`,
            [storeId]
        );
        res.json({ logs: logs || [] });
    } catch (e) {
        res.status(500).json({ error: "Failed to load subscription audit logs" });
    }
});

// Admin: Category reward profiles
app.get("/api/admins/category-profiles", authAdmin, (req, res) => {
    getAllCategoryProfiles((err, profiles) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ profiles: profiles || [] });
    });
});

app.put("/api/admins/category-profiles/:category", authAdmin, (req, res) => {
    const category = String(req.params.category || "").trim().toLowerCase();
    if (!category) {
        return res.status(400).json({ error: "Category is required" });
    }

    const updates = {};
    const fields = [
        "max_rewarded_visits_per_day",
        "cooldown_minutes",
        "min_dwell_minutes",
        "base_points",
        "pending_ratio",
        "dvs_expiry_days",
    ];
    fields.forEach((field) => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    updateCategoryProfile(category, updates, (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Failed to update category profile" });
        }
        res.json({ success: true, category, result });
    });
});

// Admin: Store reward profile overrides
app.get("/api/admins/stores/:id/reward-profile", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }
    getStoreRewardProfile(storeId, (err, profile) => {
        if (err) {
            // If table doesn't exist, return null profile (not an error)
            if (String(err.message || "").includes("no such table")) {
                return res.json({ profile: null });
            }
            console.error("Error fetching store reward profile:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ profile: profile || null });
    });
});

app.put("/api/admins/stores/:id/reward-profile", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }

    const updates = {};
    const fields = [
        "max_rewarded_visits_per_day",
        "cooldown_minutes",
        "min_dwell_minutes",
        "base_points",
        "pending_ratio",
        "dvs_expiry_days",
    ];
    fields.forEach((field) => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    upsertStoreRewardProfile(storeId, updates, (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Failed to update store reward profile" });
        }
        res.json({ success: true, storeId, result });
    });
});

app.delete("/api/admins/stores/:id/reward-profile", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }
    deleteStoreRewardProfile(storeId, (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Failed to clear store reward profile" });
        }
        res.json({ success: true, storeId, result });
    });
});

app.post("/api/admins/stores/backfill-phones", authAdmin, async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || "30")));
        const lat = req.query.lat != null ? Number(req.query.lat) : null;
        const lng = req.query.lng != null ? Number(req.query.lng) : null;
        const radiusMeters = req.query.radiusMeters != null ? Number(req.query.radiusMeters) : 2000;

        const candidates = await dbAllAsync(
            `SELECT id, name, address, place_id, phone
             FROM stores
             WHERE (phone IS NULL OR trim(phone) = '')
               AND (
                 (place_id IS NOT NULL AND trim(place_id) != '')
                 OR (address IS NOT NULL AND trim(address) != '')
               )
             LIMIT ?`,
            [limit]
        );

        let processed = 0;
        let updatedPhones = 0;
        let updatedPlaceIds = 0;
        const errors = [];

        for (const c of candidates) {
            processed += 1;
            try {
                let placeId = c.place_id && String(c.place_id).trim() ? String(c.place_id).trim() : null;
                if (!placeId && c.address && String(c.address).trim()) {
                    const input = `${c.name} ${c.address}`.trim();
                    placeId = await fetchGooglePlaceIdFromText(input, { lat, lng, radiusMeters });
                    if (placeId) {
                        await dbRunAsync(
                            "UPDATE stores SET place_id = COALESCE(place_id, ?) WHERE id = ?",
                            [placeId, c.id]
                        );
                        updatedPlaceIds += 1;
                    }
                }

                if (placeId) {
                    const details = await fetchGooglePlaceDetailsData(placeId);
                    if (details?.phone) {
                        await dbRunAsync(
                            "UPDATE stores SET phone = COALESCE(phone, ?) WHERE id = ?",
                            [details.phone, c.id]
                        );
                        updatedPhones += 1;
                    }
                }
            } catch (e) {
                errors.push({ storeId: c.id, error: e?.message || String(e) });
            }
        }

        res.json({
            processed,
            updatedPhones,
            updatedPlaceIds,
            errors,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to backfill phones", details: e?.message || String(e) });
    }
});

// Admin: generate/reset claim code for a store (owner verification)
app.post("/api/admins/stores/:id/claim-code", authAdmin, async (req, res) => {
    try {
        const storeId = parseInt(req.params.id);
        const force = req.query.force === "1";
        const shouldSendSMS = req.query.sms !== "0"; // Default to true, can disable with ?sms=0
        const ownerPhone = (req.body && req.body.ownerPhone) ? String(req.body.ownerPhone).trim() : null; // Phone number from request body
        if (isNaN(storeId)) {
            return res.status(400).json({ error: "Invalid store ID" });
        }

        const store = await dbGetAsync(
            "SELECT id, name, phone, claimed_at FROM stores WHERE id = ?",
            [storeId]
        );
        if (!store) return res.status(404).json({ error: "Store not found" });
        if (store.claimed_at && !force) {
            return res.status(400).json({ error: "Store is already claimed" });
        }

        // generate unique claim code (best-effort)
        let claimCode = null;
        for (let i = 0; i < 5; i++) {
            const candidate = generateClaimCode();
            const exists = await dbGetAsync(
                "SELECT id FROM stores WHERE claim_code = ?",
                [candidate]
            );
            if (!exists) {
                claimCode = candidate;
                break;
            }
        }
        if (!claimCode) {
            return res.status(500).json({ error: "Failed to generate claim code" });
        }

        await dbRunAsync(
            "UPDATE stores SET claim_code = ?, claimed_at = CASE WHEN ? THEN NULL ELSE claimed_at END WHERE id = ?",
            [claimCode, force ? 1 : 0, storeId]
        );

        // Send SMS with claim code and signup link
        let smsSent = false;
        let smsError = null;
        const phoneToUse = ownerPhone || store.phone; // Use provided phone or store phone
        let formattedPhoneNumber = null; // Track formatted number for logging
        
        if (shouldSendSMS && phoneToUse) {
            try {
                // Validate and clean phone number
                const cleanedPhone = phoneToUse.replace(/\D/g, "");
                
                // Accept 10 digits (US) or 11 digits (with country code) or international format
                if (cleanedPhone.length < 10) {
                    throw new Error(`Invalid phone number: must be at least 10 digits. You entered: ${phoneToUse}`);
                }
                
                if (cleanedPhone.length > 15) {
                    throw new Error(`Invalid phone number: too long (max 15 digits). You entered: ${phoneToUse}`);
                }
                
                // Get frontend URL from environment or construct from request
                let frontendUrl = process.env.FRONTEND_URL;
                if (!frontendUrl && req.headers.origin) {
                    try {
                        frontendUrl = new URL(req.headers.origin).origin;
                    } catch (e) {
                        console.warn("Failed to parse origin header:", req.headers.origin);
                        frontendUrl = "http://localhost:3000";
                    }
                }
                if (!frontendUrl) {
                    frontendUrl = "http://localhost:3000";
                }
                const signupUrl = `${frontendUrl}?mode=store&claimCode=${claimCode}`;
                
                const message = `Welcome to CityCircle! Your store claim code is: ${claimCode}\n\nSign up here: ${signupUrl}\n\nUse this code to claim your store and create your account.`;
                
                // Format phone number for SMS (add country code if needed)
                formattedPhoneNumber = cleanedPhone;
                if (formattedPhoneNumber.length === 10) {
                    // Add US country code if not present
                    formattedPhoneNumber = "+1" + formattedPhoneNumber;
                } else if (formattedPhoneNumber.length === 11 && formattedPhoneNumber.startsWith("1")) {
                    // Already has US country code, just add +
                    formattedPhoneNumber = "+" + formattedPhoneNumber;
                } else if (!formattedPhoneNumber.startsWith("+")) {
                    // International number without +, add it
                    formattedPhoneNumber = "+" + formattedPhoneNumber;
                }
                
                console.log(`Attempting to send SMS to: ${formattedPhoneNumber}`);
                console.log(`sendSMS type: ${typeof sendSMS}`);
                if (typeof sendSMS !== 'function') {
                    throw new Error(`sendSMS is not a function. Type: ${typeof sendSMS}. Please check server.js line 24.`);
                }
                await sendSMS(formattedPhoneNumber, message);
                smsSent = true;
                console.log(`SMS sent successfully to: ${formattedPhoneNumber}`);
            } catch (smsErr) {
                // Provide detailed error message
                const errorDetails = smsErr.message || "Unknown SMS error";
                smsError = `SMS service error: ${errorDetails}`;
                
                // Add helpful hints based on error
                if (errorDetails.includes("Vonage") || errorDetails.includes("Nexmo") || errorDetails.includes("Illegal Sender")) {
                    smsError += "\n\nTroubleshooting:\n";
                    smsError += "- 'Illegal Sender Address' means your sender ID is not approved\n";
                    smsError += "- Option 1: Set VONAGE_SMS_FROM to a verified phone number (e.g., +1234567890)\n";
                    smsError += "  * Go to Vonage dashboard > Numbers > Buy/Verify a number\n";
                    smsError += "- Option 2: Get VONAGE_BRAND approved as alphanumeric sender ID\n";
                    smsError += "  * Go to Vonage dashboard > Settings > SMS Settings > Sender IDs\n";
                    smsError += "  * Request approval for your alphanumeric ID (max 11 chars)\n";
                    smsError += "- Verify your Vonage account has SMS enabled and sufficient credits";
                }
                
                // Don't fail the request if SMS fails, just log it
                console.error("SMS send error:", smsError, "Phone:", phoneToUse, "Formatted:", formattedPhoneNumber || "N/A");
            }
        }

        res.json({ 
            storeId, 
            storeName: store.name, 
            claimCode,
            smsSent,
            smsError: smsError || (shouldSendSMS && !phoneToUse ? "No phone number provided" : null)
        });
    } catch (e) {
        console.error("Error generating claim code:", e);
        res.status(500).json({ 
            error: "Failed to generate claim code",
            details: e?.message || String(e)
        });
    }
});

// Delete store (admin only)
app.delete("/api/admins/stores/:id", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID" });
    }
    
    // Delete related data first (cascading)
    db.serialize(() => {
        db.run("DELETE FROM transactions WHERE store_id = ?", [storeId], (err) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
        });
        
        db.run("DELETE FROM pending_points WHERE store_id = ?", [storeId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM check_in_sessions WHERE store_id = ?", [storeId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        db.run("DELETE FROM gift_cards WHERE store_id = ?", [storeId], (err) => {
            if (err && !err.message.includes("no such table")) {
            }
        });
        
        // Finally, delete the store
        db.run("DELETE FROM stores WHERE id = ?", [storeId], function(err) {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "Store not found" });
            }
            
            res.json({ success: true, message: "Store deleted successfully" });
        });
    });
});

// Store login (via email OR phone)
try {
app.post("/api/stores/login", (req, res) => {
    const { email, phone, password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: "Password is required" });
    }
    
    if (!email && !phone) {
        return res.status(400).json({ error: "Email or phone number is required" });
    }

    // Determine which field to use for lookup
    let query, queryValue;
    if (email) {
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        query = "SELECT * FROM stores WHERE email = ? AND claimed_at IS NOT NULL";
        queryValue = email;
    } else {
        // Validate phone format
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: "Invalid phone number format" });
        }
        const cleanedPhone = phone.replace(/\D/g, '');
        query = "SELECT * FROM stores WHERE phone = ? AND claimed_at IS NOT NULL";
        queryValue = cleanedPhone;
    }

    db.get(
        query,
        [queryValue],
        async (err, store) => {
            if (err) return res.status(500).json({ error: "DB error" });
            if (!store) return res.status(401).json({ error: "Invalid credentials" });

            const ok = await bcrypt.compare(password, store.password_hash);
            if (!ok) return res.status(401).json({ error: "Invalid credentials" });

            const token = jwt.sign(
                { storeId: store.id, role: "store" },
                JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.json({ token, storeId: store.id });
        }
    );
});
} catch (err) {
}


// Store profile + stats
app.get("/api/stores/me", authStore, (req, res) => {
    const storeId = req.storeId;

    const baseSelect =
        "SELECT id, name, zone, category, base_discount_percent, phone, email, latitude, longitude, address, qr_code, profile_image_url FROM stores WHERE id = ?";
    const extendedSelect =
        "SELECT id, name, zone, category, base_discount_percent, phone, email, opened_month, opened_year, latitude, longitude, address, qr_code, profile_image_url FROM stores WHERE id = ?";

    function loadStore(selectSql) {
        db.get(selectSql, [storeId], (err, store) => {
            if (err) {
                if (String(err.message || "").includes("no such column: opened_month")) {
                    return loadStore(baseSelect);
                }
                if (String(err.message || "").includes("no such column: profile_image_url")) {
                    return loadStore(extendedSelect.replace(", profile_image_url", ""));
                }
                return res.status(500).json({ error: "DB error" });
            }
            if (!store) return res.status(404).json({ error: "Store not found" });

            // Generate QR code if missing (use store ID, not phone/email)
            if (!store.qr_code || (typeof store.qr_code === 'string' && !store.qr_code.trim())) {
                // Use store ID for QR code to ensure it can be parsed correctly
                const qrCode = generateQRCode("STORE", store.id.toString());
                
                db.run(
                    "UPDATE stores SET qr_code = ? WHERE id = ?",
                    [qrCode, storeId],
                    (updateErr) => {
                        if (updateErr) {
                            // Still continue with stats, but store won't have qr_code
                        } else {
                            store.qr_code = qrCode;
                        }
                        // Continue with stats
                        fetchStats();
                    }
                );
            } else {
                // Store already has QR code, proceed directly
                fetchStats();
            }

            function fetchStats() {
            // today stats
            db.get(
                `
                SELECT 
                  COUNT(DISTINCT user_id) AS customers_today,
                  COALESCE(SUM(loops_earned), 0) AS loops_today
                FROM transactions
                WHERE store_id = ?
                  AND date(created_at) = date('now','localtime')
                `,
                [storeId],
                (err2, today) => {
                    if (err2) return res.status(500).json({ error: "DB error" });

                    // lifetime stats
                    db.get(
                        `
            SELECT 
              COUNT(DISTINCT user_id) AS customers_all,
              COALESCE(SUM(loops_earned), 0) AS loops_all
            FROM transactions
            WHERE store_id = ?
            `,
                        [storeId],
                        (err3, all) => {
                            if (err3) return res.status(500).json({ error: "DB error" });

                            db.get(
                                "SELECT reward_tier, reward_points, unlock_cost_cents, unlock_cost_loops, is_locked, min_plan, news, gift_card_min_loops FROM store_offers WHERE store_id = ?",
                                [storeId],
                                (offerErr, offer) => {
                                    if (offerErr) {
                                    }
                                    const basePoints = Math.max(0, parseInt(store.base_discount_percent) || 0);
                                    const offerResponse = offer || getDefaultOfferFromPoints(basePoints);
                                    if (!offerResponse.news) {
                                        offerResponse.news = "No updates yet.";
                                    }
                                    offerResponse.gift_card_min_loops = normalizeGiftCardMinLoops(offerResponse.gift_card_min_loops);

                            // Ensure qr_code is included in response
                            const storeResponse = {
                                id: store.id,
                                name: store.name,
                                zone: store.zone,
                                category: store.category,
                                base_discount_percent: store.base_discount_percent,
                                phone: store.phone,
                                email: store.email,
                                        opened_month: store.opened_month || null,
                                        opened_year: store.opened_year || null,
                                latitude: store.latitude,
                                longitude: store.longitude,
                                address: store.address,
                                        profile_image_url: store.profile_image_url || null,
                                        qr_code: store.qr_code || null,  // Explicitly include qr_code
                                        offer: offerResponse
                                    };
                            res.json({
                                store: storeResponse,
                                stats: {
                                    customers_today: today?.customers_today || 0,
                                    loops_today: today?.loops_today || 0,
                                    customers_all: all?.customers_all || 0,
                                    loops_all: all?.loops_all || 0,
                                },
                            });
                        }
                    );
                }
            );
            }
            );
            }
        });
    }

    loadStore(extendedSelect);
});

app.get("/api/stores/subscription", authStore, async (req, res) => {
    try {
        const snapshot = await getStoreSubscriptionSnapshot(req.storeId);
        if (!snapshot) return res.status(404).json({ error: "Store not found" });
        res.json({
            subscription: snapshot,
            plans: Object.values(STORE_PLAN_CONFIGS),
            feature_matrix: STORE_PLAN_FEATURE_MATRIX,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load store subscription" });
    }
});

app.post("/api/stores/subscription/activate", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const requestedPlanId = normalizeStorePlanId(req.body?.plan_id);
        if (!STORE_PLAN_CONFIGS[requestedPlanId]) {
            return res.status(400).json({ error: "Invalid plan" });
        }
        const beforeSnapshot = await getStoreSubscriptionSnapshot(storeId).catch(() => null);
        await ensureStoreSubscriptionRow(storeId);
        const nextStatus = requestedPlanId === "trial" ? "trialing" : "active";
        await dbRunAsync(
            `UPDATE store_subscriptions
             SET plan_id = ?,
                 status = ?,
                 ai_credits_used = 0,
                 current_period_start = datetime('now'),
                 updated_at = CURRENT_TIMESTAMP
             WHERE store_id = ?`,
            [requestedPlanId, nextStatus, storeId]
        );
        const snapshot = await getStoreSubscriptionSnapshot(storeId);
        await logStoreSubscriptionChange({
            storeId,
            actorType: "store",
            actorId: Number(storeId),
            fromSubscription: beforeSnapshot,
            toSubscription: snapshot,
            note: "store_self_activate",
        });
        res.json({
            success: true,
            message:
                requestedPlanId === "trial"
                    ? "Trial plan is active."
                    : `${snapshot?.plan?.label || "Selected"} plan activated successfully.`,
            subscription: snapshot,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to activate subscription plan" });
    }
});

app.put("/api/stores/offer", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const {
            reward_tier = "standard",
            reward_points = 0,
            unlock_cost_cents = 0,
            unlock_cost_loops = 0,
            is_locked = 0,
            min_plan = "STARTER",
            gift_card_min_loops = MIN_POINTS_FOR_GIFT_CARD,
        } = req.body || {};

        const allowedTiers = ["standard", "boosted", "premium"];
        if (!allowedTiers.includes(String(reward_tier))) {
            return res.status(400).json({ error: "Invalid reward tier" });
        }
        const normalizedPlan = normalizePlan(min_plan);
        const rewardPointsNum = Math.max(0, parseInt(reward_points) || 0);
        const costCentsNum = Math.max(0, parseInt(unlock_cost_cents) || 0);
        const costLoopsNum = Math.max(0, parseInt(unlock_cost_loops) || 0);
        const lockedFlag = is_locked ? 1 : 0;
        const giftCardMinLoopsNum = normalizeGiftCardMinLoops(gift_card_min_loops);

        await dbRunAsync(
            `INSERT INTO store_offers 
             (store_id, reward_tier, reward_points, unlock_cost_cents, unlock_cost_loops, is_locked, min_plan, gift_card_min_loops, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(store_id) DO UPDATE SET
                reward_tier = excluded.reward_tier,
                reward_points = excluded.reward_points,
                unlock_cost_cents = excluded.unlock_cost_cents,
                unlock_cost_loops = excluded.unlock_cost_loops,
                is_locked = excluded.is_locked,
                min_plan = excluded.min_plan,
                gift_card_min_loops = excluded.gift_card_min_loops,
                updated_at = CURRENT_TIMESTAMP`,
            [
                storeId,
                reward_tier,
                rewardPointsNum,
                costCentsNum,
                costLoopsNum,
                lockedFlag,
                normalizedPlan,
                giftCardMinLoopsNum,
            ]
        );

        res.json({
            storeId,
            offer: {
                reward_tier,
                reward_points: rewardPointsNum,
                unlock_cost_cents: costCentsNum,
                unlock_cost_loops: costLoopsNum,
                is_locked: lockedFlag,
                min_plan: normalizedPlan,
                gift_card_min_loops: giftCardMinLoopsNum,
            },
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to update store offer" });
    }
});

app.get("/api/stores/reward-schedules", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const schedules = await dbAllAsync(
            `SELECT id, store_id, name, reason, mode, fixed_points, multiplier, start_at, end_at, is_active, created_at, updated_at
             FROM store_reward_point_schedules
             WHERE store_id = ?
             ORDER BY start_at DESC, created_at DESC`,
            [storeId]
        );
        const now = Date.now();
        const normalized = (schedules || []).map((row) => {
            const startMs = row.start_at ? new Date(row.start_at).getTime() : 0;
            const endMs = row.end_at ? new Date(row.end_at).getTime() : 0;
            const isCurrentlyActive = row.is_active === 1 && startMs <= now && endMs >= now;
            const isUpcoming = row.is_active === 1 && startMs > now;
            const status = isCurrentlyActive ? "active" : (isUpcoming ? "scheduled" : "ended");
            return { ...row, status };
        });
        res.json({ schedules: normalized });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_point_schedules")) {
            return res.json({ schedules: [] });
        }
        res.status(500).json({ error: "Failed to load reward schedules" });
    }
});

app.post("/api/stores/reward-schedules", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const created = await createStoreRewardScheduleRecord(storeId, req.body || {}, { allowOverlap: false, defaultIsActive: 1 });
        res.json({ success: true, schedule: created });
    } catch (e) {
        if (e?.statusCode) {
            return res.status(e.statusCode).json({ error: e.message });
        }
        if (String(e.message || "").includes("no such table: store_reward_point_schedules")) {
            return res.status(503).json({ error: "Missing reward schedule table. Run add-store-reward-point-schedules.js" });
        }
        res.status(500).json({ error: "Failed to create reward schedule" });
    }
});

app.put("/api/stores/reward-schedules/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const scheduleId = Number(req.params.id);
        if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
            return res.status(400).json({ error: "Invalid schedule id" });
        }

        const existing = await dbGetAsync(
            "SELECT * FROM store_reward_point_schedules WHERE id = ? AND store_id = ?",
            [scheduleId, storeId]
        );
        if (!existing) {
            return res.status(404).json({ error: "Schedule not found" });
        }

        const {
            name = existing.name,
            reason = existing.reason,
            mode = existing.mode,
            fixed_points = existing.fixed_points,
            multiplier = existing.multiplier,
            start_at = existing.start_at,
            end_at = existing.end_at,
            is_active = existing.is_active,
        } = req.body || {};

        const normalizedMode = String(mode || "").toLowerCase() === "multiplier" ? "multiplier" : "fixed";
        const startAt = parseScheduleDate(start_at);
        const endAt = parseScheduleDate(end_at);
        if (!startAt || !endAt || endAt <= startAt) {
            return res.status(400).json({ error: "Valid start_at and end_at are required" });
        }
        const durationMs = endAt.getTime() - startAt.getTime();
        if (durationMs < 2 * 60 * 60 * 1000) {
            return res.status(400).json({ error: "Schedule duration must be at least 2 hours" });
        }

        let normalizedFixedPoints = null;
        let normalizedMultiplier = null;
        if (normalizedMode === "fixed") {
            normalizedFixedPoints = normalizeScheduleFixedPoints(fixed_points);
        } else {
            normalizedMultiplier = normalizeScheduleMultiplier(multiplier);
        }

        const activeFlag = is_active ? 1 : 0;
        if (activeFlag === 1) {
            const overlap = await dbGetAsync(
                `SELECT id FROM store_reward_point_schedules
                 WHERE store_id = ? AND is_active = 1 AND id != ?
                   AND start_at < ? AND end_at > ?
                 LIMIT 1`,
                [storeId, scheduleId, endAt.toISOString(), startAt.toISOString()]
            );
            if (overlap) {
                return res.status(400).json({ error: "Schedule overlaps with another active schedule" });
            }
        }

        await dbRunAsync(
            `UPDATE store_reward_point_schedules
             SET name = ?, reason = ?, mode = ?, fixed_points = ?, multiplier = ?, start_at = ?, end_at = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND store_id = ?`,
            [
                String(name || "").trim() || existing.name,
                String(reason || "").trim() || null,
                normalizedMode,
                normalizedFixedPoints,
                normalizedMultiplier,
                startAt.toISOString(),
                endAt.toISOString(),
                activeFlag,
                scheduleId,
                storeId,
            ]
        );

        const updated = await dbGetAsync(
            `SELECT id, store_id, name, reason, mode, fixed_points, multiplier, start_at, end_at, is_active, created_at, updated_at
             FROM store_reward_point_schedules WHERE id = ?`,
            [scheduleId]
        );
        res.json({ success: true, schedule: updated });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_point_schedules")) {
            return res.status(503).json({ error: "Missing reward schedule table. Run add-store-reward-point-schedules.js" });
        }
        res.status(500).json({ error: "Failed to update reward schedule" });
    }
});

app.post("/api/stores/upload", authStore, upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const url = `${proto}://${host}/uploads/${req.file.filename}`;
    res.json({
        url,
        filename: req.file.originalname,
        size: req.file.size,
        mime: req.file.mimetype,
    });
});

function normalizeContentType(type = "") {
    const val = String(type || "").toLowerCase();
    if (["promotion", "promotions", "promo"].includes(val)) return "promotion";
    if (["update", "updates"].includes(val)) return "update";
    if (["post", "posts"].includes(val)) return "post";
    return null;
}

function contentTableForType(type) {
    if (type === "promotion") return "store_promotions";
    if (type === "update") return "store_updates";
    if (type === "post") return "store_posts";
    return null;
}

function computeContentStatus(item) {
    if (String(item.status || "") === "archived") return "archived";
    const now = Date.now();
    const startAt = item.start_at ? new Date(item.start_at).getTime() : null;
    const endAt = item.end_at ? new Date(item.end_at).getTime() : null;
    if (startAt && startAt > now) return "scheduled";
    if (endAt && endAt < now) return "expired";
    return "active";
}

function parseMediaUrls(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        return [];
    }
}

app.get("/api/stores/reward-preferences", authStore, async (req, res) => {
    try {
        const prefs = await getStoreRewardPreferences(req.storeId);
        res.json({ preferences: prefs });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_preferences")) {
            return res.json({
                preferences: {
                    store_id: req.storeId,
                    automation_mode: "auto",
                    weekly_digest_enabled: 1,
                    updated_at: null,
                },
            });
        }
        res.status(500).json({ error: "Failed to load reward preferences" });
    }
});

app.put("/api/stores/reward-preferences", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const { automation_mode = "auto", weekly_digest_enabled = 1 } = req.body || {};
        const mode = normalizeRewardAutomationMode(automation_mode);
        const digestEnabled = weekly_digest_enabled ? 1 : 0;
        await dbRunAsync(
            `INSERT INTO store_reward_preferences (store_id, automation_mode, weekly_digest_enabled, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(store_id) DO UPDATE SET
               automation_mode = excluded.automation_mode,
               weekly_digest_enabled = excluded.weekly_digest_enabled,
               updated_at = CURRENT_TIMESTAMP`,
            [storeId, mode, digestEnabled]
        );
        const prefs = await getStoreRewardPreferences(storeId);
        res.json({ success: true, preferences: prefs });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_preferences")) {
            return res.status(503).json({ error: "Missing reward preferences table. Run add-store-reward-preferences.js" });
        }
        res.status(500).json({ error: "Failed to update reward preferences" });
    }
});

app.get("/api/stores/reward-recommendations", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const recommendations = await buildStoreRewardRecommendations(storeId);
        const prefs = await getStoreRewardPreferences(storeId);
        res.json({ recommendations, preferences: prefs });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_point_schedules")) {
            return res.status(503).json({ error: "Missing reward schedule table. Run add-store-reward-point-schedules.js" });
        }
        res.status(500).json({ error: "Failed to load reward recommendations" });
    }
});

app.post("/api/stores/reward-recommendations/:recommendationId/apply", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const recommendationId = String(req.params.recommendationId || "").trim();
        const recommendations = await buildStoreRewardRecommendations(storeId);
        const selected = recommendations.find((r) => r.id === recommendationId);
        if (!selected) {
            return res.status(404).json({ error: "Recommendation not found" });
        }

        const created = await createStoreRewardScheduleRecord(
            storeId,
            {
                name: selected.title,
                reason: selected.reason,
                mode: selected.mode,
                fixed_points: selected.fixed_points,
                multiplier: selected.multiplier,
                start_at: selected.start_at,
                end_at: selected.end_at,
                is_active: 1,
            },
            { allowOverlap: false, defaultIsActive: 1 }
        );

        res.json({ success: true, schedule: created, applied_recommendation_id: recommendationId });
    } catch (e) {
        if (e?.statusCode) {
            return res.status(e.statusCode).json({ error: e.message });
        }
        if (String(e.message || "").includes("no such table: store_reward_point_schedules")) {
            return res.status(503).json({ error: "Missing reward schedule table. Run add-store-reward-point-schedules.js" });
        }
        res.status(500).json({ error: "Failed to apply recommendation" });
    }
});

app.get("/api/stores/reward-holiday-reminders", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const data = await buildStoreHolidayReminders(storeId, { autoApplyIfAutoMode: true });
        res.json(data);
    } catch (e) {
        const msg = String(e.message || "");
        if (msg.includes("no such table: store_reward_holiday_actions")) {
            return res.status(503).json({ error: "Missing holiday action table. Run add-store-reward-holiday-actions.js" });
        }
        if (msg.includes("no such table: store_reward_preferences")) {
            return res.status(503).json({ error: "Missing reward preferences table. Run add-store-reward-preferences.js" });
        }
        res.status(500).json({ error: "Failed to load holiday reminders" });
    }
});

app.post("/api/stores/reward-holiday-reminders/:reminderId/respond", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const reminderId = String(req.params.reminderId || "").trim();
        const action = String(req.body?.action || "").trim().toLowerCase();
        const validActions = ["auto_apply", "manual_later", "skip"];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: "Invalid action" });
        }

        const reminderMatch = reminderId.match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
        if (!reminderMatch) {
            return res.status(400).json({ error: "Invalid reminder id" });
        }
        const holidayId = reminderMatch[1];
        const holidayDate = reminderMatch[2];

        if (action === "auto_apply") {
            const offerRow = await dbGetAsync("SELECT reward_points FROM store_offers WHERE store_id = ?", [storeId]).catch(() => null);
            const basePoints = normalizeScheduleFixedPoints(Number(offerRow?.reward_points || 10));
            const suggested = getHolidaySuggestedRewardConfig(holidayId, basePoints);
            const startAt = new Date(`${holidayDate}T00:00:00`);
            const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
            await createStoreRewardScheduleRecord(
                storeId,
                {
                    name: `${holidayId.replace(/-/g, " ")} Reward`,
                    reason: `Manual apply from holiday reminder`,
                    mode: suggested.mode,
                    fixed_points: suggested.fixed_points,
                    multiplier: suggested.multiplier,
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString(),
                    is_active: 1,
                },
                { allowOverlap: false, defaultIsActive: 1 }
            );
            await upsertStoreHolidayAction(storeId, holidayId, holidayDate, "auto_applied");
        } else if (action === "manual_later") {
            await upsertStoreHolidayAction(storeId, holidayId, holidayDate, "manual_later");
        } else if (action === "skip") {
            await upsertStoreHolidayAction(storeId, holidayId, holidayDate, "skipped");
        }

        res.json({ success: true, reminder_id: reminderId, action });
    } catch (e) {
        if (e?.statusCode) {
            return res.status(e.statusCode).json({ error: e.message });
        }
        const msg = String(e.message || "");
        if (msg.includes("no such table: store_reward_holiday_actions")) {
            return res.status(503).json({ error: "Missing holiday action table. Run add-store-reward-holiday-actions.js" });
        }
        res.status(500).json({ error: "Failed to update holiday reminder" });
    }
});

function serializeMediaUrls(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
        const cleaned = value.map((v) => String(v || "").trim()).filter(Boolean);
        return cleaned.length ? JSON.stringify(cleaned) : null;
    }
    if (typeof value === "string") {
        return value.trim() ? JSON.stringify([value.trim()]) : null;
    }
    return null;
}

// Helper function to create notifications for customers when stores post promotions/updates
async function createNotificationsForStoreContent(storeId, contentType, contentId, title, message) {
    try {
        // Get store info with location
        const store = await dbGetAsync("SELECT name, latitude, longitude FROM stores WHERE id = ?", [storeId]);
        if (!store) {
            console.error(`Store ${storeId} not found`);
            return;
        }

        // Notify customers who have enrolled at this store (members only)
        // Check both store_memberships and store_slots/store_unlocks for enrollment
        const currentCycle = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        const enrolledCustomers = await dbAllAsync(
            `SELECT DISTINCT u.id, u.phone, u.email, u.name
             FROM users u
             INNER JOIN (
                 SELECT user_id FROM store_memberships 
                 WHERE store_id = ? AND status = 'active'
                 UNION
                 SELECT user_id FROM store_slots 
                 WHERE store_id = ? AND status = 'active'
                 UNION
                 SELECT user_id FROM store_unlocks 
                 WHERE store_id = ? AND status = 'active'
             ) enrolled ON enrolled.user_id = u.id
             GROUP BY u.id`,
            [storeId, storeId, storeId]
        );

        if (!enrolledCustomers || enrolledCustomers.length === 0) {
            console.log(`No enrolled customers to notify for store ${storeId}`);
            return;
        }
        
        const customers = enrolledCustomers;

        const notificationIds = [];

        // Get notification preferences for each customer and create notifications
        for (const customer of customers) {
            const prefs = await dbGetAsync(
                `SELECT promotions_enabled, updates_enabled, sms_enabled, email_enabled
                 FROM notification_preferences
                 WHERE user_id = ?`,
                [customer.id]
            );

            // Default preferences: promotions and updates enabled, SMS/email disabled
            const promotionsEnabled = prefs ? prefs.promotions_enabled !== 0 : true;
            const updatesEnabled = prefs ? prefs.updates_enabled !== 0 : true;
            const smsEnabled = prefs ? prefs.sms_enabled === 1 : false;
            const emailEnabled = prefs ? prefs.email_enabled === 1 : false;

            // Check if this notification type is enabled
            const shouldNotify = (contentType === "promotion" && promotionsEnabled) || 
                                (contentType === "update" && updatesEnabled);
            
            if (!shouldNotify) continue;

            // Create in-app notification
            const result = await dbRunAsync(
                `INSERT INTO notifications (user_id, store_id, type, title, message, content_id, content_type, is_read, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
                [customer.id, storeId, contentType, title, message, contentId, contentType]
            );

            notificationIds.push({
                notificationId: result.lastID,
                userId: customer.id
            });

            // Send SMS if enabled
            if (smsEnabled && customer.phone) {
                try {
                    const smsMessage = `${store.name}: ${title}. ${message || ""}`;
                    await sendSMS(customer.phone, smsMessage);
                } catch (smsErr) {
                    console.error(`Failed to send SMS to ${customer.phone}:`, smsErr.message);
                }
            }

            // TODO: Send email if enabled (requires email service setup)
            if (emailEnabled && customer.email) {
                // Email sending logic would go here
            }
        }

        // Emit real-time notifications via Socket.io
        if (notificationIds.length > 0) {
            const storeInfo = await dbGetAsync(
                "SELECT name, category, profile_image_url FROM stores WHERE id = ?",
                [storeId]
            );
            
            notificationIds.forEach(({ notificationId, userId }) => {
                io.emit(`notification:${userId}`, {
                    id: notificationId,
                    user_id: userId,
                    store_id: storeId,
                    store_name: storeInfo?.name || store.name,
                    store_category: storeInfo?.category || null,
                    store_profile_image_url: storeInfo?.profile_image_url || null,
                    type: contentType,
                    title,
                    message,
                    content_id: contentId,
                    content_type: contentType,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });
            
            console.log(`Sent ${notificationIds.length} real-time notifications for ${contentType} ${contentId} from store ${storeId}`);
        }
    } catch (err) {
        console.error("Error creating notifications:", err.message);
        console.error(err.stack);
        // Don't throw - notifications are non-critical
    }
}

async function refreshContentStatuses(table, storeIds) {
    const now = new Date().toISOString();
    const ids = Array.isArray(storeIds) ? storeIds : [storeIds];
    const placeholders = ids.map(() => "?").join(",");
    await dbRunAsync(
        `UPDATE ${table}
         SET status = CASE
             WHEN status = 'archived' THEN 'archived'
             WHEN end_at IS NOT NULL AND end_at < ? THEN 'archived'
             WHEN start_at IS NOT NULL AND start_at > ? THEN 'scheduled'
             ELSE 'active'
         END,
         updated_at = CASE
             WHEN status = 'archived' THEN updated_at
             ELSE CURRENT_TIMESTAMP
         END
         WHERE store_id IN (${placeholders})`,
        [now, now, ...ids]
    );
}

app.get("/api/stores/content", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const typeFilter = normalizeContentType(req.query.type || "all");
        const statusFilter = String(req.query.status || "all").toLowerCase();

        const contentItems = [];

        if (!typeFilter || typeFilter === "promotion") {
            await refreshContentStatuses("store_promotions", storeId);
            const rows = await dbAllAsync(
            `SELECT id, title, description, media_urls, discount_type, discount_value, start_at, end_at, status, like_count, created_at
                 FROM store_promotions WHERE store_id = ?`,
                [storeId]
            );
            (rows || []).forEach((row) => {
                const computed_status = computeContentStatus(row);
                contentItems.push({
                    type: "promotion",
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    media_urls: parseMediaUrls(row.media_urls),
                    discount_type: row.discount_type,
                    discount_value: row.discount_value,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    computed_status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                });
            });
        }

        if (!typeFilter || typeFilter === "update") {
            await refreshContentStatuses("store_updates", storeId);
            const rows = await dbAllAsync(
            `SELECT id, title, body, media_urls, pinned, start_at, end_at, status, like_count, created_at
                 FROM store_updates WHERE store_id = ?`,
                [storeId]
            );
            (rows || []).forEach((row) => {
                const computed_status = computeContentStatus(row);
                contentItems.push({
                    type: "update",
                    id: row.id,
                    title: row.title,
                    body: row.body,
                    media_urls: parseMediaUrls(row.media_urls),
                    pinned: row.pinned,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    computed_status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                });
            });
        }

        if (!typeFilter || typeFilter === "post") {
            await refreshContentStatuses("store_posts", storeId);
            const rows = await dbAllAsync(
            `SELECT id, post_type, caption, media_url, media_urls, start_at, end_at, status, like_count, created_at
                 FROM store_posts WHERE store_id = ?`,
                [storeId]
            );
            (rows || []).forEach((row) => {
                const computed_status = computeContentStatus(row);
                contentItems.push({
                    type: "post",
                    id: row.id,
                    post_type: row.post_type,
                    caption: row.caption,
                    media_url: row.media_url,
                    media_urls: parseMediaUrls(row.media_urls),
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    computed_status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                });
            });
        }

        const filtered = contentItems
            .filter((item) => (statusFilter === "all" ? true : item.computed_status === statusFilter))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({ content: filtered });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_promotions")) {
            return res.status(503).json({ error: "Missing store_promotions table. Run add-store-promotions.js" });
        }
        if (String(e.message || "").includes("no such table: store_updates")) {
            return res.status(503).json({ error: "Missing store_updates table. Run add-store-updates.js" });
        }
        if (String(e.message || "").includes("no such table: store_posts")) {
            return res.status(503).json({ error: "Missing store_posts table. Run add-store-posts.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store content columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to load store content" });
    }
});

app.get("/api/stores/promotions", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        await refreshContentStatuses("store_promotions", storeId);
        const rows = await dbAllAsync(
            `SELECT id, title, description, media_urls, discount_type, discount_value, start_at, end_at, status, like_count, created_at
             FROM store_promotions
             WHERE store_id = ?
             ORDER BY datetime(created_at) DESC`,
            [storeId]
        );
        const promotions = (rows || []).map((row) => ({
            ...row,
            media_urls: parseMediaUrls(row.media_urls),
        }));
        res.json({ promotions });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_promotions")) {
            return res.status(503).json({ error: "Missing store_promotions table. Run add-store-promotions.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store_promotions columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to load promotions" });
    }
});

app.post("/api/stores/promotions", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const access = await ensureStoreCanCreateContent(storeId);
        if (!access.allowed) {
            return res.status(access.code).json({ error: access.error, subscription: access.subscription });
        }
        const {
            title,
            description = "",
            media_urls = null,
            discount_type,
            discount_value = null,
            start_at = null,
            end_at = null,
        } = req.body || {};

        if (!title || !String(title).trim()) {
            return res.status(400).json({ error: "Title is required" });
        }
        const allowedTypes = ["percent", "fixed", "bogo", "free_item"];
        if (!allowedTypes.includes(String(discount_type))) {
            return res.status(400).json({ error: "Invalid discount type" });
        }

        let discountValueNum = null;
        if (discount_value !== null && discount_value !== undefined && discount_value !== "") {
            discountValueNum = Number(discount_value);
            if (Number.isNaN(discountValueNum) || discountValueNum < 0) {
                return res.status(400).json({ error: "Invalid discount value" });
            }
            if (discount_type === "percent" && discountValueNum > 100) {
                return res.status(400).json({ error: "Percent discount must be 0-100" });
            }
        }

        const startAtVal = start_at ? new Date(start_at) : null;
        const endAtVal = end_at ? new Date(end_at) : null;
        if (start_at && Number.isNaN(startAtVal.getTime())) {
            return res.status(400).json({ error: "Invalid start date" });
        }
        if (end_at && Number.isNaN(endAtVal.getTime())) {
            return res.status(400).json({ error: "Invalid end date" });
        }
        if (startAtVal && endAtVal && endAtVal.getTime() < startAtVal.getTime()) {
            return res.status(400).json({ error: "End date must be after start date" });
        }

        let status = "active";
        if (endAtVal && endAtVal.getTime() < Date.now()) {
            status = "archived";
        } else if (startAtVal && startAtVal.getTime() > Date.now()) {
            status = "scheduled";
        }

        const mediaUrlsSerialized = serializeMediaUrls(media_urls);
        const result = await dbRunAsync(
            `INSERT INTO store_promotions
             (store_id, title, description, media_urls, discount_type, discount_value, start_at, end_at, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                storeId,
                String(title).trim(),
                String(description || "").trim(),
                mediaUrlsSerialized,
                String(discount_type),
                discountValueNum,
                start_at || null,
                end_at || null,
                status,
            ]
        );

        const promotionId = result.lastID;
        
        // Create notifications for customers (only if promotion is active, not scheduled)
        if (status === "active") {
            const notificationTitle = `New Promotion: ${String(title).trim()}`;
            const notificationMessage = "Tap to view details";
            createNotificationsForStoreContent(storeId, "promotion", promotionId, notificationTitle, notificationMessage).catch(err => {
                console.error("Failed to create notifications:", err.message);
            });
        }

        res.json({
            id: promotionId,
            title: String(title).trim(),
            description: String(description || "").trim(),
            media_urls: parseMediaUrls(mediaUrlsSerialized),
            discount_type: String(discount_type),
            discount_value: discountValueNum,
            start_at: start_at || null,
            end_at: end_at || null,
            status,
        });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_promotions")) {
            return res.status(503).json({ error: "Missing store_promotions table. Run add-store-promotions.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store_promotions columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to create promotion" });
    }
});

app.get("/api/stores/updates", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        await refreshContentStatuses("store_updates", storeId);
        const rows = await dbAllAsync(
            `SELECT id, title, body, media_urls, pinned, start_at, end_at, status, like_count, created_at
             FROM store_updates
             WHERE store_id = ?
             ORDER BY pinned DESC, datetime(created_at) DESC`,
            [storeId]
        );
        const updates = (rows || []).map((row) => ({
            ...row,
            media_urls: parseMediaUrls(row.media_urls),
        }));
        res.json({ updates });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_updates")) {
            return res.status(503).json({ error: "Missing store_updates table. Run add-store-updates.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store_updates columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to load updates" });
    }
});

app.post("/api/stores/updates", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const access = await ensureStoreCanCreateContent(storeId);
        if (!access.allowed) {
            return res.status(access.code).json({ error: access.error, subscription: access.subscription });
        }
        const { title, body, media_urls = null, pinned = 0, start_at = null, end_at = null } = req.body || {};
        if (!title || !String(title).trim()) {
            return res.status(400).json({ error: "Title is required" });
        }
        if (!body || !String(body).trim()) {
            return res.status(400).json({ error: "Update body is required" });
        }
        const startAtVal = start_at ? new Date(start_at) : null;
        const endAtVal = end_at ? new Date(end_at) : null;
        if (start_at && Number.isNaN(startAtVal.getTime())) {
            return res.status(400).json({ error: "Invalid start date" });
        }
        if (end_at && Number.isNaN(endAtVal.getTime())) {
            return res.status(400).json({ error: "Invalid end date" });
        }
        if (startAtVal && endAtVal && endAtVal.getTime() < startAtVal.getTime()) {
            return res.status(400).json({ error: "End date must be after start date" });
        }

        const pinnedFlag = pinned ? 1 : 0;
        let status = "active";
        if (endAtVal && endAtVal.getTime() < Date.now()) {
            status = "archived";
        } else if (startAtVal && startAtVal.getTime() > Date.now()) {
            status = "scheduled";
        }
        const mediaUrlsSerialized = serializeMediaUrls(media_urls);
        const result = await dbRunAsync(
            `INSERT INTO store_updates
             (store_id, title, body, media_urls, pinned, start_at, end_at, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                storeId,
                String(title).trim(),
                String(body).trim(),
                mediaUrlsSerialized,
                pinnedFlag,
                start_at || null,
                end_at || null,
                status,
            ]
        );

        const updateId = result.lastID;
        
        // Create notifications for customers (only if update is active, not scheduled)
        if (status === "active") {
            const notificationTitle = String(title).trim();
            const notificationMessage = "Tap to view details";
            createNotificationsForStoreContent(storeId, "update", updateId, notificationTitle, notificationMessage).catch(err => {
                console.error("Failed to create notifications:", err.message);
            });
        }

        res.json({
            id: updateId,
            title: String(title).trim(),
            body: String(body).trim(),
            media_urls: parseMediaUrls(mediaUrlsSerialized),
            pinned: pinnedFlag,
            start_at: start_at || null,
            end_at: end_at || null,
            status,
        });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_updates")) {
            return res.status(503).json({ error: "Missing store_updates table. Run add-store-updates.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store_updates columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to create update" });
    }
});

app.get("/api/stores/posts", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        await refreshContentStatuses("store_posts", storeId);
        const rows = await dbAllAsync(
            `SELECT id, post_type, caption, media_url, media_urls, start_at, end_at, status, like_count, created_at
             FROM store_posts
             WHERE store_id = ?
             ORDER BY datetime(created_at) DESC`,
            [storeId]
        );
        const posts = (rows || []).map((row) => ({
            ...row,
            media_urls: parseMediaUrls(row.media_urls),
        }));
        res.json({ posts });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_posts")) {
            return res.status(503).json({ error: "Missing store_posts table. Run add-store-posts.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store_posts columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to load posts" });
    }
});

app.post("/api/stores/posts", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const access = await ensureStoreCanCreateContent(storeId);
        if (!access.allowed) {
            return res.status(access.code).json({ error: access.error, subscription: access.subscription });
        }
        let { post_type, caption, media_url = "", media_urls = null, start_at = null, end_at = null } = req.body || {};
        if (post_type === "files") post_type = "mixed";
        const allowedTypes = ["text", "image", "video", "mixed"];
        if (!allowedTypes.includes(String(post_type))) {
            return res.status(400).json({ error: "Invalid post type" });
        }
        if (!caption || !String(caption).trim()) {
            return res.status(400).json({ error: "Caption is required" });
        }
        const mediaUrlsSerialized = serializeMediaUrls(media_urls);
        if (post_type !== "text" && !String(media_url || "").trim() && !mediaUrlsSerialized) {
            return res.status(400).json({ error: "Media URL is required for image/video posts" });
        }

        const startAtVal = start_at ? new Date(start_at) : null;
        const endAtVal = end_at ? new Date(end_at) : null;
        if (start_at && Number.isNaN(startAtVal.getTime())) {
            return res.status(400).json({ error: "Invalid start date" });
        }
        if (end_at && Number.isNaN(endAtVal.getTime())) {
            return res.status(400).json({ error: "Invalid end date" });
        }
        if (startAtVal && endAtVal && endAtVal.getTime() < startAtVal.getTime()) {
            return res.status(400).json({ error: "End date must be after start date" });
        }

        let status = "active";
        if (endAtVal && endAtVal.getTime() < Date.now()) {
            status = "archived";
        } else if (startAtVal && startAtVal.getTime() > Date.now()) {
            status = "scheduled";
        }

        const finalMediaUrl = String(media_url || "").trim() || null;
        const result = await dbRunAsync(
            `INSERT INTO store_posts
             (store_id, post_type, caption, media_url, media_urls, start_at, end_at, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                storeId,
                String(post_type),
                String(caption).trim(),
                finalMediaUrl,
                mediaUrlsSerialized,
                start_at || null,
                end_at || null,
                status,
            ]
        );

        res.json({
            id: result.lastID,
            post_type: String(post_type),
            caption: String(caption).trim(),
            media_url: finalMediaUrl,
            media_urls: parseMediaUrls(mediaUrlsSerialized),
            start_at: start_at || null,
            end_at: end_at || null,
            status,
        });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_posts")) {
            return res.status(503).json({ error: "Missing store_posts table. Run add-store-posts.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing store_posts columns. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to create post" });
    }
});

app.put("/api/stores/promotions/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const promoId = Number(req.params.id);
        if (!promoId) return res.status(400).json({ error: "Invalid promotion id" });

        const {
            title,
            description,
            media_urls,
            discount_type,
            discount_value,
            start_at,
            end_at,
        } = req.body || {};

        const updates = [];
        const params = [];

        if (title !== undefined) {
            if (!String(title).trim()) return res.status(400).json({ error: "Title is required" });
            updates.push("title = ?");
            params.push(String(title).trim());
        }
        if (description !== undefined) {
            updates.push("description = ?");
            params.push(String(description || "").trim());
        }
        if (media_urls !== undefined) {
            updates.push("media_urls = ?");
            params.push(serializeMediaUrls(media_urls));
        }
        if (discount_type !== undefined) {
            const allowedTypes = ["percent", "fixed", "bogo", "free_item"];
            if (!allowedTypes.includes(String(discount_type))) {
                return res.status(400).json({ error: "Invalid discount type" });
            }
            updates.push("discount_type = ?");
            params.push(String(discount_type));
        }
        if (discount_value !== undefined) {
            let discountValueNum = null;
            if (discount_value !== null && discount_value !== "") {
                discountValueNum = Number(discount_value);
                if (Number.isNaN(discountValueNum) || discountValueNum < 0) {
                    return res.status(400).json({ error: "Invalid discount value" });
                }
                if (discount_type === "percent" && discountValueNum > 100) {
                    return res.status(400).json({ error: "Percent discount must be 0-100" });
                }
            }
            updates.push("discount_value = ?");
            params.push(discountValueNum);
        }
        if (start_at !== undefined) {
            const startAtVal = start_at ? new Date(start_at) : null;
            if (start_at && Number.isNaN(startAtVal.getTime())) {
                return res.status(400).json({ error: "Invalid start date" });
            }
            updates.push("start_at = ?");
            params.push(start_at || null);
        }
        if (end_at !== undefined) {
            const endAtVal = end_at ? new Date(end_at) : null;
            if (end_at && Number.isNaN(endAtVal.getTime())) {
                return res.status(400).json({ error: "Invalid end date" });
            }
            updates.push("end_at = ?");
            params.push(end_at || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No updates provided" });
        }

        params.push(storeId, promoId);
        await dbRunAsync(
            `UPDATE store_promotions SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = ? AND id = ?`,
            params
        );
        res.json({ success: true });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_promotions")) {
            return res.status(503).json({ error: "Missing store_promotions table. Run add-store-promotions.js" });
        }
        res.status(500).json({ error: "Failed to update promotion" });
    }
});

app.put("/api/stores/updates/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const updateId = Number(req.params.id);
        if (!updateId) return res.status(400).json({ error: "Invalid update id" });

        const { title, body, media_urls, pinned, start_at, end_at } = req.body || {};
        const updates = [];
        const params = [];

        if (title !== undefined) {
            if (!String(title).trim()) return res.status(400).json({ error: "Title is required" });
            updates.push("title = ?");
            params.push(String(title).trim());
        }
        if (body !== undefined) {
            if (!String(body).trim()) return res.status(400).json({ error: "Update body is required" });
            updates.push("body = ?");
            params.push(String(body).trim());
        }
        if (media_urls !== undefined) {
            updates.push("media_urls = ?");
            params.push(serializeMediaUrls(media_urls));
        }
        if (pinned !== undefined) {
            updates.push("pinned = ?");
            params.push(pinned ? 1 : 0);
        }
        if (start_at !== undefined) {
            const startAtVal = start_at ? new Date(start_at) : null;
            if (start_at && Number.isNaN(startAtVal.getTime())) {
                return res.status(400).json({ error: "Invalid start date" });
            }
            updates.push("start_at = ?");
            params.push(start_at || null);
        }
        if (end_at !== undefined) {
            const endAtVal = end_at ? new Date(end_at) : null;
            if (end_at && Number.isNaN(endAtVal.getTime())) {
                return res.status(400).json({ error: "Invalid end date" });
            }
            updates.push("end_at = ?");
            params.push(end_at || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No updates provided" });
        }

        params.push(storeId, updateId);
        await dbRunAsync(
            `UPDATE store_updates SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = ? AND id = ?`,
            params
        );
        res.json({ success: true });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_updates")) {
            return res.status(503).json({ error: "Missing store_updates table. Run add-store-updates.js" });
        }
        res.status(500).json({ error: "Failed to update update" });
    }
});

app.put("/api/stores/posts/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const postId = Number(req.params.id);
        if (!postId) return res.status(400).json({ error: "Invalid post id" });

        const { post_type, caption, media_url, media_urls, start_at, end_at } = req.body || {};
        const updates = [];
        const params = [];

        if (post_type !== undefined) {
            const allowedTypes = ["text", "image", "video", "mixed"];
            if (!allowedTypes.includes(String(post_type))) {
                return res.status(400).json({ error: "Invalid post type" });
            }
            updates.push("post_type = ?");
            params.push(String(post_type));
        }
        if (caption !== undefined) {
            if (!String(caption).trim()) return res.status(400).json({ error: "Caption is required" });
            updates.push("caption = ?");
            params.push(String(caption).trim());
        }
        if (media_url !== undefined) {
            updates.push("media_url = ?");
            params.push(String(media_url || "").trim() || null);
        }
        if (media_urls !== undefined) {
            updates.push("media_urls = ?");
            params.push(serializeMediaUrls(media_urls));
        }
        if (start_at !== undefined) {
            const startAtVal = start_at ? new Date(start_at) : null;
            if (start_at && Number.isNaN(startAtVal.getTime())) {
                return res.status(400).json({ error: "Invalid start date" });
            }
            updates.push("start_at = ?");
            params.push(start_at || null);
        }
        if (end_at !== undefined) {
            const endAtVal = end_at ? new Date(end_at) : null;
            if (end_at && Number.isNaN(endAtVal.getTime())) {
                return res.status(400).json({ error: "Invalid end date" });
            }
            updates.push("end_at = ?");
            params.push(end_at || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No updates provided" });
        }

        params.push(storeId, postId);
        await dbRunAsync(
            `UPDATE store_posts SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE store_id = ? AND id = ?`,
            params
        );
        res.json({ success: true });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_posts")) {
            return res.status(503).json({ error: "Missing store_posts table. Run add-store-posts.js" });
        }
        res.status(500).json({ error: "Failed to update post" });
    }
});

app.delete("/api/stores/promotions/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const promoId = Number(req.params.id);
        if (!promoId) return res.status(400).json({ error: "Invalid promotion id" });
        await dbRunAsync("DELETE FROM store_promotions WHERE store_id = ? AND id = ?", [storeId, promoId]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete promotion" });
    }
});

app.delete("/api/stores/updates/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const updateId = Number(req.params.id);
        if (!updateId) return res.status(400).json({ error: "Invalid update id" });
        await dbRunAsync("DELETE FROM store_updates WHERE store_id = ? AND id = ?", [storeId, updateId]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete update" });
    }
});

app.delete("/api/stores/posts/:id", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const postId = Number(req.params.id);
        if (!postId) return res.status(400).json({ error: "Invalid post id" });
        await dbRunAsync("DELETE FROM store_posts WHERE store_id = ? AND id = ?", [storeId, postId]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete post" });
    }
});

app.get("/api/users/feed", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const radius = Math.max(1, Number(req.query.radius || 10));
        const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
        const typeFilter = normalizeContentType(req.query.type || "all");
        const scope = String(req.query.scope || "local").toLowerCase();
        const categoryFilter = String(req.query.category || "").trim();
        const localRadius = Math.max(0, Number(req.query.local_radius || 5));

        const user = await dbGetAsync(
            "SELECT latitude, longitude FROM users WHERE id = ?",
            [userId]
        );
        if (!user?.latitude || !user?.longitude) {
            return res.json({ content: [], reason: "location_required" });
        }

        let storeQuery =
            "SELECT id, name, category, latitude, longitude, profile_image_url FROM stores WHERE latitude IS NOT NULL AND longitude IS NOT NULL";
        if (scope === "local") {
            storeQuery += " AND is_local = 1 AND (zone IS NULL OR zone != 'OSM')";
        } else if (scope === "discovery") {
            storeQuery += " AND (zone IS NULL OR zone != 'OSM')";
        }

        const storeRows = await dbAllAsync(storeQuery);
        const nearbyStores = (storeRows || [])
            .map((s) => ({
                ...s,
                distance_miles: haversineMiles(user.latitude, user.longitude, s.latitude, s.longitude),
            }))
            .filter((s) => s.distance_miles != null && s.distance_miles <= radius)
            .filter((s) => (scope === "discovery" ? s.distance_miles > localRadius : true))
            .filter((s) => {
                if (!categoryFilter || categoryFilter.toLowerCase() === "all") return true;
                const category = String(s.category || "").trim().toLowerCase();
                return category === categoryFilter.toLowerCase();
            })
            .sort((a, b) => a.distance_miles - b.distance_miles);

        if (!nearbyStores.length) {
            return res.json({ content: [] });
        }

        const storeById = new Map(nearbyStores.map((s) => [s.id, s]));
        const storeIds = nearbyStores.map((s) => s.id);
        const placeholders = storeIds.map(() => "?").join(",");
        const contentItems = [];

        if (!typeFilter || typeFilter === "promotion") {
            await refreshContentStatuses("store_promotions", storeIds);
            const rows = await dbAllAsync(
                `SELECT id, store_id, title, description, media_urls, discount_type, discount_value, start_at, end_at, status, like_count, created_at
                 FROM store_promotions WHERE store_id IN (${placeholders})`,
                storeIds
            );
            (rows || []).forEach((row) => {
                const computed_status = computeContentStatus(row);
                if (computed_status !== "active") return;
                const store = storeById.get(row.store_id);
                contentItems.push({
                    type: "promotion",
                    id: row.id,
                    store_id: row.store_id,
                    store_name: store?.name || "Store",
                    store_category: store?.category || "",
                    store_profile_image_url: store?.profile_image_url || null,
                    distance_miles: store?.distance_miles ?? null,
                    title: row.title,
                    description: row.description,
                    media_urls: parseMediaUrls(row.media_urls),
                    discount_type: row.discount_type,
                    discount_value: row.discount_value,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    computed_status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                });
            });
        }

        if (!typeFilter || typeFilter === "update") {
            await refreshContentStatuses("store_updates", storeIds);
            const rows = await dbAllAsync(
                `SELECT id, store_id, title, body, media_urls, pinned, start_at, end_at, status, like_count, created_at
                 FROM store_updates WHERE store_id IN (${placeholders})`,
                storeIds
            );
            (rows || []).forEach((row) => {
                const computed_status = computeContentStatus(row);
                if (computed_status !== "active") return;
                const store = storeById.get(row.store_id);
                contentItems.push({
                    type: "update",
                    id: row.id,
                    store_id: row.store_id,
                    store_name: store?.name || "Store",
                    store_category: store?.category || "",
                    store_profile_image_url: store?.profile_image_url || null,
                    distance_miles: store?.distance_miles ?? null,
                    title: row.title,
                    body: row.body,
                    media_urls: parseMediaUrls(row.media_urls),
                    pinned: row.pinned,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    computed_status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                });
            });
        }

        if (!typeFilter || typeFilter === "post") {
            await refreshContentStatuses("store_posts", storeIds);
            const rows = await dbAllAsync(
                `SELECT id, store_id, post_type, caption, media_url, media_urls, start_at, end_at, status, like_count, created_at
                 FROM store_posts WHERE store_id IN (${placeholders})`,
                storeIds
            );
            (rows || []).forEach((row) => {
                const computed_status = computeContentStatus(row);
                if (computed_status !== "active") return;
                const store = storeById.get(row.store_id);
                const mediaList = parseMediaUrls(row.media_urls);
                const mergedMedia = row.media_url ? [row.media_url, ...mediaList] : mediaList;
                contentItems.push({
                    type: "post",
                    id: row.id,
                    store_id: row.store_id,
                    store_name: store?.name || "Store",
                    store_category: store?.category || "",
                    store_profile_image_url: store?.profile_image_url || null,
                    distance_miles: store?.distance_miles ?? null,
                    post_type: row.post_type,
                    caption: row.caption,
                    media_urls: Array.from(new Set(mergedMedia.filter(Boolean))),
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    computed_status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                });
            });
        }

        // liked_by_me mapping
        const likedSet = new Set();
        const idsByType = contentItems.reduce((acc, item) => {
            acc[item.type] = acc[item.type] || [];
            acc[item.type].push(item.id);
            return acc;
        }, {});
        for (const [type, ids] of Object.entries(idsByType)) {
            if (!ids.length) continue;
            const idPlaceholders = ids.map(() => "?").join(",");
            const rows = await dbAllAsync(
                `SELECT content_id FROM store_content_likes WHERE user_id = ? AND content_type = ? AND content_id IN (${idPlaceholders})`,
                [userId, type, ...ids]
            );
            (rows || []).forEach((row) => likedSet.add(`${type}-${row.content_id}`));
        }

        const sorted = contentItems
            .map((item) => ({
                ...item,
                liked_by_me: likedSet.has(`${item.type}-${item.id}`),
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, limit);

        res.json({ content: sorted });
    } catch (e) {
        res.status(500).json({ error: "Failed to load feed" });
    }
});

// Get user notifications
app.get("/api/users/notifications", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const unreadOnly = req.query.unread === "true";
        const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));

        let query = `
            SELECT n.id, n.store_id, n.type, n.title, n.message, n.content_id, n.content_type, n.is_read, n.created_at,
                   s.name as store_name, s.category as store_category, s.profile_image_url as store_profile_image_url
            FROM notifications n
            LEFT JOIN stores s ON n.store_id = s.id
            WHERE n.user_id = ?
        `;
        const params = [userId];

        if (unreadOnly) {
            query += " AND n.is_read = 0";
        }

        query += " ORDER BY n.created_at DESC LIMIT ?";
        params.push(limit);

        const notifications = await dbAllAsync(query, params);

        // Get unread count
        const unreadCount = await dbGetAsync(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
            [userId]
        );

        res.json({
            notifications: notifications || [],
            unread_count: unreadCount?.count || 0,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load notifications" });
    }
});

// Get user's store requests (to check which stores they've already requested)
app.get("/api/users/store-requests", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const rows = await dbAllAsync(
            `SELECT id, requested_store_ref, requested_store_name, status, created_at
             FROM store_onboarding_requests
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        const requestedStores = (rows || []).map((row) => ({
            id: row.id,
            store_ref: row.requested_store_ref,
            store_name: row.requested_store_name,
            status: row.status,
            requested_at: row.created_at,
        }));

        res.json({
            success: true,
            requestedStores,
        });
    } catch (e) {
        console.error("Error fetching user store requests:", e.message);
        res.status(500).json({ error: "Failed to fetch store requests" });
    }
});

// Request limits
const MAX_REQUESTS_PER_USER = 10; // Maximum store requests per customer
const MAX_REQUESTS_PER_STORE = 2; // Maximum requests per store (for testing, later will be 50)

// Submit store request (customer wants a store to join CityCircle)
app.post("/api/users/store-requests", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            storeName = "",
            store_name = "", // Also accept snake_case
            storeRef = null,
            store_ref = null, // Also accept snake_case
            note = "",
            category = "",
            address = "",
        } = req.body || {};

        // Accept both camelCase and snake_case
        const storeNameValue = storeName || store_name;
        const storeRefValue = storeRef || store_ref;

        const cleanName = String(storeNameValue || "").trim();
        if (!cleanName || cleanName.length < 2) {
            return res.status(400).json({ error: "Store name is required" });
        }

        const cleanRef = String(storeRefValue || "").trim() || null;

        // Check if this store is already a partner store (on CityCircle) - cannot request stores that are already signed up
        if (cleanRef) {
            const existingPartnerStore = await dbGetAsync(
                `SELECT s.id, s.claimed_at, s.qr_code,
                        (SELECT COUNT(*) FROM check_in_sessions WHERE store_id = s.id AND status = 'completed') AS check_in_count,
                        (SELECT COUNT(*) FROM transactions WHERE store_id = s.id) AS transaction_count
                 FROM stores s
                 WHERE s.place_id = ?`,
                [cleanRef]
            );
            if (existingPartnerStore) {
                const isClaimed = !!(existingPartnerStore.claimed_at || existingPartnerStore.qr_code);
                const hasCustomerActivity = !!(existingPartnerStore.check_in_count > 0 || existingPartnerStore.transaction_count > 0);
                const isPartnerStore = !!(existingPartnerStore.id && (isClaimed || hasCustomerActivity));
                if (isPartnerStore) {
                    return res.status(400).json({
                        success: false,
                        error: "This store is already on CityCircle. You can join it instead of requesting it.",
                    });
                }
            }
        }

        // Also check by store name (normalized) if no place_id
        if (!cleanRef) {
            const normalizedName = cleanName.toLowerCase().trim();
            const existingPartnerStoreByName = await dbGetAsync(
                `SELECT s.id, s.claimed_at, s.qr_code,
                        (SELECT COUNT(*) FROM check_in_sessions WHERE store_id = s.id AND status = 'completed') AS check_in_count,
                        (SELECT COUNT(*) FROM transactions WHERE store_id = s.id) AS transaction_count
                 FROM stores s
                 WHERE lower(trim(s.name)) = ?`,
                [normalizedName]
            );
            if (existingPartnerStoreByName) {
                const isClaimed = !!(existingPartnerStoreByName.claimed_at || existingPartnerStoreByName.qr_code);
                const hasCustomerActivity = !!(existingPartnerStoreByName.check_in_count > 0 || existingPartnerStoreByName.transaction_count > 0);
                const isPartnerStore = !!(existingPartnerStoreByName.id && (isClaimed || hasCustomerActivity));
                if (isPartnerStore) {
                    return res.status(400).json({
                        success: false,
                        error: "This store is already on CityCircle. You can join it instead of requesting it.",
                    });
                }
            }
        }
        const cleanCategory = String(category || "").trim();
        const cleanAddress = String(address || "").trim();
        const rawNote = String(note || "").trim();
        const metaNote = [
            cleanCategory ? `category:${cleanCategory}` : null,
            cleanAddress ? `address:${cleanAddress}` : null,
            rawNote ? `note:${rawNote}` : null,
        ]
            .filter(Boolean)
            .join(" | ");
        const finalNote = metaNote.slice(0, 1000);

        // Check user's total request count (max 10 requests per user)
        const userRequestCount = await dbGetAsync(
            `SELECT COUNT(*) as count
             FROM store_onboarding_requests
             WHERE user_id = ?`,
            [userId]
        );
        if (userRequestCount && userRequestCount.count >= MAX_REQUESTS_PER_USER) {
            return res.status(400).json({
                success: false,
                error: `You've reached the maximum limit of ${MAX_REQUESTS_PER_USER} store requests.`,
            });
        }

        // Check if this store has reached max requests (2 for testing)
        const dedupeName = cleanName.toLowerCase().trim();
        const storeRequestCount = await dbGetAsync(
            `SELECT COUNT(*) as count
             FROM store_onboarding_requests
             WHERE (
                 lower(trim(requested_store_name)) = ?
                 OR (? IS NOT NULL AND requested_store_ref = ?)
             )
             AND status = 'pending'`,
            [dedupeName, cleanRef, cleanRef]
        );
        if (storeRequestCount && storeRequestCount.count >= MAX_REQUESTS_PER_STORE) {
            return res.status(400).json({
                success: false,
                error: `This store has reached the maximum number of requests (${MAX_REQUESTS_PER_STORE}). We'll contact them soon!`,
            });
        }

        // Check if user has already requested this exact store (by name or place_id) - one request per store per user forever
        // Also check for recent submissions (within last 5 minutes) to prevent rapid duplicate submissions
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        // First check: exact match by name or ref
        const existing = await dbGetAsync(
            `SELECT id, created_at
             FROM store_onboarding_requests
             WHERE user_id = ?
               AND (
                 lower(trim(requested_store_name)) = ?
                 OR (? IS NOT NULL AND requested_store_ref = ?)
               )
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId, dedupeName, cleanRef, cleanRef]
        );
        if (existing) {
            return res.json({
                success: true,
                duplicate: true,
                message: "You already requested this store. Thanks! We'll contact them soon.",
            });
        }

        // Second check: prevent rapid duplicate submissions (same user, similar name, within 5 minutes)
        const recentDuplicate = await dbGetAsync(
            `SELECT id, created_at
             FROM store_onboarding_requests
             WHERE user_id = ?
               AND created_at >= ?
               AND (
                 lower(trim(requested_store_name)) LIKE ? || '%'
                 OR lower(trim(requested_store_name)) LIKE '%' || ?
                 OR (? IS NOT NULL AND requested_store_ref = ?)
               )
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId, fiveMinutesAgo, dedupeName, dedupeName, cleanRef, cleanRef]
        );
        if (recentDuplicate) {
            return res.json({
                success: true,
                duplicate: true,
                message: "Please wait a few minutes before submitting another request for this store.",
            });
        }

        // Insert with error handling for unique constraint violations (race condition protection)
        let inserted;
        try {
            inserted = await dbRunAsync(
                `INSERT INTO store_onboarding_requests
                 (user_id, requested_store_ref, requested_store_name, note, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [userId, cleanRef, cleanName, finalNote || null]
            );
        } catch (insertErr) {
            // Handle unique constraint violation (race condition)
            if (String(insertErr.message || "").includes("UNIQUE constraint") || 
                String(insertErr.message || "").includes("duplicate")) {
                return res.json({
                    success: true,
                    duplicate: true,
                    message: "You already requested this store. Thanks! We'll contact them soon.",
                });
            }
            throw insertErr; // Re-throw if it's a different error
        }

        // Emit admin notification if socket.io is available
        if (typeof io !== 'undefined' && io) {
            try {
                io.emit("admin-store-request", {
                    type: "store-request",
                    requestId: inserted.lastID,
                    userId,
                    storeName: cleanName,
                    storeRef: cleanRef,
                    createdAt: new Date().toISOString(),
                });
            } catch (socketErr) {
                // Non-critical: socket notification failed, but request was saved
                console.warn("Failed to emit admin-store-request notification:", socketErr.message);
            }
        }
        recordAnalyticsEvent({ event_type: "store_request", actor_type: "user", actor_id: userId, payload: { store_name: cleanName, store_ref: cleanRef } }, req);
        sendAdminNotificationEmail("new_store_request", "New store request", `<p>A customer requested a store.</p><p><strong>Store:</strong> ${cleanName}</p><p>Ref: ${cleanRef || "—"}</p><p>User ID: ${userId}</p>`);

        res.json({
            success: true,
            requestId: inserted.lastID,
            message: "Thanks! We recorded your request for this store.",
        });
    } catch (e) {
        console.error("Store request submission error:", e.message, e.stack);
        if (String(e.message || "").includes("no such table: store_onboarding_requests")) {
            return res.status(503).json({ error: "Missing store request table. Please run schema migration." });
        }
        res.status(500).json({ error: "Failed to submit store request: " + (e.message || "Unknown error") });
    }
});

// Report missing reward (customer expected reward but didn't get it)
app.post("/api/users/missing-reward-reports", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { store_id, store_name, store_address, visit_date, visit_time, note, receipt_url } = req.body || {};

        const cleanStoreName = String(store_name || "").trim();
        if (!cleanStoreName) {
            return res.status(400).json({ error: "Store name is required" });
        }

        const storeIdNum = store_id ? Number(store_id) : null;
        if (storeIdNum !== null && (!Number.isFinite(storeIdNum) || storeIdNum <= 0)) {
            return res.status(400).json({ error: "Invalid store_id" });
        }

        // Check for duplicate report from same user for same store within 7 days
        if (storeIdNum) {
            const recent = await dbGetAsync(
                `SELECT id FROM missing_reward_reports 
                 WHERE user_id = ? AND store_id = ? 
                   AND created_at >= datetime('now', '-7 days')
                 LIMIT 1`,
                [userId, storeIdNum]
            );
            if (recent) {
                return res.status(400).json({ error: "You already reported this issue recently. We'll review it soon." });
            }
        }

        const inserted = await dbRunAsync(
            `INSERT INTO missing_reward_reports 
             (user_id, store_id, store_name, store_address, visit_date, visit_time, note, receipt_url, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                userId,
                storeIdNum,
                cleanStoreName,
                String(store_address || "").trim() || null,
                visit_date || null,
                visit_time || null,
                String(note || "").trim() || null,
                String(receipt_url || "").trim() || null,
            ]
        );

        // Emit admin notification
        if (io) {
            io.emit("admin-missing-reward-report", {
                reportId: inserted.lastID,
                userId,
                storeId: storeIdNum,
                storeName: cleanStoreName,
                createdAt: new Date().toISOString(),
            });
        }

        res.json({
            success: true,
            reportId: inserted.lastID,
            message: "Thanks for reporting! We'll investigate and get back to you.",
        });
    } catch (e) {
        if (String(e.message || "").includes("no such table: missing_reward_reports")) {
            return res.status(503).json({ error: "Missing reward reports table. Please run add-missing-reward-reports.js migration." });
        }
        res.status(500).json({ error: "Failed to submit missing reward report" });
    }
});

// Mark notification as read
app.post("/api/users/notifications/:id/read", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = Number(req.params.id);

        await dbRunAsync(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            [notificationId, userId]
        );

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
});

// Mark all notifications as read
app.post("/api/users/notifications/read-all", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;

        await dbRunAsync(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
            [userId]
        );

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
});

// Get notification preferences
app.get("/api/users/notification-preferences", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;

        const prefs = await dbGetAsync(
            `SELECT promotions_enabled, updates_enabled, sms_enabled, email_enabled
             FROM notification_preferences
             WHERE user_id = ?`,
            [userId]
        );

        // Return defaults if no preferences exist
        res.json({
            promotions_enabled: prefs ? prefs.promotions_enabled !== 0 : true,
            updates_enabled: prefs ? prefs.updates_enabled !== 0 : true,
            sms_enabled: prefs ? prefs.sms_enabled === 1 : false,
            email_enabled: prefs ? prefs.email_enabled === 1 : false,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load notification preferences" });
    }
});

// Update notification preferences
app.post("/api/users/notification-preferences", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { promotions_enabled, updates_enabled, sms_enabled, email_enabled } = req.body || {};

        await dbRunAsync(
            `INSERT INTO notification_preferences (user_id, promotions_enabled, updates_enabled, sms_enabled, email_enabled)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                 promotions_enabled = excluded.promotions_enabled,
                 updates_enabled = excluded.updates_enabled,
                 sms_enabled = excluded.sms_enabled,
                 email_enabled = excluded.email_enabled`,
            [
                userId,
                promotions_enabled !== false ? 1 : 0,
                updates_enabled !== false ? 1 : 0,
                sms_enabled === true ? 1 : 0,
                email_enabled === true ? 1 : 0,
            ]
        );

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to update notification preferences" });
    }
});

// Get content details by type and ID (for notification details)
app.get("/api/users/content/:type/:id", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const contentType = String(req.params.type).toLowerCase();
        const contentId = Number(req.params.id);
        
        if (!["promotion", "update"].includes(contentType)) {
            return res.status(400).json({ error: "Invalid content type" });
        }
        
        let content = null;
        if (contentType === "promotion") {
            const row = await dbGetAsync(
                `SELECT id, store_id, title, description, media_urls, discount_type, discount_value, start_at, end_at, status, like_count, created_at
                 FROM store_promotions WHERE id = ?`,
                [contentId]
            );
            if (row) {
                const store = await dbGetAsync("SELECT name, category, profile_image_url FROM stores WHERE id = ?", [row.store_id]);
                content = {
                    type: "promotion",
                    id: row.id,
                    store_id: row.store_id,
                    store_name: store?.name || null,
                    store_category: store?.category || null,
                    store_profile_image_url: store?.profile_image_url || null,
                    title: row.title,
                    description: row.description,
                    media_urls: parseMediaUrls(row.media_urls),
                    discount_type: row.discount_type,
                    discount_value: row.discount_value,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                };
            }
        } else if (contentType === "update") {
            const row = await dbGetAsync(
                `SELECT id, store_id, title, body, media_urls, pinned, start_at, end_at, status, like_count, created_at
                 FROM store_updates WHERE id = ?`,
                [contentId]
            );
            if (row) {
                const store = await dbGetAsync("SELECT name, category, profile_image_url FROM stores WHERE id = ?", [row.store_id]);
                content = {
                    type: "update",
                    id: row.id,
                    store_id: row.store_id,
                    store_name: store?.name || null,
                    store_category: store?.category || null,
                    store_profile_image_url: store?.profile_image_url || null,
                    title: row.title,
                    body: row.body,
                    media_urls: parseMediaUrls(row.media_urls),
                    pinned: row.pinned,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    status: row.status,
                    like_count: row.like_count || 0,
                    created_at: row.created_at,
                };
            }
        }
        
        if (!content) {
            return res.status(404).json({ error: "Content not found" });
        }
        
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: "Failed to load content details" });
    }
});

app.get("/api/users/stores/:id/profile", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const storeId = Number(req.params.id);
        if (!storeId) return res.status(400).json({ error: "Invalid store id" });

        const store = await dbGetAsync(
            "SELECT id, name, category, address, opened_month, opened_year, latitude, longitude, profile_image_url FROM stores WHERE id = ?",
            [storeId]
        );
        if (!store) return res.status(404).json({ error: "Store not found" });

        const user = await dbGetAsync(
            "SELECT latitude, longitude FROM users WHERE id = ?",
            [userId]
        );
        const distance_miles =
            user?.latitude && user?.longitude && store.latitude && store.longitude
                ? haversineMiles(user.latitude, user.longitude, store.latitude, store.longitude)
                : null;

        const membershipRow = await dbGetAsync(
            "SELECT COUNT(DISTINCT user_id) AS total_members FROM store_memberships WHERE store_id = ? AND status = 'active'",
            [storeId]
        );
        const loopsRow = await dbGetAsync(
            "SELECT COALESCE(SUM(loops_earned), 0) AS total_loops_given FROM transactions WHERE store_id = ?",
            [storeId]
        );
        const totalLoopsGiven = Number(loopsRow?.total_loops_given || 0);

        const storeIds = [storeId];
        const contentItems = [];

        await refreshContentStatuses("store_promotions", storeIds);
        const promoRows = await dbAllAsync(
            "SELECT id, store_id, title, description, media_urls, discount_type, discount_value, start_at, end_at, status, like_count, created_at FROM store_promotions WHERE store_id = ?",
            [storeId]
        );
        (promoRows || []).forEach((row) => {
            const computed_status = computeContentStatus(row);
            if (computed_status !== "active") return;
            contentItems.push({
                type: "promotion",
                id: row.id,
                store_id: row.store_id,
                store_name: store.name,
                store_category: store.category,
                distance_miles,
                title: row.title,
                description: row.description,
                media_urls: parseMediaUrls(row.media_urls),
                discount_type: row.discount_type,
                discount_value: row.discount_value,
                start_at: row.start_at,
                end_at: row.end_at,
                status: row.status,
                computed_status,
                like_count: row.like_count || 0,
                created_at: row.created_at,
            });
        });

        await refreshContentStatuses("store_updates", storeIds);
        const updateRows = await dbAllAsync(
            "SELECT id, store_id, title, body, media_urls, pinned, start_at, end_at, status, like_count, created_at FROM store_updates WHERE store_id = ?",
            [storeId]
        );
        (updateRows || []).forEach((row) => {
            const computed_status = computeContentStatus(row);
            if (computed_status !== "active") return;
            contentItems.push({
                type: "update",
                id: row.id,
                store_id: row.store_id,
                store_name: store.name,
                store_category: store.category,
                distance_miles,
                title: row.title,
                body: row.body,
                media_urls: parseMediaUrls(row.media_urls),
                pinned: row.pinned,
                start_at: row.start_at,
                end_at: row.end_at,
                status: row.status,
                computed_status,
                like_count: row.like_count || 0,
                created_at: row.created_at,
            });
        });

        await refreshContentStatuses("store_posts", storeIds);
        const postRows = await dbAllAsync(
            "SELECT id, store_id, post_type, caption, media_url, media_urls, start_at, end_at, status, like_count, created_at FROM store_posts WHERE store_id = ?",
            [storeId]
        );
        (postRows || []).forEach((row) => {
            const computed_status = computeContentStatus(row);
            if (computed_status !== "active") return;
            const mediaList = parseMediaUrls(row.media_urls);
            const mergedMedia = row.media_url ? [row.media_url, ...mediaList] : mediaList;
            contentItems.push({
                type: "post",
                id: row.id,
                store_id: row.store_id,
                store_name: store.name,
                store_category: store.category,
                distance_miles,
                post_type: row.post_type,
                caption: row.caption,
                media_urls: Array.from(new Set(mergedMedia.filter(Boolean))),
                start_at: row.start_at,
                end_at: row.end_at,
                status: row.status,
                computed_status,
                like_count: row.like_count || 0,
                created_at: row.created_at,
            });
        });

        const likedSet = new Set();
        const idsByType = contentItems.reduce((acc, item) => {
            acc[item.type] = acc[item.type] || [];
            acc[item.type].push(item.id);
            return acc;
        }, {});
        for (const [type, ids] of Object.entries(idsByType)) {
            if (!ids.length) continue;
            const idPlaceholders = ids.map(() => "?").join(",");
            const rows = await dbAllAsync(
                `SELECT content_id FROM store_content_likes WHERE user_id = ? AND content_type = ? AND content_id IN (${idPlaceholders})`,
                [userId, type, ...ids]
            );
            (rows || []).forEach((row) => likedSet.add(`${type}-${row.content_id}`));
        }

        const sorted = contentItems
            .map((item) => ({
                ...item,
                liked_by_me: likedSet.has(`${item.type}-${item.id}`),
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({
            store: {
                ...store,
                distance_miles,
                total_members: membershipRow?.total_members || 0,
                total_loops_given: totalLoopsGiven,
            },
            content: sorted,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to load store profile" });
    }
});

app.get("/api/categories", async (req, res) => {
    try {
        const profileRows = await dbAllAsync("SELECT category FROM category_profiles");
        const storeRows = await dbAllAsync(
            "SELECT DISTINCT category FROM stores WHERE category IS NOT NULL AND TRIM(category) != ''"
        );
        const categories = new Set();
        (profileRows || []).forEach((row) => categories.add(String(row.category || "").trim()));
        (storeRows || []).forEach((row) => categories.add(String(row.category || "").trim()));
        const list = Array.from(categories).filter(Boolean).sort((a, b) => a.localeCompare(b));
        res.json({ categories: list });
    } catch (e) {
        res.status(500).json({ error: "Failed to load categories" });
    }
});

app.post("/api/stores/content/:type/:id/archive", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const type = normalizeContentType(req.params.type);
        const contentId = Number(req.params.id);
        const table = contentTableForType(type);
        if (!type || !table || !contentId) {
            return res.status(400).json({ error: "Invalid content type or id" });
        }
        await dbRunAsync(
            `UPDATE ${table} SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND id = ?`,
            [storeId, contentId]
        );
        res.json({ success: true });
    } catch (e) {
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing status column. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to archive content" });
    }
});

app.post("/api/stores/content/:type/:id/unarchive", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const type = normalizeContentType(req.params.type);
        const contentId = Number(req.params.id);
        const table = contentTableForType(type);
        if (!type || !table || !contentId) {
            return res.status(400).json({ error: "Invalid content type or id" });
        }
        await dbRunAsync(
            `UPDATE ${table} SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND id = ?`,
            [storeId, contentId]
        );
        res.json({ success: true });
    } catch (e) {
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing status column. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to unarchive content" });
    }
});

app.post("/api/content/:type/:id/like", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const type = normalizeContentType(req.params.type);
        const contentId = Number(req.params.id);
        const table = contentTableForType(type);
        if (!type || !table || !contentId) {
            return res.status(400).json({ error: "Invalid content type or id" });
        }
        const content = await dbGetAsync(
            `SELECT id, store_id, like_count FROM ${table} WHERE id = ?`,
            [contentId]
        );
        if (!content) return res.status(404).json({ error: "Content not found" });

        try {
            await dbRunAsync(
                `INSERT INTO store_content_likes (store_id, user_id, content_type, content_id)
                 VALUES (?, ?, ?, ?)`,
                [content.store_id, userId, type, contentId]
            );
            await dbRunAsync(
                `UPDATE ${table} SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ?`,
                [contentId]
            );
        } catch (e) {
            if (String(e.message || "").includes("SQLITE_CONSTRAINT")) {
                return res.json({ liked: true, like_count: content.like_count || 0 });
            }
            throw e;
        }

        const updated = await dbGetAsync(
            `SELECT like_count FROM ${table} WHERE id = ?`,
            [contentId]
        );
        res.json({ liked: true, like_count: updated?.like_count || 0 });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_content_likes")) {
            return res.status(503).json({ error: "Missing store_content_likes table. Run add-store-content-likes.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing like_count column. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to like content" });
    }
});

app.delete("/api/content/:type/:id/like", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const type = normalizeContentType(req.params.type);
        const contentId = Number(req.params.id);
        const table = contentTableForType(type);
        if (!type || !table || !contentId) {
            return res.status(400).json({ error: "Invalid content type or id" });
        }
        const content = await dbGetAsync(
            `SELECT id, store_id, like_count FROM ${table} WHERE id = ?`,
            [contentId]
        );
        if (!content) return res.status(404).json({ error: "Content not found" });

        const result = await dbRunAsync(
            `DELETE FROM store_content_likes WHERE user_id = ? AND content_type = ? AND content_id = ?`,
            [userId, type, contentId]
        );
        if (result?.changes) {
            await dbRunAsync(
                `UPDATE ${table} SET like_count = MAX(COALESCE(like_count, 0) - 1, 0) WHERE id = ?`,
                [contentId]
            );
        }
        const updated = await dbGetAsync(
            `SELECT like_count FROM ${table} WHERE id = ?`,
            [contentId]
        );
        res.json({ liked: false, like_count: updated?.like_count || 0 });
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_content_likes")) {
            return res.status(503).json({ error: "Missing store_content_likes table. Run add-store-content-likes.js" });
        }
        if (String(e.message || "").includes("no such column")) {
            return res.status(503).json({ error: "Missing like_count column. Run add-store-content-meta.js" });
        }
        res.status(500).json({ error: "Failed to unlike content" });
    }
});

app.put("/api/stores/profile", authStore, async (req, res) => {
    const storeId = req.storeId;
    const { opened_month, opened_year, profile_image_url } = req.body || {};

    const monthVal = opened_month === undefined || opened_month === null
        ? null
        : Number(opened_month);
    const yearVal = opened_year === undefined || opened_year === null
        ? null
        : Number(opened_year);

    if (monthVal !== null && (Number.isNaN(monthVal) || monthVal < 1 || monthVal > 12)) {
        return res.status(400).json({ error: "Opened month must be 1-12" });
    }
    if (yearVal !== null && (Number.isNaN(yearVal) || yearVal < 1900 || yearVal > 2100)) {
        return res.status(400).json({ error: "Opened year is invalid" });
    }

    try {
        await dbRunAsync(
            "UPDATE stores SET opened_month = ?, opened_year = ?, profile_image_url = COALESCE(?, profile_image_url) WHERE id = ?",
            [monthVal, yearVal, profile_image_url || null, storeId]
        );
        const updated = await dbGetAsync(
            "SELECT opened_month, opened_year, profile_image_url FROM stores WHERE id = ?",
            [storeId]
        );
        res.json({
            success: true,
            opened_month: updated?.opened_month ?? monthVal,
            opened_year: updated?.opened_year ?? yearVal,
            profile_image_url: updated?.profile_image_url ?? profile_image_url ?? null,
        });
    } catch (e) {
        if (String(e.message || "").includes("no such column: opened_month")) {
            return res.status(503).json({ error: "Missing opened fields. Run add-store-opened-fields.js" });
        }
        if (String(e.message || "").includes("no such column: profile_image_url")) {
            return res.status(503).json({ error: "Missing store profile image column. Run add-store-profile-image.js" });
        }
        res.status(500).json({ error: "Failed to update store profile" });
    }
});


// ---------- store lookup customer ----------

app.get("/api/stores/customer/:userId", auth("store"), (req, res) => {
    const userId = req.params.userId;
    const storeId = req.storeId;
    (async () => {
        const snapshot = await getStoreSubscriptionSnapshot(storeId);
        if (!canViewStoreCustomerIdentity(snapshot)) {
            return res.status(403).json({
                error: "Upgrade required to view customer profile details.",
                access: getCustomerIdentityAccessMeta(snapshot),
            });
        }
        db.get(
            "SELECT id, name, loops_balance, total_loops_earned, plan, primary_zone, secondary_zone FROM users WHERE id = ?",
            [userId],
            (err, row) => {
                if (err || !row) return res.status(404).json({ error: "Customer not found" });

                const tier = getTierProgress(row.total_loops_earned || 0).currentTier;
                res.json({ ...row, tier, access: getCustomerIdentityAccessMeta(snapshot) });
            }
        );
    })().catch(() => {
        res.status(500).json({ error: "Failed to load customer profile" });
    });
});

// Store: list today's customers (based on check-ins, not transactions)
app.get("/api/stores/customers-today", authStore, async (req, res) => {
    const storeId = req.storeId;
    try {
        const snapshot = await getStoreSubscriptionSnapshot(storeId);
        const access = getCustomerIdentityAccessMeta(snapshot);
        const canView = access.can_view_customer_identity;
        const rows = await dbAllAsync(
            `
            SELECT
              pp.id,
              pp.created_at AS timestamp,
              pp.loops_pending AS loops_earned,
              u.id AS user_id,
              u.name AS user_name,
              u.phone AS user_phone,
              u.email AS user_email,
              (SELECT COUNT(*) FROM check_in_sessions WHERE user_id = u.id AND store_id = ? AND status = 'completed') AS visit_count
            FROM pending_points pp
            JOIN users u ON u.id = pp.user_id
            WHERE pp.store_id = ? AND date(pp.created_at) = date('now','localtime')
            ORDER BY pp.created_at DESC
            `,
            [storeId, storeId]
        );
        const customers = (rows || []).map((r) => ({
            id: r.id,
            timestamp: r.timestamp,
            loops_earned: r.loops_earned,
            user_id: canView ? r.user_id : null,
            user_name: canView ? r.user_name : maskCustomerName(r.user_name),
            user_phone: canView ? r.user_phone : maskCustomerPhone(r.user_phone),
            user_email: canView ? r.user_email : "hidden@upgrade-required",
            visit_count: r.visit_count,
            is_masked: !canView,
        }));
        res.json({ customers, access });
    } catch (e) {
        res.status(500).json({ error: "DB error" });
    }
});

// ---------- Store Customer Blacklist Management ----------

// Get all blacklisted customers for a store
app.get("/api/stores/blacklist", authStore, (req, res) => {
    if (!BLACKLIST_ENABLED) {
        // Soft-disable: Store Portal expects this endpoint; return empty list to avoid UI errors.
        return res.json({ blacklisted: [], disabled: true });
    }
    const storeId = req.storeId;
    
    db.all(
        `SELECT 
            b.id,
            b.user_id,
            b.reason,
            b.created_at,
            u.name as user_name,
            u.phone as user_phone,
            u.email as user_email,
            u.plan
         FROM store_customer_blacklist b
         JOIN users u ON b.user_id = u.id
         WHERE b.store_id = ?
         ORDER BY b.created_at DESC`,
        [storeId],
        (err, blacklisted) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ blacklisted: blacklisted || [] });
        }
    );
});

// Store: list members (customers who joined/paid this store)
app.get("/api/stores/members", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const cycleMonth = String(req.query.cycleMonth || getCycleMonth());
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || "200")));
        const snapshot = await getStoreSubscriptionSnapshot(storeId);
        const access = getCustomerIdentityAccessMeta(snapshot);
        const canView = access.can_view_customer_identity;

        const rows = await dbAllAsync(
            `SELECT 
                sm.user_id,
                u.name as user_name,
                u.phone as user_phone,
                u.plan as user_plan,
                sm.join_method,
                sm.paid_cents,
                sm.joined_at,
                sm.cycle_month
             FROM store_memberships sm
             JOIN users u ON u.id = sm.user_id
             WHERE sm.store_id = ?
               AND sm.cycle_month = ?
               AND sm.status = 'active'
             ORDER BY sm.joined_at DESC
             LIMIT ?`,
            [storeId, cycleMonth, limit]
        );

        res.json({
            storeId,
            cycleMonth,
            count: rows.length,
            access,
            members: rows.map((r) => ({
                user_id: canView ? r.user_id : null,
                name: canView ? r.user_name : maskCustomerName(r.user_name),
                phone: canView ? r.user_phone : maskCustomerPhone(r.user_phone),
                plan: r.user_plan,
                join_method: r.join_method,
                paid_cents: r.paid_cents,
                joined_at: r.joined_at,
                is_masked: !canView,
            })),
        });
    } catch (e) {
        // Soft-fail if migration hasn't been run yet
        const msg = String(e?.message || "");
        if (msg.includes("no such table: store_memberships")) {
            const snapshot = await getStoreSubscriptionSnapshot(req.storeId).catch(() => null);
            return res.json({
                storeId: req.storeId,
                cycleMonth: String(req.query.cycleMonth || getCycleMonth()),
                count: 0,
                members: [],
                access: getCustomerIdentityAccessMeta(snapshot),
                missingTable: "store_memberships",
            });
        }
        res.status(500).json({ error: "Failed to load members" });
    }
});

app.post("/api/stores/members/:userId/promo", authStore, async (req, res) => {
    try {
        const storeId = req.storeId;
        const userId = Number(req.params.userId);
        if (!userId) return res.status(400).json({ error: "Invalid user ID" });

        const snapshot = await getStoreSubscriptionSnapshot(storeId);
        const access = getCustomerIdentityAccessMeta(snapshot);
        if (!access.can_view_customer_identity) {
            return res.status(403).json({
                error: "Upgrade required to send direct promotions.",
                access,
            });
        }

        const title = String(req.body?.title || "").trim();
        const message = String(req.body?.message || "").trim();
        if (!title || !message) {
            return res.status(400).json({ error: "Title and message are required." });
        }
        if (title.length > 120) {
            return res.status(400).json({ error: "Title is too long (max 120 chars)." });
        }
        if (message.length > 500) {
            return res.status(400).json({ error: "Message is too long (max 500 chars)." });
        }

        const member = await dbGetAsync(
            `SELECT sm.user_id, u.phone, u.email, u.name
             FROM store_memberships sm
             JOIN users u ON u.id = sm.user_id
             WHERE sm.store_id = ? AND sm.user_id = ? AND sm.status = 'active'
             LIMIT 1`,
            [storeId, userId]
        );
        if (!member) {
            return res.status(404).json({ error: "Member not found for this store." });
        }

        const store = await dbGetAsync("SELECT name FROM stores WHERE id = ?", [storeId]).catch(() => null);
        const safeStoreName = store?.name || "A local store";
        const fullTitle = `[${safeStoreName}] ${title}`;
        const fullMessage = message;

        let inAppCreated = false;
        let smsSent = false;
        let smsError = "";

        await dbRunAsync(
            `INSERT INTO notifications
             (user_id, store_id, type, title, message, content_id, content_type, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, CURRENT_TIMESTAMP)`,
            [userId, storeId, "direct_promo", fullTitle, fullMessage]
        );
        inAppCreated = true;

        const smsEnabled = process.env.STORE_DIRECT_PROMO_SMS_ENABLED === "1";
        if (smsEnabled && member.phone) {
            try {
                await sendSMS(member.phone, `${fullTitle}\n${fullMessage}`);
                smsSent = true;
            } catch (e) {
                smsError = e.message || "SMS failed";
            }
        }

        res.json({
            success: true,
            in_app_notification_sent: inAppCreated,
            sms_sent: smsSent,
            sms_error: smsError || null,
            access,
            message: smsSent
                ? "Promotion sent via in-app notification and SMS."
                : "Promotion sent via in-app notification.",
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to send direct promotion" });
    }
});

// Add a customer to blacklist
app.post("/api/stores/blacklist", authStore, (req, res) => {
    if (!BLACKLIST_ENABLED) {
        return res.status(503).json({ error: "Blacklist feature temporarily disabled" });
    }
    const storeId = req.storeId;
    const { userId, reason } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }
    
    // Check if user exists
    db.get("SELECT id FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if already blacklisted
        db.get("SELECT id FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?", [storeId, userId], (err2, existing) => {
            if (err2) {
                return res.status(500).json({ error: "Database error" });
            }
            if (existing) {
                return res.status(400).json({ error: "Customer is already blacklisted" });
            }
            
            // Add to blacklist
            db.run(
                "INSERT INTO store_customer_blacklist (store_id, user_id, reason, blocked_by_store_id) VALUES (?, ?, ?, ?)",
                [storeId, userId, reason || null, storeId],
                function(err3) {
                    if (err3) {
                        return res.status(500).json({ error: "Database error" });
                    }
                    
                    // Get the full blacklist entry with user details
                    db.get(
                        `SELECT 
                            b.id,
                            b.user_id,
                            b.reason,
                            b.created_at,
                            u.name as user_name,
                            u.phone as user_phone,
                            u.email as user_email,
                            u.plan
                         FROM store_customer_blacklist b
                         JOIN users u ON b.user_id = u.id
                         WHERE b.id = ?`,
                        [this.lastID],
                        (err4, entry) => {
                            if (err4) {
                                return res.status(500).json({ error: "Database error" });
                            }
                            res.json({ blacklisted: entry });
                        }
                    );
                }
            );
        });
    });
});

// Store password reset via SMS
app.post("/api/stores/forgot-password", (req, res) => {
    const { phone } = req.body;
    if (!phone || !validatePhone(phone)) {
        return res.status(400).json({ error: "Valid phone number is required" });
    }
    const cleanedPhone = phone.replace(/\D/g, "");
    db.get("SELECT id, phone FROM stores WHERE phone = ?", [cleanedPhone], (err, store) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (!store) {
            return res.json({ success: true, message: "If the account exists, a reset code was sent." });
        }
        const code = generateResetCode();
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();
        db.serialize(() => {
            db.run(
                "DELETE FROM password_reset_tokens WHERE user_type = ? AND user_id = ?",
                ["store", store.id],
                () => {
                    if (USE_VONAGE_VERIFY) {
                        startVonageVerify(formatSmsPhone(cleanedPhone))
                            .then((requestId) => {
                                db.run(
                                    "INSERT INTO password_reset_tokens (user_type, user_id, phone, code, request_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                                    ["store", store.id, cleanedPhone, code, requestId, expiresAt],
                                    (err2) => {
                                        if (err2) {
                                            return res.status(500).json({
                                                error: "Failed to create reset code",
                                                details: err2.message || String(err2)
                                            });
                                        }
                                        const payload = { success: true, message: "Verification code sent" };
                                        if (process.env.NODE_ENV !== "production") {
                                            payload.dev_code = code;
                                            payload.request_id = requestId;
                                        }
                                        res.json(payload);
                                    }
                                );
                            })
                            .catch((verifyErr) => {
                                if (process.env.NODE_ENV !== "production") {
                                    db.run(
                                        "INSERT INTO password_reset_tokens (user_type, user_id, phone, code, request_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                                        ["store", store.id, cleanedPhone, code, null, expiresAt],
                                        () => {
                                            return res.json({
                                                success: true,
                                                message: "Verify failed. Using dev code.",
                                                dev_code: code,
                                                verify_error: verifyErr?.message || String(verifyErr)
                                            });
                                        }
                                    );
                                    return;
                                }
                                res.status(500).json({
                                    error: "Failed to start verification",
                                    details: verifyErr?.message || String(verifyErr)
                                });
                            });
                        return;
                    }

                    db.run(
                        "INSERT INTO password_reset_tokens (user_type, user_id, phone, code, request_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                        ["store", store.id, cleanedPhone, code, null, expiresAt],
                        (err2) => {
                            if (err2) {
                                return res.status(500).json({
                                    error: "Failed to create reset code",
                                    details: err2.message || String(err2)
                                });
                            }
                            sendSMS(formatSmsPhone(cleanedPhone), `CityCircle store reset code: ${code}`)
                                .then((resp) => {
                                    const payload = { success: true, message: "Reset code sent via SMS" };
                                    if (process.env.NODE_ENV !== "production") {
                                        payload.dev_code = code;
                                        payload.sms_response = resp;
                                    }
                                    res.json(payload);
                                })
                                .catch((smsErr) => {
                                    if (process.env.NODE_ENV !== "production") {
                                        return res.json({
                                            success: true,
                                            message: "SMS failed. Using dev code.",
                                            dev_code: code,
                                            sms_error: smsErr?.message || String(smsErr)
                                        });
                                    }
                                    res.status(500).json({
                                        error: "Failed to send SMS",
                                        details: smsErr?.message || String(smsErr)
                                    });
                                });
                        }
                    );
                }
            );
        });
    });
});

app.post("/api/stores/reset-password", (req, res) => {
    const { phone, code, newPassword } = req.body;
    if (!phone || !validatePhone(phone)) {
        return res.status(400).json({ error: "Valid phone number is required" });
    }
    if (!code) {
        return res.status(400).json({ error: "Reset code is required" });
    }
    if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const cleanedPhone = phone.replace(/\D/g, "");
    db.get("SELECT id FROM stores WHERE phone = ?", [cleanedPhone], (err, store) => {
        if (err || !store) {
            return res.status(400).json({ error: "Invalid phone or reset code" });
        }
        db.get(
            "SELECT * FROM password_reset_tokens WHERE user_type = ? AND user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
            ["store", store.id],
            (err2, tokenRow) => {
                if (err2 || !tokenRow) {
                    return res.status(400).json({ error: "Invalid or expired reset code" });
                }
                if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
                    return res.status(400).json({ error: "Reset code has expired" });
                }
                const handlePasswordReset = () => {
                    bcrypt.hash(newPassword, 10).then((hash) => {
                        db.run(
                            "UPDATE stores SET password_hash = ? WHERE id = ?",
                            [hash, store.id],
                            (err3) => {
                                if (err3) {
                                    return res.status(500).json({ error: "Failed to reset password" });
                                }
                                db.run(
                                    "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
                                    [tokenRow.id],
                                    () => {
                                        res.json({ success: true, message: "Password reset successfully" });
                                    }
                                );
                            }
                        );
                    }).catch(() => {
                        res.status(500).json({ error: "Failed to reset password" });
                    });
                };

                if (USE_VONAGE_VERIFY && tokenRow.request_id) {
                    checkVonageVerify(tokenRow.request_id, code)
                        .then(() => handlePasswordReset())
                        .catch((verifyErr) => {
                            res.status(400).json({
                                error: "Invalid or expired reset code",
                                details: verifyErr?.message || String(verifyErr)
                            });
                        });
                } else {
                    if (String(code || "").trim() !== String(tokenRow.code || "").trim()) {
                        return res.status(400).json({ error: "Invalid or expired reset code" });
                    }
                    handlePasswordReset();
                }
            }
        );
    });
});

// Dev-only: send a test SMS
app.post("/api/test-sms", (req, res) => {
    if (process.env.NODE_ENV === "production") {
        return res.status(404).json({ error: "Not found" });
    }
    const { phone, message } = req.body || {};
    if (!phone) {
        return res.status(400).json({ error: "phone is required" });
    }
    const text = message || "CityCircle test SMS";
    sendSMS(formatSmsPhone(phone), text)
        .then((resp) => {
            res.json({ success: true, response: resp });
        })
        .catch((smsErr) => {
            res.status(500).json({
                error: "Failed to send SMS",
                details: smsErr?.message || String(smsErr)
        });
    });
});

// Remove a customer from blacklist
app.delete("/api/stores/blacklist/:userId", authStore, (req, res) => {
    if (!BLACKLIST_ENABLED) {
        return res.status(503).json({ error: "Blacklist feature temporarily disabled" });
    }
    const storeId = req.storeId;
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }
    
    db.run(
        "DELETE FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?",
        [storeId, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "Customer not found in blacklist" });
            }
            res.json({ success: true, message: "Customer removed from blacklist" });
        }
    );
});

// ---------- transaction with Loops earning ----------

app.post("/api/stores/transaction", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    const { userId, amount } = req.body;
    if (!userId || !amount)
        return res.status(400).json({ error: "Missing userId or amount" });

    const amountCents = toCents(amount);

    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });

        // Check if customer is blacklisted (optional)
        const afterBlacklistCheck = (errBlacklist, blacklistEntry) => {
            if (errBlacklist) {
                return res.status(500).json({ error: "Database error" });
            }
            if (blacklistEntry) {
                return res.status(403).json({ error: "This customer is blacklisted and cannot make transactions at this store" });
            }

            db.get("SELECT * FROM stores WHERE id = ?", [storeId], (err2, store) => {
                if (err2 || !store)
                    return res.status(404).json({ error: "Store not found" });

            // ----- base Loops rules -----
            // 1 Loop per $1 (per 100 cents) + fixed visit bonus
            const baseLoops = Math.floor(amountCents / 100); // $1 -> 1 Loop
            const visitBonus = 10; // per visit bonus

            // plan bonus
            let planMultiplier = 1;
            if (user.plan === "BASIC") planMultiplier = 1.1;
            if (user.plan === "PLUS") planMultiplier = 1.15;
            if (user.plan === "PREMIUM") planMultiplier = 1.2;

            const tierMultiplier = getTierMultiplier(user.total_loops_earned || 0);

            let loopsEarned = Math.round(
                (baseLoops + visitBonus) * planMultiplier * tierMultiplier
            );

            // insert transaction
            db.run(
                "INSERT INTO transactions (user_id, store_id, amount_cents, loops_earned) VALUES (?, ?, ?, ?)",
                [userId, storeId, amountCents, loopsEarned],
                function (err3) {
                    if (err3) {
                        return res.status(500).json({ error: "DB error" });
                    }

                    // update user Loops
                    const newBalance = user.loops_balance + loopsEarned;
                    const newTotal = user.total_loops_earned + loopsEarned;

                    db.run(
                        "UPDATE users SET loops_balance = ?, total_loops_earned = ? WHERE id = ?",
                        [newBalance, newTotal, userId],
                        (err4) => {
                            if (err4) {
                            }
                        }
                    );

                    // ledger entry
                    db.run(
                        "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'EARN', ?, ?)",
                        [userId, loopsEarned, `store:${storeId}`]
                    );

                    // Emit real-time update
                    io.emit("transaction", {
                        type: "earn",
                        userId,
                        storeId,
                        amountCents,
                        loopsEarned,
                        storeName: store.name,
                        userName: user.name,
                        timestamp: new Date().toISOString()
                    });

                    // Emit store-specific update
                    io.to(`store:${storeId}`).emit("store-transaction", {
                        transactionId: this.lastID,
                        userId,
                        userName: user.name,
                        userEmail: user.email,
                        amountCents,
                        loopsEarned,
                        timestamp: new Date().toISOString()
                    });

                    res.json({
                        transactionId: this.lastID,
                        amount,
                        loopsEarned,
                        newBalance,
                        newTotal,
                    });
                }
            );
            });
        };

        if (!BLACKLIST_ENABLED) {
            return afterBlacklistCheck(null, null);
        }
        db.get(
            "SELECT * FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?",
            [storeId, userId],
            afterBlacklistCheck
        );
    });
});

// ---------- quick transaction (zero-typing rush mode) ----------
app.post("/api/stores/transaction/quick", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });

        const proceed = () => {
            db.get("SELECT * FROM stores WHERE id = ?", [storeId], (err2, store) => {
                if (err2 || !store) return res.status(404).json({ error: "Store not found" });

                db.get(
                    "SELECT reward_points FROM store_offers WHERE store_id = ?",
                    [storeId],
                    (offerErr, offer) => {
                        if (offerErr && !String(offerErr.message || "").includes("no such table")) {
                            return res.status(500).json({ error: "Database error" });
                        }
                        const configuredDefaultPoints = Math.max(1, Number(offer?.reward_points || 10));

                        let planMultiplier = 1;
                        if (user.plan === "BASIC") planMultiplier = 1.1;
                        if (user.plan === "PLUS") planMultiplier = 1.15;
                        if (user.plan === "PREMIUM") planMultiplier = 1.2;
                        const tierMultiplier = getTierMultiplier(user.total_loops_earned || 0);
                        const loopsEarned = Math.max(1, Math.round(configuredDefaultPoints * planMultiplier * tierMultiplier));

                        db.run(
                            "INSERT INTO transactions (user_id, store_id, amount_cents, loops_earned) VALUES (?, ?, 0, ?)",
                            [userId, storeId, loopsEarned],
                            function onInsert(err3) {
                                if (err3) return res.status(500).json({ error: "DB error" });

                                const newBalance = Number(user.loops_balance || 0) + loopsEarned;
                                const newTotal = Number(user.total_loops_earned || 0) + loopsEarned;
                                db.run(
                                    "UPDATE users SET loops_balance = ?, total_loops_earned = ? WHERE id = ?",
                                    [newBalance, newTotal, userId]
                                );
                                db.run(
                                    "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'EARN', ?, ?)",
                                    [userId, loopsEarned, `store:${storeId}:quick`]
                                );

                                io.emit("transaction", {
                                    type: "earn_quick",
                                    userId,
                                    storeId,
                                    amountCents: 0,
                                    loopsEarned,
                                    storeName: store.name,
                                    userName: user.name,
                                    timestamp: new Date().toISOString(),
                                });

                                return res.json({
                                    success: true,
                                    mode: "quick",
                                    loopsEarned,
                                    defaultPoints: configuredDefaultPoints,
                                    message: "Quick transaction created successfully.",
                                });
                            }
                        );
                    }
                );
            });
        };

        if (!BLACKLIST_ENABLED) return proceed();

        db.get(
            "SELECT id FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?",
            [storeId, userId],
            (errBlacklist, blacklistEntry) => {
                if (errBlacklist) return res.status(500).json({ error: "Database error" });
                if (blacklistEntry) {
                    return res.status(403).json({ error: "This customer is blacklisted and cannot make transactions at this store" });
                }
                return proceed();
            }
        );
    });
});

// ---------- nearby stores (for map) ----------

function toRad(v) {
    return (v * Math.PI) / 180;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getCycleMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

async function ensureStoreMembership({ userId, storeId, cycleMonth, joinMethod, paidCents = 0 }) {
    if (!userId || !storeId || !cycleMonth) return;
    const method = joinMethod === "paid" ? "paid" : "free";
    const cents = Math.max(0, parseInt(paidCents) || 0);
    await dbRunAsync(
        `INSERT OR IGNORE INTO store_memberships (user_id, store_id, cycle_month, join_method, paid_cents, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, storeId, cycleMonth, method, cents]
    );
    if (method === "paid" && cents > 0) {
        await dbRunAsync(
            `UPDATE store_memberships
             SET join_method = 'paid',
                 paid_cents = CASE WHEN paid_cents < ? THEN ? ELSE paid_cents END
             WHERE user_id = ? AND store_id = ? AND cycle_month = ?`,
            [cents, cents, userId, storeId, cycleMonth]
        );
    }
}

function getPlanStoreLimit(plan) {
    // Customer enrollment is now free/unlimited (no subscription gating).
    return 0;
}

function normalizePlan(plan) {
    return (plan || "STARTER").toUpperCase();
}

function getPlanRank(plan) {
    const normalized = normalizePlan(plan);
    if (normalized === "PREMIUM") return 3;
    if (normalized === "PLUS") return 2;
    return 1; // STARTER/BASIC
}

function isPlanAtLeast(plan, minPlan) {
    if (!minPlan) return true;
    return getPlanRank(plan) >= getPlanRank(minPlan);
}

function getPlanUnlockLimit(plan) {
    return 9999; // unlimited paid unlocks
}

function getPlanAllowedTiers(plan) {
    // All reward tiers are visible to all customers.
    return ["standard", "boosted", "premium"];
}

function getPlanRewardWeight(plan) {
    const normalized = normalizePlan(plan);
    if (normalized === "PREMIUM") return 1.1;
    if (normalized === "PLUS") return 1.3;
    return 1.6; // STARTER sees higher rewards prioritized
}

function normalizeStoreName(name = "") {
    const cleaned = String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!cleaned) return "";
    const stopwords = new Set([
        "llc", "inc", "co", "corp", "company", "the", "store", "market",
        "jersey", "city", "nj", "new", "york"
    ]);
    return cleaned
        .split(" ")
        .filter((t) => t && !stopwords.has(t))
        .join(" ")
        .trim();
}

function normalizeAddress(address = "") {
    return String(address || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizePhone(phone = "") {
    return String(phone || "").replace(/\D/g, "");
}

function inferRewardTierFromPoints(points) {
    if (points >= 20) return "premium";
    if (points >= 10) return "boosted";
    return "standard";
}

function getDefaultOfferFromPoints(points) {
    const tier = inferRewardTierFromPoints(points);
    if (tier === "premium") {
        return {
            reward_tier: "premium",
            reward_points: points,
            unlock_cost_cents: 299,
            unlock_cost_loops: 300,
            is_locked: 1,
            min_plan: "PREMIUM",
        };
    }
    if (tier === "boosted") {
        return {
            reward_tier: "boosted",
            reward_points: points,
            unlock_cost_cents: 199,
            unlock_cost_loops: 200,
            is_locked: 1,
            min_plan: "PLUS",
        };
    }
    return {
        reward_tier: "standard",
        reward_points: points,
        unlock_cost_cents: 0,
        unlock_cost_loops: 0,
        is_locked: 0,
        min_plan: "STARTER",
    };
}

function getPlanAllowedCategories() {
    return ["grocery", "liquor", "barber", "salon", "coffee", "restaurant", "pharmacy", "bakery", "laundromat", "other"];
}

function computeStoreScore(distanceMiles, categoryAffinity, isNewStore) {
    // Simple AI baseline: distance + category preference + new-store boost
    const distanceScore = 1 / Math.max(0.1, distanceMiles || 0.1);
    const affinityScore = categoryAffinity || 0;
    const newStoreBoost = isNewStore ? 0.2 : 0;
    return (distanceScore * 0.7) + (affinityScore * 0.2) + (newStoreBoost * 0.1);
}

/* OSM DISABLED START
function normalizeOsmCategory(tags = {}) {
    const amenity = (tags.amenity || "").toLowerCase();
    const shop = (tags.shop || "").toLowerCase();
    const leisure = (tags.leisure || "").toLowerCase();

    if (amenity.includes("cafe") || shop.includes("coffee") || amenity.includes("coffee")) return "coffee";
    if (amenity.includes("restaurant") || amenity.includes("fast_food") || amenity.includes("food_court")) return "restaurant";
    if (shop.includes("supermarket") || shop.includes("grocery") || shop.includes("convenience")) return "grocery";
    if (shop.includes("alcohol") || amenity.includes("pub") || amenity.includes("bar")) return "liquor";
    if (amenity.includes("pharmacy")) return "pharmacy";
    if (shop.includes("laundry") || amenity.includes("laundry")) return "laundromat";
    if (shop.includes("bakery")) return "bakery";
    if (shop.includes("butcher")) return "butcher";
    if (shop.includes("hairdresser") || shop.includes("beauty") || amenity.includes("barber")) return "salon";
    if (shop.includes("clothes") || shop.includes("retail") || shop.includes("department_store")) return "retail";
    if (leisure.includes("fitness") || leisure.includes("sports")) return "fitness";
    return "other";
}

function isLikelyChain(tags = {}) {
    const name = (tags.name || "").toLowerCase();
    const brand = (tags.brand || "").toLowerCase();
    const operator = (tags.operator || "").toLowerCase();
    const haystack = `${name} ${brand} ${operator}`;

    const chainKeywords = [
        "starbucks", "mcdonald", "subway", "dunkin", "burger king", "kfc",
        "taco bell", "wendy's", "domino", "pizza hut", "chipotle", "panera",
        "7-eleven", "walmart", "target", "costco", "cvs", "walgreens", "rite aid",
        "whole foods", "trader joe", "aldi", "kroger"
    ];

    return chainKeywords.some((k) => haystack.includes(k));
}

async function fetchOsmNearbyStores(lat, lng, radiusMiles) {
    const radiusMeters = Math.max(100, Math.round(radiusMiles * 1609.34));
    const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lng})["amenity"~"cafe|restaurant|fast_food|bar|pub|pharmacy|laundry|barber"];
  way(around:${radiusMeters},${lat},${lng})["amenity"~"cafe|restaurant|fast_food|bar|pub|pharmacy|laundry|barber"];
  node(around:${radiusMeters},${lat},${lng})["shop"~"supermarket|grocery|convenience|alcohol|bakery|butcher|clothes|department_store|beauty|hairdresser"];
  way(around:${radiusMeters},${lat},${lng})["shop"~"supermarket|grocery|convenience|alcohol|bakery|butcher|clothes|department_store|beauty|hairdresser"];
);
out center tags;`;

    const overpassEndpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter"
    ];

    let data = null;
    let lastError = null;

    for (const endpoint of overpassEndpoints) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "CityCircle/1.0 (localdev)"
                },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                lastError = new Error(`OSM request failed: ${response.status}`);
                continue;
            }

            data = await response.json();
            break;
        } catch (e) {
            lastError = e;
        }
    }

    if (!data) {
        throw lastError || new Error("OSM request failed");
    }
    const elements = data.elements || [];

    return elements
        .map((el) => {
            const tags = el.tags || {};
            const name = tags.name;
            if (!name) return null;

            const latVal = el.lat || el.center?.lat;
            const lngVal = el.lon || el.center?.lon;
            if (latVal == null || lngVal == null) return null;

            const distance = haversineMiles(lat, lng, latVal, lngVal);
            const category = normalizeOsmCategory(tags);
            const chain = isLikelyChain(tags);

            return {
                id: `osm_${el.type}_${el.id}`,
                name,
                category,
                latitude: latVal,
                longitude: lngVal,
                distance_miles: distance,
                address: tags["addr:full"] || [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(" "),
                phone: tags.phone || tags["contact:phone"] || null,
                website: tags.website || tags["contact:website"] || null,
                is_chain: chain
            };
        })
        .filter((s) => s && s.distance_miles <= radiusMiles && !s.is_chain)
        .sort((a, b) => a.distance_miles - b.distance_miles);
}

function dbGetAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbRunAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

OSM DISABLED END */

function dbGetAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbRunAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function dbAllAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// ---------- Tracking & Admin notifications ----------
const ALLOWED_EVENT_TYPES = new Set([
    "page_view", "app_open", "signup_started", "signup_completed", "first_checkin",
    "store_claimed", "store_request", "store_request_duplicate", "store_signup_started"
]);
const EVENT_RATE_LIMIT_PER_IP = 120; // max events per IP per minute
const eventRateLimitByIp = new Map();

function recordAnalyticsEvent(data, req = null) {
    const {
        event_type,
        actor_type = null,
        actor_id = null,
        session_id = null,
        payload = null,
        utm_source = null,
        utm_medium = null,
        utm_campaign = null,
    } = data;
    if (!event_type || !ALLOWED_EVENT_TYPES.has(event_type)) return Promise.resolve();
    const payloadStr = payload != null ? (typeof payload === "string" ? payload : JSON.stringify(payload)) : null;
    const ip = req && req.headers && req.headers["x-forwarded-for"]
        ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
        : (req && req.connection && req.connection.remoteAddress) || null;
    return dbRunAsync(
        `INSERT INTO analytics_events (event_type, actor_type, actor_id, session_id, payload, utm_source, utm_medium, utm_campaign, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [event_type, actor_type, actor_id, session_id, payloadStr, utm_source, utm_medium, utm_campaign, ip]
    ).catch((err) => {
        if (!String(err.message || "").includes("no such table: analytics_events")) {
            console.warn("Analytics event insert failed:", err.message);
        }
    });
}

async function getAdminEmails() {
    const override = process.env.ADMIN_EMAILS;
    if (override && String(override).trim()) {
        return String(override).split(",").map((e) => e.trim()).filter(Boolean);
    }
    try {
        const rows = await dbAllAsync("SELECT email FROM admins WHERE email IS NOT NULL AND trim(email) != ''");
        return (rows || []).map((r) => r.email).filter(Boolean);
    } catch (e) {
        return [];
    }
}

async function sendAdminNotificationEmail(eventType, subject, bodyHtml, meta = {}) {
    const emails = await getAdminEmails();
    if (!emails.length) return;
    try {
        const transporter = await getMailTransporter();
        const from = process.env.ADMIN_FROM_EMAIL || process.env.SMTP_USER || "noreply@citycircle.app";
        if (!transporter) {
            if (process.env.NODE_ENV !== "production") {
                console.log("[Admin email] SMTP not configured. Would send to:", emails.join(", "), "Subject:", subject);
            }
            return;
        }
        await transporter.sendMail({
            from,
            to: emails.join(", "),
            subject: `[CityCircle] ${subject}`,
            html: bodyHtml,
        });
        try {
            await dbRunAsync(
                "INSERT INTO admin_email_log (event_type, subject, recipient_count, created_at) VALUES (?, ?, ?, datetime('now'))",
                [eventType, subject, emails.length]
            );
        } catch (logErr) {
            if (!String(logErr.message || "").includes("no such table: admin_email_log")) {
                console.warn("Admin email log insert failed:", logErr.message);
            }
        }
    } catch (e) {
        console.warn("Admin notification email failed:", e.message);
    }
}

async function getMailTransporter() {
    const nodemailer = require("nodemailer");
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    const secureEnv = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
    const secure = (secureEnv === "true" || secureEnv === "1" || secureEnv === "yes") || port === 465;
    return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

async function sendStoreOutreachEmail(toEmail, storeName, requestCount) {
    const transporter = await getMailTransporter();
    if (!transporter) {
        if (process.env.NODE_ENV !== "production") {
            console.log("[Store outreach] SMTP not configured. Would send to:", toEmail, "Store:", storeName);
        }
        return false;
    }
    const from = process.env.ADMIN_FROM_EMAIL || process.env.SMTP_USER || "noreply@citycircle.app";
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "https://citycircle.app";
    const subject = "Your customers are asking for you on CityCircle";
    const html = `
<p>Hi,</p>
<p><strong>${requestCount}</strong> customers have asked for <strong>${storeName}</strong> to join CityCircle.</p>
<p>Join as a store to connect with these customers and grow your business:</p>
<p><a href="${appUrl}">${appUrl}</a></p>
<p>— CityCircle</p>
`;
    await transporter.sendMail({ from, to: toEmail, subject: `[CityCircle] ${subject}`, html });
    return true;
}

async function ensureStoreRequestNotificationsTable() {
    await dbRunAsync(
        `CREATE TABLE IF NOT EXISTS store_request_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_name_normalized TEXT NOT NULL,
            requested_store_name TEXT,
            request_count INTEGER DEFAULT 0,
            sent_email INTEGER DEFAULT 0,
            sent_sms INTEGER DEFAULT 0,
            admin_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ).catch(() => null);
    await dbRunAsync(
        "CREATE INDEX IF NOT EXISTS idx_store_request_notifications_store_created ON store_request_notifications(store_name_normalized, created_at)"
    ).catch(() => null);
}

function toSqlDateTime(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace("T", " ");
}

function addDaysToSqlDate(dateLike, days) {
    const d = new Date(dateLike || Date.now());
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + Number(days || 0));
    return toSqlDateTime(d);
}

function normalizeStorePlanId(planId) {
    const normalized = String(planId || "trial").trim().toLowerCase();
    return STORE_PLAN_CONFIGS[normalized] ? normalized : "trial";
}

async function ensureStoreSubscriptionsTable() {
    await dbRunAsync(
        `CREATE TABLE IF NOT EXISTS store_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL UNIQUE,
            plan_id TEXT NOT NULL DEFAULT 'trial',
            status TEXT NOT NULL DEFAULT 'trialing',
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            trial_ends_at DATETIME,
            current_period_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ai_credits_used INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )`
    );
    await dbRunAsync("CREATE INDEX IF NOT EXISTS idx_store_subscriptions_store_id ON store_subscriptions(store_id)").catch(() => null);
}

async function ensureStoreSubscriptionAuditTable() {
    await dbRunAsync(
        `CREATE TABLE IF NOT EXISTS store_subscription_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            actor_type TEXT NOT NULL,
            actor_id INTEGER,
            from_plan_id TEXT,
            to_plan_id TEXT,
            from_status TEXT,
            to_status TEXT,
            note TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )`
    ).catch(() => null);
    await dbRunAsync(
        "CREATE INDEX IF NOT EXISTS idx_store_subscription_audit_store_created ON store_subscription_audit_logs(store_id, created_at)"
    ).catch(() => null);
}

async function logStoreSubscriptionChange({
    storeId,
    actorType = "system",
    actorId = null,
    fromSubscription = null,
    toSubscription = null,
    note = "",
}) {
    try {
        await ensureStoreSubscriptionAuditTable();
        await dbRunAsync(
            `INSERT INTO store_subscription_audit_logs
             (store_id, actor_type, actor_id, from_plan_id, to_plan_id, from_status, to_status, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                storeId,
                actorType,
                actorId,
                fromSubscription?.plan?.id || null,
                toSubscription?.plan?.id || null,
                fromSubscription?.status || null,
                toSubscription?.status || null,
                note || "",
            ]
        );
    } catch (e) {
        console.warn("Failed to log subscription audit:", e.message);
    }
}

async function ensureStoreSubscriptionRow(storeId) {
    await ensureStoreSubscriptionsTable();
    const store = await dbGetAsync("SELECT id, claimed_at, created_at FROM stores WHERE id = ?", [storeId]);
    if (!store) return null;
    const startedAt = toSqlDateTime(store.claimed_at || store.created_at || new Date());
    const trialEndsAt = addDaysToSqlDate(startedAt, STORE_SUBSCRIPTION_TRIAL_DAYS);
    await dbRunAsync(
        `INSERT OR IGNORE INTO store_subscriptions
         (store_id, plan_id, status, started_at, trial_ends_at, current_period_start, ai_credits_used, created_at, updated_at)
         VALUES (?, 'trial', 'trialing', ?, ?, datetime('now', 'start of month'), 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [storeId, startedAt, trialEndsAt]
    );
    return dbGetAsync("SELECT * FROM store_subscriptions WHERE store_id = ?", [storeId]);
}

async function getStoreContentUsageForCurrentMonth(storeId) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const monthStart = toSqlDateTime(start);
    const safeCount = async (tableName) => {
        const row = await dbGetAsync(
            `SELECT COUNT(*) AS count FROM ${tableName} WHERE store_id = ? AND datetime(created_at) >= datetime(?)`,
            [storeId, monthStart]
        ).catch((err) => {
            if (String(err?.message || "").includes("no such table")) return { count: 0 };
            throw err;
        });
        return row?.count || 0;
    };
    const [promotions, updates, posts] = await Promise.all([
        safeCount("store_promotions"),
        safeCount("store_updates"),
        safeCount("store_posts"),
    ]);
    return { month_start: monthStart, promotions, updates, posts, total: promotions + updates + posts };
}

async function getStoreSubscriptionSnapshot(storeId) {
    const row = await ensureStoreSubscriptionRow(storeId);
    if (!row) return null;
    const planId = normalizeStorePlanId(row.plan_id);
    const plan = STORE_PLAN_CONFIGS[planId] || STORE_PLAN_CONFIGS.trial;
    let status = STORE_SUBSCRIPTION_STATUSES.has(String(row.status || "")) ? String(row.status) : "active";
    if (planId === "trial" && row.trial_ends_at && Date.now() > new Date(row.trial_ends_at).getTime()) {
        status = "expired";
        await dbRunAsync(
            "UPDATE store_subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE store_id = ? AND status != 'expired'",
            [storeId]
        ).catch(() => null);
    }
    const usage = await getStoreContentUsageForCurrentMonth(storeId);
    const limit = plan.monthly_content_limit;
    const remaining = typeof limit === "number" ? Math.max(limit - usage.total, 0) : null;
    return {
        store_id: storeId,
        status,
        plan: {
            id: plan.id,
            label: plan.label,
            monthly_price_usd: plan.monthly_price_usd,
            list_price_usd: plan.list_price_usd || plan.monthly_price_usd || 0,
            launch_price_usd: plan.launch_price_usd || plan.monthly_price_usd || 0,
            launch_discount_label: plan.launch_discount_label || "",
            monthly_content_limit: plan.monthly_content_limit,
            ai_monthly_limit: plan.ai_monthly_limit,
            features: Array.isArray(plan.features) ? plan.features : [],
        },
        started_at: row.started_at || null,
        trial_ends_at: row.trial_ends_at || null,
        current_period_start: row.current_period_start || usage.month_start,
        ai_credits_used: row.ai_credits_used || 0,
        usage: {
            ...usage,
            remaining_content: remaining,
            limit_reached: typeof limit === "number" ? usage.total >= limit : false,
        },
    };
}

async function ensureStoreCanCreateContent(storeId) {
    const snapshot = await getStoreSubscriptionSnapshot(storeId);
    if (!snapshot) return { allowed: false, code: 404, error: "Store not found", subscription: null };
    if (snapshot.plan.id === "trial" && snapshot.status === "expired") {
        return {
            allowed: false,
            code: 403,
            error: "Your trial has expired. Upgrade to Starter or Growth to continue publishing content.",
            subscription: snapshot,
        };
    }
    if (snapshot.usage.limit_reached) {
        return {
            allowed: false,
            code: 403,
            error: `Monthly content limit reached for ${snapshot.plan.label}. Upgrade your plan to publish more.`,
            subscription: snapshot,
        };
    }
    return { allowed: true, code: 200, error: null, subscription: snapshot };
}

function canViewStoreCustomerIdentity(subscriptionSnapshot) {
    const planId = String(subscriptionSnapshot?.plan?.id || "trial").toLowerCase();
    return planId === "starter" || planId === "growth";
}

function getCustomerIdentityAccessMeta(subscriptionSnapshot) {
    const canView = canViewStoreCustomerIdentity(subscriptionSnapshot);
    return {
        plan_id: String(subscriptionSnapshot?.plan?.id || "trial").toLowerCase(),
        status: String(subscriptionSnapshot?.status || "trialing").toLowerCase(),
        can_view_customer_identity: canView,
        upgrade_message: canView
            ? ""
            : "Upgrade to Starter or Growth to view customer names, phone numbers, and send direct promotions.",
    };
}

function maskCustomerName(name = "") {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "New customer";
    const masked = parts.map((part) => `${part.charAt(0).toUpperCase()}***`);
    return masked.join(" ");
}

function maskCustomerPhone(phone = "") {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "***-***-****";
    const last4 = digits.slice(-4).padStart(4, "*");
    return `***-***-${last4}`;
}

function isEventRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
    const window = 60 * 1000;
    const list = eventRateLimitByIp.get(ip) || [];
    const recent = list.filter((t) => now - t < window);
    if (recent.length >= EVENT_RATE_LIMIT_PER_IP) return true;
    recent.push(now);
    eventRateLimitByIp.set(ip, recent);
    setTimeout(() => {
        const cur = eventRateLimitByIp.get(ip) || [];
        const still = cur.filter((t) => Date.now() - t < window);
        if (still.length) eventRateLimitByIp.set(ip, still);
        else eventRateLimitByIp.delete(ip);
    }, window);
    return false;
}

function isLikelyChainName(name = "") {
    const haystack = String(name || "").toLowerCase();
    const chainKeywords = [
        "starbucks", "mcdonald", "subway", "dunkin", "burger king", "kfc",
        "taco bell", "wendy's", "domino", "pizza hut", "chipotle", "panera",
        "white castle",
        "7-eleven", "walmart", "target", "costco", "cvs", "walgreens", "rite aid",
        "whole foods", "trader joe", "aldi", "kroger"
    ];
    return chainKeywords.some((k) => haystack.includes(k));
}

function getTomTomScore(result) {
    if (typeof result?.score === "number") return result.score;
    if (typeof result?.scoring?.queryScore === "number") return result.scoring.queryScore;
    return null;
}

function passesTomTomQuality(result, store, options = {}) {
    const {
        requireAddress = false,
        requirePhoneOrUrl = false,
        excludeOtherCategory = false,
        minScore = null
    } = options;

    if (requireAddress && !store.address) return false;
    if (requirePhoneOrUrl && !store.phone && !store.website) return false;
    if (excludeOtherCategory && store.category === "other") return false;
    if (typeof minScore === "number") {
        if (store.score == null) return false;
        if (store.score < minScore) return false;
    }

    return true;
}

function normalizeTomTomCategory(categories = []) {
    const text = categories.join(" ").toLowerCase();
    if (text.includes("cafe") || text.includes("coffee")) return "coffee";
    if (text.includes("restaurant") || text.includes("fast food")) return "restaurant";
    if (text.includes("grocery") || text.includes("supermarket") || text.includes("convenience")) return "grocery";
    if (text.includes("liquor") || text.includes("wine") || text.includes("bar")) return "liquor";
    if (text.includes("pharmacy")) return "pharmacy";
    if (text.includes("laundry")) return "laundromat";
    if (text.includes("bakery")) return "bakery";
    if (text.includes("barber") || text.includes("beauty") || text.includes("hair")) return "salon";
    return "other";
}

function categorizeByName(name = "") {
    const text = String(name || "").toLowerCase();
    if (text.includes("grocery") || text.includes("market") || text.includes("deli")) return "grocery";
    if (text.includes("liquor") || text.includes("wine") || text.includes("spirits")) return "liquor";
    if (text.includes("barber") || text.includes("barbershop")) return "barber";
    if (text.includes("salon") || text.includes("spa") || text.includes("beauty") || text.includes("nail")) return "salon";
    if (text.includes("coffee") || text.includes("cafe")) return "coffee";
    if (text.includes("bakery") || text.includes("bake")) return "bakery";
    if (text.includes("laundry") || text.includes("laundromat")) return "laundromat";
    if (text.includes("pharmacy") || text.includes("drug")) return "pharmacy";
    if (text.includes("restaurant") || text.includes("grill") || text.includes("diner") || text.includes("pizza")) return "restaurant";
    return "other";
}

function normalizeGoogleCategory(types = []) {
    const text = types.join(" ").toLowerCase();
    if (text.includes("grocery_or_supermarket") || text.includes("convenience_store")) return "grocery";
    if (text.includes("liquor_store")) return "liquor";
    if (text.includes("barber_shop")) return "barber";
    if (text.includes("beauty_salon") || text.includes("hair_care")) return "salon";
    if (text.includes("cafe") || text.includes("coffee")) return "coffee";
    if (text.includes("restaurant") || text.includes("meal_takeaway")) return "restaurant";
    if (text.includes("bakery")) return "bakery";
    if (text.includes("pharmacy") || text.includes("drugstore")) return "pharmacy";
    if (text.includes("laundry")) return "laundromat";
    return "other";
}

function mapGoogleType(category = "") {
    const c = String(category || "").toLowerCase();
    if (c === "grocery") return "grocery_or_supermarket";
    if (c === "convenience") return "convenience_store";
    if (c === "liquor") return "liquor_store";
    if (c === "barber") return "barber_shop";
    if (c === "salon") return "beauty_salon";
    if (c === "coffee") return "cafe";
    if (c === "restaurant") return "restaurant";
    if (c === "pharmacy") return "pharmacy";
    if (c === "bakery") return "bakery";
    if (c === "laundromat") return "laundry";
    return null;
}

function passesGoogleQuality(store, options = {}) {
    const {
        requireAddress = false,
        excludeOtherCategory = false,
        minRating = null,
        minReviews = null
    } = options;

    if (requireAddress && !store.address) return false;
    if (excludeOtherCategory && store.category === "other") return false;
    if (typeof minRating === "number" && (store.rating == null || store.rating < minRating)) return false;
    if (typeof minReviews === "number" && (store.user_ratings_total == null || store.user_ratings_total < minReviews)) return false;
    return true;
}

async function fetchTomTomNearbyStores(lat, lng, radiusMiles, query, options = {}) {
    if (!TOMTOM_API_KEY) {
        throw new Error("TOMTOM_API_KEY is not configured");
    }

    const radiusMeters = Math.max(100, Math.round(radiusMiles * 1609.34));
    const q = encodeURIComponent(query || "store");
    const url =
        `https://api.tomtom.com/search/2/poiSearch/${q}.json` +
        `?lat=${lat}&lon=${lng}&radius=${radiusMeters}&limit=50&key=${TOMTOM_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TomTom request failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    return results
        .map((r) => {
            const name = r.poi?.name;
            if (!name) return null;
            const categories = r.poi?.categories || [];
            const categoryFromTomTom = normalizeTomTomCategory(categories);
            const categoryFromName = categorizeByName(name);
            const category = categoryFromTomTom !== "other"
                ? categoryFromTomTom
                : (options.preferNameCategory ? categoryFromName : categoryFromTomTom);
            const distance = r.dist ? r.dist / 1609.34 : null;
            const address = r.address?.freeformAddress || null;
            const score = getTomTomScore(r);

            return {
                id: `tt_${r.id}`,
                name,
                category,
                category_raw: categoryFromTomTom,
                latitude: r.position?.lat,
                longitude: r.position?.lon,
                distance_miles: distance,
                address,
                phone: r.poi?.phone || null,
                website: r.poi?.url || null,
                score,
                is_chain: isLikelyChainName(name)
            };
        })
        .filter((s) => (
            s &&
            s.distance_miles != null &&
            s.distance_miles <= radiusMiles &&
            !s.is_chain &&
            (options.includeOther || s.category !== "other") &&
            passesTomTomQuality(null, s, options)
        ))
        .sort((a, b) => a.distance_miles - b.distance_miles);
}

const DEFAULT_GOOGLE_TYPES = [
    "grocery_or_supermarket",
    "convenience_store",
    "liquor_store",
    "pharmacy",
    "restaurant",
    "cafe",
    "bakery",
    "barber_shop",
    "beauty_salon",
    "laundry",
];

function matchesQuery(row, queryTokens) {
    if (!queryTokens || queryTokens.length === 0) return true;
    const hay = `${row?.name || ""} ${row?.address || ""} ${row?.category || ""}`.toLowerCase();
    return queryTokens.every((t) => hay.includes(t));
}

async function fetchGoogleNearbyStoresRaw(lat, lng, radiusMiles, query, googleType) {
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }

    const radiusMeters = Math.max(100, Math.round(radiusMiles * 1609.34));
    const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(radiusMeters),
        key: GOOGLE_PLACES_API_KEY
    });

    if (googleType) {
        params.set("type", googleType);
    }

    if (query && query !== "all") {
        params.set("keyword", query);
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Places request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        throw new Error(`Google Places error: ${data.status}`);
    }

    const results = data.results || [];

    return results;
}

function mapGooglePlace(r, originLat, originLng, options) {
    const name = r.name;
    if (!name) return null;
    const types = r.types || [];
    const categoryFromGoogle = normalizeGoogleCategory(types);
    const categoryFromName = categorizeByName(name);
    const category = categoryFromGoogle !== "other"
        ? categoryFromGoogle
        : (options.preferNameCategory ? categoryFromName : categoryFromGoogle);
    const address = r.vicinity || r.formatted_address || null;
    const latitude = r.geometry?.location?.lat;
    const longitude = r.geometry?.location?.lng;
    const distance = (latitude != null && longitude != null)
        ? haversineMiles(originLat, originLng, latitude, longitude)
        : null;

    return {
        id: `g_${r.place_id}`,
        place_id: r.place_id,
        name,
        category,
        category_raw: categoryFromGoogle,
        latitude,
        longitude,
        distance_miles: distance,
        address,
        rating: r.rating ?? null,
        user_ratings_total: r.user_ratings_total ?? null,
        is_chain: isLikelyChainName(name)
    };
}

async function fetchGoogleNearbyStores(lat, lng, radiusMiles, query, options = {}) {
    const cacheKey = [
        lat.toFixed(5),
        lng.toFixed(5),
        radiusMiles.toFixed(2),
        query || "all",
        options.category || "all",
        options.includeOther ? "other=1" : "other=0",
        options.preferNameCategory === false ? "prefer=0" : "prefer=1",
        options.minRating != null ? `minRating=${options.minRating}` : "minRating=na",
        options.minReviews != null ? `minReviews=${options.minReviews}` : "minReviews=na",
    ].join("|");

    const cached = getCache(googleNearbyCache, cacheKey);
    if (cached) return cached;

    const useMultiTypes = !options.category && (query === "all" || !query);
    const mappedType = mapGoogleType(options.category);
    const typesToFetch = useMultiTypes
        ? DEFAULT_GOOGLE_TYPES
        : (mappedType ? [mappedType] : [null]);

    const rawResults = [];
    for (const googleType of typesToFetch) {
        const batch = await fetchGoogleNearbyStoresRaw(lat, lng, radiusMiles, query, googleType);
        rawResults.push(...batch);
    }

    const merged = new Map();
    rawResults.forEach((r) => {
        const store = mapGooglePlace(r, lat, lng, options);
        if (!store) return;
        if (
            store.distance_miles == null ||
            store.distance_miles > radiusMiles ||
            store.is_chain
        ) {
            return;
        }
        if (!options.includeOther && store.category === "other") return;
        if (!passesGoogleQuality(store, options)) return;

        const existing = merged.get(store.place_id);
        if (!existing || (store.distance_miles < existing.distance_miles)) {
            merged.set(store.place_id, store);
        }
    });

    const results = Array.from(merged.values()).sort((a, b) => a.distance_miles - b.distance_miles);
    setCache(googleNearbyCache, cacheKey, results, GOOGLE_CACHE_TTL_MS);
    return results;
}

// ---------- Loops redemption ----------

async function getUserStoreLoopsBalance(userId, storeId) {
    const sid = Number(storeId);
    if (!userId || !Number.isFinite(sid) || sid <= 0) return 0;

    const earnedRow = await dbGetAsync(
        "SELECT COALESCE(SUM(loops_earned), 0) AS earned FROM transactions WHERE user_id = ? AND store_id = ?",
        [userId, sid]
    );
    const directRedeemRow = await dbGetAsync(
        `SELECT COALESCE(SUM(ABS(amount)), 0) AS redeemed
         FROM loops_ledger
         WHERE user_id = ?
           AND change_type = 'REDEEM'
           AND (meta = ? OR meta LIKE ?)`,
        [userId, `store:${sid}`, `store:${sid}:%`]
    );
    const giftCardRedeemRow = await dbGetAsync(
        `SELECT COALESCE(SUM(gct.loops_used), 0) AS redeemed
         FROM gift_cards gc
         JOIN gift_card_transactions gct ON gct.gift_card_id = gc.id
         WHERE gc.user_id = ?
           AND gc.store_id = ?
           AND gct.payment_method = 'points'`,
        [userId, sid]
    );

    const earned = Number(earnedRow?.earned || 0);
    const directRedeemed = Number(directRedeemRow?.redeemed || 0);
    const giftCardRedeemed = Number(giftCardRedeemRow?.redeemed || 0);
    return Math.max(0, Math.floor(earned - directRedeemed - giftCardRedeemed));
}

app.post("/api/users/redeem", auth("user"), (req, res) => {
    (async () => {
    const userId = req.user.id;
    const { amount, storeId, description } = req.body;
        const sid = Number(storeId);

        if (!Number.isFinite(sid) || sid <= 0) {
            return res.status(400).json({ error: "storeId is required for redemption" });
        }
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid redemption amount" });
    }

    const loopsToRedeem = Math.floor(Number(amount));
        const availableForStore = await getUserStoreLoopsBalance(userId, sid);

        if (availableForStore < loopsToRedeem) {
            return res.status(400).json({ 
                error: `Insufficient store Loops. You have ${availableForStore} at this store, need ${loopsToRedeem}`,
            });
        }

        const user = await dbGetAsync("SELECT loops_balance FROM users WHERE id = ?", [userId]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Keep global balance in sync, but enforce spending by store-specific balance above.
        const newBalance = Math.max(0, Number(user.loops_balance || 0) - loopsToRedeem);
        await dbRunAsync("UPDATE users SET loops_balance = ? WHERE id = ?", [newBalance, userId]);

        const meta = `store:${sid}${description ? `:${description}` : ""}`;
        await dbRunAsync(
                    "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'REDEEM', ?, ?)",
            [userId, -loopsToRedeem, meta]
        );

                io.emit("redemption", {
                    userId,
            storeId: sid,
                    loopsRedeemed: loopsToRedeem,
                    newBalance,
                    timestamp: new Date().toISOString()
                });

        return res.json({
                    success: true,
                    loopsRedeemed: loopsToRedeem,
            store_id: sid,
                    newBalance,
            message: `Successfully redeemed ${loopsToRedeem} Loops at this store`
                });
    })().catch(() => {
        return res.status(500).json({ error: "Failed to redeem Loops" });
    });
});

// ---------- Gift Cards System ----------

// Configuration
const MIN_POINTS_FOR_GIFT_CARD = 1000; // Minimum points required to create gift card
const GIFT_CARD_EXCHANGE_RATE = 100; // 100 Loops = $1 gift card
const GIFT_CARD_VALIDITY_DAYS = 90; // Valid for 90 days
const STORE_GIFT_CARD_MIN_LOOPS_MIN = 500;
const STORE_GIFT_CARD_MIN_LOOPS_MAX = 1000;
const STORE_SCHEDULE_MIN_POINTS = 5;
const STORE_SCHEDULE_MAX_POINTS = 50;
const STORE_SCHEDULE_MIN_MULTIPLIER = 0.5;
const STORE_SCHEDULE_MAX_MULTIPLIER = 2.0;
const STORE_REWARD_AUTOMATION_MODES = ["auto", "guided", "manual"];

function normalizeGiftCardMinLoops(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return MIN_POINTS_FOR_GIFT_CARD;
    return Math.max(STORE_GIFT_CARD_MIN_LOOPS_MIN, Math.min(STORE_GIFT_CARD_MIN_LOOPS_MAX, parsed));
}

function parseScheduleDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function normalizeScheduleFixedPoints(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return STORE_SCHEDULE_MIN_POINTS;
    return Math.max(STORE_SCHEDULE_MIN_POINTS, Math.min(STORE_SCHEDULE_MAX_POINTS, parsed));
}

function normalizeScheduleMultiplier(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    const clamped = Math.max(STORE_SCHEDULE_MIN_MULTIPLIER, Math.min(STORE_SCHEDULE_MAX_MULTIPLIER, parsed));
    return Math.round(clamped * 100) / 100;
}

function normalizeRewardAutomationMode(value) {
    const mode = String(value || "auto").toLowerCase();
    return STORE_REWARD_AUTOMATION_MODES.includes(mode) ? mode : "auto";
}

async function createStoreRewardScheduleRecord(storeId, payload, options = {}) {
    const {
        allowOverlap = false,
        defaultIsActive = 1,
    } = options;
    const {
        name = "",
        reason = "",
        mode = "fixed",
        fixed_points,
        multiplier,
        start_at,
        end_at,
        is_active,
    } = payload || {};

    const fail = (message, statusCode = 400) => {
        const err = new Error(message);
        err.statusCode = statusCode;
        throw err;
    };

    const scheduleName = String(name || "").trim();
    if (!scheduleName) fail("Schedule name is required");
    const normalizedMode = String(mode || "").toLowerCase() === "multiplier" ? "multiplier" : "fixed";
    const startAt = parseScheduleDate(start_at);
    const endAt = parseScheduleDate(end_at);
    if (!startAt || !endAt || endAt <= startAt) {
        fail("Valid start_at and end_at are required");
    }
    const durationMs = endAt.getTime() - startAt.getTime();
    if (durationMs < 2 * 60 * 60 * 1000) {
        fail("Schedule duration must be at least 2 hours");
    }

    let normalizedFixedPoints = null;
    let normalizedMultiplier = null;
    if (normalizedMode === "fixed") {
        normalizedFixedPoints = normalizeScheduleFixedPoints(fixed_points);
    } else {
        normalizedMultiplier = normalizeScheduleMultiplier(multiplier);
    }

    const activeFlag = is_active == null ? (defaultIsActive ? 1 : 0) : (is_active ? 1 : 0);
    if (activeFlag === 1) {
        const activeCount = await dbGetAsync(
            "SELECT COUNT(*) AS count FROM store_reward_point_schedules WHERE store_id = ? AND is_active = 1",
            [storeId]
        );
        if ((activeCount?.count || 0) >= 10) {
            fail("Maximum 10 active schedules allowed");
        }
    }

    if (!allowOverlap && activeFlag === 1) {
        const overlap = await dbGetAsync(
            `SELECT id FROM store_reward_point_schedules
             WHERE store_id = ? AND is_active = 1
               AND start_at < ? AND end_at > ?
             LIMIT 1`,
            [storeId, endAt.toISOString(), startAt.toISOString()]
        );
        if (overlap) {
            fail("Schedule overlaps with another active schedule");
        }
    }

    const insertResult = await dbRunAsync(
        `INSERT INTO store_reward_point_schedules
         (store_id, name, reason, mode, fixed_points, multiplier, start_at, end_at, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
            storeId,
            scheduleName,
            String(reason || "").trim() || null,
            normalizedMode,
            normalizedFixedPoints,
            normalizedMultiplier,
            startAt.toISOString(),
            endAt.toISOString(),
            activeFlag,
        ]
    );

    return dbGetAsync(
        `SELECT id, store_id, name, reason, mode, fixed_points, multiplier, start_at, end_at, is_active, created_at, updated_at
         FROM store_reward_point_schedules WHERE id = ?`,
        [insertResult.lastID]
    );
}

async function getStoreRewardPreferences(storeId) {
    try {
        await dbRunAsync(
            `INSERT OR IGNORE INTO store_reward_preferences (store_id, automation_mode, weekly_digest_enabled, updated_at)
             VALUES (?, 'auto', 1, CURRENT_TIMESTAMP)`,
            [storeId]
        );
        const row = await dbGetAsync(
            `SELECT store_id, automation_mode, weekly_digest_enabled, updated_at
             FROM store_reward_preferences WHERE store_id = ?`,
            [storeId]
        );
        return {
            store_id: storeId,
            automation_mode: normalizeRewardAutomationMode(row?.automation_mode),
            weekly_digest_enabled: row?.weekly_digest_enabled ? 1 : 0,
            updated_at: row?.updated_at || null,
        };
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_preferences")) {
            return {
                store_id: storeId,
                automation_mode: "auto",
                weekly_digest_enabled: 1,
                updated_at: null,
            };
        }
        throw e;
    }
}

async function buildStoreRewardRecommendations(storeId) {
    const offerRow = await dbGetAsync("SELECT reward_points FROM store_offers WHERE store_id = ?", [storeId]).catch(() => null);
    const basePoints = normalizeScheduleFixedPoints(Number(offerRow?.reward_points || 10));
    const visits14 = await dbGetAsync(
        `SELECT COUNT(*) AS count
         FROM check_in_sessions
         WHERE store_id = ? AND status = 'completed' AND checked_in_at >= datetime('now', '-14 days')`,
        [storeId]
    ).catch(() => ({ count: 0 }));

    const now = new Date();
    const plusHours = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);
    const recs = [];

    recs.push({
        id: "weekend-rush-boost",
        title: "Weekend Rush Boost",
        reason: "Higher foot traffic expected this weekend.",
        mode: "multiplier",
        multiplier: 1.15,
        start_at: plusHours(18).toISOString(),
        end_at: plusHours(42).toISOString(),
        estimated_impact: "Expected: +8-15% more repeat check-ins.",
    });

    if ((visits14?.count || 0) < 40) {
        recs.push({
            id: "low-traffic-recovery",
            title: "Low Traffic Recovery",
            reason: "Recent visits are below typical volume.",
            mode: "multiplier",
            multiplier: 1.2,
            start_at: plusHours(2).toISOString(),
            end_at: plusHours(50).toISOString(),
            estimated_impact: "Expected: +10-20% visit lift for 2 days.",
        });
    } else if ((visits14?.count || 0) > 180) {
        recs.push({
            id: "rush-hour-control",
            title: "Rush Hour Control",
            reason: "Traffic is already high. Reduce reward cost temporarily.",
            mode: "multiplier",
            multiplier: 0.9,
            start_at: plusHours(1).toISOString(),
            end_at: plusHours(8).toISOString(),
            estimated_impact: "Expected: maintain traffic while lowering points cost.",
        });
    }

    recs.push({
        id: "festival-fixed-bonus",
        title: "Festival Bonus Campaign",
        reason: "Limited-time festive boost to attract local customers.",
        mode: "fixed",
        fixed_points: Math.min(STORE_SCHEDULE_MAX_POINTS, basePoints + 5),
        start_at: plusHours(24).toISOString(),
        end_at: plusHours(72).toISOString(),
        estimated_impact: "Expected: stronger conversion during campaign window.",
    });

    return recs.slice(0, 3);
}

function ymd(date) {
    return new Date(date).toISOString().slice(0, 10);
}

function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
    const d = new Date(year, monthIndex, 1);
    let count = 0;
    while (d.getMonth() === monthIndex) {
        if (d.getDay() === weekday) {
            count += 1;
            if (count === nth) return new Date(d);
        }
        d.setDate(d.getDate() + 1);
    }
    return null;
}

function lastWeekdayOfMonth(year, monthIndex, weekday) {
    const d = new Date(year, monthIndex + 1, 0);
    while (d.getMonth() === monthIndex) {
        if (d.getDay() === weekday) return new Date(d);
        d.setDate(d.getDate() - 1);
    }
    return null;
}

function getUSHolidaysForYear(year) {
    const holidays = [
        { id: "new-years-day", name: "New Year's Day", date: new Date(year, 0, 1) },
        { id: "mlk-day", name: "Martin Luther King Jr. Day", date: nthWeekdayOfMonth(year, 0, 1, 3) },
        { id: "presidents-day", name: "Presidents' Day", date: nthWeekdayOfMonth(year, 1, 1, 3) },
        { id: "memorial-day", name: "Memorial Day", date: lastWeekdayOfMonth(year, 4, 1) },
        { id: "juneteenth", name: "Juneteenth", date: new Date(year, 5, 19) },
        { id: "independence-day", name: "Independence Day", date: new Date(year, 6, 4) },
        { id: "labor-day", name: "Labor Day", date: nthWeekdayOfMonth(year, 8, 1, 1) },
        { id: "columbus-day", name: "Columbus Day", date: nthWeekdayOfMonth(year, 9, 1, 2) },
        { id: "veterans-day", name: "Veterans Day", date: new Date(year, 10, 11) },
        { id: "thanksgiving", name: "Thanksgiving", date: nthWeekdayOfMonth(year, 10, 4, 4) },
        { id: "christmas-day", name: "Christmas Day", date: new Date(year, 11, 25) },
    ];
    return holidays
        .filter((h) => h.date instanceof Date && !Number.isNaN(h.date.getTime()))
        .map((h) => ({ ...h, date_key: ymd(h.date) }));
}

function getUpcomingUSHolidays(daysAhead = 45) {
    const now = new Date();
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const pool = [
        ...getUSHolidaysForYear(now.getFullYear()),
        ...getUSHolidaysForYear(now.getFullYear() + 1),
    ];
    return pool
        .filter((h) => h.date >= now && h.date <= end)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getHolidaySuggestedRewardConfig(holidayId, basePoints) {
    const holidayMultipliers = {
        thanksgiving: 1.2,
        "christmas-day": 1.25,
        "independence-day": 1.2,
        "new-years-day": 1.15,
        "labor-day": 1.15,
    };
    const m = holidayMultipliers[holidayId] || 1.1;
    const boosted = normalizeScheduleFixedPoints(Math.round(basePoints * m));
    return {
        mode: "fixed",
        fixed_points: boosted,
        multiplier: null,
    };
}

async function getStoreHolidayReminderRows(storeId) {
    try {
        return await dbAllAsync(
            `SELECT holiday_id, holiday_date, action, reminder_sent_at, created_at, updated_at
             FROM store_reward_holiday_actions
             WHERE store_id = ?`,
            [storeId]
        );
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_holiday_actions")) {
            return [];
        }
        throw e;
    }
}

async function upsertStoreHolidayAction(storeId, holidayId, holidayDate, action) {
    await dbRunAsync(
        `INSERT INTO store_reward_holiday_actions (store_id, holiday_id, holiday_date, action, reminder_sent_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(store_id, holiday_id, holiday_date) DO UPDATE SET
           action = excluded.action,
           reminder_sent_at = excluded.reminder_sent_at,
           updated_at = CURRENT_TIMESTAMP`,
        [storeId, holidayId, holidayDate, action]
    );
}

async function buildStoreHolidayReminders(storeId, options = {}) {
    const { autoApplyIfAutoMode = false } = options;
    const prefs = await getStoreRewardPreferences(storeId);
    const offerRow = await dbGetAsync("SELECT reward_points FROM store_offers WHERE store_id = ?", [storeId]).catch(() => null);
    const basePoints = normalizeScheduleFixedPoints(Number(offerRow?.reward_points || 10));
    const upcoming = getUpcomingUSHolidays(45);
    const rows = await getStoreHolidayReminderRows(storeId);
    const actionMap = new Map(rows.map((r) => [`${r.holiday_id}:${r.holiday_date}`, r]));
    const reminders = [];

    for (const h of upcoming) {
        const key = `${h.id}:${h.date_key}`;
        const actionRow = actionMap.get(key);
        const suggested = getHolidaySuggestedRewardConfig(h.id, basePoints);
        const startAt = new Date(`${h.date_key}T00:00:00`);
        const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

        let action = actionRow?.action || null;
        let autoApplied = false;
        if (!action && autoApplyIfAutoMode && prefs.automation_mode === "auto") {
            const created = await createStoreRewardScheduleRecord(
                storeId,
                {
                    name: `${h.name} Auto Reward`,
                    reason: `Auto-applied for ${h.name}`,
                    mode: suggested.mode,
                    fixed_points: suggested.fixed_points,
                    multiplier: suggested.multiplier,
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString(),
                    is_active: 1,
                },
                { allowOverlap: false, defaultIsActive: 1 }
            ).catch(() => null);
            if (created) {
                await upsertStoreHolidayAction(storeId, h.id, h.date_key, "auto_mode_applied");
                action = "auto_mode_applied";
                autoApplied = true;
            }
        }

        reminders.push({
            id: `${h.id}-${h.date_key}`,
            holiday_id: h.id,
            holiday_name: h.name,
            holiday_date: h.date_key,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            suggested_mode: suggested.mode,
            suggested_fixed_points: suggested.fixed_points,
            suggested_multiplier: suggested.multiplier,
            action,
            auto_applied: autoApplied,
        });
    }

    return { reminders, preferences: prefs };
}

async function getActiveRewardScheduleForStore(storeId, now = new Date()) {
    try {
        return await dbGetAsync(
            `SELECT id, name, reason, mode, fixed_points, multiplier, start_at, end_at
             FROM store_reward_point_schedules
             WHERE store_id = ? AND is_active = 1
               AND start_at <= ? AND end_at >= ?
             ORDER BY start_at DESC, created_at DESC
             LIMIT 1`,
            [storeId, now.toISOString(), now.toISOString()]
        );
    } catch (e) {
        if (String(e.message || "").includes("no such table: store_reward_point_schedules")) {
            return null;
        }
        throw e;
    }
}

async function getEffectiveStoreRewardPoints(storeId, fallbackPoints) {
    const fallback = normalizeScheduleFixedPoints(fallbackPoints);
    const activeSchedule = await getActiveRewardScheduleForStore(storeId, new Date());
    if (!activeSchedule) {
        return { effectivePoints: fallback, activeSchedule: null };
    }

    let effectivePoints = fallback;
    if (String(activeSchedule.mode || "fixed") === "multiplier") {
        const m = normalizeScheduleMultiplier(activeSchedule.multiplier);
        effectivePoints = normalizeScheduleFixedPoints(Math.round(fallback * m));
    } else {
        effectivePoints = normalizeScheduleFixedPoints(activeSchedule.fixed_points);
    }

    return {
        effectivePoints,
        activeSchedule: {
            id: activeSchedule.id,
            name: activeSchedule.name,
            reason: activeSchedule.reason,
            mode: activeSchedule.mode,
            fixed_points: activeSchedule.fixed_points,
            multiplier: activeSchedule.multiplier,
            start_at: activeSchedule.start_at,
            end_at: activeSchedule.end_at,
        },
    };
}

// Helper: Generate unique gift card code
function generateGiftCardCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing characters
    let code = 'GC-';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create gift card (redeem points)
app.post("/api/users/gift-cards/create", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { loopsAmount, storeId, cardType } = req.body;
    const sid = Number(storeId);

    if (!Number.isFinite(sid) || sid <= 0) {
        return res.status(400).json({ error: "storeId is required to create a gift card" });
    }
    
    // Validate card type (default to 'digital')
    const giftCardType = cardType === 'physical' ? 'physical' : 'digital';
    
    const loopsToRedeem = Math.floor(Number(loopsAmount));
    if (!loopsToRedeem || loopsToRedeem <= 0) {
        return res.status(400).json({ error: "Invalid loops amount" });
    }
    const cycleMonth = getCycleMonth();
    
    // Calculate gift card value (100 Loops = $1)
    const giftCardValue = loopsToRedeem / GIFT_CARD_EXCHANGE_RATE;

    db.get(
        `SELECT CASE WHEN
            (SELECT COUNT(*) FROM store_memberships WHERE user_id = ? AND store_id = ? AND status = 'active') > 0 OR
            (SELECT COUNT(*) FROM store_slots WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active') > 0 OR
            (SELECT COUNT(*) FROM store_unlocks WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active') > 0
         THEN 1 ELSE 0 END AS is_enrolled`,
        [userId, sid, userId, sid, cycleMonth, userId, sid, cycleMonth],
        (enrollErr, enrolled) => {
            if (enrollErr) {
                return res.status(500).json({ error: "Failed to validate store enrollment" });
            }
            if (!enrolled || enrolled.is_enrolled !== 1) {
                return res.status(403).json({ error: "You can only create gift cards for enrolled stores" });
            }

            db.get(
                "SELECT gift_card_min_loops FROM store_offers WHERE store_id = ?",
                [sid],
                (offerErr, offerRow) => {
                    if (offerErr) {
                        return res.status(500).json({ error: "Failed to read store gift card eligibility" });
                    }
                    const requiredMinLoops = normalizeGiftCardMinLoops(offerRow?.gift_card_min_loops);
                    if (loopsToRedeem < requiredMinLoops) {
                        return res.status(400).json({
                            error: `Minimum ${requiredMinLoops} Loops required for this store's gift card.`
                        });
                    }
    
    // Get user current balance
    db.get("SELECT loops_balance FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        (async () => {
            const availableForStore = await getUserStoreLoopsBalance(userId, sid);
            if (availableForStore < loopsToRedeem) {
            return res.status(400).json({ 
                    error: `Insufficient store Loops. You have ${availableForStore} at this store, need ${loopsToRedeem}`
            });
        }
        
        // Generate unique gift card code
        const giftCardCode = generateGiftCardCode();
        
        // Calculate expiry date (90 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + GIFT_CARD_VALIDITY_DAYS);
        
        // For physical cards, they are created but not issued until store issues them
        // For digital cards, they are immediately available
        const issuedAt = giftCardType === 'digital' ? new Date().toISOString() : null;
        
        // Create gift card
        db.run(
            `INSERT INTO gift_cards (code, user_id, store_id, original_value, current_balance, loops_used, expires_at, card_type, issued_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [giftCardCode, userId, sid, giftCardValue, giftCardValue, loopsToRedeem, expiresAt.toISOString(), giftCardType, issuedAt],
            function(err2) {
                if (err2) {
                    return res.status(500).json({ error: "Failed to create gift card" });
                }
                
                const giftCardId = this.lastID;
                
                // Record transaction
                db.run(
                    `INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, payment_method, loops_used, description)
                     VALUES (?, 'create', ?, 'points', ?, ?)`,
                    [giftCardId, giftCardValue, loopsToRedeem, `Gift card created with ${loopsToRedeem} Loops`]
                );
                
                // Update user balance
                const newBalance = user.loops_balance - loopsToRedeem;
                db.run(
                    "UPDATE users SET loops_balance = ? WHERE id = ?",
                    [newBalance, userId]
                );
                
                // Record in ledger
                db.run(
                    "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'REDEEM', ?, ?)",
                    [userId, -loopsToRedeem, `gift_card:${giftCardId}:${giftCardCode}:store:${sid}`]
                );
                
                // Check for settlement triggers (redemption unlocks pending points)
                    setTimeout(() => {
                    checkSettlementTriggers(userId, sid, () => {});
                    }, 500);
                
                // Get created gift card
                db.get(
                    "SELECT * FROM gift_cards WHERE id = ?",
                    [giftCardId],
                    (err3, giftCard) => {
                        if (err3 || !giftCard) {
                            return res.status(500).json({ error: "Gift card created but failed to retrieve" });
                        }
                        
                        res.json({
                            success: true,
                            giftCard: {
                                id: giftCard.id,
                                code: giftCard.code,
                                value: giftCard.current_balance,
                                loopsUsed: loopsToRedeem,
                                expiresAt: giftCard.expires_at,
                                daysValid: GIFT_CARD_VALIDITY_DAYS,
                                cardType: giftCardType
                            },
                            newBalance,
                            message: giftCardType === 'physical' 
                                ? `Physical gift card requested! Code: ${giftCardCode}, Value: $${giftCardValue.toFixed(2)}. Please visit the store to pick up your physical card.`
                                : `Digital gift card created! Code: ${giftCardCode}, Value: $${giftCardValue.toFixed(2)}, Valid for ${GIFT_CARD_VALIDITY_DAYS} days`
                        });
                    }
                );
            }
        );
                    })().catch(() => res.status(500).json({ error: "Failed to create gift card" }));
            }
        );
    });
        }
    );
});

// Check gift card eligibility (minimum points) - MUST come before /api/users/gift-cards/:id
app.get("/api/users/gift-cards/eligibility", auth("user"), (req, res) => {
    (async () => {
    const userId = req.user.id;
        const sid = Number(req.query.store_id || 0);
        const useStoreScopedBalance = Number.isFinite(sid) && sid > 0;
        const requiredMinLoops = useStoreScopedBalance
            ? normalizeGiftCardMinLoops((await dbGetAsync("SELECT gift_card_min_loops FROM store_offers WHERE store_id = ?", [sid]))?.gift_card_min_loops)
            : MIN_POINTS_FOR_GIFT_CARD;

        const currentBalance = useStoreScopedBalance
            ? await getUserStoreLoopsBalance(userId, sid)
            : Number((await dbGetAsync("SELECT loops_balance FROM users WHERE id = ?", [userId]))?.loops_balance || 0);

        const isEligible = currentBalance >= requiredMinLoops;
        const pointsNeeded = isEligible ? 0 : requiredMinLoops - currentBalance;

        return res.json({
            isEligible,
            currentBalance,
            storeScoped: useStoreScopedBalance,
            storeId: useStoreScopedBalance ? sid : null,
            minimumRequired: requiredMinLoops,
            pointsNeeded,
            exchangeRate: GIFT_CARD_EXCHANGE_RATE,
            message: isEligible 
                ? `You're eligible! Minimum ${requiredMinLoops} Loops required. 100 Loops = $1 gift card.`
                : `You need ${pointsNeeded} more Loops to be eligible for a gift card. Minimum ${requiredMinLoops} Loops required.`
        });
    })().catch(() => res.status(500).json({ error: "Failed to check gift card eligibility" }));
});

// Get user's gift cards
app.get("/api/users/gift-cards", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { status } = req.query;
    
    let query = "SELECT * FROM gift_cards WHERE user_id = ?";
    const params = [userId];
    
    if (status) {
        query += " AND status = ?";
        params.push(status);
    } else {
        // Default: only active gift cards
        query += " AND status = 'active'";
    }
    
    query += " ORDER BY created_at DESC";
    
    db.all(query, params, (err, giftCards) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        // Calculate days remaining for each gift card
        const now = new Date();
        const giftCardsWithDays = (giftCards || []).map(card => {
            const expiresAt = new Date(card.expires_at);
            const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            return {
                ...card,
                daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
                isExpired: daysRemaining <= 0 && card.status === 'active'
            };
        });
        
        res.json({ giftCards: giftCardsWithDays });
    });
});

// Get specific gift card details - MUST come after /eligibility route
app.get("/api/users/gift-cards/:id", auth("user"), (req, res) => {
    const userId = req.user.id;
    const giftCardId = parseInt(req.params.id);
    
    if (isNaN(giftCardId)) {
        return res.status(400).json({ error: "Invalid gift card ID" });
    }
    
    db.get(
        "SELECT * FROM gift_cards WHERE id = ? AND user_id = ?",
        [giftCardId, userId],
        (err, giftCard) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!giftCard) {
                return res.status(404).json({ error: "Gift card not found" });
            }
            
            // Calculate days remaining
            const now = new Date();
            const expiresAt = new Date(giftCard.expires_at);
            const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            // Get transactions
            db.all(
                "SELECT * FROM gift_card_transactions WHERE gift_card_id = ? ORDER BY created_at DESC",
                [giftCardId],
                (err2, transactions) => {
                    if (err2) {
                    }
                    
                    res.json({
                        giftCard: {
                            ...giftCard,
                            daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
                            isExpired: daysRemaining <= 0 && giftCard.status === 'active'
                        },
                        transactions: transactions || []
                    });
                }
            );
        }
    );
});

// Top-up gift card (support both /topup and /top-up for compatibility)
app.post(["/api/users/gift-cards/:id/top-up", "/api/users/gift-cards/:id/topup"], auth("user"), (req, res) => {
    const userId = req.user.id;
    const giftCardId = parseInt(req.params.id);
    const { amount, paymentMethod, loopsAmount, cashAmount } = req.body;
    
    if (isNaN(giftCardId)) {
        return res.status(400).json({ error: "Invalid gift card ID" });
    }
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid top-up amount" });
    }
    
    const topUpAmount = parseFloat(amount);
    
    // Get gift card
    db.get(
        "SELECT * FROM gift_cards WHERE id = ? AND user_id = ?",
        [giftCardId, userId],
        (err, giftCard) => {
            if (err || !giftCard) {
                return res.status(404).json({ error: "Gift card not found" });
            }
            
            if (giftCard.status !== 'active') {
                return res.status(400).json({ error: "Gift card is not active" });
            }
            
            // Check payment method
            if (paymentMethod === 'points') {
                const loopsNeeded = Math.floor(topUpAmount * GIFT_CARD_EXCHANGE_RATE);
                const sid = Number(giftCard.store_id || 0);
                if (!sid) {
                    return res.status(400).json({ error: "This gift card is not tied to a store. Top-up is not allowed." });
                }
                
                // Get user balance
                db.get("SELECT loops_balance FROM users WHERE id = ?", [userId], (err2, user) => {
                    if (err2 || !user) {
                        return res.status(404).json({ error: "User not found" });
                    }
                    (async () => {
                        const availableForStore = await getUserStoreLoopsBalance(userId, sid);
                        if (availableForStore < loopsNeeded) {
                        return res.status(400).json({ 
                                error: `Insufficient store Loops. You have ${availableForStore} at this store, need ${loopsNeeded}`
                        });
                    }
                    
                    // Update gift card balance
                    const newBalance = giftCard.current_balance + topUpAmount;
                    const newExpiresAt = new Date();
                    newExpiresAt.setDate(newExpiresAt.getDate() + GIFT_CARD_VALIDITY_DAYS); // Extend expiry
                    
                    db.run(
                        "UPDATE gift_cards SET current_balance = ?, expires_at = ? WHERE id = ?",
                        [newBalance, newExpiresAt.toISOString(), giftCardId]
                    );
                    
                    // Record transaction
                    db.run(
                        `INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, payment_method, loops_used, description)
                         VALUES (?, 'topup', ?, 'points', ?, ?)`,
                        [giftCardId, topUpAmount, loopsNeeded, `Topped up with ${loopsNeeded} Loops`]
                    );
                    
                    // Update user balance
                        const newUserBalance = Math.max(0, (user.loops_balance || 0) - loopsNeeded);
                    db.run(
                        "UPDATE users SET loops_balance = ? WHERE id = ?",
                        [newUserBalance, userId]
                    );
                    
                    // Record in ledger
                    db.run(
                        "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'REDEEM', ?, ?)",
                        [userId, -loopsNeeded, `gift_card_topup:${giftCardId}:store:${sid}`]
                    );
                    
                    res.json({
                        success: true,
                        giftCard: {
                            id: giftCard.id,
                            code: giftCard.code,
                            newBalance,
                            expiresAt: newExpiresAt.toISOString()
                        },
                        newUserBalance,
                        message: `Gift card topped up! New balance: $${newBalance.toFixed(2)}, Valid for ${GIFT_CARD_VALIDITY_DAYS} days`
                    });
                    })().catch(() => res.status(500).json({ error: "Failed to top up gift card" }));
                });
            } else {
                // Cash/card payment (for future implementation)
                return res.status(400).json({ error: "Cash/card payment not yet implemented. Please use points." });
            }
        }
    );
});

// Store: Scan gift card QR code
app.post("/api/stores/scan-gift-card", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    const { qrCode } = req.body;
    
    if (!qrCode) {
        return res.status(400).json({ error: "QR code is required" });
    }
    
    // Parse QR code: GIFT-CARD:code or GC-XXXXX
    let giftCardCode = qrCode;
    if (qrCode.startsWith("GIFT-CARD:")) {
        giftCardCode = qrCode.split(":")[1];
    }
    
    // Get gift card
    db.get(
        "SELECT gc.*, u.name as user_name, u.phone as user_phone FROM gift_cards gc JOIN users u ON gc.user_id = u.id WHERE gc.code = ?",
        [giftCardCode],
        (err, giftCard) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!giftCard) {
                return res.status(404).json({ error: "Gift card not found" });
            }
            
            // Check if expired
            const now = new Date();
            const expiresAt = new Date(giftCard.expires_at);
            const isExpired = expiresAt < now;
            
            if (giftCard.status !== 'active') {
                return res.json({
                    valid: false,
                    error: `Gift card status: ${giftCard.status}`,
                    giftCard: {
                        code: giftCard.code,
                        balance: giftCard.current_balance,
                        status: giftCard.status
                    }
                });
            }
            
            if (isExpired) {
                // Mark as expired
                db.run(
                    "UPDATE gift_cards SET status = 'expired' WHERE id = ?",
                    [giftCard.id]
                );
                
                return res.json({
                    valid: false,
                    error: "Gift card has expired",
                    giftCard: {
                        code: giftCard.code,
                        balance: giftCard.current_balance,
                        status: 'expired'
                    }
                });
            }
            
            // Check if store-specific (if store_id is set, must match)
            if (giftCard.store_id && giftCard.store_id !== storeId) {
                return res.json({
                    valid: false,
                    error: "This gift card is only valid at a different store",
                    giftCard: {
                        code: giftCard.code,
                        balance: giftCard.current_balance
                    }
                });
            }
            
            res.json({
                valid: true,
                giftCard: {
                    id: giftCard.id,
                    code: giftCard.code,
                    balance: giftCard.current_balance,
                    customerName: giftCard.user_name,
                    customerPhone: giftCard.user_phone,
                    expiresAt: giftCard.expires_at
                }
            });
        }
    );
});

// Store: List pending physical gift cards (not yet issued)
app.get("/api/stores/pending-physical-gift-cards", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    
    // Get all physical gift cards that are not yet issued (issued_at is NULL)
    // and are for this store (or any store if store_id is NULL)
    db.all(
        `SELECT gc.*, u.name as customer_name, u.phone as customer_phone 
         FROM gift_cards gc 
         JOIN users u ON gc.user_id = u.id 
         WHERE gc.card_type = 'physical' 
         AND gc.status = 'active' 
         AND gc.issued_at IS NULL 
         AND (gc.store_id = ? OR gc.store_id IS NULL)
         ORDER BY gc.created_at DESC`,
        [storeId],
        (err, giftCards) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            // Calculate days remaining for each
            const now = new Date();
            const giftCardsWithDays = (giftCards || []).map(card => {
                const expiresAt = new Date(card.expires_at);
                const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                
                return {
                    ...card,
                    daysRemaining: daysRemaining > 0 ? daysRemaining : 0
                };
            });
            
            res.json({
                giftCards: giftCardsWithDays,
                count: giftCardsWithDays.length
            });
        }
    );
});

// Store: Issue physical gift card (mark as issued and hand over to customer)
app.post("/api/stores/issue-physical-gift-card/:id", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    const storeUserId = req.user.storeId; // Store user ID
    const giftCardId = parseInt(req.params.id);
    
    if (isNaN(giftCardId)) {
        return res.status(400).json({ error: "Invalid gift card ID" });
    }
    
    // Get gift card
    db.get(
        `SELECT gc.* FROM gift_cards gc 
         WHERE gc.id = ? 
         AND gc.card_type = 'physical' 
         AND gc.status = 'active' 
         AND gc.issued_at IS NULL 
         AND (gc.store_id = ? OR gc.store_id IS NULL)`,
        [giftCardId, storeId],
        (err, giftCard) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!giftCard) {
                return res.status(404).json({ error: "Physical gift card not found or already issued" });
            }
            
            // Mark as issued
            const issuedAt = new Date().toISOString();
            db.run(
                `UPDATE gift_cards 
                 SET issued_at = ?, issued_by_store_id = ?, issued_by_user_id = ? 
                 WHERE id = ?`,
                [issuedAt, storeId, storeUserId, giftCardId],
                (err2) => {
                    if (err2) {
                        return res.status(500).json({ error: "Failed to issue gift card" });
                    }
                    
                    // Record transaction
                    db.run(
                        `INSERT INTO gift_card_transactions 
                         (gift_card_id, transaction_type, amount, payment_method, description, store_id) 
                         VALUES (?, 'issue', ?, 'points', ?, ?)`,
                        [giftCardId, giftCard.current_balance, `Physical gift card issued at store`, storeId]
                    );
                    
                    res.json({
                        success: true,
                        message: "Physical gift card issued successfully!",
                        giftCard: {
                            id: giftCard.id,
                            code: giftCard.code,
                            value: giftCard.current_balance,
                            issuedAt: issuedAt
                        }
                    });
                }
            );
        }
    );
});

// Store: Use gift card (apply discount to purchase)
app.post("/api/stores/use-gift-card", auth("store"), (req, res) => {
    const storeId = req.user.storeId;
    const { giftCardId, purchaseAmount, amountToUse } = req.body;
    
    if (!giftCardId || !purchaseAmount) {
        return res.status(400).json({ error: "giftCardId and purchaseAmount are required" });
    }
    
    const purchase = parseFloat(purchaseAmount);
    const useAmount = amountToUse ? parseFloat(amountToUse) : null;
    
    // Get gift card
    db.get(
        "SELECT * FROM gift_cards WHERE id = ?",
        [giftCardId],
        (err, giftCard) => {
            if (err || !giftCard) {
                return res.status(404).json({ error: "Gift card not found" });
            }
            
            if (giftCard.status !== 'active') {
                return res.status(400).json({ error: `Gift card is ${giftCard.status}` });
            }
            
            // Check if expired
            const now = new Date();
            const expiresAt = new Date(giftCard.expires_at);
            if (expiresAt < now) {
                db.run("UPDATE gift_cards SET status = 'expired' WHERE id = ?", [giftCard.id]);
                return res.status(400).json({ error: "Gift card has expired" });
            }
            
            // Calculate amount to use
            const actualUseAmount = useAmount ? Math.min(useAmount, giftCard.current_balance, purchase) : Math.min(giftCard.current_balance, purchase);
            
            if (actualUseAmount <= 0) {
                return res.status(400).json({ error: "Cannot use gift card. Balance too low or purchase amount too small" });
            }
            
            // Update gift card balance
            const newBalance = giftCard.current_balance - actualUseAmount;
            const finalBalance = newBalance;
            const newStatus = finalBalance <= 0 ? 'used' : 'active';
            const usedAt = finalBalance <= 0 ? new Date().toISOString() : null;
            
            db.run(
                "UPDATE gift_cards SET current_balance = ?, status = ?, used_at = ? WHERE id = ?",
                [finalBalance, newStatus, usedAt, giftCard.id]
            );
            
            // Record transaction
            db.run(
                `INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, description, store_id)
                 VALUES (?, 'usage', ?, ?, ?)`,
                [giftCard.id, -actualUseAmount, `Used at purchase of $${purchase.toFixed(2)}`, storeId]
            );
            
            // Get store name for response
            db.get("SELECT name FROM stores WHERE id = ?", [storeId], (err2, store) => {
                const storeName = store ? store.name : "Store";
                
                res.json({
                    success: true,
                    giftCard: {
                        id: giftCard.id,
                        code: giftCard.code,
                        newBalance: finalBalance,
                        status: newStatus
                    },
                    discountApplied: actualUseAmount,
                    remainingPurchase: purchase - actualUseAmount,
                    message: `Gift card used! Discount: $${actualUseAmount.toFixed(2)}, Remaining balance: $${finalBalance.toFixed(2)}`
                });
            });
        }
    );
});

// ---------- nearby stores (for map) ----------

app.get("/api/stores/nearby", (req, res) => {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) {
        return res
            .status(400)
            .json({ error: "lat and lng query params are required" });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = parseFloat(radius || "0.6"); // default 0.6 miles

    db.all(
        "SELECT id, name, zone, category, base_discount_percent, phone, latitude, longitude FROM stores WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_local = 1 AND (zone IS NULL OR zone != 'OSM')",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "DB error" });
            }

            const enriched = rows
                .map((row) => {
                    const distance = haversineMiles(
                        userLat,
                        userLng,
                        row.latitude,
                        row.longitude
                    );
                    return {
                        id: row.id,
                        name: row.name,
                        category: row.category,
                        zone: row.zone,
                        phone: row.phone,
                        base_discount_percent: row.base_discount_percent,
                        latitude: row.latitude,
                        longitude: row.longitude,
                        distance_miles: distance,
                    };
                })
                .filter(
                    (r) => !Number.isNaN(r.distance_miles) && r.distance_miles <= maxRadius
                )
                .sort((a, b) => a.distance_miles - b.distance_miles);

            res.json(enriched);
        }
    );
});

// ---------- nearby stores from OSM (real places) ----------
/* OSM DISABLED START
app.get("/api/stores/nearby-osm", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const radius = parseFloat(req.query.radius || "5");
        const autoImport = req.query.import === "1";

        const user = await dbGetAsync(
            "SELECT latitude, longitude FROM users WHERE id = ?",
            [userId]
        );

        if (!user || user.latitude == null || user.longitude == null) {
            return res.status(400).json({ error: "User location not set" });
        }

        let stores = await fetchOsmNearbyStores(user.latitude, user.longitude, radius);

        let importedCount = 0;
        if (autoImport && stores.length > 0) {
            const unclaimedHash = bcrypt.hashSync("unclaimed_store", 10);
            for (const s of stores) {
                const existing = await dbGetAsync(
                    `SELECT id FROM stores 
                     WHERE lower(name) = lower(?) 
                     AND ABS(latitude - ?) < 0.0001 
                     AND ABS(longitude - ?) < 0.0001`,
                    [s.name, s.latitude, s.longitude]
                );

                if (!existing) {
                    await dbRunAsync(
                        `INSERT INTO stores 
                         (email, phone, password_hash, name, zone, category, base_discount_percent, latitude, longitude, address, is_local) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            null,
                            s.phone || null,
                            unclaimedHash,
                            s.name,
                            "OSM",
                            s.category || "other",
                            0,
                            s.latitude,
                            s.longitude,
                            s.address || null,
                            1
                        ]
                    );
                    importedCount += 1;
                }
            }
        }

        res.json({
            radius,
            count: stores.length,
            importedCount,
            stores
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch OSM stores", details: e?.message || String(e) });
    }
});
OSM DISABLED END */

// ---------- nearby eligible stores (plan-based, live Google data) ----------
app.get("/api/stores/nearby-eligible", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const radius = parseFloat(req.query.radius || "1"); // miles
        const category = req.query.category || null;
        const query = String(req.query.query || "").trim();
        const maxResults = Math.max(5, Math.min(100, parseInt(req.query.maxResults || "30")));
        const autoImport = req.query.import === "1";
        const cycleMonth = getCycleMonth();

        const user = await dbGetAsync(
            "SELECT id, latitude, longitude, plan FROM users WHERE id = ?",
            [userId]
        );

        if (!user || user.latitude == null || user.longitude == null) {
            return res.status(400).json({ error: "User location not set" });
        }

        const limit = getPlanStoreLimit(user.plan);
        const allowedTiers = getPlanAllowedTiers(user.plan);
        const unlockLimit = getPlanUnlockLimit(user.plan);
        const allowedCategories = getPlanAllowedCategories(user.plan);

        let storeRows = await dbAllAsync(
            `SELECT s.id, s.name, s.category, s.phone, s.address, s.latitude, s.longitude, s.place_id,
                    s.base_discount_percent, s.email, s.password_hash, s.zone, s.claimed_at, s.qr_code,
                    (SELECT COUNT(*) FROM check_in_sessions WHERE store_id = s.id AND status = 'completed') AS check_in_count,
                    (SELECT COUNT(*) FROM transactions WHERE store_id = s.id) AS transaction_count,
                    o.reward_tier, o.reward_points, o.unlock_cost_cents, o.unlock_cost_loops, o.is_locked, o.min_plan, o.news AS offer_news, o.gift_card_min_loops
             FROM stores s
             LEFT JOIN store_offers o ON o.store_id = s.id
             WHERE s.latitude IS NOT NULL
               AND s.longitude IS NOT NULL
               AND s.is_local = 1
               AND (s.zone IS NULL OR s.zone != 'OSM')`
        );

        const queryTokens = query
            ? query
                .toLowerCase()
                .split(/\s+/)
                .filter((t) => t && !["store", "stores", "shop", "near", "nearby", "the"].includes(t))
            : [];

        if (autoImport) {
            let googleStores = [];
            if (query) {
                googleStores = await fetchGoogleNearbyStores(
                    user.latitude,
                    user.longitude,
                    radius,
                    query,
                    {
                        includeOther: true,
                        preferNameCategory: true,
                        category,
                    }
                );
            } else {
                googleStores = await fetchGoogleNearbyStores(
                    user.latitude,
                    user.longitude,
                    radius,
                    "all",
                    {
                        includeOther: true,
                        preferNameCategory: true,
                        category,
                    }
                );
            }

            if (googleStores.length > 0) {
                const unclaimedHash = bcrypt.hashSync("unclaimed_store", 10);
                const phoneLookupLimit = 30;
                let phoneLookups = 0;
                for (const s of googleStores) {
                const existing = s.place_id
                    ? await dbGetAsync(
                        "SELECT id FROM stores WHERE place_id = ?",
                        [s.place_id]
                    )
                    : await dbGetAsync(
                        `SELECT id FROM stores 
                         WHERE lower(name) = lower(?) 
                         AND lower(category) = lower(?)
                         AND ABS(latitude - ?) < 0.0005 
                         AND ABS(longitude - ?) < 0.0005`,
                        [s.name, s.category || "other", s.latitude, s.longitude]
                    );

                    if (!existing) {
                        await dbRunAsync(
                            `INSERT INTO stores 
                             (email, phone, password_hash, name, zone, category, base_discount_percent, latitude, longitude, address, place_id, is_local) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                null,
                                s.phone || null,
                                unclaimedHash,
                                s.name,
                                "GOOGLE",
                                s.category || "other",
                                0,
                                s.latitude,
                                s.longitude,
                                s.address || null,
                                s.place_id || null,
                                1
                            ]
                        );
                    } else if (s.place_id || s.address || s.phone) {
                        await dbRunAsync(
                            `UPDATE stores
                             SET place_id = COALESCE(place_id, ?),
                                 address = COALESCE(address, ?),
                                 phone = COALESCE(phone, ?)
                             WHERE id = ?`,
                            [s.place_id || null, s.address || null, s.phone || null, existing.id]
                        );
                    }

                    if (AUTO_BACKFILL_PHONES && s.place_id && phoneLookups < phoneLookupLimit) {
                        const phoneCandidate = s.phone && String(s.phone).trim();
                        if (!phoneCandidate) {
                            try {
                                const details = await fetchGooglePlaceDetailsData(s.place_id);
                                if (details.phone) {
                                    await dbRunAsync(
                                        "UPDATE stores SET phone = COALESCE(phone, ?) WHERE place_id = ?",
                                        [details.phone, s.place_id]
                                    );
                                }
                                phoneLookups += 1;
                            } catch (e) {
                            }
                        }
                    }
                }

                // NOTE: phone/place_id enrichment is admin-only by default to reduce Google API calls.

                storeRows = await dbAllAsync(
                    `SELECT s.id, s.name, s.category, s.phone, s.address, s.latitude, s.longitude, s.place_id,
                            s.base_discount_percent, s.email, s.password_hash, s.zone, s.claimed_at, s.qr_code,
                            (SELECT COUNT(*) FROM check_in_sessions WHERE store_id = s.id AND status = 'completed') AS check_in_count,
                            (SELECT COUNT(*) FROM transactions WHERE store_id = s.id) AS transaction_count,
                            o.reward_tier, o.reward_points, o.unlock_cost_cents, o.unlock_cost_loops, o.is_locked, o.min_plan, o.news AS offer_news, o.gift_card_min_loops
                     FROM stores s
                     LEFT JOIN store_offers o ON o.store_id = s.id
                     WHERE s.latitude IS NOT NULL
                       AND s.longitude IS NOT NULL
                       AND s.is_local = 1
                       AND (s.zone IS NULL OR s.zone != 'OSM')`
                );
            }
        }

        const slotRows = await dbAllAsync(
            "SELECT store_id FROM store_slots WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, cycleMonth]
        );
        const activeStoreIds = slotRows.map((r) => r.store_id);
        const activeCount = slotRows.length;

        const unlockRows = await dbAllAsync(
            "SELECT store_id FROM store_unlocks WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, cycleMonth]
        );
        const unlockedStoreIds = new Set(unlockRows.map((r) => r.store_id));
        const unlockCount = unlockRows.length;

        // Fetch user's store requests to mark which stores they've already requested
        const requestRows = await dbAllAsync(
            `SELECT requested_store_ref, requested_store_name
             FROM store_onboarding_requests
             WHERE user_id = ? AND status = 'pending'`,
            [userId]
        );
        const requestedStoreRefs = new Set((requestRows || []).map((r) => r.requested_store_ref).filter(Boolean));
        const requestedStoreNames = new Set((requestRows || []).map((r) => String(r.requested_store_name || "").trim().toLowerCase()).filter(Boolean));

        // Fetch request counts per store to check if stores have reached max requests
        const storeRequestCounts = await dbAllAsync(
            `SELECT 
                requested_store_ref,
                requested_store_name,
                COUNT(*) as request_count
             FROM store_onboarding_requests
             WHERE status = 'pending'
             GROUP BY requested_store_ref, requested_store_name`
        );
        const storeRequestCountMap = new Map();
        (storeRequestCounts || []).forEach((row) => {
            const ref = row.requested_store_ref;
            const name = String(row.requested_store_name || "").trim().toLowerCase();
            if (ref) storeRequestCountMap.set(`ref:${ref}`, row.request_count);
            if (name) storeRequestCountMap.set(`name:${name}`, row.request_count);
        });

        const scored = storeRows
            .map((row) => {
                const distance = haversineMiles(
                    user.latitude,
                    user.longitude,
                    row.latitude,
                    row.longitude
                );
                if (Number.isNaN(distance) || distance > radius) return null;
                if (category && row.category !== category) return null;
                if (!matchesQuery(row, queryTokens)) return null;
                if (!allowedCategories.includes(row.category)) return null;
                const hasPhone = !!(row.phone && String(row.phone).trim());
                const hasAddress = !!(row.address && String(row.address).trim());
                if (!hasPhone && !hasAddress) return null;

                const rewardPoints = Number.isFinite(row.reward_points) ? row.reward_points : 0;
                const rewardBase = rewardPoints > 0 ? rewardPoints : (row.base_discount_percent || 0);
                const inferred = getDefaultOfferFromPoints(rewardBase);
                const rewardTier =
                    row.reward_tier &&
                    !(row.reward_tier === "standard" && rewardPoints === 0 && inferred.reward_tier !== "standard")
                        ? row.reward_tier
                        : inferred.reward_tier;
                const minPlan = row.min_plan || inferred.min_plan;
                let unlockCostCents = row.unlock_cost_cents || 0;
                let unlockCostLoops = row.unlock_cost_loops || 0;
                if (unlockCostCents === 0 && unlockCostLoops === 0 && rewardTier !== "standard") {
                    unlockCostCents = inferred.unlock_cost_cents;
                    unlockCostLoops = inferred.unlock_cost_loops;
                }
                const offerLockedFlag =
                    row.is_locked != null &&
                    !(row.is_locked === 0 && rewardPoints === 0 && inferred.is_locked === 1)
                        ? row.is_locked
                        : inferred.is_locked;
                const isUnlocked = unlockedStoreIds.has(row.id);
                const meetsMinPlan = isPlanAtLeast(user.plan, minPlan);
                const tierAllowed = allowedTiers.includes(rewardTier);
                const requiresPayment = !isUnlocked && limit > 0 && activeCount >= limit;

                let lockedReason = null;
                let isLocked = false;

                if (requiresPayment && unlockCostCents === 0 && unlockCostLoops === 0) {
                    unlockCostCents = 299;
                    unlockCostLoops = 300;
                }

                const unlockable =
                    isLocked &&
                    unlockCount < unlockLimit &&
                    (unlockCostCents > 0 || unlockCostLoops > 0);

                const rewardWeight = getPlanRewardWeight(user.plan);
                const score =
                    computeStoreScore(distance, 0, false) + (rewardBase / 100) * rewardWeight;

                // Mark store as partner: if store is claimed (has QR code) OR has active customer check-ins/transactions
                // A store is "on CityCircle" if:
                // 1. It has been claimed by an owner (claimed_at IS NOT NULL) - means store has QR code
                // 2. OR customers are actively using it (has check-ins or transactions)
                // Non-partner stores are those that haven't been claimed and have no customer activity
                const isClaimed = !!(row.claimed_at || row.qr_code);
                const hasCustomerActivity = !!(row.check_in_count > 0 || row.transaction_count > 0);
                const isPartnerStore = !!(row.id && (isClaimed || hasCustomerActivity));

                // Check if user has already requested this store
                const storeNameNormalized = String(row.name || "").trim().toLowerCase();
                const isRequested = !!(row.place_id && requestedStoreRefs.has(row.place_id)) ||
                                   (storeNameNormalized && requestedStoreNames.has(storeNameNormalized));

                // Check if store has reached max requests or is already signed up
                const storeRequestCount = row.place_id 
                    ? (storeRequestCountMap.get(`ref:${row.place_id}`) || 0)
                    : (storeRequestCountMap.get(`name:${storeNameNormalized}`) || 0);
                const hasReachedMaxRequests = storeRequestCount >= MAX_REQUESTS_PER_STORE;
                const isStoreSignedUp = isPartnerStore; // If store is partner, it's already signed up
                const canRequestStore = !isStoreSignedUp && !hasReachedMaxRequests;

                return {
                    id: row.id,
                    name: row.name,
                    category: row.category,
                    phone: row.phone,
                    address: row.address,
                    place_id: row.place_id,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    distance_miles: distance,
                    base_discount_percent: row.base_discount_percent,
                    reward_tier: rewardTier,
                    reward_points: rewardPoints,
                    unlock_cost_cents: unlockCostCents || 0,
                    unlock_cost_loops: unlockCostLoops || 0,
                    is_locked: !!isLocked,
                    locked_reason: lockedReason,
                    is_unlocked: isUnlocked,
                    min_plan: minPlan,
                    gift_card_min_loops: normalizeGiftCardMinLoops(row.gift_card_min_loops),
                    news: row.offer_news || null,
                    unlockable,
                    score,
                    is_partner_store: isPartnerStore,
                    is_requested: isRequested,
                    can_request_store: canRequestStore,
                    store_request_count: storeRequestCount,
                    max_requests_reached: hasReachedMaxRequests
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);

        const activeIdSet = new Set(activeStoreIds);
        const unlockedIdSet = new Set(Array.from(unlockedStoreIds));
        const dedupeMap = new Map();
        const nameHasAddress = new Map();

        for (const store of scored) {
            const catKey = String(store.category || "").trim().toLowerCase() || "other";
            const nameKey = normalizeStoreName(store.name);
            const addressKey = store.address ? normalizeAddress(store.address) : "";
            const hasAddress = !!addressKey;
            const phoneKey = normalizePhone(store.phone);
            const hasPhone = !!phoneKey;
            const detailScore = (hasAddress ? 2 : 0) + (hasPhone ? 1 : 0);
            const isPinned = activeIdSet.has(store.id) || unlockedIdSet.has(store.id);

            if (hasAddress && nameKey) {
                nameHasAddress.set(`${nameKey}|${catKey}`, true);
            }

            // If we have an address, dedupe by address+category (this removes same-address duplicates with slightly different names)
            // Else if we have phone, dedupe by phone+category
            // Else fall back to normalized name+category
            // Never dedupe stores the user already added/unlocked; they must all remain visible.
            const key = isPinned
                ? `pinned|${store.id}`
                : hasAddress
                    ? `addr|${addressKey}|${catKey}`
                    : hasPhone
                        ? `phone|${phoneKey}|${catKey}`
                        : `name|${nameKey || String(store.name || "").trim().toLowerCase()}|${catKey}`;

            if (!isPinned && !hasAddress && nameKey && nameHasAddress.get(`${nameKey}|${catKey}`)) {
                // Skip no-address entry when we already have an address for this name+category.
                continue;
            }

            const existing = dedupeMap.get(key);
            if (!existing) {
                dedupeMap.set(key, store);
                continue;
            }

            const existingPinned = activeIdSet.has(existing.id) || unlockedIdSet.has(existing.id);
            if (isPinned && !existingPinned) {
                dedupeMap.set(key, store);
                continue;
            }
            if (!isPinned && existingPinned) {
                continue;
            }

            const existingHasAddress = !!(existing.address && existing.address.trim());
            const existingHasPhone = !!normalizePhone(existing.phone);
            const existingScore = (existingHasAddress ? 2 : 0) + (existingHasPhone ? 1 : 0);

            if (detailScore > existingScore) {
                dedupeMap.set(key, store);
            } else if (detailScore === existingScore) {
                if ((store.distance_miles || 0) < (existing.distance_miles || 0)) {
                    dedupeMap.set(key, store);
                }
            }
        }

        const deduped = Array.from(dedupeMap.values());

        // Build a dedicated list for "Your Stores" so enrolled stores always appear,
        // even when they are filtered out of nearby cards by distance/address filters.
        const pinnedStoreIds = Array.from(new Set([...activeStoreIds, ...Array.from(unlockedStoreIds)]));
        let yourStores = [];
        if (pinnedStoreIds.length > 0) {
            const pinnedPlaceholders = pinnedStoreIds.map(() => "?").join(",");
            const pinnedRows = await dbAllAsync(
                `SELECT s.id, s.name, s.category, s.phone, s.address, s.latitude, s.longitude, s.place_id,
                        s.base_discount_percent,
                        o.reward_tier, o.reward_points, o.unlock_cost_cents, o.unlock_cost_loops, o.is_locked, o.min_plan, o.news AS offer_news, o.gift_card_min_loops
                 FROM stores s
                 LEFT JOIN store_offers o ON o.store_id = s.id
                 WHERE s.id IN (${pinnedPlaceholders})`,
                pinnedStoreIds
            );

            const pinnedMap = new Map((pinnedRows || []).map((r) => [r.id, r]));
            yourStores = pinnedStoreIds
                .map((id) => pinnedMap.get(id))
                .filter(Boolean)
                .map((row) => {
                    const distance = (row.latitude != null && row.longitude != null)
                        ? haversineMiles(user.latitude, user.longitude, row.latitude, row.longitude)
                        : null;
                    const rewardPoints = Number.isFinite(row.reward_points) ? row.reward_points : 0;
                    const rewardBase = rewardPoints > 0 ? rewardPoints : (row.base_discount_percent || 0);
                    const inferred = getDefaultOfferFromPoints(rewardBase);
                    const rewardTier =
                        row.reward_tier &&
                        !(row.reward_tier === "standard" && rewardPoints === 0 && inferred.reward_tier !== "standard")
                            ? row.reward_tier
                            : inferred.reward_tier;
                    let unlockCostCents = row.unlock_cost_cents || 0;
                    let unlockCostLoops = row.unlock_cost_loops || 0;
                    if (unlockCostCents === 0 && unlockCostLoops === 0 && rewardTier !== "standard") {
                        unlockCostCents = inferred.unlock_cost_cents;
                        unlockCostLoops = inferred.unlock_cost_loops;
                    }
                    return {
                        id: row.id,
                        name: row.name,
                        category: row.category,
                        phone: row.phone,
                        address: row.address,
                        place_id: row.place_id,
                        latitude: row.latitude,
                        longitude: row.longitude,
                        distance_miles: distance,
                        base_discount_percent: row.base_discount_percent,
                        reward_tier: rewardTier,
                        reward_points: rewardPoints,
                        unlock_cost_cents: unlockCostCents || 0,
                        unlock_cost_loops: unlockCostLoops || 0,
                        is_locked: false,
                        locked_reason: null,
                        is_unlocked: unlockedStoreIds.has(row.id),
                        min_plan: row.min_plan || inferred.min_plan,
                        gift_card_min_loops: normalizeGiftCardMinLoops(row.gift_card_min_loops),
                        news: row.offer_news || null,
                        unlockable: false,
                        score: Number.isFinite(distance) ? computeStoreScore(distance, 0, false) : 0,
                    };
                });
        }

        res.json({
            source: "internal",
            limit,
            radius,
            cycleMonth,
            category,
            activeStoreIds,
            unlockedStoreIds: Array.from(unlockedStoreIds),
            unlockLimit,
            unlockCount,
            activeCount,
            allowedCategories,
            stores: deduped.slice(0, maxResults),
            yourStores,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch nearby stores", details: e?.message || String(e) });
    }
});

app.post("/api/stores/unlock", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { storeId, method } = req.body || {};
        const unlockMethod = (method || "").toLowerCase();

        if (!storeId) {
            return res.status(400).json({ error: "storeId is required" });
        }
        if (!["money"].includes(unlockMethod)) {
            return res.status(400).json({ error: "method must be money" });
        }

        const user = await dbGetAsync(
            "SELECT id, plan, loops_balance FROM users WHERE id = ?",
            [userId]
        );
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const offer = await dbGetAsync(
            `SELECT s.id, s.category, s.base_discount_percent,
                    o.reward_tier, o.reward_points, o.unlock_cost_cents, o.unlock_cost_loops, o.is_locked, o.min_plan
             FROM stores s
             LEFT JOIN store_offers o ON o.store_id = s.id
             WHERE s.id = ?`,
            [storeId]
        );
        if (!offer) {
            return res.status(404).json({ error: "Store not found" });
        }

        const cycleMonth = getCycleMonth();
        const existingUnlock = await dbGetAsync(
            "SELECT id FROM store_unlocks WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, storeId, cycleMonth]
        );
        if (existingUnlock) {
            return res.json({ unlocked: true, storeId });
        }

        const allowedTiers = getPlanAllowedTiers(user.plan);
        const rewardPoints = Number.isFinite(offer.reward_points) ? offer.reward_points : 0;
        const basePoints = rewardPoints > 0 ? rewardPoints : (offer.base_discount_percent || 0);
        const inferred = getDefaultOfferFromPoints(basePoints);
        const rewardTier =
            offer.reward_tier &&
            !(offer.reward_tier === "standard" && rewardPoints === 0 && inferred.reward_tier !== "standard")
                ? offer.reward_tier
                : inferred.reward_tier;
        const meetsMinPlan = isPlanAtLeast(user.plan, offer.min_plan || inferred.min_plan);
        const tierAllowed = allowedTiers.includes(rewardTier);
        const lockedByStore =
            offer.is_locked != null &&
            !(offer.is_locked === 0 && rewardPoints === 0 && inferred.is_locked === 1)
                ? !!offer.is_locked
                : !!inferred.is_locked;

        const isLocked = lockedByStore || !tierAllowed || !meetsMinPlan;
        if (!isLocked) {
            return res.json({ unlocked: false, message: "Store is already available" });
        }

        const unlockRows = await dbAllAsync(
            "SELECT store_id FROM store_unlocks WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, cycleMonth]
        );
        const unlockLimit = getPlanUnlockLimit(user.plan);
        if (unlockRows.length >= unlockLimit) {
            return res.status(400).json({ error: "Unlock limit reached for this cycle" });
        }

        const slotLimit = getPlanStoreLimit(user.plan);
        const slotCountRow = await dbGetAsync(
            "SELECT COUNT(*) as active_count FROM store_slots WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, cycleMonth]
        );
        const activeCount = slotCountRow?.active_count || 0;
        const requiresPayment = activeCount >= slotLimit;

        let costCents = offer.unlock_cost_cents || 0;
        if (costCents === 0 && rewardTier !== "standard") {
            costCents = inferred.unlock_cost_cents;
        }
        if (requiresPayment && costCents === 0) {
            costCents = 299;
        }

        if (!requiresPayment && !isLocked) {
            return res.status(400).json({ error: "Free slot available for this store" });
        }
        if (!costCents) {
            return res.status(400).json({ error: "This store does not support money unlock" });
        }
        // Payment processing should happen here in production.

        await dbRunAsync(
            `INSERT INTO store_unlocks (user_id, store_id, cycle_month, unlock_method, unlock_amount, status)
             VALUES (?, ?, ?, ?, ?, 'active')`,
            [userId, storeId, cycleMonth, unlockMethod, costCents]
        );

        await ensureStoreMembership({
            userId,
            storeId,
            cycleMonth,
            joinMethod: "paid",
            paidCents: costCents
        });

        res.json({
            unlocked: true,
            storeId,
            method: unlockMethod,
            amount: costCents,
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to unlock store" });
    }
});

// Enroll/activate store (free enrollment or paid unlock)
app.post("/api/users/enroll-store", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { storeId, unlockMethod } = req.body || {};
        
        if (!storeId) {
            return res.status(400).json({ error: "storeId is required" });
        }
        
        const user = await dbGetAsync(
            "SELECT id, plan, loops_balance FROM users WHERE id = ?",
            [userId]
        );
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        const offer = await dbGetAsync(
            `SELECT s.id, s.category, s.base_discount_percent,
                    o.reward_tier, o.reward_points, o.unlock_cost_cents, o.unlock_cost_loops, o.is_locked, o.min_plan
             FROM stores s
             LEFT JOIN store_offers o ON o.store_id = s.id
             WHERE s.id = ?`,
            [storeId]
        );
        if (!offer) {
            return res.status(404).json({ error: "Store not found" });
        }
        
        const cycleMonth = getCycleMonth();
        
        // Check if already enrolled
        const existingMembership = await dbGetAsync(
            `SELECT id FROM store_memberships WHERE user_id = ? AND store_id = ? AND status = 'active'`,
            [userId, storeId]
        );
        const existingSlot = await dbGetAsync(
            `SELECT id FROM store_slots WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active'`,
            [userId, storeId, cycleMonth]
        );
        const existingUnlock = await dbGetAsync(
            `SELECT id FROM store_unlocks WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active'`,
            [userId, storeId, cycleMonth]
        );
        
        if (existingMembership || existingSlot || existingUnlock) {
            return res.json({ enrolled: true, storeId });
        }
        
        // Check if store requires payment
        const unlockCostCents = offer.unlock_cost_cents || 0;
        const unlockCostLoops = offer.unlock_cost_loops || 0;
        const isLocked = offer.is_locked === 1;
        const minPlan = offer.min_plan || "STARTER";
        
        // If requires payment and unlockMethod is provided, process payment
        if (unlockMethod === "money" && unlockCostCents > 0) {
            // Payment processing should happen here in production
            await dbRunAsync(
                `INSERT INTO store_unlocks (user_id, store_id, cycle_month, unlock_method, unlock_amount, status)
                 VALUES (?, ?, ?, 'money', ?, 'active')`,
                [userId, storeId, cycleMonth, unlockCostCents]
            );
            await ensureStoreMembership({
                userId,
                storeId,
                cycleMonth,
                joinMethod: "paid",
                paidCents: unlockCostCents
            });
            return res.json({ enrolled: true, storeId, method: "paid", amount: unlockCostCents });
        }
        
        if (unlockMethod === "loops" && unlockCostLoops > 0) {
            if ((user.loops_balance || 0) < unlockCostLoops) {
                return res.status(400).json({ 
                    error: `Insufficient Loops. You have ${user.loops_balance || 0}, need ${unlockCostLoops}` 
                });
            }
            
            // Deduct loops
            await dbRunAsync(
                "UPDATE users SET loops_balance = loops_balance - ? WHERE id = ?",
                [unlockCostLoops, userId]
            );
            
            await dbRunAsync(
                `INSERT INTO store_unlocks (user_id, store_id, cycle_month, unlock_method, unlock_amount, status)
                 VALUES (?, ?, ?, 'loops', ?, 'active')`,
                [userId, storeId, cycleMonth, unlockCostLoops]
            );
            await ensureStoreMembership({
                userId,
                storeId,
                cycleMonth,
                joinMethod: "paid",
                paidCents: 0 // Loops unlock doesn't count as money payment
            });
            return res.json({ enrolled: true, storeId, method: "loops", loops_used: unlockCostLoops });
        }
        
        // Free enrollment - check slot limit
        const slotLimit = getPlanStoreLimit(user.plan);
        const slotCountRow = await dbGetAsync(
            "SELECT COUNT(*) as active_count FROM store_slots WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, cycleMonth]
        );
        const activeCount = slotCountRow?.active_count || 0;
        
        if (slotLimit > 0 && activeCount >= slotLimit) {
            let fallbackCostCents = unlockCostCents;
            let fallbackCostLoops = unlockCostLoops;
            if (fallbackCostCents === 0 && fallbackCostLoops === 0) {
                fallbackCostCents = 299;
                fallbackCostLoops = 300;
            }
            return res.status(403).json({ 
                error: `You have reached your ${slotLimit} free store slots for this month. Unlock a store to continue.`,
                requires_payment: true,
                active_count: activeCount,
                slot_limit: slotLimit,
                unlock_cost_cents: fallbackCostCents,
                unlock_cost_loops: fallbackCostLoops
            });
        }
        
        // Free enrollment
        await dbRunAsync(
            `INSERT OR IGNORE INTO store_slots (user_id, store_id, cycle_month, status) VALUES (?, ?, ?, 'active')`,
            [userId, storeId, cycleMonth]
        );
        await ensureStoreMembership({
            userId,
            storeId,
            cycleMonth,
            joinMethod: "free",
            paidCents: 0
        });
        
        res.json({ enrolled: true, storeId, method: "free" });
    } catch (e) {
        res.status(500).json({ error: "Failed to enroll store" });
    }
});

app.post("/api/stores/activate-slot", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { storeId } = req.body || {};
        if (!storeId) {
            return res.status(400).json({ error: "storeId is required" });
        }

        const store = await dbGetAsync(
            "SELECT id FROM stores WHERE id = ?",
            [storeId]
        );
        if (!store) {
            return res.status(404).json({ error: "Store not found" });
        }

        const user = await dbGetAsync(
            "SELECT plan FROM users WHERE id = ?",
            [userId]
        );
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const cycleMonth = getCycleMonth();
        const activeSlot = await dbGetAsync(
            "SELECT id FROM store_slots WHERE user_id = ? AND store_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, storeId, cycleMonth]
        );
        if (activeSlot) {
            return res.json({ activated: true, storeId });
        }

        const slotLimit = getPlanStoreLimit(user.plan);
        const slotCountRow = await dbGetAsync(
            "SELECT COUNT(*) as active_count FROM store_slots WHERE user_id = ? AND cycle_month = ? AND status = 'active'",
            [userId, cycleMonth]
        );
        const activeCount = slotCountRow?.active_count || 0;
        if (slotLimit > 0 && activeCount >= slotLimit) {
            return res.status(400).json({ error: "Free slot limit reached. Unlock to continue." });
        }

        await dbRunAsync(
            "INSERT OR IGNORE INTO store_slots (user_id, store_id, cycle_month, status) VALUES (?, ?, ?, 'active')",
            [userId, storeId, cycleMonth]
        );

        await ensureStoreMembership({
            userId,
            storeId,
            cycleMonth,
            joinMethod: "free",
            paidCents: 0
        });

        res.json({ activated: true, storeId });
    } catch (e) {
        res.status(500).json({ error: "Failed to activate store slot" });
    }
});

// ---------- nearby stores from Google Places ----------
app.get("/api/stores/nearby-google", auth("user"), async (req, res) => {
    try {
        const userId = req.user.id;
        const radius = parseFloat(req.query.radius || "1");
        const query = req.query.query || "all";
        const autoImport = req.query.import === "1";
        const clean = req.query.clean === "1";
        const quality = req.query.quality || "default";
        const includeOther = req.query.includeOther === "1";
        const preferNameCategory = req.query.preferNameCategory !== "0";
        const category = req.query.category || null;
        const minRatingParam = req.query.minRating;
        const minReviewsParam = req.query.minReviews;
        const minRating = minRatingParam != null ? Number(minRatingParam) : null;
        const minReviews = minReviewsParam != null ? Number(minReviewsParam) : null;

        const user = await dbGetAsync(
            "SELECT latitude, longitude FROM users WHERE id = ?",
            [userId]
        );

        if (!user || user.latitude == null || user.longitude == null) {
            return res.status(400).json({ error: "User location not set" });
        }

        const qualityOptions = quality === "verified"
            ? {
                requireAddress: true,
                excludeOtherCategory: true,
                minRating: minRating ?? 3.5,
                minReviews: minReviews ?? 5
            }
            : {
                minRating,
                minReviews
            };

        const stores = await fetchGoogleNearbyStores(
            user.latitude,
            user.longitude,
            radius,
            query,
            {
                ...qualityOptions,
                category,
                includeOther,
                preferNameCategory
            }
        );

        let importedCount = 0;
        if (autoImport && stores.length > 0) {
            if (clean) {
                await dbRunAsync("DELETE FROM stores WHERE zone = 'GOOGLE'");
            }
            const unclaimedHash = bcrypt.hashSync("unclaimed_store", 10);
            for (const s of stores) {
                const existing = await dbGetAsync(
                    `SELECT id FROM stores 
                     WHERE lower(name) = lower(?) 
                     AND ABS(latitude - ?) < 0.0001 
                     AND ABS(longitude - ?) < 0.0001`,
                    [s.name, s.latitude, s.longitude]
                );

                if (!existing) {
                    await dbRunAsync(
                        `INSERT INTO stores 
                         (email, phone, password_hash, name, zone, category, base_discount_percent, latitude, longitude, address, is_local) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            null,
                            null,
                            unclaimedHash,
                            s.name,
                            "GOOGLE",
                            s.category || "other",
                            0,
                            s.latitude,
                            s.longitude,
                            s.address || null,
                            1
                        ]
                    );
                    importedCount += 1;
                }
            }
        }

        res.json({
            radius,
            count: stores.length,
            quality,
            minRating,
            minReviews,
            category,
            includeOther,
            preferNameCategory,
            importedCount,
            stores
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch Google stores", details: e?.message || String(e) });
    }
});

// ---------- Google Places details (phone/website) ----------
app.get("/api/stores/google-details", auth("user"), async (req, res) => {
    try {
        const placeId = String(req.query.placeId || "").trim();
        if (!placeId) {
            return res.status(400).json({ error: "placeId is required" });
        }
        const cached = getCache(googleDetailsCache, placeId);
        if (cached) {
            return res.json(cached);
        }
        if (!GOOGLE_PLACES_API_KEY) {
            return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY is not configured" });
        }

        const url =
            "https://maps.googleapis.com/maps/api/place/details/json" +
            `?place_id=${encodeURIComponent(placeId)}` +
            "&fields=formatted_phone_number,international_phone_number,website" +
            `&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Places details failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.status !== "OK") {
            return res.status(400).json({ error: "Google Places error", details: data.status });
        }

        const result = data.result || {};
        const payload = {
            place_id: placeId,
            phone: result.formatted_phone_number || result.international_phone_number || null,
            website: result.website || null,
        };
        setCache(googleDetailsCache, placeId, payload, GOOGLE_DETAILS_TTL_MS);
        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch Google place details", details: e?.message || String(e) });
    }
});

// ---------- active stores for current cycle ----------
app.get("/api/users/:id/active-stores", auth("user"), (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
    }

    const cycleMonth = getCycleMonth();
    db.all(
        `SELECT ss.store_id, s.name, s.category, s.zone
         FROM store_slots ss
         JOIN stores s ON s.id = ss.store_id
         WHERE ss.user_id = ? AND ss.cycle_month = ? AND ss.status = 'active'`,
        [userId, cycleMonth],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "DB error" });
            res.json({ cycleMonth, activeStores: rows || [] });
        }
    );
});

// ---------- List all stores (for filtering) ----------

app.get("/api/stores/list", (req, res) => {
    db.all(
        "SELECT id, name, category, zone FROM stores ORDER BY name",
        [],
        (err, stores) => {
            if (err) {
                return res.status(500).json({ error: "DB error" });
            }
            res.json(stores);
        }
    );
});

// ---------- Store location management ----------

app.put("/api/stores/location", authStore, (req, res) => {
    const storeId = req.storeId;
    const { latitude, longitude, address } = req.body;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Invalid coordinates" });
    }

    db.run(
        "UPDATE stores SET latitude = ?, longitude = ?, address = ? WHERE id = ?",
        [lat, lng, address || null, storeId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: "DB error updating location" });
            }
            res.json({ success: true, latitude: lat, longitude: lng });
        }
    );
});

// ---------- Socket.io connection handling ----------

io.on("connection", (socket) => {

    // Join store room for real-time updates
    socket.on("join-store", (storeId) => {
        socket.join(`store:${storeId}`);
    });

    socket.on("disconnect", () => {
    });
});

// ---------- Analytics & Reporting Endpoints ----------

// Customer Analytics
app.get("/api/analytics/customer/:userId", auth("user"), (req, res) => {
    const userId = req.params.userId;
    if (req.user.id !== parseInt(userId) && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
    }

    const period = parseInt(req.query.period) || 30; // days, 0 = all time

    // Get visit stats - using check_in_sessions and pending_points
    let dateFilter = '';
    const params = [userId];
    if (period > 0) {
        // SQLite date calculation - pass period as string for concatenation
        dateFilter = `AND cis.checked_in_at >= datetime('now', '-' || ? || ' days')`;
        params.push(period.toString());
    }

    db.all(
        `SELECT 
            COUNT(DISTINCT cis.id) as total_visits,
            COALESCE(SUM(pp.loops_pending + COALESCE(pp.loops_unlocked, 0)), 0) as total_loops_earned,
            COUNT(DISTINCT cis.store_id) as unique_stores
        FROM check_in_sessions cis
        LEFT JOIN pending_points pp ON pp.session_id = cis.id
        WHERE cis.user_id = ? AND cis.status = 'completed' ${dateFilter}`,
        params,
        (err, stats) => {
            if (err) {
                return res.status(500).json({ error: "DB error: " + err.message });
            }

            // Get daily visit trend
            const trendParams = [userId];
            if (period > 0) trendParams.push(period.toString());
            db.all(
                `SELECT 
                    date(cis.checked_in_at) as date,
                    COUNT(DISTINCT cis.id) as visit_count,
                    COALESCE(SUM(pp.loops_pending + COALESCE(pp.loops_unlocked, 0)), 0) as loops_earned
                FROM check_in_sessions cis
                LEFT JOIN pending_points pp ON pp.session_id = cis.id
                WHERE cis.user_id = ? AND cis.status = 'completed' ${dateFilter}
                GROUP BY date(cis.checked_in_at)
                ORDER BY date ASC`,
                trendParams,
                (err2, dailyTrend) => {
                    if (err2) {
                        return res.status(500).json({ error: "DB error: " + err2.message });
                    }

                    // Get store breakdown
                    const breakdownParams = [userId];
                    if (period > 0) breakdownParams.push(period.toString());
                    db.all(
                        `SELECT 
                            s.name as store_name,
                            s.category,
                            COUNT(DISTINCT cis.id) as visit_count,
                            COALESCE(SUM(pp.loops_pending + COALESCE(pp.loops_unlocked, 0)), 0) as total_loops_earned,
                            MAX(cis.checked_in_at) as last_visit
                        FROM check_in_sessions cis
                        JOIN stores s ON cis.store_id = s.id
                        LEFT JOIN pending_points pp ON pp.session_id = cis.id
                        WHERE cis.user_id = ? AND cis.status = 'completed' ${dateFilter}
                        GROUP BY s.id
                        ORDER BY visit_count DESC`,
                        breakdownParams,
                        (err3, storeBreakdown) => {
                            if (err3) {
                                return res.status(500).json({ error: "DB error: " + err3.message });
                            }

                            // Get tier progression
                            db.get(
                                `SELECT 
                                    loops_balance,
                                    total_loops_earned
                                FROM users
                                WHERE id = ?`,
                                [userId],
                                (err4, user) => {
                                    if (err4) return res.status(500).json({ error: "DB error" });

                                    // Ensure stats[0] exists and has proper defaults
                                    const overview = stats[0] || {
                                        total_visits: 0,
                                        total_loops_earned: 0,
                                        unique_stores: 0
                                    };

                                    res.json({
                                        overview,
                                        dailyTrend: dailyTrend || [],
                                        storeBreakdown: storeBreakdown || [],
                                        currentBalance: user?.loops_balance || 0,
                                        totalEarned: user?.total_loops_earned || 0
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// Store Analytics (based on check-ins, not transactions)
app.get("/api/analytics/store", authStore, (req, res) => {
    const storeId = req.storeId;
    const period = req.query.period || "30"; // days

    // Overview stats - using check_in_sessions and pending_points
    db.all(
        `SELECT 
            COUNT(DISTINCT cis.user_id) as unique_customers,
            COUNT(DISTINCT cis.id) as total_visits,
            COALESCE(SUM(pp.loops_pending), 0) as total_loops_given,
            -- Visit frequency metrics
            COUNT(DISTINCT CASE WHEN date(cis.checked_in_at) = date('now') THEN cis.user_id END) as visits_today,
            COUNT(DISTINCT CASE WHEN date(cis.checked_in_at) >= date('now', '-7 days') THEN cis.user_id END) as visits_this_week,
            COUNT(DISTINCT CASE WHEN date(cis.checked_in_at) >= date('now', '-30 days') THEN cis.user_id END) as visits_this_month,
            COUNT(DISTINCT CASE WHEN date(cis.checked_in_at) >= date('now', '-365 days') THEN cis.user_id END) as visits_this_year
        FROM check_in_sessions cis
        LEFT JOIN pending_points pp ON pp.session_id = cis.id
        WHERE cis.store_id = ? AND cis.status = 'completed' AND cis.checked_in_at >= datetime('now', '-' || ? || ' days')`,
        [storeId, period.toString()],
        (err, stats) => {
            if (err) return res.status(500).json({ error: "DB error" });

            // Daily trend
            db.all(
                `SELECT 
                    date(cis.checked_in_at) as date,
                    COUNT(DISTINCT cis.id) as visit_count,
                    COUNT(DISTINCT cis.user_id) as customer_count,
                    COALESCE(SUM(pp.loops_pending), 0) as loops_given
                FROM check_in_sessions cis
                LEFT JOIN pending_points pp ON pp.session_id = cis.id
                WHERE cis.store_id = ? AND cis.status = 'completed' AND cis.checked_in_at >= datetime('now', '-' || ? || ' days')
                GROUP BY date(cis.checked_in_at)
                ORDER BY date ASC`,
                [storeId, period.toString()],
                (err2, dailyTrend) => {
                    if (err2) return res.status(500).json({ error: "DB error" });

                    // Top customers with visit counts
                    db.all(
                        `SELECT 
                            u.id as user_id,
                            u.name as user_name,
                            u.phone as user_phone,
                            u.email as user_email,
                            COUNT(DISTINCT cis.id) as visit_count,
                            COALESCE(SUM(pp.loops_pending), 0) as total_loops_earned,
                            MAX(cis.checked_in_at) as last_visit_at
                        FROM check_in_sessions cis
                        JOIN users u ON cis.user_id = u.id
                        LEFT JOIN pending_points pp ON pp.session_id = cis.id
                        WHERE cis.store_id = ? AND cis.status = 'completed' AND cis.checked_in_at >= datetime('now', '-' || ? || ' days')
                        GROUP BY u.id
                        ORDER BY visit_count DESC
                        LIMIT 10`,
                        [storeId, period],
                        (err3, topCustomers) => {
                            if (err3) return res.status(500).json({ error: "DB error" });

                            res.json({
                                overview: stats[0] || {},
                                dailyTrend,
                                topCustomers
                            });
                        }
                    );
                }
            );
        }
    );
});

// System-wide Analytics (for admin) - based on check-ins, not transactions
app.get("/api/analytics/system", authAdmin, (req, res) => {
    // Basic system stats - using check_in_sessions instead of transactions
    db.all(
        `WITH ranked_stores AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        CASE
                            WHEN place_id IS NOT NULL AND trim(place_id) != '' THEN 'p:' || place_id
                            WHEN address IS NOT NULL AND trim(address) != '' THEN 'a:' || lower(trim(address)) || '|' || lower(trim(category))
                            ELSE 'n:' || lower(trim(name)) || '|' || lower(trim(category))
                        END
                    ORDER BY
                        (
                            (CASE WHEN phone IS NOT NULL AND trim(phone) != '' THEN 1 ELSE 0 END) +
                            (CASE WHEN address IS NOT NULL AND trim(address) != '' THEN 1 ELSE 0 END) +
                            (CASE WHEN place_id IS NOT NULL AND trim(place_id) != '' THEN 1 ELSE 0 END)
                        ) DESC,
                        id ASC
                ) AS rn
            FROM stores
        )
        SELECT 
            (SELECT COUNT(DISTINCT id) FROM users) as total_users,
            (SELECT COUNT(*) FROM ranked_stores WHERE rn = 1) as total_stores,
            (SELECT COUNT(DISTINCT id) FROM check_in_sessions WHERE status = 'completed') as total_visits,
            (SELECT COALESCE(SUM(loops_balance), 0) FROM users) as total_loops_in_circulation,
            (SELECT COALESCE(SUM(total_loops_earned), 0) FROM users) as total_loops_ever_earned,
            -- Keep gift card metrics (as requested)
            (SELECT COUNT(*) FROM gift_cards) as total_gift_cards_issued,
            (SELECT COUNT(*) FROM gift_cards WHERE status = 'active') as active_gift_cards,
            (SELECT COUNT(*) FROM gift_cards WHERE card_type = 'physical') as physical_gift_cards,
            (SELECT COALESCE(SUM(original_value), 0) FROM gift_cards) as total_gift_card_value,
            (SELECT COUNT(DISTINCT user_id) FROM check_in_sessions WHERE status = 'completed' AND checked_in_at >= date('now', '-30 days')) as active_customers_30d
        `,
        [],
        (err, stats) => {
            if (err) return res.status(500).json({ error: "DB error" });

                    // Visit growth (daily) - using check-ins
                    db.all(
                        `SELECT 
                            date(cis.checked_in_at) as date,
                            COUNT(DISTINCT cis.id) as visit_count,
                            COUNT(DISTINCT cis.user_id) as new_customers,
                            COALESCE(SUM(pp.loops_pending), 0) as loops_given
                        FROM check_in_sessions cis
                        LEFT JOIN pending_points pp ON pp.session_id = cis.id
                        WHERE cis.status = 'completed' AND cis.checked_in_at >= date('now', '-30 days')
                        GROUP BY date(cis.checked_in_at)
                        ORDER BY date DESC
                        LIMIT 30`,
                        [],
                (err2, visitGrowth) => {
                    if (err2) return res.status(500).json({ error: "DB error" });

                    // Store performance - using check-ins with deduplication (same as Stores tab)
                    db.all(
                        `WITH ranked AS (
                            SELECT
                                s.id, s.name, s.category, s.zone,
                                ROW_NUMBER() OVER (
                                    PARTITION BY
                                        CASE
                                            WHEN s.place_id IS NOT NULL AND trim(s.place_id) != '' THEN 'p:' || s.place_id
                                            WHEN s.address IS NOT NULL AND trim(s.address) != '' THEN 'a:' || lower(trim(s.address)) || '|' || lower(trim(s.category))
                                            ELSE 'n:' || lower(trim(s.name)) || '|' || lower(trim(s.category))
                                        END
                                    ORDER BY
                                        (
                                            (CASE WHEN s.phone IS NOT NULL AND trim(s.phone) != '' THEN 1 ELSE 0 END) +
                                            (CASE WHEN s.address IS NOT NULL AND trim(s.address) != '' THEN 1 ELSE 0 END) +
                                            (CASE WHEN s.place_id IS NOT NULL AND trim(s.place_id) != '' THEN 1 ELSE 0 END)
                                        ) DESC,
                                        s.id ASC
                                ) AS rn
                        FROM stores s
                        ),
                        deduped_stores AS (
                            SELECT id, name, category, zone
                            FROM ranked
                            WHERE rn = 1
                        )
                        SELECT 
                            ds.name,
                            ds.category,
                            ds.zone,
                            COUNT(DISTINCT cis.user_id) as customer_count,
                            COUNT(DISTINCT cis.id) as visit_count,
                            COALESCE(SUM(pp.loops_pending), 0) as loops_given
                        FROM deduped_stores ds
                        LEFT JOIN check_in_sessions cis ON ds.id = cis.store_id AND cis.status = 'completed'
                        LEFT JOIN pending_points pp ON pp.session_id = cis.id
                        GROUP BY ds.id
                        ORDER BY visit_count DESC`,
                        [],
                        (err3, storePerformance) => {
                            if (err3) return res.status(500).json({ error: "DB error" });

                            // Tier distribution
                            db.all(
                                `SELECT 
                                    CASE 
                                        WHEN total_loops_earned >= 15000 THEN 'DIAMOND'
                                        WHEN total_loops_earned >= 6000 THEN 'PLATINUM'
                                        WHEN total_loops_earned >= 2000 THEN 'GOLD'
                                        WHEN total_loops_earned >= 500 THEN 'SILVER'
                                        ELSE 'BRONZE'
                                    END as tier,
                                    COUNT(*) as count
                                FROM users
                                GROUP BY tier`,
                                [],
                                (err4, tierDistribution) => {
                                    if (err4) return res.status(500).json({ error: "DB error" });

                                    // Visit metrics (replacing transaction metrics)
                                    db.get(
                                        `SELECT 
                                            COUNT(DISTINCT DATE(checked_in_at)) as active_days,
                                            COUNT(DISTINCT id) as total_visits,
                                            COUNT(DISTINCT user_id) as unique_customers
                                         FROM check_in_sessions
                                         WHERE status = 'completed' AND checked_in_at >= date('now', '-30 days')`,
                                        [],
                                        (err5, visitMetrics) => {
                                            if (err5) {
                                            }

                                            // Redemption rate (loops redeemed vs earned)
                                            db.get(
                                                `SELECT 
                                                    (SELECT COALESCE(SUM(ABS(amount)), 0) FROM loops_ledger WHERE change_type = 'REDEEM') as total_redeemed,
                                                    (SELECT COALESCE(SUM(total_loops_earned), 0) FROM users) as total_earned`,
                                                [],
                                                (err6, redemptionStats) => {
                                                    if (err6) {
                                                    }

                                                    // Top stores by visits (replacing revenue)
                                                    db.all(
                                                        `SELECT 
                                                            s.name,
                                                            s.category,
                                                            COUNT(DISTINCT cis.id) as visit_count,
                                                            COUNT(DISTINCT cis.user_id) as customer_count,
                                                            COALESCE(SUM(pp.loops_pending), 0) as loops_given
                                                         FROM stores s
                                                         LEFT JOIN check_in_sessions cis ON s.id = cis.store_id AND cis.status = 'completed'
                                                         LEFT JOIN pending_points pp ON pp.session_id = cis.id
                                                         WHERE cis.checked_in_at >= date('now', '-30 days')
                                                         GROUP BY s.id
                                                         ORDER BY visit_count DESC
                                                         LIMIT 5`,
                                                        [],
                                                        (err7, topStoresByVisits) => {
                                                            if (err7) {
                                                            }

                                                            // Customer retention (customers who visited multiple times in last 30 days)
                                                            db.get(
                                                                `SELECT 
                                                                    COUNT(DISTINCT CASE WHEN visit_count > 1 THEN user_id END) as returning_customers,
                                                                    COUNT(DISTINCT user_id) as total_active_customers
                                                                 FROM (
                                                                     SELECT user_id, COUNT(*) as visit_count
                                                                     FROM check_in_sessions
                                                                     WHERE status = 'completed' AND checked_in_at >= date('now', '-30 days')
                                                                     GROUP BY user_id
                                                                 )`,
                                                                [],
                                                                (err8, retentionStats) => {
                                                                    if (err8) {
                                                                    }

                                                                    res.json({
                                                                        overview: stats[0],
                                                                        visitGrowth: visitGrowth, // Renamed from transactionGrowth
                                                                        storePerformance,
                                                                        tierDistribution,
                                                                        visitMetrics: visitMetrics || {}, // Renamed from transactionMetrics
                                                                        redemptionStats: redemptionStats || { total_redeemed: 0, total_earned: 0 },
                                                                        topStoresByVisits: topStoresByVisits || [], // Renamed from topStoresByRevenue
                                                                        retentionStats: retentionStats || { returning_customers: 0, total_active_customers: 0 }
                                                                    });
                                                                }
                                                            );
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// ---------- Settlement Trigger Functions (DVS) ----------

// Check and unlock pending points based on settlement triggers
function checkSettlementTriggers(userId, storeId, callback) {
    // Get pending points for this user/store
    db.all(
        `SELECT * FROM pending_points 
         WHERE user_id = ? AND store_id = ? AND status = 'pending' 
         AND expires_at > datetime('now')`,
        [userId, storeId],
        (err, pendingPoints) => {
            if (err || !pendingPoints || pendingPoints.length === 0) {
                return callback();
            }
            
            pendingPoints.forEach((pending) => {
                // Check each trigger type
                
                // Trigger 1: Return visit (check if user has checked in again at this store)
                db.get(
                    `SELECT id FROM check_in_sessions 
                     WHERE user_id = ? AND store_id = ? 
                     AND checked_in_at > datetime(?, '-7 days')
                     AND id != ?`,
                    [userId, storeId, pending.created_at, pending.session_id],
                    (err2, returnVisit) => {
                        if (!err2 && returnVisit) {
                            unlockPoints(pending.id, 'return_visit', { sessionId: returnVisit.id });
                            return;
                        }
                        
                        // Trigger 2: Reward redemption (check if user redeemed at this store)
                        db.get(
                            `SELECT id FROM loops_ledger 
                             WHERE user_id = ? AND change_type = 'REDEEM' 
                             AND created_at > datetime(?, '-7 days')
                             AND meta LIKE ?`,
                            [userId, pending.created_at, `%store:${storeId}%`],
                            (err3, redemption) => {
                                if (!err3 && redemption) {
                                    unlockPoints(pending.id, 'reward_redemption', { ledgerId: redemption.id });
                                    return;
                                }
                                
                                // Trigger 3: Another purchase (check if user made another transaction)
                                db.get(
                                    `SELECT id FROM transactions 
                                     WHERE user_id = ? AND store_id = ? 
                                     AND created_at > datetime(?, '-7 days')
                                     AND id != (SELECT transaction_id FROM pending_points WHERE id = ?)`,
                                    [userId, storeId, pending.created_at, pending.id],
                                    (err4, transaction) => {
                                        if (!err4 && transaction) {
                                            unlockPoints(pending.id, 'another_purchase', { transactionId: transaction.id });
                                            return;
                                        }
                                        
                                        // Trigger 4: Related category visit (check if user visited related store)
                                        db.get(
                                            `SELECT s.id FROM stores s
                                             JOIN check_in_sessions cis ON s.id = cis.store_id
                                             WHERE cis.user_id = ? 
                                             AND s.category = (SELECT category FROM stores WHERE id = ?)
                                             AND s.id != ?
                                             AND cis.checked_in_at > datetime(?, '-7 days')`,
                                            [userId, storeId, storeId, pending.created_at],
                                            (err5, relatedVisit) => {
                                                if (!err5 && relatedVisit) {
                                                    unlockPoints(pending.id, 'related_visit', { storeId: relatedVisit.id });
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            });
            
            callback();
        }
    );
}

// Unlock pending points
function unlockPoints(pendingPointsId, triggerType, triggerData) {
    db.get(
        "SELECT * FROM pending_points WHERE id = ? AND status = 'pending'",
        [pendingPointsId],
        (err, pending) => {
            if (err || !pending) return;
            
            // Unlock points
            db.run(
                `UPDATE pending_points 
                 SET status = 'unlocked', 
                     loops_unlocked = loops_pending,
                     unlock_trigger = ?,
                     unlocked_at = datetime('now')
                 WHERE id = ?`,
                [triggerType, pendingPointsId],
                (err2) => {
                    if (err2) {
                        return;
                    }
                    
                    // Record settlement trigger
                    db.run(
                        "INSERT INTO settlement_triggers (pending_points_id, trigger_type, trigger_data) VALUES (?, ?, ?)",
                        [pendingPointsId, triggerType, JSON.stringify(triggerData || {})]
                    );
                    
                    // Add to user's balance
                    db.get("SELECT * FROM users WHERE id = ?", [pending.user_id], (err3, user) => {
                        if (err3 || !user) return;
                        
                        const newBalance = user.loops_balance + pending.loops_pending;
                        const newTotal = user.total_loops_earned + pending.loops_pending;
                        
                        db.run(
                            "UPDATE users SET loops_balance = ?, total_loops_earned = ? WHERE id = ?",
                            [newBalance, newTotal, pending.user_id]
                        );
                        
                        // Insert into ledger
                        db.run(
                            `INSERT INTO loops_ledger (user_id, change_type, amount, meta)
                             VALUES (?, 'EARN', ?, ?)`,
                            [
                                pending.user_id,
                                pending.loops_pending,
                                JSON.stringify({ 
                                    source: 'pending_unlock',
                                    trigger: triggerType,
                                    store_id: pending.store_id,
                                    pending_points_id: pendingPointsId
                                })
                            ]
                        );
                        
                        // Emit real-time update
                        io.emit("points-unlocked", {
                            userId: pending.user_id,
                            storeId: pending.store_id,
                            loopsUnlocked: pending.loops_pending,
                            triggerType,
                            timestamp: new Date().toISOString()
                        });
                        
                    });
                }
            );
        }
    );
}

// Check for expired pending points (run periodically)
function checkExpiredPendingPoints() {
    db.all(
        `SELECT * FROM pending_points 
         WHERE status = 'pending' AND expires_at <= datetime('now')`,
        [],
        (err, expired) => {
            if (err || !expired || expired.length === 0) return;
            
            expired.forEach((pending) => {
                db.run(
                    "UPDATE pending_points SET status = 'expired' WHERE id = ?",
                    [pending.id]
                );
            });
        }
    );
}

// Manual settlement check endpoint (for testing/debugging)
app.post("/api/users/check-settlement", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { storeId } = req.body;
    
    if (storeId) {
        checkSettlementTriggers(userId, storeId, () => {
            res.json({ success: true, message: "Settlement check completed" });
        });
    } else {
        // Check all stores
        db.all(
            `SELECT DISTINCT store_id FROM pending_points 
             WHERE user_id = ? AND status = 'pending' AND expires_at > datetime('now')`,
            [userId],
            (err, stores) => {
                if (err) {
                    return res.status(500).json({ error: "Database error" });
                }
                
                let completed = 0;
                stores.forEach((store) => {
                    checkSettlementTriggers(userId, store.store_id, () => {
                        completed++;
                        if (completed === stores.length) {
                            res.json({ success: true, message: "Settlement check completed for all stores" });
                        }
                    });
                });
                
                if (stores.length === 0) {
                    res.json({ success: true, message: "No pending points to check" });
                }
            }
        );
    }
});

// Run settlement check every 5 minutes
setInterval(() => {
    // Check all pending points for settlement triggers
    db.all(
        `SELECT DISTINCT user_id, store_id FROM pending_points 
         WHERE status = 'pending' AND expires_at > datetime('now')`,
        [],
        (err, pairs) => {
            if (err || !pairs) return;
            
            pairs.forEach((pair) => {
                checkSettlementTriggers(pair.user_id, pair.store_id, () => {});
            });
        }
    );
    
    // Check for expired points
    checkExpiredPendingPoints();
}, 5 * 60 * 1000); // Every 5 minutes

// Log actual registered routes
if (app.router && app.router.stack) {
    const actualRoutes = [];
    app.router.stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            actualRoutes.push(`${methods} ${layer.route.path}`);
        }
    });
}

// 404 handler - catch all unmatched routes (MUST be last, before server starts)
app.use((req, res) => {
    if (req.path === '/api/stores/login' || req.path === '/api/admins/login') {
        try {
            const routeLayers = (app.router?.stack || []).filter(l => l && l.route);
            const loginLike = routeLayers
                .map(l => ({ path: l.route.path, methods: Object.keys(l.route.methods || {}).join(',') }))
                .filter(r => String(r.path).includes('login'))
                .slice(0, 20);
        } catch (e) {
        }
    }
    res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

httpServer.listen(PORT, () => {
    // Log all registered routes - check router stack more thoroughly
    const routes = [];
    const middlewareInfo = [];
    if (app.router && app.router.stack) {
        app.router.stack.forEach((middleware, idx) => {
            middlewareInfo.push({index: idx, name: middleware.name, route: !!middleware.route, regex: middleware.regex?.toString().substring(0, 50)});
            if (middleware.route) {
                routes.push(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
            } else if (middleware.name === 'router') {
                middleware.handle?.stack?.forEach((handler) => {
                    if (handler.route) {
                        routes.push(`${Object.keys(handler.route.methods).join(',').toUpperCase()} ${handler.route.path}`);
                    }
                });
            }
        });
    }
    const loginRoutes = routes.filter(r => r.includes('/login') || r.includes('/signup')).slice(0, 50);
    const hasStoresLogin = routes.some(r => r.includes('POST /api/stores/login'));
    const hasAdminsLogin = routes.some(r => r.includes('POST /api/admins/login'));
    const hasUsersLogin = routes.some(r => r.includes('POST /api/users/login'));
    
    // Initial settlement check
    setTimeout(() => {
        checkExpiredPendingPoints();
    }, 1000);
    
    console.log(`Server running on http://localhost:${PORT}`);
});
