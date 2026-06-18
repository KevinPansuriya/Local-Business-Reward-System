// citycircle-backend/services/categoryProfiles.js
const db = require('../db');

function getDefaultProfile() {
    return {
        category: 'other',
        max_rewarded_visits_per_day: 1,
        cooldown_minutes: 1440,
        min_dwell_minutes: 3,
        base_points: 10,
        pending_ratio: 0.7,
        dvs_expiry_days: 7
    };
}

/**
 * Get category profile for a store category
 * @param {string} category - Store category (e.g., 'coffee', 'liquor', 'laundromat')
 * @param {function} callback - Callback function (err, profile)
 */
function getCategoryProfile(category, callback) {
    db.get(
        "SELECT * FROM category_profiles WHERE category = ?",
        [category],
        (err, profile) => {
            if (err) {
                if (String(err.message || "").includes("no such table: category_profiles")) {
                    return callback(null, getDefaultProfile());
                }
                return callback(err, null);
            }
            // If no profile found, use default 'other' profile
            if (!profile) {
                db.get(
                    "SELECT * FROM category_profiles WHERE category = 'other'",
                    [],
                    (err2, defaultProfile) => {
                        if (err2) {
                            if (String(err2.message || "").includes("no such table: category_profiles")) {
                                return callback(null, getDefaultProfile());
                            }
                            return callback(err2, null);
                        }
                        callback(null, defaultProfile || getDefaultProfile());
                    }
                );
            } else {
                callback(null, profile);
            }
        }
    );
}

function getStoreRewardProfile(storeId, callback) {
    db.get(
        "SELECT * FROM store_reward_profiles WHERE store_id = ?",
        [storeId],
        (err, profile) => {
            if (err) {
                if (String(err.message || "").includes("no such table: store_reward_profiles")) {
                    return callback(null, null);
                }
                return callback(err, null);
            }
            callback(null, profile || null);
        }
    );
}

function mergeProfiles(categoryProfile, storeProfile) {
    if (!storeProfile) return categoryProfile;
    const merged = { ...categoryProfile };
    const fields = [
        "max_rewarded_visits_per_day",
        "cooldown_minutes",
        "min_dwell_minutes",
        "base_points",
        "pending_ratio",
        "dvs_expiry_days",
    ];
    fields.forEach((field) => {
        if (storeProfile[field] !== null && storeProfile[field] !== undefined) {
            merged[field] = storeProfile[field];
        }
    });
    return merged;
}

function getProfileForStore(storeId, category, callback) {
    getCategoryProfile(category, (err, categoryProfile) => {
        if (err || !categoryProfile) {
            return callback(err, null);
        }
        getStoreRewardProfile(storeId, (err2, storeProfile) => {
            if (err2) {
                return callback(err2, null);
            }
            const merged = mergeProfiles(categoryProfile, storeProfile);
            callback(null, merged);
        });
    });
}

/**
 * Check if user can check in based on category rules
 * @param {number} userId - User ID
 * @param {number} storeId - Store ID
 * @param {string} category - Store category
 * @param {function} callback - Callback function (err, result)
 */
function canCheckIn(userId, storeId, category, callback) {
    getProfileForStore(storeId, category, (err, profile) => {
        if (err || !profile) {
            return callback(err, { 
                allowed: false, 
                reason: "Category profile not found. Please contact support." 
            });
        }

        // Get user's check-ins today for this store
        db.get(
            `SELECT COUNT(*) as visit_count,
                    MAX(checked_in_at) as last_check_in
             FROM check_in_sessions
             WHERE user_id = ? 
               AND store_id = ? 
               AND date(checked_in_at) = date('now', 'localtime')
               AND status IN ('completed', 'active')`,
            [userId, storeId],
            (err2, result) => {
                if (err2) {
                    return callback(err2, { 
                        allowed: false, 
                        reason: "Database error. Please try again." 
                    });
                }

                const visitCount = result.visit_count || 0;
                const lastCheckIn = result.last_check_in;

                // Check max visits per day
                if (visitCount >= profile.max_rewarded_visits_per_day) {
                    const visitText = profile.max_rewarded_visits_per_day === 1 ? 'time' : 'times';
                    return callback(null, {
                        allowed: false,
                        reason: `You've already checked in ${profile.max_rewarded_visits_per_day} ${visitText} today. Come back tomorrow!`,
                        cooldownMinutes: null,
                        profile: profile
                    });
                }

                // Check cooldown period
                if (lastCheckIn) {
                    const lastCheckInTime = new Date(lastCheckIn);
                    const minutesSince = (Date.now() - lastCheckInTime.getTime()) / (1000 * 60);
                    
                    if (minutesSince < profile.cooldown_minutes) {
                        const remainingMinutes = Math.ceil(profile.cooldown_minutes - minutesSince);
                        
                        // Format cooldown message
                        let cooldownMessage;
                        if (remainingMinutes < 60) {
                            cooldownMessage = `${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''}`;
                        } else if (remainingMinutes < 1440) {
                            const hours = Math.floor(remainingMinutes / 60);
                            const mins = remainingMinutes % 60;
                            if (mins === 0) {
                                cooldownMessage = `${hours} hour${hours !== 1 ? 's' : ''}`;
                            } else {
                                cooldownMessage = `${hours} hour${hours !== 1 ? 's' : ''} and ${mins} minute${mins !== 1 ? 's' : ''}`;
                            }
                        } else {
                            const days = Math.floor(remainingMinutes / 1440);
                            cooldownMessage = `${days} day${days !== 1 ? 's' : ''}`;
                        }
                        
                        return callback(null, {
                            allowed: false,
                            reason: `Please wait ${cooldownMessage} before checking in again.`,
                            cooldownMinutes: remainingMinutes,
                            profile: profile
                        });
                    }
                }

                // All checks passed
                callback(null, {
                    allowed: true,
                    profile: profile
                });
            }
        );
    });
}

