# CityCircle: Reducing Real-World Friction - Implementation Plan

## 📋 Overview

This document outlines the implementation plan for reducing real-world friction in CityCircle based on identified problems:
1. NFC Tap + QR Scan (dual entry points)
2. Wallet-first entry point (Apple/Google Wallet)
3. Category-based rules (replace 24-hour cooldown)
4. Make DVS understandable (better UI/UX)

---

## 🎯 Implementation Phases

### Phase 1: Category-Based Rules (Priority 1 - Core Fix)
**Why First**: This fixes the biggest real-world problem (24-hour cooldown doesn't work for all store types)

### Phase 2: NFC Tap Support (Priority 2 - Major UX Improvement)
**Why Second**: Makes check-in faster and works with any payment method

### Phase 3: DVS UI/UX Improvements (Priority 3 - User Understanding)
**Why Third**: Improves user experience with pending points

### Phase 4: Wallet Integration (Priority 4 - Future Enhancement)
**Why Fourth**: Requires external API integration, more complex

---

## 📊 Phase 1: Category-Based Rules

### Problem
Current 24-hour cooldown breaks real behavior:
- Liquor/gas stores: Customers visit 2-3 times per day
- Laundromats: Customers visit twice in one day (wash + dry)
- Cafés: Customers might visit multiple times
- Barbers: Customers visit once every 2-4 weeks

### Solution
Replace global 24-hour cooldown with category-specific profiles.

### Database Schema Changes

```sql
-- Category profiles table
CREATE TABLE IF NOT EXISTS category_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT UNIQUE NOT NULL,  -- 'coffee', 'grocery', 'liquor', 'laundromat', 'barber', etc.
  max_rewarded_visits_per_day INTEGER NOT NULL DEFAULT 1,
  cooldown_minutes INTEGER NOT NULL DEFAULT 1440,  -- 24 hours default
  min_dwell_minutes INTEGER NOT NULL DEFAULT 3,
  base_points INTEGER NOT NULL DEFAULT 10,
  pending_ratio REAL NOT NULL DEFAULT 1.0,  -- 1.0 = all pending, 0.5 = 50% instant, 50% pending
  dvs_expiry_days INTEGER NOT NULL DEFAULT 7,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default category profiles
INSERT INTO category_profiles (category, max_rewarded_visits_per_day, cooldown_minutes, min_dwell_minutes, base_points, pending_ratio, dvs_expiry_days) VALUES
-- Liquor / Convenience / Gas
('liquor', 3, 60, 1, 8, 0.8, 7),
('convenience', 3, 60, 1, 8, 0.8, 7),
('gas', 2, 120, 2, 8, 0.8, 7),

-- Grocery / Pharmacy
('grocery', 2, 180, 3, 10, 0.7, 7),
('pharmacy', 2, 180, 5, 10, 0.7, 7),

-- Coffee / Café
('coffee', 2, 120, 3, 10, 0.7, 7),
('cafe', 2, 120, 3, 10, 0.7, 7),

-- Barber / Nail / Salon
('barber', 1, 20160, 15, 15, 0.6, 14),  -- 14 days cooldown
('nail', 1, 20160, 20, 15, 0.6, 14),
('salon', 1, 20160, 30, 15, 0.6, 14),

-- Laundromat (special case: 2 visits per day allowed)
('laundromat', 2, 60, 15, 10, 0.7, 7),

-- Restaurant / Food
('restaurant', 1, 240, 10, 12, 0.7, 7),
('food', 1, 240, 10, 12, 0.7, 7),

-- Default (fallback)
('other', 1, 1440, 3, 10, 0.7, 7);

-- Add category_profile_id to stores table (optional, for store-specific overrides)
-- For now, we'll use category to look up profile

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_category_profiles_category ON category_profiles(category);
```

### Backend Changes

#### 1. Create Category Profile Service

```javascript
// citycircle-backend/services/categoryProfiles.js

/**
 * Get category profile for a store category
 */
function getCategoryProfile(category, callback) {
    db.get(
        "SELECT * FROM category_profiles WHERE category = ?",
        [category],
        (err, profile) => {
            if (err) {
                return callback(err, null);
            }
            // If no profile found, use default 'other' profile
            if (!profile) {
                db.get(
                    "SELECT * FROM category_profiles WHERE category = 'other'",
                    [],
                    (err2, defaultProfile) => {
                        if (err2) {
                            return callback(err2, null);
                        }
                        callback(null, defaultProfile);
                    }
                );
            } else {
                callback(null, profile);
            }
        }
    );
}

/**
 * Check if user can check in based on category rules
 */
function canCheckIn(userId, storeId, category, callback) {
    // Get category profile
    getCategoryProfile(category, (err, profile) => {
        if (err || !profile) {
            return callback(err, { allowed: false, reason: "Category profile not found" });
        }

        // Get user's check-ins today for this store
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        db.get(
            `SELECT COUNT(*) as visit_count,
                    MAX(checked_in_at) as last_check_in
             FROM check_in_sessions
             WHERE user_id = ? 
               AND store_id = ? 
               AND date(checked_in_at) = date('now', 'localtime')
               AND status IN ('completed', 'active')`,
            [userId, storeId],
            (err2, result) => {
                if (err2) {
                    return callback(err2, { allowed: false, reason: "Database error" });
                }

                const visitCount = result.visit_count || 0;
                const lastCheckIn = result.last_check_in;

                // Check max visits per day
                if (visitCount >= profile.max_rewarded_visits_per_day) {
                    return callback(null, {
                        allowed: false,
                        reason: `You've already checked in ${profile.max_rewarded_visits_per_day} time(s) today. Come back tomorrow!`,
                        cooldownMinutes: null
                    });
                }

                // Check cooldown period
                if (lastCheckIn) {
                    const lastCheckInTime = new Date(lastCheckIn);
                    const minutesSince = (Date.now() - lastCheckInTime.getTime()) / (1000 * 60);
                    
                    if (minutesSince < profile.cooldown_minutes) {
                        const remainingMinutes = Math.ceil(profile.cooldown_minutes - minutesSince);
                        return callback(null, {
                            allowed: false,
                            reason: `Please wait ${remainingMinutes} more minute(s) before checking in again.`,
                            cooldownMinutes: remainingMinutes
                        });
                    }
                }

                // All checks passed
                callback(null, {
                    allowed: true,
                    profile: profile
                });
            }
        );
    });
}

