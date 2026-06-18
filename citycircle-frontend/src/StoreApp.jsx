// src/StoreApp.jsx
import React, { useState, useEffect, useRef } from "react";
import RichTextEditor from "./RichTextEditor";
import {
    storeLogin,
    storeSignup,
    trackEvent,
    getUtmFromUrl,
    fetchStoreMe,
    fetchStoreSubscription,
    activateStoreSubscription,
    fetchStoreCustomersToday,
    scanCustomerQR,
    createTransaction,
    createQuickTransaction,
    scanGiftCard,
    useGiftCard,
    getPendingPhysicalGiftCards,
    issuePhysicalGiftCard,
    forgotPasswordStore,
    resetPasswordStore,
    fetchStoreBlacklist,
    addToBlacklist,
    removeFromBlacklist,
    updateStoreOffer,
    fetchStoreRewardSchedules,
    createStoreRewardSchedule,
    updateStoreRewardSchedule,
    fetchStoreRewardPreferences,
    updateStoreRewardPreferences,
    fetchStoreRewardRecommendations,
    applyStoreRewardRecommendation,
    fetchStoreHolidayReminders,
    respondStoreHolidayReminder,
    fetchStoreMembers,
    sendStoreMemberPromotion,
    updateStoreProfile,
    fetchStorePromotions,
    createStorePromotion,
    fetchStoreUpdates,
    createStoreUpdate,
    fetchStorePosts,
    createStorePost,
    fetchStoreContent,
    updateStorePromotion,
    updateStoreUpdate,
    updateStorePost,
    archiveStoreContent,
    unarchiveStoreContent,
    deleteStorePromotion,
    deleteStoreUpdate,
    deleteStorePost,
    uploadStoreMedia,
} from "./api";
import AnalyticsDashboard from "./AnalyticsDashboard";
import QRScanner from "./QRScanner";
import StoreLocationPrompt from "./StoreLocationPrompt";
import { QRCodeCanvas } from "qrcode.react";

