// Free geocoding service using OpenStreetMap Nominatim API
// Rate limit: 1 request per second (free tier)
// No API key required!

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();
}

// Geocode address to coordinates (FREE)
export async function geocodeAddress(address) {
    await waitForRateLimit();
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'CityCircle App' // Required by Nominatim
                }
            }
        );
        
        if (!response.ok) {
            throw new Error("Geocoding service unavailable");
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
                address: data[0].display_name,
                details: data[0].address
            };
        }
        
        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        throw new Error("Failed to geocode address: " + error.message);
    }
}

// Reverse geocode coordinates to address (FREE)
export async function reverseGeocode(latitude, longitude) {
    await waitForRateLimit();
    
    try {
        // Use higher zoom level for more accurate address
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&extratags=1`,
            {
                headers: {
                    'User-Agent': 'CityCircle App'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error("Reverse geocoding service unavailable");
        }
        
        const data = await response.json();
        
        if (data && data.address) {
            const addr = data.address;
            
            // Extract structured address components
            const address1 = [addr.house_number, addr.road].filter(Boolean).join(" ") || "";
            const address2 = addr.suburb || addr.neighbourhood || addr.hamlet || "";
            const city = addr.city || addr.town || addr.village || addr.municipality || "";
            const state = addr.state || addr.region || "";
            const zipcode = addr.postcode || "";
            const country = addr.country || "";
            
            // Create formatted address for display
            const formattedAddress = [
                address1,
                address2,
                city,
                state,
                zipcode,
                country
            ].filter(Boolean).join(", ");
            
            return {
                formatted: formattedAddress,
                displayName: data.display_name,
                structured: {
                    address1,
                    address2,
                    city,
                    state,
                    zipcode,
                    country
                },
                details: addr
            };
        }
        
        return null;
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        throw new Error("Failed to reverse geocode: " + error.message);
    }
}
