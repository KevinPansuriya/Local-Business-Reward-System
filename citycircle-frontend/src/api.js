// src/api.js
// For mobile testing with ngrok:
// Use relative path - Vite proxy will handle routing to backend
// This works when accessing through ngrok tunnel
// Note: In Vite, use import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_API_URL || "/api";

async function handle(res) {
    const text = await res.text(); // read body even on errors
    let data = null;
  
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
  
    if (!res.ok) {
      const msg =
        data?.error ||
        data?.message ||
        data?.details ||
        `HTTP ${res.status}: ${text}`;
      throw new Error(msg);
    }
  
    return data;
  }

export function userLogin(phone, password) {
    return fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
    }).then(handle);
}

export function userSignup(phone, email, password, name, address) {
    return fetch(`${API_URL}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email, password, name, address }),
    }).then(handle);
}

export function forgotPasswordCustomer(phone) {
    return fetch(`${API_URL}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
    }).then(handle);
}

export function resetPasswordCustomer(token, newPassword) {
    return fetch(`${API_URL}/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
    }).then(handle);
}

export function forgotPasswordStore(phone, email) {
    return fetch(`${API_URL}/stores/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email }),
    }).then(handle);
}

export function resetPasswordStore(token, newPassword) {
    return fetch(`${API_URL}/stores/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
    }).then(handle);
}

// WebAuthn (Facial Recognition) APIs
export function startWebAuthnRegistration(token) {
    return fetch(`${API_URL}/users/webauthn/register/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function finishWebAuthnRegistration(token, credential, deviceName) {
    return fetch(`${API_URL}/users/webauthn/register/finish`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ credential, deviceName }),
    }).then(handle);
}

export function startWebAuthnAuthentication(phone) {
    return fetch(`${API_URL}/users/webauthn/authenticate/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
    }).then(handle);
}

export function finishWebAuthnAuthentication(phone, credential) {
    return fetch(`${API_URL}/users/webauthn/authenticate/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, credential }),
    }).then(handle);
}

export function getWebAuthnStatus(token) {
    return fetch(`${API_URL}/users/webauthn/status`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function updateUserLocation(token, latitude, longitude, address) {
    return fetch(`${API_URL}/users/location`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ latitude, longitude, address }),
    }).then(handle);
}

export function scanCustomerQR(token, qrCode) {
    return fetch(`${API_URL}/stores/scan-customer`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCode }),
    }).then(handle);
}

// Legacy function - redirects to check-in
export function scanStoreQR(token, qrCode) {
    return checkIn(token, qrCode);
}

// Hybrid System: Check-in endpoint (CIV + DVS)
export function checkIn(token, qrCode, latitude, longitude) {
    return fetch(`${API_URL}/users/check-in`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCode, latitude, longitude }),
    }).then(handle);
}

// Update location during check-in session (for CIV)
export function updateCheckInLocation(token, sessionId, latitude, longitude, accuracy) {
    return fetch(`${API_URL}/users/check-in/location`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, latitude, longitude, accuracy }),
    }).then(handle);
}

// Complete check-in session and calculate CIV score
export function completeCheckIn(token, sessionId) {
    return fetch(`${API_URL}/users/check-in/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
    }).then(handle);
}

// Get pending points for user
export function getPendingPoints(token) {
    return fetch(`${API_URL}/users/pending-points`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

// Manual settlement check (for testing)
export function checkSettlement(token, storeId) {
    return fetch(`${API_URL}/users/check-settlement`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
    }).then(handle);
}

export function getPlanTier(token) {
    return fetch(`${API_URL}/users/plan-tier`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function updateUserProfile(token, { name, email, address }) {
    return fetch(`${API_URL}/users/profile`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, address }),
    }).then(handle);
}

export async function fetchUserMe({ token, period = 30, storeId = "all" }) {
    const params = new URLSearchParams();
    params.append("period", period);
  
    if (storeId && storeId !== "all") {
        params.append("store_id", storeId);
    }
  
    const res = await fetch(
        `${API_URL}/users/me?${params.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to load user data" }));
        throw new Error(errorData.error || "Failed to load user data");
    }
    
    return res.json();
}  

export function storeLogin(email, phone, password) {
    const body = { password };
    if (email) body.email = email;
    if (phone) body.phone = phone;
    
    return fetch(`${API_URL}/stores/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).then(handle);
}

export function fetchStoreMe(token) {
    return fetch(`${API_URL}/stores/me`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

// ---------- Admin API Functions ----------

export function adminLogin(email, password) {
    return fetch(`${API_URL}/admins/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    }).then(handle);
}

