// src/StoreLocationPrompt.jsx
import React, { useState } from "react";
import { updateStoreLocation } from "./api";
import { geocodeAddress } from "./geocoding";

export default function StoreLocationPrompt({ token, onLocationSet }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [zipcode, setZipcode] = useState("");
    const [autoDetecting, setAutoDetecting] = useState(false);
    const [detectedLocation, setDetectedLocation] = useState(null);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            return;
        }

        setLoading(true);
        setError("");

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setDetectedLocation({ latitude, longitude, accuracy });
                setLoading(false);
            },
            (err) => {
                let errorMsg = "Failed to get location: ";
                switch(err.code) {
                    case err.PERMISSION_DENIED:
                        errorMsg = "Location access denied. Please allow location access.";
                        break;
                    case err.POSITION_UNAVAILABLE:
                        errorMsg = "Location information unavailable.";
                        break;
                    case err.TIMEOUT:
                        errorMsg = "Location request timed out. Please try again.";
                        break;
                    default:
                        errorMsg += err.message;
                }
                setError(errorMsg);
                setLoading(false);
            },
            options
        );
    };

    const handleSaveLocation = async () => {
        const hasAddress = address1.trim() || city.trim();
        if (!detectedLocation && !hasAddress) {
            setError("Please detect your location or enter at least a city or street address");
            return;
        }

        setLoading(true);
        setError("");

        try {
            let lat, lng;
            
            if (detectedLocation) {
                lat = detectedLocation.latitude;
                lng = detectedLocation.longitude;
            } else if (hasAddress) {
                const addressString = [
                    address1,
                    address2,
                    city,
                    state,
                    zipcode
                ].filter(Boolean).join(", ");
                
                const geocodeResult = await geocodeAddress(addressString);
                
                if (!geocodeResult) {
                    setError("Could not find location for this address. Please try a more specific address.");
                    setLoading(false);
                    return;
                }
                
                lat = geocodeResult.latitude;
                lng = geocodeResult.longitude;
            } else {
                setError("Please detect location or enter an address");
                setLoading(false);
                return;
            }

            const fullAddress = [
                address1,
                address2,
                city,
                state,
                zipcode
            ].filter(Boolean).join(", ");

            await updateStoreLocation(token, lat, lng, fullAddress);
            if (onLocationSet) onLocationSet();
        } catch (e) {
            setError(e.message || "Failed to save location");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={overlay}>
            <div style={modal}>
                <h2 style={{ marginTop: 0 }}>Set Store Location</h2>
                <p style={{ color: "#6b7280", marginBottom: 20 }}>
                    We need your store location to help customers find you.
                    <br />
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        Using free OpenStreetMap geocoding service - no API key required!
                    </span>
                </p>

                <div style={inputGroup}>
                    <label style={label}>Address Line 1 (Street Address)</label>
                    <input
                        style={input}
                        type="text"
                        placeholder="e.g., 123 Main Street"
                        value={address1}
                        onChange={(e) => setAddress1(e.target.value)}
                    />
                </div>

                <div style={inputGroup}>
                    <label style={label}>Address Line 2 (Optional)</label>
                    <input
                        style={input}
                        type="text"
                        placeholder="e.g., Suite 200, Floor 2"
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                    />
                </div>

                <div style={addressRow}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                        <label style={label}>City</label>
                        <input
                            style={input}
                            type="text"
                            placeholder="City"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1, marginRight: 8 }}>
                        <label style={label}>State</label>
                        <input
                            style={input}
                            type="text"
                            placeholder="State"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={label}>Zipcode</label>
                        <input
                            style={input}
                            type="text"
                            placeholder="Zipcode"
                            value={zipcode}
                            onChange={(e) => setZipcode(e.target.value)}
                        />
                    </div>
                </div>

                <div style={buttonGroup}>
                    <button
                        style={primaryButton}
                        onClick={handleGetLocation}
                        disabled={loading}
                    >
                        {loading ? "Getting location..." : "📍 Detect Current Location (Optional)"}
                    </button>
                    <button
                        style={detectedLocation ? primaryButton : secondaryButton}
                        onClick={handleSaveLocation}
                        disabled={loading}
                    >
                        {loading ? "Saving..." : "✓ Save Location"}
                    </button>
                    {!detectedLocation && (address1.trim() || city.trim()) && (
                        <p style={{ fontSize: 12, color: "#6b7280", margin: 0, textAlign: "center" }}>
                            Click "Save Location" to use the address you entered
                        </p>
                    )}
                </div>

                {error && <p style={errorText}>{error}</p>}
            </div>
        </div>
    );
}

const overlay = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
};

const modal = {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 12,
    maxWidth: 500,
    width: "90%",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
};

const inputGroup = {
    marginBottom: 16,
};

const addressRow = {
    display: "flex",
    gap: 8,
    marginBottom: 16,
};

const label = {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
};

const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
    boxSizing: "border-box",
};

const buttonGroup = {
    display: "flex",
    gap: 12,
    flexDirection: "column",
};

const primaryButton = {
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

const secondaryButton = {
    padding: "12px 20px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
};

const errorText = {
    marginTop: 12,
    color: "#ef4444",
    fontSize: 13,
};

const detectingInfo = {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    border: "1px solid #fde68a",
    textAlign: "center",
};
