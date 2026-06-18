// src/AdminApp.jsx
import React, { useState, useEffect, useRef } from "react";
import {
    adminLogin, 
    adminSignup, 
    fetchAdminMe, 
    fetchSystemAnalytics,
    fetchAdminAnalyticsSummary,
    fetchAdminAnalyticsFunnel,
    fetchAdminActivity,
    fetchAdminAnalyticsEventsByActor,
    fetchAdminUsers,
    fetchAdminUserDetails,
    updateAdminUser,
    deleteAdminUser,
    fetchAdminStores,
    fetchAdminStoreDetails,
    updateAdminStore,
    updateAdminStoreOffer,
    updateAdminStoreSubscription,
    fetchAdminStoreSubscriptionAudit,
    fetchAdminCategoryProfiles,
    updateAdminCategoryProfile,
    fetchAdminStoreRewardProfile,
    updateAdminStoreRewardProfile,
    deleteAdminStoreRewardProfile,
    deleteAdminStore,
    fetchStoreCustomers,
    fetchUserStores,
    adminBackfillStorePhones,
    adminGenerateStoreClaimCode,
    notifyStoreRequest
} from "./api";
import { QRCodeCanvas } from "qrcode.react";

export default function AdminApp({ token, onToken }) {
    const getStored = (key) => (typeof window !== "undefined" ? window.localStorage.getItem(key) : null);
    const validAdminTabs = new Set(["dashboard", "analytics", "tracking", "users", "stores", "rewards"]);
    const getInitialAdminTab = () => {
        const stored = getStored("cc_admin_active_tab");
        return validAdminTabs.has(stored) ? stored : "dashboard";
    };
    const [adminToken, setAdminToken] = useState(() => token || getStored("cc_admin_token") || "");
    const [adminInfo, setAdminInfo] = useState(null);
    const [systemStats, setSystemStats] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    
    // Login/signup state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showSignup, setShowSignup] = useState(false);
    
    // Active tab
    const [activeTab, setActiveTab] = useState(getInitialAdminTab); // 'dashboard' | 'users' | 'stores' | 'analytics' | 'rewards'
    
    // User Management state
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersSearch, setUsersSearch] = useState("");
    const [usersPage, setUsersPage] = useState(1);
    const [usersPagination, setUsersPagination] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [editingUser, setEditingUser] = useState(false);
    const [userEditForm, setUserEditForm] = useState({ name: "", email: "", address: "", plan: "" });
    
    // Store Management state
    const [stores, setStores] = useState([]);
    const [storesLoading, setStoresLoading] = useState(false);
    const [storesSearch, setStoresSearch] = useState("");
    const [storesPage, setStoresPage] = useState(1);
    const [storesPagination, setStoresPagination] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [storeDetails, setStoreDetails] = useState(null);
    const [editingStore, setEditingStore] = useState(false);
    const [storeEditForm, setStoreEditForm] = useState({ name: "", email: "", phone: "", category: "", base_discount_percent: "", address: "", is_local: true });
    const [storeOfferForm, setStoreOfferForm] = useState({
        reward_tier: "standard",
        reward_points: 0,
        unlock_cost_cents: 0,
        unlock_cost_loops: 0,
        is_locked: false,
        min_plan: "STARTER",
    });
    const [storeOfferSaving, setStoreOfferSaving] = useState(false);
    const [storeOfferMessage, setStoreOfferMessage] = useState("");
    const [storeSubscriptionForm, setStoreSubscriptionForm] = useState({
        plan_id: "trial",
        status: "trialing",
        trial_ends_at: "",
        ai_credits_used: 0,
        admin_password: "",
    });
    const [storeSubscriptionSaving, setStoreSubscriptionSaving] = useState(false);
    const [storeSubscriptionMessage, setStoreSubscriptionMessage] = useState("");
    const [storeSubscriptionAuditLogs, setStoreSubscriptionAuditLogs] = useState([]);
    const [storeSubscriptionAuditLoading, setStoreSubscriptionAuditLoading] = useState(false);
    const [storeRewardProfile, setStoreRewardProfile] = useState(null);
    const [storeRewardForm, setStoreRewardForm] = useState({
        max_rewarded_visits_per_day: "",
        cooldown_minutes: "",
        min_dwell_minutes: "",
        base_points: "",
        pending_ratio: "",
        dvs_expiry_days: "",
    });
    const [storeRewardSaving, setStoreRewardSaving] = useState(false);
    const [storeRewardMessage, setStoreRewardMessage] = useState("");
    const [storeCustomers, setStoreCustomers] = useState([]);
    const [storeCustomersLoading, setStoreCustomersLoading] = useState(false);
    const [showStoreCustomers, setShowStoreCustomers] = useState(false);
    const [customDiscountValue, setCustomDiscountValue] = useState("");
    const [userStores, setUserStores] = useState([]);
    const [userStoresLoading, setUserStoresLoading] = useState(false);
    const [showUserStores, setShowUserStores] = useState(false);
    
    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, id: null, name: null });
    
    // Filtering and sorting state
    const [usersSortBy, setUsersSortBy] = useState("id");
    const [usersSortOrder, setUsersSortOrder] = useState("desc");
    const [usersFilterPlan, setUsersFilterPlan] = useState("");
    const [storesSortBy, setStoresSortBy] = useState("id");
    const [storesSortOrder, setStoresSortOrder] = useState("desc");
    const [storesFilterCategory, setStoresFilterCategory] = useState("");
    const [storesFilterSubscriptionPlan, setStoresFilterSubscriptionPlan] = useState("");
    const [phoneBackfillLoading, setPhoneBackfillLoading] = useState(false);
    const [phoneBackfillMsg, setPhoneBackfillMsg] = useState("");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    // Store Performance filtering, sorting, and pagination
    const [storePerfSearch, setStorePerfSearch] = useState("");
    const [storePerfCategoryFilter, setStorePerfCategoryFilter] = useState("");
    const [storePerfSortBy, setStorePerfSortBy] = useState("visit_count");
    const [storePerfSortOrder, setStorePerfSortOrder] = useState("desc");
    const [storePerfPage, setStorePerfPage] = useState(1);
    const storePerfPageSize = 20;
    const storeQrRef = useRef(null);
    const [trackingSummary, setTrackingSummary] = useState(null);
    const [trackingFunnel, setTrackingFunnel] = useState(null);
    const [trackingActivity, setTrackingActivity] = useState(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingActorDetail, setTrackingActorDetail] = useState(null);
    const [trackingActorEvents, setTrackingActorEvents] = useState([]);
    const [trackingActorLoading, setTrackingActorLoading] = useState(false);
    const [storeNotifyLoading, setStoreNotifyLoading] = useState(null);
    const [notifiedStores, setNotifiedStores] = useState({});
    const storeQrPrintRef = useRef(null);

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

    // Reward profiles (admin config)
    const [categoryProfiles, setCategoryProfiles] = useState([]);
    const [categoryProfilesLoading, setCategoryProfilesLoading] = useState(false);
    const [categoryProfileEdits, setCategoryProfileEdits] = useState({});
    const [categoryProfileMsg, setCategoryProfileMsg] = useState("");
    const [newCategory, setNewCategory] = useState("");

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!adminToken) return;
        
        async function load() {
            try {
                setErr("");
                setLoading(true);
                const { admin } = await fetchAdminMe(adminToken);
                setAdminInfo(admin);
                
                // Load system analytics
                const analytics = await fetchSystemAnalytics(adminToken);
                setSystemStats(analytics);
            } catch (e) {
                setErr(e.message);
                setAdminToken("");
                if (onToken) onToken("");
            } finally {
                setLoading(false);
            }
        }
        
        load();
    }, [adminToken, onToken]);

    useEffect(() => {
        if (!adminToken || activeTab !== "tracking") return;
        let cancelled = false;
        setTrackingLoading(true);
        Promise.all([
            fetchAdminAnalyticsSummary(adminToken),
            fetchAdminAnalyticsFunnel(adminToken),
            fetchAdminActivity(adminToken, { days: 7 }),
        ])
            .then(([summary, funnel, activity]) => {
                if (!cancelled) {
                    setTrackingSummary(summary);
                    setTrackingFunnel(funnel);
                    setTrackingActivity(activity);
                }
            })
            .catch((e) => {
                if (!cancelled) setErr(e.message || "Failed to load tracking");
            })
            .finally(() => {
                if (!cancelled) setTrackingLoading(false);
            });
        return () => { cancelled = true; };
    }, [adminToken, activeTab]);

    const storePerformanceRows = (() => {
        const items = systemStats?.storePerformance || [];
        
        // Filter by search (store name)
        let filtered = items;
        if (storePerfSearch) {
            const searchLower = storePerfSearch.toLowerCase();
            filtered = filtered.filter((store) => 
                (store?.name || "").toLowerCase().includes(searchLower)
            );
        }
        
        // Filter by category
        if (storePerfCategoryFilter) {
            filtered = filtered.filter((store) => 
                (store?.category || "") === storePerfCategoryFilter
            );
        }
        
        // Sort
        filtered.sort((a, b) => {
            let aVal = a[storePerfSortBy] || 0;
            let bVal = b[storePerfSortBy] || 0;
            
            // Handle numeric values
            if (storePerfSortBy === "visit_count" || storePerfSortBy === "customer_count" || storePerfSortBy === "loops_given") {
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
            } else {
                // String comparison
                aVal = String(aVal || "").toLowerCase();
                bVal = String(bVal || "").toLowerCase();
            }
            
            if (storePerfSortOrder === "asc") {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
        
        return filtered;
    })();
    
    // Pagination
    const storePerfTotalPages = Math.ceil(storePerformanceRows.length / storePerfPageSize);
    const storePerfStartIdx = (storePerfPage - 1) * storePerfPageSize;
    const storePerfEndIdx = storePerfStartIdx + storePerfPageSize;
    const storePerfPaginatedRows = storePerformanceRows.slice(storePerfStartIdx, storePerfEndIdx);
    
    // Get unique categories for filter dropdown
    const storePerfCategories = (() => {
        const items = systemStats?.storePerformance || [];
        const cats = [...new Set(items.map(s => s.category).filter(Boolean))];
        return cats.sort();
    })();
    
    // Load users when Users tab is active
    useEffect(() => {
        if (adminToken && activeTab === "users") {
            loadUsers();
        }
    }, [adminToken, activeTab, usersPage, usersSearch]);
    
    // Load stores when Stores tab is active
    useEffect(() => {
        if (adminToken && activeTab === "stores") {
            loadStores();
        }
    }, [adminToken, activeTab, storesPage, storesSearch]);

    useEffect(() => {
        if (adminToken && activeTab === "rewards") {
            loadCategoryProfiles();
        }
    }, [adminToken, activeTab]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("cc_admin_active_tab", activeTab);
        }
    }, [activeTab]);
    
    const loadUsers = async () => {
        if (!adminToken) return;
        setUsersLoading(true);
        try {
            const data = await fetchAdminUsers(adminToken, { search: usersSearch, page: usersPage, limit: 50 });
            setUsers(data.users || []);
            setUsersPagination(data.pagination || null);
        } catch (e) {
            setErr(e.message);
        } finally {
            setUsersLoading(false);
        }
    };
    
    const loadStores = async () => {
        if (!adminToken) return;
        setStoresLoading(true);
        try {
            const data = await fetchAdminStores(adminToken, { search: storesSearch, page: storesPage, limit: 50 });
            setStores(data.stores || []);
            setStoresPagination(data.pagination || null);
        } catch (e) {
            setErr(e.message);
        } finally {
            setStoresLoading(false);
        }
    };

    const loadCategoryProfiles = async () => {
        if (!adminToken) return;
        setCategoryProfilesLoading(true);
        setCategoryProfileMsg("");
        try {
            const data = await fetchAdminCategoryProfiles(adminToken);
            const profiles = data.profiles || [];
            setCategoryProfiles(profiles);
            const edits = {};
            profiles.forEach((profile) => {
                edits[profile.category] = {
                    max_rewarded_visits_per_day: profile.max_rewarded_visits_per_day ?? "",
                    cooldown_minutes: profile.cooldown_minutes ?? "",
                    min_dwell_minutes: profile.min_dwell_minutes ?? "",
                    base_points: profile.base_points ?? "",
                    pending_ratio: profile.pending_ratio ?? "",
                    dvs_expiry_days: profile.dvs_expiry_days ?? "",
                };
            });
            setCategoryProfileEdits(edits);
        } catch (e) {
            setErr(e.message);
        } finally {
            setCategoryProfilesLoading(false);
        }
    };

    const handleSaveCategoryProfile = async (category) => {
        const edits = categoryProfileEdits[category];
        if (!edits) return;
        try {
            setCategoryProfileMsg("");
            await updateAdminCategoryProfile(adminToken, category, {
                max_rewarded_visits_per_day: Number(edits.max_rewarded_visits_per_day),
                cooldown_minutes: Number(edits.cooldown_minutes),
                min_dwell_minutes: Number(edits.min_dwell_minutes),
                base_points: Number(edits.base_points),
                pending_ratio: Number(edits.pending_ratio),
                dvs_expiry_days: Number(edits.dvs_expiry_days),
            });
            setCategoryProfileMsg(`Saved reward rules for ${category}.`);
            loadCategoryProfiles();
        } catch (e) {
            setErr(e.message);
        }
    };

    const handleCreateCategoryProfile = async () => {
        const category = newCategory.trim().toLowerCase();
        if (!category) return;
        try {
            setCategoryProfileMsg("");
            await updateAdminCategoryProfile(adminToken, category, {
                max_rewarded_visits_per_day: 1,
                cooldown_minutes: 1440,
                min_dwell_minutes: 3,
                base_points: 10,
                pending_ratio: 0.7,
                dvs_expiry_days: 7,
            });
            setNewCategory("");
            setCategoryProfileMsg(`Created reward rules for ${category}.`);
            loadCategoryProfiles();
        } catch (e) {
            setErr(e.message);
        }
    };
    
    const handleViewUser = async (userId) => {
        if (!adminToken) return;
        try {
            const data = await fetchAdminUserDetails(adminToken, userId);
            setSelectedUser(userId);
            setUserDetails(data);
            setUserEditForm({
                name: data.user?.name || "",
                email: data.user?.email || "",
                address: data.user?.address || "",
                plan: data.user?.plan || "STARTER"
            });
        } catch (e) {
            setErr(e.message);
        }
    };
    
    const handleViewStore = async (storeId) => {
        if (!adminToken) return;
        try {
            const data = await fetchAdminStoreDetails(adminToken, storeId);
            setSelectedStore(storeId);
            setStoreDetails(data);
            const discount = data.store?.base_discount_percent || 0;
            setStoreEditForm({
                name: data.store?.name || "",
                email: data.store?.email || "",
                phone: data.store?.phone || "",
                category: data.store?.category || "",
                base_discount_percent: discount,
                address: data.store?.address || "",
                is_local: (data.store?.is_local ?? 1) === 1
            });
            setStoreOfferForm({
                reward_tier: data.store?.offer?.reward_tier || "standard",
                reward_points: data.store?.offer?.reward_points || 0,
                unlock_cost_cents: data.store?.offer?.unlock_cost_cents || 0,
                unlock_cost_loops: data.store?.offer?.unlock_cost_loops || 0,
                is_locked: !!data.store?.offer?.is_locked,
                min_plan: data.store?.offer?.min_plan || "STARTER",
            });
            setStoreOfferMessage("");
            const subscription = data.subscription || data.store?.subscription || null;
            setStoreSubscriptionForm({
                plan_id: subscription?.plan?.id || "trial",
                status: subscription?.status || "trialing",
                trial_ends_at: subscription?.trial_ends_at
                    ? new Date(subscription.trial_ends_at).toISOString().slice(0, 16)
                    : "",
                ai_credits_used: subscription?.ai_credits_used || 0,
                admin_password: "",
            });
            setStoreSubscriptionMessage("");
            setStoreSubscriptionAuditLoading(true);
            setStoreRewardMessage("");
            setStoreRewardSaving(false);
            const auditData = await fetchAdminStoreSubscriptionAudit(adminToken, storeId).catch(() => ({ logs: [] }));
            setStoreSubscriptionAuditLogs(auditData.logs || []);
            setStoreSubscriptionAuditLoading(false);
            const rewardProfileData = await fetchAdminStoreRewardProfile(adminToken, storeId);
            const profile = rewardProfileData.profile || null;
            setStoreRewardProfile(profile);
            setStoreRewardForm({
                max_rewarded_visits_per_day: profile?.max_rewarded_visits_per_day ?? "",
                cooldown_minutes: profile?.cooldown_minutes ?? "",
                min_dwell_minutes: profile?.min_dwell_minutes ?? "",
                base_points: profile?.base_points ?? "",
                pending_ratio: profile?.pending_ratio ?? "",
                dvs_expiry_days: profile?.dvs_expiry_days ?? "",
            });
            // Set custom discount value if not in standard list
            if (!["0", "1", "2", "3", "4", "5", "10", "15", "20", "25"].includes(String(discount))) {
                setCustomDiscountValue(String(discount));
            } else {
                setCustomDiscountValue("");
            }
        } catch (e) {
            setStoreSubscriptionAuditLoading(false);
            setErr(e.message);
        }
    };
    
    const handleViewStoreCustomers = async (storeId) => {
        if (!adminToken) return;
        setStoreCustomersLoading(true);
        setShowStoreCustomers(true);
        try {
            const data = await fetchStoreCustomers(adminToken, storeId);
            setStoreCustomers(data.customers || []);
        } catch (e) {
            setErr(e.message);
            setStoreCustomers([]);
        } finally {
            setStoreCustomersLoading(false);
        }
    };

    const handleSaveStoreRewardProfile = async () => {
        if (!selectedStore) return;
        try {
            setStoreRewardSaving(true);
            setStoreRewardMessage("");
            const normalizeInt = (value) => (value === "" ? null : parseInt(value, 10));
            const normalizeFloat = (value) => (value === "" ? null : parseFloat(value));
            await updateAdminStoreRewardProfile(adminToken, selectedStore, {
                max_rewarded_visits_per_day: normalizeInt(storeRewardForm.max_rewarded_visits_per_day),
                cooldown_minutes: normalizeInt(storeRewardForm.cooldown_minutes),
                min_dwell_minutes: normalizeInt(storeRewardForm.min_dwell_minutes),
                base_points: normalizeInt(storeRewardForm.base_points),
                pending_ratio: normalizeFloat(storeRewardForm.pending_ratio),
                dvs_expiry_days: normalizeInt(storeRewardForm.dvs_expiry_days),
            });
            setStoreRewardMessage("Saved store reward overrides.");
            const rewardProfileData = await fetchAdminStoreRewardProfile(adminToken, selectedStore);
            setStoreRewardProfile(rewardProfileData.profile || null);
        } catch (e) {
            setErr(e.message);
        } finally {
            setStoreRewardSaving(false);
        }
    };

    const handleClearStoreRewardProfile = async () => {
        if (!selectedStore) return;
        try {
            setStoreRewardSaving(true);
            setStoreRewardMessage("");
            await deleteAdminStoreRewardProfile(adminToken, selectedStore);
            setStoreRewardProfile(null);
            setStoreRewardForm({
                max_rewarded_visits_per_day: "",
                cooldown_minutes: "",
                min_dwell_minutes: "",
                base_points: "",
                pending_ratio: "",
                dvs_expiry_days: "",
            });
            setStoreRewardMessage("Cleared store overrides. Category defaults apply.");
        } catch (e) {
            setErr(e.message);
        } finally {
            setStoreRewardSaving(false);
        }
    };
    
    const handleViewUserStores = async (userId) => {
        if (!adminToken) return;
        setUserStoresLoading(true);
        setShowUserStores(true);
        try {
            const data = await fetchUserStores(adminToken, userId);
            setUserStores(data.stores || []);
        } catch (e) {
            setErr(e.message);
            setUserStores([]);
        } finally {
            setUserStoresLoading(false);
        }
    };

    const handleGenerateClaimCode = async (storeId, { force = false } = {}) => {
        if (!adminToken) return;
        try {
            setErr("");
            setLoading(true);
            
            // Ask for store owner phone number
            const store = stores.find(s => s.id === storeId);
            const storePhone = store?.phone || "";
            const ownerPhone = prompt(
                `Enter store owner's phone number to send SMS with claim code:\n\n` +
                `Format: 10 digits (e.g., 5551234567) or with country code\n` +
                `(Store phone: ${storePhone || "Not available"})\n\n` +
                `Leave empty to skip SMS.`,
                ""
            );
            
            // If user cancelled, stop
            if (ownerPhone === null) {
                setLoading(false);
                return;
            }
            
            const result = await adminGenerateStoreClaimCode(adminToken, storeId, { 
                force, 
                ownerPhone: ownerPhone.trim() || null 
            });
            
            // Update row in-place so the code shows immediately
            setStores((prev) =>
                (prev || []).map((s) =>
                    s.id === storeId
                        ? { ...s, claim_code: result.claimCode, claimed_at: force ? null : s.claimed_at }
                        : s
                )
            );
            
            // Show success message with SMS status
            let message = `Claim code generated: ${result.claimCode}\n\n`;
            if (result.smsSent) {
                message += `✅ SMS sent successfully to ${ownerPhone.trim()} with claim code and signup link.`;
            } else if (result.smsError) {
                message += `⚠️ SMS Error: ${result.smsError}\n\nPlease send the claim code manually.\n\nClaim Code: ${result.claimCode}`;
            } else if (!ownerPhone.trim()) {
                message += "ℹ️ SMS skipped (no phone number provided).\n\nPlease send the claim code manually.";
            } else {
                message += "ℹ️ SMS not sent (unknown reason).\n\nPlease send the claim code manually.";
            }
            
            alert(message);
        } catch (e) {
            const errorMsg = e.message || "Failed to generate claim code";
            setErr(errorMsg);
            alert(`Error: ${errorMsg}\n\nPlease try again or contact support.`);
        } finally {
            setLoading(false);
        }
    };
    
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!adminToken || !selectedUser) return;
        setLoading(true);
        try {
            await updateAdminUser(adminToken, selectedUser, userEditForm);
            setEditingUser(false);
            await handleViewUser(selectedUser); // Reload user details
            await loadUsers(); // Reload users list
            setSuccessMsg("User updated successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleUpdateStore = async (e) => {
        e.preventDefault();
        if (!adminToken || !selectedStore) return;
        setLoading(true);
        try {
            await updateAdminStore(adminToken, selectedStore, storeEditForm);
            setEditingStore(false);
            await handleViewStore(selectedStore); // Reload store details
            await loadStores(); // Reload stores list
            setSuccessMsg("Store updated successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteUser = async () => {
        if (!adminToken || !deleteConfirm.id) return;
        setLoading(true);
        try {
            await deleteAdminUser(adminToken, deleteConfirm.id);
            setDeleteConfirm({ show: false, type: null, id: null, name: null });
            if (selectedUser === deleteConfirm.id) {
                setSelectedUser(null);
                setUserDetails(null);
            }
            await loadUsers();
            setSuccessMsg("User deleted successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteStore = async () => {
        if (!adminToken || !deleteConfirm.id) return;
        setLoading(true);
        try {
            await deleteAdminStore(adminToken, deleteConfirm.id);
            setDeleteConfirm({ show: false, type: null, id: null, name: null });
            if (selectedStore === deleteConfirm.id) {
                setSelectedStore(null);
                setStoreDetails(null);
            }
            await loadStores();
            setSuccessMsg("Store deleted successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const exportUsersToCSV = () => {
        const headers = ["ID", "Name", "Phone", "Email", "Plan", "Loops Balance", "Total Loops Earned", "Address"];
        const rows = users.map(u => [
            u.id,
            u.name || "",
            u.phone || "",
            u.email || "",
            u.plan || "",
            u.loops_balance || 0,
            u.total_loops_earned || 0,
            u.address || ""
        ]);
        
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `users_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccessMsg("Users exported to CSV");
        setTimeout(() => setSuccessMsg(""), 3000);
    };
    
    const exportStoresToCSV = () => {
        const headers = ["ID", "Name", "Category", "Email", "Phone", "Discount %", "Address"];
        const rows = stores.map(s => [
            s.id,
            s.name || "",
            s.category || "",
            s.email || "",
            s.phone || "",
            s.base_discount_percent || 0,
            s.address || ""
        ]);
        
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `stores_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccessMsg("Stores exported to CSV");
        setTimeout(() => setSuccessMsg(""), 3000);
    };
    
    // Sort and filter functions
    const sortedAndFilteredUsers = () => {
        let result = [...users];
        
        // Filter by plan
        if (usersFilterPlan) {
            result = result.filter(u => u.plan === usersFilterPlan);
        }
        
        // Sort
        result.sort((a, b) => {
            let aVal = a[usersSortBy] || "";
            let bVal = b[usersSortBy] || "";
            
            // Handle numeric values
            if (usersSortBy === "id" || usersSortBy === "loops_balance" || usersSortBy === "total_loops_earned") {
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
            }
            
            if (usersSortOrder === "asc") {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
        
        return result;
    };
    
    const sortedAndFilteredStores = () => {
        let result = [...stores];
        
        // Filter by category
        if (storesFilterCategory) {
            result = result.filter(s => s.category === storesFilterCategory);
        }
        if (storesFilterSubscriptionPlan) {
            result = result.filter(
                (s) => String(s.subscription_plan_id || "trial").toLowerCase() === storesFilterSubscriptionPlan
            );
        }
        
        // Sort
        result.sort((a, b) => {
            let aVal = a[storesSortBy] || "";
            let bVal = b[storesSortBy] || "";
            
            // Handle numeric values
            if (storesSortBy === "id" || storesSortBy === "base_discount_percent") {
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
            }
            
            if (storesSortOrder === "asc") {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
        
        return result;
    };

    const getStorePlanLabel = (planId) => {
        const normalized = String(planId || "trial").toLowerCase();
        if (normalized === "starter") return "Starter";
        if (normalized === "growth") return "Growth";
        return "Trial";
    };

    const getStorePlanBadgeStyle = (planId) => {
        const normalized = String(planId || "trial").toLowerCase();
        if (normalized === "growth") {
            return { background: "rgba(16, 185, 129, 0.15)", color: "var(--cc-success)" };
        }
        if (normalized === "starter") {
            return { background: "rgba(59, 130, 246, 0.15)", color: "var(--cc-primary)" };
        }
        return { background: "rgba(245, 158, 11, 0.15)", color: "var(--cc-warning)" };
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setErr("Email and password are required");
            return;
        }
        
        setErr("");
        setLoading(true);
        try {
            const res = await adminLogin(email, password);
            setAdminToken(res.token);
            if (typeof window !== "undefined") {
                window.localStorage.setItem("cc_admin_token", res.token);
            }
            if (onToken) onToken(res.token);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (!email || !password || !name) {
            setErr("Email, password, and name are required");
            return;
        }
        
        if (password.length < 8) {
            setErr("Password must be at least 8 characters");
            return;
        }
        
        setErr("");
        setLoading(true);
        try {
            const res = await adminSignup(email, password, name);
            setAdminToken(res.token);
            if (typeof window !== "undefined") {
                window.localStorage.setItem("cc_admin_token", res.token);
            }
            if (onToken) onToken(res.token);
            setShowSignup(false);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setAdminToken("");
        setAdminInfo(null);
        setSystemStats(null);
        setEmail("");
        setPassword("");
        setName("");
        if (typeof window !== "undefined") {
            window.localStorage.removeItem("cc_admin_token");
            window.localStorage.removeItem("cc_admin_active_tab");
        }
        if (onToken) onToken("");
    };

    if (!adminToken) {
        return (
            <div style={loginContainer}>
                <div style={loginBox}>
                    <h2 style={{ marginTop: 0, marginBottom: 24 }}>Admin Portal</h2>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>
                        {showSignup ? "Create Admin Account" : "Admin Login"}
                    </h3>
                    
                    <form onSubmit={showSignup ? handleSignup : handleLogin}>
                        {showSignup && (
                            <input
                                style={input}
                                type="text"
                                placeholder="Full Name (required)"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setErr("");
                                }}
                                required
                            />
                        )}
                        <input
                            style={input}
                            type="email"
                            placeholder="Email Address (required)"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setErr("");
                            }}
                            required
                        />
                        <input
                            style={input}
                            type="password"
                            placeholder="Password (required)"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setErr("");
                            }}
                            required
                            minLength={showSignup ? 8 : 6}
                        />
                        {showSignup && (
                            <p style={{ fontSize: 12, color: "var(--cc-muted)", margin: "4px 0 16px 0" }}>
                                Password must be at least 8 characters
                            </p>
                        )}
                        
                        <button
                            style={primaryButton}
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (showSignup ? "Creating..." : "Logging in...") : (showSignup ? "Create Account" : "Login")}
                        </button>
                    </form>
                    
                    <div style={{ marginTop: 16, textAlign: "center" }}>
                        <button
                            style={linkButton}
                            onClick={() => {
                                setShowSignup(!showSignup);
                                setErr("");
                            }}
                        >
                            {showSignup ? "Already have an account? Login" : "Need an admin account? Sign up"}
                        </button>
                    </div>
                    
                    {err && <p style={errorText}>{err}</p>}
                </div>
            </div>
        );
    }

    if (loading && !adminInfo) {
        return (
            <div style={container}>
                <p>Loading admin dashboard...</p>
            </div>
        );
    }

    return (
        <div style={container}>
            <header style={header}>
                <div style={headerContent}>
                    <h1 style={title}>Admin Dashboard</h1>
                    <div style={headerActions}>
                        {adminInfo && (
                            <span style={userInfo}>Welcome, {adminInfo.name}</span>
                        )}
                        <button style={logoutButton} onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
                
                {/* Tab Navigation */}
                <div style={tabs}>
                    <button
                        style={{ ...tabButton, ...(activeTab === "dashboard" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        Dashboard
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "analytics" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("analytics")}
                    >
                        Analytics
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "tracking" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("tracking")}
                    >
                        Tracking
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "users" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("users")}
                    >
                        Users
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "stores" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("stores")}
                    >
                        Stores
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "rewards" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("rewards")}
                    >
                        Rewards
                    </button>
                </div>
            </header>

            <main style={main}>
                {activeTab === "dashboard" && (
                    <div>
                        <h2 style={sectionTitle}>System Overview</h2>
                        {systemStats && systemStats.overview && (
                            <div style={statsGrid}>
                                <div style={statCard}>
                                    <h3 style={statValue}>{systemStats.overview.total_users || 0}</h3>
                                    <p style={statLabel}>Total Users</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{systemStats.overview.total_stores || 0}</h3>
                                    <p style={statLabel}>Total Stores</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{systemStats.overview.total_visits || 0}</h3>
                                    <p style={statLabel}>Total Visits</p>
                                </div>
                                {/* Commented out - not tracking money transactions
                                <div style={statCard}>
                                    <h3 style={statValue}>${((systemStats.overview.total_revenue_cents || 0) / 100).toFixed(2)}</h3>
                                    <p style={statLabel}>Total Revenue</p>
                                </div>
                                */}
                                <div style={statCard}>
                                    <h3 style={statValue}>{(systemStats.overview.total_loops_in_circulation || 0).toLocaleString()}</h3>
                                    <p style={statLabel}>Loops in Circulation</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{(systemStats.overview.total_loops_ever_earned || 0).toLocaleString()}</h3>
                                    <p style={statLabel}>Total Loops Earned</p>
                                </div>
                            </div>
                        )}
                        
                        {systemStats && systemStats.transactionGrowth && systemStats.transactionGrowth.length > 0 && (
                            <div style={card}>
                                <h3 style={cardTitle}>Recent Activity (Last 30 Days)</h3>
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Date</th>
                                                <th style={th}>Visits</th>
                                                <th style={th}>New Customers</th>
                                                <th style={th}>Loops Given</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {systemStats.visitGrowth && systemStats.visitGrowth.slice(0, 10).map((day, idx) => (
                                                <tr key={idx}>
                                                    <td style={td}>{new Date(day.date).toLocaleDateString()}</td>
                                                    <td style={td}>{day.visit_count || 0}</td>
                                                    <td style={td}>{day.new_customers || 0}</td>
                                                    <td style={td}>{day.loops_given || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "analytics" && (
                    <div>
                        <h2 style={sectionTitle}>System Analytics</h2>
                        
                        {/* Overview Cards */}
                        {systemStats && systemStats.overview && (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 30 }}>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Total Users</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-primary)" }}>
                                            {systemStats.overview.total_users?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Total Stores</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-success)" }}>
                                            {systemStats.overview.total_stores?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Total Visits</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-warning)" }}>
                                            {systemStats.overview.total_visits?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Loops in Circulation</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-info)" }}>
                                            {systemStats.overview.total_loops_in_circulation?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Total Loops Earned</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-primary-600)" }}>
                                            {systemStats.overview.total_loops_ever_earned?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    {/* Commented out - not tracking money transactions
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Total Revenue</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-danger)" }}>
                                            ${((systemStats.overview.total_revenue_cents || 0) / 100).toFixed(2)}
                                        </p>
                                    </div>
                                    */}
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Gift Cards Issued</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-info)" }}>
                                            {systemStats.overview.total_gift_cards_issued?.toLocaleString() || 0}
                                        </p>
                                        <p style={{ margin: "5px 0 0 0", fontSize: 12, color: "var(--cc-muted)" }}>
                                            {systemStats.overview.active_gift_cards || 0} active
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Active Customers (30d)</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-success)" }}>
                                            {systemStats.overview.active_customers_30d?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "var(--cc-text)" }}>Gift Card Value</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-warning)" }}>
                                            ${((systemStats.overview.total_gift_card_value || 0)).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Visit Growth */}
                                {systemStats.visitGrowth && systemStats.visitGrowth.length > 0 && (
                                    <div style={{ ...card, marginBottom: 30 }}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "var(--cc-text)" }}>Visit Growth (Last 30 Days)</h3>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={table}>
                                                <thead>
                                                    <tr>
                                                        <th style={th}>Date</th>
                                                        <th style={th}>Visits</th>
                                                        <th style={th}>New Customers</th>
                                                        <th style={th}>Loops Given</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {systemStats.visitGrowth.slice(0, 15).map((day, idx) => (
                                                        <tr key={idx}>
                                                            <td style={td}>{new Date(day.date).toLocaleDateString()}</td>
                                                            <td style={td}>{day.visit_count || 0}</td>
                                                            <td style={td}>{day.new_customers || 0}</td>
                                                            <td style={td}>{day.loops_given || 0}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Store Performance */}
                                {systemStats?.storePerformance && systemStats.storePerformance.length > 0 && (
                                    <div style={{ ...card, marginBottom: 30 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                                            <h3 style={{ margin: 0, fontSize: 20, color: "var(--cc-text)" }}>Store Performance</h3>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                                <input
                                                    style={{ ...input, flex: "0 0 200px", width: isMobile ? "100%" : undefined }}
                                                    type="text"
                                                    placeholder="Search store name..."
                                                    value={storePerfSearch}
                                                    onChange={(e) => {
                                                        setStorePerfSearch(e.target.value);
                                                        setStorePerfPage(1);
                                                    }}
                                                />
                                                <select
                                                    style={{ ...input, flex: "0 0 150px", width: isMobile ? "100%" : undefined }}
                                                    value={storePerfCategoryFilter}
                                                    onChange={(e) => {
                                                        setStorePerfCategoryFilter(e.target.value);
                                                        setStorePerfPage(1);
                                                    }}
                                                >
                                                    <option value="">All Categories</option>
                                                    {storePerfCategories.map((cat) => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    style={{ ...input, flex: "0 0 140px", width: isMobile ? "100%" : undefined }}
                                                    value={storePerfSortBy}
                                                    onChange={(e) => {
                                                        setStorePerfSortBy(e.target.value);
                                                        setStorePerfPage(1);
                                                    }}
                                                >
                                                    <option value="visit_count">Sort By</option>
                                                    <option value="name">Name</option>
                                                    <option value="category">Category</option>
                                                    <option value="visit_count">Visits</option>
                                                    <option value="customer_count">Customers</option>
                                                    <option value="loops_given">Loops Given</option>
                                                </select>
                                                <button
                                                    style={{ ...smallButton, flex: "0 0 40px", width: isMobile ? "100%" : undefined }}
                                                    onClick={() => {
                                                        setStorePerfSortOrder(storePerfSortOrder === "asc" ? "desc" : "asc");
                                                        setStorePerfPage(1);
                                                    }}
                                                >
                                                    {storePerfSortOrder === "asc" ? "↑" : "↓"}
                                                </button>
                                            </div>
                                        </div>
                                        {storePerfSearch || storePerfCategoryFilter ? (
                                            <p style={{ fontSize: 14, color: "var(--cc-muted)", margin: "0 0 12px 0" }}>
                                                Showing {storePerformanceRows.length} of {systemStats?.storePerformance?.length || 0} stores
                                            </p>
                                        ) : null}
                                        {storePerformanceRows.length === 0 ? (
                                            <p style={{ fontSize: 14, color: "var(--cc-muted)", textAlign: "center", padding: 20 }}>
                                                No stores found matching your filters.
                                            </p>
                                        ) : (
                                            <>
                                                <div style={{ overflowX: "auto" }}>
                                                    <table style={table}>
                                                        <thead>
                                                            <tr>
                                                                <th style={th}>Store Name</th>
                                                                <th style={th}>Category</th>
                                                                <th style={th}>Customers</th>
                                                                <th style={th}>Visits</th>
                                                                {/* Commented out - not tracking money transactions
                                                                <th style={th}>Revenue</th>
                                                                */}
                                                                <th style={th}>Loops Given</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {storePerfPaginatedRows.map((store, idx) => (
                                                                <tr key={idx}>
                                                                    <td style={td}>{store.name}</td>
                                                                    <td style={td}>{store.category}</td>
                                                                    <td style={td}>{store.customer_count || 0}</td>
                                                                    <td style={td}>{store.visit_count || 0}</td>
                                                                    {/* Commented out - not tracking money transactions
                                                                    <td style={td}>${((store.revenue_cents || 0) / 100).toFixed(2)}</td>
                                                                    */}
                                                                    <td style={td}>{store.loops_given?.toLocaleString() || 0}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {storePerfTotalPages > 1 && (
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
                                                        <p style={{ fontSize: 14, color: "var(--cc-muted)", margin: 0 }}>
                                                            Page {storePerfPage} of {storePerfTotalPages} ({storePerformanceRows.length} stores)
                                                        </p>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                style={{ ...smallButton }}
                                                                onClick={() => setStorePerfPage(1)}
                                                                disabled={storePerfPage === 1}
                                                            >
                                                                First
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton }}
                                                                onClick={() => setStorePerfPage(prev => Math.max(1, prev - 1))}
                                                                disabled={storePerfPage === 1}
                                                            >
                                                                Previous
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton }}
                                                                onClick={() => setStorePerfPage(prev => Math.min(storePerfTotalPages, prev + 1))}
                                                                disabled={storePerfPage === storePerfTotalPages}
                                                            >
                                                                Next
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton }}
                                                                onClick={() => setStorePerfPage(storePerfTotalPages)}
                                                                disabled={storePerfPage === storePerfTotalPages}
                                                            >
                                                                Last
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Tier Distribution */}
                                {systemStats.tierDistribution && systemStats.tierDistribution.length > 0 && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "var(--cc-text)" }}>User Tier Distribution</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            {systemStats.tierDistribution.map((tier, idx) => (
                                                <div key={idx} style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                    <p style={{ margin: "0 0 5px 0", fontSize: 14, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                        {tier.tier}
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-text)" }}>
                                                        {tier.count}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Visit Metrics */}
                                {systemStats.visitMetrics && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "var(--cc-text)" }}>Visit Metrics (Last 30 Days)</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Visits
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-primary)" }}>
                                                    {systemStats.visitMetrics.total_visits || 0}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Unique Customers
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-success)" }}>
                                                    {systemStats.visitMetrics.unique_customers || 0}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Active Days
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-info)" }}>
                                                    {systemStats.visitMetrics.active_days || 0}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Redemption Stats */}
                                {systemStats.redemptionStats && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "var(--cc-text)" }}>Loops Redemption Rate</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Earned
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-success)" }}>
                                                    {(systemStats.redemptionStats.total_earned || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Redeemed
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-danger)" }}>
                                                    {(systemStats.redemptionStats.total_redeemed || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Redemption Rate
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-info)" }}>
                                                    {systemStats.redemptionStats.total_earned > 0 
                                                        ? ((systemStats.redemptionStats.total_redeemed / systemStats.redemptionStats.total_earned) * 100).toFixed(1)
                                                        : 0}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Top Stores by Visits */}
                                {systemStats.topStoresByVisits && systemStats.topStoresByVisits.length > 0 && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "var(--cc-text)" }}>Top Stores by Visits (Last 30 Days)</h3>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={table}>
                                                <thead>
                                                    <tr>
                                                        <th style={th}>Store Name</th>
                                                        <th style={th}>Category</th>
                                                        <th style={th}>Visits</th>
                                                        <th style={th}>Customers</th>
                                                        <th style={th}>Loops Given</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {systemStats.topStoresByVisits.map((store, idx) => (
                                                        <tr key={idx}>
                                                            <td style={td}>{store.name}</td>
                                                            <td style={td}>{store.category}</td>
                                                            <td style={td}><strong>{store.visit_count || 0}</strong></td>
                                                            <td style={td}>{store.customer_count || 0}</td>
                                                            <td style={td}>{store.loops_given || 0}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Customer Retention */}
                                {systemStats.retentionStats && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "var(--cc-text)" }}>Customer Retention (Last 30 Days)</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Active Customers
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-primary)" }}>
                                                    {systemStats.retentionStats.total_active_customers || 0}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Returning Customers
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-success)" }}>
                                                    {systemStats.retentionStats.returning_customers || 0}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Retention Rate
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-info)" }}>
                                                    {systemStats.retentionStats.total_active_customers > 0 
                                                        ? ((systemStats.retentionStats.returning_customers / systemStats.retentionStats.total_active_customers) * 100).toFixed(1)
                                                        : 0}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(!systemStats || !systemStats.overview) && (
                            <div style={card}>
                                <p style={{ color: "var(--cc-muted)" }}>Loading analytics data...</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "tracking" && (
                    <div>
                        <h2 style={sectionTitle}>Event Tracking</h2>
                        <p style={{ color: "var(--cc-muted)", marginBottom: 20 }}>
                            Store request count = how many customers asked for a store to join. Stores claimed = how many stores completed signup.
                        </p>
                        <p style={{ color: "var(--cc-muted)", marginBottom: 20, fontSize: 12 }}>
                            (Page view = when someone opened the customer or store login screen.)
                        </p>
                        {trackingLoading && (
                            <div style={card}><p style={{ color: "var(--cc-muted)" }}>Loading tracking data...</p></div>
                        )}
                        {!trackingLoading && trackingFunnel && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 24 }}>
                                <div style={card}>
                                    <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "var(--cc-text)" }}>Store requests</h3>
                                    <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-primary)" }}>
                                        {(trackingFunnel.funnel && Number(trackingFunnel.funnel.store_request))?.toLocaleString() ?? 0}
                                    </p>
                                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--cc-muted)" }}>Customers who asked for a store to join</p>
                                </div>
                                <div style={card}>
                                    <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "var(--cc-text)" }}>Stores claimed</h3>
                                    <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "var(--cc-success)" }}>
                                        {(trackingFunnel.funnel && Number(trackingFunnel.funnel.store_claimed))?.toLocaleString() ?? 0}
                                    </p>
                                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--cc-muted)" }}>Stores that completed signup</p>
                                </div>
                            </div>
                        )}
                        {!trackingLoading && trackingActivity && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 }}>
                                <div style={card}>
                                    <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "var(--cc-text)" }}>New users (last {trackingActivity.days ?? 7} days)</h3>
                                    <div style={{ maxHeight: 280, overflowY: "auto" }}>
                                        {(trackingActivity.new_users?.length > 0) ? (
                                            <table style={table}>
                                                <thead><tr><th style={th}>Name</th><th style={th}>Phone</th><th style={th}>Date</th></tr></thead>
                                                <tbody>
                                                    {trackingActivity.new_users.slice(0, 15).map((u) => (
                                                        <tr key={u.id}>
                                                            <td style={td}>{u.name}</td>
                                                            <td style={td}>{u.phone}</td>
                                                            <td style={td}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : <p style={{ color: "var(--cc-muted)", margin: 0 }}>None</p>}
                                    </div>
                                </div>
                                <div style={card}>
                                    <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "var(--cc-text)" }}>New stores (last {trackingActivity.days ?? 7} days)</h3>
                                    <div style={{ maxHeight: 280, overflowY: "auto" }}>
                                        {(trackingActivity.new_stores?.length > 0) ? (
                                            <table style={table}>
                                                <thead><tr><th style={th}>Name</th><th style={th}>Category</th><th style={th}>Date</th></tr></thead>
                                                <tbody>
                                                    {trackingActivity.new_stores.slice(0, 15).map((s) => (
                                                        <tr key={s.id}>
                                                            <td style={td}>{s.name}</td>
                                                            <td style={td}>{s.category}</td>
                                                            <td style={td}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : <p style={{ color: "var(--cc-muted)", margin: 0 }}>None</p>}
                                    </div>
                                </div>
                                <div style={{ ...card, minWidth: 0 }}>
                                    <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "var(--cc-text)" }}>Store requests (recent)</h3>
                                    <div style={{ maxHeight: 280, overflowY: "auto", overflowX: "hidden" }}>
                                        {(trackingActivity.store_requests?.length > 0) ? (
                                            <table style={{ ...table, tableLayout: "fixed" }}>
                                                <colgroup>
                                                    <col style={{ width: "32%" }} />
                                                    <col style={{ width: "12%" }} />
                                                    <col style={{ width: "18%" }} />
                                                    <col style={{ width: "20%" }} />
                                                    <col style={{ width: "18%" }} />
                                                </colgroup>
                                                <thead><tr><th style={th}>Store</th><th style={th}>Requests</th><th style={th}>Status</th><th style={th}>Date</th><th style={th}>Actions</th></tr></thead>
                                                <tbody>
                                                    {trackingActivity.store_requests.slice(0, 15).map((r) => {
                                                        const count = r.request_count != null ? r.request_count : 1;
                                                        const storeKey = String(r.requested_store_name || "").trim().toLowerCase();
                                                        const isAlreadyNotified = !!notifiedStores[storeKey];
                                                        const canNotify = count >= 10 && !isAlreadyNotified;
                                                        const isNotifying = storeNotifyLoading === r.requested_store_name;
                                                        return (
                                                            <tr key={r.requested_store_name + (r.created_at || "")}>
                                                                <td style={{ ...td, wordBreak: "break-word" }}>{r.requested_store_name}</td>
                                                                <td style={td}>{count}</td>
                                                                <td style={td}>{r.status}</td>
                                                                <td style={{ ...td, whiteSpace: "nowrap" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                                                                <td style={td}>
                                                                    {canNotify ? (
                                                                        <button
                                                                            type="button"
                                                                            style={smallButton}
                                                                            disabled={isNotifying}
                                                                            onClick={async () => {
                                                                                setStoreNotifyLoading(r.requested_store_name);
                                                                                setErr("");
                                                                                setSuccessMsg("");
                                                                                try {
                                                                                    const data = await notifyStoreRequest(adminToken, {
                                                                                        requested_store_name: r.requested_store_name,
                                                                                        request_count: count,
                                                                                    });
                                                                                    setSuccessMsg(data && data.message ? data.message : "Notification sent.");
                                                                                    if (data?.sentToStore) {
                                                                                        setNotifiedStores((prev) => ({ ...prev, [storeKey]: true }));
                                                                                    }
                                                                                } catch (e) {
                                                                                    const msg = (e && e.message) ? e.message : "Failed to send notification.";
                                                                                    if (String(msg).toLowerCase().includes("already notified recently")) {
                                                                                        setNotifiedStores((prev) => ({ ...prev, [storeKey]: true }));
                                                                                    }
                                                                                    setErr(msg);
                                                                                } finally {
                                                                                    setStoreNotifyLoading(null);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {isNotifying ? "Sending..." : "Notify store"}
                                                                        </button>
                                                                    ) : (isAlreadyNotified ? "Already notified" : "-")}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        ) : <p style={{ color: "var(--cc-muted)", margin: 0 }}>None</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "users" && (
                    <div>
                        <h2 style={sectionTitle}>User Management</h2>
                        
                        {/* Search and Filters */}
                        <div style={card}>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                                <input
                                    style={{ ...input, flex: "1 1 300px" }}
                                    type="text"
                                    placeholder="Search users by name, phone, or email..."
                                    value={usersSearch}
                                    onChange={(e) => {
                                        setUsersSearch(e.target.value);
                                        setUsersPage(1);
                                    }}
                                />
                                <select
                                    style={{ ...input, flex: "0 0 150px" }}
                                    value={usersFilterPlan}
                                    onChange={(e) => setUsersFilterPlan(e.target.value)}
                                >
                                    <option value="">All Plans</option>
                                    <option value="STARTER">STARTER</option>
                                    <option value="BASIC">BASIC</option>
                                    <option value="PLUS">PLUS</option>
                                    <option value="PREMIUM">PREMIUM</option>
                                </select>
                                <select
                                    style={{ ...input, flex: "0 0 120px" }}
                                    value={usersSortBy}
                                    onChange={(e) => setUsersSortBy(e.target.value)}
                                >
                                    <option value="id">Sort By</option>
                                    <option value="name">Name</option>
                                    <option value="loops_balance">Loops</option>
                                    <option value="total_loops_earned">Total Earned</option>
                                </select>
                                <button
                                    style={{ ...smallButton, flex: "0 0 80px" }}
                                    onClick={() => setUsersSortOrder(usersSortOrder === "asc" ? "desc" : "asc")}
                                >
                                    {usersSortOrder === "asc" ? "↑" : "↓"}
                                </button>
                                <button
                                    style={{ ...smallButton, flex: "0 0 100px", background: "var(--cc-success)", color: "white" }}
                                    onClick={exportUsersToCSV}
                                >
                                    Export CSV
                                </button>
                            </div>
                            {usersPagination && (
                                <p style={{ fontSize: 14, color: "var(--cc-muted)", margin: 0 }}>
                                    Showing {sortedAndFilteredUsers().length} of {usersPagination.total} users (Page {usersPagination.page} of {usersPagination.totalPages})
                                </p>
                            )}
                        </div>
                        
                        {/* Users List */}
                        {usersLoading ? (
                            <div style={card}>
                                <p>Loading users...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div style={card}>
                                <p style={{ color: "var(--cc-muted)" }}>No users found.</p>
                            </div>
                        ) : (
                            <div style={card}>
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>ID</th>
                                                <th style={th}>Name</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Plan</th>
                                                <th style={th}>Loops</th>
                                                <th style={th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAndFilteredUsers().map((user) => (
                                                <tr key={user.id}>
                                                    <td style={td}>{user.id}</td>
                                                    <td style={td}>{user.name}</td>
                                                    <td style={td}>{user.phone}</td>
                                                    <td style={td}>{user.email || "-"}</td>
                                                    <td style={td}>{user.plan}</td>
                                                    <td style={td}>{user.loops_balance?.toLocaleString() || 0}</td>
                                                    <td style={td}>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                style={smallButton}
                                                                onClick={() => handleViewUser(user.id)}
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "var(--cc-primary)", color: "white" }}
                                                                onClick={() => handleViewUserStores(user.id)}
                                                            >
                                                                Stores
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "var(--cc-danger)", color: "white" }}
                                                                onClick={() => setDeleteConfirm({ show: true, type: "user", id: user.id, name: user.name })}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Pagination */}
                                {usersPagination && usersPagination.totalPages > 1 && (
                                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                                        <button
                                            style={smallButton}
                                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                                            disabled={usersPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: "8px 16px", fontSize: 14 }}>
                                            Page {usersPage} of {usersPagination.totalPages}
                                        </span>
                                        <button
                                            style={smallButton}
                                            onClick={() => setUsersPage(p => Math.min(usersPagination.totalPages, p + 1))}
                                            disabled={usersPage === usersPagination.totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* User Details Modal */}
                        {selectedUser && userDetails && (
                            <div style={modal}>
                                <div style={modalContent}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                        <h3 style={{ margin: 0 }}>User Details</h3>
                                        <button style={closeButton} onClick={() => { setSelectedUser(null); setUserDetails(null); setEditingUser(false); }}>
                                            ×
                                        </button>
                                    </div>
                                    
                                    {!editingUser ? (
                                        <div>
                                            <div style={detailRow}>
                                                <strong>ID:</strong> {userDetails.user.id}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Name:</strong> {userDetails.user.name}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Phone:</strong> {userDetails.user.phone}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Email:</strong> {userDetails.user.email || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Address:</strong> {userDetails.user.address || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Plan:</strong> {userDetails.user.plan}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Loops Balance:</strong> {userDetails.user.loops_balance?.toLocaleString() || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Total Loops Earned:</strong> {userDetails.user.total_loops_earned?.toLocaleString() || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Total Visits:</strong> {userDetails.stats?.visit_count || 0}
                                            </div>
                                            {/* Commented out - not tracking money transactions
                                            <div style={detailRow}>
                                                <strong>Total Spent:</strong> ${((userDetails.stats?.total_spent_cents || 0) / 100).toFixed(2)}
                                            </div>
                                            */}
                                            <div style={detailRow}>
                                                <strong>Stores Visited:</strong> {userDetails.stats?.stores_visited || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Total Loops Earned:</strong> {userDetails.stats?.total_loops_earned || 0}
                                            </div>
                                            
                                            {/* Store Visits with Loops Earned */}
                                            {userDetails.storeVisits && userDetails.storeVisits.length > 0 && (
                                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--cc-border)" }}>
                                                    <h4 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: 600, color: "var(--cc-text)" }}>
                                                        Store Visits & Loops Earned
                                                    </h4>
                                                    <div style={{ overflowX: "auto" }}>
                                                        <table style={table}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={th}>Store Name</th>
                                                                    <th style={th}>Category</th>
                                                                    <th style={th}>Visits</th>
                                                                    <th style={th}>Loops Earned</th>
                                                                    {/* Commented out - not tracking money transactions
                                                                    <th style={th}>Total Spent</th>
                                                                    */}
                                                                    <th style={th}>Last Visit</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {userDetails.storeVisits.map((visit, idx) => (
                                                                    <tr key={idx}>
                                                                        <td style={td}>{visit.store_name}</td>
                                                                        <td style={td}>{visit.category}</td>
                                                                        <td style={td}>{visit.visit_count || 0}</td>
                                                                        <td style={td}><strong>{visit.total_loops_earned?.toLocaleString() || 0}</strong></td>
                                                                        {/* Commented out - not tracking money transactions
                                                                        <td style={td}>${((visit.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                                        */}
                                                                        <td style={td}>{visit.last_visit_at ? new Date(visit.last_visit_at).toLocaleDateString() : "-"}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div style={{ marginTop: 20 }}>
                                                <button style={primaryButton} onClick={() => setEditingUser(true)}>
                                                    Edit User
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdateUser}>
                                            <label style={label}>Name</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={userEditForm.name}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, name: e.target.value })}
                                                required
                                            />
                                            <label style={label}>Email</label>
                                            <input
                                                style={input}
                                                type="email"
                                                value={userEditForm.email}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, email: e.target.value })}
                                            />
                                            <label style={label}>Address</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={userEditForm.address}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, address: e.target.value })}
                                            />
                                            <label style={label}>Plan</label>
                                            <select
                                                style={input}
                                                value={userEditForm.plan}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, plan: e.target.value })}
                                            >
                                                <option value="STARTER">STARTER</option>
                                                <option value="BASIC">BASIC</option>
                                                <option value="PLUS">PLUS</option>
                                                <option value="PREMIUM">PREMIUM</option>
                                            </select>
                                            
                                            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                                                <button style={primaryButton} type="submit" disabled={loading}>
                                                    {loading ? "Saving..." : "Save Changes"}
                                                </button>
                                                <button style={secondaryButton} type="button" onClick={() => { setEditingUser(false); handleViewUser(selectedUser); }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "stores" && (
                    <div>
                        <h2 style={sectionTitle}>Store Management</h2>
                        
                        {/* Search and Filters */}
                        <div style={card}>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
                                <input
                                    style={{ ...input, flex: "1 1 300px", width: isMobile ? "100%" : undefined }}
                                    type="text"
                                    placeholder="Search stores by name, email, phone, or category..."
                                    value={storesSearch}
                                    onChange={(e) => {
                                        setStoresSearch(e.target.value);
                                        setStoresPage(1);
                                    }}
                                />
                                <select
                                    style={{ ...input, flex: "0 0 120px", width: isMobile ? "100%" : undefined }}
                                    value={storesFilterCategory}
                                    onChange={(e) => setStoresFilterCategory(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    <option value="coffee">Coffee</option>
                                    <option value="grocery">Grocery</option>
                                    <option value="restaurant">Restaurant</option>
                                    <option value="retail">Retail</option>
                                    <option value="barbershop">Barbershop</option>
                                    <option value="smoke">Smoke</option>
                                    <option value="liquor">Liquor</option>
                                    <option value="other">Other</option>
                                </select>
                                <select
                                    style={{ ...input, flex: "0 0 130px", width: isMobile ? "100%" : undefined }}
                                    value={storesFilterSubscriptionPlan}
                                    onChange={(e) => setStoresFilterSubscriptionPlan(e.target.value)}
                                >
                                    <option value="">All Plans</option>
                                    <option value="trial">Trial</option>
                                    <option value="starter">Starter</option>
                                    <option value="growth">Growth</option>
                                </select>
                                <select
                                    style={{ ...input, flex: "0 0 120px", width: isMobile ? "100%" : undefined }}
                                    value={storesSortBy}
                                    onChange={(e) => setStoresSortBy(e.target.value)}
                                >
                                    <option value="id">Sort By</option>
                                    <option value="name">Name</option>
                                    <option value="category">Category</option>
                                    <option value="base_discount_percent">Discount</option>
                                </select>
                                <button
                                    style={{ ...smallButton, flex: "0 0 80px", width: isMobile ? "100%" : undefined }}
                                    onClick={() => setStoresSortOrder(storesSortOrder === "asc" ? "desc" : "asc")}
                                >
                                    {storesSortOrder === "asc" ? "↑" : "↓"}
                                </button>
                                <button
                                    style={{ ...smallButton, flex: "0 0 100px", background: "var(--cc-success)", color: "white", width: isMobile ? "100%" : undefined }}
                                    onClick={exportStoresToCSV}
                                >
                                    Export CSV
                                </button>
                                <button
                                    style={{ ...smallButton, flex: "0 0 170px", background: "var(--cc-text)", color: "white", width: isMobile ? "100%" : undefined }}
                                    disabled={phoneBackfillLoading}
                                    onClick={async () => {
                                        try {
                                            setPhoneBackfillLoading(true);
                                            setPhoneBackfillMsg("");
                                            const result = await adminBackfillStorePhones(adminToken, { limit: 30 });
                                            setPhoneBackfillMsg(
                                                `Backfill complete: phones=${result.updatedPhones}, placeIds=${result.updatedPlaceIds}, processed=${result.processed}`
                                            );
                                            await loadStores();
                                        } catch (e) {
                                            setPhoneBackfillMsg(e.message || "Failed to backfill phones");
                                        } finally {
                                            setPhoneBackfillLoading(false);
                                        }
                                    }}
                                >
                                    {phoneBackfillLoading ? "Backfilling..." : "Backfill phones (batch)"}
                                </button>
                            </div>
                            {storesPagination && (
                                <p style={{ fontSize: 14, color: "var(--cc-muted)", margin: 0 }}>
                                    Showing {sortedAndFilteredStores().length} of {storesPagination.total} stores (Page {storesPagination.page} of {storesPagination.totalPages})
                                </p>
                            )}
                            {phoneBackfillMsg && (
                                <p style={{ fontSize: 13, color: "var(--cc-text)", marginTop: 12, marginBottom: 0 }}>
                                    {phoneBackfillMsg}
                                </p>
                            )}
                        </div>
                        
                        {/* Stores List */}
                        {storesLoading ? (
                            <div style={card}>
                                <p>Loading stores...</p>
                            </div>
                        ) : stores.length === 0 ? (
                            <div style={card}>
                                <p style={{ color: "var(--cc-muted)" }}>No stores found.</p>
                            </div>
                        ) : (
                            <div style={card}>
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>ID</th>
                                                <th style={th}>Name</th>
                                                <th style={th}>Category</th>
                                                <th style={th}>Plan</th>
                                                <th style={th}>Discount</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Claim</th>
                                                <th style={th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAndFilteredStores().map((store) => (
                                                <tr key={store.id}>
                                                    <td style={td}>{store.id}</td>
                                                    <td style={td}>{store.name}</td>
                                                    <td style={td}>{store.category}</td>
                                                    <td style={td}>
                                                        <span
                                                            style={{
                                                                ...getStorePlanBadgeStyle(store.subscription_plan_id),
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                padding: "3px 8px",
                                                                borderRadius: 999,
                                                            }}
                                                        >
                                                            {getStorePlanLabel(store.subscription_plan_id)}
                                                        </span>
                                                    </td>
                                                    <td style={td}>{store.base_discount_percent}%</td>
                                                    <td style={td}>{store.email || "-"}</td>
                                                    <td style={td}>{store.phone || "-"}</td>
                                                    <td style={td}>
                                                        {store.claimed_at ? (
                                                            <span style={{ fontSize: 12, color: "var(--cc-success)", fontWeight: 600 }}>Claimed</span>
                                                        ) : store.claim_code ? (
                                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                                <code style={{ fontSize: 12, background: "var(--cc-surface-2)", padding: "2px 6px", borderRadius: 6 }}>
                                                                    {store.claim_code}
                                                                </code>
                                                                <button
                                                                    style={smallButton}
                                                                    onClick={() => navigator.clipboard?.writeText(String(store.claim_code))}
                                                                >
                                                                    Copy
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: 12, color: "var(--cc-muted)" }}>Unclaimed</span>
                                                        )}
                                                    </td>
                                                    <td style={td}>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                style={smallButton}
                                                                onClick={() => handleViewStore(store.id)}
                                                            >
                                                                View
                                                            </button>
                                                            {!store.claimed_at && (
                                                                <button
                                                                    style={{ ...smallButton, background: "var(--cc-text)", color: "white" }}
                                                                    onClick={() => handleGenerateClaimCode(store.id)}
                                                                >
                                                                    Claim code
                                                                </button>
                                                            )}
                                                            {store.claimed_at && (
                                                                <button
                                                                    style={{ ...smallButton, background: "var(--cc-muted)", color: "white" }}
                                                                    onClick={() => {
                                                                        const ok = window.confirm("Reset claim code for this store? This will allow a new owner to claim it.");
                                                                        if (ok) handleGenerateClaimCode(store.id, { force: true });
                                                                    }}
                                                                >
                                                                    Reset code
                                                                </button>
                                                            )}
                                                            <button
                                                                style={{ ...smallButton, background: "var(--cc-primary)", color: "white" }}
                                                                onClick={() => handleViewStoreCustomers(store.id)}
                                                            >
                                                                Customers
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "var(--cc-danger)", color: "white" }}
                                                                onClick={() => setDeleteConfirm({ show: true, type: "store", id: store.id, name: store.name })}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Pagination */}
                                {storesPagination && storesPagination.totalPages > 1 && (
                                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                                        <button
                                            style={smallButton}
                                            onClick={() => setStoresPage(p => Math.max(1, p - 1))}
                                            disabled={storesPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: "8px 16px", fontSize: 14 }}>
                                            Page {storesPage} of {storesPagination.totalPages}
                                        </span>
                                        <button
                                            style={smallButton}
                                            onClick={() => setStoresPage(p => Math.min(storesPagination.totalPages, p + 1))}
                                            disabled={storesPage === storesPagination.totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Store Details Modal */}
                        {selectedStore && storeDetails && (
                            <div style={modal}>
                                <div style={modalContent}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                        <h3 style={{ margin: 0 }}>Store Details</h3>
                                        <button style={closeButton} onClick={() => { setSelectedStore(null); setStoreDetails(null); setStoreSubscriptionAuditLogs([]); setEditingStore(false); }}>
                                            ×
                                        </button>
                                    </div>
                                    
                                    {!editingStore ? (
                                        <div>
                                            <div style={detailRow}>
                                                <strong>ID:</strong> {storeDetails.store.id}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Name:</strong> {storeDetails.store.name}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Category:</strong> {storeDetails.store.category}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Base Discount:</strong> {storeDetails.store.base_discount_percent}%
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Reward Tier:</strong> {storeDetails.store.offer?.reward_tier || "standard"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Reward Points:</strong> {storeDetails.store.offer?.reward_points || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Min Plan:</strong> {storeDetails.store.offer?.min_plan || "STARTER"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Unlock Cost:</strong>{" "}
                                                ${(((storeDetails.store.offer?.unlock_cost_cents || 0) / 100).toFixed(2))} /
                                                {` ${storeDetails.store.offer?.unlock_cost_loops || 0} loops`}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Locked:</strong> {storeDetails.store.offer?.is_locked ? "Yes" : "No"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Subscription Plan:</strong> {storeDetails.subscription?.plan?.label || "Trial"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Subscription Status:</strong> {storeDetails.subscription?.status || "trialing"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Monthly Content:</strong>{" "}
                                                {storeDetails.subscription?.usage?.total || 0}
                                                {typeof storeDetails.subscription?.plan?.monthly_content_limit === "number"
                                                    ? ` / ${storeDetails.subscription.plan.monthly_content_limit}`
                                                    : " / Unlimited"}
                                            </div>
                                            <div style={{ marginTop: 14, padding: 10, border: "1px solid var(--cc-border)", borderRadius: 8, background: "var(--cc-surface-2)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                    <strong>Subscription Audit (Recent)</strong>
                                                    <button
                                                        style={{ ...smallButton, fontSize: 11 }}
                                                        onClick={async () => {
                                                            if (!selectedStore) return;
                                                            try {
                                                                setStoreSubscriptionAuditLoading(true);
                                                                const auditData = await fetchAdminStoreSubscriptionAudit(adminToken, selectedStore);
                                                                setStoreSubscriptionAuditLogs(auditData.logs || []);
                                                            } catch (e) {
                                                                setErr(e.message || "Failed to refresh subscription audit logs");
                                                            } finally {
                                                                setStoreSubscriptionAuditLoading(false);
                                                            }
                                                        }}
                                                    >
                                                        {storeSubscriptionAuditLoading ? "Refreshing..." : "Refresh"}
                                                    </button>
                                                </div>
                                                {storeSubscriptionAuditLoading ? (
                                                    <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Loading audit logs...</div>
                                                ) : storeSubscriptionAuditLogs.length === 0 ? (
                                                    <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>No subscription changes recorded yet.</div>
                                                ) : (
                                                    <div style={{ display: "grid", gap: 6 }}>
                                                        {storeSubscriptionAuditLogs.slice(0, 8).map((log) => (
                                                            <div key={log.id} style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                                                <strong style={{ color: "var(--cc-text)" }}>
                                                                    {log.actor_type === "admin" ? `Admin #${log.actor_id || "-"}` : "Store owner"}
                                                                </strong>
                                                                {" changed "}
                                                                <strong style={{ color: "var(--cc-text)" }}>
                                                                    {(log.from_plan_id || "unknown").toUpperCase()}
                                                                </strong>
                                                                {" -> "}
                                                                <strong style={{ color: "var(--cc-text)" }}>
                                                                    {(log.to_plan_id || "unknown").toUpperCase()}
                                                                </strong>
                                                                {log.from_status || log.to_status ? ` (${log.from_status || "-"} -> ${log.to_status || "-"})` : ""}
                                                                {" • "}
                                                                {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Email:</strong> {storeDetails.store.email || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Phone:</strong> {storeDetails.store.phone || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Address:</strong> {storeDetails.store.address || "-"}
                                            </div>
                                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--cc-border)" }}>
                                                <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "var(--cc-text)" }}>
                                                    Store QR Code
                                                </h4>
                                                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                                                    <div style={{ padding: 8, borderRadius: 8, background: "var(--cc-surface-2)" }}>
                                                        <QRCodeCanvas
                                                            ref={storeQrRef}
                                                            value={storeDetails.store.qr_code || `STORE:${storeDetails.store.id}`}
                                                            size={140}
                                                        />
                                                    </div>
                                                    <div style={{ position: "absolute", left: -9999, top: -9999 }}>
                                                        <QRCodeCanvas
                                                            ref={storeQrPrintRef}
                                                            value={storeDetails.store.qr_code || `STORE:${storeDetails.store.id}`}
                                                            size={900}
                                                        />
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                        <button
                                                            style={smallButton}
                                                            onClick={() =>
                                                                downloadQrCanvas(
                                                                    storeQrPrintRef.current || storeQrRef.current,
                                                                    `store-${storeDetails.store.id}-qr.png`
                                                                )
                                                            }
                                                        >
                                                            Download
                                                        </button>
                                                        <button
                                                            style={smallButton}
                                                            onClick={() =>
                                                                printQrCanvas(
                                                                    storeQrPrintRef.current || storeQrRef.current,
                                                                    `${storeDetails.store.name} QR`,
                                                                    storeDetails.store.name
                                                                )
                                                            }
                                                        >
                                                            Print
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--cc-border)" }}>
                                                <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "var(--cc-text)" }}>
                                                    Reward Rules Override
                                                </h4>
                                                <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "var(--cc-muted)" }}>
                                                    Leave a field blank to use the category default.
                                                </p>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>Base Points</div>
                                                        <input
                                                            style={miniInput}
                                                            type="number"
                                                            value={storeRewardForm.base_points}
                                                            onChange={(e) => setStoreRewardForm((prev) => ({ ...prev, base_points: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>Pending Ratio</div>
                                                        <input
                                                            style={miniInput}
                                                            type="number"
                                                            step="0.05"
                                                            value={storeRewardForm.pending_ratio}
                                                            onChange={(e) => setStoreRewardForm((prev) => ({ ...prev, pending_ratio: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>Cooldown (min)</div>
                                                        <input
                                                            style={miniInput}
                                                            type="number"
                                                            value={storeRewardForm.cooldown_minutes}
                                                            onChange={(e) => setStoreRewardForm((prev) => ({ ...prev, cooldown_minutes: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>Max / Day</div>
                                                        <input
                                                            style={miniInput}
                                                            type="number"
                                                            value={storeRewardForm.max_rewarded_visits_per_day}
                                                            onChange={(e) =>
                                                                setStoreRewardForm((prev) => ({ ...prev, max_rewarded_visits_per_day: e.target.value }))
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>Min Dwell (min)</div>
                                                        <input
                                                            style={miniInput}
                                                            type="number"
                                                            value={storeRewardForm.min_dwell_minutes}
                                                            onChange={(e) => setStoreRewardForm((prev) => ({ ...prev, min_dwell_minutes: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "var(--cc-muted)", marginBottom: 6 }}>DVS Expiry (days)</div>
                                                        <input
                                                            style={miniInput}
                                                            type="number"
                                                            value={storeRewardForm.dvs_expiry_days}
                                                            onChange={(e) => setStoreRewardForm((prev) => ({ ...prev, dvs_expiry_days: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                                    <button style={smallButton} onClick={handleSaveStoreRewardProfile} disabled={storeRewardSaving}>
                                                        {storeRewardSaving ? "Saving..." : "Save Overrides"}
                                                    </button>
                                                    <button style={secondaryButton} onClick={handleClearStoreRewardProfile} disabled={storeRewardSaving}>
                                                        Clear Overrides
                                                    </button>
                                                    {storeRewardMessage && (
                                                        <span style={{ fontSize: 12, color: "var(--cc-success)" }}>{storeRewardMessage}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Transactions:</strong> {storeDetails.stats?.transaction_count || 0}
                                            </div>
                                            {/* Commented out - not tracking money transactions
                                            <div style={detailRow}>
                                                <strong>Total Revenue:</strong> ${((storeDetails.stats?.total_revenue_cents || 0) / 100).toFixed(2)}
                                            </div>
                                            */}
                                            <div style={detailRow}>
                                                <strong>Unique Customers:</strong> {storeDetails.stats?.unique_customers || 0}
                                            </div>
                                            
                                            {/* Customer Visit Stats */}
                                            {storeDetails.customerStats && storeDetails.customerStats.length > 0 && (
                                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--cc-border)" }}>
                                                    <h4 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: 600, color: "var(--cc-text)" }}>
                                                        Unique Customers by Period
                                                    </h4>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                                        {storeDetails.customerStats.map((stat, idx) => (
                                                            <div key={idx} style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                                    {stat.period === 'daily' ? 'Today' : stat.period === 'weekly' ? 'This Week' : stat.period === 'monthly' ? 'This Month' : 'This Year'}
                                                                </p>
                                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-text)" }}>
                                                                    {stat.unique_customers || 0}
                                                                </p>
                                                                <p style={{ margin: "5px 0 0 0", fontSize: 11, color: "var(--cc-muted)" }}>
                                                                    {stat.period_date}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Gift Card Stats */}
                                            {storeDetails.giftCardStats && (
                                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--cc-border)" }}>
                                                    <h4 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: 600, color: "var(--cc-text)" }}>
                                                        Gift Cards Issued
                                                    </h4>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 15 }}>
                                                        <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Total Issued
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-primary)" }}>
                                                                {storeDetails.giftCardStats.total_gift_cards_issued || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Active
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-success)" }}>
                                                                {storeDetails.giftCardStats.active_gift_cards || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Physical
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-warning)" }}>
                                                                {storeDetails.giftCardStats.physical_gift_cards || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Digital
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-info)" }}>
                                                                {storeDetails.giftCardStats.digital_gift_cards || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "var(--cc-surface-2)", borderRadius: 8, border: "1px solid var(--cc-border)" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "var(--cc-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Total Value
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "var(--cc-danger)" }}>
                                                                ${((storeDetails.giftCardStats.total_gift_card_value || 0)).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div style={{ marginTop: 20 }}>
                                                <button style={primaryButton} onClick={() => setEditingStore(true)}>
                                                    Edit Store
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdateStore}>
                                            <label style={label}>Name</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={storeEditForm.name}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, name: e.target.value })}
                                                required
                                            />
                                            <label style={label}>Email</label>
                                            <input
                                                style={input}
                                                type="email"
                                                value={storeEditForm.email}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, email: e.target.value })}
                                            />
                                            <label style={label}>Phone</label>
                                            <input
                                                style={input}
                                                type="tel"
                                                value={storeEditForm.phone}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, phone: e.target.value })}
                                            />
                                            <label style={label}>Category</label>
                                            <select
                                                style={input}
                                                value={storeEditForm.category}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, category: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                <option value="coffee">Coffee</option>
                                                <option value="grocery">Grocery</option>
                                                <option value="restaurant">Restaurant</option>
                                                <option value="retail">Retail</option>
                                                <option value="barbershop">Barbershop</option>
                                                <option value="smoke">Smoke</option>
                                                <option value="liquor">Liquor</option>
                                                <option value="pharmacy">Pharmacy</option>
                                                <option value="gas">Gas</option>
                                                <option value="other">Other</option>
                                            </select>
                                            <label style={label}>Base Discount %</label>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <select
                                                    style={{ ...input, flex: 1 }}
                                                    value={customDiscountValue !== "" ? "custom" : String(storeEditForm.base_discount_percent)}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === "custom") {
                                                            setCustomDiscountValue(storeEditForm.base_discount_percent || "");
                                                        } else {
                                                            setStoreEditForm({ ...storeEditForm, base_discount_percent: parseInt(val) || 0 });
                                                            setCustomDiscountValue("");
                                                        }
                                                    }}
                                                    required
                                                >
                                                    <option value="0">0%</option>
                                                    <option value="1">1%</option>
                                                    <option value="2">2%</option>
                                                    <option value="3">3%</option>
                                                    <option value="4">4%</option>
                                                    <option value="5">5%</option>
                                                    <option value="10">10%</option>
                                                    <option value="15">15%</option>
                                                    <option value="20">20%</option>
                                                    <option value="25">25%</option>
                                                    <option value="custom">Custom...</option>
                                                </select>
                                                {customDiscountValue !== "" || (storeEditForm.base_discount_percent && !["0", "1", "2", "3", "4", "5", "10", "15", "20", "25"].includes(String(storeEditForm.base_discount_percent))) ? (
                                                    <input
                                                        style={{ ...input, flex: 1, maxWidth: 150 }}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        placeholder="Enter %"
                                                        value={customDiscountValue !== "" ? customDiscountValue : storeEditForm.base_discount_percent}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            setCustomDiscountValue(e.target.value);
                                                            setStoreEditForm({ ...storeEditForm, base_discount_percent: val });
                                                        }}
                                                        required
                                                    />
                                                ) : null}
                                            </div>
                                            <label style={label}>Address</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={storeEditForm.address}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, address: e.target.value })}
                                            />
                                            <label style={label}>Local Business</label>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!storeEditForm.is_local}
                                                    onChange={(e) => setStoreEditForm({ ...storeEditForm, is_local: e.target.checked })}
                                                />
                                                <span style={{ fontSize: 13, color: "var(--cc-text)" }}>This store is a local business (not a chain)</span>
                                            </div>

                                            <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--cc-border)", borderRadius: 8, background: "var(--cc-surface-2)" }}>
                                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Offer Controls</div>
                                                <label style={label}>Reward Tier</label>
                                                <select
                                                    style={input}
                                                    value={storeOfferForm.reward_tier}
                                                    onChange={(e) => setStoreOfferForm({ ...storeOfferForm, reward_tier: e.target.value })}
                                                >
                                                    <option value="standard">Standard</option>
                                                    <option value="boosted">Boosted</option>
                                                    <option value="premium">Premium</option>
                                                </select>
                                                <label style={label}>Reward Points</label>
                                                <input
                                                    style={input}
                                                    type="number"
                                                    min="0"
                                                    value={storeOfferForm.reward_points}
                                                    onChange={(e) => setStoreOfferForm({ ...storeOfferForm, reward_points: Number(e.target.value || 0) })}
                                                />
                                                <label style={label}>Minimum Plan</label>
                                                <select
                                                    style={input}
                                                    value={storeOfferForm.min_plan}
                                                    onChange={(e) => setStoreOfferForm({ ...storeOfferForm, min_plan: e.target.value })}
                                                >
                                                    <option value="STARTER">Starter</option>
                                                    <option value="PLUS">Plus</option>
                                                    <option value="PREMIUM">Premium</option>
                                                </select>
                                                <label style={label}>Unlock Cost (Money)</label>
                                                <input
                                                    style={input}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={(storeOfferForm.unlock_cost_cents / 100).toFixed(2)}
                                                    onChange={(e) =>
                                                        setStoreOfferForm({
                                                            ...storeOfferForm,
                                                            unlock_cost_cents: Math.round(Number(e.target.value || 0) * 100),
                                                        })
                                                    }
                                                />
                                                <label style={label}>Unlock Cost (Loops)</label>
                                                <input
                                                    style={input}
                                                    type="number"
                                                    min="0"
                                                    value={storeOfferForm.unlock_cost_loops}
                                                    onChange={(e) => setStoreOfferForm({ ...storeOfferForm, unlock_cost_loops: Number(e.target.value || 0) })}
                                                />
                                                <label style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!storeOfferForm.is_locked}
                                                        onChange={(e) => setStoreOfferForm({ ...storeOfferForm, is_locked: e.target.checked })}
                                                    />
                                                    Lock store by default
                                                </label>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <button
                                                        style={{ ...secondaryButton, padding: "8px 12px" }}
                                                        type="button"
                                                        disabled={storeOfferSaving}
                                                        onClick={async () => {
                                                            try {
                                                                setStoreOfferSaving(true);
                                                                setStoreOfferMessage("");
                                                                const result = await updateAdminStoreOffer(adminToken, selectedStore, storeOfferForm);
                                                                setStoreDetails((prev) =>
                                                                    prev
                                                                        ? { ...prev, store: { ...prev.store, offer: result.offer } }
                                                                        : prev
                                                                );
                                                                setStoreOfferMessage("Offer saved.");
                                                            } catch (e) {
                                                                setStoreOfferMessage(e.message || "Failed to save offer");
                                                            } finally {
                                                                setStoreOfferSaving(false);
                                                            }
                                                        }}
                                                    >
                                                        {storeOfferSaving ? "Saving..." : "Save Offer"}
                                                    </button>
                                                    {storeOfferMessage && (
                                                        <span style={{ fontSize: 12, color: "var(--cc-muted)" }}>{storeOfferMessage}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 16, padding: 12, border: "1px solid var(--cc-border)", borderRadius: 8, background: "var(--cc-surface-2)" }}>
                                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Subscription Controls</div>
                                                <label style={label}>Plan</label>
                                                <select
                                                    style={input}
                                                    value={storeSubscriptionForm.plan_id}
                                                    onChange={(e) => setStoreSubscriptionForm((prev) => ({ ...prev, plan_id: e.target.value }))}
                                                >
                                                    <option value="trial">Trial</option>
                                                    <option value="starter">Starter</option>
                                                    <option value="growth">Growth</option>
                                                </select>
                                                <label style={label}>Status</label>
                                                <select
                                                    style={input}
                                                    value={storeSubscriptionForm.status}
                                                    onChange={(e) => setStoreSubscriptionForm((prev) => ({ ...prev, status: e.target.value }))}
                                                >
                                                    <option value="trialing">Trialing</option>
                                                    <option value="active">Active</option>
                                                    <option value="expired">Expired</option>
                                                    <option value="past_due">Past Due</option>
                                                    <option value="canceled">Canceled</option>
                                                </select>
                                                <label style={label}>Trial Ends At</label>
                                                <input
                                                    style={input}
                                                    type="datetime-local"
                                                    value={storeSubscriptionForm.trial_ends_at}
                                                    onChange={(e) =>
                                                        setStoreSubscriptionForm((prev) => ({ ...prev, trial_ends_at: e.target.value }))
                                                    }
                                                />
                                                <label style={label}>AI Credits Used</label>
                                                <input
                                                    style={input}
                                                    type="number"
                                                    min="0"
                                                    value={storeSubscriptionForm.ai_credits_used}
                                                    onChange={(e) =>
                                                        setStoreSubscriptionForm((prev) => ({
                                                            ...prev,
                                                            ai_credits_used: Number(e.target.value || 0),
                                                        }))
                                                    }
                                                />
                                                <label style={label}>Admin Password (required)</label>
                                                <input
                                                    style={input}
                                                    type="password"
                                                    placeholder="Enter your admin password"
                                                    value={storeSubscriptionForm.admin_password}
                                                    onChange={(e) =>
                                                        setStoreSubscriptionForm((prev) => ({
                                                            ...prev,
                                                            admin_password: e.target.value,
                                                        }))
                                                    }
                                                />
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <button
                                                        style={{ ...secondaryButton, padding: "8px 12px" }}
                                                        type="button"
                                                        disabled={storeSubscriptionSaving}
                                                        onClick={async () => {
                                                            try {
                                                                if (!storeSubscriptionForm.admin_password) {
                                                                    setStoreSubscriptionMessage("Admin password is required.");
                                                                    return;
                                                                }
                                                                setStoreSubscriptionSaving(true);
                                                                setStoreSubscriptionMessage("");
                                                                const result = await updateAdminStoreSubscription(adminToken, selectedStore, {
                                                                    plan_id: storeSubscriptionForm.plan_id,
                                                                    status: storeSubscriptionForm.status,
                                                                    trial_ends_at: storeSubscriptionForm.trial_ends_at || null,
                                                                    ai_credits_used: Number(storeSubscriptionForm.ai_credits_used || 0),
                                                                    admin_password: storeSubscriptionForm.admin_password,
                                                                });
                                                                setStoreDetails((prev) =>
                                                                    prev
                                                                        ? {
                                                                            ...prev,
                                                                            subscription: result.subscription || prev.subscription,
                                                                            store: {
                                                                                ...prev.store,
                                                                                subscription: result.subscription || prev.store?.subscription,
                                                                            },
                                                                        }
                                                                        : prev
                                                                );
                                                                const auditData = await fetchAdminStoreSubscriptionAudit(adminToken, selectedStore).catch(() => ({ logs: [] }));
                                                                setStoreSubscriptionAuditLogs(auditData.logs || []);
                                                                setStoreSubscriptionForm((prev) => ({ ...prev, admin_password: "" }));
                                                                setStoreSubscriptionMessage("Subscription saved.");
                                                            } catch (e) {
                                                                setStoreSubscriptionMessage(e.message || "Failed to save subscription");
                                                            } finally {
                                                                setStoreSubscriptionSaving(false);
                                                            }
                                                        }}
                                                    >
                                                        {storeSubscriptionSaving ? "Saving..." : "Save Subscription"}
                                                    </button>
                                                    {storeSubscriptionMessage && (
                                                        <span style={{ fontSize: 12, color: "var(--cc-muted)" }}>{storeSubscriptionMessage}</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                                                <button style={primaryButton} type="submit" disabled={loading}>
                                                    {loading ? "Saving..." : "Save Changes"}
                                                </button>
                                                <button style={secondaryButton} type="button" onClick={() => { setEditingStore(false); handleViewStore(selectedStore); }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "rewards" && (
                    <div>
                        <h2 style={sectionTitle}>Reward Rules</h2>
                        <div style={{ ...card, marginBottom: 16 }}>
                            <h3 style={cardTitle}>Category Profiles</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 13 }}>
                                Configure base points, cooldowns, and pending ratios by category.
                            </p>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                                <input
                                    style={{ ...input, maxWidth: 240, marginBottom: 0 }}
                                    placeholder="New category (e.g. bakery)"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                />
                                <button style={smallButton} onClick={handleCreateCategoryProfile}>
                                    Add Category
                                </button>
                                {categoryProfileMsg && (
                                    <span style={{ fontSize: 12, color: "var(--cc-success)" }}>{categoryProfileMsg}</span>
                                )}
                            </div>
                            {categoryProfilesLoading ? (
                                <p>Loading category profiles...</p>
                            ) : categoryProfiles.length === 0 ? (
                                <p style={{ color: "var(--cc-muted)" }}>No category profiles found.</p>
                            ) : (
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Category</th>
                                                <th style={th}>Base Points</th>
                                                <th style={th}>Pending Ratio</th>
                                                <th style={th}>Cooldown (min)</th>
                                                <th style={th}>Max / Day</th>
                                                <th style={th}>Min Dwell (min)</th>
                                                <th style={th}>DVS Expiry (days)</th>
                                                <th style={th}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categoryProfiles.map((profile) => {
                                                const edits = categoryProfileEdits[profile.category] || {};
                                                return (
                                                    <tr key={profile.category}>
                                                        <td style={td}>{profile.category}</td>
                                                        <td style={td}>
                                                            <input
                                                                style={miniInput}
                                                                type="number"
                                                                value={edits.base_points ?? ""}
                                                                onChange={(e) =>
                                                                    setCategoryProfileEdits((prev) => ({
                                                                        ...prev,
                                                                        [profile.category]: { ...edits, base_points: e.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </td>
                                                        <td style={td}>
                                                            <input
                                                                style={miniInput}
                                                                type="number"
                                                                step="0.05"
                                                                value={edits.pending_ratio ?? ""}
                                                                onChange={(e) =>
                                                                    setCategoryProfileEdits((prev) => ({
                                                                        ...prev,
                                                                        [profile.category]: { ...edits, pending_ratio: e.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </td>
                                                        <td style={td}>
                                                            <input
                                                                style={miniInput}
                                                                type="number"
                                                                value={edits.cooldown_minutes ?? ""}
                                                                onChange={(e) =>
                                                                    setCategoryProfileEdits((prev) => ({
                                                                        ...prev,
                                                                        [profile.category]: { ...edits, cooldown_minutes: e.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </td>
                                                        <td style={td}>
                                                            <input
                                                                style={miniInput}
                                                                type="number"
                                                                value={edits.max_rewarded_visits_per_day ?? ""}
                                                                onChange={(e) =>
                                                                    setCategoryProfileEdits((prev) => ({
                                                                        ...prev,
                                                                        [profile.category]: { ...edits, max_rewarded_visits_per_day: e.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </td>
                                                        <td style={td}>
                                                            <input
                                                                style={miniInput}
                                                                type="number"
                                                                value={edits.min_dwell_minutes ?? ""}
                                                                onChange={(e) =>
                                                                    setCategoryProfileEdits((prev) => ({
                                                                        ...prev,
                                                                        [profile.category]: { ...edits, min_dwell_minutes: e.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </td>
                                                        <td style={td}>
                                                            <input
                                                                style={miniInput}
                                                                type="number"
                                                                value={edits.dvs_expiry_days ?? ""}
                                                                onChange={(e) =>
                                                                    setCategoryProfileEdits((prev) => ({
                                                                        ...prev,
                                                                        [profile.category]: { ...edits, dvs_expiry_days: e.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </td>
                                                        <td style={td}>
                                                            <button
                                                                style={smallButton}
                                                                onClick={() => handleSaveCategoryProfile(profile.category)}
                                                            >
                                                                Save
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div style={{ ...card, marginBottom: 16 }}>
                            <h3 style={cardTitle}>Store Overrides</h3>
                            <p style={{ marginTop: 0, color: "var(--cc-muted)", fontSize: 13 }}>
                                Open a store in the Stores tab to set per-store overrides.
                            </p>
                        </div>
                    </div>
                )}

                {err && <p style={errorText}>{err}</p>}
                
                {/* User Stores Modal */}
                {showUserStores && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            ...card,
                            maxWidth: 1000,
                            maxHeight: "90vh",
                            margin: 20,
                            backgroundColor: "white",
                            overflow: "auto"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h3 style={{ margin: 0 }}>User Stores</h3>
                                <button style={closeButton} onClick={() => { setShowUserStores(false); setUserStores([]); }}>
                                    ×
                                </button>
                            </div>
                            
                            {userStoresLoading ? (
                                <p>Loading stores...</p>
                            ) : userStores.length === 0 ? (
                                <p style={{ color: "var(--cc-muted)" }}>No stores found for this user.</p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Store Name</th>
                                                <th style={th}>Category</th>
                                                <th style={th}>Address</th>
                                                <th style={th}>Location</th>
                                                <th style={th}>Discount</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Visits</th>
                                                <th style={th}>Loops Earned</th>
                                                {/* Commented out - not tracking money transactions
                                                <th style={th}>Total Spent</th>
                                                */}
                                                <th style={th}>First Visit</th>
                                                <th style={th}>Last Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {userStores.map((store) => (
                                                <tr key={store.store_id}>
                                                    <td style={td}><strong>{store.store_name}</strong></td>
                                                    <td style={td}>{store.category}</td>
                                                    <td style={td}>{store.store_address || "-"}</td>
                                                    <td style={td}>
                                                        {store.latitude && store.longitude 
                                                            ? `${store.latitude.toFixed(4)}, ${store.longitude.toFixed(4)}`
                                                            : "-"}
                                                    </td>
                                                    <td style={td}>{store.base_discount_percent}%</td>
                                                    <td style={td}>{store.store_email || "-"}</td>
                                                    <td style={td}>{store.store_phone || "-"}</td>
                                                    <td style={td}>{store.visit_count}</td>
                                                    <td style={td}><strong>{store.total_loops_earned?.toLocaleString() || 0}</strong></td>
                                                    {/* Commented out - not tracking money transactions
                                                    <td style={td}>${((store.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                    */}
                                                    <td style={td}>{store.first_visit_at ? new Date(store.first_visit_at).toLocaleDateString() : "-"}</td>
                                                    <td style={td}>{store.last_visit_at ? new Date(store.last_visit_at).toLocaleDateString() : "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Store Customers Modal */}
                {showStoreCustomers && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            ...card,
                            maxWidth: 900,
                            maxHeight: "90vh",
                            margin: 20,
                            backgroundColor: "white",
                            overflow: "auto"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h3 style={{ margin: 0 }}>Store Customers</h3>
                                <button style={closeButton} onClick={() => { setShowStoreCustomers(false); setStoreCustomers([]); }}>
                                    ×
                                </button>
                            </div>
                            
                            {storeCustomersLoading ? (
                                <p>Loading customers...</p>
                            ) : storeCustomers.length === 0 ? (
                                <p style={{ color: "var(--cc-muted)" }}>No customers found for this store.</p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Name</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Plan</th>
                                                <th style={th}>Visits</th>
                                                <th style={th}>Loops Earned</th>
                                                {/* Commented out - not tracking money transactions
                                                <th style={th}>Total Spent</th>
                                                */}
                                                <th style={th}>Last Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {storeCustomers.map((customer) => (
                                                <tr key={customer.id}>
                                                    <td style={td}>{customer.name}</td>
                                                    <td style={td}>{customer.phone}</td>
                                                    <td style={td}>{customer.email || "-"}</td>
                                                    <td style={td}>{customer.plan}</td>
                                                    <td style={td}>{customer.visit_count}</td>
                                                    <td style={td}><strong>{customer.total_loops_earned?.toLocaleString() || 0}</strong></td>
                                                    {/* Commented out - not tracking money transactions
                                                    <td style={td}>${((customer.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                    */}
                                                    <td style={td}>{customer.last_visit_at ? new Date(customer.last_visit_at).toLocaleDateString() : "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Delete Confirmation Modal */}
                {deleteConfirm.show && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            ...card,
                            maxWidth: 500,
                            margin: 20,
                            backgroundColor: "var(--cc-surface)"
                        }}>
                            <h3 style={{ margin: "0 0 16px 0", fontSize: 20, color: "var(--cc-text)" }}>
                                Confirm Delete
                            </h3>
                            <p style={{ margin: "0 0 24px 0", color: "var(--cc-muted)" }}>
                                Are you sure you want to delete {deleteConfirm.type === "user" ? "user" : "store"} <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
                            </p>
                            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                <button
                                    style={secondaryButton}
                                    onClick={() => setDeleteConfirm({ show: false, type: null, id: null, name: null })}
                                >
                                    Cancel
                                </button>
                                <button
                                    style={{ ...primaryButton, background: "var(--cc-danger)", color: "white" }}
                                    onClick={deleteConfirm.type === "user" ? handleDeleteUser : handleDeleteStore}
                                    disabled={loading}
                                >
                                    {loading ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// Styles
const container = {
    minHeight: "100vh",
    backgroundColor: "var(--cc-bg)",
    fontFamily: "system-ui, -apple-system, sans-serif",
};

const loginContainer = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--cc-bg)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "20px",
};

const loginBox = {
    backgroundColor: "var(--cc-surface)",
    borderRadius: 12,
    padding: "32px",
    boxShadow: "var(--cc-shadow-md)",
    maxWidth: 400,
    width: "100%",
};

const input = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid var(--cc-border)",
    fontSize: 14,
    marginBottom: 12,
    boxSizing: "border-box",
};

const miniInput = {
    width: "100%",
    minWidth: 80,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid var(--cc-border)",
    fontSize: 12,
    boxSizing: "border-box",
};

const primaryButton = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "var(--cc-primary)",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
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

const errorText = {
    color: "var(--cc-danger)",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
};

const header = {
    backgroundColor: "var(--cc-surface)",
    borderBottom: "1px solid var(--cc-border)",
    padding: "20px",
    boxShadow: "var(--cc-shadow-sm)",
};

const headerContent = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 16,
};

const title = {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: "var(--cc-text)",
};

const headerActions = {
    display: "flex",
    alignItems: "center",
    gap: 16,
};

const userInfo = {
    fontSize: 14,
    color: "var(--cc-muted)",
};

const logoutButton = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid var(--cc-border)",
    backgroundColor: "var(--cc-surface)",
    color: "var(--cc-text)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
};

const tabs = {
    display: "flex",
    gap: 8,
    borderBottom: "2px solid var(--cc-border)",
};

const tabButton = {
    padding: "12px 20px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--cc-muted)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: "-2px",
    transition: "all 0.2s",
};

const activeTabStyle = {
    color: "var(--cc-primary)",
    borderBottom: "2px solid var(--cc-primary)",
};

const main = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 20px",
};

const sectionTitle = {
    fontSize: 20,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 20,
    color: "var(--cc-text)",
};

const statsGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 32,
};

const statCard = {
    backgroundColor: "var(--cc-surface)",
    borderRadius: 12,
    padding: "24px",
    boxShadow: "var(--cc-shadow-sm)",
    textAlign: "center",
};

const statValue = {
    fontSize: 32,
    fontWeight: 700,
    margin: "0 0 8px 0",
    color: "var(--cc-text)",
};

const statLabel = {
    fontSize: 14,
    color: "var(--cc-muted)",
    margin: 0,
};

const card = {
    backgroundColor: "var(--cc-surface)",
    borderRadius: 12,
    padding: "24px",
    boxShadow: "var(--cc-shadow-sm)",
    marginBottom: 24,
};

const cardTitle = {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 16,
    color: "var(--cc-text)",
};

const tableContainer = {
    overflowX: "auto",
};

const table = {
    width: "100%",
    borderCollapse: "collapse",
};

const th = {
    padding: "12px",
    textAlign: "left",
    borderBottom: "2px solid var(--cc-border)",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--cc-text)",
};

const td = {
    padding: "12px",
    borderBottom: "1px solid var(--cc-border)",
    fontSize: 14,
    color: "var(--cc-text)",
};

const smallButton = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid var(--cc-border)",
    backgroundColor: "var(--cc-surface)",
    color: "var(--cc-text)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
};

const secondaryButton = {
    ...smallButton,
    padding: "10px 20px",
};

const modal = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
};

const modalContent = {
    backgroundColor: "var(--cc-surface)",
    borderRadius: 12,
    padding: "24px",
    maxWidth: 600,
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
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
};

const label = {
    display: "block",
    fontSize: 13,
    marginBottom: 4,
    fontWeight: 500,
    color: "var(--cc-text)",
};

const detailRow = {
    padding: "12px 0",
    borderBottom: "1px solid var(--cc-border)",
    fontSize: 14,
};