export default function StoreApp({ token, onStoreToken }) {
    const isMissingSubscriptionEndpointError = (err) => {
        const msg = String(err?.message || "");
        return (
            msg.includes("/stores/subscription") &&
            (msg.includes("404") || msg.toLowerCase().includes("not found") || msg.includes("Cannot GET"))
        );
    };
    const getStored = (key) => (typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null);
    const defaultSubscriptionPlans = [
        {
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
        {
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
        {
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
    ];
    const defaultSubscriptionFeatureMatrix = [
        { key: "content_publishing", label: "Publish promotions/updates/posts", values: { trial: "Up to 20/mo", starter: "Up to 120/mo", growth: "Unlimited" } },
        { key: "analytics", label: "Analytics dashboard", values: { trial: "Basic", starter: "Advanced", growth: "Advanced" } },
        { key: "members", label: "Members and customer tools", values: { trial: "Basic", starter: "Full", growth: "Full" } },
        { key: "rewards", label: "Rewards and visibility controls", values: { trial: "Basic", starter: "Full", growth: "Full" } },
        { key: "ai_credits", label: "AI assist credits", values: { trial: "25/mo", starter: "250/mo", growth: "1200/mo" } },
        { key: "support", label: "Support level", values: { trial: "Community", starter: "Standard", growth: "Priority" } },
    ];
    const validStoreTabs = new Set([
        "dashboard",
        "analytics",
        "giftcards",
        "members",
        "promotions",
        "manage",
        "rewards",
        "subscription",
        "blacklist",
    ]);
    const getInitialStoreTab = () => {
        const stored = getStored("cc_store_active_tab");
        return validStoreTabs.has(stored) ? stored : "dashboard";
    };
    const [email, setEmail] = useState("coffee@grove.com");
    const [password, setPassword] = useState("password123");
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetPhone, setResetPhone] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [resetNewPassword, setResetNewPassword] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetRequested, setResetRequested] = useState(false);
    const [resetMessage, setResetMessage] = useState("");

    const [storeToken, setStoreToken] = useState(() => token || getStored("cc_store_token") || "");
    const [storeInfo, setStoreInfo] = useState(null);
    const [stats, setStats] = useState(null);
    const [subscriptionInfo, setSubscriptionInfo] = useState(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(false);
    const [subscriptionMessage, setSubscriptionMessage] = useState("");
    const [subscriptionActivatingPlan, setSubscriptionActivatingPlan] = useState("");
    const [subscriptionPlans, setSubscriptionPlans] = useState(defaultSubscriptionPlans);
    const [subscriptionFeatureMatrix, setSubscriptionFeatureMatrix] = useState(defaultSubscriptionFeatureMatrix);
    const [customersToday, setCustomersToday] = useState([]);
    const [customersAccess, setCustomersAccess] = useState({
        can_view_customer_identity: true,
        upgrade_message: "",
    });
    const [members, setMembers] = useState([]);
    const [membersAccess, setMembersAccess] = useState({
        can_view_customer_identity: true,
        upgrade_message: "",
    });
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberPromoSendingUserId, setMemberPromoSendingUserId] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [offerForm, setOfferForm] = useState({
        reward_tier: "standard",
        reward_points: 0,
        unlock_cost_cents: 0,
        unlock_cost_loops: 0,
        is_locked: false,
        min_plan: "STARTER",
        gift_card_min_loops: 1000,
        news: "No updates yet.",
    });
    const [offerSaving, setOfferSaving] = useState(false);
    const [offerMessage, setOfferMessage] = useState("");
    const [rewardSchedules, setRewardSchedules] = useState([]);
    const [rewardSchedulesLoading, setRewardSchedulesLoading] = useState(false);
    const [rewardScheduleMessage, setRewardScheduleMessage] = useState("");
    const [scheduleForm, setScheduleForm] = useState({
        name: "",
        reason: "",
        mode: "fixed",
        fixed_points: 12,
        multiplier: 1.2,
        start_at: "",
        end_at: "",
    });
    const [rewardAutomationMode, setRewardAutomationMode] = useState("auto");
    const [rewardRecommendations, setRewardRecommendations] = useState([]);
    const [rewardRecommendationsLoading, setRewardRecommendationsLoading] = useState(false);
    const [rewardAutomationMessage, setRewardAutomationMessage] = useState("");
    const [holidayReminders, setHolidayReminders] = useState([]);
    const [holidayRemindersLoading, setHolidayRemindersLoading] = useState(false);
    const [openedMonth, setOpenedMonth] = useState("");
    const [openedYear, setOpenedYear] = useState("");
    const [profileImageUrl, setProfileImageUrl] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState("");
    const profileImageInputRef = useRef(null);
    const [profileCropOpen, setProfileCropOpen] = useState(false);
    const [profileCropSrc, setProfileCropSrc] = useState("");
    const [profileCropScale, setProfileCropScale] = useState(1);
    const [profileCropFile, setProfileCropFile] = useState(null);
    const [profileCropOffset, setProfileCropOffset] = useState({ x: 0, y: 0 });
    const [profileCropImageSize, setProfileCropImageSize] = useState({ width: 0, height: 0 });
    const profileCropDragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
    const profileCropPinchRef = useRef({ active: false, startDistance: 0, startScale: 1 });
    const profileCropTapRef = useRef({ lastTap: 0 });

    const [promotions, setPromotions] = useState([]);
    const [updates, setUpdates] = useState([]);
    const [posts, setPosts] = useState([]);
    const [promotionsLoading, setPromotionsLoading] = useState(false);
    const [updatesLoading, setUpdatesLoading] = useState(false);
    const [postsLoading, setPostsLoading] = useState(false);
    const [promoForm, setPromoForm] = useState({
        title: "",
        description: "",
        media_urls: [],
        discount_type: "percent",
        discount_value: "",
        start_at: "",
        end_at: "",
    });
    const [updateForm, setUpdateForm] = useState({
        title: "",
        body: "",
        media_urls: [],
        pinned: false,
        start_at: "",
        end_at: "",
    });
    const [postForm, setPostForm] = useState({
        post_type: "text",
        caption: "",
        media_url: "",
        media_urls: [],
    });
    const [postMediaName, setPostMediaName] = useState("");
    const [postUploading, setPostUploading] = useState(false);
    const [contentItems, setContentItems] = useState([]);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentMessage, setContentMessage] = useState("");
    const [manageType, setManageType] = useState("all");
    const [manageStatus, setManageStatus] = useState("all");
    const [editItem, setEditItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [viewItem, setViewItem] = useState(null);
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [promoMessage, setPromoMessage] = useState("");
    const [updateMessage, setUpdateMessage] = useState("");
    const [postMessage, setPostMessage] = useState("");
    const [promoUploading, setPromoUploading] = useState(false);
    const [updateUploading, setUpdateUploading] = useState(false);

    // Signup state
    const [showSignup, setShowSignup] = useState(false);
    const storePageViewSentRef = useRef(false);
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPhone, setSignupPhone] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupClaimCode, setSignupClaimCode] = useState("");

    // Check URL for claim code on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const claimCode = urlParams.get("claimCode");
            if (claimCode) {
                setSignupClaimCode(claimCode);
                setShowSignup(true);
                trackEvent("store_signup_started", getUtmFromUrl());
                // Clean up URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, "", newUrl);
            }
        }
    }, []);

    // Track page_view once when store login screen is shown (no token)
    useEffect(() => {
        if (typeof window === "undefined" || storeToken) return;
        if (storePageViewSentRef.current) return;
        storePageViewSentRef.current = true;
        const utm = getUtmFromUrl();
        trackEvent("page_view", { ...utm, payload: { app: "store" } });
    }, [storeToken]);

    const [activeTab, setActiveTab] = useState(getInitialStoreTab); // 'dashboard' | 'analytics' | 'giftcards'
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [scannedCustomer, setScannedCustomer] = useState(null);
    const [transactionAmount, setTransactionAmount] = useState("");
    const [transactionLoading, setTransactionLoading] = useState(false);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [showQRZoom, setShowQRZoom] = useState(false);
    const storeQrRef = useRef(null);
    const storeQrPrintRef = useRef(null);
    const [scannedGiftCard, setScannedGiftCard] = useState(null);
    const [giftCardPurchaseAmount, setGiftCardPurchaseAmount] = useState("");
    const [giftCardUseAmount, setGiftCardUseAmount] = useState("");
    const [giftCardProcessing, setGiftCardProcessing] = useState(false);
    const [qrScannerMode, setQrScannerMode] = useState("customer"); // 'customer' or 'giftcard'
    const [pendingPhysicalGiftCards, setPendingPhysicalGiftCards] = useState([]);
    const [issuingCard, setIssuingCard] = useState(null);
    const [blacklistedCustomers, setBlacklistedCustomers] = useState([]);

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

    const printQrCanvas = (canvas, title, subtitle = "") => {
        if (!canvas) return;
        const dataUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "_blank", "width=480,height=640");
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head><title>${title}</title></head>
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px;">
                    <img src="${dataUrl}" style="width:320px;height:320px;" />
                    ${subtitle ? `<div style="font-family:system-ui, -apple-system, sans-serif;font-size:18px;font-weight:600;color:#111;text-align:center;">${subtitle}</div>` : ""}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };
    const [blacklistLoading, setBlacklistLoading] = useState(false);
    const [showBlacklistReason, setShowBlacklistReason] = useState(false);
    const [blacklistReason, setBlacklistReason] = useState("");
    const [blacklistingUserId, setBlacklistingUserId] = useState(null);
    // NFC temporarily disabled

    useEffect(() => {
        if (!storeToken) return;

        async function load() {
            try {
                setErr("");
                setLoading(true);
                const { store, stats } = await fetchStoreMe(storeToken);
                setStoreInfo(store);
                setStats(stats);
                try {
                    const subscriptionData = await fetchStoreSubscription(storeToken);
                    setSubscriptionInfo(subscriptionData.subscription || null);
                    setSubscriptionPlans(subscriptionData.plans || defaultSubscriptionPlans);
                    setSubscriptionFeatureMatrix(subscriptionData.feature_matrix || defaultSubscriptionFeatureMatrix);
                    setSubscriptionMessage("");
                } catch (subscriptionErr) {
                    if (isMissingSubscriptionEndpointError(subscriptionErr)) {
                        setSubscriptionInfo(null);
                        setSubscriptionPlans(defaultSubscriptionPlans);
                        setSubscriptionFeatureMatrix(defaultSubscriptionFeatureMatrix);
                        setSubscriptionMessage("Subscription endpoint not found. Please restart backend server.");
                    } else {
                        throw subscriptionErr;
                    }
                }

                // Check if location needs to be set
                if (store && (!store.latitude || !store.longitude)) {
                    setShowLocationPrompt(true);
                }

                const ct = await fetchStoreCustomersToday(storeToken);
                setCustomersToday(ct.customers || []);
                setCustomersAccess(
                    ct.access || {
                        can_view_customer_identity: true,
                        upgrade_message: "",
                    }
                );
                
                // Load blacklist
                const blacklistResult = await fetchStoreBlacklist(storeToken);
                setBlacklistedCustomers(blacklistResult.blacklisted || []);
                
                // Load pending physical gift cards
                if (activeTab === "giftcards") {
                    const pendingCards = await getPendingPhysicalGiftCards(storeToken);
                    setPendingPhysicalGiftCards(pendingCards.giftCards || []);
                }
                if (activeTab === "promotions") {
                    await Promise.all([loadPromotions(), loadUpdates(), loadPosts()]);
                }
                if (activeTab === "rewards") {
                    await Promise.all([loadRewardSchedules(), loadRewardAutomationData()]);
                }
            } catch (e) {
                setErr(e.message);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [storeToken, activeTab]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.sessionStorage.setItem("cc_store_active_tab", activeTab);
        }
    }, [activeTab]);

    useEffect(() => {
        if (!storeInfo?.offer) return;
        setOfferForm({
            reward_tier: storeInfo.offer.reward_tier || "standard",
            reward_points: storeInfo.offer.reward_points || 0,
            unlock_cost_cents: storeInfo.offer.unlock_cost_cents || 0,
            unlock_cost_loops: storeInfo.offer.unlock_cost_loops || 0,
            is_locked: !!storeInfo.offer.is_locked,
            min_plan: storeInfo.offer.min_plan || "STARTER",
            gift_card_min_loops: Number(storeInfo.offer.gift_card_min_loops || 1000),
            news: storeInfo.offer.news || "No updates yet.",
        });
    }, [storeInfo]);

    useEffect(() => {
        if (!storeToken) return;
        if (activeTab !== "manage") return;
        loadContent();
    }, [activeTab, manageType, manageStatus, storeToken]);

    useEffect(() => {
        if (!storeInfo) return;
        setOpenedMonth(storeInfo.opened_month ? String(storeInfo.opened_month) : "");
        setOpenedYear(storeInfo.opened_year ? String(storeInfo.opened_year) : "");
        setProfileImageUrl(storeInfo.profile_image_url || "");
    }, [storeInfo]);

    function getCurrentPlanId() {
        return String(subscriptionInfo?.plan?.id || "trial").toLowerCase();
    }

    function getPlanCurrentPrice(plan) {
        return Number(plan?.launch_price_usd ?? plan?.monthly_price_usd ?? 0);
    }

    function getPlanListPrice(plan) {
        return Number(plan?.list_price_usd ?? plan?.monthly_price_usd ?? 0);
    }

    function getPlanPriceLabel(plan) {
        const price = getPlanCurrentPrice(plan);
        return price <= 0 ? "Free" : `$${price}/month`;
    }

    async function handleActivatePlan(planId) {
        if (!storeToken || !planId) return;
        try {
            setSubscriptionActivatingPlan(String(planId));
            setSubscriptionMessage("");
            const result = await activateStoreSubscription(storeToken, planId);
            if (result?.subscription) {
                setSubscriptionInfo(result.subscription);
            }
            await loadSubscription();
            setSubscriptionMessage(result?.message || "Plan activated successfully.");
        } catch (e) {
            setSubscriptionMessage(e.message || "Failed to activate plan");
        } finally {
            setSubscriptionActivatingPlan("");
        }
    }

    async function handleSendMemberPromotion(member) {
        if (!member?.user_id || !storeToken) return;
        const title = window.prompt("Promotion title", "Special offer just for you");
        if (!title) return;
        const message = window.prompt("Promotion message", "Visit us this week and get a special discount.");
        if (!message) return;
        try {
            setMemberPromoSendingUserId(member.user_id);
            const result = await sendStoreMemberPromotion(storeToken, member.user_id, {
                title: String(title).trim(),
                message: String(message).trim(),
            });
            alert(result?.message || "Promotion sent.");
        } catch (e) {
            alert(e.message || "Failed to send promotion");
            if (String(e.message || "").toLowerCase().includes("upgrade")) {
                setActiveTab("subscription");
            }
        } finally {
            setMemberPromoSendingUserId(null);
        }
    }

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
            if (typeof window !== "undefined") {
                window.sessionStorage.setItem("cc_store_token", loginData.token);
                window.localStorage.removeItem("cc_store_token");
            }
            if (onStoreToken) onStoreToken(loginData.token);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        if (!signupClaimCode || (!signupEmail && !signupPhone) || !signupPassword) {
            setErr("Claim code, password, and at least email or phone are required.");
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

        const utm = getUtmFromUrl();
        try {
            setErr("");
            setLoading(true);
            const data = await storeSignup(
                signupClaimCode,
                signupEmail,
                signupPhone,
                signupPassword,
                "web",
                utm.utm_source,
                utm.utm_medium,
                utm.utm_campaign
            );
            setStoreToken(data.token);
            if (typeof window !== "undefined") {
                window.sessionStorage.setItem("cc_store_token", data.token);
                window.localStorage.removeItem("cc_store_token");
            }
            if (onStoreToken) onStoreToken(data.token);
            setShowSignup(false);
            // Location will be prompted after login
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleStoreForgotPassword() {
        if (!resetPhone) {
            setErr("Phone number is required");
            return;
        }
        const cleanedPhone = resetPhone.replace(/\D/g, "");
        if (cleanedPhone.length !== 10) {
            setErr("Phone number must be exactly 10 digits");
            return;
        }
        try {
            setErr("");
            setResetMessage("");
            setLoading(true);
            const res = await forgotPasswordStore(cleanedPhone);
            setResetMessage(res.message || "Reset code sent to your phone number");
            setResetRequested(true);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleStoreResetPassword() {
        if (!resetCode) {
            setErr("Reset code is required");
            return;
        }
        if (!resetNewPassword || resetNewPassword.length < 6) {
            setErr("Password must be at least 6 characters");
            return;
        }
        if (resetNewPassword !== resetConfirmPassword) {
            setErr("Passwords do not match");
            return;
        }
        const cleanedPhone = resetPhone.replace(/\D/g, "");
        try {
            setErr("");
            setResetMessage("");
            setLoading(true);
            const res = await resetPasswordStore(cleanedPhone, resetCode, resetNewPassword);
            setResetMessage(res.message || "Password reset successfully. You can now login.");
            setTimeout(() => {
                setShowForgotPassword(false);
                setResetRequested(false);
                setResetCode("");
                setResetNewPassword("");
                setResetConfirmPassword("");
                setResetMessage("");
            }, 2000);
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
        setSubscriptionInfo(null);
        setSubscriptionPlans(defaultSubscriptionPlans);
        setSubscriptionFeatureMatrix(defaultSubscriptionFeatureMatrix);
        setSubscriptionMessage("");
        setCustomersToday([]);
        setCustomersAccess({ can_view_customer_identity: true, upgrade_message: "" });
        setMembersAccess({ can_view_customer_identity: true, upgrade_message: "" });
        setShowSignup(false);
        if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("cc_store_token");
            window.sessionStorage.removeItem("cc_store_active_tab");
            window.localStorage.removeItem("cc_store_token");
        }
        if (onStoreToken) onStoreToken("");
    }

    async function handleSaveProfile() {
        try {
            setProfileMessage("");
            setProfileSaving(true);
            const payload = {
                opened_month: openedMonth ? Number(openedMonth) : null,
                opened_year: openedYear ? Number(openedYear) : null,
                profile_image_url: profileImageUrl ? profileImageUrl.trim() : null,
            };
            const result = await updateStoreProfile(storeToken, payload);
            setStoreInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        opened_month: result.opened_month ?? payload.opened_month,
                        opened_year: result.opened_year ?? payload.opened_year,
                        profile_image_url: result.profile_image_url ?? payload.profile_image_url,
                    }
                    : prev
            );
            setProfileMessage("Profile updated.");
        } catch (e) {
            setProfileMessage(e.message || "Failed to update profile");
        } finally {
            setProfileSaving(false);
        }
    }

    async function handleProfileImageChange(e) {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (!files.length) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
            setProfileCropFile(file);
            setProfileCropSrc(String(reader.result || ""));
            setProfileCropScale(1);
            setProfileCropOffset({ x: 0, y: 0 });
            const img = new Image();
            img.onload = () => {
                setProfileCropImageSize({ width: img.width, height: img.height });
            };
            img.src = String(reader.result || "");
            setProfileCropOpen(true);
        };
        reader.readAsDataURL(file);
    }

    const clampCropOffset = (offset, scale, containerSize) => {
        const { width, height } = profileCropImageSize;
        if (!width || !height) return offset;
        const baseScale = Math.max(containerSize / width, containerSize / height);
        const totalScale = baseScale * scale;
        const drawW = width * totalScale;
        const drawH = height * totalScale;
        const maxX = Math.max(0, (drawW - containerSize) / 2);
        const maxY = Math.max(0, (drawH - containerSize) / 2);
        return {
            x: Math.min(maxX, Math.max(-maxX, offset.x)),
            y: Math.min(maxY, Math.max(-maxY, offset.y)),
        };
    };

    const handleCropPointerDown = (clientX, clientY) => {
        profileCropDragRef.current = {
            active: true,
            startX: clientX,
            startY: clientY,
            originX: profileCropOffset.x,
            originY: profileCropOffset.y,
        };
    };

    const handleCropPointerMove = (clientX, clientY) => {
        if (!profileCropDragRef.current.active) return;
        const deltaX = clientX - profileCropDragRef.current.startX;
        const deltaY = clientY - profileCropDragRef.current.startY;
        const next = {
            x: profileCropDragRef.current.originX + deltaX,
            y: profileCropDragRef.current.originY + deltaY,
        };
        setProfileCropOffset(clampCropOffset(next, profileCropScale, 280));
    };

    const handleCropPointerUp = () => {
        profileCropDragRef.current.active = false;
    };

    const resetProfileCrop = () => {
        setProfileCropScale(1);
        setProfileCropOffset({ x: 0, y: 0 });
    };

    const getTouchDistance = (touches) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    async function saveProfileCrop() {
        if (!profileCropFile || !profileCropSrc) return;
        try {
            setProfileMessage("");
            setProfileSaving(true);
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = profileCropSrc;
            });
            const canvas = document.createElement("canvas");
            const previewSize = 280;
            const size = 320;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas not supported");

            const baseScale = Math.max(previewSize / image.width, previewSize / image.height);
            const previewScale = baseScale * profileCropScale;
            const srcSize = previewSize / previewScale;
            const frameCenter = previewSize / 2;
            let srcX = image.width / 2 - (frameCenter + profileCropOffset.x) / previewScale;
            let srcY = image.height / 2 - (frameCenter + profileCropOffset.y) / previewScale;
            srcX = Math.max(0, Math.min(image.width - srcSize, srcX));
            srcY = Math.max(0, Math.min(image.height - srcSize, srcY));

            ctx.save();
            ctx.clearRect(0, 0, size, size);
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
            ctx.restore();

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("Failed to prepare image");
            const croppedFile = new File([blob], "profile-photo.png", { type: "image/png" });

            const result = await uploadStoreMedia(storeToken, croppedFile);
            if (!result?.url) throw new Error("Upload failed");

            const payload = {
                opened_month: openedMonth ? Number(openedMonth) : null,
                opened_year: openedYear ? Number(openedYear) : null,
                profile_image_url: result.url,
            };
            const updated = await updateStoreProfile(storeToken, payload);
            setStoreInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        opened_month: updated.opened_month ?? payload.opened_month,
                        opened_year: updated.opened_year ?? payload.opened_year,
                        profile_image_url: updated.profile_image_url ?? payload.profile_image_url,
                    }
                    : prev
            );
            setProfileImageUrl(updated.profile_image_url ?? payload.profile_image_url);
            setProfileMessage("Profile photo updated.");
            setProfileCropOpen(false);
        } catch (e) {
            setProfileMessage(e.message || "Failed to update profile photo");
        } finally {
            setProfileSaving(false);
        }
    }

    async function loadPromotions() {
        if (!storeToken) return;
        try {
            setPromotionsLoading(true);
            const data = await fetchStorePromotions(storeToken);
            setPromotions(data.promotions || []);
        } catch (e) {
            setPromoMessage(e.message || "Failed to load promotions");
        } finally {
            setPromotionsLoading(false);
        }
    }

    async function loadUpdates() {
        if (!storeToken) return;
        try {
            setUpdatesLoading(true);
            const data = await fetchStoreUpdates(storeToken);
            setUpdates(data.updates || []);
        } catch (e) {
            setUpdateMessage(e.message || "Failed to load updates");
        } finally {
            setUpdatesLoading(false);
        }
    }

    async function loadPosts() {
        if (!storeToken) return;
        try {
            setPostsLoading(true);
            const data = await fetchStorePosts(storeToken);
            setPosts(data.posts || []);
        } catch (e) {
            setPostMessage(e.message || "Failed to load posts");
        } finally {
            setPostsLoading(false);
        }
    }

    async function loadSubscription() {
        if (!storeToken) return;
        try {
            setSubscriptionLoading(true);
            const data = await fetchStoreSubscription(storeToken);
            setSubscriptionInfo(data.subscription || null);
            setSubscriptionPlans(data.plans || defaultSubscriptionPlans);
            setSubscriptionFeatureMatrix(data.feature_matrix || defaultSubscriptionFeatureMatrix);
            setSubscriptionMessage("");
        } catch (e) {
            if (isMissingSubscriptionEndpointError(e)) {
                setSubscriptionInfo(null);
                setSubscriptionPlans(defaultSubscriptionPlans);
                setSubscriptionFeatureMatrix(defaultSubscriptionFeatureMatrix);
                setSubscriptionMessage("Subscription endpoint not found. Please restart backend server.");
            } else {
                setSubscriptionMessage(e.message || "Failed to load subscription");
            }
        } finally {
            setSubscriptionLoading(false);
        }
    }

    async function loadRewardSchedules() {
        if (!storeToken) return;
        try {
            setRewardSchedulesLoading(true);
            const data = await fetchStoreRewardSchedules(storeToken);
            setRewardSchedules(data.schedules || []);
        } catch (e) {
            setRewardScheduleMessage(e.message || "Failed to load reward schedules");
        } finally {
            setRewardSchedulesLoading(false);
        }
    }

    async function loadRewardAutomationData() {
        if (!storeToken) return;
        try {
            setRewardRecommendationsLoading(true);
            setHolidayRemindersLoading(true);
            const [prefsData, recData, holidayData] = await Promise.all([
                fetchStoreRewardPreferences(storeToken),
                fetchStoreRewardRecommendations(storeToken),
                fetchStoreHolidayReminders(storeToken),
            ]);
            setRewardAutomationMode(prefsData?.preferences?.automation_mode || "auto");
            setRewardRecommendations(recData?.recommendations || []);
            setHolidayReminders(holidayData?.reminders || []);
        } catch (e) {
            setRewardAutomationMessage(e.message || "Failed to load automation settings");
        } finally {
            setRewardRecommendationsLoading(false);
            setHolidayRemindersLoading(false);
        }
    }

    async function saveRewardAutomationMode() {
        try {
            setRewardAutomationMessage("");
            const result = await updateStoreRewardPreferences(storeToken, {
                automation_mode: rewardAutomationMode,
                weekly_digest_enabled: 1,
            });
            setRewardAutomationMode(result?.preferences?.automation_mode || rewardAutomationMode);
            setRewardAutomationMessage("Automation mode updated.");
        } catch (e) {
            setRewardAutomationMessage(e.message || "Failed to update automation mode");
        }
    }

    async function handleApplyRecommendation(recommendationId) {
        try {
            setRewardAutomationMessage("");
            await applyStoreRewardRecommendation(storeToken, recommendationId);
            setRewardAutomationMessage("Recommendation applied as schedule.");
            await Promise.all([loadRewardSchedules(), loadRewardAutomationData()]);
        } catch (e) {
            setRewardAutomationMessage(e.message || "Failed to apply recommendation");
        }
    }

    async function handleHolidayReminderAction(reminderId, action) {
        try {
            setRewardAutomationMessage("");
            await respondStoreHolidayReminder(storeToken, reminderId, action);
            setRewardAutomationMessage("Holiday reminder updated.");
            await Promise.all([loadRewardSchedules(), loadRewardAutomationData()]);
        } catch (e) {
            setRewardAutomationMessage(e.message || "Failed to update holiday reminder");
        }
    }

    function applyScheduleTemplate(template) {
        const start = new Date();
        const end = new Date(start.getTime() + template.hours * 60 * 60 * 1000);
        setScheduleForm((prev) => ({
            ...prev,
            name: template.name,
            reason: template.reason,
            mode: template.mode,
            fixed_points: template.fixed_points ?? prev.fixed_points,
            multiplier: template.multiplier ?? prev.multiplier,
            start_at: start.toISOString().slice(0, 16),
            end_at: end.toISOString().slice(0, 16),
        }));
    }

    async function handleCreateRewardSchedule(e) {
        e.preventDefault();
        try {
            setRewardScheduleMessage("");
            const payload = {
                name: scheduleForm.name.trim(),
                reason: scheduleForm.reason.trim(),
                mode: scheduleForm.mode,
                fixed_points: Number(scheduleForm.fixed_points),
                multiplier: Number(scheduleForm.multiplier),
                start_at: scheduleForm.start_at ? new Date(scheduleForm.start_at).toISOString() : null,
                end_at: scheduleForm.end_at ? new Date(scheduleForm.end_at).toISOString() : null,
            };
            const result = await createStoreRewardSchedule(storeToken, payload);
            setRewardSchedules((prev) => [result.schedule, ...prev]);
            setRewardScheduleMessage("Schedule created.");
            setScheduleForm({
                name: "",
                reason: "",
                mode: "fixed",
                fixed_points: Math.max(5, Number(offerForm.reward_points || 10)),
                multiplier: 1.2,
                start_at: "",
                end_at: "",
            });
        } catch (e2) {
            setRewardScheduleMessage(e2.message || "Failed to create schedule");
        }
    }

    async function toggleRewardScheduleActive(schedule, nextActive) {
        try {
            setRewardScheduleMessage("");
            const payload = {
                ...schedule,
                is_active: nextActive ? 1 : 0,
            };
            const result = await updateStoreRewardSchedule(storeToken, schedule.id, payload);
            setRewardSchedules((prev) => prev.map((row) => (row.id === schedule.id ? result.schedule : row)));
            setRewardScheduleMessage(nextActive ? "Schedule activated." : "Schedule deactivated.");
            await loadRewardSchedules();
        } catch (e) {
            setRewardScheduleMessage(e.message || "Failed to update schedule");
        }
    }

    async function handleCreatePromotion(e) {
        e.preventDefault();
        try {
            setPromoMessage("");
            const payload = {
                title: promoForm.title.trim(),
                description: promoForm.description,
                discount_type: promoForm.discount_type,
                discount_value: promoForm.discount_value === "" ? null : Number(promoForm.discount_value),
                start_at: promoForm.start_at || null,
                end_at: promoForm.end_at || null,
            };
            const created = await createStorePromotion(storeToken, payload);
            setPromotions((prev) => [created, ...prev]);
            setPromoForm({
                title: "",
                description: "",
                discount_type: "percent",
                discount_value: "",
                start_at: "",
                end_at: "",
            });
            await loadSubscription();
            setPromoMessage("Promotion published.");
        } catch (e) {
            setPromoMessage(e.message || "Failed to publish promotion");
        }
    }

    async function handleCreateUpdate(e) {
        e.preventDefault();
        try {
            setUpdateMessage("");
            const payload = {
                title: updateForm.title.trim(),
                body: updateForm.body,
                media_urls: updateForm.media_urls,
                pinned: updateForm.pinned,
                start_at: updateForm.start_at || null,
                end_at: updateForm.end_at || null,
            };
            const created = await createStoreUpdate(storeToken, payload);
            setUpdates((prev) => [created, ...prev]);
            setUpdateForm({
                title: "",
                body: "",
                media_urls: [],
                pinned: false,
                start_at: "",
                end_at: "",
            });
            await loadSubscription();
            setUpdateMessage("Update posted.");
        } catch (e) {
            setUpdateMessage(e.message || "Failed to post update");
        }
    }

    async function handleCreatePost(e) {
        e.preventDefault();
        try {
            setPostMessage("");
            if (postForm.post_type !== "text" && !postForm.media_url.trim() && postForm.media_urls.length === 0) {
                setPostMessage("Please upload a file or provide a media URL.");
                return;
            }
            const payload = {
                post_type: postForm.post_type,
                caption: postForm.caption,
                media_url: postForm.media_url.trim(),
                media_urls: postForm.media_urls,
            };
            const created = await createStorePost(storeToken, payload);
            setPosts((prev) => [created, ...prev]);
            setPostForm({ post_type: "text", caption: "", media_url: "", media_urls: [] });
            await loadSubscription();
            setPostMessage("Post shared.");
        } catch (e) {
            setPostMessage(e.message || "Failed to share post");
        }
    }

    async function handlePostFileChange(e) {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (!files.length) return;
        await uploadFilesForForm(
            files,
            postForm.post_type === "mixed" ? "all" : postForm.post_type,
            (urls) =>
                setPostForm((prev) => ({
                    ...prev,
                    post_type: prev.post_type === "text" ? "mixed" : prev.post_type,
                    media_urls: [...prev.media_urls, ...urls],
                    media_url: prev.media_url || urls[0] || "",
                })),
            setPostUploading,
            setPostMessage
        );
        if (files[0]) {
            setPostMediaName(files[0].name);
        }
    }

    async function uploadFilesForForm(files, type, addUrls, setUploading, setMessage) {
        setMessage("");
        const validFiles = [];
        const imageExts = [".jpg", ".jpeg", ".png"];
        const videoExts = [".mp4", ".mov"];

        for (const file of files) {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");
            const nameLower = String(file.name || "").toLowerCase();
            const hasImageExt = imageExts.some((ext) => nameLower.endsWith(ext));
            const hasVideoExt = videoExts.some((ext) => nameLower.endsWith(ext));
            if (type === "video" && !isVideo) {
                setMessage("Please choose video files only.");
                return;
            }
            if (type === "image" && !isImage) {
                setMessage("Please choose image files only.");
                return;
            }
            if (!isImage && !isVideo) {
                setMessage("Unsupported file type.");
                return;
            }
            if (isImage && !hasImageExt) {
                setMessage("Only JPG, JPEG, PNG images are allowed.");
                return;
            }
            if (isVideo && !hasVideoExt) {
                setMessage("Only MP4 or MOV videos are allowed.");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setMessage("File is too large (max 5MB each).");
                return;
            }
            if (type === "all" || (type === "image" && isImage) || (type === "video" && isVideo)) {
                validFiles.push(file);
            }
        }

        if (!validFiles.length) return [];
        try {
            setUploading(true);
            const uploadedUrls = [];
            for (const file of validFiles) {
                const result = await uploadStoreMedia(storeToken, file);
                if (result?.url) uploadedUrls.push(result.url);
            }
            if (uploadedUrls.length) {
                addUrls(uploadedUrls);
            }
            return uploadedUrls;
        } catch (e) {
            setMessage(e.message || "Failed to upload files.");
            return [];
        } finally {
            setUploading(false);
        }
    }

    async function handlePromoFiles(e) {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (!files.length) return;
        await uploadFilesForForm(
            files,
            "all",
            (urls) =>
                setPromoForm((prev) => ({
                    ...prev,
                    media_urls: [...prev.media_urls, ...urls],
                })),
            setPromoUploading,
            setPromoMessage
        );
    }

    async function handleUpdateFiles(e) {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (!files.length) return;
        await uploadFilesForForm(
            files,
            "all",
            (urls) =>
                setUpdateForm((prev) => ({
                    ...prev,
                    media_urls: [...prev.media_urls, ...urls],
                })),
            setUpdateUploading,
            setUpdateMessage
        );
    }

    async function loadContent() {
        if (!storeToken) return;
        try {
            setContentLoading(true);
            setContentMessage("");
            const data = await fetchStoreContent(storeToken, {
                type: manageType,
                status: manageStatus,
            });
            setContentItems(data.content || []);
        } catch (e) {
            setContentMessage(e.message || "Failed to load content");
        } finally {
            setContentLoading(false);
        }
    }

    function startEdit(item) {
        setEditItem(item);
        if (item.type === "promotion") {
            setEditForm({
                title: item.title || "",
                description: item.description || "",
                media_urls: item.media_urls || [],
                discount_type: item.discount_type || "percent",
                discount_value: item.discount_value ?? "",
                start_at: item.start_at || "",
                end_at: item.end_at || "",
            });
        } else if (item.type === "update") {
            setEditForm({
                title: item.title || "",
                body: item.body || "",
                media_urls: item.media_urls || [],
                pinned: !!item.pinned,
                start_at: item.start_at || "",
                end_at: item.end_at || "",
            });
        } else if (item.type === "post") {
            setEditForm({
                post_type: item.post_type || "text",
                caption: item.caption || "",
                media_url: item.media_url || "",
                media_urls: item.media_urls || [],
                start_at: item.start_at || "",
                end_at: item.end_at || "",
            });
        }
    }

    function cancelEdit() {
        setEditItem(null);
        setEditForm({});
    }

    async function saveEdit() {
        if (!editItem) return;
        try {
            setContentMessage("");
            if (editItem.type === "promotion") {
                await updateStorePromotion(storeToken, editItem.id, {
                    title: editForm.title,
                    description: editForm.description,
                    media_urls: editForm.media_urls,
                    discount_type: editForm.discount_type,
                    discount_value: editForm.discount_value,
                    start_at: editForm.start_at || null,
                    end_at: editForm.end_at || null,
                });
            } else if (editItem.type === "update") {
                await updateStoreUpdate(storeToken, editItem.id, {
                    title: editForm.title,
                    body: editForm.body,
                    media_urls: editForm.media_urls,
                    pinned: editForm.pinned,
                    start_at: editForm.start_at || null,
                    end_at: editForm.end_at || null,
                });
            } else if (editItem.type === "post") {
                await updateStorePost(storeToken, editItem.id, {
                    post_type: editForm.post_type,
                    caption: editForm.caption,
                    media_url: editForm.media_url,
                    media_urls: editForm.media_urls,
                    start_at: editForm.start_at || null,
                    end_at: editForm.end_at || null,
                });
            }
            cancelEdit();
            await loadContent();
        } catch (e) {
            setContentMessage(e.message || "Failed to save changes");
        }
    }

    async function handleArchive(item) {
        try {
            await archiveStoreContent(storeToken, item.type, item.id);
            await loadContent();
        } catch (e) {
            setContentMessage(e.message || "Failed to archive");
        }
    }

    async function handleUnarchive(item) {
        try {
            await unarchiveStoreContent(storeToken, item.type, item.id);
            await loadContent();
        } catch (e) {
            setContentMessage(e.message || "Failed to unarchive");
        }
    }

    async function handleDelete(item) {
        try {
            if (!confirm(`Delete this ${item.type}? This cannot be undone.`)) return;
            if (item.type === "promotion") {
                await deleteStorePromotion(storeToken, item.id);
            } else if (item.type === "update") {
                await deleteStoreUpdate(storeToken, item.id);
            } else if (item.type === "post") {
                await deleteStorePost(storeToken, item.id);
            }
            await loadContent();
        } catch (e) {
            setContentMessage(e.message || "Failed to delete");
        }
    }

    async function handleShare(item) {
        const title = item.type === "post" ? "Store Post" : item.title || "Store Update";
        const text = item.type === "post" ? item.caption || "" : item.description || item.body || "";
        const media = (item.media_urls && item.media_urls[0]) || item.media_url || "";
        const shareData = { title, text: text.replace(/<[^>]+>/g, "").slice(0, 140), url: media };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else if (navigator.clipboard) {
                const payload = [title, shareData.text, shareData.url].filter(Boolean).join("\n");
                await navigator.clipboard.writeText(payload);
                setContentMessage("Share info copied to clipboard.");
            }
        } catch (e) {
            setContentMessage(e.message || "Failed to share");
        }
    }

    const previewBaseScale =
        profileCropImageSize.width && profileCropImageSize.height
            ? Math.max(280 / profileCropImageSize.width, 280 / profileCropImageSize.height)
            : 1;

    return (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Login/Signup box - only show when not logged in */}
            {!storeToken && (
            <div style={loginCard}>
                <h3 style={{ marginTop: 0 }}>
                    {showForgotPassword ? "Reset Password" : showSignup ? "Store Signup" : "Store Login"}
                </h3>
                {showForgotPassword ? (
                    <div>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="tel"
                                placeholder="Phone Number"
                                value={resetPhone}
                                onChange={(e) => setResetPhone(e.target.value)}
                            />
                            <p style={{ fontSize: 11, color: "var(--cc-muted)", margin: "4px 0 0 0" }}>
                                Enter the phone number on your store account
                            </p>
                        </div>
                        <button type="button" style={button} onClick={handleStoreForgotPassword} disabled={loading}>
                            {loading ? "Sending..." : "Send SMS Code"}
                        </button>
                        {resetRequested && (
                            <div style={{ marginTop: 12 }}>
                                <input
                                    style={input}
                                    type="text"
                                    placeholder="6-digit code"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                />
                                <input
                                    style={input}
                                    type="password"
                                    placeholder="New password"
                                    value={resetNewPassword}
                                    onChange={(e) => setResetNewPassword(e.target.value)}
                                />
                                <input
                                    style={input}
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={resetConfirmPassword}
                                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                                />
                                <button type="button" style={button} onClick={handleStoreResetPassword} disabled={loading}>
                                    {loading ? "Resetting..." : "Reset Password"}
                                </button>
                            </div>
                        )}
                        <div style={{ marginTop: 12, textAlign: "center" }}>
                            <button
                                style={linkButton}
                                type="button"
                                onClick={() => {
                                    setShowForgotPassword(false);
                                    setResetRequested(false);
                                    setResetCode("");
                                    setResetNewPassword("");
                                    setResetConfirmPassword("");
                                    setResetMessage("");
                                    setErr("");
                                }}
                            >
                                Back to login
                            </button>
                        </div>
                    </div>
                ) : !showSignup ? (
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
                            <p style={{ fontSize: 11, color: "var(--cc-muted)", margin: "4px 0 0 0" }}>
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
                                style={{ ...button, backgroundColor: "var(--cc-danger)", marginLeft: 8 }}
                            >
                                Logout
                            </button>
                        )}
                        <div style={{ marginTop: 10, textAlign: "center" }}>
                            <button
                                style={linkButton}
                                type="button"
                                onClick={() => {
                                    setShowForgotPassword(true);
                                    setResetRequested(false);
                                    setResetCode("");
                                    setResetNewPassword("");
                                    setResetConfirmPassword("");
                                    setResetMessage("");
                                    setErr("");
                                }}
                            >
                                Forgot password?
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSignup}>
                        <div style={{ marginBottom: 12 }}>
                            <input
                                style={input}
                                type="text"
                                placeholder="Claim Code (required)"
                                value={signupClaimCode}
                                onChange={(e) => setSignupClaimCode(e.target.value)}
                                required
                            />
                            <p style={{ fontSize: 11, color: "var(--cc-muted)", margin: "4px 0 0 0" }}>
                                Get this code from CityCircle Admin to verify ownership.
                            </p>
                        </div>
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
                            <p style={{ fontSize: 11, color: "var(--cc-muted)", margin: "4px 0 0 0" }}>
                                At least one (email or phone) is required for verification
                            </p>
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
                        <button type="submit" style={button} disabled={loading}>
                            {loading ? "Signing up..." : "Sign Up"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowSignup(false);
                                setErr("");
                            }}
                            style={{ ...button, backgroundColor: "var(--cc-muted)", marginLeft: 8 }}
                        >
                            Cancel
                        </button>
                    </form>
                )}
                {!showSignup && !showForgotPassword && !storeToken && (
                    <div style={{ marginTop: 12, textAlign: "center", padding: "8px 0", borderTop: "1px solid var(--cc-border)" }}>
                        <button
                            type="button"
                            style={linkButton}
                            onClick={() => {
                                trackEvent("store_signup_started", getUtmFromUrl());
                                setShowSignup(true);
                                setErr("");
                            }}
                        >
                            Don't have an account? Sign up
                        </button>
                    </div>
                )}
                {resetMessage && <div style={successText}>{resetMessage}</div>}
                {err && <div style={{ color: "var(--cc-danger)", marginTop: 12, fontSize: 13 }}>{err}</div>}
            </div>
            )}

            {profileCropOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                        padding: 16,
                    }}
                    onClick={() => setProfileCropOpen(false)}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 420,
                            background: "var(--cc-surface)",
                            borderRadius: 16,
                            border: "1px solid var(--cc-border)",
                            boxShadow: "var(--cc-shadow-lg)",
                            padding: 20,
                            display: "grid",
                            gap: 12,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: 16, fontWeight: 800 }}>Adjust profile photo</div>
                        <div
                            style={{
                                width: 280,
                                height: 280,
                                borderRadius: "50%",
                                border: "2px solid var(--cc-border)",
                                overflow: "hidden",
                                margin: "0 auto",
                                background: "var(--cc-surface-2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                position: "relative",
                                cursor: profileCropDragRef.current.active ? "grabbing" : "grab",
                            }}
                            onMouseDown={(e) => handleCropPointerDown(e.clientX, e.clientY)}
                            onMouseMove={(e) => handleCropPointerMove(e.clientX, e.clientY)}
                            onMouseUp={handleCropPointerUp}
                            onMouseLeave={handleCropPointerUp}
                            onTouchStart={(e) => {
                                if (e.touches.length === 2) {
                                    profileCropPinchRef.current = {
                                        active: true,
                                        startDistance: getTouchDistance(e.touches),
                                        startScale: profileCropScale,
                                    };
                                    return;
                                }
                                const now = Date.now();
                                if (now - profileCropTapRef.current.lastTap < 300) {
                                    resetProfileCrop();
                                }
                                profileCropTapRef.current.lastTap = now;
                                const touch = e.touches[0];
                                if (touch) handleCropPointerDown(touch.clientX, touch.clientY);
                            }}
                            onTouchMove={(e) => {
                                if (e.touches.length === 2 && profileCropPinchRef.current.active) {
                                    const distance = getTouchDistance(e.touches);
                                    if (profileCropPinchRef.current.startDistance > 0) {
                                        const rawScale =
                                            (distance / profileCropPinchRef.current.startDistance) *
                                            profileCropPinchRef.current.startScale;
                                        const nextScale = Math.min(2.5, Math.max(1, rawScale));
                                        setProfileCropScale(nextScale);
                                        setProfileCropOffset((prev) => clampCropOffset(prev, nextScale, 280));
                                    }
                                    return;
                                }
                                const touch = e.touches[0];
                                if (touch) handleCropPointerMove(touch.clientX, touch.clientY);
                            }}
                            onTouchEnd={() => {
                                profileCropPinchRef.current.active = false;
                                handleCropPointerUp();
                            }}
                        >
                            {profileCropSrc && (
                                <img
                                    src={profileCropSrc}
                                    alt="Preview"
                                    style={{
                                        position: "absolute",
                                        left: "50%",
                                        top: "50%",
                                        transform: `translate(-50%, -50%) translate(${profileCropOffset.x}px, ${profileCropOffset.y}px) scale(${previewBaseScale * profileCropScale})`,
                                        transformOrigin: "center",
                                        width: profileCropImageSize.width ? `${profileCropImageSize.width}px` : "100%",
                                        height: profileCropImageSize.height ? `${profileCropImageSize.height}px` : "100%",
                                        objectFit: "cover",
                                        transition: "transform 0.05s linear",
                                    }}
                                />
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--cc-muted)" }}>Zoom</span>
                            <input
                                type="range"
                                min="1"
                                max="2.5"
                                step="0.01"
                                value={profileCropScale}
                                onChange={(e) => {
                                    const nextScale = Number(e.target.value);
                                    setProfileCropScale(nextScale);
                                    setProfileCropOffset((prev) => clampCropOffset(prev, nextScale, 280));
                                }}
                                style={{ flex: 1 }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                style={{ ...button, background: "var(--cc-surface-2)", color: "var(--cc-text)" }}
                                onClick={() => setProfileCropOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="button" style={button} onClick={saveProfileCrop} disabled={profileSaving}>
                                {profileSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard */}
            <div style={dashboardCard}>
                <h2 style={{ marginTop: 0 }}>Store Dashboard</h2>

                {storeToken && storeInfo && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--cc-border)", paddingBottom: 8 }}>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "dashboard" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "dashboard" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={() => setActiveTab("dashboard")}
                        >
                            Dashboard
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "analytics" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "analytics" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={() => setActiveTab("analytics")}
                        >
                            Analytics
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "giftcards" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "giftcards" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={async () => {
                                setActiveTab("giftcards");
                                try {
                                    const pendingCards = await getPendingPhysicalGiftCards(storeToken);
                                    setPendingPhysicalGiftCards(pendingCards.giftCards || []);
                                } catch (e) {
                                }
                            }}
                        >
                            📦 Physical Gift Cards
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "members" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "members" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={async () => {
                                setActiveTab("members");
                                try {
                                    setMembersLoading(true);
                                    const data = await fetchStoreMembers(storeToken, { limit: 200 });
                                    setMembers(data.members || []);
                                    setMembersAccess(
                                        data.access || {
                                            can_view_customer_identity: true,
                                            upgrade_message: "",
                                        }
                                    );
                                } catch (e) {
                                    setErr("Error loading members: " + (e.message || "Unknown error"));
                                } finally {
                                    setMembersLoading(false);
                                }
                            }}
                        >
                            👥 Members
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "promotions" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "promotions" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={() => setActiveTab("promotions")}
                        >
                            📣 Promotions & Updates
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "rewards" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "rewards" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={async () => {
                                setActiveTab("rewards");
                                await loadRewardSchedules();
                            }}
                        >
                            🎯 Rewards & Visibility
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "manage" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "manage" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={() => setActiveTab("manage")}
                        >
                            🧭 Manage Content
                        </button>
                        <button
                            style={{
                                ...tabButton,
                                background: activeTab === "subscription" ? "var(--cc-primary)" : "transparent",
                                color: activeTab === "subscription" ? "#fff" : "var(--cc-muted)",
                            }}
                            onClick={async () => {
                                setActiveTab("subscription");
                                await loadSubscription();
                            }}
                        >
                            💳 Subscription & Pricing
                        </button>
                    </div>
                )}

                {!storeToken && (
                    <p style={{ fontSize: 14, color: "var(--cc-muted)" }}>
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
                                    <strong>Location:</strong>{" "}
                                    {storeInfo.latitude && storeInfo.longitude ? (
                                        <>{storeInfo.address || `${storeInfo.latitude.toFixed(4)}, ${storeInfo.longitude.toFixed(4)}`}</>
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
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Store Profile Photo</div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                        <button
                                            type="button"
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: "50%",
                                                border: "1px solid var(--cc-border)",
                                                background: "var(--cc-surface-2)",
                                                overflow: "hidden",
                                                cursor: "pointer",
                                                padding: 0,
                                            }}
                                            onClick={() => profileImageInputRef.current?.click()}
                                        >
                                            {profileImageUrl ? (
                                                <img
                                                    src={profileImageUrl}
                                                    alt="Store"
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                        borderRadius: "50%",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : (
                                                <span
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        width: "100%",
                                                        height: "100%",
                                                        fontWeight: 700,
                                                        color: "var(--cc-primary)",
                                                    }}
                                                >
                                                    {String(storeInfo.name || "S").slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                        </button>
                                        <input
                                            ref={profileImageInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={handleProfileImageChange}
                                        />
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                            Tap the circle to upload a photo.
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Opened Since</div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                        <select
                                            style={{ ...input, width: 140 }}
                                            value={openedMonth}
                                            onChange={(e) => setOpenedMonth(e.target.value)}
                                        >
                                            <option value="">Month</option>
                                            {[
                                                "January",
                                                "February",
                                                "March",
                                                "April",
                                                "May",
                                                "June",
                                                "July",
                                                "August",
                                                "September",
                                                "October",
                                                "November",
                                                "December",
                                            ].map((label, idx) => (
                                                <option key={label} value={String(idx + 1)}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            style={{ ...input, width: 120 }}
                                            type="number"
                                            min="1900"
                                            max="2100"
                                            placeholder="Year"
                                            value={openedYear}
                                            onChange={(e) => setOpenedYear(e.target.value)}
                                        />
                                        <button
                                            style={{ ...smallButton }}
                                            disabled={profileSaving}
                                            onClick={handleSaveProfile}
                                        >
                                            {profileSaving ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                    {profileMessage && (
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 6 }}>
                                            {profileMessage}
                                        </div>
                                    )}
                                </div>
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: 12,
                                        border: "1px solid var(--cc-border)",
                                        borderRadius: 8,
                                        background: "var(--cc-surface-2)",
                                    }}
                                >
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Rewards & Visibility</div>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 8 }}>
                                        Use the dedicated tab to control points, gift-card eligibility, and holiday/festival schedules.
                                    </div>
                                    <button
                                        style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                        onClick={() => setActiveTab("rewards")}
                                    >
                                        Open Rewards & Visibility
                                    </button>
                                </div>
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: 12,
                                        border: "1px solid var(--cc-border)",
                                        borderRadius: 8,
                                        background: "var(--cc-surface-2)",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                        <div style={{ fontWeight: 600 }}>Subscription</div>
                                        <button
                                            style={{ ...smallButton, fontSize: 11, padding: "4px 8px" }}
                                            onClick={loadSubscription}
                                            disabled={subscriptionLoading}
                                        >
                                            {subscriptionLoading ? "Refreshing..." : "Refresh"}
                                        </button>
                                    </div>
                                    {subscriptionInfo ? (
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 8 }}>
                                            <div>
                                                <strong>Plan:</strong> {subscriptionInfo.plan?.label || "-"} ({subscriptionInfo.status || "-"})
                                            </div>
                                            <div style={{ marginTop: 4 }}>
                                                <strong>Content this month:</strong> {subscriptionInfo.usage?.total || 0}
                                                {typeof subscriptionInfo.plan?.monthly_content_limit === "number"
                                                    ? ` / ${subscriptionInfo.plan.monthly_content_limit}`
                                                    : " / Unlimited"}
                                            </div>
                                            {subscriptionInfo.plan?.id === "trial" && subscriptionInfo.trial_ends_at && (
                                                <div style={{ marginTop: 4 }}>
                                                    <strong>Trial ends:</strong> {new Date(subscriptionInfo.trial_ends_at).toLocaleString()}
                                                </div>
                                            )}
                                            <div style={{ marginTop: 4 }}>
                                                <strong>AI credits:</strong> {subscriptionInfo.ai_credits_used || 0} / {subscriptionInfo.plan?.ai_monthly_limit || 0}
                                            </div>
                                            <div style={{ marginTop: 6, color: "var(--cc-primary)", fontSize: 11 }}>
                                                Billing integration and self-serve upgrade flow are coming next.
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 8 }}>
                                            No subscription data yet.
                                        </div>
                                    )}
                                    {subscriptionMessage && (
                                        <div style={{ fontSize: 11, color: "var(--cc-danger)", marginTop: 6 }}>
                                            {subscriptionMessage}
                                        </div>
                                    )}
                                    <div style={{ marginTop: 10 }}>
                                        <button
                                            style={{ ...smallButton, fontSize: 11 }}
                                            onClick={async () => {
                                                setActiveTab("subscription");
                                                await loadSubscription();
                                            }}
                                        >
                                            View all plans, features, and pricing
                                        </button>
                                    </div>
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
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--cc-surface-2)"}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                            title="Click to zoom"
                                        >
                                            <QRCodeCanvas ref={storeQrRef} value={storeInfo.qr_code} size={140} />
                                        </div>
                                        <div style={{ position: "absolute", left: -9999, top: -9999 }}>
                                            <QRCodeCanvas ref={storeQrPrintRef} value={storeInfo.qr_code} size={900} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
                                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                                <button
                                                    style={{ ...smallButton, fontSize: 12 }}
                                                    onClick={() => downloadQrCanvas(storeQrPrintRef.current || storeQrRef.current, `store-${storeInfo.id}-qr.png`)}
                                                >
                                                    Download
                                                </button>
                                                <button
                                                    style={{ ...smallButton, fontSize: 12 }}
                                                    onClick={() =>
                                                        printQrCanvas(
                                                            storeQrPrintRef.current || storeQrRef.current,
                                                            `${storeInfo.name} QR`,
                                                            storeInfo.name
                                                        )
                                                    }
                                                >
                                                    Print
                                                </button>
                                            </div>
                                            <button
                                                style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                                onClick={() => setShowQRScanner(true)}
                                            >
                                                📷 Scan Customer QR
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ padding: 20, color: "var(--cc-muted)", fontSize: 13 }}>
                                        <p style={{ margin: "0 0 12px 0" }}>QR code not available</p>
                                        <button
                                            style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                            onClick={async () => {
                                                try {
                                                    setLoading(true);
                                                    setErr("");
                                                    // Refresh store data - QR code should be generated on backend if missing
                                                    const { store, stats } = await fetchStoreMe(storeToken);
                                                    setStoreInfo(store);
                                                    setStats(stats);
                                                } catch (e) {
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

                            {/* NFC Setup temporarily disabled */}

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
                        </h4>
                        {scannedCustomer && (
                            <div
                                style={{
                                    ...card,
                                    marginTop: 12,
                                    backgroundColor: scannedCustomer.customer.isBlacklisted
                                        ? "rgba(239, 68, 68, 0.08)"
                                        : "rgba(14, 165, 233, 0.08)",
                                    border: `1px solid ${
                                        scannedCustomer.customer.isBlacklisted
                                            ? "rgba(239, 68, 68, 0.3)"
                                            : "rgba(14, 165, 233, 0.3)"
                                    }`,
                                }}
                            >
                                <h5 style={{ marginTop: 0 }}>
                                    Scanned Customer
                                    {scannedCustomer.customer.isBlacklisted && (
                                        <span style={{ marginLeft: 8, color: "var(--cc-danger)", fontSize: 12 }}>🚫 BLACKLISTED</span>
                                    )}
                                </h5>
                                {scannedCustomer.customer.isBlacklisted && scannedCustomer.customer.blacklistReason && (
                                    <p style={{ color: "var(--cc-danger)", fontSize: 12, marginTop: -8, marginBottom: 8 }}>
                                        Reason: {scannedCustomer.customer.blacklistReason}
                                    </p>
                                )}
                                <p><strong>Name:</strong> {scannedCustomer.customer.name}</p>
                                <p><strong>Phone:</strong> {scannedCustomer.customer.phone}</p>
                                <p><strong>Loops Balance:</strong> {scannedCustomer.customer.loopsBalance}</p>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 6 }}>
                                    Rush mode: use quick reward (no typing). Manual amount is optional.
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                    <button
                                        style={{ ...button, backgroundColor: "var(--cc-success)" }}
                                        onClick={async () => {
                                            if (scannedCustomer.customer.isBlacklisted) {
                                                alert("This customer is blacklisted and cannot make transactions.");
                                                return;
                                            }
                                            setTransactionLoading(true);
                                            try {
                                                const result = await createQuickTransaction(storeToken, {
                                                    userId: scannedCustomer.customer.id,
                                                });
                                                alert(
                                                    `Quick transaction created. Loops awarded: ${result?.loopsEarned || 0}`
                                                );
                                                setScannedCustomer(null);
                                                setTransactionAmount("");
                                                const { store, stats } = await fetchStoreMe(storeToken);
                                                setStoreInfo(store);
                                                setStats(stats);
                                                const ct = await fetchStoreCustomersToday(storeToken);
                                                setCustomersToday(ct.customers || []);
                                                setCustomersAccess(
                                                    ct.access || {
                                                        can_view_customer_identity: true,
                                                        upgrade_message: "",
                                                    }
                                                );
                                            } catch (e) {
                                                alert("Error: " + e.message);
                                            } finally {
                                                setTransactionLoading(false);
                                            }
                                        }}
                                        disabled={transactionLoading || scannedCustomer.customer.isBlacklisted}
                                    >
                                        {transactionLoading ? "Processing..." : "Quick Reward (No Amount)"}
                                    </button>
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
                                            if (scannedCustomer.customer.isBlacklisted) {
                                                alert("This customer is blacklisted and cannot make transactions.");
                                                return;
                                            }
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
                                                setCustomersAccess(
                                                    ct.access || {
                                                        can_view_customer_identity: true,
                                                        upgrade_message: "",
                                                    }
                                                );
                                            } catch (e) {
                                                alert("Error: " + e.message);
                                            } finally {
                                                setTransactionLoading(false);
                                            }
                                        }}
                                        disabled={transactionLoading || scannedCustomer.customer.isBlacklisted}
                                    >
                                        {transactionLoading ? "Processing..." : scannedCustomer.customer.isBlacklisted ? "Customer Blacklisted" : "Create Transaction"}
                                    </button>
                                    <button
                                        style={{ ...button, backgroundColor: "var(--cc-muted)" }}
                                        onClick={() => {
                                            setScannedCustomer(null);
                                            setTransactionAmount("");
                                        }}
                                    >
                                        Clear
                                    </button>
                                    {!scannedCustomer.customer.isBlacklisted && (
                                        <button
                                            style={{ ...button, backgroundColor: "var(--cc-danger)" }}
                                            onClick={() => {
                                                setBlacklistingUserId(scannedCustomer.customer.id);
                                                setShowBlacklistReason(true);
                                                setBlacklistReason("");
                                            }}
                                        >
                                            🚫 Block Customer
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        {showBlacklistReason && (
                            <div
                                style={{
                                    ...card,
                                    marginTop: 12,
                                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                }}
                            >
                                <h5 style={{ marginTop: 0 }}>Block Customer</h5>
                                <p style={{ fontSize: 13, marginBottom: 8 }}>Enter a reason for blocking this customer (optional):</p>
                                <textarea
                                    style={{ ...input, width: "100%", minHeight: 60, marginBottom: 12 }}
                                    placeholder="e.g., Fraudulent behavior, Policy violation, etc."
                                    value={blacklistReason}
                                    onChange={(e) => setBlacklistReason(e.target.value)}
                                />
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        style={{ ...button, flex: 1, backgroundColor: "var(--cc-danger)" }}
                                        onClick={async () => {
                                            try {
                                                await addToBlacklist(storeToken, blacklistingUserId, blacklistReason);
                                                alert("Customer blocked successfully");
                                                setShowBlacklistReason(false);
                                                setBlacklistingUserId(null);
                                                setBlacklistReason("");
                                                setScannedCustomer(null);
                                                // Refresh blacklist
                                                const result = await fetchStoreBlacklist(storeToken);
                                                setBlacklistedCustomers(result.blacklisted || []);
                                            } catch (e) {
                                                alert("Error: " + e.message);
                                            }
                                        }}
                                    >
                                        Confirm Block
                                    </button>
                                    <button
                                        style={{ ...button, flex: 1, backgroundColor: "var(--cc-muted)" }}
                                        onClick={() => {
                                            setShowBlacklistReason(false);
                                            setBlacklistingUserId(null);
                                            setBlacklistReason("");
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        {scannedGiftCard && (
                            <div
                                style={{
                                    ...card,
                                    marginTop: 12,
                                    backgroundColor: scannedGiftCard.valid
                                        ? "rgba(16, 185, 129, 0.08)"
                                        : "rgba(239, 68, 68, 0.08)",
                                    border: `1px solid ${
                                        scannedGiftCard.valid
                                            ? "rgba(16, 185, 129, 0.3)"
                                            : "rgba(239, 68, 68, 0.3)"
                                    }`,
                                }}
                            >
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
                                            <p style={{ fontSize: 11, color: "var(--cc-muted)", margin: "4px 0 8px 0" }}>
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
                                                style={{ ...button, flex: 1, background: "var(--cc-muted)" }}
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
                                        <p style={{ color: "var(--cc-danger)", fontSize: 14, fontWeight: 600 }}>
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
                            <p style={{ fontSize: 13, color: "var(--cc-muted)" }}>
                                No Loops transactions recorded today yet.
                            </p>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                {customersAccess?.can_view_customer_identity === false && (
                                    <div
                                        style={{
                                            marginBottom: 8,
                                            padding: 10,
                                            border: "1px dashed var(--cc-primary)",
                                            borderRadius: 8,
                                            fontSize: 12,
                                            color: "var(--cc-muted)",
                                            background: "var(--cc-surface-2)",
                                        }}
                                    >
                                        <strong style={{ color: "var(--cc-primary)" }}>New customer activity detected.</strong>{" "}
                                        {customersAccess.upgrade_message || "Upgrade to unlock full customer names, phone numbers, and direct promotion tools."}
                                    </div>
                                )}
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Date & Time</th>
                                            <th style={th}>Customer</th>
                                            <th style={th}>Phone</th>
                                            <th style={{ ...th, textAlign: "center" }}>Visits</th>
                                            <th style={{ ...th, textAlign: "right" }}>Loops</th>
                                            <th style={th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customersToday.map((c) => {
                                            const canViewCustomerIdentity = customersAccess?.can_view_customer_identity !== false;
                                            const isBlacklisted = canViewCustomerIdentity
                                                ? blacklistedCustomers.some((b) => b.user_id === c.user_id)
                                                : false;
                                            return (
                                                <tr key={c.id}>
                                                    <td style={td}>
                                                        {c.timestamp ? new Date(c.timestamp).toLocaleString() : "N/A"}
                                                    </td>
                                                    <td style={td}>{c.user_name}</td>
                                                    <td style={td}>{c.user_phone || c.user_email || "N/A"}</td>
                                                    <td style={{ ...td, textAlign: "center", fontWeight: "600", color: "var(--cc-primary)" }}>
                                                        {c.visit_count || 0}
                                                    </td>
                                                    <td style={{ ...td, textAlign: "right", color: "var(--cc-success)", fontWeight: "bold" }}>
                                                        +{c.loops_earned || c.loops_awarded || 0}
                                                    </td>
                                                    <td style={td}>
                                                        {!canViewCustomerIdentity ? (
                                                            <button
                                                                style={{ ...button, fontSize: 11, padding: "4px 8px", backgroundColor: "var(--cc-primary)" }}
                                                                onClick={() => setActiveTab("subscription")}
                                                            >
                                                                Upgrade to unlock
                                                            </button>
                                                        ) : isBlacklisted ? (
                                                            <button
                                                                style={{ ...button, fontSize: 11, padding: "4px 8px", backgroundColor: "var(--cc-success)" }}
                                                                onClick={async () => {
                                                                    if (confirm(`Remove ${c.user_name} from blacklist?`)) {
                                                                        try {
                                                                            await removeFromBlacklist(storeToken, c.user_id);
                                                                            const result = await fetchStoreBlacklist(storeToken);
                                                                            setBlacklistedCustomers(result.blacklisted || []);
                                                                            alert("Customer removed from blacklist");
                                                                        } catch (e) {
                                                                            alert("Error: " + e.message);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                Unblock
                                                            </button>
                                                        ) : (
                                                            <button
                                                                style={{ ...button, fontSize: 11, padding: "4px 8px", backgroundColor: "var(--cc-danger)" }}
                                                                onClick={() => {
                                                                    setBlacklistingUserId(c.user_id);
                                                                    setShowBlacklistReason(true);
                                                                    setBlacklistReason("");
                                                                }}
                                                            >
                                                                Block
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "subscription" && storeToken && storeInfo && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Active Subscription Details</h3>
                            {subscriptionInfo ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 12 }}>
                                    <div><strong>Plan:</strong> {subscriptionInfo.plan?.label || "-"}</div>
                                    <div><strong>Status:</strong> {subscriptionInfo.status || "-"}</div>
                                    <div><strong>Active Since:</strong> {subscriptionInfo.started_at ? new Date(subscriptionInfo.started_at).toLocaleString() : "-"}</div>
                                    <div><strong>Period Start:</strong> {subscriptionInfo.current_period_start ? new Date(subscriptionInfo.current_period_start).toLocaleString() : "-"}</div>
                                    <div>
                                        <strong>Current Price:</strong> {subscriptionInfo.plan ? getPlanPriceLabel(subscriptionInfo.plan) : "-"}
                                    </div>
                                    <div>
                                        <strong>Content Usage:</strong> {subscriptionInfo.usage?.total || 0}
                                        {typeof subscriptionInfo.plan?.monthly_content_limit === "number"
                                            ? ` / ${subscriptionInfo.plan.monthly_content_limit}`
                                            : " / Unlimited"}
                                    </div>
                                    <div><strong>AI Credits:</strong> {subscriptionInfo.ai_credits_used || 0} / {subscriptionInfo.plan?.ai_monthly_limit || 0}</div>
                                    <div><strong>Trial Ends:</strong> {subscriptionInfo.trial_ends_at ? new Date(subscriptionInfo.trial_ends_at).toLocaleString() : "-"}</div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                    No subscription data available.
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                <div>
                                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>Subscription Plans & Pricing</h3>
                                    <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                        Compare all plans and see everything included in each model.
                                    </p>
                                </div>
                                <button style={{ ...smallButton, fontSize: 12 }} onClick={loadSubscription} disabled={subscriptionLoading}>
                                    {subscriptionLoading ? "Refreshing..." : "Refresh"}
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
                                {subscriptionPlans.map((plan) => {
                                    const isCurrent = getCurrentPlanId() === String(plan.id || "").toLowerCase();
                                    return (
                                        <div
                                            key={plan.id}
                                            style={{
                                                border: isCurrent ? "2px solid var(--cc-primary)" : "1px solid var(--cc-border)",
                                                borderRadius: 10,
                                                background: "var(--cc-surface-2)",
                                                padding: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                                <div style={{ fontWeight: 700 }}>{plan.label}</div>
                                                {isCurrent ? (
                                                    <span style={{ fontSize: 11, color: "var(--cc-primary)", fontWeight: 700 }}>Current</span>
                                                ) : null}
                                            </div>
                                            <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                                                <div style={{ fontSize: 18, fontWeight: 700 }}>{getPlanPriceLabel(plan)}</div>
                                                {getPlanListPrice(plan) > getPlanCurrentPrice(plan) && (
                                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", textDecoration: "line-through" }}>
                                                        ${getPlanListPrice(plan)}/month
                                                    </div>
                                                )}
                                            </div>
                                            {!!plan.launch_discount_label && (
                                                <div style={{ fontSize: 11, color: "var(--cc-success)", fontWeight: 700 }}>
                                                    {plan.launch_discount_label}
                                                </div>
                                            )}
                                            <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>Billed monthly (payment flow coming soon)</div>
                                            <div style={{ marginTop: 10, fontSize: 12, color: "var(--cc-muted)" }}>
                                                <div>Content: {typeof plan.monthly_content_limit === "number" ? `${plan.monthly_content_limit}/month` : "Unlimited"}</div>
                                                <div>AI credits: {plan.ai_monthly_limit || 0}/month</div>
                                            </div>
                                            <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--cc-text)" }}>
                                                {(plan.features || []).map((f) => (
                                                    <li key={`${plan.id}-${f}`} style={{ marginBottom: 4 }}>
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div style={{ marginTop: 10 }}>
                                                <button
                                                    style={{ ...smallButton, width: "100%", background: "var(--cc-primary)", color: "#fff" }}
                                                    onClick={() => handleActivatePlan(plan.id)}
                                                    disabled={isCurrent || subscriptionActivatingPlan === String(plan.id)}
                                                >
                                                    {isCurrent
                                                        ? "Current Plan"
                                                        : subscriptionActivatingPlan === String(plan.id)
                                                            ? "Activating..."
                                                            : `Upgrade to ${plan.label}`}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Feature Comparison</h3>
                            <div style={{ overflowX: "auto" }}>
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Feature</th>
                                            <th style={th}>Trial</th>
                                            <th style={th}>Starter</th>
                                            <th style={th}>Growth</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscriptionFeatureMatrix.map((row) => (
                                            <tr key={row.key}>
                                                <td style={td}>{row.label}</td>
                                                <td style={td}>{row.values?.trial || "-"}</td>
                                                <td style={td}>{row.values?.starter || "-"}</td>
                                                <td style={td}>{row.values?.growth || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: 10, fontSize: 12, color: "var(--cc-muted)" }}>
                                Need a plan change now? Contact admin support and they can switch your plan instantly.
                            </div>
                            {subscriptionMessage && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "var(--cc-danger)" }}>
                                    {subscriptionMessage}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "rewards" && storeToken && storeInfo && (
                    <div style={{ display: "grid", gap: 16 }}>
                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Automation Mode</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                For busy local owners: use Auto or Guided so rewards adjust with minimal effort.
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                                <select
                                    style={{ ...input, maxWidth: 260 }}
                                    value={rewardAutomationMode}
                                    onChange={(e) => setRewardAutomationMode(e.target.value)}
                                >
                                    <option value="auto">Auto (recommended)</option>
                                    <option value="guided">Guided (approve suggestions)</option>
                                    <option value="manual">Manual (full control)</option>
                                </select>
                                <button
                                    style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                    onClick={saveRewardAutomationMode}
                                >
                                    Save mode
                                </button>
                            </div>
                            {rewardAutomationMessage && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "var(--cc-muted)" }}>
                                    {rewardAutomationMessage}
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Smart Recommendations</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                One-click suggestions for holiday/festival/rush scenarios.
                            </p>
                            {rewardRecommendationsLoading ? (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Loading recommendations...</div>
                            ) : rewardRecommendations.length === 0 ? (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>No recommendations right now.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {rewardRecommendations.map((rec) => (
                                        <div key={rec.id} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 10, background: "var(--cc-surface-2)" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-text)" }}>{rec.title}</div>
                                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 4 }}>
                                                {rec.reason}
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 4 }}>
                                                {rec.mode === "multiplier" ? `${rec.multiplier}x multiplier` : `${rec.fixed_points} points`} • {new Date(rec.start_at).toLocaleString()} - {new Date(rec.end_at).toLocaleString()}
                                            </div>
                                            {rec.estimated_impact && (
                                                <div style={{ fontSize: 11, color: "var(--cc-info)", marginTop: 4 }}>
                                                    {rec.estimated_impact}
                                                </div>
                                            )}
                                            <div style={{ marginTop: 8 }}>
                                                <button
                                                    style={{ ...smallButton, fontSize: 11 }}
                                                    onClick={() => handleApplyRecommendation(rec.id)}
                                                >
                                                    Apply Recommendation
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>US Holiday Reminders</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                We track major US holidays and remind you to adjust rewards. In Auto mode, suggestions can be applied automatically.
                            </p>
                            {holidayRemindersLoading ? (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Loading holiday reminders...</div>
                            ) : holidayReminders.length === 0 ? (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>No upcoming holidays in the next 45 days.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {holidayReminders.map((h) => (
                                        <div key={h.id} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 10, background: "var(--cc-surface-2)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-text)" }}>{h.holiday_name}</div>
                                                <div style={{ fontSize: 11, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                                                    {h.action || "pending"}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 4 }}>
                                                {new Date(h.start_at).toLocaleDateString()} • Suggested: {h.suggested_mode === "multiplier" ? `${h.suggested_multiplier}x` : `${h.suggested_fixed_points} points`}
                                            </div>
                                            {!h.action && (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                                                    <button style={{ ...smallButton, fontSize: 11 }} onClick={() => handleHolidayReminderAction(h.id, "auto_apply")}>
                                                        Auto apply
                                                    </button>
                                                    <button style={{ ...smallButton, fontSize: 11 }} onClick={() => handleHolidayReminderAction(h.id, "manual_later")}>
                                                        Adjust manually
                                                    </button>
                                                    <button style={{ ...smallButton, fontSize: 11 }} onClick={() => handleHolidayReminderAction(h.id, "skip")}>
                                                        Skip
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Rewards & Visibility</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                Keep this simple: set your normal points, then optionally schedule temporary holiday/festival overrides.
                            </p>
                            <div style={{ display: "grid", gap: 10 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                                    <label style={{ fontSize: 12 }}>
                                        Reward tier
                                        <select
                                            style={{ ...input, marginTop: 4 }}
                                            value={offerForm.reward_tier}
                                            onChange={(e) => setOfferForm({ ...offerForm, reward_tier: e.target.value })}
                                        >
                                            <option value="standard">Standard</option>
                                            <option value="boosted">Boosted</option>
                                            <option value="premium">Premium</option>
                                        </select>
                                    </label>
                                    <label style={{ fontSize: 12 }}>
                                        Base points per visit
                                        <input
                                            style={{ ...input, marginTop: 4 }}
                                            type="number"
                                            min="0"
                                            value={offerForm.reward_points}
                                            onChange={(e) =>
                                                setOfferForm({
                                                    ...offerForm,
                                                    reward_points: Number(e.target.value || 0),
                                                })
                                            }
                                        />
                                    </label>
                                    <label style={{ fontSize: 12 }}>
                                        Gift card eligibility (loops)
                                        <input
                                            style={{ ...input, marginTop: 4 }}
                                            type="number"
                                            min="500"
                                            max="1000"
                                            step="50"
                                            value={offerForm.gift_card_min_loops}
                                            onChange={(e) =>
                                                setOfferForm({
                                                    ...offerForm,
                                                    gift_card_min_loops: Math.max(500, Math.min(1000, Number(e.target.value || 1000))),
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>
                                    Customers become eligible for this store's gift card at {offerForm.gift_card_min_loops} loops (min 500, max 1000).
                                </div>
                                <label style={{ fontSize: 12 }}>
                                    Store news
                                    <input
                                        style={{ ...input, marginTop: 4 }}
                                        type="text"
                                        value={offerForm.news}
                                        onChange={(e) => setOfferForm({ ...offerForm, news: e.target.value })}
                                    />
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button
                                        style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                        disabled={offerSaving}
                                        onClick={async () => {
                                            try {
                                                setOfferSaving(true);
                                                setOfferMessage("");
                                                const result = await updateStoreOffer(storeToken, offerForm);
                                                setStoreInfo((prev) => (prev ? { ...prev, offer: result.offer } : prev));
                                                setOfferMessage("Reward settings saved.");
                                            } catch (e) {
                                                setOfferMessage(e.message || "Failed to save offer");
                                            } finally {
                                                setOfferSaving(false);
                                            }
                                        }}
                                    >
                                        {offerSaving ? "Saving..." : "Save reward settings"}
                                    </button>
                                    {offerMessage && <span style={{ fontSize: 12, color: "var(--cc-muted)" }}>{offerMessage}</span>}
                                </div>
                            </div>
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Scheduled Point Overrides</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                Use this for temporary changes only (holiday, festival, rush hours).
                            </p>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                {[
                                    { name: "Holiday Rush +20%", reason: "Holiday rush", mode: "multiplier", multiplier: 1.2, hours: 8 },
                                    { name: "Festival Promo +5", reason: "Festival offer", mode: "fixed", fixed_points: Number(offerForm.reward_points || 10) + 5, hours: 6 },
                                    { name: "Low Margin -10%", reason: "Cost control", mode: "multiplier", multiplier: 0.9, hours: 4 },
                                ].map((tpl) => (
                                    <button
                                        key={tpl.name}
                                        style={{ ...smallButton, fontSize: 11 }}
                                        onClick={() => applyScheduleTemplate(tpl)}
                                    >
                                        {tpl.name}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={handleCreateRewardSchedule} style={{ display: "grid", gap: 10 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                                    <input
                                        style={input}
                                        type="text"
                                        placeholder="Schedule name (e.g., Holiday Evening Boost)"
                                        value={scheduleForm.name}
                                        onChange={(e) => setScheduleForm((prev) => ({ ...prev, name: e.target.value }))}
                                        required
                                    />
                                    <select
                                        style={input}
                                        value={scheduleForm.mode}
                                        onChange={(e) => setScheduleForm((prev) => ({ ...prev, mode: e.target.value }))}
                                    >
                                        <option value="fixed">Fixed points</option>
                                        <option value="multiplier">Multiplier</option>
                                    </select>
                                    {scheduleForm.mode === "fixed" ? (
                                        <input
                                            style={input}
                                            type="number"
                                            min="5"
                                            max="50"
                                            value={scheduleForm.fixed_points}
                                            onChange={(e) => setScheduleForm((prev) => ({ ...prev, fixed_points: Number(e.target.value || 5) }))}
                                        />
                                    ) : (
                                        <input
                                            style={input}
                                            type="number"
                                            min="0.5"
                                            max="2"
                                            step="0.05"
                                            value={scheduleForm.multiplier}
                                            onChange={(e) => setScheduleForm((prev) => ({ ...prev, multiplier: Number(e.target.value || 1) }))}
                                        />
                                    )}
                                    <input
                                        style={input}
                                        type="datetime-local"
                                        value={scheduleForm.start_at}
                                        onChange={(e) => setScheduleForm((prev) => ({ ...prev, start_at: e.target.value }))}
                                        required
                                    />
                                    <input
                                        style={input}
                                        type="datetime-local"
                                        value={scheduleForm.end_at}
                                        onChange={(e) => setScheduleForm((prev) => ({ ...prev, end_at: e.target.value }))}
                                        required
                                    />
                                </div>
                                <input
                                    style={input}
                                    type="text"
                                    placeholder="Reason (optional)"
                                    value={scheduleForm.reason}
                                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, reason: e.target.value }))}
                                />
                                <button style={{ ...button, width: "fit-content" }} type="submit">
                                    Create Schedule
                                </button>
                                {rewardScheduleMessage && <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>{rewardScheduleMessage}</div>}
                            </form>
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Schedule List</h3>
                            {rewardSchedulesLoading ? (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Loading schedules...</div>
                            ) : rewardSchedules.length === 0 ? (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>No schedules yet.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {rewardSchedules.map((s) => (
                                        <div key={s.id} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 10, background: "var(--cc-surface-2)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-text)" }}>{s.name}</div>
                                                <div style={{ fontSize: 11, color: s.status === "active" ? "var(--cc-success)" : "var(--cc-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                                                    {s.status || (s.is_active ? "scheduled" : "ended")}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 4 }}>
                                                {s.mode === "multiplier" ? `${s.multiplier}x multiplier` : `${s.fixed_points} points`}
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 2 }}>
                                                {new Date(s.start_at).toLocaleString()} - {new Date(s.end_at).toLocaleString()}
                                            </div>
                                            {s.reason && <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 2 }}>{s.reason}</div>}
                                            <div style={{ marginTop: 8 }}>
                                                <button
                                                    style={{ ...smallButton, fontSize: 11 }}
                                                    onClick={() => toggleRewardScheduleActive(s, !(s.is_active === 1))}
                                                >
                                                    {s.is_active === 1 ? "Deactivate" : "Activate"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "promotions" && storeToken && storeInfo && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Promotions & Discounts</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                Share deals that help nearby customers choose you today.
                            </p>
                            <form onSubmit={handleCreatePromotion} style={{ display: "grid", gap: 10 }}>
                                <input
                                    style={input}
                                    type="text"
                                    placeholder="Title (e.g., 10% off for students)"
                                    value={promoForm.title}
                                    onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
                                    required
                                />
                                <div>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 6 }}>
                                        Promotion details (rich text)
                                    </div>
                                    <RichTextEditor
                                        value={promoForm.description}
                                        onChange={(value) => setPromoForm({ ...promoForm, description: value })}
                                    />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                                    <select
                                        style={input}
                                        value={promoForm.discount_type}
                                        onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value })}
                                    >
                                        <option value="percent">Percent</option>
                                        <option value="fixed">Fixed ($)</option>
                                        <option value="bogo">BOGO</option>
                                        <option value="free_item">Free item</option>
                                    </select>
                                    <input
                                        style={input}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Discount value"
                                        value={promoForm.discount_value}
                                        onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                                    />
                                    <input
                                        style={input}
                                        type="datetime-local"
                                        value={promoForm.start_at}
                                        onChange={(e) => setPromoForm({ ...promoForm, start_at: e.target.value })}
                                    />
                                    <input
                                        style={input}
                                        type="datetime-local"
                                        value={promoForm.end_at}
                                        onChange={(e) => setPromoForm({ ...promoForm, end_at: e.target.value })}
                                    />
                                </div>
                                <button style={button} type="submit">
                                    Publish Promotion
                                </button>
                                {promoMessage && <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>{promoMessage}</div>}
                            </form>
                            <div style={{ marginTop: 16, fontSize: 12, color: "var(--cc-muted)" }}>
                                Created promotions will appear in Manage Content.
                            </div>
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Major Updates</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                Announce changes like new menu items, hours, or events.
                            </p>
                            <form onSubmit={handleCreateUpdate} style={{ display: "grid", gap: 10 }}>
                                <input
                                    style={input}
                                    type="text"
                                    placeholder="Update title"
                                    value={updateForm.title}
                                    onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                                    required
                                />
                                <div>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 6 }}>
                                        Update details (rich text)
                                    </div>
                                    <RichTextEditor
                                        value={updateForm.body}
                                        onChange={(value) => setUpdateForm({ ...updateForm, body: value })}
                                    />
                                </div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                    <input
                                        style={input}
                                        type="file"
                                        accept="image/jpeg,image/png,video/mp4,video/quicktime"
                                        multiple
                                        onChange={handleUpdateFiles}
                                    />
                                    {updateUploading && (
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                            Uploading...
                                        </div>
                                    )}
                                </div>
                                {updateForm.media_urls.length > 0 && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                                        {updateForm.media_urls.map((url) => (
                                            <div key={url} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 6 }}>
                                                {url.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                                                    <video src={url} controls style={{ width: "100%", maxHeight: 120 }} />
                                                ) : (
                                                    <img src={url} alt="Update media" style={{ width: "100%", maxHeight: 120, objectFit: "cover" }} />
                                                )}
                                                <button
                                                    type="button"
                                                    style={{ ...smallButton, marginTop: 6, width: "100%" }}
                                                    onClick={() =>
                                                        setUpdateForm((prev) => ({
                                                            ...prev,
                                                            media_urls: prev.media_urls.filter((item) => item !== url),
                                                        }))
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                                        <input
                                            type="checkbox"
                                            checked={updateForm.pinned}
                                            onChange={(e) => setUpdateForm({ ...updateForm, pinned: e.target.checked })}
                                        />
                                        Pin to top
                                    </label>
                                    <input
                                        style={input}
                                        type="datetime-local"
                                        value={updateForm.start_at}
                                        onChange={(e) => setUpdateForm({ ...updateForm, start_at: e.target.value })}
                                    />
                                    <input
                                        style={input}
                                        type="datetime-local"
                                        value={updateForm.end_at}
                                        onChange={(e) => setUpdateForm({ ...updateForm, end_at: e.target.value })}
                                    />
                                </div>
                                <button style={button} type="submit">
                                    Post Update
                                </button>
                                {updateMessage && <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>{updateMessage}</div>}
                            </form>
                            <div style={{ marginTop: 16, fontSize: 12, color: "var(--cc-muted)" }}>
                                Created updates will appear in Manage Content.
                            </div>
                        </div>

                        <div style={card}>
                            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Posts</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                Share local stories, photos, and short updates to build trust.
                            </p>
                            <form onSubmit={handleCreatePost} style={{ display: "grid", gap: 10 }}>
                                <select
                                    style={input}
                                    value={postForm.post_type === "mixed" ? "files" : postForm.post_type}
                                    onChange={(e) => {
                                        const nextType = e.target.value;
                                        const normalized = nextType === "files" ? "mixed" : nextType;
                                        setPostForm((prev) => ({
                                            ...prev,
                                            post_type: normalized,
                                            media_url: normalized === "text" ? "" : prev.media_url,
                                            media_urls: normalized === "text" ? [] : prev.media_urls,
                                        }));
                                        if (normalized === "text") {
                                            setPostMediaName("");
                                        }
                                    }}
                                >
                                    <option value="text">Text</option>
                                    <option value="files">Files</option>
                                </select>
                                <div>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 6 }}>
                                        Post caption (rich text)
                                    </div>
                                    <RichTextEditor
                                        value={postForm.caption}
                                        onChange={(value) => setPostForm({ ...postForm, caption: value })}
                                    />
                                </div>
                                {postForm.post_type !== "text" && (
                                    <>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                            <input
                                                style={input}
                                                type="file"
                                                accept="image/jpeg,image/png,video/mp4,video/quicktime"
                                                multiple
                                                onChange={handlePostFileChange}
                                            />
                                            {postUploading && (
                                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                                    Uploading...
                                                </div>
                                            )}
                                            {postMediaName && (
                                                <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                                    {postMediaName}
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            style={input}
                                            type="url"
                                            placeholder="Media URL (optional if uploaded)"
                                            value={postForm.media_url}
                                            onChange={(e) => setPostForm({ ...postForm, media_url: e.target.value })}
                                        />
                                        {Array.from(new Set([postForm.media_url, ...postForm.media_urls].filter(Boolean)))
                                            .map((url) => {
                                                const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
                                                return (
                                                <div key={url} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 6 }}>
                                                    {postForm.post_type !== "text" && isVideo ? (
                                                        <video
                                                            src={url}
                                                            controls
                                                            style={{ width: "100%", maxHeight: 260 }}
                                                        />
                                                    ) : (
                                                        <img
                                                            src={url}
                                                            alt="Post preview"
                                                            style={{ width: "100%", maxHeight: 240, objectFit: "cover" }}
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        style={{ ...smallButton, marginTop: 6, width: "100%" }}
                                                        onClick={() =>
                                                            setPostForm((prev) => ({
                                                                ...prev,
                                                                media_url: prev.media_url === url ? "" : prev.media_url,
                                                                media_urls: prev.media_urls.filter((item) => item !== url),
                                                            }))
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                );
                                            })}
                                    </>
                                )}
                                <button style={button} type="submit" disabled={postUploading}>
                                    Share Post
                                </button>
                                {postMessage && <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>{postMessage}</div>}
                            </form>
                            <div style={{ marginTop: 16, fontSize: 12, color: "var(--cc-muted)" }}>
                                Created posts will appear in Manage Content.
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "manage" && storeToken && storeInfo && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={card}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                <div>
                                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>Manage Content</h3>
                                    <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 12 }}>
                                        Track active, scheduled, expired, and archived content in one place.
                                    </p>
                                </div>
                                <button style={{ ...button, fontSize: 12 }} onClick={loadContent}>
                                    🔄 Refresh
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
                                <select
                                    style={input}
                                    value={manageType}
                                    onChange={(e) => setManageType(e.target.value)}
                                >
                                    <option value="all">All types</option>
                                    <option value="promotion">Promotions</option>
                                    <option value="update">Updates</option>
                                    <option value="post">Posts</option>
                                </select>
                                <select
                                    style={input}
                                    value={manageStatus}
                                    onChange={(e) => setManageStatus(e.target.value)}
                                >
                                    <option value="all">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="expired">Expired</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                            {contentMessage && (
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 8 }}>
                                    {contentMessage}
                                </div>
                            )}
                        </div>

                        <div style={card}>
                            {contentLoading ? (
                                <p>Loading content...</p>
                            ) : contentItems.length === 0 ? (
                                <p style={{ color: "var(--cc-muted)" }}>No content found for the selected filters.</p>
                            ) : (
                                <div style={{ display: "grid", gap: 12 }}>
                                    {contentItems.map((item) => {
                                        const isArchived = item.computed_status === "archived";
                                        const title =
                                            item.type === "post" ? item.caption : item.title;
                                        const menuKey = `${item.type}-${item.id}`;
                                        const mediaUrls = (item.media_urls && item.media_urls.length > 0)
                                            ? item.media_urls
                                            : item.media_url
                                            ? [item.media_url]
                                            : [];
                                        return (
                                            <div
                                                key={`${item.type}-${item.id}`}
                                                style={{
                                                    padding: 16,
                                                    borderRadius: 14,
                                                    border: "1px solid var(--cc-border)",
                                                    background: "var(--cc-surface)",
                                                    boxShadow: "var(--cc-shadow-sm)",
                                                    display: "grid",
                                                    gap: 12,
                                                }}
                                                onClick={() => setMenuOpenId(null)}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--cc-primary)" }}>
                                                            {item.type.toUpperCase()}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: 10,
                                                                padding: "2px 6px",
                                                                borderRadius: 999,
                                                                background: "var(--cc-surface-2)",
                                                                color: "var(--cc-muted)",
                                                                border: "1px solid var(--cc-border)",
                                                            }}
                                                        >
                                                            {item.computed_status}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button style={{ ...smallButton }} onClick={() => setViewItem(item)}>
                                                            View
                                                        </button>
                                                        <div style={{ position: "relative" }}>
                                                            <button
                                                                type="button"
                                                                style={{ ...smallButton, width: 32, textAlign: "center" }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMenuOpenId(menuOpenId === menuKey ? null : menuKey);
                                                                }}
                                                            >
                                                                ⋯
                                                            </button>
                                                            {menuOpenId === menuKey && (
                                                                <div
                                                                    style={{
                                                                        position: "absolute",
                                                                        right: 0,
                                                                        top: "110%",
                                                                        background: "var(--cc-surface)",
                                                                        border: "1px solid var(--cc-border)",
                                                                        borderRadius: 10,
                                                                        padding: 6,
                                                                        display: "grid",
                                                                        gap: 6,
                                                                        minWidth: 140,
                                                                        zIndex: 5,
                                                                        boxShadow: "var(--cc-shadow-md)",
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <button style={smallButton} onClick={() => startEdit(item)}>
                                                                        Edit
                                                                    </button>
                                                                    {isArchived ? (
                                                                        <button style={smallButton} onClick={() => handleUnarchive(item)}>
                                                                            Unarchive
                                                                        </button>
                                                                    ) : (
                                                                        <button style={smallButton} onClick={() => handleArchive(item)}>
                                                                            Archive
                                                                        </button>
                                                                    )}
                                                                    <button style={{ ...smallButton, color: "var(--cc-danger)" }} onClick={() => handleDelete(item)}>
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
                                                    {item.type === "promotion" && item.description && (
                                                        <div
                                                            style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 6 }}
                                                            dangerouslySetInnerHTML={{ __html: item.description }}
                                                        />
                                                    )}
                                                    {item.type === "update" && item.body && (
                                                        <div
                                                            style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 6 }}
                                                            dangerouslySetInnerHTML={{ __html: item.body }}
                                                        />
                                                    )}
                                                    {item.type === "post" && item.caption && (
                                                        <div
                                                            style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 6 }}
                                                            dangerouslySetInnerHTML={{ __html: item.caption }}
                                                        />
                                                    )}
                                                </div>
                                                {mediaUrls.length > 0 && (
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                                                        {mediaUrls.slice(0, 4).map((url) => {
                                                            const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
                                                            return (
                                                                <div key={url} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--cc-border)" }}>
                                                                    {isVideo ? (
                                                                        <video src={url} controls style={{ width: "100%", maxHeight: 200 }} />
                                                                    ) : (
                                                                        <img src={url} alt="Media" style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <button style={{ ...smallButton, padding: "6px 10px" }} onClick={() => handleShare(item)}>
                                                        Share
                                                    </button>
                                                    <button style={{ ...smallButton, padding: "6px 10px", cursor: "default" }}>
                                                        ❤️ {item.like_count || 0}
                                                    </button>
                                                    {(item.start_at || item.end_at) && (
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>
                                                            {item.start_at ? `Start: ${new Date(item.start_at).toLocaleString()}` : "Start: —"}
                                                            {" · "}
                                                            {item.end_at ? `End: ${new Date(item.end_at).toLocaleString()}` : "End: —"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {editItem && (
                            <div style={card}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                    <h4 style={{ margin: 0 }}>Edit {editItem.type}</h4>
                                    <button style={{ ...smallButton }} onClick={cancelEdit}>
                                        Cancel
                                    </button>
                                </div>
                                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                                    {editItem.type === "promotion" && (
                                        <>
                                            <input
                                                style={input}
                                                type="text"
                                                value={editForm.title || ""}
                                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                            />
                                            <RichTextEditor
                                                value={editForm.description || ""}
                                                onChange={(value) => setEditForm({ ...editForm, description: value })}
                                            />
                                            {Array.isArray(editForm.media_urls) && editForm.media_urls.length > 0 && (
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                                                    {editForm.media_urls.map((url) => (
                                                        <div key={url} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 6 }}>
                                                            {url.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                                                                <video src={url} controls style={{ width: "100%", maxHeight: 120 }} />
                                                            ) : (
                                                                <img src={url} alt="Promo media" style={{ width: "100%", maxHeight: 120, objectFit: "cover" }} />
                                                            )}
                                                            <button
                                                                type="button"
                                                                style={{ ...smallButton, marginTop: 6, width: "100%" }}
                                                                onClick={() =>
                                                                    setEditForm((prev) => ({
                                                                        ...prev,
                                                                        media_urls: prev.media_urls.filter((item) => item !== url),
                                                                    }))
                                                                }
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                                                <select
                                                    style={input}
                                                    value={editForm.discount_type || "percent"}
                                                    onChange={(e) => setEditForm({ ...editForm, discount_type: e.target.value })}
                                                >
                                                    <option value="percent">Percent</option>
                                                    <option value="fixed">Fixed ($)</option>
                                                    <option value="bogo">BOGO</option>
                                                    <option value="free_item">Free item</option>
                                                </select>
                                                <input
                                                    style={input}
                                                    type="number"
                                                    step="0.01"
                                                    value={editForm.discount_value ?? ""}
                                                    onChange={(e) => setEditForm({ ...editForm, discount_value: e.target.value })}
                                                />
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={editForm.start_at || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                                                />
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={editForm.end_at || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {editItem.type === "update" && (
                                        <>
                                            <input
                                                style={input}
                                                type="text"
                                                value={editForm.title || ""}
                                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                            />
                                            <RichTextEditor
                                                value={editForm.body || ""}
                                                onChange={(value) => setEditForm({ ...editForm, body: value })}
                                            />
                                            {Array.isArray(editForm.media_urls) && editForm.media_urls.length > 0 && (
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                                                    {editForm.media_urls.map((url) => (
                                                        <div key={url} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 6 }}>
                                                            {url.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                                                                <video src={url} controls style={{ width: "100%", maxHeight: 120 }} />
                                                            ) : (
                                                                <img src={url} alt="Update media" style={{ width: "100%", maxHeight: 120, objectFit: "cover" }} />
                                                            )}
                                                            <button
                                                                type="button"
                                                                style={{ ...smallButton, marginTop: 6, width: "100%" }}
                                                                onClick={() =>
                                                                    setEditForm((prev) => ({
                                                                        ...prev,
                                                                        media_urls: prev.media_urls.filter((item) => item !== url),
                                                                    }))
                                                                }
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!editForm.pinned}
                                                    onChange={(e) => setEditForm({ ...editForm, pinned: e.target.checked })}
                                                />
                                                Pin to top
                                            </label>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={editForm.start_at || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                                                />
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={editForm.end_at || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {editItem.type === "post" && (
                                        <>
                                            <select
                                                style={input}
                                                value={(editForm.post_type || "text") === "mixed" ? "files" : (editForm.post_type || "text")}
                                                onChange={(e) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        post_type: e.target.value === "files" ? "mixed" : e.target.value,
                                                    })
                                                }
                                            >
                                                <option value="text">Text</option>
                                                <option value="mixed">Files</option>
                                            </select>
                                            <RichTextEditor
                                                value={editForm.caption || ""}
                                                onChange={(value) => setEditForm({ ...editForm, caption: value })}
                                            />
                                            <input
                                                style={input}
                                                type="url"
                                                placeholder="Media URL"
                                                value={editForm.media_url || ""}
                                                onChange={(e) => setEditForm({ ...editForm, media_url: e.target.value })}
                                            />
                                            {Array.isArray(editForm.media_urls) && editForm.media_urls.length > 0 && (
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                                                    {editForm.media_urls.map((url) => {
                                                        const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
                                                        return (
                                                            <div key={url} style={{ border: "1px solid var(--cc-border)", borderRadius: 8, padding: 6 }}>
                                                                {editForm.post_type !== "text" && isVideo ? (
                                                                    <video src={url} controls style={{ width: "100%", maxHeight: 120 }} />
                                                                ) : (
                                                                    <img src={url} alt="Post media" style={{ width: "100%", maxHeight: 120, objectFit: "cover" }} />
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    style={{ ...smallButton, marginTop: 6, width: "100%" }}
                                                                    onClick={() =>
                                                                        setEditForm((prev) => ({
                                                                            ...prev,
                                                                            media_urls: prev.media_urls.filter((item) => item !== url),
                                                                        }))
                                                                    }
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={editForm.start_at || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })}
                                                />
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={editForm.end_at || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <button style={button} onClick={saveEdit}>
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                        {viewItem && (
                            <div
                                style={{
                                    position: "fixed",
                                    inset: 0,
                                    background: "rgba(15, 23, 42, 0.55)",
                                    zIndex: 50,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 16,
                                }}
                                onClick={() => setViewItem(null)}
                            >
                                <div
                                    style={{
                                        width: "min(820px, 95vw)",
                                        background: "var(--cc-surface)",
                                        borderRadius: 16,
                                        border: "1px solid var(--cc-border)",
                                        overflow: "hidden",
                                        boxShadow: "var(--cc-shadow-lg)",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--cc-border)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--cc-primary)" }}>
                                                {viewItem.type.toUpperCase()}
                                            </span>
                                            <span style={{ fontSize: 11, color: "var(--cc-muted)" }}>{viewItem.computed_status}</span>
                                        </div>
                                        <button style={smallButton} onClick={() => setViewItem(null)}>
                                            Close
                                        </button>
                                    </div>
                                    {viewItem.media_urls && viewItem.media_urls.length > 0 && (
                                        <div style={{ background: "var(--cc-surface-2)" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, padding: 12 }}>
                                                {viewItem.media_urls.map((url) => {
                                                    const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
                                                    return (
                                                        <div key={url} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--cc-border)", background: "var(--cc-surface)" }}>
                                                            {isVideo ? (
                                                                <video src={url} controls style={{ width: "100%", maxHeight: 320 }} />
                                                            ) : (
                                                                <img src={url} alt="Media" style={{ width: "100%", maxHeight: 320, objectFit: "cover" }} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ padding: 16, display: "grid", gap: 10 }}>
                                        <div style={{ fontWeight: 800, fontSize: 16 }}>
                                            {viewItem.type === "post" ? "Post" : viewItem.title || "Content"}
                                        </div>
                                        {viewItem.type === "promotion" && viewItem.description && (
                                            <div dangerouslySetInnerHTML={{ __html: viewItem.description }} />
                                        )}
                                        {viewItem.type === "update" && viewItem.body && (
                                            <div dangerouslySetInnerHTML={{ __html: viewItem.body }} />
                                        )}
                                        {viewItem.type === "post" && viewItem.caption && (
                                            <div dangerouslySetInnerHTML={{ __html: viewItem.caption }} />
                                        )}
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            <button style={smallButton} onClick={() => handleShare(viewItem)}>
                                                Share
                                            </button>
                                            <button style={{ ...smallButton, cursor: "default" }}>
                                                ❤️ {viewItem.like_count || 0}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "analytics" && storeToken && storeInfo && (
                    <AnalyticsDashboard
                        token={storeToken}
                        userRole="store"
                        storeId={storeInfo.id}
                    />
                )}

                {activeTab === "blacklist" && storeToken && storeInfo && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                            <h3 style={{ marginTop: 0 }}>🚫 Blacklisted Customers</h3>
                            <button
                                style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                onClick={async () => {
                                    try {
                                        setBlacklistLoading(true);
                                        const result = await fetchStoreBlacklist(storeToken);
                                        setBlacklistedCustomers(result.blacklisted || []);
                                    } catch (e) {
                                        setErr("Error loading blacklist: " + e.message);
                                    } finally {
                                        setBlacklistLoading(false);
                                    }
                                }}
                            >
                                🔄 Refresh
                            </button>
                        </div>

                        {blacklistLoading ? (
                            <p>Loading blacklist...</p>
                        ) : blacklistedCustomers.length === 0 ? (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--cc-muted)" }}>
                                <p style={{ fontSize: 16, margin: "0 0 8px 0" }}>No blacklisted customers</p>
                                <p style={{ fontSize: 13 }}>Customers you block will appear here.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Customer</th>
                                            <th style={th}>Phone</th>
                                            <th style={th}>Email</th>
                                            <th style={th}>Plan</th>
                                            <th style={th}>Reason</th>
                                            <th style={th}>Blocked On</th>
                                            <th style={th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blacklistedCustomers.map((b) => (
                                            <tr key={b.id}>
                                                <td style={td}>{b.user_name}</td>
                                                <td style={td}>{b.user_phone || "N/A"}</td>
                                                <td style={td}>{b.user_email || "N/A"}</td>
                                                <td style={td}>{b.plan || "N/A"}</td>
                                                <td style={td}>{b.reason || <span style={{ color: "var(--cc-muted)", fontStyle: "italic" }}>No reason provided</span>}</td>
                                                <td style={td}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : "N/A"}</td>
                                                <td style={td}>
                                                    <button
                                                        style={{ ...button, fontSize: 11, padding: "4px 8px", backgroundColor: "var(--cc-success)" }}
                                                        onClick={async () => {
                                                            if (confirm(`Remove ${b.user_name} from blacklist?`)) {
                                                                try {
                                                                    await removeFromBlacklist(storeToken, b.user_id);
                                                                    const result = await fetchStoreBlacklist(storeToken);
                                                                    setBlacklistedCustomers(result.blacklisted || []);
                                                                    alert("Customer removed from blacklist");
                                                                } catch (e) {
                                                                    alert("Error: " + e.message);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        Unblock
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
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
                            <div style={{ padding: 40, textAlign: "center", color: "var(--cc-muted)" }}>
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
                                            background: "rgba(245, 158, 11, 0.12)", 
                                            borderRadius: 8, 
                                            border: "1px solid rgba(245, 158, 11, 0.35)" 
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
                                                        background: "rgba(245, 158, 11, 0.16)",
                                                        color: "var(--cc-warning)",
                                                        fontWeight: 600
                                                    }}>
                                                        ⏳ PENDING
                                                    </span>
                                                </div>
                                                <p style={{ margin: "4px 0", fontSize: 18, fontWeight: 700, color: "var(--cc-primary)" }}>
                                                    ${card.current_balance.toFixed(2)}
                                                </p>
                                                <p style={{ margin: "4px 0", fontSize: 13, color: "var(--cc-muted)" }}>
                                                    <strong>Customer:</strong> {card.customer_name || "Unknown"} 
                                                    {card.customer_phone && ` (${card.customer_phone})`}
                                                </p>
                                                <p style={{ margin: "4px 0", fontSize: 12, color: "var(--cc-muted)" }}>
                                                    <strong>Requested:</strong> {card.created_at ? new Date(card.created_at).toLocaleString() : "Unknown"}
                                                </p>
                                                <p style={{ margin: "4px 0", fontSize: 12, color: card.daysRemaining < 30 ? "var(--cc-warning)" : "var(--cc-muted)" }}>
                                                    <strong>Valid for:</strong> {card.daysRemaining} days
                                                </p>
                                            </div>
                                            <button
                                                style={{ 
                                                    ...button, 
                                                    background: "var(--cc-success)", 
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

                {activeTab === "members" && storeToken && storeInfo && (
                    <div style={card}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <h3 style={{ marginTop: 0, marginBottom: 0 }}>👥 Members (Joined This Month)</h3>
                            <button
                                style={{ ...button, fontSize: 12, padding: "6px 12px" }}
                                onClick={async () => {
                                    try {
                                        setMembersLoading(true);
                                        const data = await fetchStoreMembers(storeToken, { limit: 200 });
                                        setMembers(data.members || []);
                                        setMembersAccess(
                                            data.access || {
                                                can_view_customer_identity: true,
                                                upgrade_message: "",
                                            }
                                        );
                                    } catch (e) {
                                        setErr("Error loading members: " + (e.message || "Unknown error"));
                                    } finally {
                                        setMembersLoading(false);
                                    }
                                }}
                            >
                                🔄 Refresh
                            </button>
                        </div>

                        <div style={{ marginTop: 12, fontSize: 12, color: "var(--cc-muted)" }}>
                            Customers appear here when they add your store (free) or unlock it (paid). This is separate from check-ins.
                        </div>
                        {members.length > 0 && (
                            <div style={{ marginTop: 10, padding: 10, background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)", borderRadius: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Recent Join Alerts</div>
                                {(members || []).slice(0, 3).map((m) => (
                                    <div key={`alert-${m.user_id || m.joined_at}`} style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                        {m.is_masked ? "Someone" : m.name} joined your store
                                        {m.joined_at ? ` • ${new Date(m.joined_at).toLocaleString()}` : ""}
                                    </div>
                                ))}
                                {membersAccess?.can_view_customer_identity === false && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--cc-primary)" }}>
                                        {membersAccess.upgrade_message || "Upgrade to view customer identity and send direct promotions."}
                                    </div>
                                )}
                            </div>
                        )}

                        {membersLoading ? (
                            <p style={{ marginTop: 12 }}>Loading members...</p>
                        ) : members.length === 0 ? (
                            <p style={{ marginTop: 12, color: "var(--cc-muted)" }}>No customers have joined yet.</p>
                        ) : (
                            <div style={{ overflowX: "auto", marginTop: 12 }}>
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Customer</th>
                                            <th style={th}>Phone</th>
                                            <th style={th}>Plan</th>
                                            <th style={th}>Join Method</th>
                                            <th style={th}>Paid</th>
                                            <th style={th}>Joined</th>
                                            <th style={th}>Direct Promo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map((m) => (
                                            <tr key={`${m.user_id}-${m.joined_at || ""}`}>
                                                <td style={td}><strong>{m.name}</strong></td>
                                                <td style={td}>{m.phone || "-"}</td>
                                                <td style={td}>{m.plan || "-"}</td>
                                                <td style={td}>{m.join_method}</td>
                                                <td style={td}>{m.join_method === "paid" ? `$${((m.paid_cents || 0) / 100).toFixed(2)}` : "-"}</td>
                                                <td style={td}>{m.joined_at ? new Date(m.joined_at).toLocaleString() : "-"}</td>
                                                <td style={td}>
                                                    {membersAccess?.can_view_customer_identity === false ? (
                                                        <button
                                                            style={{ ...smallButton, fontSize: 11 }}
                                                            onClick={() => setActiveTab("subscription")}
                                                        >
                                                            Upgrade
                                                        </button>
                                                    ) : (
                                                        <button
                                                            style={{ ...smallButton, fontSize: 11 }}
                                                            disabled={memberPromoSendingUserId === m.user_id}
                                                            onClick={() => handleSendMemberPromotion(m)}
                                                        >
                                                            {memberPromoSendingUserId === m.user_id ? "Sending..." : "Send promo"}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                                setCustomersAccess(
                                    ct.access || {
                                        can_view_customer_identity: true,
                                        upgrade_message: "",
                                    }
                                );
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
                                        e.currentTarget.style.backgroundColor = "var(--cc-surface-2)";
                                        e.currentTarget.style.color = "var(--cc-text)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "transparent";
                                        e.currentTarget.style.color = "var(--cc-muted)";
                                    }}
                                    title="Close"
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ textAlign: "center", padding: 20, backgroundColor: "var(--cc-surface)", borderRadius: 12 }}>
                                <QRCodeCanvas value={storeInfo.qr_code} size={300} />
                                <p style={{ marginTop: 16, fontSize: 14, color: "var(--cc-muted)" }}>
                                    {storeInfo.name}
                                </p>
                                <p style={{ marginTop: 4, fontSize: 12, color: "var(--cc-muted)" }}>
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
    border: "1px solid var(--cc-border)",
    borderRadius: 12,
    padding: 20,
    backgroundColor: "var(--cc-surface)",
    boxShadow: "var(--cc-shadow-sm)",
};

const dashboardCard = {
    flex: 1,
    minWidth: 400,
    border: "1px solid var(--cc-border)",
    borderRadius: 12,
    padding: 20,
    backgroundColor: "var(--cc-surface)",
    boxShadow: "var(--cc-shadow-sm)",
};

const card = {
    border: "1px solid var(--cc-border)",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "var(--cc-surface)",
    boxShadow: "var(--cc-shadow-sm)",
};

const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    fontSize: 14,
    boxSizing: "border-box",
};

const button = {
    padding: "10px 16px",
    borderRadius: "var(--cc-radius-sm)",
    border: "none",
    backgroundColor: "var(--cc-primary)",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const smallButton = {
    padding: "6px 12px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    backgroundColor: "var(--cc-surface-2)",
    color: "var(--cc-text)",
    fontSize: 12,
    cursor: "pointer",
};

const linkButton = {
    background: "none",
    border: "none",
    color: "var(--cc-primary)",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
};

const successText = {
    color: "var(--cc-success)",
    marginTop: 12,
    fontSize: 13,
};

const infoRow = {
    marginBottom: 8,
    fontSize: 14,
    color: "var(--cc-text)",
};

const link = {
    color: "var(--cc-primary)",
    textDecoration: "none",
};

const statsBox = {
    display: "flex",
    gap: 24,
    padding: 16,
    backgroundColor: "var(--cc-surface-2)",
    borderRadius: 8,
    border: "1px solid var(--cc-border)",
};

const statSection = {
    textAlign: "center",
};

const statLabel = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--cc-muted)",
    textTransform: "uppercase",
    marginBottom: 8,
};

const statValue = {
    fontSize: 24,
    fontWeight: "bold",
    color: "var(--cc-text)",
    marginBottom: 4,
};

const statSubtext = {
    fontSize: 11,
    color: "var(--cc-muted)",
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
    backgroundColor: "var(--cc-surface)",
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

const locationCard = {
    padding: 16,
    backgroundColor: "var(--cc-surface-2)",
    borderRadius: 8,
    border: "1px solid var(--cc-border)",
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
    borderBottom: "2px solid var(--cc-border)",
    fontWeight: 600,
    color: "var(--cc-text)",
    fontSize: 12,
    textTransform: "uppercase",
};

const td = {
    padding: "12px 8px",
    borderBottom: "1px solid var(--cc-border)",
    color: "var(--cc-muted)",
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



