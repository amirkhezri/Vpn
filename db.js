// === LocalStorage Database for VPN Web App ===
// Using localStorage for all data persistence (works with static hosting like Render)

// Configuration
const MAX_CONCURRENT_TEST_KEYS = 1;
const MAX_TOTAL_TEST_KEYS = 3;
const TEST_KEY_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const REFERRALS_NEEDED_FOR_TEST = 5;
const REFERRALS_NEEDED_FOR_REWARD = 5;
const FREE_MONTHS_PER_5_REFERRALS = 1;

class LocalStorageDB {
    constructor() {
        this.dbName = 'shinobuVpnDB';
        this.usersCollection = 'users';
        this.referralsCollection = 'referrals';
        this.settingsCollection = 'settings';
        this.cache = {};
        this.initializeDatabase();
        this.loadFromStorage();
    }

    initializeDatabase() {
        if (!localStorage.getItem(this.dbName)) {
            const initialDB = {
                users: {},
                referrals: {},
                settings: {
                    createdAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            localStorage.setItem(this.dbName, JSON.stringify(initialDB));
            console.log('[DB] Database initialized');
        }
    }

    loadFromStorage() {
        const stored = localStorage.getItem(this.dbName);
        if (stored) {
            try {
                this.cache = JSON.parse(stored);
            } catch (e) {
                console.error('[DB] Error loading data:', e);
                this.cache = { users: {}, referrals: {}, settings: {} };
            }
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.dbName, JSON.stringify(this.cache));
        } catch (e) {
            console.error('[DB] Error saving data:', e);
        }
    }

    getUsers() {
        return this.cache[this.usersCollection] || {};
    }

    getReferrals() {
        return this.cache[this.referralsCollection] || {};
    }

    // === User Operations ===
    async getUser(telegramId) {
        const users = this.getUsers();
        return users[telegramId] || null;
    }

    async createUser(telegramId, referralCode = null) {
        const users = this.getUsers();
        
        // Check if referral code is valid and process it
        let referredBy = null;
        if (referralCode) {
            const referrer = await this.getUserByReferralCode(referralCode);
            if (referrer) {
                referredBy = referrer.telegram_id;
                // Increment referrer's invited count
                await this.incrementInvitedCount(referrer.telegram_id);
            }
        }

        const user = {
            telegram_id: String(telegramId),
            referral_code: this.generateReferralCode(),
            referred_by: referredBy,
            // Test key data
            test_keys_used: 0,
            current_test_key: null,
            test_key_expiry: null,
            invited_count: 0,
            // Subscription data
            vless_key: null,
            subscription_expiry: null,
            balance: 0,
            trial_used: false,
            trial_expiry: null,
            status: 'inactive',
            // Metadata
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        users[telegramId] = user;
        this.cache[this.usersCollection] = users;
        this.saveToStorage();
        
        console.log('[DB] User created:', telegramId);
        return user;
    }

    async updateUser(telegramId, data) {
        let user = await this.getUser(telegramId);
        if (!user) {
            user = await this.createUser(telegramId);
        }
        
        const users = this.getUsers();
        users[telegramId] = {
            ...users[telegramId],
            ...data,
            updated_at: new Date().toISOString()
        };
        
        this.cache[this.usersCollection] = users;
        this.saveToStorage();
        return users[telegramId];
    }

    // === Referral Operations ===
    generateReferralCode() {
        return 'S' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async getUserByReferralCode(code) {
        const users = this.getUsers();
        for (const id in users) {
            if (users[id].referral_code === code) {
                return users[id];
            }
        }
        return null;
    }

    async incrementInvitedCount(telegramId) {
        const user = await this.getUser(telegramId);
        if (!user) return null;
        
        const newCount = (user.invited_count || 0) + 1;
        return this.updateUser(telegramId, { invited_count: newCount });
    }

    // === Test Key Operations ===
    async incrementTestKeysUsed(telegramId) {
        const user = await this.getUser(telegramId);
        if (!user) return null;
        
        const newCount = (user.test_keys_used || 0) + 1;
        return this.updateUser(telegramId, { test_keys_used: newCount });
    }

    async setActiveTestKey(telegramId, testKey) {
        const expiry = Date.now() + TEST_KEY_DURATION_MS;
        return this.updateUser(telegramId, {
            current_test_key: testKey,
            test_key_expiry: expiry
        });
    }

    async clearActiveTestKey(telegramId) {
        return this.updateUser(telegramId, {
            current_test_key: null,
            test_key_expiry: null
        });
    }

    async clearUserTestKeys(telegramId) {
        return this.updateUser(telegramId, {
            test_keys_used: 0,
            current_test_key: null,
            test_key_expiry: null,
            invited_count: 0
        });
    }

    canGetNewTest(user) {
        if (!user) return { allowed: true, reason: null };
        
        // Check if there's an active test key
        if (user.test_key_expiry && user.test_key_expiry > Date.now()) {
            return { allowed: false, reason: 'active_test', expiry: user.test_key_expiry };
        }
        
        // Check if max test keys used
        if (user.test_keys_used >= MAX_TOTAL_TEST_KEYS) {
            return { allowed: false, reason: 'max_used' };
        }
        
        // Check if more test keys need referrals
        if (user.test_keys_used > 0 && user.invited_count < REFERRALS_NEEDED_FOR_TEST) {
            return { 
                allowed: false, 
                reason: 'need_referrals',
                needed: REFERRALS_NEEDED_FOR_TEST,
                current: user.invited_count
            };
        }
        
        return { allowed: true, reason: null };
    }

    // === Subscription Operations ===
    async setSubscription(telegramId, vlessKey, expiryTimestamp) {
        return this.updateUser(telegramId, {
            vless_key: vlessKey,
            subscription_expiry: expiryTimestamp,
            status: 'active'
        });
    }

    async activateTrial(telegramId) {
        const expiry = Date.now() + (TRIAL_DAYS || 3) * 24 * 60 * 60 * 1000;
        return this.updateUser(telegramId, {
            trial_used: true,
            trial_expiry: expiry,
            status: 'active'
        });
    }

    async updateBalance(telegramId, balance) {
        return this.updateUser(telegramId, { balance });
    }

    async addToBalance(telegramId, amount) {
        const user = await this.getUser(telegramId);
        const newBalance = (user?.balance || 0) + amount;
        return this.updateUser(telegramId, { balance: newBalance });
    }

    // === Reward Calculation ===
    getFreeMonths(invitedCount) {
        if (!invitedCount || invitedCount < REFERRALS_NEEDED_FOR_REWARD) {
            return 0;
        }
        return Math.floor(invitedCount / REFERRALS_NEEDED_FOR_REWARD) * FREE_MONTHS_PER_5_REFERRALS;
    }

    // === Data Export ===
    async getAllData() {
        return {
            users: this.getUsers(),
            referrals: this.getReferrals(),
            settings: this.cache[this.settingsCollection] || {},
            dbName: this.dbName,
            initialized: true
        };
    }

    // Clear all data (for testing)
    async clearAllData() {
        this.initializeDatabase();
        this.loadFromStorage();
    }
}

// Create global instance
const localStorageDB = new LocalStorageDB();

// Export for use in main.js
window.localStorageDB = localStorageDB;
window.TEST_KEY_DURATION_MS = TEST_KEY_DURATION_MS;
window.MAX_TOTAL_TEST_KEYS = MAX_TOTAL_TEST_KEYS;
window.REFERRALS_NEEDED_FOR_TEST = REFERRALS_NEEDED_FOR_TEST;
window.REFERRALS_NEEDED_FOR_REWARD = REFERRALS_NEEDED_FOR_REWARD;
window.FREE_MONTHS_PER_5_REFERRALS = FREE_MONTHS_PER_5_REFERRALS;

console.log('[DB] LocalStorageDB initialized');