module.exports = {
    getCategoryProfile,
    canCheckIn
};
```

#### 2. Update Check-In Endpoint

```javascript
// citycircle-backend/server.js
const { canCheckIn, getCategoryProfile } = require('./services/categoryProfiles');

app.post("/api/users/check-in", auth("user"), (req, res) => {
    const userId = req.user.id;
    const { qrCode, storeId, latitude, longitude, checkInMethod } = req.body; // checkInMethod: 'qr' | 'nfc' | 'wallet'
    
    // Support both QR code and direct storeId
    let finalStoreId = storeId;
    
    if (qrCode) {
        // Parse QR code: STORE:id:random
        if (!qrCode.startsWith("STORE:")) {
            return res.status(400).json({ error: "Invalid store QR code format" });
        }
        
        const parts = qrCode.split(":");
        if (parts.length < 2) {
            return res.status(400).json({ error: "Invalid QR code format" });
        }
        
        finalStoreId = parseInt(parts[1]);
        if (isNaN(finalStoreId)) {
            return res.status(400).json({ error: "Invalid store ID in QR code" });
        }
    }
    
    if (!finalStoreId) {
        return res.status(400).json({ error: "Store ID or QR code is required" });
    }
    
    const continueWithCheckIn = () => {
        // Get store info
        db.get("SELECT id, name, category, latitude, longitude FROM stores WHERE id = ?", [finalStoreId], (err, store) => {
            if (err || !store) {
                return res.status(404).json({ error: "Store not found" });
            }
            
            // Check if user already has an active session at this store
            db.get(
                "SELECT id FROM check_in_sessions WHERE user_id = ? AND store_id = ? AND status = 'active' AND expires_at > datetime('now')",
                [userId, finalStoreId],
                (err2, existingSession) => {
                    if (err2) {
                        return res.status(500).json({ error: "Database error" });
                    }
                    
                    if (existingSession) {
                        // Return existing session
                        db.get(
                            "SELECT expires_at FROM check_in_sessions WHERE id = ?",
                            [existingSession.id],
                            (err3, sessionData) => {
                                if (err3 || !sessionData) {
                                    return res.status(500).json({ error: "Failed to get session data" });
                                }
                                
                                db.get(
                                    "SELECT loops_pending FROM pending_points WHERE session_id = ? AND status = 'pending'",
                                    [existingSession.id],
                                    (err4, pending) => {
                                        let expiresAtISO = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                                        if (sessionData.expires_at) {
                                            const sqliteDate = new Date(sessionData.expires_at);
                                            if (!isNaN(sqliteDate.getTime())) {
                                                expiresAtISO = sqliteDate.toISOString();
                                            }
                                        }
                                        
                                        res.json({
                                            success: true,
                                            sessionId: existingSession.id,
                                            store: {
                                                id: store.id,
                                                name: store.name,
                                                category: store.category
                                            },
                                            loopsPending: pending ? pending.loops_pending : 0,
                                            expiresAt: expiresAtISO,
                                            message: "Already checked in!"
                                        });
                                    }
                                );
                            }
                        );
                        return;
                    } else {
                        // NEW: Use category-based rules instead of 24-hour cooldown
                        canCheckIn(userId, finalStoreId, store.category, (err3, checkInResult) => {
                            if (err3) {
                                return res.status(500).json({ error: "Database error" });
                            }
                            
                            if (!checkInResult.allowed) {
                                return res.status(429).json({
                                    error: checkInResult.reason,
                                    cooldownMinutes: checkInResult.cooldownMinutes,
                                    message: checkInResult.reason
                                });
                            }
                            
                            const profile = checkInResult.profile;
                            
                            // Create new check-in session (expires in 30 minutes)
                            const expiresAt = new Date();
                            expiresAt.setMinutes(expiresAt.getMinutes() + 30);
                            
                            db.run(
                                "INSERT INTO check_in_sessions (user_id, store_id, expires_at, check_in_method) VALUES (?, ?, ?, ?)",
                                [userId, finalStoreId, expiresAt.toISOString(), checkInMethod || 'qr'],
                                function(err4) {
                                    if (err4) {
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
                                    db.get("SELECT * FROM users WHERE id = ?", [userId], (err5, user) => {
                                        if (err5 || !user) {
                                            return res.status(500).json({ error: "User not found" });
                                        }
                                        
                                        // Calculate loops based on category profile
                                        const baseLoops = profile.base_points;
                                        
                                        // Apply plan multiplier
                                        const planMultiplier = getPlanMultiplier(user.plan);
                                        
                                        // Apply tier multiplier
                                        const tierMultiplier = getTierMultiplier(user.total_loops_earned);
                                        
                                        // Calculate total loops
                                        const totalLoops = Math.round(baseLoops * planMultiplier * tierMultiplier);
                                        
                                        // Split into instant and pending based on pending_ratio
                                        const instantLoops = Math.round(totalLoops * (1 - profile.pending_ratio));
                                        const pendingLoops = totalLoops - instantLoops;
                                        
                                        // Award instant loops immediately
                                        if (instantLoops > 0) {
                                            db.run(
                                                "UPDATE users SET loops_balance = loops_balance + ?, total_loops_earned = total_loops_earned + ? WHERE id = ?",
                                                [instantLoops, instantLoops, userId]
                                            );
                                            
                                            // Log in ledger
                                            db.run(
                                                "INSERT INTO loops_ledger (user_id, change_type, amount, meta) VALUES (?, 'EARN', ?, ?)",
                                                [userId, instantLoops, JSON.stringify({ type: 'instant', store_id: finalStoreId, session_id: sessionId })]
                                            );
                                        }
                                        
                                        // Create pending points (expires based on category profile)
                                        const pendingExpiresAt = new Date();
                                        pendingExpiresAt.setDate(pendingExpiresAt.getDate() + profile.dvs_expiry_days);
                                        
                                        if (pendingLoops > 0) {
                                            db.run(
                                                "INSERT INTO pending_points (user_id, store_id, session_id, loops_pending, expires_at, civ_score) VALUES (?, ?, ?, ?, ?, ?)",
                                                [userId, finalStoreId, sessionId, pendingLoops, pendingExpiresAt.toISOString(), 0.5],
                                                (err6) => {
                                                    if (err6) {
                                                        console.error("Failed to create pending points:", err6);
                                                    }
                                                    
                                                    // Check for settlement triggers
                                                    setTimeout(() => {
                                                        checkSettlementTriggers(userId, finalStoreId, () => {});
                                                    }, 500);
                                                    
                                                    res.json({
                                                        success: true,
                                                        sessionId,
                                                        store: {
                                                            id: store.id,
                                                            name: store.name,
                                                            category: store.category
                                                        },
                                                        loopsInstant: instantLoops,
                                                        loopsPending: pendingLoops,
                                                        totalLoops: totalLoops,
                                                        expiresAt: expiresAt.toISOString(),
                                                        message: instantLoops > 0 
                                                            ? `You earned ${instantLoops} loops now! ${pendingLoops} more pending.`
                                                            : `${pendingLoops} loops pending (unlocks after your visit is confirmed).`
                                                    });
                                                }
                                            );
                                        } else {
                                            res.json({
                                                success: true,
                                                sessionId,
                                                store: {
                                                    id: store.id,
                                                    name: store.name,
                                                    category: store.category
                                                },
                                                loopsInstant: instantLoops,
                                                loopsPending: 0,
                                                totalLoops: totalLoops,
                                                expiresAt: expiresAt.toISOString(),
                                                message: `You earned ${instantLoops} loops!`
                                            });
                                        }
                                    });
                                }
                            );
                        });
                    }
                }
            );
        });
    };

    // Check blacklist (if enabled)
    if (!BLACKLIST_ENABLED) {
        return continueWithCheckIn();
    }

    db.get(
        "SELECT id, reason, created_at FROM store_customer_blacklist WHERE store_id = ? AND user_id = ?",
        [finalStoreId, userId],
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

            return continueWithCheckIn();
        }
    );
});
```

#### 3. Update Database Schema

```sql
-- Add check_in_method to check_in_sessions
ALTER TABLE check_in_sessions ADD COLUMN check_in_method TEXT DEFAULT 'qr'; -- 'qr' | 'nfc' | 'wallet'

