require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");
const fetch = global.fetch || require("node-fetch");

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

function dbGetAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRunAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function isLikelyChainName(name = "") {
  const haystack = String(name || "").toLowerCase();
  const chainKeywords = [
    "starbucks", "mcdonald", "subway", "dunkin", "burger king", "kfc",
    "taco bell", "wendy's", "domino", "pizza hut", "chipotle", "panera",
    "7-eleven", "walmart", "target", "costco", "cvs", "walgreens", "rite aid",
    "whole foods", "trader joe", "aldi", "kroger"
  ];
  return chainKeywords.some((k) => haystack.includes(k));
}

function normalizeGoogleCategory(types = []) {
  const text = types.join(" ").toLowerCase();
  if (text.includes("grocery_or_supermarket") || text.includes("convenience_store")) return "grocery";
  if (text.includes("liquor_store")) return "liquor";
  if (text.includes("barber_shop")) return "barber";
  if (text.includes("beauty_salon") || text.includes("hair_care")) return "salon";
  if (text.includes("cafe") || text.includes("coffee")) return "coffee";
  if (text.includes("restaurant") || text.includes("meal_takeaway")) return "restaurant";
  if (text.includes("bakery")) return "bakery";
  if (text.includes("pharmacy") || text.includes("drugstore")) return "pharmacy";
  if (text.includes("laundry")) return "laundromat";
  return "other";
}

function categorizeByName(name = "") {
  const text = String(name || "").toLowerCase();
  if (text.includes("grocery") || text.includes("market") || text.includes("deli")) return "grocery";
  if (text.includes("liquor") || text.includes("wine") || text.includes("spirits")) return "liquor";
  if (text.includes("barber") || text.includes("barbershop")) return "barber";
  if (text.includes("salon") || text.includes("spa") || text.includes("beauty") || text.includes("nail")) return "salon";
  if (text.includes("coffee") || text.includes("cafe")) return "coffee";
  if (text.includes("bakery") || text.includes("bake")) return "bakery";
  if (text.includes("laundry") || text.includes("laundromat")) return "laundromat";
  if (text.includes("pharmacy") || text.includes("drug")) return "pharmacy";
  if (text.includes("restaurant") || text.includes("grill") || text.includes("diner") || text.includes("pizza")) return "restaurant";
  return "other";
}

function passesGoogleQuality(store, options = {}) {
  const {
    requireAddress = false,
    excludeOtherCategory = false,
    minRating = null,
    minReviews = null
  } = options;

  if (requireAddress && !store.address) return false;
  if (excludeOtherCategory && store.category === "other") return false;
  if (typeof minRating === "number" && (store.rating == null || store.rating < minRating)) return false;
  if (typeof minReviews === "number" && (store.user_ratings_total == null || store.user_ratings_total < minReviews)) return false;
  return true;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchGoogleNearbyStores(lat, lng, radiusMiles, query, options = {}) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }

  const radiusMeters = Math.max(100, Math.round(radiusMiles * 1609.34));
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radiusMeters),
    key: GOOGLE_PLACES_API_KEY
  });

  if (query && query !== "all") {
    params.set("keyword", query);
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Places request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places error: ${data.status}`);
  }

  const results = data.results || [];

  return results
    .map((r) => {
      const name = r.name;
      if (!name) return null;
      const types = r.types || [];
      const categoryFromGoogle = normalizeGoogleCategory(types);
      const categoryFromName = categorizeByName(name);
      const category = categoryFromGoogle !== "other"
        ? categoryFromGoogle
        : (options.preferNameCategory ? categoryFromName : categoryFromGoogle);
      const address = r.vicinity || r.formatted_address || null;
      const latitude = r.geometry?.location?.lat;
      const longitude = r.geometry?.location?.lng;
      const distance = (latitude != null && longitude != null)
        ? haversineMiles(lat, lng, latitude, longitude)
        : null;

      return {
        id: `g_${r.place_id}`,
        place_id: r.place_id,
        name,
        category,
        category_raw: categoryFromGoogle,
        latitude,
        longitude,
        distance_miles: distance,
        address,
        rating: r.rating ?? null,
        user_ratings_total: r.user_ratings_total ?? null,
        is_chain: isLikelyChainName(name)
      };
    })
    .filter((s) => (
      s &&
      s.distance_miles != null &&
      s.distance_miles <= radiusMiles &&
      !s.is_chain &&
      (options.includeOther || s.category !== "other") &&
      passesGoogleQuality(s, options)
    ))
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

async function run() {
  const radiusMiles = Number(process.argv[2] || "1");
  const userId = Number(process.argv[3] || process.env.GOOGLE_SEED_USER_ID || "2");
  const query = process.argv[4] || "all";
  const quality = process.argv[5] || process.env.GOOGLE_SEED_QUALITY || "verified";
  const minRatingParam = process.argv[6] || process.env.GOOGLE_SEED_MIN_RATING || null;
  const minReviewsParam = process.argv[7] || process.env.GOOGLE_SEED_MIN_REVIEWS || null;
  const includeOther = (process.argv[8] || process.env.GOOGLE_SEED_INCLUDE_OTHER || "0") === "1";
  const preferNameCategory = (process.argv[9] || process.env.GOOGLE_SEED_PREFER_NAME_CATEGORY || "1") !== "0";

  const minRating = minRatingParam != null ? Number(minRatingParam) : null;
  const minReviews = minReviewsParam != null ? Number(minReviewsParam) : null;

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Set GOOGLE_PLACES_API_KEY in citycircle-backend/.env");
  }

  const user = await dbGetAsync(
    "SELECT latitude, longitude FROM users WHERE id = ?",
    [userId]
  );

  if (!user || user.latitude == null || user.longitude == null) {
    throw new Error(`User ${userId} does not have a home location set`);
  }

  const qualityOptions = quality === "verified"
    ? {
      requireAddress: true,
      excludeOtherCategory: true,
      minRating: minRating ?? 3.5,
      minReviews: minReviews ?? 5
    }
    : {
      minRating,
      minReviews
    };

  const stores = await fetchGoogleNearbyStores(
    user.latitude,
    user.longitude,
    radiusMiles,
    query,
    {
      ...qualityOptions,
      includeOther,
      preferNameCategory
    }
  );

  const unclaimedHash = bcrypt.hashSync("unclaimed_store", 10);
  let importedCount = 0;

  for (const s of stores) {
    const existing = await dbGetAsync(
      `SELECT id FROM stores
       WHERE lower(name) = lower(?)
       AND ABS(latitude - ?) < 0.0001
       AND ABS(longitude - ?) < 0.0001`,
      [s.name, s.latitude, s.longitude]
    );

    if (!existing) {
      await dbRunAsync(
        `INSERT INTO stores
         (email, phone, password_hash, name, zone, category, base_discount_percent, latitude, longitude, address, is_local)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          null,
          null,
          unclaimedHash,
          s.name,
          "GOOGLE",
          s.category || "other",
          0,
          s.latitude,
          s.longitude,
          s.address || null,
          1
        ]
      );
      importedCount += 1;
    }
  }

  db.close();
}

run().catch((e) => {
  process.exit(1);
});


