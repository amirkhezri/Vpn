// --- LocalStorage Database for VPN Web App ---
// Using localStorage for all data persistence (no backend needed)

// Configuration
const MAX_CONCURRENT_TEST_KEYS = 1;
const MAX_TOTAL_TEST_KEYS = 3;
const TEST_KEY_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const REFERRALS_NEEDED_FOR_TEST = 5;

class LocalStorageDB {
    constructor() {
        this.dbName = 'vpnAppDB';
        this.usersCollection = 'users';
        this.cache = {};
        this.initializeDatabase();
        this.loadFromStorage();
    }

    initializeDatabase() {
        // Auto-create database structure if not exists
        if (!localStorage.getItem(this.dbName)) {
            const initialDB = {
                users: {},
                testKeys: [],
                settings: {
                    createdAt: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            localStorage.setItem(this.dbName, JSON.stringify(initialDB));
            console.log('Database initialized automatically');
        }
    }

    loadFromStorage() {
        const stored = localStorage.getItem(this.dbName);
        if (stored) {
            this.cache = JSON.parse(stored);
        }
    }

    saveToStorage() {
        localStorage.setItem(this.dbName, JSON.stringify(this.cache));
    }

    getUsers() {
        return this.cache[this.usersCollection] || {};
    }

    // User operations
    async getUser(telegramId) {
        const users = this.getUsers();
        return users[telegramId] || null;
    }

    async createUser(telegramId) {
        const users = this.getUsers();
        const user = {
            telegram_id: telegramId,
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
            status: 'inactive',
            // Metadata
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        users[telegramId] = user;
        this.cache[this.usersCollection] = users;
        this.saveToStorage();
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

    // Test key operations
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

    // Clear all test key data for a user (for testing)
    async clearUserTestKeys(telegramId) {
        return this.updateUser(telegramId, {
            test_keys_used: 0,
            current_test_key: null,
            test_key_expiry: null,
            invited_count: 0
        });
    }

    async updateInvitedCount(telegramId, count) {
        return this.updateUser(telegramId, { invited_count: count });
    }

    canGetNewTest(user) {
        if (!user) return { allowed: true, reason: null };
        
        if (user.test_key_expiry && user.test_key_expiry > Date.now()) {
            return { allowed: false, reason: 'active_test' };
        }
        
        if (user.test_keys_used >= MAX_TOTAL_TEST_KEYS) {
            return { allowed: false, reason: 'max_used' };
        }
        
        if (user.test_keys_used > 0 && user.invited_count < REFERRALS_NEEDED_FOR_TEST) {
            return { allowed: false, reason: 'need_referrals' };
        }
        
        return { allowed: true, reason: null };
    }

    // Subscription operations
    async setSubscription(telegramId, vlessKey, expiryTimestamp) {
        return this.updateUser(telegramId, {
            vless_key: vlessKey,
            subscription_expiry: expiryTimestamp,
            status: 'active'
        });
    }

    async activateTrial(telegramId) {
        return this.updateUser(telegramId, {
            trial_used: true,
            status: 'active'
        });
    }

    async updateBalance(telegramId, balance) {
        return this.updateUser(telegramId, { balance });
    }

    async getAllData() {
        return {
            users: this.getUsers(),
            settings: this.cache.settings || {},
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