-- Migration script to add category_profiles table
-- Run this migration
```

### Frontend Changes

#### Update Check-In UI to Show Instant + Pending

```javascript
// citycircle-frontend/src/CustomerApp.jsx

// Update the check-in success handler
const handleCheckInSuccess = (data) => {
    setActiveSession({
        sessionId: data.sessionId,
        store: data.store,
        expiresAt: data.expiresAt
    });
    
    // Show success message with instant + pending breakdown
    if (data.loopsInstant > 0 && data.loopsPending > 0) {
        setSuccessMsg(`✓ Checked in! You earned ${data.loopsInstant} loops now, ${data.loopsPending} more pending.`);
    } else if (data.loopsInstant > 0) {
        setSuccessMsg(`✓ Checked in! You earned ${data.loopsInstant} loops!`);
    } else if (data.loopsPending > 0) {
        setSuccessMsg(`✓ Checked in! ${data.loopsPending} loops pending (unlocks after your visit is confirmed).`);
    }
    
    // Refresh user data to show updated balance
    fetchUserMe({ token, period, storeId })
        .then((data) => {
            setUser(data.user);
        })
        .catch((e) => console.error("Failed to refresh user:", e));
    
    // Refresh pending points
    getPendingPoints(token)
        .then((data) => {
            setPendingPoints(data.pendingPoints || []);
        })
        .catch((e) => console.error("Failed to load pending points:", e));
};
```

---

## 📱 Phase 2: NFC Tap Support

### Database Schema Changes

```sql
-- Add NFC tag ID to stores table
ALTER TABLE stores ADD COLUMN nfc_tag_id TEXT UNIQUE; -- Unique NFC tag identifier

