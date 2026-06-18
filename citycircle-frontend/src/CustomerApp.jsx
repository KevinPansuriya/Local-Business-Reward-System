// src/CustomerApp.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { fetchUserMe, redeemLoops, fetchStoresList, scanStoreQR, checkIn, updateCheckInLocation, completeCheckIn, getPendingPoints, checkGiftCardEligibility, createGiftCard, getGiftCards, getGiftCardDetails, topUpGiftCard, getPlanTier, updateUserPlan, fetchNearbyEligibleStores, fetchUserFeed, likeContent, unlikeContent, fetchCategories, fetchStoreProfile, fetchNotifications, markNotificationRead, markAllNotificationsRead, fetchContentDetails, enrollStore, submitStoreRequest } from "./api";
import io from "socket.io-client";
import StoreMapView from "./StoreMapView";
import { QRCodeCanvas } from "qrcode.react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import LocationPrompt from "./LocationPrompt";
import QRScanner from "./QRScanner";
import Settings from "./Settings";
import { FaCalendarAlt, FaStore } from 'react-icons/fa';

export default function CustomerApp({ token, onLogout }) {
    const getTierFromTotalLoops = (totalLoops) => {
        const total = Number(totalLoops || 0);
        if (total >= 15000) return "DIAMOND";
        if (total >= 6000) return "PLATINUM";
        if (total >= 2000) return "GOLD";
        if (total >= 500) return "SILVER";
        return "BRONZE";
    };

    const getStored = (key) => (typeof window !== "undefined" ? window.localStorage.getItem(key) : null);
    const validTabs = new Set(["home", "feed", "nearby", "wallet", "analytics", "settings"]);
    const getInitialTab = () => {
        const stored = getStored("cc_customer_active_tab");
        return validTabs.has(stored) ? stored : "home";
    };
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [period, setPeriod] = useState(30); // default = last 30 days
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [redeemAmount, setRedeemAmount] = useState("");
    const [redeemLoading, setRedeemLoading] = useState(false);
    const [redeemErr, setRedeemErr] = useState("");
    const [redeemSuccess, setRedeemSuccess] = useState("");
    const [activeTab, setActiveTab] = useState(getInitialTab);
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
    const [planUpgradeLoading, setPlanUpgradeLoading] = useState(false);
    const [planUpgradeMessage, setPlanUpgradeMessage] = useState("");
    const [pricingMode, setPricingMode] = useState("monthly");
    const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
    const [upgradePlanTarget, setUpgradePlanTarget] = useState(null);
    const [nearbyStores, setNearbyStores] = useState([]);
    const [locationRefreshKey, setLocationRefreshKey] = useState(0);
    const [nearbyLimit, setNearbyLimit] = useState(0);
    const [nearbyActiveIds, setNearbyActiveIds] = useState([]);
    const [nearbyUnlockedIds, setNearbyUnlockedIds] = useState([]);
    const [nearbyLoading, setNearbyLoading] = useState(false);
    const [nearbyError, setNearbyError] = useState("");
    const [feedItems, setFeedItems] = useState([]);
    const [feedLoading, setFeedLoading] = useState(false);
    const [feedError, setFeedError] = useState("");
    const [feedScope, setFeedScope] = useState("local");
    const [feedCategory, setFeedCategory] = useState("all");
    const [feedCategories, setFeedCategories] = useState(["all"]);
    const [pullToRefresh, setPullToRefresh] = useState({ isPulling: false, pullDistance: 0, isRefreshing: false });
    const feedContainerRef = useRef(null);
    const [storeProfileOpen, setStoreProfileOpen] = useState(false);
    const [storeProfileLoading, setStoreProfileLoading] = useState(false);
    const [storeProfileError, setStoreProfileError] = useState("");
    const [storeProfileData, setStoreProfileData] = useState(null);
    const [storeProfileFilter, setStoreProfileFilter] = useState("all");
    const locationWatchRef = useRef(null);
    const alertShownRef = useRef(false);
    const processingScanRef = useRef(false);
    const userQrRef = useRef(null);
    const [showUserQRZoom, setShowUserQRZoom] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [notificationDetails, setNotificationDetails] = useState(null);
    const [notificationDetailsLoading, setNotificationDetailsLoading] = useState(false);
    const [enrollmentPrompt, setEnrollmentPrompt] = useState(null);
    const [enrolling, setEnrolling] = useState(false);
    const [levelUpBanner, setLevelUpBanner] = useState(null);

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
            .catch((e) => {
                const msg = e.message || "Failed to load user";
                if (msg.toLowerCase().includes("user not found")) {
                    setErr("User not found. Please log in again.");
                    if (onLogout) {
                        onLogout();
                        return;
                    }
                }
                setErr(msg);
            })
            .finally(() => setLoading(false));
        
        // Load pending points
        if (token) {
            getPendingPoints(token)
                .then((data) => {
                    setPendingPoints(data.pendingPoints || []);
                })
            
            // Load gift cards
            getGiftCards(token)
                .then((data) => {
                    setGiftCards(data.giftCards || []);
                })
            
            // Check gift card eligibility
            checkGiftCardEligibility(token, storeId !== "all" ? storeId : null)
                .then((data) => {
                    setGiftCardEligibility(data);
                })
        }
    }, [token, period, storeId]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("cc_customer_active_tab", activeTab);
        }
    }, [activeTab]);

    useEffect(() => {
        if (!token) return;
        getPlanTier(token)
            .then((data) => setPlanTier(data))
            .catch(() => setPlanTier(null));
    }, [token, user?.total_loops_earned]);

    useEffect(() => {
        if (activeTab === "subscriptions") {
            setActiveTab("wallet");
        }
    }, [activeTab]);
    
    useEffect(() => {
        async function loadStores() {
            try {
                const data = await fetchStoresList();
                if (Array.isArray(data)) {
                        setStores(data);
                } else if (Array.isArray(data?.stores)) {
                    setStores(data.stores);
                    } else {
                    setStores([]);
                }
            } catch (e) {
                setStores([]);
            }
        }
        // Only load stores if we have a token (user is logged in)
        if (token) {
            loadStores();
        }
    }, [token]);
    
    // Store location watch ID in ref for reliable cleanup
    useEffect(() => {
        locationWatchRef.current = locationWatchId;
    }, [locationWatchId]);
    
    // Cleanup location tracking when activeSession changes or component unmounts
    useEffect(() => {
        return () => {
            if (locationWatchRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(locationWatchRef.current);
                locationWatchRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!token || !user || (activeTab !== "home" && activeTab !== "wallet")) return;
        if (!user.latitude || !user.longitude) return;

        setNearbyLoading(true);
        setNearbyError("");
        fetchNearbyEligibleStores(token, 1.0, { import: true, maxResults: 50 })
            .then((data) => {
                setNearbyStores((data.yourStores && data.yourStores.length > 0) ? data.yourStores : (data.stores || []));
                setNearbyLimit(data.limit || 0);
                setNearbyActiveIds(data.activeStoreIds || []);
                setNearbyUnlockedIds(data.unlockedStoreIds || []);
            })
            .catch((e) => {
                setNearbyError(e.message || "Failed to load nearby stores");
            })
            .finally(() => setNearbyLoading(false));
    }, [token, user, activeTab]);

    const loadFeed = async (options = {}) => {
        if (!token) return;
        try {
            setFeedLoading(true);
            setFeedError("");
            const scope = options.scope || feedScope;
            const radius = options.radius ?? (scope === "discovery" ? 10 : 5);
            const category = options.category ?? feedCategory;
            const localRadius = scope === "discovery" ? 5 : null;
            const data = await fetchUserFeed(token, { radius, limit: 60, scope, category, localRadius });
            setFeedItems(data.content || []);
        } catch (e) {
            setFeedError(e.message || "Failed to load feed");
        } finally {
            setFeedLoading(false);
        }
    };

    useEffect(() => {
        if (!token || activeTab !== "feed") return;
        loadFeed({ scope: feedScope });
    }, [token, activeTab, feedScope]);

    useEffect(() => {
        setFeedCategory("all");
    }, [feedScope]);

    const loadFeedCategories = async () => {
        try {
            const data = await fetchCategories();
            const list = Array.isArray(data.categories) ? data.categories : [];
            setFeedCategories(["all", ...list]);
        } catch {
            setFeedCategories(["all"]);
        }
    };

    // Load notifications
    const loadNotifications = async () => {
        if (!token) return;
        try {
            setNotificationsLoading(true);
            const data = await fetchNotifications(token, { limit: 50 });
            setNotifications(data.notifications || []);
            setUnreadCount(data.unread_count || 0);
        } catch (e) {
            console.error("Failed to load notifications:", e);
        } finally {
            setNotificationsLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        loadNotifications();
        // Refresh notifications every 30 seconds
        const interval = setInterval(loadNotifications, 30000);
        
        // Set up real-time notifications via Socket.io
        const socketUrl = import.meta.env.VITE_API_URL 
            ? import.meta.env.VITE_API_URL.replace('/api', '')
            : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                ? "http://localhost:4000"
                : "";
        
        let socket = null;
        if (socketUrl && user?.id) {
            socket = io(socketUrl, {
                transports: ['websocket', 'polling']
            });
            
            // Listen for real-time notifications
            socket.on(`notification:${user.id}`, (notification) => {
                console.log("Received real-time notification:", notification);
                // Add notification to the list
                setNotifications((prev) => [notification, ...prev]);
                // Update unread count
                setUnreadCount((prev) => prev + 1);
            });
        }
        
        return () => {
            if (socket) socket.disconnect();
            clearInterval(interval);
        };
    }, [token, user?.id]);

    useEffect(() => {
        if (!token || activeTab !== "feed") return;
        loadFeed({ scope: feedScope, category: feedCategory });
    }, [feedCategory]);

    useEffect(() => {
        if (!token || activeTab !== "feed") return;
        loadFeedCategories();
    }, [token, activeTab]);

    
    // Stop location tracking when modal closes
    useEffect(() => {
        if (!activeSession && locationWatchRef.current !== null) {
            if (navigator.geolocation) {
                navigator.geolocation.clearWatch(locationWatchRef.current);
            }
            locationWatchRef.current = null;
            setLocationWatchId(null);
        }
    }, [activeSession]);

    const handleUpgradeToBasic = async () => {
        if (!token) return;
        setPlanUpgradeLoading(true);
        setPlanUpgradeMessage("");
        try {
            await updateUserPlan(token, "BASIC");
            const data = await getPlanTier(token);
            setPlanTier(data);
            const userData = await fetchUserMe({ token, period, storeId });
            setUser(userData.user);
            setPlanUpgradeMessage("Basic plan activated.");
            setShowUpgradeConfirm(false);
            setUpgradePlanTarget(null);
        } catch (e) {
            setPlanUpgradeMessage(e.message || "Failed to upgrade plan.");
        } finally {
            setPlanUpgradeLoading(false);
        }
    };

    const handleConfirmUpgrade = async () => {
        await handleUpgradeToBasic();
        setShowUpgradeConfirm(false);
    };

    const requestPlanUpgrade = (planName) => {
        setUpgradePlanTarget(planName);
        setShowUpgradeConfirm(true);
        setPlanUpgradeMessage("");
    };

    const closeUpgradeConfirm = () => {
        if (planUpgradeLoading) return;
        setShowUpgradeConfirm(false);
        setUpgradePlanTarget(null);
    };

    const handleRedeem = async () => {
        if (!redeemAmount || isNaN(Number(redeemAmount)) || Number(redeemAmount) <= 0) {
            setRedeemErr("Please enter a valid amount");
            return;
        }

        if (!storeId || storeId === "all") {
            setRedeemErr("Please select a store first. Rewards are now spendable only at the same store you earned from.");
            return;
        }

        const amount = Math.floor(Number(redeemAmount));

        setRedeemLoading(true);
        setRedeemErr("");
        setRedeemSuccess("");

        try {
            const result = await redeemLoops(token, amount, Number(storeId));
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
    if (err) {
        return (
            <div style={card}>
                <p style={{ color: "red" }}>Error: {err}</p>
                {err.toLowerCase().includes("log in again") && onLogout && (
                    <button
                        style={{ ...primaryButton, marginTop: 12 }}
                        onClick={() => onLogout()}
                    >
                        Log out and re-login
                    </button>
                )}
            </div>
        );
    }
    if (!user) return <div style={card}><p>No user data found.</p></div>;

    const qrValue = user.qr_code || `USER:${user.id}`;
    const tier = getTierFromTotalLoops(user.total_loops_earned);

    const tierColors = {
        BRONZE: "#cd7f32",
        SILVER: "#c0c0c0",
        GOLD: "#ffd700",
        PLATINUM: "#e5e4e2",
        DIAMOND: "#60a5fa",
    };

    const pendingUnlockReasons = [
        { title: "Return visit", detail: "Check in again at this store." },
        { title: "Reward redemption", detail: "Redeem a reward at this store." },
        { title: "Another purchase", detail: "Store confirms another purchase." },
    ];

    const pendingByStore = (() => {
        const grouped = new Map();
        for (const p of pendingPoints || []) {
            const pendingAmount = Math.max(0, Number(p.loops_pending || 0) - Number(p.loops_unlocked || 0));
            if (!pendingAmount) continue;
            const sid = Number(p.store_id || 0);
            const key = sid || `pending-${p.id}`;
            const current = grouped.get(key) || {
                store_id: sid || null,
                store_name: p.store_name || "Store",
                pending_loops: 0,
                latest_expiry: p.expires_at || null,
            };
            current.pending_loops += pendingAmount;
            if (!current.latest_expiry || new Date(p.expires_at) > new Date(current.latest_expiry)) {
                current.latest_expiry = p.expires_at;
            }
            grouped.set(key, current);
        }
        return Array.from(grouped.values()).sort((a, b) => b.pending_loops - a.pending_loops);
    })();

    const enrolledGiftCardStores = (nearbyStores || []).filter(
        (s) => nearbyActiveIds.includes(s.id) || nearbyUnlockedIds.includes(s.id)
    );

    const formatDaysRemaining = (expiresAt) => {
        if (!expiresAt) return "N/A";
        const expiresDate = new Date(expiresAt);
        if (Number.isNaN(expiresDate.getTime())) return "N/A";
        const diffMs = expiresDate.getTime() - Date.now();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (days <= 0) return "Expires today";
        return `${days} day${days !== 1 ? "s" : ""} remaining`;
    };

    const downloadQrCanvas = (canvas, filename) => {
        if (!canvas) return;
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const printQrCanvas = (canvas, title) => {
        if (!canvas) return;
        const dataUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "_blank", "width=480,height=640");
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head><title>${title}</title></head>
                <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                    <img src="${dataUrl}" style="width:320px;height:320px;" />
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const stripHtml = (html = "") => String(html || "").replace(/<[^>]+>/g, "");
    const getInitials = (name = "") =>
        String(name || "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "S";
    const getPostedLabel = (timestamp) => {
        if (!timestamp) return "";
        const dt = new Date(timestamp);
        if (isNaN(dt.getTime())) return "";
        const diffMs = Date.now() - dt.getTime();
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const daysText =
            diffDays <= 0 ? "Today" : diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
        return `Posted ${daysText} - ${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    };
    const renderMediaCarousel = (mediaUrls) => {
        if (!mediaUrls || mediaUrls.length === 0) return null;
        return (
            <div
                style={{
                    display: "flex",
                    gap: 12,
                    overflowX: "auto",
                    paddingBottom: 4,
                    scrollSnapType: "x mandatory",
                }}
            >
                {mediaUrls.map((url) => {
                    const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
                    return (
                        <div
                            key={url}
                            style={{
                                minWidth: 320,
                                height: 400,
                                aspectRatio: "4 / 5",
                                scrollSnapAlign: "start",
                                borderRadius: 12,
                                overflow: "hidden",
                                border: "1px solid var(--cc-border)",
                                background: "var(--cc-surface-2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {isVideo ? (
                                <video
                                    src={url}
                                    controls
                                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
                                />
                            ) : (
                                <img
                                    src={url}
                                    alt="Media"
                                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleFeedShare = async (item) => {
        const title = item.store_name || "CityCircle";
        const text =
            item.type === "post"
                ? stripHtml(item.caption)
                : stripHtml(item.description || item.body || "");
        const media = (item.media_urls && item.media_urls[0]) || "";
        try {
            if (navigator.share) {
                await navigator.share({ title, text, url: media });
            } else if (navigator.clipboard) {
                const payload = [title, text, media].filter(Boolean).join("\n");
                await navigator.clipboard.writeText(payload);
            }
        } catch {
            // no-op
        }
    };

    const toggleFeedLike = async (item) => {
        try {
            if (item.liked_by_me) {
                const res = await unlikeContent(token, item.type, item.id);
                setFeedItems((prev) =>
                    prev.map((it) =>
                        it.type === item.type && it.id === item.id
                            ? { ...it, liked_by_me: false, like_count: res.like_count ?? Math.max(0, (it.like_count || 0) - 1) }
                            : it
                    )
                );
            } else {
                const res = await likeContent(token, item.type, item.id);
                setFeedItems((prev) =>
                    prev.map((it) =>
                        it.type === item.type && it.id === item.id
                            ? { ...it, liked_by_me: true, like_count: res.like_count ?? (it.like_count || 0) + 1 }
                            : it
                    )
                );
            }
        } catch {
            // no-op
        }
    };

    const visibleFeedItems =
        feedCategory === "all"
            ? feedItems
            : feedItems.filter(
                (item) =>
                    String(item.store_category || "")
                        .trim()
                        .toLowerCase() === feedCategory.toLowerCase()
            );

    const openStoreProfile = async (storeId) => {
        if (!token || !storeId) return;
        try {
            setStoreProfileLoading(true);
            setStoreProfileError("");
            setStoreProfileOpen(true);
            setStoreProfileData(null);
            setStoreProfileFilter("all");
            const data = await fetchStoreProfile(token, storeId);
            setStoreProfileData(data);
        } catch (e) {
            setStoreProfileError(e.message || "Failed to load store profile");
        } finally {
            setStoreProfileLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Mobile-First Navigation Tabs */}
            <div style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                borderBottom: "2px solid var(--cc-border)",
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
                        borderBottom: activeTab === "home" ? "3px solid var(--cc-primary)" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "home" ? "var(--cc-primary)" : "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: activeTab === "home" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("home")}
                >
                    Home
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "feed" ? "3px solid var(--cc-primary)" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "feed" ? "var(--cc-primary)" : "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: activeTab === "feed" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("feed")}
                >
                    Feed
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "nearby" ? "3px solid var(--cc-primary)" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "nearby" ? "var(--cc-primary)" : "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: activeTab === "nearby" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("nearby")}
                >
                    Nearby
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "wallet" ? "3px solid var(--cc-primary)" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "wallet" ? "var(--cc-primary)" : "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: activeTab === "wallet" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("wallet")}
                >
                    Wallet
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "analytics" ? "3px solid var(--cc-primary)" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "analytics" ? "var(--cc-primary)" : "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: activeTab === "analytics" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("analytics")}
                >
                    Analytics
                </button>
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: activeTab === "settings" ? "3px solid var(--cc-primary)" : "3px solid transparent",
                        background: "transparent",
                        color: activeTab === "settings" ? "var(--cc-primary)" : "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: activeTab === "settings" ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content"
                    }}
                    onClick={() => setActiveTab("settings")}
                >
                    Settings
                </button>
                {/* Notification Bell */}
                <button
                    style={{
                        padding: "12px 20px",
                        borderRadius: "8px 8px 0 0",
                        border: "none",
                        borderBottom: "3px solid transparent",
                        background: "transparent",
                        color: "var(--cc-muted)",
                        fontSize: 15,
                        fontWeight: 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s",
                        minWidth: "fit-content",
                        position: "relative",
                        marginLeft: "auto"
                    }}
                    onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (!showNotifications && unreadCount > 0) {
                            markAllNotificationsRead(token).then(() => {
                                setUnreadCount(0);
                                loadNotifications();
                            });
                        }
                    }}
                >
                    🔔
                    {unreadCount > 0 && (
                        <span
                            style={{
                                position: "absolute",
                                top: 8,
                                right: 12,
                                background: "var(--cc-danger)",
                                color: "white",
                                borderRadius: "50%",
                                width: 18,
                                height: 18,
                                fontSize: 10,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Home Tab - Mobile-First Design */}
            {activeTab === "home" && (
                <>
                    {/* Hero Card with Balance & Address */}
                    <div style={{
                        ...card,
                        background: "var(--cc-surface)",
                        color: "var(--cc-text)",
                        border: "1px solid var(--cc-border)",
                        boxShadow: "var(--cc-shadow-sm)",
                        marginBottom: 16,
                        padding: 24
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 8 }}>Welcome back,</div>
                                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>{user.name}</div>
                                
                                {/* Home Address Display */}
                                {user.address && (
                                    <div style={{
                                        padding: 12,
                                        background: "var(--cc-surface-2)",
                                        borderRadius: "var(--cc-radius-sm)",
                                        marginBottom: 16,
                                        border: "1px solid var(--cc-border)"
                                    }}>
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 4 }}>Home Address</div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>{user.address}</div>
                                    </div>
                                )}
                                
                                <div style={{
                                    padding: 16,
                                    background: "var(--cc-surface-2)",
                                    borderRadius: 12,
                                    border: "1px solid var(--cc-border)"
                                }}>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 8 }}>Available Loops</div>
                                    <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4 }}>{user.loops_balance}</div>
                                    <div style={{ fontSize: 14, color: "var(--cc-muted)" }}>Loops</div>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 8 }}>
                                        Total Loops Earned: {user.total_loops_earned}
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ 
                                    padding: 16, 
                                    background: "var(--cc-surface-2)", 
                                    borderRadius: 12,
                                    border: "1px solid var(--cc-border)",
                                    marginBottom: 12,
                                    cursor: "pointer"
                                }}
                                onClick={() => setShowUserQRZoom(true)}
                                >
                                    <QRCodeCanvas ref={userQrRef} value={qrValue} size={120} />
                                </div>
                                <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                                <button
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: 8,
                                            border: "1px solid var(--cc-border)",
                                            background: "var(--cc-primary)",
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        width: "100%",
                                        transition: "all 0.2s"
                                    }}
                                    onClick={() => setShowQRScanner(true)}
                                >
                                    📷 Scan Store QR
                                </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Loyalty Tier - Always try to load, but don't block if fails */}
                    {planTier ? (
                        <div style={{
                            ...card,
                            background: "var(--cc-surface)",
                            color: "var(--cc-text)",
                            border: "1px solid var(--cc-border)",
                            boxShadow: "var(--cc-shadow-sm)",
                            marginBottom: 16
                        }}>
                            <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 22, fontWeight: 800, color: "var(--cc-text)" }}>
                                Your Loyalty Status
                            </h3>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
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
                                        Current Tier
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

                                {/* Tier Bonus Card */}
                                <div style={{
                                    background: "rgba(255, 255, 255, 0.15)",
                                    backdropFilter: "blur(10px)",
                                    borderRadius: 12,
                                    padding: 16,
                                    border: "1px solid rgba(255, 255, 255, 0.2)"
                                }}>
                                    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                        🚀 Tier Bonus
                                    </div>
                                    <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, color: "var(--cc-warning)", textShadow: "0 2px 10px rgba(255, 215, 0, 0.5)" }}>
                                        {planTier.tierMultiplier}x
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
                                        Based on your total Loops earned
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
                                                Progress to {planTier.nextTier} Tier
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
                                                ? "linear-gradient(90deg, var(--cc-success) 0%, rgba(16, 185, 129, 0.7) 100%)"
                                                : "linear-gradient(90deg, var(--cc-primary) 0%, rgba(37, 99, 235, 0.7) 100%)",
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
                                background: "var(--cc-surface)"
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
                            <div style={{ fontSize: 14, fontWeight: 700 }}>My Wallet</div>
                        </button>
                        <button
                            style={{
                                ...card,
                                padding: 20,
                                textAlign: "center",
                                cursor: "pointer",
                                border: "none",
                                transition: "transform 0.2s, box-shadow 0.2s",
                                background: "var(--cc-surface)"
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
                            <div style={{ fontSize: 14, fontWeight: 700 }}>Analytics</div>
                        </button>
                        <button
                            style={{
                                ...card,
                                padding: 20,
                                textAlign: "center",
                                cursor: "pointer",
                                border: "none",
                                transition: "transform 0.2s, box-shadow 0.2s",
                                background: "var(--cc-surface)"
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
                            <div style={{ fontSize: 14, fontWeight: 700 }}>Settings</div>
                        </button>
                    </div>

                </>
            )}

            {levelUpBanner && (
                <div
                    style={{
                        ...card,
                        marginBottom: 16,
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <div style={{ fontSize: 14, color: "var(--cc-success)" }}>
                        <strong>Level up:</strong> {levelUpBanner.fromTier} to {levelUpBanner.toTier}. Total Loops Earned: {levelUpBanner.totalLoopsEarned}
                    </div>
                    <button
                        style={{
                            border: "1px solid var(--cc-border)",
                            background: "var(--cc-surface)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            cursor: "pointer",
                            color: "var(--cc-text)",
                            fontSize: 12,
                            fontWeight: 600,
                        }}
                        onClick={() => setLevelUpBanner(null)}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {activeTab === "feed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ ...card, maxWidth: 1000 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>
                                    {feedScope === "local" ? "Local Feed" : "Discovery Feed"}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                    {feedScope === "local"
                                        ? "Discover updates and offers from stores near you."
                                        : "Explore more business updates within 10 miles."}
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 6,
                                        padding: 4,
                                        borderRadius: 999,
                                        background: "var(--cc-surface-2)",
                                    }}
                                >
                                    <button
                                        style={{
                                            ...button,
                                            fontSize: 12,
                                            padding: "6px 14px",
                                            borderRadius: 999,
                                            background: feedScope === "local" ? "var(--cc-primary)" : "transparent",
                                            color: feedScope === "local" ? "#fff" : "var(--cc-text)",
                                        }}
                                        onClick={() => setFeedScope("local")}
                                    >
                                        Local
                                    </button>
                                    <button
                                        style={{
                                            ...button,
                                            fontSize: 12,
                                            padding: "6px 14px",
                                            borderRadius: 999,
                                            background: feedScope === "discovery" ? "var(--cc-primary)" : "transparent",
                                            color: feedScope === "discovery" ? "#fff" : "var(--cc-text)",
                                        }}
                                        onClick={() => setFeedScope("discovery")}
                                    >
                                        Discovery
                                    </button>
                                </div>
                                <select
                                    value={feedCategory}
                                    onChange={(e) => setFeedCategory(e.target.value)}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 10,
                                        border: "1px solid var(--cc-border)",
                                        background: "var(--cc-surface)",
                                        color: "var(--cc-text)",
                                        fontSize: 12,
                                    }}
                                >
                                    {feedCategories.map((category) => (
                                        <option key={category} value={category}>
                                            {category === "all" ? "All categories" : category}
                                        </option>
                                    ))}
                                </select>
                                <button style={{ ...button, fontSize: 12 }} onClick={() => loadFeed({ scope: feedScope })}>
                                    Refresh
                                </button>
                            </div>
                        </div>
                        {feedError && (
                            <div style={{ marginTop: 10, fontSize: 12, color: "var(--cc-danger)" }}>
                                {feedError}
                            </div>
                        )}
                        {storeProfileError && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "var(--cc-danger)" }}>
                                {storeProfileError}
                            </div>
                        )}
                    </div>
                    {feedLoading && !pullToRefresh.isRefreshing ? (
                        <div style={{ ...card, maxWidth: 1000 }}>Loading feed...</div>
                    ) : visibleFeedItems.length === 0 ? (
                        <div style={{ ...card, maxWidth: 1000, color: "var(--cc-muted)" }}>
                            No feeds found. Check later.
                        </div>
                    ) : (
                        <div
                            ref={feedContainerRef}
                            style={{
                                display: "grid",
                                gap: 16,
                                maxWidth: 1000,
                                position: "relative",
                                transform: pullToRefresh.isPulling ? `translateY(${Math.min(pullToRefresh.pullDistance, 80)}px)` : "translateY(0)",
                                transition: pullToRefresh.isPulling ? "none" : "transform 0.3s ease-out",
                            }}
                            onTouchStart={(e) => {
                                if (feedLoading || pullToRefresh.isRefreshing) return;
                                
                                // Only allow pull-to-refresh if at the top of the page
                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                if (scrollTop <= 5) {
                                    const touch = e.touches[0];
                                    if (touch) {
                                        setPullToRefresh({
                                            isPulling: true,
                                            pullDistance: 0,
                                            startY: touch.clientY,
                                            isRefreshing: false,
                                        });
                                    }
                                }
                            }}
                            onTouchMove={(e) => {
                                if (!pullToRefresh.isPulling || feedLoading || pullToRefresh.isRefreshing) return;
                                const touch = e.touches[0];
                                if (touch && pullToRefresh.startY !== undefined) {
                                    const pullDistance = Math.max(0, touch.clientY - pullToRefresh.startY);
                                    setPullToRefresh((prev) => ({
                                        ...prev,
                                        pullDistance,
                                    }));
                                    
                                    // Prevent default scrolling when pulling down
                                    if (pullDistance > 10) {
                                        e.preventDefault();
                                    }
                                }
                            }}
                            onTouchEnd={() => {
                                if (!pullToRefresh.isPulling || feedLoading || pullToRefresh.isRefreshing) return;
                                
                                const threshold = 60;
                                if (pullToRefresh.pullDistance >= threshold) {
                                    // Trigger refresh
                                    setPullToRefresh((prev) => ({ ...prev, isRefreshing: true }));
                                    loadFeed({ scope: feedScope }).finally(() => {
                                        setPullToRefresh({ isPulling: false, pullDistance: 0, isRefreshing: false });
                                    });
                                } else {
                                    // Reset without refreshing
                                    setPullToRefresh({ isPulling: false, pullDistance: 0, isRefreshing: false });
                                }
                            }}
                        >
                            {/* Pull to refresh indicator */}
                            {pullToRefresh.isPulling && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: -60,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "100%",
                                        height: 60,
                                        color: "var(--cc-primary)",
                                        fontSize: 14,
                                        fontWeight: 600,
                                    }}
                                >
                                    {pullToRefresh.pullDistance >= 60 ? (
                                        <span>Release to refresh</span>
                                    ) : (
                                        <span>Pull down to refresh</span>
                                    )}
                                </div>
                            )}
                            {pullToRefresh.isRefreshing && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: -60,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "100%",
                                        height: 60,
                                        color: "var(--cc-primary)",
                                        fontSize: 14,
                                        fontWeight: 600,
                                    }}
                                >
                                    Refreshing...
                                </div>
                            )}
                            {visibleFeedItems.map((item) => {
                                const mediaUrls = item.media_urls || [];
                                return (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        style={{
                                            border: "1px solid var(--cc-border)",
                                            borderRadius: 14,
                                            background: "var(--cc-surface)",
                                            padding: 16,
                                            boxShadow: "var(--cc-shadow-sm)",
                                            display: "grid",
                                            gap: 10,
                                        }}
                                    >
                                        <div style={{ display: "grid", gap: 12 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                                    <div
                                                        style={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: "50%",
                                                            background: "var(--cc-surface-2)",
                                                            border: "1px solid var(--cc-border)",
                                                            overflow: "hidden",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontWeight: 700,
                                                            color: "var(--cc-primary)",
                                                        }}
                                                    >
                                                        {item.store_profile_image_url ? (
                                                            <img
                                                                src={item.store_profile_image_url}
                                                                alt="Store"
                                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                            />
                                                        ) : (
                                                            getInitials(item.store_name)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <button
                                                            style={{
                                                                padding: 0,
                                                                border: "none",
                                                                background: "transparent",
                                                                color: "var(--cc-text)",
                                                                fontSize: 14,
                                                                fontWeight: 700,
                                                                cursor: "pointer",
                                                                textAlign: "left",
                                                            }}
                                                            onClick={() => openStoreProfile(item.store_id)}
                                                        >
                                                            {item.store_name}
                                                        </button>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>
                                                            {item.store_category || "Local business"}
                                                            {typeof item.distance_miles === "number" && (
                                                                <> · {item.distance_miles.toFixed(1)} mi</>
                                                            )}
                                                        </div>
                                                        {item.created_at && (
                                                            <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>
                                                                {getPostedLabel(item.created_at)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: "var(--cc-primary)",
                                                        background: "rgba(37, 99, 235, 0.1)",
                                                        padding: "4px 8px",
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    {item.type.toUpperCase()}
                                                </span>
                                            </div>
                                            {item.type !== "post" && item.title && (
                                                <div style={{ fontSize: 15, fontWeight: 700 }}>{item.title}</div>
                                            )}
                                            {item.type === "post" && item.caption && (
                                                <div dangerouslySetInnerHTML={{ __html: item.caption }} />
                                            )}
                                            {item.type === "promotion" && item.description && (
                                                <div dangerouslySetInnerHTML={{ __html: item.description }} />
                                            )}
                                            {item.type === "update" && item.body && (
                                                <div dangerouslySetInnerHTML={{ __html: item.body }} />
                                            )}
                                            {renderMediaCarousel(mediaUrls)}
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <button
                                                    style={{
                                                        ...button,
                                                        background: item.liked_by_me ? "var(--cc-primary)" : "var(--cc-surface-2)",
                                                        color: item.liked_by_me ? "#fff" : "var(--cc-text)",
                                                        padding: "6px 12px",
                                                    }}
                                                    onClick={() => toggleFeedLike(item)}
                                                >
                                                    ❤️ {item.like_count || 0}
                                                </button>
                                                <button
                                                    style={{
                                                        ...button,
                                                        background: "var(--cc-surface-2)",
                                                        color: "var(--cc-text)",
                                                        padding: "6px 12px",
                                                    }}
                                                    onClick={() => handleFeedShare(item)}
                                                >
                                                    Share
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "nearby" && (
                <>
                    <StoreMapView token={token} refreshKey={locationRefreshKey} />
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
                        <div style={{ marginTop: 12, padding: 12, background: "var(--cc-surface-2)", borderRadius: 6 }}>
                            <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--cc-primary)" }}>
                                {user.loops_balance}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Loops Available</div>
                            <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 4 }}>
                                Total Loops Earned: {user.total_loops_earned}
                            </div>
                            {pendingByStore.length > 0 && (
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: 12,
                                        background: "rgba(245, 158, 11, 0.12)",
                                        borderRadius: 6,
                                        border: "1px solid rgba(245, 158, 11, 0.35)",
                                    }}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cc-warning)", marginBottom: 4 }}>
                                        ⏳ {pendingByStore.reduce((sum, p) => sum + p.pending_loops, 0)} Loops Pending
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 8 }}>
                                        Pending loops by store. They auto-unlock when you revisit, redeem, or make another purchase at that same store.
                                    </div>
                                    <div style={{ display: "grid", gap: 8 }}>
                                        {pendingByStore.map((p) => (
                                            <div
                                                key={`${p.store_id || p.store_name}`}
                                                style={{
                                                    marginBottom: 2,
                                                    padding: "8px",
                                                    background: "rgba(245, 158, 11, 0.08)",
                                                    borderRadius: "6px",
                                                    border: "1px solid rgba(245, 158, 11, 0.3)",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                                    <span style={{ fontWeight: 600, fontSize: 12 }}>{p.store_name}</span>
                                                    <span style={{ fontWeight: 700, color: "var(--cc-warning)", fontSize: 12 }}>
                                                        {p.pending_loops} loops
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 10, color: "var(--cc-muted)" }}>
                                                    {formatDaysRemaining(p.latest_expiry)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Membership QR</h3>
            <QRCodeCanvas value={qrValue} size={140} />
                        <p style={{ fontSize: 11, marginTop: 4, color: "var(--cc-muted)" }}>
                            Show at checkout
                        </p>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                                style={{ ...button, flex: 1, fontSize: 12, padding: "6px 12px" }}
                            onClick={() => setShowQRScanner(true)}
                        >
                                📷 QR
                        </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Loyalty Tier Section */}
            {planTier && (
                <div style={{ 
                    ...card, 
                    background: "var(--cc-surface)",
                    color: "var(--cc-text)",
                    border: "1px solid var(--cc-border)",
                    boxShadow: "var(--cc-shadow-sm)",
                    marginBottom: 16
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 22, fontWeight: 800, color: "var(--cc-text)" }}>
                        Your Loyalty Status
                    </h3>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 24 }}>
                        {/* Current Tier Card */}
                        <div style={{ 
                            background: "var(--cc-surface-2)",
                            borderRadius: 12,
                            padding: 16,
                            border: "1px solid var(--cc-border)",
                            borderTop: `3px solid ${tierColors[tier]}`,
                            transition: "transform 0.2s, box-shadow 0.2s",
                            cursor: "pointer",
                            boxShadow: "var(--cc-shadow-sm)"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                            e.currentTarget.style.boxShadow = "var(--cc-shadow-md)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0) scale(1)";
                            e.currentTarget.style.boxShadow = "var(--cc-shadow-sm)";
                        }}
                        >
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                ⭐ Current Tier
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: tierColors[tier] }}>
                                {planTier.currentTier}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 12 }}>
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

                        {/* Tier Bonus Card */}
                        <div style={{ 
                            background: "var(--cc-surface-2)",
                            borderRadius: 12,
                            padding: 16,
                            border: "1px solid var(--cc-border)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            cursor: "pointer",
                            boxShadow: "var(--cc-shadow-sm)"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "var(--cc-shadow-md)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "var(--cc-shadow-sm)";
                        }}
                        >
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                                🚀 Tier Bonus
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, color: "var(--cc-primary)" }}>
                                {planTier.tierMultiplier}x
                            </div>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", lineHeight: 1.5 }}>
                                Based on your total Loops earned
                            </div>
                        </div>
                    </div>

                    {/* Tier Progress Section */}
                    <div style={{ 
                        background: "var(--cc-surface-2)",
                        borderRadius: 12,
                        padding: 20,
                        border: "1px solid var(--cc-border)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                                    {planTier.nextTier ? `Progress to ${planTier.nextTier} Tier` : "Maximum Tier Achieved!"}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.9 }}>
                                    {planTier.totalEarned} / {planTier.nextTierMin || planTier.currentTierMin} Total Loops Earned
                                </div>
                            </div>
                            {planTier.nextTier && (
                                <div style={{ 
                                    background: "var(--cc-surface)",
                                    padding: "8px 16px",
                                    borderRadius: 20,
                                    fontSize: 14,
                                    fontWeight: 700,
                                    border: "1px solid var(--cc-border)"
                                }}>
                                    {planTier.pointsNeeded} more needed
                                </div>
                            )}
                        </div>
                        
                        {/* Animated Progress Bar */}
                        <div style={{ 
                            width: "100%", 
                            height: 32, 
                            background: "var(--cc-surface)", 
                            borderRadius: 16, 
                            overflow: "hidden", 
                            position: "relative",
                            border: "1px solid var(--cc-border)"
                        }}>
                            <div 
                                style={{ 
                                    width: `${planTier.progress}%`, 
                                    height: "100%", 
                                    background: planTier.progress >= 100 
                                        ? "linear-gradient(90deg, var(--cc-success) 0%, rgba(16, 185, 129, 0.7) 100%)" 
                                        : "linear-gradient(90deg, var(--cc-primary) 0%, rgba(37, 99, 235, 0.7) 100%)",
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
                        </div>

                        {planTier.nextTier && (
                            <div style={{ 
                                marginTop: 16, 
                                padding: 12,
                                background: "var(--cc-surface)",
                                borderRadius: 8,
                                fontSize: 13,
                                lineHeight: 1.6,
                                border: "1px solid var(--cc-border)"
                            }}>
                                <strong style={{ color: tierColors[planTier.nextTier] }}>
                                    Next Level:
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
                                Congratulations! You've reached the highest tier! Keep earning to maintain your elite status.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!planTier && (
                <div style={{ 
                    ...card, 
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    marginBottom: 16
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 24 }}>⏳</div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cc-warning)", marginBottom: 4 }}>
                                Loading membership information...
                            </div>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                Please wait while we fetch your loyalty tier details.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tier Overview */}
            {planTier && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
                    <div style={card}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 700, color: "var(--cc-text)" }}>
                            How Tiers Work
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                "Enrollment is free for all customers.",
                                "No subscription or plan upgrade is required.",
                                "Your tier increases with total Loops earned.",
                                "Your spendable balance is your Available Loops."
                            ].map((item) => (
                                <div key={item} style={{ padding: 14, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)", fontSize: 13, color: "var(--cc-text)" }}>
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tiers Overview */}
                    <div style={card}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 700, color: "var(--cc-text)" }}>
                            Loyalty Tiers
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { name: "BRONZE", multiplier: 1.0, min: 0, color: "#cd7f32" },
                                { name: "SILVER", multiplier: 1.05, min: 500, color: "#c0c0c0" },
                                { name: "GOLD", multiplier: 1.1, min: 2000, color: "#ffd700" },
                                { name: "PLATINUM", multiplier: 1.2, min: 6000, color: "#e5e4e2" },
                                { name: "DIAMOND", multiplier: 1.35, min: 15000, color: "#60a5fa" }
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
                                            background: isCurrent ? `linear-gradient(135deg, ${tierData.color}20 0%, ${tierData.color}10 100%)` : "var(--cc-surface-2)",
                                            borderRadius: 8,
                                            border: isCurrent ? `2px solid ${tierData.color}` : "1px solid var(--cc-border)",
                                            transition: "all 0.2s",
                                            cursor: "pointer",
                                            position: "relative",
                                            overflow: "hidden"
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isCurrent) {
                                                e.currentTarget.style.background = "var(--cc-surface-2)";
                                                e.currentTarget.style.transform = "translateX(4px)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isCurrent) {
                                                e.currentTarget.style.background = isUnlocked 
                                                    ? `linear-gradient(135deg, ${tierData.color}10 0%, ${tierData.color}05 100%)`
                                                    : "var(--cc-surface-2)";
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
                                                    color: isCurrent ? tierData.color : (isUnlocked ? "var(--cc-text)" : "var(--cc-muted)"),
                                                    marginBottom: 4,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6
                                                }}>
                                                    {tierData.name}
                                                    {isCurrent && <span style={{ fontSize: 12, color: tierData.color }}>✓</span>}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>
                                                    {tierData.min === 0 ? "Starting tier" : `Earn ${tierData.min}+ total Loops`}
                                                </div>
                                                {!isUnlocked && tierData.min > 0 && (
                                                    <div style={{ 
                                                        width: "100%", 
                                                        height: 6, 
                                                        background: "var(--cc-border)", 
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
                                                color: isCurrent ? tierData.color : (isUnlocked ? "var(--cc-text)" : "var(--cc-muted)")
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
                            background: "rgba(37, 99, 235, 0.08)", 
                            borderRadius: 8, 
                            border: "1px solid rgba(14, 165, 233, 0.3)",
                            fontSize: 12,
                            color: "var(--cc-info)"
                        }}>
                            <strong>Tip:</strong> Your tier is based on your <strong>total Loops earned</strong>, not just your current balance. Keep shopping to level up!
                        </div>
                    </div>
                </div>
            )}

            {/* Gift Cards Section */}
            <div style={card}>
                <h3 style={{ marginTop: 0 }}>🎁 Gift Cards</h3>
                {giftCardEligibility && (
                    <div style={{ marginBottom: 16, padding: 12, background: giftCardEligibility.isEligible ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.12)", borderRadius: 8, border: `1px solid ${giftCardEligibility.isEligible ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.35)"}` }}>
                        {giftCardEligibility.isEligible ? (
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--cc-success)" }}>
                                    ✓ You're eligible for gift cards!
                                </p>
                                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--cc-success)" }}>
                                    Minimum {giftCardEligibility.minimumRequired} Loops required. Exchange rate: 100 Loops = $1 gift card.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--cc-warning)" }}>
                                    ⚠️ Not eligible yet
                                </p>
                                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--cc-muted)" }}>
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
                            <div key={card.id} style={{ marginBottom: 12, padding: 12, background: isPending ? "rgba(245, 158, 11, 0.12)" : "var(--cc-surface-2)", borderRadius: 8, border: `1px solid ${isPending ? "rgba(245, 158, 11, 0.35)" : "var(--cc-border)"}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Gift Card #{card.code}</p>
                                            <span style={{ 
                                                fontSize: 10, 
                                                padding: "2px 6px", 
                                                borderRadius: 4, 
                                                background: isPhysical ? (isIssued ? "rgba(37, 99, 235, 0.12)" : "rgba(245, 158, 11, 0.12)") : "rgba(37, 99, 235, 0.12)",
                                                color: isPhysical ? (isIssued ? "var(--cc-primary)" : "var(--cc-warning)") : "var(--cc-primary)",
                                                fontWeight: 600
                                            }}>
                                                {isPhysical ? (isIssued ? "📦 PHYSICAL (Issued)" : "⏳ PHYSICAL (Pending)") : "💳 DIGITAL"}
                                            </span>
                                        </div>
                                        <p style={{ margin: "4px 0", fontSize: 16, fontWeight: 700, color: "var(--cc-primary)" }}>
                                            ${card.current_balance.toFixed(2)}
                                        </p>
                                        <p style={{ margin: "4px 0 0 0", fontSize: 11, color: card.isExpired ? "var(--cc-danger)" : card.daysRemaining < 30 ? "var(--cc-warning)" : "var(--cc-muted)" }}>
                                            {card.isExpired ? "❌ Expired" : `Valid for ${card.daysRemaining} more days`}
                                        </p>
                                        {isPending && (
                                            <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--cc-warning)", fontWeight: 600 }}>
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
                                        style={{ ...button, flex: 1, fontSize: 11, padding: "6px 12px", background: "var(--cc-primary)" }}
                                        onClick={() => {
                                            setSelectedGiftCard(card);
                                            setShowGiftCardModal(true);
                                        }}
                                    >
                                        View Details
                                    </button>
                                    <button
                                        style={{ ...button, flex: 1, fontSize: 11, padding: "6px 12px", background: "var(--cc-success)" }}
                                        onClick={async () => {
                                            try {
                                                const amount = prompt(`Enter amount to add (in dollars, e.g., 10 for $10):`);
                                                if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                                                    return;
                                                }
                                                
                                                setGiftCardLoading(true);
                                                const loopsNeeded = Math.floor(parseFloat(amount) * 100);
                                                
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ fontSize: 12, color: "var(--cc-muted)", minWidth: 120 }}>Gift card store:</label>
                        <select
                            value={storeId}
                            onChange={(e) => setStoreId(e.target.value)}
                            style={{ ...input, maxWidth: 320 }}
                        >
                            <option value="all">Select enrolled store</option>
                            {enrolledGiftCardStores.map((s) => (
                                <option key={`gift-store-${s.id}`} value={String(s.id)}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        style={{ ...button, width: "100%", background: giftCardEligibility?.isEligible ? "var(--cc-primary)" : "var(--cc-muted)", cursor: giftCardEligibility?.isEligible ? "pointer" : "not-allowed" }}
                        onClick={async () => {
                            if (!giftCardEligibility?.isEligible) {
                                alert(`You need ${giftCardEligibility?.pointsNeeded} more Loops. Minimum ${giftCardEligibility?.minimumRequired} Loops required.`);
                                return;
                            }

                            if (!storeId || storeId === "all") {
                                alert("Please select one of your enrolled stores.");
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
                                
                                const result = await createGiftCard(token, loopsAmount, Number(storeId), cardType);
                                alert(result.message);
                                setGiftCardSuccess(result.message);
                                
                                // Refresh data
                                const data = await fetchUserMe({ token, period, storeId });
                                setUser(data.user);
                                
                                getGiftCards(token)
                                    .then((data) => {
                                        setGiftCards(data.giftCards || []);
                                    });
                                
                                checkGiftCardEligibility(token, storeId !== "all" ? storeId : null)
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
                    />
                    <button
                        style={button}
                        onClick={handleRedeem}
                        disabled={redeemLoading || !redeemAmount}
                    >
                        {redeemLoading ? "Processing..." : "Redeem"}
                    </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 8 }}>
                    Select a specific store in the filter above before redeeming. Rewards are store-specific.
                </div>
                {redeemErr && <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>{redeemErr}</p>}
                {redeemSuccess && <p style={{ color: "green", fontSize: 13, marginTop: 8 }}>{redeemSuccess}</p>}
            </div>

            {/* Transaction History */}
            <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 0 }}>Transaction History</h3>
                    {transactions.length > 0 && (
                        <div style={{ fontSize: 13, color: "var(--cc-muted)" }}>
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
                        <p style={{ color: "var(--cc-muted)", marginTop: 12 }}>Loading transactions...</p>
                    </div>
                ) : transactions.length === 0 ? (
                    <div style={emptyState}>
                        <div style={emptyIcon}>📋</div>
                        <p style={{ color: "var(--cc-muted)", fontSize: 14, marginTop: 8 }}>
                            No transactions found for the selected filters.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                        <table style={table}>
                            <thead>
                                <tr style={{ backgroundColor: "var(--cc-surface-2)" }}>
                                    <th style={th}>Date & Time</th>
                                    <th style={th}>Type</th>
                                    <th style={th}>Store/Description</th>
                                    <th style={{ ...th, textAlign: "right" }}>Loops</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, idx) => (
                                    <tr 
                                        key={tx.id} 
                                        style={{ 
                                            backgroundColor: idx % 2 === 0 ? "var(--cc-surface)" : "var(--cc-surface-2)",
                                            transition: "background-color 0.2s",
                                            cursor: "default"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(37, 99, 235, 0.08)"}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--cc-surface)" : "var(--cc-surface-2)"}
                                    >
                                        <td style={td}>
                                            <div style={{ fontWeight: 500, color: "var(--cc-text)" }}>
                                                {tx.created_at && !isNaN(Date.parse(tx.created_at))
                                                    ? new Date(tx.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })
                                                    : "—"}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 2 }}>
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
                                                background: tx.transaction_type === 'EARN' ? "rgba(37, 99, 235, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                                color: tx.transaction_type === 'EARN' ? "var(--cc-primary)" : "var(--cc-danger)"
                                            }}>
                                                {tx.transaction_type === 'EARN' ? '💚 EARNED' : '🔴 REDEEMED'}
                                            </div>
                                            {tx.redeem_type && (
                                                <div style={{ fontSize: 10, color: "var(--cc-muted)", marginTop: 4 }}>
                                                    {tx.redeem_type}
                                                </div>
                                            )}
                                        </td>
                                        <td style={td}>
                                            <div style={{ fontWeight: 500, color: "var(--cc-text)" }}>
                                                {tx.store_name || "—"}
                                            </div>
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            <span style={{
                                                ...loopsBadge,
                                                background: tx.transaction_type === 'EARN' ? "var(--cc-success)" : "var(--cc-danger)",
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

            {activeTab === "subscriptions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
                    <div
                        style={{
                            ...card,
                            background: "var(--cc-surface)",
                            border: "1px solid var(--cc-border)",
                            width: "100%",
                            maxWidth: 1200,
                            margin: "0 auto",
                            color: "var(--cc-text)",
                            padding: 24
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                            <div>
                                <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 24, fontWeight: 800, color: "var(--cc-text)" }}>
                                    Subscription Plans
                                </h3>
                                <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 13 }}>
                                    Choose a plan that fits your visits. BASIC is available now.
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 6, borderRadius: 999, background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)" }}>
                                <button
                                    style={{
                                        ...button,
                                        padding: "6px 12px",
                                        fontSize: 12,
                                        borderRadius: 999,
                                        background: pricingMode === "monthly" ? "var(--cc-primary)" : "transparent",
                                        color: pricingMode === "monthly" ? "#fff" : "var(--cc-muted)",
                                        border: "none"
                                    }}
                                    onClick={() => setPricingMode("monthly")}
                                >
                                    Monthly
                                </button>
                                <button
                                    style={{
                                        ...button,
                                        padding: "6px 12px",
                                        fontSize: 12,
                                        borderRadius: 999,
                                        background: pricingMode === "annual" ? "var(--cc-primary)" : "transparent",
                                        color: pricingMode === "annual" ? "#fff" : "var(--cc-muted)",
                                        border: "none"
                                    }}
                                    onClick={() => setPricingMode("annual")}
                                >
                                    Annual
                                </button>
                            </div>
                        </div>

                        <div style={{ ...card, marginTop: 16, background: "var(--cc-surface-2)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--cc-text)" }}>
                                Benefits this month
                            </div>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 12 }}>
                                Based on your loyalty tier and activity.
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                                {[
                                    { label: "Tier bonus", value: planTier?.tierMultiplier ? `${planTier.tierMultiplier}x on visits` : "1.0x on visits" },
                                    { label: "Monthly bonus", value: "50 loops" },
                                    { label: "Birthday bonus", value: "100 loops" },
                                    { label: "Early access", value: "7 days" }
                                ].map((item) => (
                                    <div key={item.label} style={{ padding: 12, borderRadius: 10, background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 4 }}>{item.label}</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cc-text)" }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 20 }}>
                            {[
                                {
                                    name: "BASIC",
                                    badge: "Most popular",
                                    monthlyPrice: "$2.99/mo",
                                    annualPrice: "$30/yr",
                                    status: "Available now",
                                    features: [
                                        "10% bonus loops",
                                        "Priority support",
                                        "Early access to new stores",
                                        "Monthly bonus loops",
                                        "Birthday bonus"
                                    ],
                                    canUpgrade: true
                                },
                                {
                                    name: "PLUS",
                                    badge: "Coming soon",
                                    monthlyPrice: "$4.99/mo",
                                    annualPrice: "$60/yr",
                                    status: "Coming soon",
                                    features: [
                                        "15% bonus loops",
                                        "Double loops on first visit",
                                        "Exclusive store promos",
                                        "Gift card at 750 loops"
                                    ],
                                    canUpgrade: false
                                },
                                {
                                    name: "PREMIUM",
                                    badge: "Coming soon",
                                    monthlyPrice: "$9.99/mo",
                                    annualPrice: "$99/yr",
                                    status: "Coming soon",
                                    features: [
                                        "20% bonus loops",
                                        "Unlimited check-ins",
                                        "Gift card at 500 loops",
                                        "VIP store access"
                                    ],
                                    canUpgrade: false
                                }
                            ].map((plan) => {
                                const currentPlan = planTier?.currentPlan || user?.plan || "STARTER";
                                const isCurrent = currentPlan === plan.name;
                                const displayPrice = pricingMode === "annual" ? plan.annualPrice : plan.monthlyPrice;
                                return (
                                    <div
                                        key={plan.name}
                                        style={{
                                            padding: 24,
                                            borderRadius: 16,
                                            border: isCurrent ? "3px solid var(--cc-primary)" : "2px solid var(--cc-border)",
                                            background: isCurrent ? "var(--cc-surface)" : "var(--cc-surface-2)",
                                            boxShadow: isCurrent ? "var(--cc-shadow-md)" : "var(--cc-shadow-sm)",
                                            transition: "all 0.3s",
                                            minHeight: 400,
                                            display: "flex",
                                            flexDirection: "column"
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--cc-surface)", border: "1px solid var(--cc-border)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                                                    {plan.name.slice(0, 1)}
                                                </div>
                                                <div style={{ fontSize: 14, color: "var(--cc-text)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                                                    {plan.name}
                                                </div>
                                            </div>
                                            <div style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--cc-surface)", border: "1px solid var(--cc-border)", color: plan.badge === "Most popular" ? "var(--cc-primary)" : "var(--cc-muted)" }}>
                                                {plan.badge}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 32, fontWeight: 900, margin: "12px 0", color: "var(--cc-primary)" }}>
                                            {displayPrice}
                                        </div>
                                        {pricingMode === "annual" && (
                                            <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 4 }}>
                                                Save up to 15% with annual billing
                                            </div>
                                        )}
                                        <div style={{ fontSize: 13, color: plan.status === "Available now" ? "var(--cc-success)" : "var(--cc-muted)", marginBottom: 16, fontWeight: 600 }}>
                                            {plan.status}
                                        </div>
                                        <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--cc-border)" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-text)", marginBottom: 12 }}>Features:</div>
                                            <ul style={{ margin: 0, paddingLeft: 20, color: "var(--cc-text)", fontSize: 13, lineHeight: 1.8, listStyle: "disc" }}>
                                                {plan.features.map((feature) => (
                                                    <li key={feature} style={{ marginBottom: 8 }}>{feature}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div style={{ marginTop: "auto", paddingTop: 20 }}>
                                            {isCurrent ? (
                                                <div style={{
                                                    padding: "12px 16px",
                                                    background: "rgba(16, 185, 129, 0.15)",
                                                    borderRadius: 8,
                                                    textAlign: "center",
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                    color: "var(--cc-success)"
                                                }}>
                                                    ✓ Current plan
                                                </div>
                                            ) : (
                                                <button
                                                    style={{
                                                        width: "100%",
                                                        padding: "14px 20px",
                                                        fontSize: 15,
                                                        fontWeight: 700,
                                                        borderRadius: 8,
                                                        border: "none",
                                                        background: plan.canUpgrade ? "var(--cc-primary)" : "var(--cc-surface-2)",
                                                        color: plan.canUpgrade ? "#fff" : "var(--cc-muted)",
                                                        cursor: plan.canUpgrade ? "pointer" : "not-allowed",
                                                        transition: "all 0.2s",
                                                        boxShadow: plan.canUpgrade ? "var(--cc-shadow-sm)" : "none"
                                                    }}
                                                    onClick={() => plan.canUpgrade && requestPlanUpgrade(plan.name)}
                                                    disabled={!plan.canUpgrade || planUpgradeLoading}
                                                    onMouseEnter={(e) => {
                                                        if (plan.canUpgrade) {
                                                            e.currentTarget.style.transform = "translateY(-2px)";
                                                            e.currentTarget.style.boxShadow = "var(--cc-shadow-md)";
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (plan.canUpgrade) {
                                                            e.currentTarget.style.transform = "translateY(0)";
                                                            e.currentTarget.style.boxShadow = "var(--cc-shadow-sm)";
                                                        }
                                                    }}
                                                >
                                                    {plan.canUpgrade ? (planUpgradeLoading ? "Activating..." : "Upgrade Now") : "Coming Soon"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {planUpgradeMessage && (
                            <div style={{ marginTop: 12, fontSize: 12, color: "var(--cc-muted)" }}>
                                {planUpgradeMessage}
                            </div>
                        )}
                    </div>
                </div>
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
                        setLocationRefreshKey((prev) => prev + 1);
                    }}
                />
            )}

            {showUpgradeConfirm && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                        padding: 16
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 420,
                            background: "var(--cc-surface)",
                            borderRadius: 16,
                            border: "1px solid var(--cc-border)",
                            boxShadow: "var(--cc-shadow-lg)",
                            padding: 20
                        }}
                    >
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                            Confirm upgrade
                        </div>
                        <div style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 16 }}>
                            You are about to upgrade to {upgradePlanTarget || "BASIC"}.
                        </div>
                        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--cc-border)", background: "var(--cc-surface-2)", marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 6 }}>Plan price</div>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>
                                {pricingMode === "annual" ? "$30/yr" : "$2.99/mo"}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button
                                style={{
                                    ...button,
                                    flex: 1,
                                    background: "var(--cc-surface-2)",
                                    color: "var(--cc-text)",
                                    border: "1px solid var(--cc-border)"
                                }}
                                onClick={closeUpgradeConfirm}
                                disabled={planUpgradeLoading}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...button,
                                    flex: 1,
                                    background: "var(--cc-primary)"
                                }}
                                onClick={handleConfirmUpgrade}
                                disabled={planUpgradeLoading}
                            >
                                {planUpgradeLoading ? "Activating..." : "Confirm"}
                            </button>
                        </div>
                        {planUpgradeMessage && (
                            <div style={{ marginTop: 12, fontSize: 12, color: "var(--cc-muted)" }}>
                                {planUpgradeMessage}
                            </div>
                        )}
                    </div>
                </div>
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

            {/* NFC Scanner temporarily disabled */}

            {/* QR Scanner */}
            {showQRScanner && (
                <QRScanner
                    title="Scan Store QR Code"
                    onScan={async (qrCode) => {
                        // Prevent multiple simultaneous scans
                        if (processingScanRef.current) {
                            return;
                        }
                        processingScanRef.current = true;
                        
                        // Close scanner immediately to prevent re-rendering
                        setShowQRScanner(false);
                        
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
                                    },
                                    { timeout: 5000 }
                                );
                            }
                            
                        (async () => {
                            try {
                                const result = await checkIn(token, qrCode, latitude, longitude, 'qr', null);
                            
                            if (result.success) {
                                setActiveSession({
                                    sessionId: result.sessionId,
                                    store: result.store,
                                    loopsInstant: result.loopsInstant || 0,
                                    loopsPending: result.loopsPending || 0,
                                    totalLoops: result.totalLoops || (result.loopsPending || 0),
                                    expiresAt: result.expiresAt
                                });
                                setScannedStore(result.store);
                                
                                // Show success message with instant + pending breakdown
                                if (result.loopsInstant > 0 && result.loopsPending > 0) {
                                    alert(`✓ Checked in! You earned ${result.loopsInstant} loops now, ${result.loopsPending} more pending.`);
                                } else if (result.loopsInstant > 0) {
                                    alert(`✓ Checked in! You earned ${result.loopsInstant} loops!`);
                                } else if (result.loopsPending > 0) {
                                    alert(`✓ Checked in! ${result.loopsPending} loops pending (unlocks after your visit is confirmed).`);
                                }

                                if (result.levelUp?.toTier) {
                                    setLevelUpBanner(result.levelUp);
                                }

                                // Keep this fully automatic for customers:
                                // complete CIV session in background without extra button taps.
                                setTimeout(() => {
                                    completeCheckIn(token, result.sessionId)
                                        .then(() => getPendingPoints(token))
                                        .then((data) => setPendingPoints(data.pendingPoints || []))
                                        .catch(() => {});
                                }, 1500);
                                
                                // Refresh user data to show updated balance
                                Promise.all([
                                    fetchUserMe({ token, period, storeId }),
                                    getPlanTier(token).catch(() => null),
                                ]).then(([data, tierData]) => {
                                    setUser(data.user);
                                    if (tierData) setPlanTier(tierData);
                                });
                                
                                // Start location tracking for CIV (only if not already tracking)
                                if (navigator.geolocation && result.sessionId && locationWatchRef.current === null) {
                                    // Clear any existing watch first
                                    if (locationWatchRef.current !== null) {
                                        navigator.geolocation.clearWatch(locationWatchRef.current);
                                    }
                                    
                                    const watchId = navigator.geolocation.watchPosition(
                                        (position) => {
                                            updateCheckInLocation(
                                                token,
                                                result.sessionId,
                                                position.coords.latitude,
                                                position.coords.longitude,
                                                position.coords.accuracy
                                                ).catch((e) => {
                                                    // Silently fail - location updates are best effort
                                                });
                                        },
                                        (error) => {
                                            // Suppress all location errors - they're expected in many scenarios
                                            // Only stop tracking on permission denied
                                            if (error.code === 1) {
                                                // Permission denied - stop tracking
                                                if (locationWatchRef.current !== null) {
                                                    navigator.geolocation.clearWatch(locationWatchRef.current);
                                                    locationWatchRef.current = null;
                                                    setLocationWatchId(null);
                                                }
                                            }
                                            // Don't log or handle other errors (timeouts, unavailable, etc.)
                                        },
                                        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
                                    );
                                    locationWatchRef.current = watchId;
                                    setLocationWatchId(watchId);
                                }
                                
                                // Refresh pending points
                                getPendingPoints(token)
                                    .then((data) => {
                                        setPendingPoints(data.pendingPoints || []);
                                    })
                            }
                        } catch (e) {
                            // Prevent showing alert multiple times
                            if (alertShownRef.current) {
                                processingScanRef.current = false;
                                return;
                            }
                            alertShownRef.current = true;
                            
                            // Show user-friendly error message
                            if (e.message.includes("wait") || e.message.includes("cooldown") || e.message.includes("hour") || e.message.includes("Thank you")) {
                                // Use the friendly message from backend
                                const message = e.message.includes("Thank you") ? e.message : "Thank you so much! Please visit again tomorrow.";
                                alert(message);
                            } else if (e.requiresEnrollment) {
                                // Show enrollment prompt
                                setEnrollmentPrompt(e.enrollmentData);
                            } else if (
                                e.message.includes("not registered with us") ||
                                e.message.includes("Store not found")
                            ) {
                                const wantsRequest = window.confirm(
                                    "This store is not registered with us yet. Would you like to request this store?"
                                );
                                if (wantsRequest) {
                                    const guessName = String(qrCode || "").startsWith("STORE:")
                                        ? `Store ${String(qrCode).split(":")[1]}`
                                        : "";
                                    const storeName = window.prompt("Enter store name", guessName);
                                    if (storeName && String(storeName).trim().length >= 2) {
                                        const note = window.prompt("Optional: add address or note", "") || "";
                                        try {
                                            const result = await submitStoreRequest(token, {
                                                storeName: String(storeName).trim(),
                                                storeRef: qrCode || null,
                                                note: String(note || "").trim(),
                                                source: "scan",
                                            });
                                            alert(result?.message || "Thanks! We recorded your request for this store.");
                                        } catch (reqErr) {
                                            alert(reqErr.message || "Failed to submit store request.");
                                        }
                                    } else {
                                        alert("No problem. You can request a store anytime.");
                                    }
                                } else {
                                    alert("This store is not registered with us yet. We will get back soon.");
                                }
                            } else {
                            alert("Error checking in: " + e.message);
                        }
                            
                            // Reset flags after a delay to allow new scans
                            setTimeout(() => {
                                alertShownRef.current = false;
                                processingScanRef.current = false;
                            }, 3000);
                        } finally {
                            // Ensure processing flag is reset even if no error
                            if (!alertShownRef.current) {
                                setTimeout(() => {
                                    processingScanRef.current = false;
                                }, 1000);
                            }
                        }
                        })();
                    }}
                    onClose={() => {
                        setShowQRScanner(false);
                    }}
                />
            )}

            {showUserQRZoom && (
                <div style={modalOverlay} onClick={() => setShowUserQRZoom(false)}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>My QR Code</h3>
                            <button style={modalCloseButton} onClick={() => setShowUserQRZoom(false)}>✕</button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <QRCodeCanvas value={qrValue} size={300} />
                        </div>
                    </div>
                </div>
            )}

            {/* Check-In Success Modal */}
            {activeSession && (
                <div style={modalOverlay} onClick={() => {
                    // Stop location tracking when closing via overlay
                    if (locationWatchRef.current !== null && navigator.geolocation) {
                        navigator.geolocation.clearWatch(locationWatchRef.current);
                        locationWatchRef.current = null;
                        setLocationWatchId(null);
                    }
                    setActiveSession(null);
                    setScannedStore(null);
                }}>
                    <div style={modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>✓ Checked In!</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => {
                                    // Stop location tracking when closing
                                    if (locationWatchRef.current !== null && navigator.geolocation) {
                                        navigator.geolocation.clearWatch(locationWatchRef.current);
                                        locationWatchRef.current = null;
                                        setLocationWatchId(null);
                                    }
                                    setActiveSession(null);
                                    setScannedStore(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={modalBody}>
                            <p style={{ margin: "8px 0", fontSize: 18, fontWeight: 600, color: "var(--cc-success)" }}>
                                {activeSession.store.name}
                            </p>
                            
                            {/* Instant + Pending Points Display */}
                            <div style={{ marginTop: 16 }}>
                                {activeSession.loopsInstant > 0 && (
                                    <div style={{ marginBottom: 12, padding: 16, background: "rgba(16, 185, 129, 0.08)", borderRadius: 8, border: "2px solid var(--cc-success)" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cc-success)" }}>Available Now:</span>
                                            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--cc-success)" }}>
                                                +{activeSession.loopsInstant} loops
                                            </span>
                                        </div>
                                        <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--cc-success)" }}>
                                            ✓ Added to your balance immediately
                                        </p>
                                    </div>
                                )}
                                
                                {activeSession.loopsPending > 0 && (
                                    <div style={{ padding: 16, background: "rgba(245, 158, 11, 0.08)", borderRadius: 8, border: "2px solid var(--cc-warning)" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cc-warning)" }}>Pending (Unlocking Soon):</span>
                                            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--cc-warning)" }}>
                                                +{activeSession.loopsPending} loops
                                            </span>
                                        </div>
                                        <p style={{ margin: "8px 0 6px 0", fontSize: 12, color: "var(--cc-warning)" }}>
                                            Unlocks when any of these happen:
                                        </p>
                                        <div style={{ display: "grid", gap: 4 }}>
                                            {pendingUnlockReasons.map((reason) => (
                                                <div key={reason.title} style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                                    {reason.title}: {reason.detail}
                            </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {activeSession.loopsInstant === 0 && activeSession.loopsPending === 0 && (
                                    <div style={{ padding: 12, background: "rgba(16, 185, 129, 0.08)", borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                                        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--cc-success)" }}>
                                            Check-in successful! Points will be calculated based on your visit.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <p style={{ margin: "16px 0 8px 0", fontSize: 13, color: "var(--cc-muted)" }}>
                                This visit is auto-completed in the background. No extra steps needed.
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                style={{ ...modalButton, flex: 1, background: "var(--cc-primary)" }}
                                onClick={() => {
                                    // Stop location tracking when closing
                                    if (locationWatchRef.current !== null && navigator.geolocation) {
                                        navigator.geolocation.clearWatch(locationWatchRef.current);
                                        locationWatchRef.current = null;
                                        setLocationWatchId(null);
                                    }
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
                                <p style={{ margin: "4px 0", fontSize: 24, fontWeight: 700, color: "var(--cc-primary)" }}>
                                    ${selectedGiftCard.current_balance.toFixed(2)}
                                </p>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ margin: "8px 0", fontSize: 13, color: "var(--cc-muted)" }}>
                                    <strong>Original Value:</strong> ${selectedGiftCard.original_value.toFixed(2)}
                                </p>
                                <p style={{ margin: "8px 0", fontSize: 13, color: "var(--cc-muted)" }}>
                                    <strong>Current Balance:</strong> ${selectedGiftCard.current_balance.toFixed(2)}
                                </p>
                                <p style={{ margin: "8px 0", fontSize: 13, color: selectedGiftCard.isExpired ? "var(--cc-danger)" : selectedGiftCard.daysRemaining < 30 ? "var(--cc-warning)" : "var(--cc-muted)" }}>
                                    <strong>Status:</strong> {selectedGiftCard.status.toUpperCase()}
                                </p>
                                <p style={{ margin: "8px 0", fontSize: 13, color: "var(--cc-muted)" }}>
                                    <strong>Expires:</strong> {new Date(selectedGiftCard.expires_at).toLocaleDateString()} ({selectedGiftCard.daysRemaining} days left)
                                </p>
                                {selectedGiftCard.loops_used && (
                                    <p style={{ margin: "8px 0", fontSize: 13, color: "var(--cc-muted)" }}>
                                        <strong>Points Used:</strong> {selectedGiftCard.loops_used} Loops
                                    </p>
                                )}
                            </div>
                            <div style={{ padding: 12, background: "var(--cc-surface-2)", borderRadius: 8, marginBottom: 16 }}>
                                <p style={{ margin: 0, fontSize: 12, color: "var(--cc-muted)" }}>
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

            {storeProfileOpen && (
                <div style={modalOverlay} onClick={() => setStoreProfileOpen(false)}>
                    <div
                        style={{
                            ...modalContent,
                            maxWidth: 900,
                            maxHeight: "85vh",
                            overflowY: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                <div
                                    style={{
                                        width: 320,
                                        height: 320,
                                        borderRadius: "50%",
                                        background: "var(--cc-surface-2)",
                                        border: "1px solid var(--cc-border)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                        fontSize: 20,
                                        fontWeight: 800,
                                        color: "var(--cc-primary)",
                                    }}
                                >
                                    {storeProfileData?.store?.profile_image_url ? (
                                        <img
                                            src={storeProfileData.store.profile_image_url}
                                            alt="Store"
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        getInitials(storeProfileData?.store?.name)
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                                        {storeProfileData?.store?.name || "Store profile"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                        {storeProfileData?.store?.category || "Local business"}
                                        {typeof storeProfileData?.store?.distance_miles === "number" && (
                                            <> · {storeProfileData.store.distance_miles.toFixed(1)} mi</>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button style={modalCloseButton} onClick={() => setStoreProfileOpen(false)}>
                                ✕
                            </button>
                        </div>
                        {storeProfileLoading && (
                            <div style={{ ...card, marginTop: 16 }}>Loading store profile...</div>
                        )}
                        {!storeProfileLoading && storeProfileData && (
                            <>
                                <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                                    <div style={{ ...card, padding: 12, minWidth: 160 }}>
                                        <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>Members</div>
                                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                                            {storeProfileData.store?.total_members || 0}
                                        </div>
                                    </div>
                                    <div style={{ ...card, padding: 12, minWidth: 180 }}>
                                        <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>Total loops given</div>
                                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                                            {storeProfileData.store?.total_loops_given || 0}
                                        </div>
                                    </div>
                                    <div style={{ ...card, padding: 12, minWidth: 160 }}>
                                        <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>Opened</div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>
                                            {storeProfileData.store?.opened_month && storeProfileData.store?.opened_year
                                                ? `${storeProfileData.store.opened_month}/${storeProfileData.store.opened_year}`
                                                : "N/A"}
                                        </div>
                                    </div>
                                    <div style={{ ...card, padding: 12, minWidth: 220 }}>
                                        <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>Address</div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                                            {storeProfileData.store?.address || "Not provided"}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                                    {["all", "promotion", "update", "post"].map((type) => (
                                        <button
                                            key={type}
                                            style={{
                                                ...button,
                                                fontSize: 12,
                                                padding: "6px 14px",
                                                background: storeProfileFilter === type ? "var(--cc-primary)" : "var(--cc-surface-2)",
                                                color: storeProfileFilter === type ? "#fff" : "var(--cc-text)",
                                            }}
                                            onClick={() => setStoreProfileFilter(type)}
                                        >
                                            {type === "all" ? "All" : type[0].toUpperCase() + type.slice(1) + "s"}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
                                    {(storeProfileData.content || [])
                                        .filter((item) => storeProfileFilter === "all" || item.type === storeProfileFilter)
                                        .map((item) => {
                                            const mediaUrls = item.media_urls || [];
                                            return (
                                                <div
                                                    key={`${item.type}-${item.id}`}
                                                    style={{
                                                        border: "1px solid var(--cc-border)",
                                                        borderRadius: 14,
                                                        background: "var(--cc-surface)",
                                                        padding: 16,
                                                        boxShadow: "var(--cc-shadow-sm)",
                                                        display: "grid",
                                                        gap: 10,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title || "Post"}</div>
                                                            {item.created_at && (
                                                                <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>
                                                                    {getPostedLabel(item.created_at)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cc-primary)" }}>
                                                            {item.type.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    {item.type === "promotion" && item.description && (
                                                        <div dangerouslySetInnerHTML={{ __html: item.description }} />
                                                    )}
                                                    {item.type === "update" && item.body && (
                                                        <div dangerouslySetInnerHTML={{ __html: item.body }} />
                                                    )}
                                                    {item.type === "post" && item.caption && (
                                                        <div dangerouslySetInnerHTML={{ __html: item.caption }} />
                                                    )}
                                                    {renderMediaCarousel(mediaUrls)}
                                                </div>
                                            );
                                        })}
                                    {(storeProfileData.content || []).filter((item) => storeProfileFilter === "all" || item.type === storeProfileFilter).length === 0 && (
                                        <div style={{ ...card, color: "var(--cc-muted)" }}>
                                            No posts yet. Check later.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {!storeProfileLoading && !storeProfileData && storeProfileError && (
                            <div style={{ ...card, marginTop: 16, color: "var(--cc-danger)" }}>
                                {storeProfileError}
                            </div>
                        )}
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
                                <p style={{ margin: "4px 0", fontSize: 14, color: "var(--cc-muted)" }}>
                                    Phone: {scannedStore.phone}
                                </p>
                            )}
                            {scannedStore.category && (
                                <p style={{ margin: "4px 0", fontSize: 14, color: "var(--cc-muted)" }}>
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

            {/* Notifications Panel */}
            {showNotifications && (
                <div
                    style={modalOverlay}
                    onClick={() => setShowNotifications(false)}
                >
                    <div
                        style={{ ...modalContent, maxWidth: 500, maxHeight: "80vh", overflowY: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>Notifications</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => setShowNotifications(false)}
                            >
                                ×
                            </button>
        </div>
                        {notificationsLoading ? (
                            <div style={{ textAlign: "center", padding: 20 }}>Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div style={{ textAlign: "center", padding: 40, color: "var(--cc-muted)" }}>
                                No notifications yet
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        style={{
                                            padding: 12,
                                            borderRadius: 8,
                                            border: "1px solid var(--cc-border)",
                                            background: notif.is_read ? "var(--cc-surface)" : "rgba(37, 99, 235, 0.05)",
                                            cursor: "pointer",
                                        }}
                                        onClick={async () => {
                                            if (!notif.is_read) {
                                                await markNotificationRead(token, notif.id);
                                                setNotifications((prev) =>
                                                    prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
                                                );
                                                setUnreadCount((prev) => Math.max(0, prev - 1));
                                            }
                                            // Load full content details
                                            if (notif.content_type && notif.content_id) {
                                                try {
                                                    setNotificationDetailsLoading(true);
                                                    const data = await fetchContentDetails(token, notif.content_type, notif.content_id);
                                                    setSelectedNotification(notif);
                                                    setNotificationDetails(data.content);
                                                } catch (e) {
                                                    console.error("Failed to load content details:", e);
                                                } finally {
                                                    setNotificationDetailsLoading(false);
                                                }
                                            }
                                        }}
                                    >
                                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                            {notif.store_profile_image_url && (
                                                <img
                                                    src={notif.store_profile_image_url}
                                                    alt={notif.store_name}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: "50%",
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                                                    {notif.title}
                                                </div>
                                                {notif.message && (
                                                    <div style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 4 }}>
                                                        {notif.message}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 4 }}>
                                                    {new Date(notif.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            {!notif.is_read && (
                                                <div
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: "50%",
                                                        background: "var(--cc-primary)",
                                                        marginTop: 4,
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Notification Details Modal */}
            {selectedNotification && notificationDetails && (
                <div
                    style={modalOverlay}
                    onClick={() => {
                        setSelectedNotification(null);
                        setNotificationDetails(null);
                    }}
                >
                    <div
                        style={{ ...modalContent, maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>{notificationDetails.title}</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => {
                                    setSelectedNotification(null);
                                    setNotificationDetails(null);
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        {notificationDetails.store_name && (
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                                {notificationDetails.store_profile_image_url && (
                                    <img
                                        src={notificationDetails.store_profile_image_url}
                                        alt={notificationDetails.store_name}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: "50%",
                                            objectFit: "cover",
                                        }}
                                    />
                                )}
                                <div>
                                    <div style={{ fontWeight: 600 }}>{notificationDetails.store_name}</div>
                                    {notificationDetails.store_category && (
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                            {notificationDetails.store_category}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {notificationDetails.type === "promotion" && (
                            <>
                                {notificationDetails.description && (
                                    <div
                                        style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}
                                        dangerouslySetInnerHTML={{ __html: notificationDetails.description }}
                                    />
                                )}
                                <div style={{ marginBottom: 12 }}>
                                    <strong>Discount:</strong> {notificationDetails.discount_type === "percent" 
                                        ? `${notificationDetails.discount_value}% off`
                                        : notificationDetails.discount_type === "fixed"
                                        ? `$${notificationDetails.discount_value} off`
                                        : notificationDetails.discount_type}
                                </div>
                            </>
                        )}

                        {notificationDetails.type === "update" && (
                            <div
                                style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}
                                dangerouslySetInnerHTML={{ __html: notificationDetails.body }}
                            />
                        )}

                        {(notificationDetails.start_at || notificationDetails.end_at) && (
                            <div style={{ marginBottom: 16, padding: 12, background: "var(--cc-surface-2)", borderRadius: 8 }}>
                                {notificationDetails.start_at && (
                                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                                        <strong>Start Date:</strong> {new Date(notificationDetails.start_at).toLocaleString()}
                                    </div>
                                )}
                                {notificationDetails.end_at && (
                                    <div style={{ fontSize: 13 }}>
                                        <strong>End Date:</strong> {new Date(notificationDetails.end_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        )}

                        {notificationDetails.media_urls && notificationDetails.media_urls.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                {notificationDetails.media_urls.map((url, idx) => (
                                    <img
                                        key={idx}
                                        src={url}
                                        alt={`Media ${idx + 1}`}
                                        style={{
                                            width: "100%",
                                            borderRadius: 8,
                                            marginBottom: 8,
                                            maxHeight: 400,
                                            objectFit: "contain",
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <button
                            style={modalButton}
                            onClick={() => {
                                setSelectedNotification(null);
                                setNotificationDetails(null);
                                setShowNotifications(false);
                                setActiveTab("feed");
                            }}
                        >
                            View in Feed
                        </button>
                    </div>
                </div>
            )}

            {/* Enrollment Prompt Modal */}
            {enrollmentPrompt && (
                <div
                    style={modalOverlay}
                    onClick={() => setEnrollmentPrompt(null)}
                >
                    <div
                        style={{ ...modalContent, maxWidth: 500 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ margin: 0 }}>Enrollment Required</h3>
                            <button
                                style={modalCloseButton}
                                onClick={() => setEnrollmentPrompt(null)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div style={{ marginBottom: 20 }}>
                            <p style={{ marginBottom: 12 }}>
                                You must enroll at <strong>{enrollmentPrompt.store_name}</strong> before scanning their QR code.
                            </p>

                            <div
                                style={{
                                    padding: 12,
                                    background: "rgba(16, 185, 129, 0.08)",
                                    borderRadius: 8,
                                    marginBottom: 12,
                                    border: "1px solid rgba(16, 185, 129, 0.2)",
                                    fontSize: 14,
                                    color: "var(--cc-text)"
                                }}
                            >
                                Enrollment is free. Once enrolled, you can scan and earn rewards from this store.
                            </div>
                            
                            {(enrollmentPrompt.unlock_cost_cents > 0 || enrollmentPrompt.unlock_cost_loops > 0) ? (
                                <div style={{ padding: 12, background: "var(--cc-surface-2)", borderRadius: 8, marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Enrollment Cost:</div>
                                    {enrollmentPrompt.unlock_cost_cents > 0 && (
                                        <div style={{ fontSize: 14 }}>${(enrollmentPrompt.unlock_cost_cents / 100).toFixed(2)}</div>
                                    )}
                                    {enrollmentPrompt.unlock_cost_loops > 0 && (
                                        <div style={{ fontSize: 14 }}>
                                            {enrollmentPrompt.unlock_cost_loops} Loops
                                            {user && (user.loops_balance || 0) < enrollmentPrompt.unlock_cost_loops && (
                                                <span style={{ color: "var(--cc-danger)", marginLeft: 8 }}>
                                                    (You have {user.loops_balance || 0})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: 12, background: "rgba(16, 185, 129, 0.1)", borderRadius: 8, marginBottom: 16, color: "var(--cc-success)" }}>
                                    ✓ Free enrollment available
                                </div>
                            )}
                        </div>
                        
                        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                            {enrollmentPrompt.unlock_cost_cents > 0 && (
                                <button
                                    style={{ ...modalButton, background: "var(--cc-primary)" }}
                                    disabled={enrolling}
                                    onClick={async () => {
                                        try {
                                            setEnrolling(true);
                                            await enrollStore(token, enrollmentPrompt.store_id, "money");
                                            setEnrollmentPrompt(null);
                                            alert("Store enrolled successfully! You can now scan the QR code.");
                                        } catch (e) {
                                            alert("Failed to enroll: " + e.message);
                                        } finally {
                                            setEnrolling(false);
                                        }
                                    }}
                                >
                                    {enrolling ? "Enrolling..." : `Enroll with $${(enrollmentPrompt.unlock_cost_cents / 100).toFixed(2)}`}
                                </button>
                            )}

                            {enrollmentPrompt.unlock_cost_loops > 0 && user && (user.loops_balance || 0) >= enrollmentPrompt.unlock_cost_loops && (
                                <button
                                    style={{ ...modalButton, background: "var(--cc-success)" }}
                                    disabled={enrolling}
                                    onClick={async () => {
                                        try {
                                            setEnrolling(true);
                                            await enrollStore(token, enrollmentPrompt.store_id, "loops");
                                            // Refresh user data to update loops balance
                                            const userData = await fetchUserMe({ token, period, storeId });
                                            setUser(userData.user);
                                            setEnrollmentPrompt(null);
                                            alert(`Store enrolled successfully! ${enrollmentPrompt.unlock_cost_loops} Loops deducted. You can now scan the QR code.`);
                                        } catch (e) {
                                            alert("Failed to enroll: " + e.message);
                                        } finally {
                                            setEnrolling(false);
                                        }
                                    }}
                                >
                                    {enrolling ? "Enrolling..." : `Enroll with ${enrollmentPrompt.unlock_cost_loops} Loops`}
                                </button>
                            )}
                            
                            {(enrollmentPrompt.unlock_cost_cents === 0 && enrollmentPrompt.unlock_cost_loops === 0) && (
                                <button
                                    style={{ ...modalButton, background: "var(--cc-success)" }}
                                    disabled={enrolling}
                                    onClick={async () => {
                                        try {
                                            setEnrolling(true);
                                            await enrollStore(token, enrollmentPrompt.store_id);
                                            setEnrollmentPrompt(null);
                                            alert("Store enrolled successfully! You can now scan the QR code.");
                                        } catch (e) {
                                            alert("Failed to enroll: " + e.message);
                                        } finally {
                                            setEnrolling(false);
                                        }
                                    }}
                                >
                                    {enrolling ? "Enrolling..." : "Enroll for Free"}
                                </button>
                            )}
                            
                            <button
                                style={{ ...modalButton, background: "var(--cc-surface-2)", color: "var(--cc-text)" }}
                                onClick={() => setEnrollmentPrompt(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const card = {
    border: "1px solid var(--cc-border)",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "var(--cc-surface)",
    boxShadow: "var(--cc-shadow-sm)",
    maxWidth: 800,
};

const infoText = {
    margin: "6px 0",
    fontSize: 14,
    color: "var(--cc-text)",
};

const input = {
    padding: "8px 12px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    fontSize: 14,
    minWidth: 150,
    flex: 1,
};

const button = {
    padding: "8px 16px",
    borderRadius: "var(--cc-radius-sm)",
    border: "none",
    backgroundColor: "var(--cc-primary)",
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
    borderBottom: "2px solid var(--cc-border)",
    fontWeight: 600,
    color: "var(--cc-text)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

const td = {
    padding: "14px 16px",
    borderBottom: "1px solid var(--cc-surface-2)",
    color: "var(--cc-muted)",
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
    backgroundColor: "var(--cc-surface)",
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
    color: "var(--cc-muted)",
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
    backgroundColor: "var(--cc-primary)",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const primaryButton = {
    padding: "10px 16px",
    borderRadius: "var(--cc-radius-sm)",
    border: "none",
    backgroundColor: "var(--cc-primary)",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
};

const tabButton = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--cc-border)",
    background: "var(--cc-surface)",
    cursor: "pointer",
    fontSize: 14,
  };
  
const tabButtonActive = {
    ...tabButton,
    background: "var(--cc-primary)",
    color: "#fff",
    border: "1px solid var(--cc-primary)",
};

const tabsContainer = {
    display: "flex",
    gap: 8,
    borderBottom: "2px solid var(--cc-border)",
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
    backgroundColor: "var(--cc-surface-2)",
    borderRadius: 8,
    border: "1px solid var(--cc-border)",
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
    color: "var(--cc-muted)",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
};

const selectStyle = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--cc-border)",
    fontSize: 14,
    backgroundColor: "var(--cc-surface)",
    color: "var(--cc-text)",
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
    border: "4px solid var(--cc-border)",
    borderTop: "4px solid var(--cc-primary)",
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
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    color: "var(--cc-success)",
    fontWeight: 600,
    fontSize: 13,
};






