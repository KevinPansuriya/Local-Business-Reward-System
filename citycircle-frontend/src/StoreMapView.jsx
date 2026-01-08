// src/StoreMapView.jsx
import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchNearbyStores, fetchUserMe } from "./api";

const RADIUS_MILES = 2;

// ----- helpers for tier + bonus -----
function getTier(totalLoops) {
    if (!totalLoops || totalLoops < 200) return "BRONZE";
    if (totalLoops < 500) return "SILVER";
    if (totalLoops < 1000) return "GOLD";
    return "PLATINUM";
}

function getTierBonusPercent(tier) {
    switch (tier) {
        case "SILVER":
            return 2;
        case "GOLD":
            return 4;
        case "PLATINUM":
            return 6;
        case "BRONZE":
        default:
            return 0;
    }
}

// Small helper component to move map when selected store changes
function MapUpdater({ store }) {
    const map = useMap();

    useEffect(() => {
        if (!store) return;
        if (store.latitude == null || store.longitude == null) return;

        map.flyTo([store.latitude, store.longitude], 16, {
            duration: 0.4,
        });
    }, [store, map]);

    return null;
}

export default function StoreMapView({ token }) {
    const [stores, setStores] = useState([]);
    const [position, setPosition] = useState({ lat: 40.72, lng: -74.04 });
    const [err, setErr] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const [user, setUser] = useState(null);
    const [userTier, setUserTier] = useState("BRONZE");
    const [tierBonus, setTierBonus] = useState(0);

    const [selectedStoreId, setSelectedStoreId] = useState(null);

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
                const tier = getTier(u.total_loops_earned || 0);
                setUserTier(tier);
                setTierBonus(getTierBonusPercent(tier));
            })
            .catch((e) => {
                console.error(e);
                // if user call fails, we still show stores with base discount only
            });
    }, [token]);

    // Load stores (nearby)
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const p = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    };
                    setPosition(p);
                    loadStores(p.lat, p.lng);
                },
                () => {
                    // geolocation blocked → use default center
                    loadStores(position.lat, position.lng);
                }
            );
        } else {
            loadStores(position.lat, position.lng);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadStores(lat, lng) {
        try {
            const data = await fetchNearbyStores(lat, lng, RADIUS_MILES);
            setStores(data);
        } catch (e) {
            setErr(e.message);
        }
    }

    // Build category list dynamically
    const categories = useMemo(() => {
        const set = new Set();
        stores.forEach((s) => {
            if (s.category) set.add(s.category);
        });
        return ["all", ...Array.from(set).sort()];
    }, [stores]);

    // Filter by category
    const visibleStores =
        selectedCategory === "all"
            ? stores
            : stores.filter((s) => s.category === selectedCategory);

    // Selected store (default = first visible)
    const selectedStore = useMemo(() => {
        if (!visibleStores.length) return null;
        const found = visibleStores.find((s) => s.id === selectedStoreId);
        return found || visibleStores[0];
    }, [visibleStores, selectedStoreId]);

    // When category changes, reset selection to first store in that category
    useEffect(() => {
        if (!visibleStores.length) {
            setSelectedStoreId(null);
            return;
        }
        if (!visibleStores.find((s) => s.id === selectedStoreId)) {
            setSelectedStoreId(visibleStores[0].id);
        }
    }, [visibleStores, selectedStoreId]);

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
                <h2 style={{ margin: 0 }}>Nearby Loops Stores</h2>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    {user && (
                        <div style={{ fontSize: 13 }}>
                            Your tier: <strong>{userTier}</strong> (bonus{" "}
                            <strong>{tierBonus}%</strong>)
                        </div>
                    )}
                    <div style={{ fontSize: 13 }}>
                        Category:&nbsp;
                        <select
                            style={{
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                fontSize: 13,
                            }}
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c === "all"
                                        ? "All categories"
                                        : c.charAt(0).toUpperCase() + c.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {err && <p style={{ color: "red", fontSize: 14 }}>{err}</p>}

            <div
                style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 16,
                    alignItems: "flex-start",
                }}
            >
                {/* Map */}
                <div style={{ width: isMobile ? "100%" : "45%", height: 320, minHeight: 300 }}>
                    <MapContainer
                        center={[position.lat, position.lng]}
                        zoom={14}
                        style={{ height: "100%", width: "100%" }}
                    >
                        <TileLayer
                            attribution="&copy; OpenStreetMap contributors"
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* Move map when store changes */}
                        {selectedStore && <MapUpdater store={selectedStore} />}

                        {visibleStores.map((s) => {
                            const effectiveDiscount =
                                s.base_discount_percent + (user ? tierBonus : 0);

                            const isSelected = selectedStore && s.id === selectedStore.id;

                            return (
                                <Marker
                                    key={s.id}
                                    position={[s.latitude, s.longitude]}
                                    eventHandlers={{
                                        click: () => setSelectedStoreId(s.id),
                                    }}
                                >
                                    <Popup>
                                        <strong>{s.name}</strong>
                                        {isSelected && " (selected)"}
                                        <br />
                                        {s.category} (zone {s.zone})
                                        <br />
                                        Base: {s.base_discount_percent}%<br />
                                        {user ? (
                                            <>
                                                Your bonus: +{tierBonus}%<br />
                                                <strong>Total: {effectiveDiscount}% off</strong>
                                            </>
                                        ) : (
                                            <>Login to see your Loops bonus.</>
                                        )}
                                        <br />
                                        Distance: ~{s.distance_miles.toFixed(2)} miles
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>

                {/* List + details */}
                <div style={{ 
                    width: isMobile ? "100%" : "55%", 
                    display: "flex", 
                    flexDirection: isMobile ? "column" : "row",
                    gap: 12 
                }}>
                    {/* List */}
                    <div style={{ width: isMobile ? "100%" : "55%" }}>
                        {visibleStores.length === 0 && (
                            <p>No stores found for this category in this radius.</p>
                        )}
                        <ul style={{ paddingLeft: 18 }}>
                            {visibleStores.map((s) => {
                                const effectiveDiscount =
                                    s.base_discount_percent + (user ? tierBonus : 0);
                                const isSelected =
                                    selectedStore && s.id === selectedStore.id;

                                return (
                                    <li
                                        key={s.id}
                                        style={{
                                            marginBottom: 10,
                                            cursor: "pointer",
                                            fontWeight: isSelected ? "bold" : "normal",
                                        }}
                                        onClick={() => setSelectedStoreId(s.id)}
                                    >
                                        <div>{s.name}</div>
                                        <div style={{ fontSize: 13 }}>
                                            ({s.category}) • Zone: {s.zone}
                                        </div>
                                        <div style={{ fontSize: 12 }}>
                                            Distance: ~{s.distance_miles.toFixed(2)} miles
                                        </div>
                                        <div style={{ fontSize: 12 }}>
                                            Base: {s.base_discount_percent}%{" "}
                                            {user ? (
                                                <>
                                                    • Bonus: +{tierBonus}% • You save:{" "}
                                                    {effectiveDiscount}%
                                                </>
                                            ) : (
                                                <>• Login to see your bonus</>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Details panel */}
                    <div
                        style={{
                            width: "45%",
                            padding: 10,
                            border: "1px solid #ddd",
                            borderRadius: 6,
                            background: "#fafafa",
                            minHeight: 160,
                            fontSize: 13,
                        }}
                    >
                        {selectedStore ? (
                            <>
                                <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                                    {selectedStore.name}
                                </h3>
                                <div style={{ marginBottom: 4 }}>
                                    Category:{" "}
                                    <strong>
                                        {selectedStore.category.charAt(0).toUpperCase() +
                                            selectedStore.category.slice(1)}
                                    </strong>
                                </div>
                                <div style={{ marginBottom: 4 }}>
                                    Zone: <strong>{selectedStore.zone}</strong>
                                </div>

                                {selectedStore.phone && (
                                    <div style={{ marginBottom: 4 }}>
                                        Phone:{" "}
                                        <a href={`tel:${selectedStore.phone}`}>
                                            {selectedStore.phone}
                                        </a>
                                    </div>
                                )}

                                <div style={{ marginBottom: 4 }}>
                                    Distance: ~
                                    {selectedStore.distance_miles.toFixed(2)} miles
                                </div>

                                {(() => {
                                    const base = selectedStore.base_discount_percent;
                                    const total = base + (user ? tierBonus : 0);
                                    return (
                                        <div style={{ marginBottom: 6 }}>
                                            Discount today:
                                            <br />
                                            Base from store: <strong>{base}%</strong>
                                            <br />
                                            {user ? (
                                                <>
                                                    Your Loops bonus: <strong>{tierBonus}%</strong>
                                                    <br />
                                                    <strong>Total at checkout: {total}% off</strong>
                                                </>
                                            ) : (
                                                <>Login to see your bonus level.</>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Simple fake details for demo */}
                                <div style={{ marginTop: 8 }}>
                                    <div>
                                        Hours: <strong>8:00 AM – 10:00 PM</strong>
                                    </div>
                                    <div>
                                        Suggested items:{" "}
                                        {selectedStore.category === "coffee"
                                            ? "latte, cold brew, pastries"
                                            : selectedStore.category === "grocery"
                                                ? "fresh produce, snacks, pantry"
                                                : selectedStore.category === "liquor"
                                                    ? "wine, beer, spirits"
                                                    : selectedStore.category === "pharmacy"
                                                        ? "medications, vitamins, essentials"
                                                        : "everyday essentials"}
                                    </div>
                                    <div style={{ marginTop: 4 }}>
                                        Tip: show your QR at checkout to apply the Loops rate
                                        automatically.
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>Select a store on the map or in the list.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