export function adminSignup(email, password, name) {
    return fetch(`${API_URL}/admins/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
    }).then(handle);
}

export function fetchAdminMe(token) {
    return fetch(`${API_URL}/admins/me`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchSystemAnalytics(token) {
    return fetch(`${API_URL}/analytics/system`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

// Admin User Management
export function fetchAdminUsers(token, { search, page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("page", page);
    params.append("limit", limit);
    
    return fetch(`${API_URL}/admins/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchAdminUserDetails(token, userId) {
    return fetch(`${API_URL}/admins/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateAdminUser(token, userId, updates) {
    return fetch(`${API_URL}/admins/users/${userId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

// Admin Store Management
export function fetchAdminStores(token, { search, page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("page", page);
    params.append("limit", limit);
    
    return fetch(`${API_URL}/admins/stores?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchAdminStoreDetails(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateAdminStore(token, storeId, updates) {
    return fetch(`${API_URL}/admins/stores/${storeId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function deleteAdminUser(token, userId) {
    return fetch(`${API_URL}/admins/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function deleteAdminStore(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchStoreCustomers(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchUserStores(token, userId) {
    return fetch(`${API_URL}/admins/users/${userId}/stores`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchCustomerForStore(token, userId) {
    return fetch(`${API_URL}/stores/customer/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchStoreCustomersToday(token) {
    return fetch(`${API_URL}/stores/customers-today`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function createTransaction(token, payload) {
    return fetch(`${API_URL}/stores/transaction`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

export function fetchNearbyStores(lat, lng, radius = 0.6) {
    return fetch(
        `${API_URL}/stores/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    ).then(handle);
}

export function fetchStoresList() {
    return fetch(`${API_URL}/stores/list`).then(handle);
}

export function redeemLoops(token, amount, storeId, description) {
    return fetch(`${API_URL}/users/redeem`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, storeId, description }),
    }).then(handle);
}

// Gift Card APIs
export function checkGiftCardEligibility(token) {
    return fetch(`${API_URL}/users/gift-cards/eligibility`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function createGiftCard(token, loopsAmount, storeId, cardType = 'digital') {
    return fetch(`${API_URL}/users/gift-cards/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ loopsAmount, storeId, cardType }),
    }).then(handle);
}

export function getGiftCards(token, status) {
    const url = status 
        ? `${API_URL}/users/gift-cards?status=${status}`
        : `${API_URL}/users/gift-cards`;
    return fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function getGiftCardDetails(token, giftCardId) {
    return fetch(`${API_URL}/users/gift-cards/${giftCardId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function topUpGiftCard(token, giftCardId, amount, paymentMethod, loopsAmount, cashAmount) {
    return fetch(`${API_URL}/users/gift-cards/${giftCardId}/topup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, paymentMethod, loopsAmount, cashAmount }),
    }).then(handle);
}

// Store: Scan gift card
export function scanGiftCard(token, qrCode) {
    return fetch(`${API_URL}/stores/scan-gift-card`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCode }),
    }).then(handle);
}

// Store: Use gift card
export function useGiftCard(token, giftCardId, purchaseAmount, amountToUse) {
    return fetch(`${API_URL}/stores/use-gift-card`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ giftCardId, purchaseAmount, amountToUse }),
    }).then(handle);
}

// Store: Get pending physical gift cards
export function getPendingPhysicalGiftCards(token) {
    return fetch(`${API_URL}/stores/pending-physical-gift-cards`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

// Store: Issue physical gift card
export function issuePhysicalGiftCard(token, giftCardId) {
    return fetch(`${API_URL}/stores/issue-physical-gift-card/${giftCardId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function updateStoreLocation(token, latitude, longitude, address) {
    return fetch(`${API_URL}/stores/location`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ latitude, longitude, address }),
    }).then(handle);
}

export function storeSignup(email, phone, password, name, zone, category, base_discount_percent, address1, address2, city, state, zipcode) {
    const fullAddress = [address1, address2, city, state, zipcode].filter(Boolean).join(", ");
    return fetch(`${API_URL}/stores/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            email, 
            phone, 
            password, 
            name, 
            zone, 
            category, 
            base_discount_percent,
            address: fullAddress 
        }),
    }).then(handle);
}

// Analytics endpoints
export async function fetchCustomerAnalytics(token, userId, period = 30) {
    if (!token) {
        throw new Error("Token is required for customer analytics");
    }
    const res = await fetch(`${API_URL}/analytics/customer/${userId}?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return handle(res);
}

export function fetchStoreAnalytics(token, period = "30") {
    return fetch(`${API_URL}/analytics/store?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

function mockCustomerAnalytics({ userId = 1, period = 30 } = {}) {
    // last N days dummy transactions
    const days = period;
    const now = new Date();
    const txns = Array.from({ length: 40 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (i % days));
      const amount = Math.round((8 + Math.random() * 55) * 100) / 100; // 8 - 63
      const discount = Math.round((amount * (0.02 + Math.random() * 0.10)) * 100) / 100; // 2% - 12%
      const store = ["Grove Coffee", "Local Grocery", "Neighborhood Pharmacy"][i % 3];
      const category = ["Coffee", "Grocery", "Pharmacy"][i % 3];
      return {
        id: i + 1,
        customer_id: Number(userId),
        store_name: store,
        category,
        amount,
        discount,
        created_at: d.toISOString(),
      };
    });
  
    // simple rollups
    const totalSpent = txns.reduce((s, t) => s + t.amount, 0);
    const totalSaved = txns.reduce((s, t) => s + t.discount, 0);
    const orders = txns.length;
    const avgOrder = orders ? totalSpent / orders : 0;
  
    // by day
    const byDayMap = new Map();
    for (const t of txns) {
      const day = t.created_at.slice(0, 10);
      const prev = byDayMap.get(day) || { date: day, spend: 0, saved: 0, orders: 0 };
      prev.spend += t.amount;
      prev.saved += t.discount;
      prev.orders += 1;
      byDayMap.set(day, prev);
    }
    const byDay = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
    // top stores
    const byStoreMap = new Map();
    for (const t of txns) {
      const prev = byStoreMap.get(t.store_name) || { store: t.store_name, spend: 0, saved: 0, orders: 0 };
      prev.spend += t.amount;
      prev.saved += t.discount;
      prev.orders += 1;
      byStoreMap.set(t.store_name, prev);
    }
    const topStores = Array.from(byStoreMap.values()).sort((a, b) => b.spend - a.spend);
  
    return {
      overview: {
        customerId: Number(userId),
        periodDays: Number(period),
        totalSpent: Number(totalSpent.toFixed(2)),
        totalSaved: Number(totalSaved.toFixed(2)),
        orders,
        avgOrderValue: Number(avgOrder.toFixed(2)),
      },
      timeseries: byDay.map(d => ({
        date: d.date,
        spend: Number(d.spend.toFixed(2)),
        saved: Number(d.saved.toFixed(2)),
        orders: d.orders,
      })),
      topStores: topStores.map(s => ({
        store: s.store,
        spend: Number(s.spend.toFixed(2)),
        saved: Number(s.saved.toFixed(2)),
        orders: s.orders,
      })),
      transactions: txns,
    };
  }

