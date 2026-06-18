// src/api.js
// For mobile testing with ngrok:
// Use relative path - Vite proxy will handle routing to backend
// This works when accessing through ngrok tunnel
// Note: In Vite, use import.meta.env instead of process.env
const API_URL =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:4000/api"
        : "/api");

// Debug: Log the API URL being used

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

export function userSignup(phone, email, password, name, address, address_line1, address_line2, city, state, postal_code, dob, signup_source, utm_source, utm_medium, utm_campaign) {
    const body = { phone, email, password, name, address, address_line1, address_line2, city, state, postal_code, dob };
    if (signup_source != null) body.signup_source = signup_source;
    if (utm_source != null) body.utm_source = utm_source;
    if (utm_medium != null) body.utm_medium = utm_medium;
    if (utm_campaign != null) body.utm_campaign = utm_campaign;
    return fetch(`${API_URL}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).then(handle);
}

/** Read UTM params from current URL (for tracking). */
export function getUtmFromUrl() {
    if (typeof window === "undefined") return {};
    const p = new URLSearchParams(window.location.search);
    return {
        utm_source: p.get("utm_source") || undefined,
        utm_medium: p.get("utm_medium") || undefined,
        utm_campaign: p.get("utm_campaign") || undefined,
    };
}

/** Track analytics event (public endpoint, no auth). */
export function trackEvent(eventType, options = {}) {
    const { session_id, payload, utm_source, utm_medium, utm_campaign, actor_id, actor_type } = options;
    return fetch(`${API_URL}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            event_type: eventType,
            session_id: session_id || (typeof window !== "undefined" && window.sessionStorage?.getItem("cc_session_id")) || undefined,
            payload: payload || undefined,
            utm_source: utm_source || undefined,
            utm_medium: utm_medium || undefined,
            utm_campaign: utm_campaign || undefined,
            actor_id: actor_id || undefined,
            actor_type: actor_type || undefined,
        }),
    }).then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Track failed")));
        return res.json();
    }).catch(() => { /* fire-and-forget */ });
}

export function forgotPasswordCustomer(phone) {
    return fetch(`${API_URL}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
    }).then(handle);
}

export function resetPasswordCustomer(phone, code, newPassword) {
    return fetch(`${API_URL}/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, newPassword }),
    }).then(handle);
}

export function forgotPasswordStore(phone) {
    return fetch(`${API_URL}/stores/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
    }).then(handle);
}

export function resetPasswordStore(phone, code, newPassword) {
    return fetch(`${API_URL}/stores/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, newPassword }),
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

// Hybrid System: Check-in endpoint (CIV + DVS) - Updated with category-based rules and NFC support
export function checkIn(token, qrCode, latitude, longitude, checkInMethod = 'qr', storeId = null) {
    return fetch(`${API_URL}/users/check-in`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
            qrCode, 
            storeId,  // Support direct storeId for NFC/Wallet
            latitude, 
            longitude,
            checkInMethod  // 'qr' | 'nfc' | 'wallet'
        }),
    }).then(async (res) => {
        // Handle enrollment required (403 status)
        if (res.status === 403) {
            const data = await res.json();
            if (data.requires_enrollment) {
                const error = new Error(data.error || "Store enrollment required");
                error.requiresEnrollment = true;
                error.enrollmentData = data;
                throw error;
            }
            throw new Error(data.error || "Access denied");
        }
        // Handle cooldown period (429 status)
        if (res.status === 429) {
            const data = await res.json();
            throw new Error(data.error || "Please wait before checking in again");
        }
        return handle(res);
    });
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

export function updateUserPlan(token, plan) {
    return fetch(`${API_URL}/users/plan`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
    }).then(handle);
}

export function updateUserProfile(token, { name, email, address, address_line1, address_line2, city, state, postal_code, dob }) {
    return fetch(`${API_URL}/users/profile`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, address, address_line1, address_line2, city, state, postal_code, dob }),
    }).then(handle);
}

export function updateUserLocationByAddress(token, { address_line1, address_line2, city, state, postal_code }) {
    return fetch(`${API_URL}/users/location-by-address`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address_line1, address_line2, city, state, postal_code }),
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

export function fetchStoreSubscription(token) {
    return fetch(`${API_URL}/stores/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function activateStoreSubscription(token, plan_id) {
    return fetch(`${API_URL}/stores/subscription/activate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id }),
    }).then(handle);
}

