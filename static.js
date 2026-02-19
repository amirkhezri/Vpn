// === Static Content Helpers ===
// This file contains static data and utility functions

// App Version
const APP_VERSION = '1.0.0';
const APP_NAME = 'Shinobu VPN';

// Feature Flags
const FEATURES = {
    REFERRAL_SYSTEM: true,
    TRIAL_SYSTEM: true,
    YOOMONEY_PAYMENT: true,
    QR_CODE: true,
    MULTI_LANGUAGE: true
};

// API Endpoints (for future backend integration)
const API = {
    // These would be set when backend is added
    BASE_URL: window.env?.API_URL || '',
    
    // Endpoints
    GET_SUBSCRIPTION: '/api/subscription',
    ACTIVATE_TRIAL: '/api/trial',
    GET_TEST_KEY: '/api/test-key',
    VERIFY_PAYMENT: '/api/payment/verify',
    GET_USER: '/api/user'
};

// Constants
const REFERRAL = {
    REWARDS: {
        FREE_MONTHS: 1,
        REFERRALS_NEEDED: 5
    }
};

// Export for use
window.APP_CONFIG = {
    VERSION: APP_VERSION,
    NAME: APP_NAME,
    FEATURES: FEATURES,
    API: API,
    REFERRAL: REFERRAL
};

console.log('[Static] App config loaded:', APP_VERSION);
