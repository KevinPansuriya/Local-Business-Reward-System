// src/StoreApp.jsx
import React, { useState, useEffect } from "react";
import {
    storeLogin,
    storeSignup,
    fetchStoreMe,
    fetchStoreCustomersToday,
    scanCustomerQR,
    createTransaction,
    scanGiftCard,
    useGiftCard,
    getPendingPhysicalGiftCards,
    issuePhysicalGiftCard,
    forgotPasswordStore,
    resetPasswordStore,
} from "./api";
import AnalyticsDashboard from "./AnalyticsDashboard";
import QRScanner from "./QRScanner";
import StoreLocationPrompt from "./StoreLocationPrompt";
import { QRCodeCanvas } from "qrcode.react";

export default function StoreApp({ token, onStoreToken }) {
    const [email, setEmail] = useState("coffee@grove.com");
    const [password, setPassword] = useState("password123");

    const [storeToken, setStoreToken] = useState(token || "");
    const [storeInfo, setStoreInfo] = useState(null);
    const [stats, setStats] = useState(null);
    const [customersToday, setCustomersToday] = useState([]);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    // Signup state
    const [showSignup, setShowSignup] = useState(false);
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPhone, setSignupPhone] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupName, setSignupName] = useState("");
    const [signupCategory, setSignupCategory] = useState("");
    const [signupDiscount, setSignupDiscount] = useState("5");
    const [signupAddress1, setSignupAddress1] = useState("");
    const [signupAddress2, setSignupAddress2] = useState("");
    const [signupCity, setSignupCity] = useState("");
    const [signupState, setSignupState] = useState("");
    const [signupZipcode, setSignupZipcode] = useState("");

    const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'analytics' | 'giftcards'
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [scannedCustomer, setScannedCustomer] = useState(null);
    const [transactionAmount, setTransactionAmount] = useState("");
    const [transactionLoading, setTransactionLoading] = useState(false);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [showQRZoom, setShowQRZoom] = useState(false);
    const [scannedGiftCard, setScannedGiftCard] = useState(null);
    const [giftCardPurchaseAmount, setGiftCardPurchaseAmount] = useState("");
    const [giftCardUseAmount, setGiftCardUseAmount] = useState("");
    const [giftCardProcessing, setGiftCardProcessing] = useState(false);
    const [qrScannerMode, setQrScannerMode] = useState("customer"); // 'customer' or 'giftcard'
    const [pendingPhysicalGiftCards, setPendingPhysicalGiftCards] = useState([]);
    const [issuingCard, setIssuingCard] = useState(null);

    useEffect(() => {
        if (!storeToken) return;

        async function load() {
            try {
                setErr("");
                setLoading(true);
                const { store, stats } = await fetchStoreMe(storeToken);
                console.log("Store info received:", store); // Debug: check if qr_code is present
                console.log("QR Code value:", store?.qr_code, "Type:", typeof store?.qr_code); // Debug QR code
                setStoreInfo(store);
                setStats(stats);

                // Check if location needs to be set
                if (store && (!store.latitude || !store.longitude)) {
                    setShowLocationPrompt(true);
                }

                const ct = await fetchStoreCustomersToday(storeToken);
                setCustomersToday(ct.customers || []);
                
                // Load pending physical gift cards
                if (activeTab === "giftcards") {
                    const pendingCards = await getPendingPhysicalGiftCards(storeToken);
                    setPendingPhysicalGiftCards(pendingCards.giftCards || []);
                }
            } catch (e) {
                setErr(e.message);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [storeToken, activeTab]);

    async function handleLogin(e) {
        e.preventDefault();
        try {
            setErr("");
            setLoading(true);
            // Determine if input is email or phone
            const isEmail = email.includes("@");
            const loginData = isEmail 
                ? await storeLogin(email, null, password)
                : await storeLogin(null, email, password);
            setStoreToken(loginData.token);
            if (onStoreToken) onStoreToken(loginData.token);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        if ((!signupEmail && !signupPhone) || !signupPassword || !signupName || !signupCategory) {
            setErr("Please fill in all required fields. At least email or phone is required.");
            return;
        }
        
        // Validate email if provided
        if (signupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
            setErr("Invalid email format");
            return;
        }
        
        // Validate phone if provided
        if (signupPhone && !/^[\d\s\-\(\)]+$/.test(signupPhone.replace(/\s/g, '')) || signupPhone.replace(/\D/g, '').length < 10) {
            setErr("Invalid phone number format");
            return;
        }

        try {
            setErr("");
            setLoading(true);
            const data = await storeSignup(
                signupEmail,
                signupPhone,
                signupPassword,
                signupName,
                "ZONE_A", // Default zone - can be updated later
                signupCategory,
                parseInt(signupDiscount) || 0,
                signupAddress1,
                signupAddress2,
                signupCity,
                signupState,
                signupZipcode
            );
            setStoreToken(data.token);
            if (onStoreToken) onStoreToken(data.token);
            setShowSignup(false);
            // Location will be prompted after login
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    function handleLogout() {
        setStoreToken("");
        setStoreInfo(null);
        setStats(null);
        setCustomersToday([]);
        setShowSignup(false);
        if (onStoreToken) onStoreToken("");
    }

    return (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Login/Signup box */}
            <div style={loginCard}>
                <h3 style={{ marginTop: 0 }}>{showSignup ? "Store Signup" : "Store Login"}</h3>
                {!showSignup ? (
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="text"
                                placeholder="Email or Phone Number"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0 0" }}>
                                Enter your email address or phone number
                            </p>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" style={button} disabled={loading}>
                            {loading ? "Logging in..." : "Login"}
                        </button>
                        {storeToken && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                style={{ ...button, backgroundColor: "#ef4444", marginLeft: 8 }}
                            >
                                Logout
                            </button>
                        )}
                    </form>
                ) : (
                    <form onSubmit={handleSignup}>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="email"
                                placeholder="Email (optional - for verification)"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                            />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="tel"
                                placeholder="Phone Number (optional - for verification)"
                                value={signupPhone}
                                onChange={(e) => setSignupPhone(e.target.value)}
                            />
                            <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0 0" }}>
                                At least one (email or phone) is required for verification
                            </p>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="text"
                                placeholder="Store Name (required)"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="password"
                                placeholder="Password (required)"
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <select
                                style={input}
                                value={signupCategory}
                                onChange={(e) => setSignupCategory(e.target.value)}
                                required
                            >
                                <option value="">Select Category (required)</option>
                                <option value="coffee">Coffee</option>
                                <option value="grocery">Grocery</option>
                                <option value="restaurant">Restaurant</option>
                                <option value="retail">Retail</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="liquor">Liquor Store</option>
                                <option value="juice">Juice Center</option>
                                <option value="salon">Salon</option>
                                <option value="barbershop">Barbershop</option>
                                <option value="bakery">Bakery</option>
                                <option value="pizza">Pizza</option>
                                <option value="fastfood">Fast Food</option>
                                <option value="cafe">Cafe</option>
                                <option value="deli">Deli</option>
                                <option value="convenience">Convenience Store</option>
                                <option value="gas">Gas Station</option>
                                <option value="hardware">Hardware Store</option>
                                <option value="clothing">Clothing Store</option>
                                <option value="electronics">Electronics</option>
                                <option value="bookstore">Bookstore</option>
                                <option value="gym">Gym/Fitness</option>
                                <option value="spa">Spa</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="number"
                                placeholder="Base Discount % (default: 5)"
                                value={signupDiscount}
                                onChange={(e) => setSignupDiscount(e.target.value)}
                                min="0"
                                max="100"
                            />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="text"
                                placeholder="Address Line 1 (Street)"
                                value={signupAddress1}
                                onChange={(e) => setSignupAddress1(e.target.value)}
                            />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="text"
                                placeholder="Address Line 2 (Optional)"
                                value={signupAddress2}
                                onChange={(e) => setSignupAddress2(e.target.value)}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <input
                                style={{ ...input, flex: 1 }}
                                type="text"
                                placeholder="City"
                                value={signupCity}
                                onChange={(e) => setSignupCity(e.target.value)}
                            />
                            <input
                                style={{ ...input, flex: 1 }}
                                type="text"
                                placeholder="State"
                                value={signupState}
                                onChange={(e) => setSignupState(e.target.value)}
                            />
                            <input
                                style={{ ...input, flex: 1 }}
                                type="text"
                                placeholder="Zipcode"
                                value={signupZipcode}
                                onChange={(e) => setSignupZipcode(e.target.value)}
                            />
                        </div>
                        <button type="submit" style={button} disabled={loading}>
                            {loading ? "Signing up..." : "Sign Up"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowSignup(false);
                                setErr("");
                            }}
                            style={{ ...button, backgroundColor: "#6b7280", marginLeft: 8 }}
                        >
                            Cancel
                        </button>
                    </form>
                )}
                {!showSignup && !storeToken && (
                    <div style={{ marginTop: 12, textAlign: "center", padding: "8px 0", borderTop: "1px solid #e5e7eb" }}>
                        <button
                            type="button"
                            style={linkButton}
                            onClick={() => {
                                setShowSignup(true);
                                setErr("");
                            }}
                        >
                            Don't have an account? Sign up
                        </button>
                    </div>
                )}
                {err && <div style={{ color: "red", marginTop: 12, fontSize: 13 }}>{err}</div>}
            </div>

            {/* Dashboard */}
            <div style={dashboardCard}>
                <h2 style={{ marginTop: 0 }}>Store Dashboard</h2>

                {storeToken && storeInfo && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "dashboard" ? "#2563eb" : "transparent",
                                color: activeTab === "dashboard" ? "#fff" : "#6b7280",
                            }}
                            onClick={() => setActiveTab("dashboard")}
                        >
                            Dashboard
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "analytics" ? "#2563eb" : "transparent",
                                color: activeTab === "analytics" ? "#fff" : "#6b7280",
                            }}
                            onClick={() => setActiveTab("analytics")}
                        >
                            Analytics
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "giftcards" ? "#2563eb" : "transparent",
                                color: activeTab === "giftcards" ? "#fff" : "#6b7280",
                            }}
                            onClick={async () => {
                                setActiveTab("giftcards");
                                try {
                                    const pendingCards = await getPendingPhysicalGiftCards(storeToken);
                                    setPendingPhysicalGiftCards(pendingCards.giftCards || []);
                                } catch (e) {
                                    console.error("Error loading pending gift cards:", e);
                                }
                            }}
                        >
                            📦 Physical Gift Cards
                        </button>
                    </div>
                )}

                {!storeToken && (
                    <p style={{ fontSize: 14, color: "#666" }}>
                        Login as a store (e.g. <b>coffee@grove.com / password123</b>) to see
                        today&apos;s customers and manage your store.
                    </p>
                )}

                {loading && <p>Loading...</p>}

                {storeInfo && activeTab === "dashboard" && (
                    <>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{storeInfo.name}</h3>
                                <div style={infoRow}>
                                    <strong>Category:</strong> {storeInfo.category}
                                </div>
                                <div style={infoRow}>
                                    <strong>Zone:</strong> {storeInfo.zone}
                                </div>
                                {storeInfo.phone && (
                                    <div style={infoRow}>
                                        <strong>Phone:</strong>{" "}
                                        <a href={`tel:${storeInfo.phone}`} style={link}>
                                            {storeInfo.phone}
                                        </a>
                                    </div>
                                )}
                                <div style={infoRow}>
                                    <strong>Base discount:</strong> {storeInfo.base_discount_percent}%
                                </div>
                                <div style={infoRow}>
                                    <strong>Location:</strong>{" "}
                                    {storeInfo.latitude && storeInfo.longitude ? (
                                        <>
                                            {storeInfo.address || `${storeInfo.latitude.toFixed(4)}, ${storeInfo.longitude.toFixed(4)}`}
                                            <button
                                                style={{ ...smallButton, marginLeft: 8 }}
                                                onClick={() => setShowLocationPrompt(true)}
                                            >
                                                Update Location
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            Not set
                                            <button
                                                style={{ ...smallButton, marginLeft: 8 }}
                                                onClick={() => setShowLocationPrompt(true)}
                                            >
                                                Set Location
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Store QR Code */}
                            <div style={{ textAlign: "center", minWidth: 180 }}>
                                <h3 style={{ fontSize: 14, marginBottom: 8, marginTop: 0 }}>Store QR Code</h3>
                                {storeInfo.qr_code && storeInfo.qr_code.trim() ? (
                                    <>
                                        <div 
                                            style={{ 
                                                cursor: "pointer", 
                                                display: "inline-block",
                                                padding: 8,
                                                borderRadius: 8,
                                                transition: "background-color 0.2s"
                                            }}
                                            onClick={() => setShowQRZoom(true)}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                            title="Click to zoom"
                                        >
                                            <QRCodeCanvas value={storeInfo.qr_code} size={140} />
                                        </div>
                                        <p style={{ fontSize: 11, marginTop: 4, color: "#666" }}>
                                            Tap to zoom • Customers can scan this
                                        </p>
                                    </>
                                ) : (
                                    <div style={{ padding: 20, color: "#9ca3af", fontSize: 13 }}>
                                        <p style={{ margin: "0 0 12px 0" }}>QR code not available</p>
                                        <button
                                            style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                            onClick={async () => {
                                                try {
                                                    setLoading(true);
                                                    setErr("");
                                                    // Refresh store data - QR code should be generated on backend if missing
                                                    const { store, stats } = await fetchStoreMe(storeToken);
                                                    console.log("Refreshed store info:", store);
                                                    console.log("QR Code after refresh:", store?.qr_code);
                                                    setStoreInfo(store);
                                                    setStats(stats);
                                                } catch (e) {
                                                    console.error("Error refreshing store:", e);
                                                    setErr("Error refreshing: " + e.message);
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                        >
                                            🔄 Refresh
                                        </button>
                                    </div>
                                )}
                            </div>

                            {stats && (
                                <div style={statsBox}>
                                    <div style={statSection}>
                                        <div style={statLabel}>Today</div>
                                        <div style={statValue}>{stats.customers_today}</div>
                                        <div style={statSubtext}>Customers</div>
                                        <div style={statValue}>{stats.loops_today}</div>
                                        <div style={statSubtext}>Loops Given</div>
                                    </div>
                                    <div style={statSection}>
                                        <div style={statLabel}>Lifetime</div>
                                        <div style={statValue}>{stats.customers_all}</div>
                                        <div style={statSubtext}>Customers</div>
                                        <div style={statValue}>{stats.loops_all}</div>
                                        <div style={statSubtext}>Loops Given</div>
                                    </div>
                                </div>
                            )}
                        </div>


                        <h4 style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <span>Customers Today</span>
                            <button
                                style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                onClick={() => setShowQRScanner(true)}
                            >
                                📷 Scan Customer QR
                            </button>
                        </h4>
                        {scannedCustomer && (
                            <div style={{ ...card, marginTop: 12, backgroundColor: "#f0f9ff", border: "1px solid #bae6fd" }}>
                                <h5 style={{ marginTop: 0 }}>Scanned Customer</h5>
                                <p><strong>Name:</strong> {scannedCustomer.customer.name}</p>
                                <p><strong>Phone:</strong> {scannedCustomer.customer.phone}</p>
                                <p><strong>Loops Balance:</strong> {scannedCustomer.customer.loopsBalance}</p>
                                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                    <input
                                        style={{ ...input, flex: 1, minWidth: 150 }}
                                        type="number"
                                        placeholder="Transaction Amount ($)"
                                        value={transactionAmount}
                                        onChange={(e) => setTransactionAmount(e.target.value)}
                                    />
                                    <button
                                        style={button}
                                        onClick={async () => {
                                            if (!transactionAmount || isNaN(Number(transactionAmount))) {
                                                alert("Please enter a valid amount");
                                                return;
                                            }
                                            setTransactionLoading(true);
                                            try {
                                                await createTransaction(storeToken, {
                                                    userId: scannedCustomer.customer.id,
                                                    amount: Number(transactionAmount)
                                                });
                                                alert("Transaction created successfully!");
                                                setScannedCustomer(null);
                                                setTransactionAmount("");
                                                // Refresh data
                                                const { store, stats } = await fetchStoreMe(storeToken);
                                                setStoreInfo(store);
                                                setStats(stats);
                                                const ct = await fetchStoreCustomersToday(storeToken);
                                                setCustomersToday(ct.customers || []);
                                            } catch (e) {
                                                alert("Error: " + e.message);
                                            } finally {
                                                setTransactionLoading(false);
                                            }
                                        }}
                                        disabled={transactionLoading}
                                    >
                                        {transactionLoading ? "Processing..." : "Create Transaction"}
                                    </button>
                                    <button
                                        style={{ ...button, backgroundColor: "#6b7280" }}
                                        onClick={() => {
                                            setScannedCustomer(null);
                                            setTransactionAmount("");
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                        {scannedGiftCard && (
                            <div style={{ ...card, marginTop: 12, backgroundColor: scannedGiftCard.valid ? "#f0fdf4" : "#fef2f2", border: `1px solid ${scannedGiftCard.valid ? "#bbf7d0" : "#fecaca"}` }}>
                                <h5 style={{ marginTop: 0 }}>Scanned Gift Card</h5>
                                {scannedGiftCard.valid ? (
                                    <>
                                        <p><strong>Code:</strong> {scannedGiftCard.giftCard.code}</p>
                                        <p><strong>Balance:</strong> ${scannedGiftCard.giftCard.balance.toFixed(2)}</p>
                                        {scannedGiftCard.giftCard.customerName && (
                                            <p><strong>Customer:</strong> {scannedGiftCard.giftCard.customerName}</p>
                                        )}
                                        <div style={{ marginTop: 12 }}>
                                            <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Purchase Amount ($)</label>
                                            <input
                                                style={{ ...input, width: "100%", marginBottom: 8 }}
                                                type="number"
                                                step="0.01"
                                                placeholder="e.g., 7.50"
                                                value={giftCardPurchaseAmount}
                                                onChange={(e) => {
                                                    setGiftCardPurchaseAmount(e.target.value);
                                                    const purchase = parseFloat(e.target.value) || 0;
                                                    const maxUse = Math.min(purchase, scannedGiftCard.giftCard.balance);
                                                    setGiftCardUseAmount(maxUse > 0 ? maxUse.toFixed(2) : "");
                                                }}
                                            />
                                            <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Amount to Use from Gift Card ($)</label>
                                            <input
                                                style={{ ...input, width: "100%" }}
                                                type="number"
                                                step="0.01"
                                                placeholder="Auto-filled (max balance)"
                                                value={giftCardUseAmount}
                                                onChange={(e) => setGiftCardUseAmount(e.target.value)}
                                            />
                                            <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 8px 0" }}>
                                                Max: ${scannedGiftCard.giftCard.balance.toFixed(2)} (gift card balance)
                                            </p>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                            <button
                                                style={{ ...button, flex: 1 }}
                                                onClick={async () => {
                                                    if (!giftCardPurchaseAmount || isNaN(parseFloat(giftCardPurchaseAmount))) {
                                                        alert("Please enter a valid purchase amount");
                                                        return;
                                                    }
                                                    
                                                    const purchase = parseFloat(giftCardPurchaseAmount);
                                                    const useAmount = giftCardUseAmount ? parseFloat(giftCardUseAmount) : Math.min(purchase, scannedGiftCard.giftCard.balance);
                                                    
                                                    if (useAmount <= 0 || useAmount > scannedGiftCard.giftCard.balance) {
                                                        alert("Invalid gift card amount. Must be between $0 and gift card balance.");
                                                        return;
                                                    }
                                                    
                                                    setGiftCardProcessing(true);
                                                    try {
                                                        const result = await useGiftCard(storeToken, scannedGiftCard.giftCard.id, purchase, useAmount);
                                                        alert(result.message);
                                                        setScannedGiftCard(null);
                                                        setGiftCardPurchaseAmount("");
                                                        setGiftCardUseAmount("");
                                                        
                                                        // Refresh data
                                                        const { store, stats } = await fetchStoreMe(storeToken);
                                                        setStoreInfo(store);
                                                        setStats(stats);
                                                    } catch (e) {
                                                        alert("Error: " + e.message);
                                                    } finally {
                                                        setGiftCardProcessing(false);
                                                    }
                                                }}
                                                disabled={giftCardProcessing || !giftCardPurchaseAmount}
                                            >
                                                {giftCardProcessing ? "Processing..." : "Apply Gift Card"}
                                            </button>
                                            <button
                                                style={{ ...button, flex: 1, background: "#6b7280" }}
                                                onClick={() => {
                                                    setScannedGiftCard(null);
                                                    setGiftCardPurchaseAmount("");
                                                    setGiftCardUseAmount("");
                                                }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <p style={{ color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
                                            {scannedGiftCard.error || "Invalid gift card"}
                                        </p>
                                        <button
                                            style={{ ...button, marginTop: 8 }}
                                            onClick={() => setScannedGiftCard(null)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {customersToday.length === 0 ? (
                            <p style={{ fontSize: 13, color: "#666" }}>
                                No Loops transactions recorded today yet.
                            </p>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Time</th>
                                            <th style={th}>Customer</th>
                                            <th style={th}>Phone</th>
                                            <th style={{ ...th, textAlign: "right" }}>Loops</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customersToday.map((c) => (
                                            <tr key={c.id}>
                                                <td style={td}>
                                                    {new Date(c.timestamp).toLocaleTimeString()}
                                                </td>
                                                <td style={td}>{c.user_name}</td>
                                                <td style={td}>{c.user_phone || c.user_email || "N/A"}</td>
                                                <td style={{ ...td, textAlign: "right", color: "#10b981", fontWeight: "bold" }}>
                                                    +{c.loops_earned || c.loops_awarded || 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "analytics" && storeToken && storeInfo && (
                    <AnalyticsDashboard
                        token={storeToken}
                        userRole="store"
                        storeId={storeInfo.id}
                    />
                )}

                {activeTab === "giftcards" && storeToken && storeInfo && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                            <h3 style={{ marginTop: 0 }}>📦 Pending Physical Gift Cards</h3>
                            <button
                                style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                onClick={async () => {
                                    try {
                                        setLoading(true);
                                        const pendingCards = await getPendingPhysicalGiftCards(storeToken);
                                        setPendingPhysicalGiftCards(pendingCards.giftCards || []);
                                    } catch (e) {
                                        setErr("Error loading gift cards: " + e.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                🔄 Refresh
                            </button>
                        </div>

                        {pendingPhysicalGiftCards.length === 0 ? (
                            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                                <p style={{ fontSize: 16, margin: "0 0 8px 0" }}>No pending physical gift cards</p>
                                <p style={{ fontSize: 13 }}>Physical gift cards requested by customers will appear here.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {pendingPhysicalGiftCards.map((card) => (
                                    <div 
                                        key={card.id} 
                                        style={{ 
                                            padding: 16, 
                                            background: "#fef3c7", 
                                            borderRadius: 8, 
                                            border: "1px solid #fcd34d" 
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                    <h4 style={{ margin: 0, fontSize: 16 }}>Gift Card #{card.code}</h4>
                                                    <span style={{ 
                                                        fontSize: 10, 
                                                        padding: "2px 6px", 
                                                        borderRadius: 4, 
                                                        background: "#fef3c7",
                                                        color: "#92400e",
                                                        fontWeight: 600
                                                    }}>
                                                        ⏳ PENDING
                                                    </span>
                                                </div>
                                                <p style={{ margin: "4px 0", fontSize: 18, fontWeight: 700, color: "#2563eb" }}>
                                                    ${card.current_balance.toFixed(2)}
                                                </p>
                                                <p style={{ margin: "4px 0", fontSize: 13, color: "#6b7280" }}>
                                                    <strong>Customer:</strong> {card.customer_name || "Unknown"} 
                                                    {card.customer_phone && ` (${card.customer_phone})`}
                                                </p>
                                                <p style={{ margin: "4px 0", fontSize: 12, color: "#6b7280" }}>
                                                    <strong>Requested:</strong> {card.created_at ? new Date(card.created_at).toLocaleString() : "Unknown"}
                                                </p>
                                                <p style={{ margin: "4px 0", fontSize: 12, color: card.daysRemaining < 30 ? "#f59e0b" : "#6b7280" }}>
                                                    <strong>Valid for:</strong> {card.daysRemaining} days
                                                </p>
                                            </div>
                                            <button
                                                style={{ 
                                                    ...button, 
                                                    background: "#059669", 
                                                    padding: "10px 20px",
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap"
                                                }}
                                                onClick={async () => {
                                                    if (!confirm(`Issue physical gift card #${card.code} worth $${card.current_balance.toFixed(2)} to ${card.customer_name || "customer"}?`)) {
                                                        return;
                                                    }
                                                    try {
                                                        setIssuingCard(card.id);
                                                        const result = await issuePhysicalGiftCard(storeToken, card.id);
                                                        alert(result.message);
                                                        
                                                        // Refresh list
                                                        const pendingCards = await getPendingPhysicalGiftCards(storeToken);
                                                        setPendingPhysicalGiftCards(pendingCards.giftCards || []);
                                                    } catch (e) {
                                                        alert("Error issuing gift card: " + e.message);
                                                    } finally {
                                                        setIssuingCard(null);
                                                    }
                                                }}
                                                disabled={issuingCard === card.id}
                                            >
                                                {issuingCard === card.id ? "Issuing..." : "✅ Issue Card"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* QR Scanner */}
                {showQRScanner && (
                    <QRScanner
                        title={qrScannerMode === "customer" ? "Scan Customer QR Code" : "Scan Gift Card QR Code"}
                        onScan={async (qrCode) => {
                            setShowQRScanner(false);
                            try {
                                if (qrScannerMode === "customer") {
                                    // Scan customer QR
                                    const result = await scanCustomerQR(storeToken, qrCode);
                                    setScannedCustomer(result);
                                } else {
                                    // Scan gift card QR
                                    const result = await scanGiftCard(storeToken, qrCode);
                                    setScannedGiftCard(result);
                                }
                            } catch (e) {
                                alert("Error scanning QR code: " + e.message);
                            }
                        }}
                        onClose={() => setShowQRScanner(false)}
                    />
                )}

                {/* Store Location Prompt */}
                {showLocationPrompt && storeToken && (
                    <StoreLocationPrompt
                        token={storeToken}
                        onLocationSet={async () => {
                            setShowLocationPrompt(false);
                            // Refresh store data
                            try {
                                const { store, stats } = await fetchStoreMe(storeToken);
                                setStoreInfo(store);
                                setStats(stats);
                                const ct = await fetchStoreCustomersToday(storeToken);
                                setCustomersToday(ct.customers || []);
                            } catch (e) {
                                setErr(e.message);
                            }
                        }}
                    />
                )}

                {/* QR Code Zoom Modal */}
                {showQRZoom && storeInfo && storeInfo.qr_code && (
                    <div style={qrZoomOverlay} onClick={() => setShowQRZoom(false)}>
                        <div style={qrZoomModal} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h2 style={{ margin: 0 }}>Store QR Code</h2>
                                <button
                                    style={closeButton}
                                    onClick={() => setShowQRZoom(false)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                                        e.currentTarget.style.color = "#111827";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "transparent";
                                        e.currentTarget.style.color = "#6b7280";
                                    }}
                                    title="Close"
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ textAlign: "center", padding: 20, backgroundColor: "#fff", borderRadius: 12 }}>
                                <QRCodeCanvas value={storeInfo.qr_code} size={300} />
                                <p style={{ marginTop: 16, fontSize: 14, color: "#6b7280" }}>
                                    {storeInfo.name}
                                </p>
                                <p style={{ marginTop: 4, fontSize: 12, color: "#9ca3af" }}>
                                    Customers can scan this QR code
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const loginCard = {
    width: "100%",
    maxWidth: 300,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const dashboardCard = {
    flex: 1,
    minWidth: 400,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
    boxSizing: "border-box",
};

const button = {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const smallButton = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#374151",
    fontSize: 12,
    cursor: "pointer",
};

const linkButton = {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
};

const infoRow = {
    marginBottom: 8,
    fontSize: 14,
    color: "#374151",
};

const link = {
    color: "#2563eb",
    textDecoration: "none",
};

const statsBox = {
    display: "flex",
    gap: 24,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
};

const statSection = {
    textAlign: "center",
};

const statLabel = {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
};

const statValue = {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
};

const statSubtext = {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 12,
};

const qrZoomOverlay = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    cursor: "pointer",
};

const qrZoomModal = {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 16,
    maxWidth: 400,
    width: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    cursor: "default",
};

const closeButton = {
    background: "none",
    border: "none",
    fontSize: 24,
    color: "#6b7280",
    cursor: "pointer",
    padding: 0,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    transition: "background-color 0.2s",
};

const locationCard = {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginBottom: 20,
};

const table = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
};

const th = {
    textAlign: "left",
    padding: "12px 8px",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 600,
    color: "#374151",
    fontSize: 12,
    textTransform: "uppercase",
};

const td = {
    padding: "12px 8px",
    borderBottom: "1px solid #f3f4f6",
    color: "#6b7280",
};

const tabsContainer = {
    display: "flex",
    gap: 8,
};

const tabButton = {
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
};
