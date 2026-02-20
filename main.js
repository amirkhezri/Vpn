// ==============================
// Telegram Mini App Main Script
// Backend-Driven Version
// ==============================

let telegramId = null;
let tg = window.Telegram?.WebApp;
let currentUser = null;

// ==============================
// Telegram Init
// ==============================

document.addEventListener("DOMContentLoaded", async () => {

    if (tg) {
        tg.expand();
        telegramId = tg?.initDataUnsafe?.user?.id;
    }

    if (!telegramId) {
        console.error("Telegram user ID not found!");
        return;
    }

    // Load user from backend
    await loadUserFromServer();

    // Poll every 10 seconds
    setInterval(loadUserFromServer, 10000);
});

// ==============================
// Load User From Backend
// ==============================

async function loadUserFromServer() {
    try {
        const res = await fetch(`/api/user/${telegramId}`);
        const data = await res.json();

        if (!data.success) {
            console.error("User fetch failed");
            return;
        }

        currentUser = data.user;

        updateUI();

    } catch (err) {
        console.error("User load error:", err);
    }
}

// ==============================
// UI Update Logic
// ==============================

function updateUI() {
    if (!currentUser) return;

    updateSubscriptionUI();
    updateReferralUI();
    updateTrialUI();
    updateProfileUI();
}

// ==============================
// Subscription UI
// ==============================

function updateSubscriptionUI() {
    const subEl = document.getElementById("subscriptionStatus");
    if (!subEl) return;

    const expiry = currentUser.subscription_expiry;

    if (!expiry) {
        subEl.innerText = "No Active Subscription";
        return;
    }

    const remaining = new Date(expiry) - new Date();

    if (remaining > 0) {
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        subEl.innerText = `Active (${days} days left)`;
    } else {
        subEl.innerText = "Expired";
    }
}

// ==============================
// Referral UI
// ==============================

function updateReferralUI() {
    const refEl = document.getElementById("referralCount");
    if (!refEl) return;

    refEl.innerText = currentUser.referral_count || 0;
}

// ==============================
// Trial UI
// ==============================

function updateTrialUI() {
    const trialBtn = document.getElementById("activateTrialBtn");
    if (!trialBtn) return;

    trialBtn.disabled = currentUser.trial_used === true;
}

// ==============================
// Profile UI
// ==============================

function updateProfileUI() {
    const usernameEl = document.getElementById("username");
    const photoEl = document.getElementById("profilePhoto");

    if (usernameEl && currentUser.username) {
        usernameEl.innerText = currentUser.username;
    }

    if (photoEl && currentUser.photo_url) {
        photoEl.src = currentUser.photo_url;
    }
}

// ==============================
// Activate Trial
// ==============================

async function activateTrial() {
    try {
        const res = await fetch("/api/activate-trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ telegram_id: telegramId })
        });

        const data = await res.json();

        if (data.success) {
            alert("Trial Activated!");
            await loadUserFromServer();
        } else {
            alert(data.error || "Trial failed");
        }

    } catch (err) {
        console.error("Trial activation error:", err);
    }
}

// ==============================
// Copy Referral Link
// ==============================

function copyReferralLink() {
    if (!telegramId) return;

    const link = `https://t.me/YOUR_BOT_USERNAME?start=${telegramId}`;

    navigator.clipboard.writeText(link)
        .then(() => alert("Referral link copied!"))
        .catch(() => alert("Failed to copy link"));
}
