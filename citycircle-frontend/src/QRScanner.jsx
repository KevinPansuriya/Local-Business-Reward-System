// src/QRScanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan, onClose, title = "Scan QR Code" }) {
    const scannerId = "qr-scanner-" + Math.random().toString(36).substr(2, 9);
    const [error, setError] = useState("");
    const [scanning, setScanning] = useState(false);
    const html5QrCodeRef = useRef(null);

    useEffect(() => {
        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;
        let isMounted = true;

        html5QrCode
            .start(
                { facingMode: "environment" }, // Use back camera
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                async (decodedText) => {
                    // Successfully scanned - stop scanning first
                    if (isMounted) {
                        await stopScanning();
                        // Then call onScan callback
                        if (onScan) {
                            onScan(decodedText);
                        }
                    }
                },
                (errorMessage) => {
                    // Ignore scanning errors (they're frequent)
                }
            )
            .catch((err) => {
                if (isMounted) {
                    let errorMsg = "Failed to start camera: " + (err.message || "Unknown error");
                    
                    // Check if HTTPS is required
                    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                        errorMsg = "Camera requires HTTPS. Please use ngrok or HTTPS connection.";
                    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        errorMsg = "Camera permission denied. Please allow camera access in your browser settings.";
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        errorMsg = "No camera found. Please use a device with a camera.";
                    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                        errorMsg = "Camera is already in use by another application.";
                    }
                    
                    setError(errorMsg);
                    setScanning(false);
                }
            });

        setScanning(true);

        return () => {
            isMounted = false;
            stopScanning();
        };
    }, [onScan]);

    const stopScanning = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (e) {
                console.error("Error stopping scanner:", e);
            }
        }
        setScanning(false);
    };

    const handleClose = async () => {
        await stopScanning();
        // Small delay to ensure scanner is fully stopped
        setTimeout(() => {
            if (onClose) onClose();
        }, 100);
    };

    return (
        <div style={overlay}>
            <div style={modal}>
                <div style={header}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button style={closeButton} onClick={handleClose}>
                        ✕
                    </button>
                </div>

                <div style={scannerContainer}>
                    <div id={scannerId} style={scanner} />
                    {!scanning && !error && (
                        <div style={loadingOverlay}>
                            <p>Starting camera...</p>
                        </div>
                    )}
                    {error && (
                        <div style={errorOverlay}>
                            <p style={errorText}>{error}</p>
                            <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "center" }}>
                                <button style={retryButton} onClick={async () => {
                                    setError("");
                                    setScanning(false);
                                    // Try to restart scanner
                                    try {
                                        if (html5QrCodeRef.current) {
                                            await html5QrCodeRef.current.stop().catch(() => {});
                                            html5QrCodeRef.current.clear();
                                        }
                                        
                                        const html5QrCode = new Html5Qrcode(scannerId);
                                        html5QrCodeRef.current = html5QrCode;
                                        
                                        await html5QrCode.start(
                                            { facingMode: "environment" },
                                            {
                                                fps: 10,
                                                qrbox: { width: 250, height: 250 },
                                            },
                                            async (decodedText) => {
                                                await html5QrCode.stop();
                                                html5QrCode.clear();
                                                if (onScan) {
                                                    onScan(decodedText);
                                                }
                                            },
                                            () => {}
                                        );
                                        setScanning(true);
                                    } catch (retryErr) {
                                        setError("Failed to start camera: " + (retryErr.message || "Unknown error"));
                                    }
                                }}>
                                    Retry
                                </button>
                                <button style={{ ...retryButton, backgroundColor: "#6b7280" }} onClick={handleClose}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <p style={hintText}>Point your camera at a QR code</p>
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
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
};

const modal = {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    maxWidth: 500,
    width: "90%",
    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
};

const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
};

const closeButton = {
    background: "none",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    color: "#6b7280",
    padding: 0,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const scannerContainer = {
    position: "relative",
    width: "100%",
    minHeight: 300,
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
};

const scanner = {
    width: "100%",
    height: "100%",
};

const loadingOverlay = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
};

const errorOverlay = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.9)",
    color: "#fff",
    padding: 20,
};

const errorText = {
    color: "#ef4444",
    marginBottom: 12,
    textAlign: "center",
};

const retryButton = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    cursor: "pointer",
};

const hintText = {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    margin: 0,
};
