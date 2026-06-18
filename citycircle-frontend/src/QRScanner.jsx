// src/QRScanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan, onClose, title = "Scan QR Code" }) {
    // Generate scannerId only once using useRef
    const scannerIdRef = useRef("qr-scanner-" + Math.random().toString(36).substr(2, 9));
    const scannerId = scannerIdRef.current;
    const [error, setError] = useState("");
    const [scanning, setScanning] = useState(false);
    const html5QrCodeRef = useRef(null);
    const onScanRef = useRef(onScan);
    const isInitializedRef = useRef(false);
    const scanProcessedRef = useRef(false);

    // Update the ref when onScan changes, but don't restart the scanner
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    // Define stopScanning before useEffect so it can be used in cleanup
    const stopScanning = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (e) {
                // Ignore errors about scanner already being stopped - this is expected
                if (!e.message?.includes("not running") && !e.message?.includes("not paused")) {
                }
            }
        }
        setScanning(false);
    };

    useEffect(() => {
        // Reset scan processed flag when component mounts
        scanProcessedRef.current = false;
        
        // Prevent multiple initializations (React StrictMode in dev can cause double mount)
        if (isInitializedRef.current || html5QrCodeRef.current) {
            return;
        }

        // Wait for the element to be in the DOM
        const initScanner = () => {
            const element = document.getElementById(scannerId);
            if (!element) {
                // Element not ready yet, try again
                setTimeout(initScanner, 50);
                return;
            }

            isInitializedRef.current = true;

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
                        // Prevent multiple scans of the same QR code
                        if (scanProcessedRef.current || !isMounted) {
                            return;
                        }
                        scanProcessedRef.current = true;
                        
                    // Successfully scanned - stop scanning first
                        await stopScanning();
                        // Then call onScan callback using ref to get latest version
                        if (onScanRef.current) {
                            onScanRef.current(decodedText);
                    }
                },
                (errorMessage) => {
                    // Ignore scanning errors (they're frequent)
                }
            )
                .then(() => {
                    // Camera started successfully
                    if (isMounted) {
                        setScanning(true);
                        setError("");
                    }
                })
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
                        isInitializedRef.current = false;
                        html5QrCodeRef.current = null;
                }
            });
        };

        // Start initialization
        initScanner();

        return () => {
            stopScanning();
            // Reset after a short delay to ensure cleanup is complete
            setTimeout(() => {
                isInitializedRef.current = false;
                html5QrCodeRef.current = null;
                scanProcessedRef.current = false; // Reset scan flag on cleanup
            }, 200);
        };
    }, []); // Empty dependency array - only run once on mount

    const handleClose = async () => {
        await stopScanning();
        scanProcessedRef.current = false; // Reset scan flag when closing
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
                                    isInitializedRef.current = false;
                                    scanProcessedRef.current = false; // Reset scan flag on retry
                                    // Try to restart scanner
                                    try {
                                        if (html5QrCodeRef.current) {
                                            await html5QrCodeRef.current.stop().catch(() => {});
                                            html5QrCodeRef.current.clear();
                                            html5QrCodeRef.current = null;
                                        }
                                        
                                        const element = document.getElementById(scannerId);
                                        if (!element) {
                                            setError("Scanner element not found. Please close and try again.");
                                            return;
                                        }
                                        
                                        const html5QrCode = new Html5Qrcode(scannerId);
                                        html5QrCodeRef.current = html5QrCode;
                                        isInitializedRef.current = true;
                                        
                                        await html5QrCode.start(
                                            { facingMode: "environment" },
                                            {
                                                fps: 10,
                                                qrbox: { width: 250, height: 250 },
                                            },
                                            async (decodedText) => {
                                                await html5QrCode.stop();
                                                html5QrCode.clear();
                                                if (onScanRef.current) {
                                                    onScanRef.current(decodedText);
                                                }
                                            },
                                            () => {}
                                        );
                                        setScanning(true);
                                        setError("");
                                    } catch (retryErr) {
                                        setError("Failed to start camera: " + (retryErr.message || "Unknown error"));
                                        isInitializedRef.current = false;
                                        html5QrCodeRef.current = null;
                                    }
                                }}>
                                    Retry
                                </button>
                                <button style={{ ...retryButton, backgroundColor: "var(--cc-muted)" }} onClick={handleClose}>
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
    backgroundColor: "var(--cc-surface)",
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
    color: "var(--cc-muted)",
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
    backgroundColor: "var(--cc-text)",
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
    color: "var(--cc-danger)",
    marginBottom: 12,
    textAlign: "center",
};

const retryButton = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "var(--cc-primary)",
    color: "white",
    cursor: "pointer",
};

const hintText = {
    fontSize: 12,
    color: "var(--cc-muted)",
    textAlign: "center",
    margin: 0,
};