-- Add NFC deep link URL
ALTER TABLE stores ADD COLUMN nfc_deep_link TEXT; -- https://citycircle.app/checkin?store_id=123
```

### Backend Changes

#### 1. Generate NFC Deep Links

```javascript
// citycircle-backend/server.js

// When store is created/updated, generate NFC deep link
function generateNFCDeepLink(storeId) {
    return `https://citycircle.app/checkin?store_id=${storeId}`;
}

// Endpoint to get NFC info for store
app.get("/api/stores/:id/nfc", (req, res) => {
    const storeId = parseInt(req.params.id);
    
    db.get("SELECT id, name, nfc_tag_id, nfc_deep_link FROM stores WHERE id = ?", [storeId], (err, store) => {
        if (err || !store) {
            return res.status(404).json({ error: "Store not found" });
        }
        
        // Generate deep link if not exists
        if (!store.nfc_deep_link) {
            const deepLink = generateNFCDeepLink(storeId);
            db.run(
                "UPDATE stores SET nfc_deep_link = ? WHERE id = ?",
                [deepLink, storeId]
            );
            store.nfc_deep_link = deepLink;
        }
        
        res.json({
            storeId: store.id,
            storeName: store.name,
            nfcTagId: store.nfc_tag_id,
            deepLink: store.nfc_deep_link
        });
    });
});
```

### Frontend Changes

#### 1. Add NFC Detection

```javascript
// citycircle-frontend/src/NFCScanner.jsx
import React, { useEffect, useState } from 'react';

