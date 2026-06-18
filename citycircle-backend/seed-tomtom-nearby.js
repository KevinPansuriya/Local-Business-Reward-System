require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");
const fetch = global.fetch || require("node-fetch");

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;

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

function getTomTomScore(result) {
  if (typeof result?.score === "number") return result.score;
  if (typeof result?.scoring?.queryScore === "number") return result.scoring.queryScore;
  return null;
}

function passesTomTomQuality(store, options = {}) {
  const {
    requireAddress = false,
    requirePhoneOrUrl = false,
    excludeOtherCategory = false,
    minScore = null
  } = options;

  if (requireAddress && !store.address) return false;
  if (requirePhoneOrUrl && !store.phone && !store.website) return false;
  if (excludeOtherCategory && store.category === "other") return false;
  if (typeof minScore === "number") {
    if (store.score == null) return false;
    if (store.score < minScore) return false;
  }

  return true;
}

function normalizeTomTomCategory(categories = []) {
  const text = categories.join(" ").toLowerCase();
  if (text.includes("cafe") || text.includes("coffee")) return "coffee";
  if (text.includes("restaurant") || text.includes("fast food")) return "restaurant";
  if (text.includes("grocery") || text.includes("supermarket") || text.includes("convenience")) return "grocery";
  if (text.includes("liquor") || text.includes("wine") || text.includes("bar")) return "liquor";
  if (text.includes("pharmacy")) return "pharmacy";
  if (text.includes("laundry")) return "laundromat";
  if (text.includes("bakery")) return "bakery";
  if (text.includes("barber") || text.includes("beauty") || text.includes("hair")) return "salon";
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

async function fetchTomTomNearbyStores(lat, lng, radiusMiles, query, options = {}) {
  if (!TOMTOM_API_KEY) {
    throw new Error("TOMTOM_API_KEY is not configured");
  }

  const radiusMeters = Math.max(100, Math.round(radiusMiles * 1609.34));
  const q = encodeURIComponent(query || "store");
  const url =
    `https://api.tomtom.com/search/2/poiSearch/${q}.json` +
    `?lat=${lat}&lon=${lng}&radius=${radiusMeters}&limit=50&key=${TOMTOM_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TomTom request failed: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];

  return results
    .map((r) => {
      const name = r.poi?.name;
      if (!name) return null;
      const categories = r.poi?.categories || [];
      const categoryFromTomTom = normalizeTomTomCategory(categories);
      const categoryFromName = categorizeByName(name);
      const category = categoryFromTomTom !== "other"
        ? categoryFromTomTom
        : (options.preferNameCategory ? categoryFromName : categoryFromTomTom);
      const distance = r.dist ? r.dist / 1609.34 : null;
      const address = r.address?.freeformAddress || null;
      const score = getTomTomScore(r);

      return {
        id: `tt_${r.id}`,
        name,
        category,
        category_raw: categoryFromTomTom,
        latitude: r.position?.lat,
        longitude: r.position?.lon,
        distance_miles: distance,
        address,
        phone: r.poi?.phone || null,
        website: r.poi?.url || null,
        score,
        is_chain: isLikelyChainName(name)
      };
    })
    .filter((s) => (
      s &&
      s.distance_miles != null &&
      s.distance_miles <= radiusMiles &&
      !s.is_chain &&
      (options.includeOther || s.category !== "other") &&
      passesTomTomQuality(s, options)
    ))
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

async function run() {
  const radiusMiles = Number(process.argv[2] || "1");
  const userId = Number(process.argv[3] || process.env.TOMTOM_SEED_USER_ID || "2");
  const query = process.argv[4] || "store";
  const quality = process.argv[5] || process.env.TOMTOM_SEED_QUALITY || "verified";
  const minScoreParam = process.argv[6] || process.env.TOMTOM_SEED_MIN_SCORE || null;
  const includeOther = (process.argv[7] || process.env.TOMTOM_SEED_INCLUDE_OTHER || "0") === "1";
  const preferNameCategory = (process.argv[8] || process.env.TOMTOM_SEED_PREFER_NAME_CATEGORY || "1") !== "0";
  const minScore = minScoreParam != null ? Number(minScoreParam) : null;

  if (!TOMTOM_API_KEY) {
    throw new Error("Set TOMTOM_API_KEY in citycircle-backend/.env");
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
      requirePhoneOrUrl: true,
      excludeOtherCategory: true,
      minScore: minScore ?? 1.0
    }
    : {
      minScore
    };

  const stores = await fetchTomTomNearbyStores(
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
          s.phone || null,
          unclaimedHash,
          s.name,
          "TOMTOM",
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


