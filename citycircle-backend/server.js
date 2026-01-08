require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// SMS Service (using Twilio - configure in .env)
// For development, we'll use a mock SMS service
// To use real SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env
function sendSMS(phoneNumber, message) {
    // Mock SMS for development - in production, use Twilio
    console.log(`[SMS] To: ${phoneNumber}`);
    console.log(`[SMS] Message: ${message}`);
    
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
    
    return Promise.resolve({ sid: 'mock_sms_' + Date.now() });
}
const { createServer } = require("http");
const { Server } = require("socket.io");
const db = require("./db");

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

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

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

// ---------- customer auth ----------

app.post("/api/users/signup", async (req, res) => {
    const { phone, email, password, name, address } = req.body;
    
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

    // Clean phone number (remove non-digits)
    const cleanedPhone = phone.replace(/\D/g, '');
    
    // Check if phone number already exists
    db.get("SELECT id FROM users WHERE phone = ?", [cleanedPhone], (err, existingUser) => {
        if (err) {
            console.error("Error checking existing phone:", err);
            return res.status(500).json({ error: "Database error while checking phone number" });
        }
        
        if (existingUser) {
            return res.status(400).json({ error: "Phone number already registered" });
        }
        
        // Generate unique QR code
        const qrCode = generateQRCode("USER", cleanedPhone);

        bcrypt.hash(password, 10).then(hash => {
    const sql =
                "INSERT INTO users (phone, email, password_hash, name, address, qr_code) VALUES (?, ?, ?, ?, ?, ?)";

    db.run(
        sql,
                [cleanedPhone, email || null, hash, name.trim(), address || null, qrCode],
        function (err) {
            if (err) {
                console.error(err);
                        if (err.message.includes("UNIQUE constraint")) {
                            return res.status(400).json({ error: "Phone number or email already registered" });
                        }
                        return res.status(400).json({ error: "DB error: " + err.message });
            }
            const token = generateToken({
                id: this.lastID,
                role: "user",
                        phone: cleanedPhone,
                name,
            });
                    res.json({ token, userId: this.lastID, qrCode, needsLocation: true });
        }
    );
        }).catch(err => {
            console.error("Error hashing password:", err);
            return res.status(500).json({ error: "Error processing signup" });
        });
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

// Get plan and tier information with progress
app.get("/api/users/plan-tier", auth("user"), (req, res) => {
    const userId = req.user.id;
    
    db.get(
        "SELECT plan, total_loops_earned FROM users WHERE id = ?",
        [userId],
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: "User not found" });
            
            const totalEarned = user.total_loops_earned || 0;
            
            // Calculate current tier
            let currentTier = "BRONZE";
            let currentTierMin = 0;
            let nextTier = "SILVER";
            let nextTierMin = 200;
            
            if (totalEarned >= 1000) {
                currentTier = "PLATINUM";
                currentTierMin = 1000;
                nextTier = null;
                nextTierMin = null;
            } else if (totalEarned >= 500) {
                currentTier = "GOLD";
                currentTierMin = 500;
                nextTier = "PLATINUM";
                nextTierMin = 1000;
            } else if (totalEarned >= 200) {
                currentTier = "SILVER";
                currentTierMin = 200;
                nextTier = "GOLD";
                nextTierMin = 500;
            }
            
            // Calculate tier multipliers
            let tierMultiplier = 1;
            if (totalEarned >= 1000) tierMultiplier = 1.2;
            else if (totalEarned >= 500) tierMultiplier = 1.1;
            else if (totalEarned >= 200) tierMultiplier = 1.05;
            
            // Calculate plan multipliers
            let planMultiplier = 1;
            if (user.plan === "BASIC") planMultiplier = 1.05;
            else if (user.plan === "PLUS") planMultiplier = 1.1;
            else if (user.plan === "PREMIUM") planMultiplier = 1.2;
            
            // Progress to next tier
            const progress = nextTier 
                ? Math.min(100, ((totalEarned - currentTierMin) / (nextTierMin - currentTierMin)) * 100)
                : 100;
            const pointsNeeded = nextTier ? Math.max(0, nextTierMin - totalEarned) : 0;
            
            // Plan details
            const plans = {
                STARTER: { name: "Starter", multiplier: 1.0, description: "Basic plan" },
                BASIC: { name: "Basic", multiplier: 1.05, description: "5% bonus on all purchases" },
                PLUS: { name: "Plus", multiplier: 1.1, description: "10% bonus on all purchases" },
                PREMIUM: { name: "Premium", multiplier: 1.2, description: "20% bonus on all purchases" }
            };
            
            // Tier details
            const tiers = {
                BRONZE: { name: "Bronze", multiplier: 1.0, min: 0, description: "Starting tier" },
                SILVER: { name: "Silver", multiplier: 1.05, min: 200, description: "5% bonus - Earn 200+ total Loops" },
                GOLD: { name: "Gold", multiplier: 1.1, min: 500, description: "10% bonus - Earn 500+ total Loops" },
                PLATINUM: { name: "Platinum", multiplier: 1.2, min: 1000, description: "20% bonus - Earn 1000+ total Loops" }
            };
            
            res.json({
                currentPlan: user.plan || "STARTER",
                planDetails: plans[user.plan || "STARTER"] || plans.STARTER,
                planMultiplier,
                currentTier,
                tierDetails: tiers[currentTier],
                tierMultiplier,
                totalEarned,
                currentTierMin,
                nextTier,
                nextTierMin,
                nextTierDetails: nextTier ? tiers[nextTier] : null,
                progress: Math.round(progress * 100) / 100,
                pointsNeeded,
                combinedMultiplier: (planMultiplier * tierMultiplier).toFixed(2)
            });
        }
    );
});

app.get("/api/users/me", auth("user"), (req, res) => {
    const userId = req.user.id;
    const period = Number(req.query.period || 30);
    const storeId = req.query.store_id ? Number(req.query.store_id) : null;
    
    db.get(
        "SELECT id, phone, email, name, address, latitude, longitude, primary_zone, secondary_zone, plan, loops_balance, total_loops_earned, qr_code, location_set FROM users WHERE id = ?",
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
                earnQuery += ` AND t.created_at >= datetime('now', '-' || ? || ' days')`;
                earnParams.push(period);
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
                redeemQuery += ` AND ll.created_at >= datetime('now', '-' || ? || ' days')`;
                redeemParams.push(period);
            }
            
            // Combine both queries using UNION
            const combinedQuery = `(${earnQuery}) UNION ALL (${redeemQuery}) ORDER BY created_at DESC LIMIT 200`;
            const combinedParams = [...earnParams, ...redeemParams];
            
            db.all(combinedQuery, combinedParams, (err2, txs) => {
                if (err2) {
                    console.error("Transactions query error:", err2);
                    txs = [];
                }
                    res.json({ user, transactions: txs });
            });
        }
    );
});

// Update user profile
app.put("/api/users/profile", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { name, email, address } = req.body;
    
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }
    
    const updates = [];
    const params = [];
    
    if (name) {
        updates.push("name = ?");
        params.push(name.trim());
    }
    
    if (email !== undefined) {
        updates.push("email = ?");
        params.push(email ? email.trim() : null);
    }
    
    if (address !== undefined) {
        updates.push("address = ?");
        params.push(address ? address.trim() : null);
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
                console.error("Profile update error:", err);
                return res.status(500).json({ error: "Failed to update profile" });
            }
            
            // Get updated user
            db.get(
                "SELECT id, phone, email, name, address, latitude, longitude, primary_zone, secondary_zone, plan, loops_balance, total_loops_earned, qr_code, location_set FROM users WHERE id = ?",
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
                console.error("Location update error:", err);
                return res.status(500).json({ error: "Failed to update location" });
            }
            res.json({ success: true, message: "Location updated" });
        }
    );
});

