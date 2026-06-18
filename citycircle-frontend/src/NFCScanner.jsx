// citycircle-frontend/src/NFCScanner.jsx
import React, { useEffect, useState, useRef } from 'react';

export default function NFCScanner({ onNFCRead, onError, onClose }) {
    const [supported, setSupported] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState("");
    const errorShownRef = useRef(false);
    
    useEffect(() => {
        // Check if Web NFC is supported (only once on mount)
        if ('NDEFReader' in window) {
            setSupported(true);
        } else {
            setSupported(false);
            setError("NFC not supported on this device");
            // Don't show alert - the modal UI already handles this
            // The modal shows a clear message and close button
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - only run once on mount
    
    const startScanning = async () => {
        if (!supported) {
            if (onError) {
                onError("NFC not supported");
            }
            return;
        }
        
        try {
            setScanning(true);
            setError("");
            
            const reader = new NDEFReader();
            
            await reader.scan();
            
            reader.addEventListener("reading", ({ message, serialNumber }) => {
                try {
                    // Parse NFC message
                    const record = message.records[0];
                    if (record && record.recordType === "url") {
                        const url = new TextDecoder().decode(record.data);
                        
                        // Extract store_id from URL
                        // Expected format: https://citycircle.app/checkin?store_id=123
                        try {
                            const urlObj = new URL(url);
                            const storeId = urlObj.searchParams.get('store_id');
                            
                            if (storeId && onNFCRead) {
                                setScanning(false);
                                onNFCRead(parseInt(storeId), url);
                            } else {
                                throw new Error("Invalid NFC tag format");
                            }
                        } catch (urlError) {
                            // Try to extract store_id from URL string directly
                            const match = url.match(/store_id=(\d+)/);
                            if (match && match[1] && onNFCRead) {
                                setScanning(false);
                                onNFCRead(parseInt(match[1]), url);
                            } else {
                                throw new Error("Could not extract store ID from NFC tag");
                            }
                        }
                    } else {
                        throw new Error("Invalid NFC tag format");
                    }
                } catch (parseError) {
                    setScanning(false);
                    const errorMsg = "Failed to read NFC tag: " + parseError.message;
                    setError(errorMsg);
                    if (onError) {
                        onError(errorMsg);
                    }
                }
            });
            
            reader.addEventListener("readingerror", (error) => {
                setScanning(false);
                const errorMsg = "NFC read error: " + error.message;
                setError(errorMsg);
                if (onError) {
                    onError(errorMsg);
                }
            });
        } catch (error) {
            setScanning(false);
            const errorMsg = "NFC error: " + error.message;
            setError(errorMsg);
            if (onError) {
                onError(errorMsg);
            }
        }
    };
    
    if (!supported) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
                <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    maxWidth: '400px',
                    textAlign: 'center'
                }}>
                    <h3 style={{ marginTop: 0 }}>NFC Not Supported</h3>
                    <p style={{ color: 'var(--cc-muted)', marginBottom: '20px' }}>
                        Your device doesn't support NFC. Please use QR scan instead.
                    </p>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                padding: '12px 24px',
                                background: 'var(--cc-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '600'
                            }}
                        >
                            Use QR Scan Instead
                        </button>
                    )}
                </div>
            </div>
        );
    }
    
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                padding: '32px',
                borderRadius: '16px',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Tap NFC Tag</h3>
                
                {error && (
                    <div style={{
                        padding: '12px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: 'var(--cc-danger)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}
                
                <div style={{
                    width: '200px',
                    height: '200px',
                    margin: '20px auto',
                    background: scanning ? 'rgba(37, 99, 235, 0.12)' : 'var(--cc-surface-2)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: scanning ? '3px solid var(--cc-primary)' : '3px dashed var(--cc-muted)',
                    transition: 'all 0.3s'
                }}>
                    <div style={{ fontSize: '64px' }}>
                        {scanning ? '📱' : '📲'}
                    </div>
                </div>
                
                <p style={{ color: 'var(--cc-muted)', marginBottom: '20px', fontSize: '14px' }}>
                    {scanning 
                        ? 'Hold your phone near the NFC tag...' 
                        : 'Tap the button below, then hold your phone near the NFC tag at the counter'}
                </p>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    {!scanning ? (
                        <button
                            onClick={startScanning}
                            style={{
                                padding: '14px 28px',
                                background: 'var(--cc-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '600',
                                flex: 1
                            }}
                        >
                            Start NFC Scan
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setScanning(false);
                                setError("");
                            }}
                            style={{
                                padding: '14px 28px',
                                background: 'var(--cc-muted)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '600',
                                flex: 1
                            }}
                        >
                            Cancel
                        </button>
                    )}
                    
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                padding: '14px 28px',
                                background: 'var(--cc-border)',
                                color: 'var(--cc-text)',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '600'
                            }}
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

