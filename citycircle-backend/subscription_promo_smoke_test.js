const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const API_BASE = "http://localhost:4000/api";
const dbPath = path.join(__dirname, "citycircle.db");
const db = new sqlite3.Database(dbPath);

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function http(method, endpoint, body = null, token = "") {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }
    return { status: res.status, data };
}

async function getTableColumns(tableName) {
    const rows = await dbAll(`PRAGMA table_info(${tableName})`);
    return new Set(rows.map((r) => r.name));
}

async function insertDynamic(tableName, values) {
    const keys = Object.keys(values);
    const cols = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const params = keys.map((k) => values[k]);
    const result = await dbRun(`INSERT INTO ${tableName} (${cols}) VALUES (${placeholders})`, params);
    return result.lastID;
}

async function main() {
    const suffix = Date.now();
    const storeEmail = `smoke-store-${suffix}@test.local`;
    const storePhone = `201555${String(suffix).slice(-4)}`;
    const storePassword = "StorePass123!";
    const userPhone = `973555${String(suffix).slice(-4)}`;
    const adminEmail = `smoke-admin-${suffix}@test.local`;
    const adminPassword = "AdminPass123!";

    let storeId = null;
    let userId = null;
    let adminId = null;

    try {
        const storeCols = await getTableColumns("stores");
        const userCols = await getTableColumns("users");

        const storeHash = await bcrypt.hash(storePassword, 10);
        const storePayload = {
            name: `Smoke Store ${suffix}`,
            category: "coffee",
            zone: "north",
            email: storeEmail,
            phone: storePhone,
            password_hash: storeHash,
            claimed_at: new Date().toISOString().slice(0, 19).replace("T", " "),
            base_discount_percent: 5,
            is_local: 1,
            address: "Smoke Test Address",
        };
        const filteredStorePayload = Object.fromEntries(
            Object.entries(storePayload).filter(([key]) => storeCols.has(key))
        );
        storeId = await insertDynamic("stores", filteredStorePayload);

        const userHash = await bcrypt.hash("UserPass123!", 10);
        const userPayload = {
            name: `Smoke User ${suffix}`,
            phone: userPhone,
            email: `smoke-user-${suffix}@test.local`,
            password_hash: userHash,
            plan: "STARTER",
        };
        const filteredUserPayload = Object.fromEntries(
            Object.entries(userPayload).filter(([key]) => userCols.has(key))
        );
        userId = await insertDynamic("users", filteredUserPayload);

        await dbRun(
            `INSERT OR REPLACE INTO store_memberships
             (user_id, store_id, cycle_month, join_method, paid_cents, status, joined_at)
             VALUES (?, ?, strftime('%Y-%m','now','localtime'), 'free', 0, 'active', CURRENT_TIMESTAMP)`,
            [userId, storeId]
        );

        const storeLogin = await http("POST", "/stores/login", {
            email: storeEmail,
            password: storePassword,
        });
        if (storeLogin.status !== 200 || !storeLogin.data.token) {
            throw new Error(`Store login failed: ${storeLogin.status} ${JSON.stringify(storeLogin.data)}`);
        }
        const storeToken = storeLogin.data.token;

        const trialAccess = await http("GET", "/stores/members", null, storeToken);
        if (trialAccess.status !== 200 || trialAccess.data?.access?.can_view_customer_identity !== false) {
            throw new Error(`Expected trial members access to be masked, got: ${JSON.stringify(trialAccess.data)}`);
        }

        const trialPromoAttempt = await http(
            "POST",
            `/stores/members/${userId}/promo`,
            { title: "Trial Promo", message: "Should fail in trial" },
            storeToken
        );
        if (trialPromoAttempt.status !== 403) {
            throw new Error(`Expected trial promo to fail with 403, got ${trialPromoAttempt.status}`);
        }

        const quickTx = await http(
            "POST",
            "/stores/transaction/quick",
            { userId },
            storeToken
        );
        if (quickTx.status !== 200 || !quickTx.data?.success || !Number.isFinite(Number(quickTx.data?.loopsEarned))) {
            throw new Error(`Quick transaction failed: ${quickTx.status} ${JSON.stringify(quickTx.data)}`);
        }
        if (Number(quickTx.data.loopsEarned) <= 0) {
            throw new Error(`Quick transaction loops must be > 0. Got: ${quickTx.data.loopsEarned}`);
        }

        const activateStarter = await http("POST", "/stores/subscription/activate", { plan_id: "starter" }, storeToken);
        if (activateStarter.status !== 200) {
            throw new Error(`Starter activation failed: ${activateStarter.status} ${JSON.stringify(activateStarter.data)}`);
        }

        const starterAccess = await http("GET", "/stores/members", null, storeToken);
        if (starterAccess.status !== 200 || starterAccess.data?.access?.can_view_customer_identity !== true) {
            throw new Error(`Expected starter members access to be full, got: ${JSON.stringify(starterAccess.data)}`);
        }

        const promoSent = await http(
            "POST",
            `/stores/members/${userId}/promo`,
            { title: "Smoke Promo", message: "20% off this weekend" },
            storeToken
        );
        if (promoSent.status !== 200 || !promoSent.data?.success) {
            throw new Error(`Promo send failed: ${promoSent.status} ${JSON.stringify(promoSent.data)}`);
        }

        const adminSignup = await http("POST", "/admins/signup", {
            email: adminEmail,
            password: adminPassword,
            name: "Smoke Admin",
        });
        if (adminSignup.status !== 200 || !adminSignup.data.token) {
            throw new Error(`Admin signup failed: ${adminSignup.status} ${JSON.stringify(adminSignup.data)}`);
        }
        const adminToken = adminSignup.data.token;
        adminId = adminSignup.data.adminId;

        const adminWrongPassword = await http(
            "PUT",
            `/admins/stores/${storeId}/subscription`,
            { plan_id: "growth", admin_password: "wrong-pass" },
            adminToken
        );
        if (adminWrongPassword.status !== 401) {
            throw new Error(`Expected admin wrong password to fail with 401, got ${adminWrongPassword.status}`);
        }

        const adminCorrectPassword = await http(
            "PUT",
            `/admins/stores/${storeId}/subscription`,
            { plan_id: "growth", status: "active", admin_password: adminPassword },
            adminToken
        );
        if (adminCorrectPassword.status !== 200) {
            throw new Error(
                `Expected admin correct password update success, got ${adminCorrectPassword.status} ${JSON.stringify(adminCorrectPassword.data)}`
            );
        }

        const auditApi = await http("GET", `/admins/stores/${storeId}/subscription-audit`, null, adminToken);
        if (auditApi.status !== 200 || !Array.isArray(auditApi.data.logs) || auditApi.data.logs.length < 2) {
            throw new Error(`Expected subscription audit logs, got: ${auditApi.status} ${JSON.stringify(auditApi.data)}`);
        }

        const notifCount = await dbGet(
            "SELECT COUNT(*) AS c FROM notifications WHERE store_id = ? AND user_id = ? AND type = 'direct_promo'",
            [storeId, userId]
        );
        if (!notifCount?.c) {
            throw new Error("Expected at least one direct_promo notification record.");
        }

        console.log("SMOKE_TEST_PASS");
        console.log(JSON.stringify({
            storeId,
            userId,
            adminId,
            auditLogCount: auditApi.data.logs.length,
            promoNotificationCount: notifCount.c,
            quickTransactionLoops: quickTx.data.loopsEarned,
        }, null, 2));
    } finally {
        try {
            if (storeId) {
                await dbRun("DELETE FROM store_subscription_audit_logs WHERE store_id = ?", [storeId]).catch(() => null);
                await dbRun("DELETE FROM store_subscriptions WHERE store_id = ?", [storeId]).catch(() => null);
                await dbRun("DELETE FROM notifications WHERE store_id = ?", [storeId]).catch(() => null);
                await dbRun("DELETE FROM store_memberships WHERE store_id = ?", [storeId]).catch(() => null);
                await dbRun("DELETE FROM stores WHERE id = ?", [storeId]).catch(() => null);
            }
            if (userId) {
                await dbRun("DELETE FROM notifications WHERE user_id = ?", [userId]).catch(() => null);
                await dbRun("DELETE FROM users WHERE id = ?", [userId]).catch(() => null);
            }
            if (adminId) {
                await dbRun("DELETE FROM admins WHERE id = ?", [adminId]).catch(() => null);
            }
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }
        db.close();
    }
}

main().catch((err) => {
    console.error("SMOKE_TEST_FAIL");
    console.error(err.message);
    process.exitCode = 1;
});

