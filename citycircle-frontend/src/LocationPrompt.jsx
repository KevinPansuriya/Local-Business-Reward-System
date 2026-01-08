// src/LocationPrompt.jsx
import React, { useState, useEffect } from "react";
import { updateUserLocation } from "./api";
import { reverseGeocode, geocodeAddress } from "./geocoding";

export default function LocationPrompt({ token, onLocationSet }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [zipcode, setZipcode] = useState("");
    const [autoDetecting, setAutoDetecting] = useState(true);
    const [detectedLocation, setDetectedLocation] = useState(null);

    // Automatically detect location on mount
    useEffect(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            setAutoDetecting(false);
            return;
        }

        setAutoDetecting(true);
        setError("");

        // Use high accuracy options for better location
        // Start with high accuracy, but allow fallback
        const options = {
            enableHighAccuracy: true,  // Use GPS if available
            timeout: 15000,           // 15 second timeout (increased)
            maximumAge: 60000          // Allow 1 minute old cached location as fallback
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setDetectedLocation({ latitude, longitude, accuracy });
                
                // Don't auto-fill address - user will enter manually
                setAutoDetecting(false);
            },
            (err) => {
                // Don't show error for timeout - just allow manual entry
                if (err.code === err.TIMEOUT) {
                    setError("");
                    setAutoDetecting(false);
                    // Allow user to proceed with manual address entry
                } else {
                    let errorMsg = "";
                    switch(err.code) {
                        case err.PERMISSION_DENIED:
                            errorMsg = "Location access denied. You can enter your address manually below.";
                            break;
                        case err.POSITION_UNAVAILABLE:
                            errorMsg = "Location information unavailable. Please enter address manually.";
                            break;
                        default:
                            errorMsg = "Could not detect location. You can enter your address manually.";
                    }
                    setError(errorMsg);
                    setAutoDetecting(false);
                }
            },
            options
        );
    }, []);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            return;
        }

        setLoading(true);
        setError("");

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,  // 15 second timeout
            maximumAge: 60000  // Allow 1 minute old cached location
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setDetectedLocation({ latitude, longitude, accuracy });
                
                // Don't auto-fill address - user will enter manually
                
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
        // Allow saving even if location detection failed - user can enter address
        // Check if at least city or address1 is provided
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
                // Use detected location
                lat = detectedLocation.latitude;
                lng = detectedLocation.longitude;
            } else if (hasAddress) {
                // Build address string from structured fields
                const addressString = [
                    address1,
                    address2,
                    city,
                    state,
                    zipcode
                ].filter(Boolean).join(", ");
                
                // Geocode address to coordinates (FREE service - OpenStreetMap Nominatim)
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

            // Format full address for storage
            const fullAddress = [
                address1,
                address2,
                city,
                state,
                zipcode
            ].filter(Boolean).join(", ");

            await updateUserLocation(token, lat, lng, fullAddress || null);
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
                <h2 style={{ marginTop: 0 }}>Set Your Location</h2>
                <p style={{ color: "#6b7280", marginBottom: 20 }}>
                    We need your location to show you nearby stores and provide the best experience.
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
                        placeholder="e.g., Apt 4B, Suite 200"
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
                    {!detectedLocation && !autoDetecting && (
                        <button
                            style={primaryButton}
                            onClick={handleGetLocation}
                            disabled={loading}
                        >
                            {loading ? "Getting location..." : "📍 Detect Current Location"}
                        </button>
                    )}
                    {autoDetecting && (
                        <div style={detectingInfo}>
                            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                                🔍 Detecting your location... (this may take a few seconds)
                            </p>
                        </div>
                    )}
                    <button
                        style={detectedLocation ? primaryButton : secondaryButton}
                        onClick={handleSaveLocation}
                        disabled={loading || (autoDetecting && !detectedLocation)}
                    >
                        {loading ? "Saving..." : "✓ Save Location"}
                    </button>
                    {!detectedLocation && !autoDetecting && hasAddress && (
                        <p style={{ fontSize: 12, color: "#6b7280", margin: 0, textAlign: "center" }}>
                            Or click "Save Location" to use the address you entered
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

const locationInfo = {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    border: "1px solid #bbf7d0",
};

const detectingInfo = {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    border: "1px solid #fde68a",
    textAlign: "center",
};