// Scan customer QR code (store scans customer)
app.post("/api/stores/scan-customer", auth("store"), (req, res) => {
    const storeId = req.user.id;
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
        
        res.json({
            customer: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                loopsBalance: user.loops_balance
            }
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

// Helper: Calculate loops based on amount and user plan/tier
function calculateLoops(amountCents, user) {
    const baseLoops = Math.floor(amountCents / 100); // $1 -> 1 Loop
    const visitBonus = 10;
    
    let planMultiplier = 1;
    if (user.plan === "BASIC") planMultiplier = 1.05;
    if (user.plan === "PLUS") planMultiplier = 1.1;
    if (user.plan === "PREMIUM") planMultiplier = 1.2;
    
    let tierMultiplier = 1;
    const total = user.total_loops_earned;
    if (total >= 1000) tierMultiplier = 1.2;
    else if (total >= 500) tierMultiplier = 1.1;
    else if (total >= 200) tierMultiplier = 1.05;
    
    return Math.round((baseLoops + visitBonus) * planMultiplier * tierMultiplier);
}

// Check-in endpoint (replaces scan-store)
app.post("/api/users/check-in", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { qrCode, latitude, longitude } = req.body;
    
    if (!qrCode) {
        return res.status(400).json({ error: "QR code is required" });
    }
    
    // Parse QR code: STORE:id:random
    if (!qrCode.startsWith("STORE:")) {
        return res.status(400).json({ error: "Invalid store QR code format" });
    }
    
    const parts = qrCode.split(":");
    if (parts.length < 2) {
        return res.status(400).json({ error: "Invalid QR code format" });
    }
    
    const storeId = parseInt(parts[1]);
    if (isNaN(storeId)) {
        return res.status(400).json({ error: "Invalid store ID in QR code" });
    }
    
    // Check if user is blacklisted by this store
    db.get(
        "SELECT id, reason, created_at FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?",
        [storeId, userId],
        (err, blacklistEntry) => {
            if (err) {
                console.error("Blacklist check error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            
            if (blacklistEntry) {
                return res.status(403).json({ 
                    error: "You have been blocked from this store",
                    reason: blacklistEntry.reason || "No reason provided",
                    blocked_at: blacklistEntry.created_at
                });
            }
            
            // Continue with check-in if not blacklisted
            // Get store info
    db.get("SELECT id, name, category, latitude, longitude FROM stores WHERE id = ?", [storeId], (err, store) => {
        if (err || !store) {
            return res.status(404).json({ error: "Store not found" });
        }
        
        // Check if user already has an active session at this store
        db.get(
            "SELECT id FROM check_in_sessions WHERE user_id = ? AND store_id = ? AND status = 'active' AND expires_at > datetime('now')",
            [userId, storeId],
            (err2, existingSession) => {
                if (err2) {
                    return res.status(500).json({ error: "Database error" });
                }
                
                if (existingSession) {
                    // Use existing session
                    res.json({
                        success: true,
                        sessionId: existingSession.id,
                        store: {
                            id: store.id,
                            name: store.name,
                            category: store.category
                        },
                        message: "Already checked in!"
                    });
                } else {
                    // Create new check-in session (expires in 30 minutes)
                    const expiresAt = new Date();
                    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
                    
                    db.run(
                        "INSERT INTO check_in_sessions (user_id, store_id, expires_at) VALUES (?, ?, ?)",
                        [userId, storeId, expiresAt.toISOString()],
                        function(err3) {
                            if (err3) {
                                return res.status(500).json({ error: "Failed to create session" });
                            }
                            const sessionId = this.lastID;
                            
                            // Record initial location if provided
                            if (latitude && longitude) {
                                db.run(
                                    "INSERT INTO location_history (session_id, latitude, longitude) VALUES (?, ?, ?)",
                                    [sessionId, parseFloat(latitude), parseFloat(longitude)]
                                );
                            }
                            
                            // Get user info for loops calculation
                            db.get("SELECT * FROM users WHERE id = ?", [userId], (err4, user) => {
                                if (err4 || !user) {
                                    return res.status(500).json({ error: "User not found" });
                                }
                                
                                // Estimate purchase amount and calculate pending points
                                estimatePurchaseAmount(storeId, userId, (estimatedAmount) => {
                                    const loopsPending = calculateLoops(estimatedAmount, user);
                                    
                                    // Create pending points (expires in 7 days)
                                    const expiresAt = new Date();
                                    expiresAt.setDate(expiresAt.getDate() + 7);
                                    
                                    db.run(
                                        "INSERT INTO pending_points (user_id, store_id, session_id, loops_pending, expires_at, civ_score) VALUES (?, ?, ?, ?, ?, ?)",
                                        [userId, storeId, sessionId, loopsPending, expiresAt.toISOString(), 0.5],
                                        (err5) => {
                                            if (err5) {
                                                console.error("Failed to create pending points:", err5);
                                            }
                                            
                                            // Check for settlement triggers (return visit, etc.)
                                            setTimeout(() => {
                                                checkSettlementTriggers(userId, storeId, () => {});
                                            }, 500);
                                            
                                            res.json({
                                                success: true,
                                                sessionId,
                                                store: {
                                                    id: store.id,
                                                    name: store.name,
                                                    category: store.category
                                                },
                                                loopsPending,
                                                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                                                message: "Checked in! Points will unlock when you return or engage."
                                            });
                                        }
                                    );
                                });
                            });
                        }
                    );
                }
            }
        );
    });
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
    
    // Verify session belongs to user
    db.get(
        "SELECT * FROM check_in_sessions WHERE id = ? AND user_id = ? AND status = 'active'",
        [sessionId, userId],
        (err, session) => {
            if (err || !session) {
                return res.status(404).json({ error: "Session not found or expired" });
            }
            
            // Get store location
            db.get("SELECT latitude, longitude FROM stores WHERE id = ?", [session.store_id], (err2, store) => {
                if (err2 || !store) {
                    return res.status(500).json({ error: "Store not found" });
                }
                
                // Calculate CIV score
                analyzeCIVScore(sessionId, store.latitude, store.longitude, (civScore) => {
                    // Update pending points with CIV score
                    db.get(
                        "SELECT * FROM pending_points WHERE session_id = ? AND status = 'pending'",
                        [sessionId],
                        (err3, pending) => {
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
                            
                            // Mark session as completed
                            db.run(
                                "UPDATE check_in_sessions SET status = 'completed' WHERE id = ?",
                                [sessionId],
                                (err4) => {
                                    if (err4) {
                                        return res.status(500).json({ error: "Failed to complete session" });
                                    }
                                    
                                    res.json({
                                        success: true,
                                        civScore,
                                        message: "Session completed. Points will unlock when you return!"
                                    });
                                }
                            );
                        }
                    );
                });
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
            console.error("Error fetching credentials:", err);
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
                    console.error("Error processing credential:", err);
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
            
            console.log("Generating registration options with RP_ID:", RP_ID, "RP_NAME:", RP_NAME, "userName:", userName);
            console.log("UserID buffer length:", userIDBuffer.length);
            
            let options;
            try {
                // In @simplewebauthn/server v13+, generateRegistrationOptions returns a Promise
                console.log("Calling generateRegistrationOptions...");
                const result = generateRegistrationOptions(opts);
                
                // Always await it since v13+ returns a Promise
                if (result && typeof result.then === 'function') {
                    console.log("generateRegistrationOptions returned a Promise, awaiting...");
                    options = await result;
                } else {
                    // Fallback for older versions (shouldn't happen in v13+)
                    console.log("generateRegistrationOptions returned non-Promise (unexpected)");
                    options = result;
                }
                
                console.log("Options received, type:", typeof options);
                console.log("Options has challenge:", options && !!options.challenge);
                
                if (!options || !options.challenge) {
                    console.error("Invalid options generated:", options);
                    console.error("Options type:", typeof options);
                    if (options) {
                        console.error("Options keys:", Object.keys(options));
                    }
                    return res.status(500).json({ error: "Failed to generate valid registration options" });
                }
                
                console.log("Registration options generated successfully, challenge length:", options.challenge ? options.challenge.length : 0);
            } catch (genError) {
                console.error("Error in generateRegistrationOptions:", genError);
                console.error("Error message:", genError.message);
                console.error("Error stack:", genError.stack);
                return res.status(500).json({ error: "Failed to generate registration options: " + (genError.message || "Unknown error") });
            }
                
                // Store challenge temporarily (in production, use Redis)
                if (!global.webauthnChallenges) global.webauthnChallenges = {};
                global.webauthnChallenges[userId] = {
                    challenge: options.challenge,
                    type: "registration",
                    timestamp: Date.now(),
                };
                
                console.log("Registration options generated successfully");
                res.json(options);
            } catch (error) {
                console.error("Error generating registration options:", error);
                console.error("Error stack:", error.stack);
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
        
        console.log("Verification result:", {
            verified: verification.verified,
            hasRegistrationInfo: !!verification.registrationInfo,
            registrationInfoKeys: verification.registrationInfo ? Object.keys(verification.registrationInfo) : null,
            registrationInfoFull: verification.registrationInfo ? JSON.stringify(verification.registrationInfo, null, 2).substring(0, 500) : null
        });
        
        if (!verification.verified) {
            console.error("Verification failed - not verified");
            return res.status(400).json({ error: "Verification failed: credential not verified" });
        }
        
        if (!verification.registrationInfo) {
            console.error("Verification failed - no registrationInfo");
            return res.status(400).json({ error: "Verification failed: missing registration information" });
        }
        
        // Log the full registrationInfo structure
        console.log("Full registrationInfo:", JSON.stringify(verification.registrationInfo, (key, value) => {
            if (value instanceof Buffer || value instanceof Uint8Array) {
                return `[Buffer/Uint8Array: ${value.length} bytes]`;
            }
            return value;
        }, 2));
        
        // Extract from credential object (v13+ structure)
        // The structure is: registrationInfo.credential.id, registrationInfo.credential.publickey, etc.
        // Note: 'credential' is already used for the request body, so we use 'credentialInfo' here
        const credentialInfo = verification.registrationInfo.credential;
        if (!credentialInfo) {
            console.error("credential object is missing from registrationInfo");
            return res.status(400).json({ error: "Invalid credential: missing credential object" });
        }
        
        console.log("Credential object keys:", Object.keys(credentialInfo));
        console.log("Credential object:", {
            hasId: !!credentialInfo.id,
            hasPublickey: !!credentialInfo.publickey,
            hasPublicKey: !!credentialInfo.publicKey,
            counter: credentialInfo.counter
        });
        
        const credentialID = credentialInfo.id;
        const credentialPublicKey = credentialInfo.publickey || credentialInfo.publicKey; // Note: lowercase 'publickey' in v13+
        const counter = credentialInfo.counter !== undefined ? credentialInfo.counter : 0;
        
        console.log("Extracted from credential:", {
            credentialID: credentialID ? `[${typeof credentialID}: ${credentialID.length || credentialID.length || 'N/A'}]` : "undefined",
            hasCredentialID: !!credentialID,
            credentialPublicKey: credentialPublicKey ? `[${credentialPublicKey.constructor.name}: ${credentialPublicKey.length || 'N/A'} bytes]` : "undefined",
            hasCredentialPublicKey: !!credentialPublicKey,
            counter: counter,
            counterType: typeof counter
        });
            
        // Validate that we have the required data
        if (!credentialID) {
            console.error("credentialID is missing from registrationInfo");
            return res.status(400).json({ error: "Invalid credential: missing credential ID" });
        }
        
        if (!credentialPublicKey) {
            console.error("credentialPublicKey is missing from registrationInfo");
            return res.status(400).json({ error: "Invalid credential: missing public key" });
        }
        
        // Validate counter (should be a number, default to 0 if missing)
        const credentialCounter = (counter !== undefined && counter !== null) ? counter : 0;
        
        console.log("credentialID type:", typeof credentialID, credentialID instanceof Buffer, credentialID instanceof Uint8Array);
        console.log("credentialPublicKey type:", typeof credentialPublicKey, credentialPublicKey instanceof Buffer, credentialPublicKey instanceof Uint8Array);
        
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
                console.error("Unexpected credentialPublicKey type:", typeof credentialPublicKey);
                return res.status(400).json({ error: "Invalid credential: unexpected public key format" });
            }
        } catch (keyError) {
            console.error("Error converting public key:", keyError);
            return res.status(400).json({ error: "Failed to process public key: " + keyError.message });
        }
        
        // Validate userId before using it
        if (!userId) {
            console.error("userId is undefined");
            return res.status(500).json({ error: "Internal error: user ID not found" });
        }
        
        console.log("Storing credential with:", {
            userId: userId,
            userIdType: typeof userId,
            credentialIdBase64: credentialIdBase64 ? credentialIdBase64.substring(0, 20) + "..." : "null",
            publicKeyBase64: publicKeyBase64 ? publicKeyBase64.substring(0, 20) + "..." : "null",
            counter: credentialCounter,
            deviceName: deviceName || "Face ID"
        });
        
        db.run(
            "INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_name) VALUES (?, ?, ?, ?, ?)",
            [userId, credentialIdBase64, publicKeyBase64, credentialCounter, deviceName || "Face ID"],
                function (err) {
                    if (err) {
                        console.error("Error storing credential:", err);
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
        console.error("Error verifying registration:", error);
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
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
            console.error("Error finding user:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        if (!user) {
            // Don't reveal if user exists (security)
            return res.status(400).json({ error: "Invalid credentials" });
        }
        
        // Get user's WebAuthn credentials
        db.all("SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ?", [user.id], async (err, credentials) => {
            if (err) {
                console.error("Error fetching credentials:", err);
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
                    console.error("Invalid authentication options generated:", options);
                    return res.status(500).json({ error: "Failed to generate valid authentication options" });
                }
                
                // Store challenge temporarily
                if (!global.webauthnChallenges) global.webauthnChallenges = {};
                global.webauthnChallenges[user.id] = {
                    challenge: options.challenge,
                    type: "authentication",
                    timestamp: Date.now(),
                };
                
                console.log("Authentication options generated successfully");
                res.json(options);
            } catch (error) {
                console.error("Error generating authentication options:", error);
                console.error("Error stack:", error.stack);
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
            console.error("Error finding user:", err);
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
            console.error("Invalid credential structure:", credential);
            return res.status(400).json({ error: "Invalid credential: missing credential ID" });
        }
        
        // Log the full credential structure to debug
        console.log("Received credential from frontend:", {
            hasId: !!credential.id,
            hasRawId: !!credential.rawId,
            hasResponse: !!credential.response,
            responseKeys: credential.response ? Object.keys(credential.response) : null,
            credentialKeys: Object.keys(credential)
        });
        
        // credential.id is already in base64URL format from the browser
        const credentialIdBase64 = credential.id;
        
        console.log("Looking up credential:", {
            userId: user.id,
            credentialId: credentialIdBase64.substring(0, 20) + "..."
        });
        
        db.get("SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?", 
            [user.id, credentialIdBase64], async (err, dbCredential) => {
            if (err) {
                console.error("Error fetching credential:", err);
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!dbCredential) {
                return res.status(400).json({ error: "Invalid credential" });
            }
            
            // Validate counter (should be a number, default to 0 if missing)
            const credentialCounter = (dbCredential.counter !== undefined && dbCredential.counter !== null) ? dbCredential.counter : 0;
            
            console.log("Authenticating with credential:", {
                userId: user.id,
                credentialId: credentialIdBase64.substring(0, 20) + "...",
                counter: credentialCounter,
                hasPublicKey: !!dbCredential.public_key
            });
            
            try {
                // public_key is stored as base64, convert back to Buffer
                const publicKeyBuffer = isoBase64URL.toBuffer(dbCredential.public_key);
                
                // Convert credential_id to Buffer for verification
                const credentialIDBuffer = isoBase64URL.toBuffer(dbCredential.credential_id);
                
                console.log("Verification inputs:", {
                    hasResponse: !!credential,
                    hasChallenge: !!challengeData.challenge,
                    hasCredentialID: !!credentialIDBuffer,
                    credentialIDLength: credentialIDBuffer ? credentialIDBuffer.length : 0,
                    hasPublicKey: !!publicKeyBuffer,
                    publicKeyLength: publicKeyBuffer ? publicKeyBuffer.length : 0,
                    counter: credentialCounter
                });
                
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
                
                console.log("Credential object for verification:", {
                    hasId: !!webauthnCredential.id,
                    idType: typeof webauthnCredential.id,
                    idLength: webauthnCredential.id ? webauthnCredential.id.length : 0,
                    hasPublicKey: !!webauthnCredential.publicKey,
                    publicKeyType: webauthnCredential.publicKey ? webauthnCredential.publicKey.constructor.name : "undefined",
                    publicKeyLength: webauthnCredential.publicKey ? webauthnCredential.publicKey.length : 0,
                    counter: webauthnCredential.counter,
                    counterType: typeof webauthnCredential.counter
                });
                
                // Ensure challenge is a string (not a Buffer)
                const expectedChallenge = typeof challengeData.challenge === 'string' 
                    ? challengeData.challenge 
                    : challengeData.challenge.toString();
                
                console.log("Challenge details:", {
                    challengeType: typeof expectedChallenge,
                    challengeLength: expectedChallenge ? expectedChallenge.length : 0,
                    origin: ORIGIN,
                    rpID: RP_ID
                });
                
                const verification = await verifyAuthenticationResponse({
                    response: credential,
                    expectedChallenge: expectedChallenge,
                    expectedOrigin: ORIGIN,
                    expectedRPID: RP_ID,
                    credential: webauthnCredential,
                });
                
                console.log("Verification result:", {
                    verified: verification.verified,
                    hasAuthenticationInfo: !!verification.authenticationInfo,
                    authenticationInfoKeys: verification.authenticationInfo ? Object.keys(verification.authenticationInfo) : null
                });
                
                if (verification.verified) {
                    // Update counter if newCounter is available
                    if (verification.authenticationInfo && verification.authenticationInfo.newCounter !== undefined) {
                        db.run(
                            "UPDATE webauthn_credentials SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND credential_id = ?",
                            [verification.authenticationInfo.newCounter, user.id, credentialIdBase64],
                            (err) => {
                                if (err) {
                                    console.error("Error updating credential:", err);
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
                console.error("Error verifying authentication:", error);
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
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
            console.error("Error checking credentials:", err);
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
            console.error("Error deleting credential:", err);
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
    const { email, phone, password, name, zone, category, base_discount_percent, address } = req.body;
    
    // Validation - email OR phone required (at least one for verification)
    if ((!email && !phone) || !password || !name || !zone || !category) {
        return res.status(400).json({ error: "Email or phone, password, name, zone, and category are required" });
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
    
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const discount = parseInt(base_discount_percent) || 0;
    if (discount < 0 || discount > 100) {
        return res.status(400).json({ error: "Base discount must be between 0 and 100" });
    }

    // Generate temporary QR code (will be updated with store ID after insert)
    const tempQrCode = generateQRCode("STORE", `TEMP${Date.now()}`);

    const hash = await bcrypt.hash(password, 10);
    const sql =
        "INSERT INTO stores (email, phone, password_hash, name, zone, category, base_discount_percent, qr_code, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

    db.run(
        sql,
        [email || null, cleanedPhone || null, hash, name, zone, category, discount, tempQrCode, address || null],
        function (err) {
            if (err) {
                console.error(err);
                if (err.message.includes("UNIQUE constraint")) {
                    return res.status(400).json({ error: "Email or phone already registered" });
                }
                return res.status(400).json({ error: "DB error: " + err.message });
            }
            
            // Update QR code with actual store ID
            const storeId = this.lastID;
            const finalQrCode = generateQRCode("STORE", storeId.toString());
            db.run(
                "UPDATE stores SET qr_code = ? WHERE id = ?",
                [finalQrCode, storeId],
                (updateErr) => {
                    if (updateErr) {
                        console.error("Error updating QR code with store ID:", updateErr);
                        // Still return success, but with temp QR code
                    }
                    const token = generateToken({
                        id: storeId,
                        role: "store",
                        email,
                        name,
                    });
                    res.json({ token, storeId: storeId, qrCode: finalQrCode });
                }
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
                    console.error("Admin signup error:", err);
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
        console.error("Admin signup error:", error);
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
                console.error("Admin login error:", err);
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
                console.error("Admin login error:", error);
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
                console.error("Get admin error:", err);
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
            console.error("Admin users count error:", err);
            console.error("Count query:", countQuery);
            console.error("Count params:", params.length > 0 ? params.slice(0, 3) : []);
            return res.status(500).json({ error: "Database error: " + err.message });
        }
        
        const total = countResult[0].total;
        
        db.all(query, params, (err, users) => {
            if (err) {
                console.error("Admin users list error:", err);
                console.error("Query:", query);
                console.error("Params:", [...params, limitNum, offset]);
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
    console.log(`[Admin] Fetching stores for user ID: ${userId}`);
    
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
            COUNT(DISTINCT t.id) as visit_count,
            SUM(t.loops_earned) as total_loops_earned,
            SUM(t.amount_cents) as total_spent_cents,
            MAX(t.created_at) as last_visit_at,
            MIN(t.created_at) as first_visit_at
         FROM transactions t
         JOIN stores s ON t.store_id = s.id
         WHERE t.user_id = ?
         GROUP BY s.id, s.name, s.category, s.zone, s.email, s.phone, s.address, s.base_discount_percent, s.latitude, s.longitude
         ORDER BY total_spent_cents DESC`,
        [userId],
        (err, stores) => {
            if (err) {
                console.error("Admin get user stores error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            
            console.log(`[Admin] Found ${stores?.length || 0} stores for user ${userId}`);
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
                console.error("Admin get user error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            
            // Get user stats
            db.get(
                `SELECT 
                    COUNT(DISTINCT t.id) as transaction_count,
                    COALESCE(SUM(t.amount_cents), 0) as total_spent_cents,
                    COUNT(DISTINCT t.store_id) as stores_visited,
                    MAX(t.created_at) as last_transaction_at
                 FROM transactions t
                 WHERE t.user_id = ?`,
                [userId],
                (err2, stats) => {
                    if (err2) {
                        console.error("Admin get user stats error:", err2);
                        return res.status(500).json({ error: "Database error" });
                    }
                    
                    // Get store visits with loops earned per store
                    db.all(
                        `SELECT 
                            s.id as store_id,
                            s.name as store_name,
                            s.category,
                            s.zone,
                            COUNT(DISTINCT t.id) as visit_count,
                            SUM(t.loops_earned) as total_loops_earned,
                            SUM(t.amount_cents) as total_spent_cents,
                            MAX(t.created_at) as last_visit_at
                         FROM transactions t
                         JOIN stores s ON t.store_id = s.id
                         WHERE t.user_id = ?
                         GROUP BY s.id, s.name, s.category, s.zone
                         ORDER BY total_loops_earned DESC`,
                        [userId],
                        (err3, storeVisits) => {
                            if (err3) {
                                console.error("Admin get user store visits error:", err3);
                            }
                            
                            res.json({
                                user,
                                stats: stats || {
                                    transaction_count: 0,
                                    total_spent_cents: 0,
                                    stores_visited: 0,
                                    last_transaction_at: null
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
                console.error("Admin update user error:", err);
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
                console.error("Error deleting webauthn credentials:", err);
            }
        });
        
        db.run("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting password reset tokens:", err);
            }
        });
        
        db.run("DELETE FROM loops_ledger WHERE user_id = ?", [userId], (err) => {
            if (err) {
                console.error("Error deleting loops ledger:", err);
                return res.status(500).json({ error: "Database error" });
            }
        });
        
        db.run("DELETE FROM transactions WHERE user_id = ?", [userId], (err) => {
            if (err) {
                console.error("Error deleting transactions:", err);
                return res.status(500).json({ error: "Database error" });
            }
        });
        
        db.run("DELETE FROM pending_points WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting pending points:", err);
            }
        });
        
        db.run("DELETE FROM check_in_sessions WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting check-in sessions:", err);
            }
        });
        
        db.run("DELETE FROM location_history WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting location history:", err);
            }
        });
        
        db.run("DELETE FROM gift_cards WHERE user_id = ?", [userId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting gift cards:", err);
            }
        });
        
        // Finally, delete the user
        db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
            if (err) {
                console.error("Error deleting user:", err);
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
app.get("/api/admins/stores", authAdmin, (req, res) => {
    const { search, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    let query = "SELECT id, name, email, phone, category, zone, base_discount_percent, address FROM stores";
    let countQuery = "SELECT COUNT(*) as total FROM stores";
    const params = [];
    
    if (search) {
        const searchParam = `%${search}%`;
        query += " WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR category LIKE ?";
        countQuery += " WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR category LIKE ?";
        params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    query += ` ORDER BY id DESC LIMIT ${limitNum} OFFSET ${offset}`;
    
    db.all(countQuery, params.length > 0 ? params.slice(0, 4) : [], (err, countResult) => {
        if (err) {
            console.error("Admin stores count error:", err);
            console.error("Count query:", countQuery);
            console.error("Count params:", params.length > 0 ? params.slice(0, 4) : []);
            return res.status(500).json({ error: "Database error: " + err.message });
        }
        
        const total = countResult[0].total;
        
        db.all(query, params, (err, stores) => {
            if (err) {
                console.error("Admin stores list error:", err);
                console.error("Query:", query);
                console.error("Params:", [...params, limitNum, offset]);
                return res.status(500).json({ error: "Database error: " + err.message });
            }
            
            res.json({
                stores: stores || [],
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

// Get store customers (admin only) - MUST be before /api/admins/stores/:id
app.get("/api/admins/stores/:id/customers", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    console.log(`[Admin] Fetching customers for store ID: ${storeId}`);
    
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
            COUNT(DISTINCT t.id) as visit_count,
            SUM(t.loops_earned) as total_loops_earned,
            SUM(t.amount_cents) as total_spent_cents,
            MAX(t.created_at) as last_visit_at
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         WHERE t.store_id = ?
         GROUP BY u.id, u.name, u.phone, u.email, u.plan
         ORDER BY total_spent_cents DESC`,
        [storeId],
        (err, customers) => {
            if (err) {
                console.error("Admin get store customers error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            
            console.log(`[Admin] Found ${customers?.length || 0} customers for store ${storeId}`);
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
                console.error("Admin get store error:", err);
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
                        console.error("Admin get store stats error:", err2);
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
                            if (errDaily) console.error("Daily customer stat error:", errDaily);
                            
                            // Get weekly
                            db.get(
                                `SELECT COUNT(DISTINCT user_id) as unique_customers
                                 FROM transactions
                                 WHERE store_id = ? AND created_at >= datetime('now', '-7 days', 'localtime')`,
                                [storeId],
                                (errWeekly, weeklyStat) => {
                                    if (errWeekly) console.error("Weekly customer stat error:", errWeekly);
                                    
                                    // Get monthly
                                    db.get(
                                        `SELECT COUNT(DISTINCT user_id) as unique_customers
                                         FROM transactions
                                         WHERE store_id = ? AND created_at >= datetime('now', '-30 days', 'localtime')`,
                                        [storeId],
                                        (errMonthly, monthlyStat) => {
                                            if (errMonthly) console.error("Monthly customer stat error:", errMonthly);
                                            
                                            // Get yearly
                                            db.get(
                                                `SELECT COUNT(DISTINCT user_id) as unique_customers
                                                 FROM transactions
                                                 WHERE store_id = ? AND created_at >= datetime('now', '-365 days', 'localtime')`,
                                                [storeId],
                                                (errYearly, yearlyStat) => {
                                                    if (errYearly) console.error("Yearly customer stat error:", errYearly);
                                                    
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
                                                                console.error("Admin get store gift card stats error:", err4);
                                                            }
                                                            
                                                            res.json({
                                                                store,
                                                                stats: stats || {
                                                                    transaction_count: 0,
                                                                    total_revenue_cents: 0,
                                                                    unique_customers: 0,
                                                                    last_transaction_at: null
                                                                },
                                                                customerStats: customerStats || [],
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
});

// Update store (admin only)
app.put("/api/admins/stores/:id", authAdmin, (req, res) => {
    const storeId = parseInt(req.params.id);
    const { name, email, phone, category, zone, base_discount_percent, address } = req.body;
    
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
    
    if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    
    params.push(storeId);
    
    db.run(
        `UPDATE stores SET ${updates.join(", ")} WHERE id = ?`,
        params,
        function (err) {
            if (err) {
                console.error("Admin update store error:", err);
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
                console.error("Error deleting transactions:", err);
                return res.status(500).json({ error: "Database error" });
            }
        });
        
        db.run("DELETE FROM pending_points WHERE store_id = ?", [storeId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting pending points:", err);
            }
        });
        
        db.run("DELETE FROM check_in_sessions WHERE store_id = ?", [storeId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting check-in sessions:", err);
            }
        });
        
        db.run("DELETE FROM gift_cards WHERE store_id = ?", [storeId], (err) => {
            if (err && !err.message.includes("no such table")) {
                console.error("Error deleting gift cards:", err);
            }
        });
        
        // Finally, delete the store
        db.run("DELETE FROM stores WHERE id = ?", [storeId], function(err) {
            if (err) {
                console.error("Error deleting store:", err);
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
        query = "SELECT * FROM stores WHERE email = ?";
        queryValue = email;
    } else {
        // Validate phone format
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: "Invalid phone number format" });
        }
        const cleanedPhone = phone.replace(/\D/g, '');
        query = "SELECT * FROM stores WHERE phone = ?";
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


// Store profile + stats
app.get("/api/stores/me", authStore, (req, res) => {
    const storeId = req.storeId;

    db.get(
        "SELECT id, name, zone, category, base_discount_percent, phone, email, latitude, longitude, address, qr_code FROM stores WHERE id = ?",
        [storeId],
        (err, store) => {
            if (err) return res.status(500).json({ error: "DB error" });
            if (!store) return res.status(404).json({ error: "Store not found" });

            console.log(`[DEBUG] Store ${storeId} from DB:`, {
                id: store.id,
                name: store.name,
                hasQrCode: !!store.qr_code,
                qrCode: store.qr_code,
                qrCodeType: typeof store.qr_code,
                allKeys: Object.keys(store)
            });

            // Generate QR code if missing (use store ID, not phone/email)
            if (!store.qr_code || (typeof store.qr_code === 'string' && !store.qr_code.trim())) {
                // Use store ID for QR code to ensure it can be parsed correctly
                const qrCode = generateQRCode("STORE", store.id.toString());
                
                db.run(
                    "UPDATE stores SET qr_code = ? WHERE id = ?",
                    [qrCode, storeId],
                    (updateErr) => {
                        if (updateErr) {
                            console.error("Error generating QR code:", updateErr);
                            // Still continue with stats, but store won't have qr_code
                        } else {
                            store.qr_code = qrCode;
                            console.log(`Generated QR code for store ${storeId}: ${qrCode}`);
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

                            // Ensure qr_code is included in response
                            const storeResponse = {
                                id: store.id,
                                name: store.name,
                                zone: store.zone,
                                category: store.category,
                                base_discount_percent: store.base_discount_percent,
                                phone: store.phone,
                                email: store.email,
                                latitude: store.latitude,
                                longitude: store.longitude,
                                address: store.address,
                                qr_code: store.qr_code || null  // Explicitly include qr_code
                            };
                            
                            console.log(`[DEBUG] Returning store ${storeId}:`, {
                                hasQrCode: !!storeResponse.qr_code,
                                qrCode: storeResponse.qr_code,
                                allKeys: Object.keys(storeResponse)
                            });

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
        }
    );
});


// ---------- store lookup customer ----------

app.get("/api/stores/customer/:userId", auth("store"), (req, res) => {
    const userId = req.params.userId;
    db.get(
        "SELECT id, name, loops_balance, total_loops_earned, plan, primary_zone, secondary_zone FROM users WHERE id = ?",
        [userId],
        (err, row) => {
            if (err || !row) return res.status(404).json({ error: "Customer not found" });

            // simple tier calc based on total_loops_earned
            const total = row.total_loops_earned;
            let tier = "BRONZE";
            if (total >= 1000) tier = "PLATINUM";
            else if (total >= 500) tier = "GOLD";
            else if (total >= 200) tier = "SILVER";

            res.json({ ...row, tier });
        }
    );
});

// Store: list today's customers
app.get("/api/stores/customers-today", authStore, (req, res) => {
    const storeId = req.storeId;

      db.all(
    `
    SELECT 
      t.id,
      t.created_at AS timestamp,
      t.loops_earned,
      t.amount_cents,
      u.name AS user_name,
      u.phone AS user_phone,
      u.email AS user_email
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.store_id = ?
      AND date(t.created_at) = date('now','localtime')
    ORDER BY t.created_at DESC
    `,
    [storeId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ customers: rows });
    }
  );
});

// ---------- transaction with Loops earning ----------

app.post("/api/stores/transaction", auth("store"), (req, res) => {
    const storeId = req.user.id;
    const { userId, amount } = req.body;
    if (!userId || !amount)
        return res.status(400).json({ error: "Missing userId or amount" });

    const amountCents = toCents(amount);

    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });

        db.get("SELECT * FROM stores WHERE id = ?", [storeId], (err2, store) => {
            if (err2 || !store)
                return res.status(404).json({ error: "Store not found" });

            // ----- base Loops rules -----
            // 1 Loop per $1 (per 100 cents) + fixed visit bonus
            const baseLoops = Math.floor(amountCents / 100); // $1 -> 1 Loop
            const visitBonus = 10; // per visit bonus

            // plan bonus
            let planMultiplier = 1;
            if (user.plan === "BASIC") planMultiplier = 1.05;
            if (user.plan === "PLUS") planMultiplier = 1.1;
            if (user.plan === "PREMIUM") planMultiplier = 1.2;

            // tier multiplier based on total_loops_earned
            let tierMultiplier = 1;
            const total = user.total_loops_earned;
            if (total >= 1000) tierMultiplier = 1.2;
            else if (total >= 500) tierMultiplier = 1.1;
            else if (total >= 200) tierMultiplier = 1.05;

            let loopsEarned = Math.round(
                (baseLoops + visitBonus) * planMultiplier * tierMultiplier
            );

            // insert transaction
            db.run(
                "INSERT INTO transactions (user_id, store_id, amount_cents, loops_earned) VALUES (?, ?, ?, ?)",
                [userId, storeId, amountCents, loopsEarned],
                function (err3) {
                    if (err3) {
                        console.error(err3);
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
                                console.error(err4);
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

// ---------- Loops redemption ----------

app.post("/api/users/redeem", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { amount, storeId, description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid redemption amount" });
    }

    const loopsToRedeem = Math.floor(Number(amount));

    // Get user current balance
    db.get("SELECT loops_balance FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.loops_balance < loopsToRedeem) {
            return res.status(400).json({ 
                error: `Insufficient Loops. You have ${user.loops_balance}, need ${loopsToRedeem}` 
            });
        }

        // Update balance
        const newBalance = user.loops_balance - loopsToRedeem;
        db.run(
            "UPDATE users SET loops_balance = ? WHERE id = ?",
            [newBalance, userId],
            (err2) => {
                if (err2) {
                    console.error(err2);
                    return res.status(500).json({ error: "DB error updating balance" });
                }

                // Record in ledger
                const meta = storeId 
                    ? `store:${storeId}${description ? `:${description}` : ""}` 
                    : description || "manual";
                
                db.run(
                    "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'REDEEM', ?, ?)",
                    [userId, -loopsToRedeem, meta],
                    (err3) => {
                        if (err3) {
                            console.error(err3);
                        }
                    }
                );

                // Emit real-time update
                io.emit("redemption", {
                    userId,
                    loopsRedeemed: loopsToRedeem,
                    newBalance,
                    timestamp: new Date().toISOString()
                });

                res.json({
                    success: true,
                    loopsRedeemed: loopsToRedeem,
                    newBalance,
                    message: `Successfully redeemed ${loopsToRedeem} Loops`
                });
            }
        );
    });
});

// ---------- Gift Cards System ----------

// Configuration
const MIN_POINTS_FOR_GIFT_CARD = 1000; // Minimum points required to create gift card
const GIFT_CARD_EXCHANGE_RATE = 100; // 100 Loops = $1 gift card
const GIFT_CARD_VALIDITY_DAYS = 90; // Valid for 90 days

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
    
    // Validate card type (default to 'digital')
    const giftCardType = cardType === 'physical' ? 'physical' : 'digital';
    
    if (!loopsAmount || loopsAmount < MIN_POINTS_FOR_GIFT_CARD) {
        return res.status(400).json({ 
            error: `Minimum ${MIN_POINTS_FOR_GIFT_CARD} Loops required to create a gift card. You need ${MIN_POINTS_FOR_GIFT_CARD} Loops minimum.` 
        });
    }
    
    const loopsToRedeem = Math.floor(Number(loopsAmount));
    
    // Calculate gift card value (100 Loops = $1)
    const giftCardValue = loopsToRedeem / GIFT_CARD_EXCHANGE_RATE;
    
    // Get user current balance
    db.get("SELECT loops_balance FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        if (user.loops_balance < loopsToRedeem) {
            return res.status(400).json({ 
                error: `Insufficient Loops. You have ${user.loops_balance}, need ${loopsToRedeem}` 
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
            [giftCardCode, userId, storeId || null, giftCardValue, giftCardValue, loopsToRedeem, expiresAt.toISOString(), giftCardType, issuedAt],
            function(err2) {
                if (err2) {
                    console.error("Error creating gift card:", err2);
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
                    [userId, -loopsToRedeem, `gift_card:${giftCardId}:${giftCardCode}`]
                );
                
                // Check for settlement triggers (redemption unlocks pending points)
                if (storeId) {
                    setTimeout(() => {
                        checkSettlementTriggers(userId, storeId, () => {});
                    }, 500);
                }
                
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
    });
});

// Check gift card eligibility (minimum points) - MUST come before /api/users/gift-cards/:id
app.get("/api/users/gift-cards/eligibility", auth("user"), (req, res) => {
    const userId = req.user.id;
    
    db.get("SELECT loops_balance FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        const isEligible = user.loops_balance >= MIN_POINTS_FOR_GIFT_CARD;
        const pointsNeeded = isEligible ? 0 : MIN_POINTS_FOR_GIFT_CARD - user.loops_balance;
        
        res.json({
            isEligible,
            currentBalance: user.loops_balance,
            minimumRequired: MIN_POINTS_FOR_GIFT_CARD,
            pointsNeeded,
            exchangeRate: GIFT_CARD_EXCHANGE_RATE,
            message: isEligible 
                ? `You're eligible! Minimum ${MIN_POINTS_FOR_GIFT_CARD} Loops required. 100 Loops = $1 gift card.`
                : `You need ${pointsNeeded} more Loops to be eligible for a gift card. Minimum ${MIN_POINTS_FOR_GIFT_CARD} Loops required.`
        });
    });
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
            console.error("Error fetching gift cards:", err);
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
                        console.error("Error fetching transactions:", err2);
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
                
                // Get user balance
                db.get("SELECT loops_balance FROM users WHERE id = ?", [userId], (err2, user) => {
                    if (err2 || !user) {
                        return res.status(404).json({ error: "User not found" });
                    }
                    
                    if (user.loops_balance < loopsNeeded) {
                        return res.status(400).json({ 
                            error: `Insufficient Loops. You have ${user.loops_balance}, need ${loopsNeeded}` 
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
                    const newUserBalance = user.loops_balance - loopsNeeded;
                    db.run(
                        "UPDATE users SET loops_balance = ? WHERE id = ?",
                        [newUserBalance, userId]
                    );
                    
                    // Record in ledger
                    db.run(
                        "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'REDEEM', ?, ?)",
                        [userId, -loopsNeeded, `gift_card_topup:${giftCardId}`]
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
    const storeId = req.user.id;
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
    const storeId = req.user.id;
    
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
                console.error("Error fetching pending physical gift cards:", err);
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
    const storeId = req.user.id;
    const storeUserId = req.user.id; // Store user ID
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
                console.error("Error fetching gift card:", err);
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
                        console.error("Error issuing gift card:", err2);
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
    const storeId = req.user.id;
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
        "SELECT id, name, zone, category, base_discount_percent, phone, latitude, longitude FROM stores WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
        [],
        (err, rows) => {
            if (err) {
                console.error(err);
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

// ---------- List all stores (for filtering) ----------

app.get("/api/stores/list", (req, res) => {
    db.all(
        "SELECT id, name, category, zone FROM stores ORDER BY name",
        [],
        (err, stores) => {
            if (err) {
                console.error(err);
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
                console.error(err);
                return res.status(500).json({ error: "DB error updating location" });
            }
            res.json({ success: true, latitude: lat, longitude: lng });
        }
    );
});

// ---------- Socket.io connection handling ----------

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join store room for real-time updates
    socket.on("join-store", (storeId) => {
        socket.join(`store:${storeId}`);
        console.log(`Socket ${socket.id} joined store:${storeId}`);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
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

    // Get transaction stats - use datetime with proper string interpolation
    let dateFilter = '';
    const params = [userId];
    if (period > 0) {
        // SQLite datetime with string concatenation
        dateFilter = `AND datetime(created_at) >= datetime('now', '-' || ? || ' days')`;
        params.push(period);
    }

    db.all(
        `SELECT 
            COUNT(*) as total_transactions,
            COALESCE(SUM(amount_cents), 0) as total_spent_cents,
            COALESCE(SUM(loops_earned), 0) as total_loops_earned,
            COALESCE(AVG(amount_cents), 0) as avg_transaction_cents,
            COUNT(DISTINCT store_id) as unique_stores
        FROM transactions
        WHERE user_id = ? ${dateFilter}`,
        params,
        (err, stats) => {
            if (err) {
                console.error("Analytics stats error:", err);
                return res.status(500).json({ error: "DB error: " + err.message });
            }

            // Get daily transaction trend
            const trendParams = [userId];
            if (period > 0) trendParams.push(period);
            db.all(
                `SELECT 
                    date(created_at) as date,
                    COUNT(*) as count,
                    COALESCE(SUM(amount_cents), 0) as amount_cents,
                    COALESCE(SUM(loops_earned), 0) as loops_earned
                FROM transactions
                WHERE user_id = ? ${dateFilter}
                GROUP BY date(created_at)
                ORDER BY date ASC`,
                trendParams,
                (err2, dailyTrend) => {
                    if (err2) {
                        console.error("Daily trend error:", err2);
                        return res.status(500).json({ error: "DB error: " + err2.message });
                    }

                    // Get store breakdown
                    const breakdownParams = [userId];
                    if (period > 0) breakdownParams.push(period);
                    db.all(
                        `SELECT 
                            s.name as store_name,
                            s.category,
                            COUNT(*) as visit_count,
                            COALESCE(SUM(t.amount_cents), 0) as total_spent_cents,
                            COALESCE(SUM(t.loops_earned), 0) as total_loops_earned
                        FROM transactions t
                        JOIN stores s ON t.store_id = s.id
                        WHERE t.user_id = ? ${dateFilter}
                        GROUP BY s.id
                        ORDER BY visit_count DESC`,
                        breakdownParams,
                        (err3, storeBreakdown) => {
                            if (err3) {
                                console.error("Store breakdown error:", err3);
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
                                        total_transactions: 0,
                                        total_spent_cents: 0,
                                        total_loops_earned: 0,
                                        avg_transaction_cents: 0,
                                        unique_stores: 0
                                    };

                                    // Debug: Check if we have any transactions at all for this user
                                    db.all(
                                        `SELECT COUNT(*) as total FROM transactions WHERE user_id = ?`,
                                        [userId],
                                        (debugErr, debugRows) => {
                                            if (!debugErr && debugRows[0]) {
                                                console.log(`[Analytics] User ${userId}: Total transactions in DB: ${debugRows[0].total}, Period filter: ${period} days`);
                                            }
                                        }
                                    );

                                    console.log(`[Analytics] User ${userId}, period ${period} days:`, {
                                        overview,
                                        dailyTrendCount: dailyTrend?.length || 0,
                                        storeBreakdownCount: storeBreakdown?.length || 0,
                                        currentBalance: user?.loops_balance || 0,
                                        totalEarned: user?.total_loops_earned || 0
                                    });

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

// Store Analytics
app.get("/api/analytics/store", authStore, (req, res) => {
    const storeId = req.storeId;
    const period = req.query.period || "30"; // days

    // Overview stats
    db.all(
        `SELECT 
            COUNT(DISTINCT user_id) as unique_customers,
            COUNT(*) as total_transactions,
            COALESCE(SUM(amount_cents), 0) as total_revenue_cents,
            COALESCE(SUM(loops_earned), 0) as total_loops_given,
            COALESCE(AVG(amount_cents), 0) as avg_transaction_cents,
            COALESCE(MAX(amount_cents), 0) as max_transaction_cents
        FROM transactions
        WHERE store_id = ? AND created_at >= datetime('now', '-' || ? || ' days')`,
        [storeId, period],
        (err, stats) => {
            if (err) return res.status(500).json({ error: "DB error" });

            // Daily trend
            db.all(
                `SELECT 
                    date(created_at) as date,
                    COUNT(*) as transaction_count,
                    COUNT(DISTINCT user_id) as customer_count,
                    COALESCE(SUM(amount_cents), 0) as revenue_cents,
                    COALESCE(SUM(loops_earned), 0) as loops_given
                FROM transactions
                WHERE store_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
                GROUP BY date(created_at)
                ORDER BY date ASC`,
                [storeId, period],
                (err2, dailyTrend) => {
                    if (err2) return res.status(500).json({ error: "DB error" });

                    // Top customers
                    db.all(
                        `SELECT 
                            u.id as user_id,
                            u.name as user_name,
                            u.phone as user_phone,
                            u.email as user_email,
                            COUNT(*) as visit_count,
                            COALESCE(SUM(t.amount_cents), 0) as total_spent_cents,
                            COALESCE(SUM(t.loops_earned), 0) as total_loops_earned
                        FROM transactions t
                        JOIN users u ON t.user_id = u.id
                        WHERE t.store_id = ? AND t.created_at >= datetime('now', '-' || ? || ' days')
                        GROUP BY u.id
                        ORDER BY visit_count DESC
                        LIMIT 10`,
                        [storeId, period],
                        (err3, topCustomers) => {
                            if (err3) return res.status(500).json({ error: "DB error" });

                            res.json({
                                overview: stats[0],
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

// System-wide Analytics (for admin)
app.get("/api/analytics/system", authAdmin, (req, res) => {
    // Basic system stats
    db.all(
        `SELECT 
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM stores) as total_stores,
            (SELECT COUNT(*) FROM transactions) as total_transactions,
            (SELECT COALESCE(SUM(loops_balance), 0) FROM users) as total_loops_in_circulation,
            (SELECT COALESCE(SUM(total_loops_earned), 0) FROM users) as total_loops_ever_earned,
            (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions) as total_revenue_cents,
            (SELECT COUNT(*) FROM gift_cards) as total_gift_cards_issued,
            (SELECT COUNT(*) FROM gift_cards WHERE status = 'active') as active_gift_cards,
            (SELECT COUNT(*) FROM gift_cards WHERE card_type = 'physical') as physical_gift_cards,
            (SELECT COALESCE(SUM(original_value), 0) FROM gift_cards) as total_gift_card_value,
            (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at >= datetime('now', '-30 days')) as active_customers_30d
        `,
        [],
        (err, stats) => {
            if (err) return res.status(500).json({ error: "DB error" });

                    // Transaction growth (daily)
                    db.all(
                        `SELECT 
                            date(created_at) as date,
                            COUNT(*) as transaction_count,
                            COUNT(DISTINCT user_id) as new_customers,
                            COALESCE(SUM(amount_cents), 0) as revenue_cents
                        FROM transactions
                        WHERE created_at >= datetime('now', '-30 days')
                        GROUP BY date(created_at)
                        ORDER BY date DESC
                        LIMIT 30`,
                        [],
                (err2, userGrowth) => {
                    if (err2) return res.status(500).json({ error: "DB error" });

                    // Store performance
                    db.all(
                        `SELECT 
                            s.name,
                            s.category,
                            s.zone,
                            COUNT(DISTINCT t.user_id) as customer_count,
                            COUNT(t.id) as transaction_count,
                            COALESCE(SUM(t.amount_cents), 0) as revenue_cents,
                            COALESCE(SUM(t.loops_earned), 0) as loops_given
                        FROM stores s
                        LEFT JOIN transactions t ON s.id = t.store_id
                        GROUP BY s.id
                        ORDER BY transaction_count DESC`,
                        [],
                        (err3, storePerformance) => {
                            if (err3) return res.status(500).json({ error: "DB error" });

                            // Tier distribution
                            db.all(
                                `SELECT 
                                    CASE 
                                        WHEN total_loops_earned >= 1000 THEN 'PLATINUM'
                                        WHEN total_loops_earned >= 500 THEN 'GOLD'
                                        WHEN total_loops_earned >= 200 THEN 'SILVER'
                                        ELSE 'BRONZE'
                                    END as tier,
                                    COUNT(*) as count
                                FROM users
                                GROUP BY tier`,
                                [],
                                (err4, tierDistribution) => {
                                    if (err4) return res.status(500).json({ error: "DB error" });

                                    // Additional analytics: Average transaction value
                                    db.get(
                                        `SELECT 
                                            COALESCE(AVG(amount_cents), 0) as avg_transaction_cents,
                                            COALESCE(MIN(amount_cents), 0) as min_transaction_cents,
                                            COALESCE(MAX(amount_cents), 0) as max_transaction_cents,
                                            COUNT(DISTINCT DATE(created_at)) as active_days
                                         FROM transactions
                                         WHERE created_at >= datetime('now', '-30 days')`,
                                        [],
                                        (err5, transactionMetrics) => {
                                            if (err5) {
                                                console.error("Transaction metrics error:", err5);
                                            }

                                            // Redemption rate (loops redeemed vs earned)
                                            db.get(
                                                `SELECT 
                                                    (SELECT COALESCE(SUM(ABS(amount)), 0) FROM loops_ledger WHERE change_type = 'REDEEM') as total_redeemed,
                                                    (SELECT COALESCE(SUM(total_loops_earned), 0) FROM users) as total_earned`,
                                                [],
                                                (err6, redemptionStats) => {
                                                    if (err6) {
                                                        console.error("Redemption stats error:", err6);
                                                    }

                                                    // Top stores by revenue
                                                    db.all(
                                                        `SELECT 
                                                            s.name,
                                                            s.category,
                                                            COUNT(t.id) as transaction_count,
                                                            COALESCE(SUM(t.amount_cents), 0) as revenue_cents,
                                                            COALESCE(AVG(t.amount_cents), 0) as avg_transaction_cents
                                                         FROM stores s
                                                         LEFT JOIN transactions t ON s.id = t.store_id
                                                         WHERE t.created_at >= datetime('now', '-30 days')
                                                         GROUP BY s.id
                                                         ORDER BY revenue_cents DESC
                                                         LIMIT 5`,
                                                        [],
                                                        (err7, topStoresByRevenue) => {
                                                            if (err7) {
                                                                console.error("Top stores error:", err7);
                                                            }

                                                            // Customer retention (customers who visited multiple times in last 30 days)
                                                            db.get(
                                                                `SELECT 
                                                                    COUNT(DISTINCT CASE WHEN visit_count > 1 THEN user_id END) as returning_customers,
                                                                    COUNT(DISTINCT user_id) as total_active_customers
                                                                 FROM (
                                                                     SELECT user_id, COUNT(*) as visit_count
                                                                     FROM transactions
                                                                     WHERE created_at >= datetime('now', '-30 days')
                                                                     GROUP BY user_id
                                                                 )`,
                                                                [],
                                                                (err8, retentionStats) => {
                                                                    if (err8) {
                                                                        console.error("Retention stats error:", err8);
                                                                    }

                                                                    res.json({
                                                                        overview: stats[0],
                                                                        transactionGrowth: userGrowth,
                                                                        storePerformance,
                                                                        tierDistribution,
                                                                        transactionMetrics: transactionMetrics || {},
                                                                        redemptionStats: redemptionStats || { total_redeemed: 0, total_earned: 0 },
                                                                        topStoresByRevenue: topStoresByRevenue || [],
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
                        console.error("Failed to unlock points:", err2);
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
                        
                        console.log(`Unlocked ${pending.loops_pending} points for user ${pending.user_id} via ${triggerType}`);
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
                console.log(`Expired ${pending.loops_pending} pending points for user ${pending.user_id}`);
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

httpServer.listen(PORT, () => {
    console.log(`CityCircle backend running at http://localhost:${PORT}`);
    console.log(`WebSocket server ready for real-time updates`);
    console.log(`Hybrid system (CIV + DVS) enabled`);
    
    // Initial settlement check
    setTimeout(() => {
        checkExpiredPendingPoints();
    }, 1000);
});