export function fetchStoreMembers(token, { cycleMonth = null, limit = 200 } = {}) {
    const params = new URLSearchParams();
    if (cycleMonth) params.set("cycleMonth", cycleMonth);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return fetch(`${API_URL}/stores/members${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function sendStoreMemberPromotion(token, userId, payload) {
    return fetch(`${API_URL}/stores/members/${userId}/promo`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

export function updateStoreOffer(token, offer) {
    return fetch(`${API_URL}/stores/offer`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(offer),
    }).then(handle);
}

export function fetchStoreRewardSchedules(token) {
    return fetch(`${API_URL}/stores/reward-schedules`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function createStoreRewardSchedule(token, payload) {
    return fetch(`${API_URL}/stores/reward-schedules`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

export function updateStoreRewardSchedule(token, scheduleId, payload) {
    return fetch(`${API_URL}/stores/reward-schedules/${scheduleId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

export function fetchStoreRewardPreferences(token) {
    return fetch(`${API_URL}/stores/reward-preferences`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function updateStoreRewardPreferences(token, payload) {
    return fetch(`${API_URL}/stores/reward-preferences`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

export function fetchStoreRewardRecommendations(token) {
    return fetch(`${API_URL}/stores/reward-recommendations`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function applyStoreRewardRecommendation(token, recommendationId) {
    return fetch(`${API_URL}/stores/reward-recommendations/${recommendationId}/apply`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function fetchStoreHolidayReminders(token) {
    return fetch(`${API_URL}/stores/reward-holiday-reminders`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function respondStoreHolidayReminder(token, reminderId, action) {
    return fetch(`${API_URL}/stores/reward-holiday-reminders/${encodeURIComponent(reminderId)}/respond`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
    }).then(handle);
}

export function updateStoreProfile(token, profile) {
    return fetch(`${API_URL}/stores/profile`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
    }).then(handle);
}

export function fetchStorePromotions(token) {
    return fetch(`${API_URL}/stores/promotions`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function createStorePromotion(token, promotion) {
    return fetch(`${API_URL}/stores/promotions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(promotion),
    }).then(handle);
}

export function fetchStoreUpdates(token) {
    return fetch(`${API_URL}/stores/updates`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function createStoreUpdate(token, update) {
    return fetch(`${API_URL}/stores/updates`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(update),
    }).then(handle);
}

export function fetchStorePosts(token) {
    return fetch(`${API_URL}/stores/posts`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function createStorePost(token, post) {
    return fetch(`${API_URL}/stores/posts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(post),
    }).then(handle);
}

export function fetchStoreContent(token, { type = "all", status = "all" } = {}) {
    const params = new URLSearchParams();
    if (type && type !== "all") params.set("type", type);
    if (status && status !== "all") params.set("status", status);
    const qs = params.toString();
    return fetch(`${API_URL}/stores/content${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateStorePromotion(token, id, updates) {
    return fetch(`${API_URL}/stores/promotions/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function updateStoreUpdate(token, id, updates) {
    return fetch(`${API_URL}/stores/updates/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function updateStorePost(token, id, updates) {
    return fetch(`${API_URL}/stores/posts/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function deleteStorePromotion(token, id) {
    return fetch(`${API_URL}/stores/promotions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function deleteStoreUpdate(token, id) {
    return fetch(`${API_URL}/stores/updates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function deleteStorePost(token, id) {
    return fetch(`${API_URL}/stores/posts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function archiveStoreContent(token, type, id) {
    return fetch(`${API_URL}/stores/content/${type}/${id}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function unarchiveStoreContent(token, type, id) {
    return fetch(`${API_URL}/stores/content/${type}/${id}/unarchive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchUserFeed(
    token,
    { radius = 10, type = "all", limit = 50, scope = "local", category = "all", localRadius = null } = {}
) {
    const params = new URLSearchParams();
    if (radius) params.set("radius", String(radius));
    if (type && type !== "all") params.set("type", type);
    if (limit) params.set("limit", String(limit));
    if (scope) params.set("scope", scope);
    if (category && category !== "all") params.set("category", category);
    if (localRadius !== null && localRadius !== undefined) params.set("local_radius", String(localRadius));
    return fetch(`${API_URL}/users/feed?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchCategories() {
    return fetch(`${API_URL}/categories`).then(handle);
}

export function fetchStoreProfile(token, storeId) {
    return fetch(`${API_URL}/users/stores/${storeId}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

// Notifications
export function fetchNotifications(token, { unread = false, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (unread) params.set("unread", "true");
    if (limit) params.set("limit", limit.toString());
    const qs = params.toString();
    return fetch(`${API_URL}/users/notifications${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function markNotificationRead(token, notificationId) {
    return fetch(`${API_URL}/users/notifications/${notificationId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function markAllNotificationsRead(token) {
    return fetch(`${API_URL}/users/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchNotificationPreferences(token) {
    return fetch(`${API_URL}/users/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateNotificationPreferences(token, preferences) {
    return fetch(`${API_URL}/users/notification-preferences`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
    }).then(handle);
}

export function fetchContentDetails(token, contentType, contentId) {
    return fetch(`${API_URL}/users/content/${contentType}/${contentId}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function enrollStore(token, storeId, unlockMethod = null) {
    return fetch(`${API_URL}/users/enroll-store`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId, unlockMethod }),
    }).then(handle);
}

export function submitStoreRequest(token, payload) {
    return fetch(`${API_URL}/users/store-requests`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
            // Only throw error for actual failures (not duplicates)
            const error = new Error(data.error || "Failed to submit store request");
            error.duplicate = data.duplicate || false;
            error.status = res.status;
            throw error;
        }
        // Return data even if duplicate (it's a successful response with duplicate flag)
        return data;
    });
}

export function likeContent(token, type, id) {
    return fetch(`${API_URL}/content/${type}/${id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function unlikeContent(token, type, id) {
    return fetch(`${API_URL}/content/${type}/${id}/like`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function uploadStoreMedia(token, file) {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/stores/upload`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: form,
    }).then(handle);
}

export function fetchStoreBlacklist(token) {
    return fetch(`${API_URL}/stores/blacklist`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
        // Handle 503 (feature disabled) gracefully
        if (res.status === 503) {
            return { blacklisted: [] };
        }
        return handle(res);
    });
}

export function addToBlacklist(token, userId, reason) {
    return fetch(`${API_URL}/stores/blacklist`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, reason }),
    }).then(async (res) => {
        // Handle 503 (feature disabled) gracefully
        if (res.status === 503) {
            const text = await res.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = { raw: text };
            }
            throw new Error(data?.error || "Blacklist feature temporarily disabled");
        }
        return handle(res);
    });
}

export function removeFromBlacklist(token, userId) {
    return fetch(`${API_URL}/stores/blacklist/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
        // Handle 503 (feature disabled) gracefully
        if (res.status === 503) {
            const text = await res.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = { raw: text };
            }
            throw new Error(data?.error || "Blacklist feature temporarily disabled");
        }
        return handle(res);
    });
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

export function fetchAdminAnalyticsSummary(token) {
    return fetch(`${API_URL}/admins/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchAdminAnalyticsFunnel(token, { from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const qs = params.toString();
    return fetch(`${API_URL}/admins/analytics/funnel${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchAdminActivity(token, { days } = {}) {
    const params = new URLSearchParams();
    if (days != null) params.append("days", days);
    const qs = params.toString();
    return fetch(`${API_URL}/admins/activity${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchAdminAnalyticsEventsByActor(token, actorType, actorId) {
    return fetch(`${API_URL}/admins/analytics/events/by-actor/${encodeURIComponent(actorType)}/${encodeURIComponent(actorId)}`, {
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

export function submitMissingRewardReport(token, payload) {
    return fetch(`${API_URL}/users/missing-reward-reports`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

export function fetchAdminStoreRequests(token, { search } = {}) {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const qs = params.toString();
    return fetch(`${API_URL}/admins/store-requests${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function notifyStoreRequest(token, { requested_store_name, request_count }) {
    return fetch(`${API_URL}/admins/store-requests/notify`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requested_store_name, request_count }),
    }).then(handle);
}

export function fetchAdminMissingRewardReports(token, { status, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit);
    params.append("offset", offset);
    return fetch(`${API_URL}/admins/missing-reward-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateAdminMissingRewardReportStatus(token, reportId, { status, admin_note } = {}) {
    return fetch(`${API_URL}/admins/missing-reward-reports/${reportId}/status`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, admin_note }),
    }).then(handle);
}

export function updateAdminStoreRequestStatus(token, requestId, status) {
    return fetch(`${API_URL}/admins/store-requests/${requestId}/status`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
    }).then(handle);
}

export function fetchAdminStoreDetails(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function adminGenerateStoreClaimCode(token, storeId, { force = false, ownerPhone = null } = {}) {
    const qs = force ? "?force=1" : "";
    return fetch(`${API_URL}/admins/stores/${storeId}/claim-code${qs}`, {
        method: "POST",
        headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ ownerPhone }),
    }).then(handle);
}

export function adminBackfillStorePhones(token, { limit = 30, lat = null, lng = null, radiusMeters = 2000 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), radiusMeters: String(radiusMeters) });
    if (lat != null) params.set("lat", String(lat));
    if (lng != null) params.set("lng", String(lng));
    return fetch(`${API_URL}/admins/stores/backfill-phones?${params.toString()}`, {
        method: "POST",
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

export function updateAdminStoreOffer(token, storeId, offer) {
    return fetch(`${API_URL}/admins/stores/${storeId}/offer`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(offer),
    }).then(handle);
}

export function updateAdminStoreSubscription(token, storeId, updates) {
    return fetch(`${API_URL}/admins/stores/${storeId}/subscription`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function fetchAdminStoreSubscriptionAudit(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}/subscription-audit`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function fetchAdminCategoryProfiles(token) {
    return fetch(`${API_URL}/admins/category-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateAdminCategoryProfile(token, category, updates) {
    return fetch(`${API_URL}/admins/category-profiles/${encodeURIComponent(category)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function fetchAdminStoreRewardProfile(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}/reward-profile`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(handle);
}

export function updateAdminStoreRewardProfile(token, storeId, updates) {
    return fetch(`${API_URL}/admins/stores/${storeId}/reward-profile`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    }).then(handle);
}

export function deleteAdminStoreRewardProfile(token, storeId) {
    return fetch(`${API_URL}/admins/stores/${storeId}/reward-profile`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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

export function createQuickTransaction(token, payload) {
    return fetch(`${API_URL}/stores/transaction/quick`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(handle);
}

// Real nearby stores from Google Places (live)
export function fetchNearbyGoogleStores(
    token,
    radius = 1,
    query = "all",
    options = {}
) {
    const params = new URLSearchParams({
        radius: String(radius),
        query: query || "all",
    });
    if (options.quality) params.set("quality", options.quality);
    if (options.minRating != null) params.set("minRating", String(options.minRating));
    if (options.minReviews != null) params.set("minReviews", String(options.minReviews));
    if (options.category) params.set("category", options.category);
    if (options.includeOther) params.set("includeOther", "1");
    if (options.preferNameCategory === false) params.set("preferNameCategory", "0");

    return fetch(`${API_URL}/stores/nearby-google?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function fetchGooglePlaceDetails(token, placeId) {
    const params = new URLSearchParams({ placeId });
    return fetch(`${API_URL}/stores/google-details?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

// Nearby eligible stores (plan-based, local-only, AI-ranked)
export function fetchNearbyEligibleStores(token, radius = 5, options = {}) {
    const params = new URLSearchParams({ radius: String(radius) });
    if (options.category) params.set("category", options.category);
    if (options.query) params.set("query", options.query);
    if (options.maxResults) params.set("maxResults", String(options.maxResults));
    if (options.import) params.set("import", "1");
    return fetch(`${API_URL}/stores/nearby-eligible?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

export function unlockStore(token, storeId, method) {
    return fetch(`${API_URL}/stores/unlock`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId, method }),
    }).then(handle);
}

export function activateStoreSlot(token, storeId) {
    return fetch(`${API_URL}/stores/activate-slot`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
    }).then(handle);
}

// Real nearby stores from OSM (discovery)
export function fetchNearbyOsmStores(token, radius = 5, autoImport = false) {
    const importParam = autoImport ? "&import=1" : "";
    return fetch(`${API_URL}/stores/nearby-osm?radius=${radius}${importParam}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
}

// Active stores for current cycle
export function fetchActiveStores(token, userId) {
    return fetch(`${API_URL}/users/${userId}/active-stores`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(handle);
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
export function checkGiftCardEligibility(token, storeId = null) {
    const params = new URLSearchParams();
    if (storeId && String(storeId) !== "all") params.set("store_id", String(storeId));
    const qs = params.toString();
    return fetch(`${API_URL}/users/gift-cards/eligibility${qs ? `?${qs}` : ""}`, {
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

export function storeSignup(claimCode, email, phone, password, signup_source, utm_source, utm_medium, utm_campaign) {
    const body = { claimCode, email, phone, password };
    if (signup_source != null) body.signup_source = signup_source;
    if (utm_source != null) body.utm_source = utm_source;
    if (utm_medium != null) body.utm_medium = utm_medium;
    if (utm_campaign != null) body.utm_campaign = utm_campaign;
    return fetch(`${API_URL}/stores/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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