/**
 * Get all category profiles (for admin)
 */
function getAllCategoryProfiles(callback) {
    db.all(
        "SELECT * FROM category_profiles ORDER BY category",
        [],
        (err, profiles) => {
            if (err) {
                return callback(err, null);
            }
            callback(null, profiles);
        }
    );
}

/**
 * Update category profile (for admin)
 */
function updateCategoryProfile(category, updates, callback) {
    const fields = [];
    const values = [];
    
    if (updates.max_rewarded_visits_per_day !== undefined) {
        fields.push('max_rewarded_visits_per_day = ?');
        values.push(updates.max_rewarded_visits_per_day);
    }
    if (updates.cooldown_minutes !== undefined) {
        fields.push('cooldown_minutes = ?');
        values.push(updates.cooldown_minutes);
    }
    if (updates.min_dwell_minutes !== undefined) {
        fields.push('min_dwell_minutes = ?');
        values.push(updates.min_dwell_minutes);
    }
    if (updates.base_points !== undefined) {
        fields.push('base_points = ?');
        values.push(updates.base_points);
    }
    if (updates.pending_ratio !== undefined) {
        fields.push('pending_ratio = ?');
        values.push(updates.pending_ratio);
    }
    if (updates.dvs_expiry_days !== undefined) {
        fields.push('dvs_expiry_days = ?');
        values.push(updates.dvs_expiry_days);
    }
    
    if (fields.length === 0) {
        return callback(new Error('No fields to update'), null);
    }
    
    fields.push('updated_at = datetime("now")');
    values.push(category);
    
    db.run(
        "INSERT OR IGNORE INTO category_profiles (category) VALUES (?)",
        [category],
        (insertErr) => {
            if (insertErr) {
                return callback(insertErr, null);
            }
            db.run(
                `UPDATE category_profiles SET ${fields.join(', ')} WHERE category = ?`,
                values,
                function(err) {
                    if (err) {
                        return callback(err, null);
                    }
                    callback(null, { success: true, changes: this.changes });
                }
            );
        }
    );
}

function upsertStoreRewardProfile(storeId, updates, callback) {
    const fields = [];
    const values = [];
    const allowedFields = [
        "max_rewarded_visits_per_day",
        "cooldown_minutes",
        "min_dwell_minutes",
        "base_points",
        "pending_ratio",
        "dvs_expiry_days",
    ];
    allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(updates[field]);
        }
    });

    if (fields.length === 0) {
        return callback(new Error("No fields to update"), null);
    }

    fields.push('updated_at = datetime("now")');
    values.push(storeId);

    db.run(
        "INSERT OR IGNORE INTO store_reward_profiles (store_id) VALUES (?)",
        [storeId],
        (insertErr) => {
            if (insertErr) {
                return callback(insertErr, null);
            }
            db.run(
                `UPDATE store_reward_profiles SET ${fields.join(", ")} WHERE store_id = ?`,
                values,
                function (err) {
                    if (err) {
                        return callback(err, null);
                    }
                    callback(null, { success: true, changes: this.changes });
                }
            );
        }
    );
}

function deleteStoreRewardProfile(storeId, callback) {
    db.run(
        "DELETE FROM store_reward_profiles WHERE store_id = ?",
        [storeId],
        function (err) {
            if (err) {
                return callback(err, null);
            }
            callback(null, { success: true, changes: this.changes });
        }
    );
}

module.exports = {
    getCategoryProfile,
    getStoreRewardProfile,
    getProfileForStore,
    canCheckIn,
    getAllCategoryProfiles,
    updateCategoryProfile,
    upsertStoreRewardProfile,
    deleteStoreRewardProfile
};
