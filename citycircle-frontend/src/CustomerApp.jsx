// src/CustomerApp.jsx
import React, { useEffect, useState } from "react";
import { fetchUserMe, redeemLoops, fetchStoresList, scanStoreQR, checkIn, updateCheckInLocation, completeCheckIn, getPendingPoints, checkSettlement, checkGiftCardEligibility, createGiftCard, getGiftCards, getGiftCardDetails, topUpGiftCard, getPlanTier } from "./api";
import { QRCodeCanvas } from "qrcode.react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import LocationPrompt from "./LocationPrompt";
import QRScanner from "./QRScanner";
import Settings from "./Settings";
import { FaCalendarAlt, FaStore } from 'react-icons/fa';

export default function CustomerApp({ token }) {
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [period, setPeriod] = useState(30); // default = last 30 days
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [redeemAmount, setRedeemAmount] = useState("");
    const [redeemLoading, setRedeemLoading] = useState(false);
    const [redeemErr, setRedeemErr] = useState("");
    const [redeemSuccess, setRedeemSuccess] = useState("");
    const [activeTab, setActiveTab] = useState("home");
    const [storeId, setStoreId] = useState("all");
    const [stores, setStores] = useState([]);
    const [storesLoading, setStoresLoading] = useState(true);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [scannedStore, setScannedStore] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [pendingPoints, setPendingPoints] = useState([]);
    const [locationWatchId, setLocationWatchId] = useState(null);
    const [giftCards, setGiftCards] = useState([]);
    const [giftCardEligibility, setGiftCardEligibility] = useState(null);
    const [showGiftCardModal, setShowGiftCardModal] = useState(false);
    const [selectedGiftCard, setSelectedGiftCard] = useState(null);
    const [giftCardAmount, setGiftCardAmount] = useState("");
    const [giftCardLoading, setGiftCardLoading] = useState(false);
    const [giftCardError, setGiftCardError] = useState("");
    const [giftCardSuccess, setGiftCardSuccess] = useState("");
    const [planTier, setPlanTier] = useState(null);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        setErr("");
        fetchUserMe({ token, period, storeId })
            .then((data) => {
                setUser(data.user);
                setTransactions(data.transactions || []);
                // Check if location needs to be set
                if (data.user && (!data.user.location_set || !data.user.latitude || !data.user.longitude)) {
                    setShowLocationPrompt(true);
                }
            })
            .catch((e) => setErr(e.message))
            .finally(() => setLoading(false));
        
        // Load pending points
        if (token) {
            getPendingPoints(token)
                .then((data) => {
                    setPendingPoints(data.pendingPoints || []);
                })
                .catch((e) => console.error("Failed to load pending points:", e));
            
            // Load gift cards
            getGiftCards(token)
                .then((data) => {
                    setGiftCards(data.giftCards || []);
                })
                .catch((e) => console.error("Failed to load gift cards:", e));
            
            // Check gift card eligibility
            checkGiftCardEligibility(token)
                .then((data) => {
                    setGiftCardEligibility(data);
                })
                .catch((e) => console.error("Failed to check eligibility:", e));
            
            // Load plan/tier information (non-blocking - don't show error if fails)
            getPlanTier(token)
                .then((data) => {
                    setPlanTier(data);
                })
                .catch((e) => {
                    console.error("Failed to load plan/tier:", e);
                    // Don't set planTier to anything, just let it stay null
                    // The UI will gracefully handle this
                });
        }
    }, [token, period, storeId]);
    
    useEffect(() => {
        async function loadStores() {
            try {
                const res = await fetch("http://localhost:4000/api/stores/list");
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error("Stores API error:", res.status, errorText);
                    throw new Error(`Failed to load stores: ${res.status}`);
                }
                const data = await res.json();
                console.log("Stores API response:", data);
                if (Array.isArray(data)) {
                    if (data.length > 0) {
                        setStores(data);
                        console.log(`Successfully loaded ${data.length} stores:`, data);
                    } else {
                        console.warn("Stores array is empty");
                        setStores([]);
                    }
                } else {
                    console.warn("Invalid stores data format:", data);
                    setStores([]);
                }
            } catch (e) {
                console.error("Stores load error:", e);
                setStores([]);
            }
        }
        // Only load stores if we have a token (user is logged in)
        if (token) {
            loadStores();
        }
    }, [token]);
    
    // Cleanup location tracking on unmount
    useEffect(() => {
        return () => {
            if (locationWatchId !== null) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
        };
    }, [locationWatchId]);

    const handleRedeem = async () => {
        if (!redeemAmount || isNaN(Number(redeemAmount)) || Number(redeemAmount) <= 0) {
            setRedeemErr("Please enter a valid amount");
            return;
        }

        const amount = Math.floor(Number(redeemAmount));
        if (amount > (user?.loops_balance || 0)) {
            setRedeemErr(`Insufficient Loops. You have ${user.loops_balance}`);
            return;
        }

        setRedeemLoading(true);
        setRedeemErr("");
        setRedeemSuccess("");

        try {
            const result = await redeemLoops(token, amount);
            setRedeemSuccess(result.message);
            setRedeemAmount("");
            
            // Refresh user data
            const data = await fetchUserMe({ token, period, storeId });
            setUser(data.user);
            setTransactions(data.transactions || []);
        } catch (e) {
            setRedeemErr(e.message);
        } finally {
            setRedeemLoading(false);
        }
    };

    if (!token) return <p>Please log in as customer.</p>;
    if (loading) return <div style={card}><p>Loading wallet...</p></div>;
    if (err) return <div style={card}><p style={{ color: "red" }}>Error: {err}</p></div>;
    if (!user) return <div style={card}><p>No user data found.</p></div>;

    const qrValue = user.qr_code || `USER:${user.id}`;
    let tier = "BRONZE";
    const total = user.total_loops_earned ?? 0;
    if (total >= 1000) tier = "PLATINUM";
    else if (total >= 500) tier = "GOLD";
    else if (total >= 200) tier = "SILVER";

    const tierColors = {
        BRONZE: "#cd7f32",
        SILVER: "#c0c0c0",
        GOLD: "#ffd700",
        PLATINUM: "#e5e4e2",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Mobile-First Navigation Tabs */}
            <div style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: 0,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none"
            }}>
                <style>{`
                    div::-webkit-scrollbar { display: none; }
                `}</style>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "home" ? "3px solid #2563eb" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "home" ? "#2563eb" : "#6b7280",
                        fontSize: 15,
                        fontWeight: activeTab === "home" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("home")}
                >
                    🏠 Home
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "wallet" ? "3px solid #2563eb" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "wallet" ? "#2563eb" : "#6b7280",
                        fontSize: 15,
                        fontWeight: activeTab === "wallet" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("wallet")}
                >
                    💳 Wallet
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "analytics" ? "3px solid #2563eb" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "analytics" ? "#2563eb" : "#6b7280",
                        fontSize: 15,
                        fontWeight: activeTab === "analytics" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("analytics")}
                >
                    📊 Analytics
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "settings" ? "3px solid #2563eb" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "settings" ? "#2563eb" : "#6b7280",
                        fontSize: 15,
                        fontWeight: activeTab === "settings" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("settings")}
                >
                    ⚙️ Settings
                </button>
            </div>

            {/* Home Tab - Mobile-First Design */}
            {activeTab === "home" && (
                <>
                    {/* Hero Card with Balance & Address */}
                    <div style={{
                        ...card,
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 10px 25px rgba(102, 126, 234, 0.3)",
                        marginBottom: 16,
                        padding: 24
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Welcome back,</div>
                                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>{user.name}</div>
                                
                                {/* Home Address Display */}
                                {user.address && (
                                    <div style={{
                                        padding: 12,
                                        background: "rgba(255, 255, 255, 0.15)",
                                        backdropFilter: "blur(10px)",
                                        borderRadius: 8,
                                        marginBottom: 16,
                                        border: "1px solid rgba(255, 255, 255, 0.2)"
                                    }}>
                                        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>📍 Home Address</div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>{user.address}</div>
                                    </div>
                                )}
                                
                                <div style={{
                                    padding: 16,
                                    background: "rgba(255, 255, 255, 0.2)",
                                    backdropFilter: "blur(10px)",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255, 255, 255, 0.3)"
                                }}>
                                    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Available Balance</div>
                                    <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4 }}>{user.loops_balance}</div>
                                    <div style={{ fontSize: 14, opacity: 0.9 }}>Loops</div>
                                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                                        Total earned: {user.total_loops_earned} Loops
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ 
                                    padding: 16, 
                                    background: "rgba(255, 255, 255, 0.15)", 
                                    backdropFilter: "blur(10px)",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    marginBottom: 12
                                }}>
                                    <QRCodeCanvas value={qrValue} size={120} />
                                </div>
                                <button
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: 8,
                                        border: "2px solid rgba(255, 255, 255, 0.5)",
                                        background: "rgba(255, 255, 255, 0.2)",
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        width: "100%",
                                        transition: "all 0.2s"
                                    }}
                                    onClick={() => setShowQRScanner(true)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                                    }}
                                >
                                    📷 Scan Store QR
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Plan & Tier - Always try to load, but don't block if fails */}
                    {planTier ? (
                        <div style={{
                            ...card,
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            color: "#fff",
                            border: "none",
                            boxShadow: "0 10px 25px rgba(102, 126, 234, 0.3)",
                            marginBottom: 16
                        }}>
                            <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 22, fontWeight: 700, color: "#fff" }}>
                                🎯 Your Membership Status
                            </h3>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                                {/* Current Plan Card */}
                                <div style={{
                                    background: "rgba(255, 255, 255, 0.15)",
                                    backdropFilter: "blur(10px)",
                                    borderRadius: 12,
                                    padding: 16,
                                    border: "1px solid rgba(255, 255, 255, 0.2)"
                                }}>
                                    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                        📋 Current Plan
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{planTier.planDetails.name}</div>
                                    <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>{planTier.planDetails.description}</div>
                                    <div style={{
                                        display: "inline-block",
                                        padding: "6px 12px",
                                        background: "rgba(255, 255, 255, 0.3)",
                                        borderRadius: 20,
                                        fontSize: 14,
                                        fontWeight: 700
                                    }}>
                                        {planTier.planMultiplier}x Bonus
                                    </div>
                                </div>

                                {/* Current Tier Card */}
                                <div style={{
                                    background: "rgba(255, 255, 255, 0.15)",
                                    backdropFilter: "blur(10px)",
                                    borderRadius: 12,
                                    padding: 16,
                                    border: `2px solid ${tierColors[tier]}`,
                                    boxShadow: `0 0 20px ${tierColors[tier]}40`
                                }}>
                                    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                        ⭐ Current Tier
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: tierColors[tier] }}>
                                        {planTier.currentTier}
                                    </div>
                                    <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>{planTier.tierDetails.description}</div>
                                    <div style={{
                                        display: "inline-block",
                                        padding: "6px 12px",
                                        background: tierColors[tier],
                                        borderRadius: 20,
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: "#fff"
                                    }}>
                                        {planTier.tierMultiplier}x Multiplier
                                    </div>
                                </div>

                                {/* Combined Multiplier Card */}
                                <div style={{
                                    background: "rgba(255, 255, 255, 0.15)",
                                    backdropFilter: "blur(10px)",
                                    borderRadius: 12,
                                    padding: 16,
                                    border: "1px solid rgba(255, 255, 255, 0.2)"
                                }}>
                                    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                        🚀 Total Bonus
                                    </div>
                                    <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, color: "#ffd700", textShadow: "0 2px 10px rgba(255, 215, 0, 0.5)" }}>
                                        {planTier.combinedMultiplier}x
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
                                        Plan ({planTier.planMultiplier}x) × Tier ({planTier.tierMultiplier}x)
                                    </div>
                                </div>
                            </div>

                            {/* Tier Progress Section */}
                            {planTier.nextTier && (
                                <div style={{
                                    background: "rgba(255, 255, 255, 0.1)",
                                    borderRadius: 12,
                                    padding: 20,
                                    border: "1px solid rgba(255, 255, 255, 0.2)"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                                                🎯 Progress to {planTier.nextTier} Tier
                                            </div>
                                            <div style={{ fontSize: 12, opacity: 0.9 }}>
                                                {planTier.totalEarned} / {planTier.nextTierMin} Total Loops Earned
                                            </div>
                                        </div>
                                        <div style={{
                                            background: "rgba(255, 255, 255, 0.2)",
                                            padding: "8px 16px",
                                            borderRadius: 20,
                                            fontSize: 14,
                                            fontWeight: 700
                                        }}>
                                            {planTier.pointsNeeded} more needed
                                        </div>
                                    </div>
                                    
                                    <div style={{
                                        width: "100%",
                                        height: 32,
                                        background: "rgba(0, 0, 0, 0.2)",
                                        borderRadius: 16,
                                        overflow: "hidden",
                                        position: "relative",
                                        border: "2px solid rgba(255, 255, 255, 0.3)"
                                    }}>
                                        <div style={{
                                            width: `${planTier.progress}%`,
                                            height: "100%",
                                            background: planTier.progress >= 100
                                                ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
                                                : "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                                            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: planTier.progress >= 50 ? "center" : "flex-end",
                                            padding: planTier.progress >= 50 ? 0 : "0 12px"
                                        }}>
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color: "#fff",
                                                textShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
                                            }}>
                                                {Math.round(planTier.progress)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                    
                    {/* Quick Actions */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
                        <button
                            style={{
                                ...card,
                                padding: 20,
                                textAlign: "center",
                                cursor: "pointer",
                                border: "none",
                                transition: "transform 0.2s, box-shadow 0.2s",
                                background: "#fff"
                            }}
                            onClick={() => setActiveTab("wallet")}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.15)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                            }}
                        >
                            <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>My Wallet</div>
                        </button>
                        <button
                            style={{
                                ...card,
                                padding: 20,
                                textAlign: "center",
                                cursor: "pointer",
                                border: "none",
                                transition: "transform 0.2s, box-shadow 0.2s",
                                background: "#fff"
                            }}
                            onClick={() => setActiveTab("analytics")}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.15)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                            }}
                        >
                            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Analytics</div>
                        </button>
                        <button
                            style={{
                                ...card,
                                padding: 20,
                                textAlign: "center",
                                cursor: "pointer",
                                border: "none",
                                transition: "transform 0.2s, box-shadow 0.2s",
                                background: "#fff"
                            }}
                            onClick={() => setActiveTab("settings")}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.15)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                            }}
                        >
                            <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Settings</div>
                        </button>
                    </div>
                </>
            )}

            {activeTab === "wallet" && (
                <>
                    {/* Wallet Card */}
        <div style={card}>
                <h2 style={{ marginTop: 0 }}>My Wallet</h2>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={infoText}>
                Hello, <strong>{user.name}</strong>
            </p>
                        <div style={{ marginTop: 12, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
                            <div style={{ fontSize: 24, fontWeight: "bold", color: "#2563eb" }}>
                                {user.loops_balance}
                            </div>
                            <div style={{ fontSize: 12, color: "#666" }}>Loops Available</div>
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                Total earned: {user.total_loops_earned}
                            </div>
                            {pendingPoints.length > 0 && (
                                <div style={{ marginTop: 12, padding: 12, background: "#fef3c7", borderRadius: 6, border: "1px solid #fcd34d" }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                                        🎉 {pendingPoints.reduce((sum, p) => sum + p.loops_pending, 0)} Loops Pending
                                    </div>
                                    <div style={{ fontSize: 11, color: "#78350f", marginBottom: 8 }}>
                                        Points will unlock when you return to the store!
                                    </div>
                                    <div style={{ fontSize: 10, color: "#92400e", marginBottom: 8 }}>
                                        {pendingPoints.map((p, idx) => (
                                            <div key={p.id} style={{ marginBottom: 4 }}>
                                                • {p.store_name}: {p.loops_pending} Loops (CIV: {Math.round((p.civ_score || 0.5) * 100)}%)
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        style={{
                                            padding: "6px 12px",
                                            fontSize: 11,
                                            borderRadius: 4,
                                            border: "1px solid #f59e0b",
                                            background: "#fbbf24",
                                            color: "#78350f",
                                            cursor: "pointer",
                                            fontWeight: 500
                                        }}
                                        onClick={async () => {
                                            try {
                                                // Check settlement for all stores
                                                for (const pending of pendingPoints) {
                                                    await checkSettlement(token, pending.store_id);
                                                }
                                                alert("Settlement check completed! If you've returned to any store, points should unlock now.");
                                                
                                                // Refresh data
                                                getPendingPoints(token)
                                                    .then((data) => {
                                                        setPendingPoints(data.pendingPoints || []);
                                                    });
                                                fetchUserMe({ token, period, storeId })
                                                    .then((data) => {
                                                        setUser(data.user);
                                                        setTransactions(data.transactions || []);
                                                    });
                                            } catch (e) {
                                                alert("Error checking settlement: " + e.message);
                                            }
                                        }}
                                    >
                                        🔄 Check for Unlocks (Testing)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Membership QR</h3>
            <QRCodeCanvas value={qrValue} size={140} />
                        <p style={{ fontSize: 11, marginTop: 4, color: "#666" }}>
                            Show at checkout
                        </p>
                        <button
                            style={{ ...button, marginTop: 8, fontSize: 12, padding: "6px 12px" }}
                            onClick={() => setShowQRScanner(true)}
                        >
                            📷 Scan Store QR
                        </button>
                    </div>
                </div>
            </div>

            {/* Interactive Plan & Tier Section */}
            {planTier && (
                <div style={{ 
                    ...card, 
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    border: "none",
                    boxShadow: "0 10px 25px rgba(102, 126, 234, 0.3)",
                    marginBottom: 16
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 22, fontWeight: 700, color: "#fff" }}>
                        🎯 Your Membership Status
                    </h3>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 24 }}>
                        {/* Current Plan Card */}
                        <div style={{ 
                            background: "rgba(255, 255, 255, 0.15)",
                            backdropFilter: "blur(10px)",
                            borderRadius: 12,
                            padding: 16,
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                        >
                            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                📋 Current Plan
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#fff" }}>
                                {planTier.planDetails.name}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
                                {planTier.planDetails.description}
                            </div>
                            <div style={{ 
                                display: "inline-block",
                                padding: "6px 12px",
                                background: "rgba(255, 255, 255, 0.3)",
                                borderRadius: 20,
                                fontSize: 14,
                                fontWeight: 700
                            }}>
                                {planTier.planMultiplier}x Bonus
                            </div>
                        </div>

                        {/* Current Tier Card */}
                        <div style={{ 
                            background: "rgba(255, 255, 255, 0.15)",
                            backdropFilter: "blur(10px)",
                            borderRadius: 12,
                            padding: 16,
                            border: `2px solid ${tierColors[tier]}`,
                            transition: "transform 0.2s, box-shadow 0.2s",
                            cursor: "pointer",
                            boxShadow: `0 0 20px ${tierColors[tier]}40`
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                            e.currentTarget.style.boxShadow = `0 8px 30px ${tierColors[tier]}60`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0) scale(1)";
                            e.currentTarget.style.boxShadow = `0 0 20px ${tierColors[tier]}40`;
                        }}
                        >
                            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                ⭐ Current Tier
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: tierColors[tier] }}>
                                {planTier.currentTier}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
                                {planTier.tierDetails.description}
                            </div>
                            <div style={{ 
                                display: "inline-block",
                                padding: "6px 12px",
                                background: tierColors[tier],
                                borderRadius: 20,
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#fff"
                            }}>
                                {planTier.tierMultiplier}x Multiplier
                            </div>
                        </div>

                        {/* Combined Multiplier Card */}
                        <div style={{ 
                            background: "rgba(255, 255, 255, 0.15)",
                            backdropFilter: "blur(10px)",
                            borderRadius: 12,
                            padding: 16,
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                        >
                            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                🚀 Total Bonus
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, color: "#ffd700", textShadow: "0 2px 10px rgba(255, 215, 0, 0.5)" }}>
                                {planTier.combinedMultiplier}x
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
                                Plan ({planTier.planMultiplier}x) × Tier ({planTier.tierMultiplier}x)
                            </div>
                        </div>
                    </div>

                    {/* Tier Progress Section */}
                    <div style={{ 
                        background: "rgba(255, 255, 255, 0.1)",
                        borderRadius: 12,
                        padding: 20,
                        border: "1px solid rgba(255, 255, 255, 0.2)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                                    {planTier.nextTier ? `🎯 Progress to ${planTier.nextTier} Tier` : "🏆 Maximum Tier Achieved!"}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.9 }}>
                                    {planTier.totalEarned} / {planTier.nextTierMin || planTier.currentTierMin} Total Loops Earned
                                </div>
                            </div>
                            {planTier.nextTier && (
                                <div style={{ 
                                    background: "rgba(255, 255, 255, 0.2)",
                                    padding: "8px 16px",
                                    borderRadius: 20,
                                    fontSize: 14,
                                    fontWeight: 700
                                }}>
                                    {planTier.pointsNeeded} more needed
                                </div>
                            )}
                        </div>
                        
                        {/* Animated Progress Bar */}
                        <div style={{ 
                            width: "100%", 
                            height: 32, 
                            background: "rgba(0, 0, 0, 0.2)", 
                            borderRadius: 16, 
                            overflow: "hidden", 
                            position: "relative",
                            border: "2px solid rgba(255, 255, 255, 0.3)"
                        }}>
                            <div 
                                style={{ 
                                    width: `${planTier.progress}%`, 
                                    height: "100%", 
                                    background: planTier.progress >= 100 
                                        ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)" 
                                        : "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                                    transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: planTier.progress >= 50 ? "center" : "flex-end",
                                    padding: planTier.progress >= 50 ? 0 : "0 12px",
                                    boxShadow: planTier.progress >= 100 ? "0 0 20px rgba(16, 185, 129, 0.6)" : "none"
                                }}
                            >
                                <span style={{ 
                                    fontSize: 12, 
                                    fontWeight: 800, 
                                    color: "#fff",
                                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
                                }}>
                                    {Math.round(planTier.progress)}%
                                </span>
                            </div>
                            {planTier.progress < 50 && (
                                <span style={{ 
                                    position: "absolute", 
                                    left: `${planTier.progress}%`, 
                                    top: "50%", 
                                    transform: "translate(-50%, -50%)",
                                    fontSize: 12, 
                                    fontWeight: 700, 
                                    color: "#fff",
                                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
                                    marginLeft: 4
                                }}>
                                    {Math.round(planTier.progress)}%
                                </span>
                            )}
                        </div>

                        {planTier.nextTier && (
                            <div style={{ 
                                marginTop: 16, 
                                padding: 12,
                                background: "rgba(255, 255, 255, 0.1)",
                                borderRadius: 8,
                                fontSize: 13,
                                lineHeight: 1.6
                            }}>
                                <strong style={{ color: tierColors[planTier.nextTier] }}>
                                    💡 Next Level:
                                </strong> Earn {planTier.pointsNeeded} more Loops to unlock <strong style={{ color: tierColors[planTier.nextTier] }}>{planTier.nextTier}</strong> tier with <strong>{planTier.nextTierDetails.multiplier}x</strong> multiplier!
                            </div>
                        )}
                        {!planTier.nextTier && (
                            <div style={{ 
                                marginTop: 16, 
                                padding: 12,
                                background: "rgba(16, 185, 129, 0.2)",
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                textAlign: "center"
                            }}>
                                🎉 Congratulations! You've reached the highest tier! Keep earning to maintain your elite status.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!planTier && (
                <div style={{ 
                    ...card, 
                    background: "#fef3c7",
                    border: "1px solid #fcd34d",
                    marginBottom: 16
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 24 }}>⏳</div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                                Loading membership information...
                            </div>
                            <div style={{ fontSize: 12, color: "#78350f" }}>
                                Please wait while we fetch your plan and tier details.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* All Plans & Tiers Overview */}
            {planTier && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
                    {/* Plans Overview */}
                    <div style={card}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                            📋 Membership Plans
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { name: "STARTER", multiplier: 1.0, desc: "Default plan" },
                                { name: "BASIC", multiplier: 1.05, desc: "5% bonus on purchases" },
                                { name: "PLUS", multiplier: 1.1, desc: "10% bonus on purchases" },
                                { name: "PREMIUM", multiplier: 1.2, desc: "20% bonus on purchases" }
                            ].map((plan) => {
                                const isCurrent = planTier.currentPlan === plan.name;
                                return (
                                    <div 
                                        key={plan.name}
                                        style={{ 
                                            padding: 14,
                                            background: isCurrent ? "#eff6ff" : "#f9fafb",
                                            borderRadius: 8,
                                            border: isCurrent ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                                            transition: "all 0.2s",
                                            cursor: "pointer"
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isCurrent) {
                                                e.currentTarget.style.background = "#f3f4f6";
                                                e.currentTarget.style.transform = "translateX(4px)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isCurrent) {
                                                e.currentTarget.style.background = "#f9fafb";
                                                e.currentTarget.style.transform = "translateX(0)";
                                            }
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ 
                                                    fontSize: 16, 
                                                    fontWeight: 700, 
                                                    color: isCurrent ? "#2563eb" : "#111827",
                                                    marginBottom: 4
                                                }}>
                                                    {isCurrent && "✓ "}{plan.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                                    {plan.desc}
                                                </div>
                                            </div>
                                            <div style={{ 
                                                fontSize: 18, 
                                                fontWeight: 800, 
                                                color: isCurrent ? "#2563eb" : "#9ca3af"
                                            }}>
                                                {plan.multiplier}x
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tiers Overview */}
                    <div style={card}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                            ⭐ Loyalty Tiers
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { name: "BRONZE", multiplier: 1.0, min: 0, color: "#cd7f32", icon: "🥉" },
                                { name: "SILVER", multiplier: 1.05, min: 200, color: "#c0c0c0", icon: "🥈" },
                                { name: "GOLD", multiplier: 1.1, min: 500, color: "#ffd700", icon: "🥇" },
                                { name: "PLATINUM", multiplier: 1.2, min: 1000, color: "#e5e4e2", icon: "💎" }
                            ].map((tierData) => {
                                const isCurrent = planTier.currentTier === tierData.name;
                                const isUnlocked = planTier.totalEarned >= tierData.min;
                                const progressToThis = tierData.min > 0 
                                    ? Math.min(100, (planTier.totalEarned / tierData.min) * 100)
                                    : 100;
                                
                                return (
                                    <div 
                                        key={tierData.name}
                                        style={{ 
                                            padding: 14,
                                            background: isCurrent ? `linear-gradient(135deg, ${tierData.color}20 0%, ${tierData.color}10 100%)` : "#f9fafb",
                                            borderRadius: 8,
                                            border: isCurrent ? `2px solid ${tierData.color}` : "1px solid #e5e7eb",
                                            transition: "all 0.2s",
                                            cursor: "pointer",
                                            position: "relative",
                                            overflow: "hidden"
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isCurrent) {
                                                e.currentTarget.style.background = "#f3f4f6";
                                                e.currentTarget.style.transform = "translateX(4px)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isCurrent) {
                                                e.currentTarget.style.background = isUnlocked 
                                                    ? `linear-gradient(135deg, ${tierData.color}10 0%, ${tierData.color}05 100%)`
                                                    : "#f9fafb";
                                                e.currentTarget.style.transform = "translateX(0)";
                                            }
                                        }}
                                    >
                                        {isCurrent && (
                                            <div style={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: tierData.color,
                                                color: "#fff",
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                borderRadius: "0 8px 0 8px"
                                            }}>
                                                CURRENT
                                            </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ 
                                                    fontSize: 16, 
                                                    fontWeight: 700, 
                                                    color: isCurrent ? tierData.color : (isUnlocked ? "#111827" : "#9ca3af"),
                                                    marginBottom: 4,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6
                                                }}>
                                                    {tierData.icon} {tierData.name}
                                                    {isCurrent && <span style={{ fontSize: 12, color: tierData.color }}>✓</span>}
                                                </div>
                                                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                                                    {tierData.min === 0 ? "Starting tier" : `Earn ${tierData.min}+ total Loops`}
                                                </div>
                                                {!isUnlocked && tierData.min > 0 && (
                                                    <div style={{ 
                                                        width: "100%", 
                                                        height: 6, 
                                                        background: "#e5e7eb", 
                                                        borderRadius: 3, 
                                                        overflow: "hidden",
                                                        marginTop: 4
                                                    }}>
                                                        <div style={{ 
                                                            width: `${progressToThis}%`, 
                                                            height: "100%", 
                                                            background: tierData.color,
                                                            transition: "width 0.3s"
                                                        }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ 
                                                fontSize: 18, 
                                                fontWeight: 800, 
                                                color: isCurrent ? tierData.color : (isUnlocked ? "#111827" : "#d1d5db")
                                            }}>
                                                {tierData.multiplier}x
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ 
                            marginTop: 16, 
                            padding: 12, 
                            background: "#f0f9ff", 
                            borderRadius: 8, 
                            border: "1px solid #bae6fd",
                            fontSize: 12,
                            color: "#0369a1"
                        }}>
                            💡 <strong>Tip:</strong> Your tier is based on your <strong>total Loops earned</strong>, not just your current balance. Keep shopping to level up!
                        </div>
                    </div>
                </div>
            )}

            {/* Gift Cards Section */}
            <div style={card}>
                <h3 style={{ marginTop: 0 }}>🎁 Gift Cards</h3>
                {giftCardEligibility && (
                    <div style={{ marginBottom: 16, padding: 12, background: giftCardEligibility.isEligible ? "#f0fdf4" : "#fef3c7", borderRadius: 8, border: `1px solid ${giftCardEligibility.isEligible ? "#bbf7d0" : "#fcd34d"}` }}>
                        {giftCardEligibility.isEligible ? (
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#166534" }}>
                                    ✓ You're eligible for gift cards!
                                </p>
                                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#15803d" }}>
                                    Minimum {giftCardEligibility.minimumRequired} Loops required. Exchange rate: 100 Loops = $1 gift card.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#92400e" }}>
                                    ⚠️ Not eligible yet
                                </p>
                                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78350f" }}>
                                    You need {giftCardEligibility.pointsNeeded} more Loops. Minimum {giftCardEligibility.minimumRequired} Loops required for gift cards.
                                </p>
                            </div>
                        )}
                    </div>
                )}
                
                {giftCards.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <h4 style={{ fontSize: 14, marginBottom: 8 }}>My Gift Cards</h4>
                        {giftCards.map((card) => {
                            const isPhysical = card.card_type === 'physical';
                            const isIssued = isPhysical && card.issued_at;
                            const isPending = isPhysical && !card.issued_at;
                            
                            return (
                            <div key={card.id} style={{ marginBottom: 12, padding: 12, background: isPending ? "#fef3c7" : "#f9fafb", borderRadius: 8, border: `1px solid ${isPending ? "#fcd34d" : "#e5e7eb"}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Gift Card #{card.code}</p>
                                            <span style={{ 
                                                fontSize: 10, 
                                                padding: "2px 6px", 
                                                borderRadius: 4, 
                                                background: isPhysical ? (isIssued ? "#dbeafe" : "#fef3c7") : "#e0e7ff",
                                                color: isPhysical ? (isIssued ? "#1e40af" : "#92400e") : "#4338ca",
                                                fontWeight: 600
                                            }}>
                                                {isPhysical ? (isIssued ? "📦 PHYSICAL (Issued)" : "⏳ PHYSICAL (Pending)") : "💳 DIGITAL"}
                                            </span>
                                        </div>
                                        <p style={{ margin: "4px 0", fontSize: 16, fontWeight: 700, color: "#2563eb" }}>
                                            ${card.current_balance.toFixed(2)}
                                        </p>
                                        <p style={{ margin: "4px 0 0 0", fontSize: 11, color: card.isExpired ? "#dc2626" : card.daysRemaining < 30 ? "#f59e0b" : "#6b7280" }}>
                                            {card.isExpired ? "❌ Expired" : `Valid for ${card.daysRemaining} more days`}
                                        </p>
                                        {isPending && (
                                            <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                                                ⚠️ Visit the store to pick up your physical card
                                            </p>
                                        )}
                                    </div>
                                    {!isPhysical && (
                                        <QRCodeCanvas 
                                            value={`GIFT-CARD:${card.code}`}
                                            size={80}
                                        />
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    <button
                                        style={{ ...button, flex: 1, fontSize: 11, padding: "6px 12px", background: "#2563eb" }}
                                        onClick={() => {
                                            setSelectedGiftCard(card);
                                            setShowGiftCardModal(true);
                                        }}
                                    >
                                        View Details
                                    </button>
                                    <button
                                        style={{ ...button, flex: 1, fontSize: 11, padding: "6px 12px", background: "#059669" }}
                                        onClick={async () => {
                                            try {
                                                const amount = prompt(`Enter amount to add (in dollars, e.g., 10 for $10):`);
                                                if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                                                    return;
                                                }
                                                
                                                setGiftCardLoading(true);
                                                const loopsNeeded = Math.floor(parseFloat(amount) * 100);
                                                
                                                if (user.loops_balance < loopsNeeded) {
                                                    alert(`Insufficient Loops. You need ${loopsNeeded} Loops for $${amount} top-up.`);
                                                    setGiftCardLoading(false);
                                                    return;
                                                }
                                                
                                                const result = await topUpGiftCard(token, card.id, parseFloat(amount), 'points', loopsNeeded, null);
                                                alert(result.message);
                                                
                                                // Refresh data
                                                const data = await fetchUserMe({ token, period, storeId });
                                                setUser(data.user);
                                                
                                                getGiftCards(token)
                                                    .then((data) => {
                                                        setGiftCards(data.giftCards || []);
                                                    });
                                            } catch (e) {
                                                alert("Error topping up: " + e.message);
                                            } finally {
                                                setGiftCardLoading(false);
                                            }
                                        }}
                                        disabled={giftCardLoading || card.isExpired}
                                    >
                                        Top Up
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
                
                <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <button
                        style={{ ...button, width: "100%", background: giftCardEligibility?.isEligible ? "#2563eb" : "#9ca3af", cursor: giftCardEligibility?.isEligible ? "pointer" : "not-allowed" }}
                        onClick={async () => {
                            if (!giftCardEligibility?.isEligible) {
                                alert(`You need ${giftCardEligibility?.pointsNeeded} more Loops. Minimum ${giftCardEligibility?.minimumRequired} Loops required.`);
                                return;
                            }
                            
                            const amount = prompt(`Enter Loops to redeem (minimum ${giftCardEligibility?.minimumRequired}):`);
                            if (!amount || isNaN(amount) || parseInt(amount) < giftCardEligibility?.minimumRequired) {
                                if (amount) {
                                    alert(`Minimum ${giftCardEligibility?.minimumRequired} Loops required for gift card.`);
                                }
                                return;
                            }
                            
                            const loopsAmount = parseInt(amount);
                            const giftCardValue = loopsAmount / 100; // 100 Loops = $1
                            
                            if (user.loops_balance < loopsAmount) {
                                alert(`Insufficient Loops. You have ${user.loops_balance}, need ${loopsAmount}.`);
                                return;
                            }
                            
                            // Ask user to choose card type
                            const cardTypeChoice = confirm(`Choose gift card type:\n\nOK = Digital Gift Card (QR code in app)\nCancel = Physical Gift Card (pick up at store)`);
                            const cardType = cardTypeChoice ? 'digital' : 'physical';
                            const cardTypeLabel = cardType === 'digital' ? 'Digital' : 'Physical';
                            
                            if (!confirm(`Create ${cardTypeLabel} gift card worth $${giftCardValue.toFixed(2)} using ${loopsAmount} Loops?${cardType === 'physical' ? '\n\nYou will need to visit the store to pick up your physical card.' : ' Valid for 90 days.'}`)) {
                                return;
                            }
                            
                            try {
                                setGiftCardLoading(true);
                                setGiftCardError("");
                                setGiftCardSuccess("");
                                
                                const result = await createGiftCard(token, loopsAmount, null, cardType);
                                alert(result.message);
                                setGiftCardSuccess(result.message);
                                
                                // Refresh data
                                const data = await fetchUserMe({ token, period, storeId });
                                setUser(data.user);
                                
                                getGiftCards(token)
                                    .then((data) => {
                                        setGiftCards(data.giftCards || []);
                                    });
                                
                                checkGiftCardEligibility(token)
                                    .then((data) => {
                                        setGiftCardEligibility(data);
                                    });
                            } catch (e) {
                                setGiftCardError(e.message);
                                alert("Error creating gift card: " + e.message);
                            } finally {
                                setGiftCardLoading(false);
                            }
                        }}
                        disabled={!giftCardEligibility?.isEligible || giftCardLoading}
                    >
                        {giftCardLoading ? "Creating..." : giftCardEligibility?.isEligible ? "🎁 Create Gift Card (Choose Type)" : `Need ${giftCardEligibility?.pointsNeeded || 0} More Loops`}
                    </button>
                </div>
                {giftCardError && <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>{giftCardError}</p>}
                {giftCardSuccess && <p style={{ color: "green", fontSize: 13, marginTop: 8 }}>{giftCardSuccess}</p>}
            </div>

            {/* Redemption Card (Legacy - keep for backward compatibility) */}
            <div style={card}>
                <h3 style={{ marginTop: 0 }}>Redeem Loops (Direct)</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <input
                        style={input}
                        type="number"
                        placeholder="Amount to redeem"
                        value={redeemAmount}
                        onChange={(e) => {
                            setRedeemAmount(e.target.value);
                            setRedeemErr("");
                            setRedeemSuccess("");
                        }}
                        min="1"
                        max={user.loops_balance}
                    />
                    <button
                        style={button}
                        onClick={handleRedeem}
                        disabled={redeemLoading || !redeemAmount}
                    >
                        {redeemLoading ? "Processing..." : "Redeem"}
                    </button>
                </div>
                {redeemErr && <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>{redeemErr}</p>}
                {redeemSuccess && <p style={{ color: "green", fontSize: 13, marginTop: 8 }}>{redeemSuccess}</p>}
            </div>

            {/* Transaction History */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 0 }}>Transaction History</h3>
                    {transactions.length > 0 && (
                        <div style={{ fontSize: 13, color: "#6b7280" }}>
                            {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
                        </div>
                    )}
                </div>
                
                {/* Filters */}
                <div style={filtersContainer}>
                    <div style={filterGroup}>
                        <label style={filterLabel}>
                            <span style={{ marginRight: 8 }}>📅</span>
                            Period:
                        </label>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(Number(e.target.value))}
                            style={selectStyle}
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>
                    
                    <div style={filterGroup}>
                        <label style={filterLabel}>
                            <span style={{ marginRight: 8 }}>🏪</span>
                            Store:
                        </label>
                        <select
                            value={storeId}
                            onChange={(e) => setStoreId(e.target.value)}
                            style={selectStyle}
                        >
                            <option value="all">All stores</option>
                            {stores.length > 0 ? (
                                stores.map((s) => (
                                    <option key={s.id} value={String(s.id)}>
                                        {s.name} {s.category ? `(${s.category})` : ''}
                                    </option>
                                ))
                            ) : (
                                <option disabled>Loading stores...</option>
                            )}
                        </select>
                    </div>
                </div>

                {/* Transaction Table */}
                {loading ? (
                    <div style={loadingContainer}>
                        <div style={spinner}></div>
                        <p style={{ color: "#6b7280", marginTop: 12 }}>Loading transactions...</p>
                    </div>
                ) : transactions.length === 0 ? (
                    <div style={emptyState}>
                        <div style={emptyIcon}>📋</div>
                        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>
                            No transactions found for the selected filters.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                        <table style={table}>
                            <thead>
                                <tr style={{ backgroundColor: "#f9fafb" }}>
                                    <th style={th}>Date & Time</th>
                                    <th style={th}>Type</th>
                                    <th style={th}>Store/Description</th>
                                    <th style={{ ...th, textAlign: "right" }}>Amount</th>
                                    <th style={{ ...th, textAlign: "right" }}>Loops</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, idx) => (
                                    <tr 
                                        key={tx.id} 
                                        style={{ 
                                            backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fafafa",
                                            transition: "background-color 0.2s",
                                            cursor: "default"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f0f9ff"}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#fafafa"}
                                    >
                                        <td style={td}>
                                            <div style={{ fontWeight: 500, color: "#111827" }}>
                                                {tx.created_at && !isNaN(Date.parse(tx.created_at))
                                                    ? new Date(tx.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })
                                                    : "—"}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                                                {tx.created_at && !isNaN(Date.parse(tx.created_at))
                                                    ? new Date(tx.created_at).toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })
                                                    : ""}
                                            </div>
                                        </td>
                                        <td style={td}>
                                            <div style={{ 
                                                display: "inline-block",
                                                padding: "4px 8px",
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: tx.transaction_type === 'EARN' ? "#dbeafe" : "#fee2e2",
                                                color: tx.transaction_type === 'EARN' ? "#1e40af" : "#991b1b"
                                            }}>
                                                {tx.transaction_type === 'EARN' ? '💚 EARNED' : '🔴 REDEEMED'}
                                            </div>
                                            {tx.redeem_type && (
                                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                                                    {tx.redeem_type}
                                                </div>
                                            )}
                                        </td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 500, color: "#374151" }}>
                                                {tx.store_name || "—"}
                                            </div>
                                        </td>
                                        <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#111827" }}>
                                            {tx.amount_cents && tx.amount_cents > 0 ? `$${(tx.amount_cents / 100).toFixed(2)}` : "—"}
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            <span style={{
                                                ...loopsBadge,
                                                background: tx.transaction_type === 'EARN' ? "#10b981" : "#ef4444",
                                                color: "#fff"
                                            }}>
                                                {tx.transaction_type === 'EARN' ? '+' : '-'}{tx.loops_earned || 0}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
                </>
            )}

            {activeTab === "analytics" && user && (
                <AnalyticsDashboard
                    token={token}
                    userRole="user"
                    userId={user.id}
                />
            )}

            {activeTab === "settings" && user && (
                <Settings
                    token={token}
                    user={user}
                    onProfileUpdate={(updatedUser) => {
                        setUser(updatedUser);
                    }}
                />
            )}

            {/* Location Prompt */}
            {showLocationPrompt && (
                <LocationPrompt
                    token={token}
                    onLocationSet={() => {
                        setShowLocationPrompt(false);
                        // Refresh user data
                        fetchUserMe({ token, period, storeId })
                            .then((data) => {
                                setUser(data.user);
                                setTransactions(data.transactions || []);
                            })
                            .catch((e) => setErr(e.message));
                    }}
                />
            )}

            {/* QR Scanner */}
            {showQRScanner && (
                <QRScanner
                    title="Scan Store QR Code"
                    onScan={async (qrCode) => {
                        // Close scanner immediately to prevent re-rendering
                        setShowQRScanner(false);
                        try {
                            // Get current location for CIV
                            let latitude = null;
                            let longitude = null;
                            
                            if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                    (position) => {
                                        latitude = position.coords.latitude;
                                        longitude = position.coords.longitude;
                                    },
                                    (error) => {
                                        console.warn("Location access denied:", error);
                                    },
                                    { timeout: 5000 }
                                );
                            }
                            
                            const result = await checkIn(token, qrCode, latitude, longitude);
                            
                            if (result.success) {
                                setActiveSession({
                                    sessionId: result.sessionId,
                                    store: result.store,
                                    loopsPending: result.loopsPending,
                                    expiresAt: result.expiresAt
                                });
                                setScannedStore(result.store);
                                
                                // Start location tracking for CIV
                                if (navigator.geolocation && result.sessionId) {
                                    const watchId = navigator.geolocation.watchPosition(
                                        (position) => {
                                            updateCheckInLocation(
                                                token,
                                                result.sessionId,
                                                position.coords.latitude,
                                                position.coords.longitude,
                                                position.coords.accuracy
                                            ).catch((e) => console.error("Failed to update location:", e));
                                        },
                                        (error) => console.warn("Location tracking error:", error),
                                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
                                    );
                                    setLocationWatchId(watchId);
                                }
                                
                                // Refresh pending points
                                getPendingPoints(token)
                                    .then((data) => {
                                        setPendingPoints(data.pendingPoints || []);
                                    })
                                    .catch((e) => console.error("Failed to load pending points:", e));
                            }
                        } catch (e) {
                            alert("Error checking in: " + e.message);
                        }
                    }}
                    onClose={() => {
                        setShowQRScanner(false);
                    }}
                />
            )}

            {/* Check-In Success Modal */}
            {activeSession && (
                <div style={modalOverlay} onClick={() => {
                    setActiveSession(null);
                    setScannedStore(null);
                }}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>✓ Checked In!</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => {
                                    setActiveSession(null);
                                    setScannedStore(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={modalBody}>
                            <p style={{ margin: "8px 0", fontSize: 18, fontWeight: 600, color: "#059669" }}>
                                {activeSession.store.name}
                            </p>
                            <div style={{ marginTop: 16, padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                                <p style={{ margin: "4px 0", fontSize: 14, color: "#166534" }}>
                                    🎉 {activeSession.loopsPending} Loops (unlocking...)
                                </p>
                                <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#15803d" }}>
                                    Points will unlock when you return or engage with the store!
                                </p>
                            </div>
                            <p style={{ margin: "16px 0 8px 0", fontSize: 14, color: "#6b7280" }}>
                                Session expires in: {Math.floor((new Date(activeSession.expiresAt) - new Date()) / 1000 / 60)} minutes
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                style={{ ...modalButton, flex: 1, background: "#2563eb" }}
                                onClick={async () => {
                                    try {
                                        const result = await completeCheckIn(token, activeSession.sessionId);
                                        alert(`Session completed! CIV score: ${Math.round((result.civScore || 0.5) * 100)}%. Points will unlock when you return to ${activeSession.store.name}.`);
                                        
                                        // Stop location tracking
                                        if (locationWatchId !== null) {
                                            navigator.geolocation.clearWatch(locationWatchId);
                                            setLocationWatchId(null);
                                        }
                                        
                                        setActiveSession(null);
                                        setScannedStore(null);
                                        
                                        // Refresh pending points and user data
                                        getPendingPoints(token)
                                            .then((data) => {
                                                setPendingPoints(data.pendingPoints || []);
                                            })
                                            .catch((e) => console.error("Failed to load pending points:", e));
                                        
                                        // Refresh user data to see updated balance
                                        fetchUserMe({ token, period, storeId })
                                            .then((data) => {
                                                setUser(data.user);
                                                setTransactions(data.transactions || []);
                                            })
                                            .catch((e) => console.error("Failed to refresh user data:", e));
                                        
                                        // Check for settlement triggers (return visit, etc.)
                                        if (activeSession && activeSession.store) {
                                            checkSettlement(token, activeSession.store.id)
                                                .then(() => {
                                                    // Refresh again after settlement check
                                                    setTimeout(() => {
                                                        getPendingPoints(token)
                                                            .then((data) => {
                                                                setPendingPoints(data.pendingPoints || []);
                                                            });
                                                        fetchUserMe({ token, period, storeId })
                                                            .then((data) => {
                                                                setUser(data.user);
                                                            });
                                                    }, 1000);
                                                })
                                                .catch((e) => console.error("Settlement check failed:", e));
                                        }
                                    } catch (e) {
                                        alert("Error completing session: " + e.message);
                                    }
                                }}
                            >
                                Complete Visit
                            </button>
                            <button
                                style={{ ...modalButton, flex: 1 }}
                                onClick={() => {
                                    setActiveSession(null);
                                    setScannedStore(null);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Gift Card Details Modal */}
            {showGiftCardModal && selectedGiftCard && (
                <div style={modalOverlay} onClick={() => {
                    setShowGiftCardModal(false);
                    setSelectedGiftCard(null);
                }}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>🎁 Gift Card Details</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => {
                                    setShowGiftCardModal(false);
                                    setSelectedGiftCard(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={modalBody}>
                            <div style={{ textAlign: "center", marginBottom: 20 }}>
                                <QRCodeCanvas 
                                    value={`GIFT-CARD:${selectedGiftCard.code}`}
                                    size={200}
                                />
                                <p style={{ margin: "12px 0 4px 0", fontSize: 14, fontWeight: 600 }}>
                                    Code: {selectedGiftCard.code}
                                </p>
                                <p style={{ margin: "4px 0", fontSize: 24, fontWeight: 700, color: "#2563eb" }}>
                                    ${selectedGiftCard.current_balance.toFixed(2)}
                                </p>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ margin: "8px 0", fontSize: 13, color: "#6b7280" }}>
                                    <strong>Original Value:</strong> ${selectedGiftCard.original_value.toFixed(2)}
                                </p>
                                <p style={{ margin: "8px 0", fontSize: 13, color: "#6b7280" }}>
                                    <strong>Current Balance:</strong> ${selectedGiftCard.current_balance.toFixed(2)}
                                </p>
                                <p style={{ margin: "8px 0", fontSize: 13, color: selectedGiftCard.isExpired ? "#dc2626" : selectedGiftCard.daysRemaining < 30 ? "#f59e0b" : "#6b7280" }}>
                                    <strong>Status:</strong> {selectedGiftCard.status.toUpperCase()}
                                </p>
                                <p style={{ margin: "8px 0", fontSize: 13, color: "#6b7280" }}>
                                    <strong>Expires:</strong> {new Date(selectedGiftCard.expires_at).toLocaleDateString()} ({selectedGiftCard.daysRemaining} days left)
                                </p>
                                {selectedGiftCard.loops_used && (
                                    <p style={{ margin: "8px 0", fontSize: 13, color: "#6b7280" }}>
                                        <strong>Points Used:</strong> {selectedGiftCard.loops_used} Loops
                                    </p>
                                )}
                            </div>
                            <div style={{ padding: 12, background: "#f9fafb", borderRadius: 8, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                                    💡 Show this QR code at checkout to use your gift card!
                                </p>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                style={{ ...modalButton, flex: 1 }}
                                onClick={() => {
                                    setShowGiftCardModal(false);
                                    setSelectedGiftCard(null);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanned Store Modal (fallback for legacy) */}
            {scannedStore && !activeSession && (
                <div style={modalOverlay} onClick={() => setScannedStore(null)}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>Store Found</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => setScannedStore(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={modalBody}>
                            <p style={{ margin: "8px 0", fontSize: 16, fontWeight: 500 }}>
                                {scannedStore.name}
                            </p>
                            {scannedStore.phone && (
                                <p style={{ margin: "4px 0", fontSize: 14, color: "#6b7280" }}>
                                    Phone: {scannedStore.phone}
                                </p>
                            )}
                            {scannedStore.category && (
                                <p style={{ margin: "4px 0", fontSize: 14, color: "#6b7280" }}>
                                    Category: {scannedStore.category}
                                </p>
                            )}
                        </div>
                        <button
                            style={modalButton}
                            onClick={() => setScannedStore(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const card = {
    border: "1px solid #e5e7eb",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    maxWidth: 800,
};

const infoText = {
    margin: "6px 0",
    fontSize: 14,
    color: "#374151",
};

const input = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
    minWidth: 150,
    flex: 1,
};

const button = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const table = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
};

const th = {
    textAlign: "left",
    padding: "14px 16px",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 600,
    color: "#374151",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

const td = {
    padding: "14px 16px",
    borderBottom: "1px solid #f3f4f6",
    color: "#6b7280",
    verticalAlign: "top",
};

const tabBar = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
    alignItems: "center",
  };

const modalOverlay = {
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

const modalContent = {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
    width: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    cursor: "default",
};

const modalCloseButton = {
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

const modalBody = {
    marginBottom: 20,
};

const modalButton = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const tabButton = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
  };
  
const tabButtonActive = {
    ...tabButton,
    background: "#111827",
    color: "#fff",
    border: "1px solid #111827",
};

const tabsContainer = {
    display: "flex",
    gap: 8,
    borderBottom: "2px solid #e5e7eb",
    marginBottom: 16,
};

const tabButton2 = {
    padding: "12px 24px",
    border: "none",
    borderBottom: "2px solid transparent",
    backgroundColor: "transparent",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
    marginBottom: -2,
};

const filtersContainer = {
    display: "flex",
    gap: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    flexWrap: "wrap",
};

const filterGroup = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 200,
};

const filterLabel = {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
};

const selectStyle = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
    cursor: "pointer",
    transition: "all 0.2s",
    flex: 1,
    minWidth: 150,
};

const loadingContainer = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
};

const spinner = {
    width: 40,
    height: 40,
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
};

const emptyState = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    textAlign: "center",
};

const emptyIcon = {
    fontSize: 48,
    opacity: 0.5,
};

const loopsBadge = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 12,
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontWeight: 600,
    fontSize: 13,
};