export default function NFCScanner({ onNFCRead, onError }) {
    const [supported, setSupported] = useState(false);
    
    useEffect(() => {
        // Check if Web NFC is supported
        if ('NDEFReader' in window) {
            setSupported(true);
        } else {
            setSupported(false);
            if (onError) {
                onError("NFC not supported on this device");
            }
        }
    }, [onError]);
    
    const startScanning = async () => {
        if (!supported) {
            if (onError) {
                onError("NFC not supported");
            }
            return;
        }
        
        try {
            const reader = new NDEFReader();
            
            await reader.scan();
            
            reader.addEventListener("reading", ({ message, serialNumber }) => {
                // Parse NFC message
                const record = message.records[0];
                if (record && record.recordType === "url") {
                    const url = new TextDecoder().decode(record.data);
                    // Extract store_id from URL
                    const urlParams = new URLSearchParams(new URL(url).search);
                    const storeId = urlParams.get('store_id');
                    
                    if (storeId && onNFCRead) {
                        onNFCRead(storeId, url);
                    }
                }
            });
            
            reader.addEventListener("readingerror", (error) => {
                if (onError) {
                    onError("NFC read error: " + error.message);
                }
            });
        } catch (error) {
            if (onError) {
                onError("NFC error: " + error.message);
            }
        }
    };
    
    return (
        <div>
            {supported ? (
                <button onClick={startScanning}>
                    Tap NFC Tag
                </button>
            ) : (
                <p>NFC not supported on this device</p>
            )}
        </div>
    );
}
```

#### 2. Update Check-In Flow to Support NFC

```javascript
// citycircle-frontend/src/CustomerApp.jsx

// Add NFC support to check-in
const handleNFCCheckIn = async (storeId, deepLink) => {
    try {
        setErr("");
        const data = await checkIn(token, null, user?.latitude, user?.longitude, 'nfc', storeId);
        handleCheckInSuccess(data);
    } catch (e) {
        setErr(e.message);
    }
};

// Update checkIn API call to support storeId
export function checkIn(token, qrCode, latitude, longitude, checkInMethod = 'qr', storeId = null) {
    return fetch(`${API_URL}/users/check-in`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
            qrCode, 
            storeId,  // Support direct storeId for NFC
            latitude, 
            longitude,
            checkInMethod 
        }),
    }).then(async (res) => {
        if (res.status === 429) {
            const data = await res.json();
            throw new Error(data.error || "Please wait before checking in again");
        }
        return handle(res);
    });
}
```

---

## 💳 Phase 3: DVS UI/UX Improvements

### Frontend Changes

#### 1. Update Pending Points Display

```javascript
// citycircle-frontend/src/CustomerApp.jsx

