// src/StoreMapView.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { fetchNearbyEligibleStores, fetchGooglePlaceDetails, fetchUserMe, activateStoreSlot, submitStoreRequest } from "./api";
import { TierBadge } from "./ui/Badge";

const BASE_RADIUS_MILES = 1.0;
const RADIUS_STEPS = [1, 3, 5, 10];
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_VISIBLE_COUNT = 12;

// ----- helpers for tier + bonus -----
function getTier(totalLoops) {
    if (!totalLoops || totalLoops < 500) return "BRONZE";
    if (totalLoops < 2000) return "SILVER";
    if (totalLoops < 6000) return "GOLD";
    if (totalLoops < 15000) return "PLATINUM";
    return "DIAMOND";
}

function getTierBonusPercent(tier) {
    switch (tier) {
        case "SILVER":
            return 2;
        case "GOLD":
            return 4;
        case "PLATINUM":
            return 6;
        case "DIAMOND":
            return 10;
        case "BRONZE":
        default:
            return 0;
    }
}

export default function StoreMapView({ token, refreshKey = 0 }) {
    const [stores, setStores] = useState([]);
    const [position, setPosition] = useState({ lat: 40.72, lng: -74.04 });
    const [err, setErr] = useState("");
    const [radiusNotice, setRadiusNotice] = useState("");
    const [radiusMiles, setRadiusMiles] = useState(BASE_RADIUS_MILES);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortMode, setSortMode] = useState("recommended"); // recommended | closest | rewards | newest
    const [viewMode, setViewMode] = useState("cards"); // cards | table

    const [user, setUser] = useState(null);
    const [userTier, setUserTier] = useState("BRONZE");
    const [tierBonus, setTierBonus] = useState(0);

    const [placeDetails, setPlaceDetails] = useState({});
    const [detailsLoadingId, setDetailsLoadingId] = useState(null);
    const lastFetchRef = useRef({ key: "", ts: 0 });
    const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
    const [activeStoreIds, setActiveStoreIds] = useState([]);
    const [unlockedStoreIds, setUnlockedStoreIds] = useState([]);
    const [yourStores, setYourStores] = useState([]);
    const [storeLoopsMap, setStoreLoopsMap] = useState({});
    const [freeLimit, setFreeLimit] = useState(0);
    const [activeCount, setActiveCount] = useState(0);
    const [expandedYourStoreKeys, setExpandedYourStoreKeys] = useState(() => new Set());
    const [yourStoresPage, setYourStoresPage] = useState(1);
    const STORES_PER_PAGE = 3;
    const [expandedRowKey, setExpandedRowKey] = useState(null);
    const [showRequestStoreModal, setShowRequestStoreModal] = useState(false);
    const [selectedStoreForRequest, setSelectedStoreForRequest] = useState(null);
    const [requestStoreForm, setRequestStoreForm] = useState({ store_name: "", note: "" });
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    // Handle window resize for responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Load user info (for tier / bonus)
    useEffect(() => {
        if (!token) return;

        fetchUserMe({ token })
            .then((data) => {
                const u = data.user;
                setUser(u);
                setStoreLoopsMap(data?.store_loops_balance_map || {});
                const tier = getTier(u.total_loops_earned || 0);
                setUserTier(tier);
                setTierBonus(getTierBonusPercent(tier));
            })
            .catch((e) => {
                // if user call fails, we still show stores with base discount only
            });
    }, [token, refreshKey]);

    // Load stores (nearby) using home location if available, else geolocation
    useEffect(() => {
        if (user?.latitude && user?.longitude) {
            const p = { lat: user.latitude, lng: user.longitude };
            setPosition(p);
            setRadiusMiles(BASE_RADIUS_MILES);
            setRadiusNotice("");
            loadStores();
            return;
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const p = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    };
                    setPosition(p);
                    setErr("Set your home location to see nearby stores.");
                },
                () => {
                    // geolocation blocked → use default center
                    setErr("Set your home location to see nearby stores.");
                }
            );
        } else {
            setErr("Set your home location to see nearby stores.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (user?.latitude && user?.longitude) {
            setVisibleCount(DEFAULT_VISIBLE_COUNT);
            setRadiusMiles(BASE_RADIUS_MILES);
            setRadiusNotice("");
            loadStores();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategory]);

    useEffect(() => {
        if (!user?.latitude || !user?.longitude) return;
        const term = String(searchTerm || "").trim();
        if (term.length > 0 && term.length < 3) return;
        const timeoutId = setTimeout(() => {
            setVisibleCount(DEFAULT_VISIBLE_COUNT);
            setRadiusMiles(BASE_RADIUS_MILES);
            setRadiusNotice("");
            loadStores(true);
        }, 400);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    async function loadStores(force = false) {
        try {
            if (!token) return;
            const fetchForRadius = async (radius) => {
            const cacheKeyParts = [
                    "v3",
                    user?.id || "anon",
                    user?.latitude?.toFixed(4) || "lat",
                    user?.longitude?.toFixed(4) || "lng",
                    radius.toFixed(2),
                    selectedCategory,
                String(searchTerm || "").trim().toLowerCase(),
                ];
                const storageKey = `nearbyStores:${cacheKeyParts.join("|")}`;
                if (!force) {
                    const cachedRaw = localStorage.getItem(storageKey);
                    if (cachedRaw) {
                        const cached = JSON.parse(cachedRaw);
                        if (cached?.ts && Date.now() - cached.ts < CACHE_TTL_MS) {
                            return { data: cached, storageKey, fromCache: true };
                        }
                    }
                }
                const cacheKey = JSON.stringify({
                    lat: user?.latitude,
                    lng: user?.longitude,
                    radius,
                category: selectedCategory,
                    query: String(searchTerm || "").trim().toLowerCase(),
                });
                const now = Date.now();
                if (!force && lastFetchRef.current.key === cacheKey && now - lastFetchRef.current.ts < 60000) {
                    return { data: null, storageKey, fromCache: false };
                }
                lastFetchRef.current = { key: cacheKey, ts: now };
                const data = await fetchNearbyEligibleStores(token, radius, {
                    category: selectedCategory !== "all" ? selectedCategory : null,
                    query: String(searchTerm || "").trim() || null,
                    maxResults: 50,
                    import: true,
                });
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        ts: Date.now(),
                        stores: data.stores || [],
                        yourStores: data.yourStores || [],
                        activeStoreIds: data.activeStoreIds || [],
                        unlockedStoreIds: data.unlockedStoreIds || [],
                        freeLimit: data.limit || 0,
                        activeCount: data.activeCount || 0,
                    })
                );
                return { data, storageKey, fromCache: false };
            };

            let chosenRadius = BASE_RADIUS_MILES;
            let finalData = null;
            const orderedSteps = RADIUS_STEPS.filter((r) => r >= BASE_RADIUS_MILES);
            for (const radius of orderedSteps) {
                const result = await fetchForRadius(radius);
                const data = result?.data || {};
                const storesList = data.stores || [];
                if (storesList.length > 0 || radius === orderedSteps[orderedSteps.length - 1]) {
                    chosenRadius = radius;
                    finalData = data;
                    break;
                }
            }

            if (!finalData) return;
            setStores(finalData.stores || []);
            setYourStores(finalData.yourStores || []);
            setActiveStoreIds(finalData.activeStoreIds || []);
            setUnlockedStoreIds(finalData.unlockedStoreIds || []);
            setFreeLimit(finalData.limit || 0);
            setActiveCount(finalData.activeCount || 0);
            setRadiusMiles(chosenRadius);
            if (chosenRadius > BASE_RADIUS_MILES) {
                setRadiusNotice(`Showing stores within ${chosenRadius} miles because none were found within ${BASE_RADIUS_MILES} mile.`);
            } else {
                setRadiusNotice("");
            }
            setErr("");
        } catch (e) {
            setErr(e.message);
        }
    }

    const categories = useMemo(
        () => [
            "all",
            "grocery",
            "liquor",
            "barber",
            "salon",
            "coffee",
            "restaurant",
            "pharmacy",
            "bakery",
            "laundromat",
            "other",
        ],
        []
    );

    function getTierRank(tier) {
        const t = String(tier || "standard").toLowerCase();
        if (t === "premium") return 3;
        if (t === "boosted") return 2;
        return 1;
    }

    function normalizeText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function dedupeStores(list) {
        const map = new Map();
        for (const store of list || []) {
            const placeId = store?.place_id ? String(store.place_id).trim() : "";
            const address = normalizeText(store?.address);
            const name = normalizeText(store?.name);
            const category = normalizeText(store?.category);
            const key = placeId
                ? `p:${placeId}`
                : address
                    ? `a:${address}|${category}`
                    : `n:${name}|${category}`;
            const score =
                (store?.address ? 1 : 0) +
                (store?.phone ? 1 : 0) +
                (store?.place_id ? 1 : 0) +
                (store?.reward_points != null ? 1 : 0);
            const existing = map.get(key);
            if (!existing || score > existing._score) {
                map.set(key, { ...store, _score: score });
            }
        }
        return Array.from(map.values()).map((s) => {
            const copy = { ...s };
            delete copy._score;
            return copy;
        });
    }

    function getPromoLabel(store) {
        const tier = String(store?.reward_tier || "standard").toLowerCase();
        const loops = store?.reward_points != null ? Number(store.reward_points) : null;
        const discount = store?.base_discount_percent != null ? Number(store.base_discount_percent) : null;
        if (tier === "premium" && loops != null) return `Premium • ${loops} loops/visit`;
        if (tier === "boosted" && loops != null) return `Boosted • ${loops} loops/visit`;
        if (loops != null) return `${loops} loops/visit`;
        if (discount != null && discount > 0) return `${discount}% base discount`;
        return "Offer available";
    }

    function computeRecommendedSortValue(store) {
        const distance = Number(store?.distance_miles ?? 999);
        const loops = Number(store?.reward_points ?? 0);
        const tierRank = getTierRank(store?.reward_tier);
        const hasNews = store?.news && String(store.news).trim() && String(store.news).trim() !== "No updates yet.";
        const newsBoost = hasNews ? 0.5 : 0;
        // Higher is better
        return (tierRank * 2) + (loops / 10) + newsBoost - (distance * 1.2);
    }

    const filteredStores = useMemo(() => {
        const term = String(searchTerm || "").trim().toLowerCase();
        const byCategory =
        selectedCategory === "all"
            ? stores
                : (stores || []).filter((s) => s.category === selectedCategory);
        const bySearch =
            !term
                ? byCategory
                : byCategory.filter((s) => {
                    const hay = `${s?.name || ""} ${s?.address || ""} ${s?.category || ""}`.toLowerCase();
                    return hay.includes(term);
                });

        // Filter out stores that user has already joined (active or unlocked)
        const notJoined = bySearch.filter((s) => {
            const isActive = activeStoreIds.includes(s.id);
            const isUnlocked = unlockedStoreIds.includes(s.id);
            return !isActive && !isUnlocked;
        });

        const deduped = dedupeStores(notJoined);
        const sorted = [...deduped].sort((a, b) => {
            if (sortMode === "closest") return (a.distance_miles || 999) - (b.distance_miles || 999);
            if (sortMode === "rewards") return (b.reward_points || 0) - (a.reward_points || 0);
            if (sortMode === "newest") return getTierRank(b.reward_tier) - getTierRank(a.reward_tier);
            // recommended
            return computeRecommendedSortValue(b) - computeRecommendedSortValue(a);
        });

        return sorted;
    }, [stores, selectedCategory, searchTerm, sortMode, activeStoreIds, unlockedStoreIds]);

    const displayedStores = filteredStores.slice(0, visibleCount);
    const hasMoreStores = filteredStores.length > displayedStores.length;
    const allYourStores = useMemo(() => {
        if (Array.isArray(yourStores) && yourStores.length > 0) return yourStores;
        return (stores || []).filter((s) => activeStoreIds.includes(s.id) || unlockedStoreIds.includes(s.id));
    }, [yourStores, stores, activeStoreIds, unlockedStoreIds]);

    const visibleYourStores = useMemo(() => {
        const startIndex = (yourStoresPage - 1) * STORES_PER_PAGE;
        const endIndex = startIndex + STORES_PER_PAGE;
        return allYourStores.slice(startIndex, endIndex);
    }, [allYourStores, yourStoresPage]);

    const totalYourStoresPages = Math.ceil(allYourStores.length / STORES_PER_PAGE);

    function formatCategory(category) {
        if (!category) return "Other";
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    function getRewardLabel(store) {
        if (store?.reward_points != null) return `${store.reward_points} loops/visit`;
        if (store?.base_discount_percent != null) return `${store.base_discount_percent}% base`;
        return "—";
    }

    function getStoreKey(store) {
        return String(store?.id || store?.place_id || store?.name || Math.random());
    }

    function getMyStoreLoops(storeId) {
        if (!storeId) return 0;
        const value = storeLoopsMap?.[String(storeId)];
        return Number.isFinite(Number(value)) ? Number(value) : 0;
    }

    function toggleYourStoreExpanded(store) {
        const key = getStoreKey(store);
        setExpandedYourStoreKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function openDirections(store) {
        const lat = store?.latitude;
        const lng = store?.longitude;
        const addr = store?.address || store?.name;
        const url =
            lat != null && lng != null
                ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr || "")}`;
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function getPhoneForStore(store) {
        if (store?.phone) return store.phone;
        if (!store?.place_id) return null;
        return placeDetails[store.place_id]?.phone || null;
    }

    async function loadPhoneForStore(store) {
        if (!store?.place_id || !token) return;
        if (placeDetails[store.place_id]) return;
        setDetailsLoadingId(store.place_id);
        try {
            const details = await fetchGooglePlaceDetails(token, store.place_id);
            setPlaceDetails((prev) => ({
                ...prev,
                [store.place_id]: details,
            }));
        } catch {
            setPlaceDetails((prev) => ({
                ...prev,
                [store.place_id]: { phone: null, website: null },
            }));
        } finally {
            setDetailsLoadingId(null);
        }
    }

    return (
        <div style={{ marginTop: 24 }}>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                <div
                    style={{
                        border: "1px solid var(--cc-border)",
                        borderRadius: 14,
                        padding: 14,
                        background:
                            "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(16,185,129,0.08))",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                            <h2 style={{ margin: 0 }}>Nearby Offers</h2>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 4 }}>
                                Explore stores near your home and join the ones you love.
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                                type="button"
                                onClick={() => loadStores(true)}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    border: "1px solid var(--cc-border)",
                                    background: "var(--cc-surface)",
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                            >
                                Refresh stores
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 10 }}>
                    {user && (
                        <div style={{ fontSize: 13 }}>
                            Your tier: <strong>{userTier}</strong> (bonus{" "}
                            <strong>{tierBonus}%</strong>)
                        </div>
                    )}
                        {freeLimit > 0 && (
                    <div style={{ fontSize: 13 }}>
                                Free stores used: <strong>{activeCount}</strong> / {freeLimit}
                            </div>
                        )}
                        {user?.address && (
                            <div style={{ fontSize: 13 }}>
                                Home: <strong>{user.address}</strong>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search stores, address, category..."
                            style={{
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--cc-border)",
                                fontSize: 13,
                                minWidth: isMobile ? "100%" : 320,
                                flex: "1 1 260px",
                                background: "var(--cc-surface)",
                            }}
                        />
                        <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value)}
                            style={{
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--cc-border)",
                                fontSize: 13,
                                background: "var(--cc-surface)",
                            }}
                        >
                            <option value="recommended">Recommended</option>
                            <option value="closest">Closest</option>
                            <option value="rewards">Highest rewards</option>
                            <option value="newest">Boosted/Premium first</option>
                        </select>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button
                                type="button"
                                onClick={() => setViewMode("cards")}
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid var(--cc-border)",
                                    background: viewMode === "cards" ? "var(--cc-text)" : "var(--cc-surface)",
                                    color: viewMode === "cards" ? "#fff" : "var(--cc-text)",
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                            >
                                Cards
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("table")}
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1px solid var(--cc-border)",
                                    background: viewMode === "table" ? "var(--cc-text)" : "var(--cc-surface)",
                                    color: viewMode === "table" ? "#fff" : "var(--cc-text)",
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                            >
                                List
                            </button>
                </div>
            </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        {categories.map((c) => {
                            const active = selectedCategory === c;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setSelectedCategory(c)}
                style={{
                                        padding: "7px 10px",
                                        borderRadius: 999,
                                        border: "1px solid var(--cc-border)",
                                        background: active ? "var(--cc-primary)" : "var(--cc-surface)",
                                        color: active ? "#fff" : "var(--cc-text)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                    }}
                                >
                                    {c === "all" ? "All" : formatCategory(c)}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 10 }}>
                        Rewards = loops per visit from each store. Enrollment is free, and tiers progress from your total loops earned.
                    </div>
                </div>

            </div>

            {err && <p style={{ color: "red", fontSize: 14 }}>{err}</p>}
            {radiusNotice && <p style={{ color: "var(--cc-muted)", fontSize: 12 }}>{radiusNotice}</p>}

            {allYourStores.length > 0 && (
                <div style={{ ...{ border: "1px solid var(--cc-border)", borderRadius: 8, background: "var(--cc-surface)", padding: 12, marginBottom: 16 } }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Your Stores ({allYourStores.length})</h3>
                        {freeLimit > 0 && (
                            <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>
                                Free stores: {activeCount} / {freeLimit}
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 8 }}>
                        Active = free slot used. Unlocked = paid with money.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {visibleYourStores.map((s) => {
                                const key = getStoreKey(s);
                                const isActive = activeStoreIds.includes(s.id);
                                const isUnlocked = unlockedStoreIds.includes(s.id);
                                const phone = getPhoneForStore(s);
                                const isLoading = detailsLoadingId === s.place_id;
                                const expanded = expandedYourStoreKeys.has(key);
                                const badgeStyle = isActive
                                    ? { background: "var(--cc-success)", color: "#fff" }
                                    : { background: "var(--cc-primary)", color: "#fff" };
                            return (
                                    <div
                                        key={`your-${key}`}
                                        style={{
                                            padding: 10,
                                            border: "1px solid var(--cc-border)",
                                            borderRadius: 10,
                                            background: "var(--cc-surface)",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                                                    <div style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, ...badgeStyle }}>
                                                        {isActive ? "ACTIVE" : "UNLOCKED"}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 2 }}>
                                                    {formatCategory(s.category)} • <strong>{getRewardLabel(s)}</strong>
                                                    {phone ? (
                                                        <>
                                                            {" "}•{" "}
                                                            <a href={`tel:${phone}`}>{phone}</a>
                                                        </>
                                                    ) : s.place_id ? (
                                                        <>
                                                            {" "}•{" "}
                                                            <button
                                                                type="button"
                                                                onClick={() => loadPhoneForStore(s)}
                                                                disabled={isLoading}
                                                                style={{
                                                                    padding: "2px 6px",
                                                                    fontSize: 11,
                                                                    borderRadius: 6,
                                                                    border: "1px solid var(--cc-border)",
                                                                    background: "var(--cc-surface-2)",
                                                                    cursor: isLoading ? "default" : "pointer",
                                                                }}
                                                            >
                                                                {isLoading ? "Loading..." : "Load phone"}
                                                            </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 6 }}>
                                                    {s.news || "No updates yet."}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--cc-primary)", marginTop: 4, fontWeight: 600 }}>
                                                    Your rewards here: {getMyStoreLoops(s.id)} loops • Redeem at {Number(s.gift_card_min_loops || 1000)} loops (gift card eligible)
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleYourStoreExpanded(s)}
                                                    style={{
                                                        padding: "6px 10px",
                                                        borderRadius: 8,
                                                        border: "1px solid var(--cc-border)",
                                                        background: "var(--cc-surface)",
                                                        fontSize: 12,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    {expanded ? "Hide" : "Details"}
                                                </button>
                                            </div>
                                        </div>

                                        {expanded && (
                                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--cc-border)" }}>
                                                <div style={{ fontSize: 12, color: "var(--cc-text)", marginBottom: 8 }}>
                                                    <strong>Address:</strong> {s.address || "Address not provided"}
                                                </div>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    {phone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(`tel:${phone}`)}
                                                            style={{
                                                                padding: "6px 10px",
                                                                borderRadius: 8,
                                                                border: "1px solid var(--cc-border)",
                                                                background: "var(--cc-surface)",
                                                                fontSize: 12,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Call
                                                        </button>
                                                    )}
                                                    {s.address && (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigator.clipboard?.writeText(String(s.address))}
                                                            style={{
                                                                padding: "6px 10px",
                                                                borderRadius: 8,
                                                                border: "1px solid var(--cc-border)",
                                                                background: "var(--cc-surface)",
                                                                fontSize: 12,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Copy address
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openDirections(s)}
                                                        style={{
                                                            padding: "6px 10px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--cc-border)",
                                                            background: "var(--cc-surface)",
                                                            fontSize: 12,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Directions
                                                    </button>
                                                    {!isActive && !isUnlocked && (
                                                        <span style={{ fontSize: 12, color: "var(--cc-muted)" }}>Not added yet</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                            );
                        })}
                    </div>
                    {/* Pagination */}
                    {totalYourStoresPages > 1 && (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--cc-border)" }}>
                            <button
                                type="button"
                                onClick={() => setYourStoresPage(prev => Math.max(1, prev - 1))}
                                disabled={yourStoresPage === 1}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "1px solid var(--cc-border)",
                                    background: yourStoresPage === 1 ? "var(--cc-surface)" : "var(--cc-primary)",
                                    color: yourStoresPage === 1 ? "var(--cc-muted)" : "#fff",
                                    fontSize: 12,
                                    cursor: yourStoresPage === 1 ? "not-allowed" : "pointer",
                                    opacity: yourStoresPage === 1 ? 0.5 : 1,
                                }}
                            >
                                Previous
                            </button>
                            <div style={{ fontSize: 12, color: "var(--cc-text)" }}>
                                Page {yourStoresPage} of {totalYourStoresPages}
                            </div>
                            <button
                                type="button"
                                onClick={() => setYourStoresPage(prev => Math.min(totalYourStoresPages, prev + 1))}
                                disabled={yourStoresPage === totalYourStoresPages}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "1px solid var(--cc-border)",
                                    background: yourStoresPage === totalYourStoresPages ? "var(--cc-surface)" : "var(--cc-primary)",
                                    color: yourStoresPage === totalYourStoresPages ? "var(--cc-muted)" : "#fff",
                                    fontSize: 12,
                                    cursor: yourStoresPage === totalYourStoresPages ? "not-allowed" : "pointer",
                                    opacity: yourStoresPage === totalYourStoresPages ? 0.5 : 1,
                                }}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {filteredStores.length === 0 ? (
                <p>No stores found for this category in this radius.</p>
            ) : viewMode === "cards" ? (
                <>
                    {/* Featured offers - Only show partner stores (stores on CityCircle) */}
                    {(() => {
                        // Filter out joined stores from featured stores as well
                        const featuredStores = filteredStores
                            .filter(s => s.is_partner_store === true)
                            .filter(s => !activeStoreIds.includes(s.id) && !unlockedStoreIds.includes(s.id))
                            .slice(0, 8);
                        if (featuredStores.length === 0) return null;
                        return (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                                    <h3 style={{ margin: 0, fontSize: 16 }}>Stores on CityCircle</h3>
                                    <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                                        Tap a card to explore details.
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                                    {featuredStores.map((store) => {
                                    const key = getStoreKey(store);
                                    const isActive = activeStoreIds.includes(store.id);
                                    const isUnlocked = unlockedStoreIds.includes(store.id);
                                    // freeLimit <= 0 means unlimited free enrollments
                                    const freeSlotsAvailable = freeLimit <= 0 ? true : activeCount < freeLimit;
                                    const requiresPayment = !isActive && !isUnlocked && !freeSlotsAvailable;
                                    const isLocked = store.is_locked || requiresPayment;
                                    const phone = getPhoneForStore(store);
                                    const expanded = expandedRowKey === key;
                                return (
                                        <div
                                            key={`feat-${key}`}
                                            onClick={() => setExpandedRowKey(expanded ? null : key)}
                                            role="button"
                                            tabIndex={0}
                                        style={{
                                                minWidth: isMobile ? 260 : 320,
                                                border: "1px solid var(--cc-border)",
                                                borderRadius: 14,
                                                padding: 12,
                                                background: "var(--cc-surface)",
                                            cursor: "pointer",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {store.name}
                                        </div>
                                                    <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 2 }}>
                                                        {formatCategory(store.category)}{" "}
                                                        {store.distance_miles != null && (
                                                            <span>• {(Number(store.distance_miles) || 0).toFixed(2)} mi</span>
                                                        )}
                                        </div>
                                                    {store.is_partner_store === false && (
                                                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--cc-warning)", fontWeight: 600 }}>
                                                            Not on CityCircle yet
                                                        </div>
                                                    )}
                                                </div>
                                                {store.is_partner_store !== false && <TierBadge tier={store.reward_tier} />}
                                            </div>

                                            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--cc-text)" }}>
                                                {getPromoLabel(store)}
                                            </div>
                                            <div style={{ marginTop: 6, fontSize: 12, color: "var(--cc-muted)" }}>
                                                {store.news || "No updates yet."}
                                            </div>

                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10 }}>
                                        <div style={{ fontSize: 12 }}>
                                                    {isActive ? (
                                                        <span style={{ color: "var(--cc-success)", fontWeight: 800 }}>ACTIVE</span>
                                                    ) : isUnlocked ? (
                                                        <span style={{ color: "var(--cc-primary)", fontWeight: 800 }}>UNLOCKED</span>
                                                    ) : (
                                                        <span style={{ color: "var(--cc-success)", fontWeight: 800 }}>AVAILABLE</span>
                                            )}
                                        </div>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                    {/* Non-partner stores: Only show Request Store button (cannot join stores not on CityCircle) */}
                                                    {store.is_partner_store === false ? (
                                                        (store.can_request_store === true || store.can_request_store === undefined) ? (
                                                            <button
                                                                type="button"
                                                                disabled={store.is_requested === true || store.max_requests_reached === true}
                                                                onClick={(e) => {
                                                                    if (store.is_requested || store.max_requests_reached) return;
                                                                    e.stopPropagation();
                                                                    setSelectedStoreForRequest(store);
                                                                    setRequestStoreForm({ 
                                                                        store_name: String(store.name || "").trim() || "", 
                                                                        note: "" 
                                                                    });
                                                                    setShowRequestStoreModal(true);
                                                                }}
                                                                style={{
                                                                    padding: "8px 10px",
                                                                    borderRadius: 10,
                                                                    border: (store.is_requested || store.max_requests_reached) ? "1px solid var(--cc-border)" : "1px solid var(--cc-primary)",
                                                                    background: (store.is_requested || store.max_requests_reached) ? "var(--cc-surface)" : "var(--cc-primary)",
                                                                    color: (store.is_requested || store.max_requests_reached) ? "var(--cc-muted)" : "#fff",
                                                                    fontSize: 12,
                                                                    cursor: (store.is_requested || store.max_requests_reached) ? "not-allowed" : "pointer",
                                                                    opacity: (store.is_requested || store.max_requests_reached) ? 0.6 : 1,
                                                                }}
                                                            >
                                                                {store.is_requested ? "Request Sent" : store.max_requests_reached ? "Max Requests Reached" : "Request Store"}
                                                            </button>
                                                        ) : (
                                                            <div style={{ fontSize: 11, color: "var(--cc-muted)", fontStyle: "italic" }}>
                                                                {store.max_requests_reached ? "Max requests reached" : "Store already signed up"}
                                                            </div>
                                                        )
                                                    ) : (
                                                        /* Partner stores: Show Join/Directions buttons (can only join stores that are on CityCircle) */
                                                        isActive || isUnlocked ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDirections(store);
                                                            }}
                                                            style={{
                                                                padding: "8px 10px",
                                                                borderRadius: 10,
                                                                border: "1px solid var(--cc-border)",
                                                                background: "var(--cc-surface)",
                                                                fontSize: 12,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Directions
                                                        </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await activateStoreSlot(token, store.id);
                                                                        setActiveStoreIds((prev) => prev.concat(store.id));
                                                                        setActiveCount((prev) => prev + 1);
                                                                    } catch (e2) {
                                                                        alert(e2.message || "Failed to join store");
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: "8px 10px",
                                                                    borderRadius: 10,
                                                                    border: "1px solid var(--cc-primary)",
                                                                    background: "var(--cc-primary)",
                                                                    color: "#fff",
                                                                    fontSize: 12,
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                Join Store
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                    </div>

                                            {expanded && (
                                                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--cc-border)" }}>
                                                    <div style={{ fontSize: 12, color: "var(--cc-text)" }}>
                                                        <strong>Address:</strong> {store.address || "Address not provided"}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                                        {phone ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`tel:${phone}`);
                                                                }}
                        style={{
                                                                    padding: "8px 10px",
                                                                    borderRadius: 10,
                                                                    border: "1px solid var(--cc-border)",
                                                                    background: "var(--cc-surface)",
                                                                    fontSize: 12,
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                Call
                                                            </button>
                                                        ) : store.place_id ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    loadPhoneForStore(store);
                                                                }}
                                                                style={{
                                                                    padding: "8px 10px",
                                                                    borderRadius: 10,
                                                                    border: "1px solid var(--cc-border)",
                                                                    background: "var(--cc-surface)",
                                                                    fontSize: 12,
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                Load phone
                                                            </button>
                                                        ) : null}
                                                        {store.address && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard?.writeText(String(store.address));
                                                                }}
                                                                style={{
                                                                    padding: "8px 10px",
                                                                    borderRadius: 10,
                                                                    border: "1px solid var(--cc-border)",
                                                                    background: "var(--cc-surface)",
                                                                    fontSize: 12,
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                Copy address
                                                            </button>
                                                        )}
                                </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Informational Card */}
                    <div
                        style={{
                            marginBottom: 16,
                            padding: 16,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(16,185,129,0.08))",
                            border: "1px solid var(--cc-border)",
                        }}
                    >
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--cc-text)" }}>
                            💡 Can't find the store you're looking for?
                        </div>
                        <div style={{ fontSize: 13, color: "var(--cc-muted)", lineHeight: 1.6 }}>
                            <div style={{ marginBottom: 6 }}>
                                • <strong>Search below</strong> to find stores in your area. If a store is already on CityCircle, you can join it directly.
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                • If a store is <strong>not registered with CityCircle</strong>, you can <strong>request it</strong> and we'll contact them about joining.
                            </div>
                            <div style={{ fontSize: 12, color: "var(--cc-muted)", fontStyle: "italic", marginTop: 8 }}>
                                Note: You have <strong>10 requests total</strong> and can request each store <strong>only once</strong>.
                            </div>
                        </div>
                    </div>

                    {/* Explore grid */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Explore stores</h3>
                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>
                            Showing <strong>{Math.min(displayedStores.length, filteredStores.length)}</strong> of{" "}
                            <strong>{filteredStores.length}</strong>
                                    </div>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                            gap: 12,
                            marginBottom: 10,
                        }}
                    >
                        {displayedStores.map((store) => {
                            const key = getStoreKey(store);
                            const isActive = activeStoreIds.includes(store.id);
                            const isUnlocked = unlockedStoreIds.includes(store.id);
                            // freeLimit <= 0 means unlimited free enrollments
                            const freeSlotsAvailable = freeLimit <= 0 ? true : activeCount < freeLimit;
                            const requiresPayment = !isActive && !isUnlocked && !freeSlotsAvailable;
                            const isLocked = store.is_locked || requiresPayment;
                            const phone = getPhoneForStore(store);
                            const isExpanded = expandedRowKey === key;

                            return (
                                <div
                                    key={`card-${key}`}
                                    style={{
                                        border: "1px solid var(--cc-border)",
                                        borderRadius: 14,
                                        background: "var(--cc-surface)",
                                        padding: 12,
                                        boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {store.name}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--cc-muted)", marginTop: 2 }}>
                                                {formatCategory(store.category)}{" "}
                                                {store.distance_miles != null && (
                                                    <span>• {(Number(store.distance_miles) || 0).toFixed(2)} mi</span>
                                                )}
                                            </div>
                                        </div>
                                        <TierBadge tier={store.reward_tier} />
                                    </div>

                                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "var(--cc-text)" }}>
                                        {getPromoLabel(store)}
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--cc-muted)", minHeight: 32 }}>
                                        {store.news || "No updates yet."}
                                </div>

                                    {/* Show "You already joined" message for joined stores */}
                                    {(isActive || isUnlocked) && searchTerm && (
                                        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                                            <div style={{ fontSize: 12, color: "var(--cc-success)", fontWeight: 600 }}>
                                                ✓ You already joined this store
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedRowKey(isExpanded ? null : key)}
                                            style={{
                                                padding: "8px 10px",
                                                borderRadius: 10,
                                                border: "1px solid var(--cc-border)",
                                                background: "var(--cc-surface)",
                                                fontSize: 12,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isExpanded ? "Hide details" : "View details"}
                                        </button>
                                        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            {/* Non-partner stores: Only show Request Store button */}
                                            {store.is_partner_store === false ? (
                                                (store.can_request_store === true || store.can_request_store === undefined) ? (
                                                    <button
                                                        type="button"
                                                        disabled={store.is_requested === true || store.max_requests_reached === true}
                                                        onClick={(e) => {
                                                            if (store.is_requested || store.max_requests_reached) return;
                                                            e.stopPropagation();
                                                            setSelectedStoreForRequest(store);
                                                            setRequestStoreForm({ 
                                                                store_name: String(store.name || "").trim() || "", 
                                                                note: "" 
                                                            });
                                                            setShowRequestStoreModal(true);
                                                        }}
                                                        style={{
                                                            padding: "8px 10px",
                                                            borderRadius: 10,
                                                            border: (store.is_requested || store.max_requests_reached) ? "1px solid var(--cc-border)" : "1px solid var(--cc-primary)",
                                                            background: (store.is_requested || store.max_requests_reached) ? "var(--cc-surface)" : "var(--cc-primary)",
                                                            color: (store.is_requested || store.max_requests_reached) ? "var(--cc-muted)" : "#fff",
                                                            fontSize: 12,
                                                            cursor: (store.is_requested || store.max_requests_reached) ? "not-allowed" : "pointer",
                                                            opacity: (store.is_requested || store.max_requests_reached) ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {store.is_requested ? "Request Sent" : store.max_requests_reached ? "Max Requests Reached" : "Request Store"}
                                                    </button>
                                                ) : (
                                                    <div style={{ fontSize: 11, color: "var(--cc-muted)", fontStyle: "italic" }}>
                                                        {store.max_requests_reached ? "Max requests reached" : "Store already signed up"}
                                                    </div>
                                                )
                                            ) : isActive || isUnlocked ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openDirections(store)}
                                                    style={{
                                                        padding: "8px 10px",
                                                        borderRadius: 10,
                                                        border: "1px solid var(--cc-border)",
                                                        background: "var(--cc-surface)",
                                                        fontSize: 12,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Directions
                                                </button>
                                            ) : isLocked ? (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await activateStoreSlot(token, store.id);
                                                            setActiveStoreIds((prev) => prev.concat(store.id));
                                                            setActiveCount((prev) => prev + 1);
                                                        } catch (e2) {
                                                            alert(e2.message || "Failed to join store");
                                                        }
                                                    }}
                                                    style={{
                                                        padding: "8px 10px",
                                                        borderRadius: 10,
                                                        border: "1px solid var(--cc-text)",
                                                        background: "var(--cc-text)",
                                                        color: "#fff",
                                                        fontSize: 12,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Join Store
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await activateStoreSlot(token, store.id);
                                                            setActiveStoreIds((prev) => prev.concat(store.id));
                                                            setActiveCount((prev) => prev + 1);
                                                        } catch (e2) {
                                                            alert(e2.message || "Failed to add store");
                                                        }
                                                    }}
                                                    style={{
                                                        padding: "8px 10px",
                                                        borderRadius: 10,
                                                        border: "1px solid var(--cc-primary)",
                                                        background: "var(--cc-primary)",
                                                        color: "#fff",
                                                        fontSize: 12,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Join Store
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--cc-border)" }}>
                                            <div style={{ fontSize: 12, color: "var(--cc-text)" }}>
                                                <strong>Address:</strong> {store.address || "Address not provided"}
                                    </div>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                                {phone ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(`tel:${phone}`)}
                                                        style={{
                                                            padding: "8px 10px",
                                                            borderRadius: 10,
                                                            border: "1px solid var(--cc-border)",
                                                            background: "var(--cc-surface)",
                                                            fontSize: 12,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Call
                                                    </button>
                                                ) : store.place_id ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => loadPhoneForStore(store)}
                                                        style={{
                                                            padding: "8px 10px",
                                                            borderRadius: 10,
                                                            border: "1px solid var(--cc-border)",
                                                            background: "var(--cc-surface)",
                                                            fontSize: 12,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Load phone
                                                    </button>
                                                ) : null}
                                                {store.address && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigator.clipboard?.writeText(String(store.address))}
                                                        style={{
                                                            padding: "8px 10px",
                                                            borderRadius: 10,
                                                            border: "1px solid var(--cc-border)",
                                                            background: "var(--cc-surface)",
                                                            fontSize: 12,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Copy address
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openDirections(store)}
                                                    style={{
                                                        padding: "8px 10px",
                                                        borderRadius: 10,
                                                        border: "1px solid var(--cc-border)",
                                                        background: "var(--cc-surface)",
                                                        fontSize: 12,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Directions
                                                </button>
                                    </div>
                                    </div>
                                    )}
                                </div>
                            );
                        })}
                                </div>
                            </>
                        ) : (
                <div
                    style={{
                        overflowX: "auto",
                        border: "1px solid var(--cc-border)",
                        borderRadius: 8,
                        background: "var(--cc-surface)",
                    }}
                >
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                        <thead>
                            <tr style={{ background: "var(--cc-surface-2)", textAlign: "left" }}>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Store</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Phone</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Category</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Rewards</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Payment</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Address</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>News</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Status</th>
                                <th style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedStores.map((store) => {
                                const rowKey = getStoreKey(store);
                                const phone = getPhoneForStore(store);
                                const isLoading = detailsLoadingId === store.place_id;
                                const isActive = activeStoreIds.includes(store.id);
                                const isUnlocked = unlockedStoreIds.includes(store.id);
                                const freeSlotsAvailable = freeLimit <= 0 ? true : activeCount < freeLimit;
                                const requiresPayment = !isActive && !isUnlocked && !freeSlotsAvailable;
                                const isLocked = store.is_locked || requiresPayment;
                                const statusLabel = isActive
                                    ? "Active"
                                    : isUnlocked
                                        ? "Unlocked"
                                        : isLocked
                                            ? "Join store"
                                            : "Available";
                                const paymentLabel = "Free";
                                const isExpanded = expandedRowKey === rowKey;
                                return (
                                    <React.Fragment key={rowKey}>
                                    <tr style={{ borderTop: "1px solid var(--cc-border)" }}>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedRowKey(isExpanded ? null : rowKey)}
                                                style={{
                                                    fontWeight: 700,
                                                    background: "transparent",
                                                    border: "none",
                                                    padding: 0,
                                                    cursor: "pointer",
                                                    textAlign: "left",
                                                }}
                                            >
                                                {store.name}
                                            </button>
                                            {store.address && (
                                                <div style={{ fontSize: 11, color: "var(--cc-muted)" }}>{store.address}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            {phone ? (
                                                <a href={`tel:${phone}`}>{phone}</a>
                                            ) : store.place_id ? (
                                                <button
                                                    type="button"
                                                    onClick={() => loadPhoneForStore(store)}
                                                    disabled={isLoading}
                                                    style={{
                                                        padding: "4px 8px",
                                                        fontSize: 11,
                                                        borderRadius: 6,
                                                        border: "1px solid var(--cc-border)",
                                                        background: "var(--cc-surface-2)",
                                                        cursor: isLoading ? "default" : "pointer",
                                                    }}
                                                >
                                                    {isLoading ? "Loading..." : "Load phone"}
                                                </button>
                                            ) : (
                                                <span style={{ color: "var(--cc-muted)" }}>Not provided</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            {formatCategory(store.category)}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            {getRewardLabel(store)}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            {paymentLabel}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-muted)" }}>
                                            {store.address || "Address not provided"}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-muted)" }}>
                                            {store.news || "No updates yet."}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: isLocked ? "var(--cc-primary)" : "var(--cc-success)" }}>
                                                {statusLabel}
                    </div>
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                            {isActive || isUnlocked ? (
                                                <span style={{ fontSize: 11, color: "var(--cc-muted)" }}>Added</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await activateStoreSlot(token, store.id);
                                                            setActiveStoreIds((prev) => prev.concat(store.id));
                                                            setActiveCount((prev) => prev + 1);
                                                        } catch (e) {
                                                            alert(e.message || "Failed to join store");
                                                        }
                                                    }}
                                                    style={{
                                                        padding: "4px 8px",
                                                        fontSize: 11,
                                                        borderRadius: 6,
                                                        border: "1px solid var(--cc-border)",
                                                        background: "var(--cc-surface)",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Join Store
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr style={{ background: "var(--cc-surface-2)" }}>
                                            <td colSpan={9} style={{ padding: "10px 12px", fontSize: 12, color: "var(--cc-text)" }}>
                                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                                    {phone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(`tel:${phone}`)}
                                                            style={{
                                                                padding: "6px 10px",
                                                                borderRadius: 8,
                                                                border: "1px solid var(--cc-border)",
                                                                background: "var(--cc-surface)",
                                                                fontSize: 12,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Call
                                                        </button>
                                                    )}
                                                    {store.address && (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigator.clipboard?.writeText(String(store.address))}
                                                            style={{
                                                                padding: "6px 10px",
                                                                borderRadius: 8,
                                                                border: "1px solid var(--cc-border)",
                                                                background: "var(--cc-surface)",
                                                                fontSize: 12,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Copy address
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openDirections(store)}
                                                        style={{
                                                            padding: "6px 10px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--cc-border)",
                                                            background: "var(--cc-surface)",
                                                            fontSize: 12,
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Directions
                                                    </button>
                                                    <span style={{ color: "var(--cc-muted)" }}>
                                                        <strong>Rewards:</strong> {getRewardLabel(store)} • <strong>Status:</strong> {statusLabel}
                                                    </span>
            </div>
                                                <div style={{ marginTop: 8, color: "var(--cc-muted)" }}>
                                                    <strong>News:</strong> {store.news || "No updates yet."}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {hasMoreStores && (
                <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + DEFAULT_VISIBLE_COUNT)}
                    style={{
                        marginTop: 10,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--cc-border)",
                        background: "var(--cc-surface)",
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    Show more
                </button>
            )}
            <div style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 8 }}>
                Tip: phone numbers load on demand to reduce API calls.
            </div>

            {/* Request Store Modal */}
            {showRequestStoreModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10000,
                    }}
                    onClick={() => setShowRequestStoreModal(false)}
                >
                    <div
                        style={{
                            background: "var(--cc-surface)",
                            borderRadius: 12,
                            padding: 20,
                            maxWidth: 400,
                            width: "90%",
                            maxHeight: "80vh",
                            overflowY: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0 }}>Request This Store</h3>
                        <p style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 16 }}>
                            Help us bring this store to CityCircle! We'll contact them about joining.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Store Name *</label>
                                <input
                                    type="text"
                                    value={requestStoreForm.store_name || selectedStoreForRequest?.name || ""}
                                    onChange={(e) => setRequestStoreForm({ ...requestStoreForm, store_name: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--cc-border)",
                                        fontSize: 13,
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Note (optional)</label>
                                <textarea
                                    value={requestStoreForm.note}
                                    onChange={(e) => setRequestStoreForm({ ...requestStoreForm, note: e.target.value })}
                                    placeholder="Any additional info..."
                                    style={{
                                        width: "100%",
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--cc-border)",
                                        fontSize: 13,
                                        minHeight: 60,
                                    }}
                                />
                            </div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button
                                    onClick={() => setShowRequestStoreModal(false)}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: 8,
                                        border: "1px solid var(--cc-border)",
                                        background: "var(--cc-surface)",
                                        fontSize: 13,
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmittingRequest}
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        
                                        // Prevent multiple submissions
                                        if (isSubmittingRequest) {
                                            return;
                                        }
                                        
                                        // Use form value or fallback to selected store name
                                        const storeName = String(requestStoreForm.store_name || selectedStoreForRequest?.name || "").trim();
                                        if (!storeName || storeName.length < 2) {
                                            alert("Store name is required");
                                            return;
                                        }
                                        
                                        setIsSubmittingRequest(true);
                                        try {
                                            const result = await submitStoreRequest(token, {
                                                store_name: storeName,
                                                store_ref: selectedStoreForRequest?.place_id || null,
                                                note: String(requestStoreForm.note || "").trim() || null,
                                            });
                                            
                                            // Check if it's a duplicate response
                                            if (result.duplicate) {
                                                // Still mark as requested even if duplicate (user already requested it)
                                                if (selectedStoreForRequest) {
                                                    setStores((prevStores) =>
                                                        prevStores.map((s) =>
                                                            (s.id === selectedStoreForRequest.id || 
                                                             (s.place_id && selectedStoreForRequest.place_id && s.place_id === selectedStoreForRequest.place_id) ||
                                                             (s.name === selectedStoreForRequest.name))
                                                                ? { ...s, is_requested: true }
                                                                : s
                                                        )
                                                    );
                                                }
                                                alert(result.message || "You already requested this store. Thanks! We'll contact them soon.");
                                            } else {
                                                alert(result.message || "Thanks! We recorded your request for this store.");
                                                
                                                // Mark the store as requested in the UI
                                                if (selectedStoreForRequest) {
                                                    setStores((prevStores) =>
                                                        prevStores.map((s) =>
                                                            (s.id === selectedStoreForRequest.id || 
                                                             (s.place_id && selectedStoreForRequest.place_id && s.place_id === selectedStoreForRequest.place_id) ||
                                                             (s.name === selectedStoreForRequest.name))
                                                                ? { ...s, is_requested: true }
                                                                : s
                                                        )
                                                    );
                                                }
                                            }
                                            
                                            setShowRequestStoreModal(false);
                                            setRequestStoreForm({ store_name: "", note: "" });
                                            setSelectedStoreForRequest(null);
                                        } catch (e) {
                                            // Handle error response with duplicate info
                                            const errorMsg = e.message || "Failed to submit request";
                                            if (e.duplicate || errorMsg.includes("already requested") || errorMsg.includes("wait")) {
                                                alert(errorMsg);
                                            } else {
                                                alert("Failed to submit request: " + errorMsg);
                                            }
                                        } finally {
                                            setIsSubmittingRequest(false);
                                        }
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: 8,
                                        border: "1px solid var(--cc-primary)",
                                        background: isSubmittingRequest ? "var(--cc-muted)" : "var(--cc-primary)",
                                        color: "#fff",
                                        fontSize: 13,
                                        cursor: isSubmittingRequest ? "not-allowed" : "pointer",
                                        opacity: isSubmittingRequest ? 0.6 : 1,
                                    }}
                                >
                                    {isSubmittingRequest ? "Submitting..." : "Submit Request"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}