// Component to show instant + pending breakdown
const PendingPointsDisplay = ({ pendingPoints }) => {
    return (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Your Points</h3>
            
            {/* Instant Points */}
            <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>Available Now:</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                        {user?.loops_balance || 0} loops
                    </span>
                </div>
            </div>
            
            {/* Pending Points */}
            {pendingPoints && pendingPoints.length > 0 && (
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ marginBottom: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: '600' }}>Pending (Unlocking Soon):</span>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b', marginLeft: '10px' }}>
                            {pendingPoints.reduce((sum, p) => sum + (p.loops_pending - p.loops_unlocked), 0)} loops
                        </span>
                    </div>
                    
                    <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '5px' }}>
                        These points unlock when you return or complete your visit.
                    </div>
                    
                    {/* List pending points */}
                    <div style={{ marginTop: '10px' }}>
                        {pendingPoints.map((p) => (
                            <div key={p.id} style={{ 
                                padding: '8px', 
                                marginBottom: '5px', 
                                background: 'white', 
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{p.store_name || 'Store'}</span>
                                    <span style={{ fontWeight: '600' }}>
                                        {p.loops_pending - p.loops_unlocked} loops pending
                                    </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                                    Unlocks in {Math.ceil((new Date(p.expires_at) - new Date()) / (1000 * 60 * 60 * 24))} days
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
```

#### 2. Update Check-In Success Message

```javascript
// Show clear instant + pending breakdown
const CheckInSuccessMessage = ({ loopsInstant, loopsPending, totalLoops }) => {
    return (
        <div style={{ 
            padding: '20px', 
            background: '#ecfdf5', 
            borderRadius: '8px',
            border: '2px solid #10b981'
        }}>
            <h3 style={{ marginTop: 0, color: '#10b981' }}>✓ Checked In!</h3>
            
            {loopsInstant > 0 && (
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                        You earned <span style={{ color: '#10b981', fontSize: '24px' }}>{loopsInstant}</span> loops now!
                    </div>
                </div>
            )}
            
            {loopsPending > 0 && (
                <div>
                    <div style={{ fontSize: '16px', color: '#f59e0b', fontWeight: '600' }}>
                        +{loopsPending} loops pending
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '5px' }}>
                        These will unlock after your visit is confirmed (usually within 24 hours).
                    </div>
                </div>
            )}
        </div>
    );
};
```

---

## 🎫 Phase 4: Wallet Integration (Future)

### Implementation Notes

This phase requires:
1. Apple Wallet PassKit API integration
2. Google Wallet API integration
3. Pass generation service
4. Pass update service

### Database Schema

```sql
-- Wallet passes table
CREATE TABLE IF NOT EXISTS wallet_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pass_type TEXT NOT NULL,  -- 'apple' | 'google'
  pass_id TEXT UNIQUE NOT NULL,  -- Apple/Google pass identifier
  push_token TEXT,  -- For push notifications
  status TEXT DEFAULT 'active',  -- 'active' | 'revoked'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Endpoints (To Add)

```javascript
// Generate Apple Wallet pass
POST /api/users/wallet/apple/generate

// Generate Google Wallet pass
POST /api/users/wallet/google/generate

// Update wallet pass (push notification)
POST /api/users/wallet/update
```

---

## 📋 Implementation Checklist

### Phase 1: Category-Based Rules
- [ ] Create `category_profiles` table
- [ ] Insert default category profiles
- [ ] Create `categoryProfiles.js` service
- [ ] Update check-in endpoint to use category rules
- [ ] Update frontend to show instant + pending points
- [ ] Test with different store categories
- [ ] Update error messages for category-specific cooldowns

### Phase 2: NFC Tap Support
- [ ] Add `nfc_tag_id` and `nfc_deep_link` to stores table
- [ ] Create NFC deep link generation
- [ ] Add NFC scanner component
- [ ] Update check-in API to accept `storeId` directly
- [ ] Update frontend check-in flow
- [ ] Test NFC tap functionality

### Phase 3: DVS UI/UX
- [ ] Update pending points display component
- [ ] Add instant + pending breakdown
- [ ] Update check-in success message
- [ ] Add pending points countdown
- [ ] Improve pending points explanation

### Phase 4: Wallet Integration
- [ ] Research Apple Wallet API
- [ ] Research Google Wallet API
- [ ] Create wallet pass generation service
- [ ] Add wallet pass endpoints
- [ ] Create wallet pass UI
- [ ] Test wallet integration

---

## 🚀 Migration Script

```javascript
// citycircle-backend/migrations/add-category-profiles.js

const db = require('./db');

db.serialize(() => {
    // Create category_profiles table
    db.run(`
        CREATE TABLE IF NOT EXISTS category_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT UNIQUE NOT NULL,
            max_rewarded_visits_per_day INTEGER NOT NULL DEFAULT 1,
            cooldown_minutes INTEGER NOT NULL DEFAULT 1440,
            min_dwell_minutes INTEGER NOT NULL DEFAULT 3,
            base_points INTEGER NOT NULL DEFAULT 10,
            pending_ratio REAL NOT NULL DEFAULT 1.0,
            dvs_expiry_days INTEGER NOT NULL DEFAULT 7,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Insert default profiles
    const profiles = [
        ['liquor', 3, 60, 1, 8, 0.8, 7],
        ['convenience', 3, 60, 1, 8, 0.8, 7],
        ['gas', 2, 120, 2, 8, 0.8, 7],
        ['grocery', 2, 180, 3, 10, 0.7, 7],
        ['pharmacy', 2, 180, 5, 10, 0.7, 7],
        ['coffee', 2, 120, 3, 10, 0.7, 7],
        ['cafe', 2, 120, 3, 10, 0.7, 7],
        ['barber', 1, 20160, 15, 15, 0.6, 14],
        ['nail', 1, 20160, 20, 15, 0.6, 14],
        ['salon', 1, 20160, 30, 15, 0.6, 14],
        ['laundromat', 2, 60, 15, 10, 0.7, 7],
        ['restaurant', 1, 240, 10, 12, 0.7, 7],
        ['food', 1, 240, 10, 12, 0.7, 7],
        ['other', 1, 1440, 3, 10, 0.7, 7]
    ];
    
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO category_profiles 
        (category, max_rewarded_visits_per_day, cooldown_minutes, min_dwell_minutes, base_points, pending_ratio, dvs_expiry_days)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    profiles.forEach(profile => {
        stmt.run(profile);
    });
    
    stmt.finalize();
    
    // Add check_in_method to check_in_sessions
    db.run(`
        ALTER TABLE check_in_sessions 
        ADD COLUMN check_in_method TEXT DEFAULT 'qr'
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding check_in_method:', err);
        }
    });
    
    // Add NFC fields to stores
    db.run(`
        ALTER TABLE stores 
        ADD COLUMN nfc_tag_id TEXT
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding nfc_tag_id:', err);
        }
    });
    
    db.run(`
        ALTER TABLE stores 
        ADD COLUMN nfc_deep_link TEXT
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding nfc_deep_link:', err);
        }
    });
    
});
```

---

## 📝 Testing Plan

### Phase 1 Testing
1. Test laundromat: 2 check-ins in one day should work
2. Test liquor store: 3 check-ins in one day should work
3. Test barber: 14-day cooldown should work
4. Test coffee shop: 2 check-ins with 2-hour cooldown
5. Verify instant + pending points split

### Phase 2 Testing
1. Test NFC tap on supported devices
2. Test QR scan fallback
3. Verify deep link generation
4. Test check-in with both methods

### Phase 3 Testing
1. Verify instant points show immediately
2. Verify pending points show correctly
3. Test pending points unlock flow
4. Verify UI messages are clear

---

*Document Version: 1.0*  
*Last Updated: January 2025*  
*Status: Ready for Implementation*

