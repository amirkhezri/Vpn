// --- Configuration & State ---
let tg = null, telegramId = null, userId = null;
let currentLang = localStorage.getItem('lang') || 'ru';
let isProcessing = false; // Anti-spam lock

// Environment Variables for Testing
const ENV = {
    DATABASE_URL: 'postgresql://dbuservpn:d5pKaJTUIR6f5vCvIoemJyHwAJQTUn85@dpg-d6a7iii48b3s73bhdvj0-a/dbvpn',
    BOT_TOKEN: '8488517638:AAEPp5x6Lr0HnmJjBbOSyjSAIVb44MZx6C8',
    // Test mode - set to true to enable test helpers
    TEST_MODE: new URLSearchParams(window.location.search).get('test') === '1',
    // Debug: reset test keys (use ?reset_test=1 in URL)
    RESET_TEST: new URLSearchParams(window.location.search).get('reset_test') === '1'
};

const YOOMONEY_RECIPIENT_ID = '4100119271147598';
const BOT_USERNAME = 'Toni_vpn_bot';
const TRIAL_DAYS = 3;

const TARIFFS = [
    { months: 1, price: 103.10 },
    { months: 2, price: 206.19 },
    { months: 3, price: 309.28 },
    { months: 6, price: 618.56 }
];

// --- LocalStorage Firestore Mock ---
// Using localStorage instead of backend API
window.firestore = {
    doc: () => ({}),
    getDoc: async () => {
        try {
            // Get user data from localStorage
            const user = await window.localStorageDB.getUser(telegramId);
            if (!user) {
                // Create new user if doesn't exist
                await window.localStorageDB.createUser(telegramId);
                return { 
                    exists: () => false, 
                    data: () => ({}) 
                };
            }
            return { 
                exists: () => !!user, 
                data: () => ({
                    vless_key: user.vless_key,
                    subscription_expiry: user.subscription_expiry,
                    balance: user.balance,
                    trial_used: user.trial_used,
                    invited_count: user.invited_count,
                    status: user.status
                })
            };
        } catch (error) {
            console.error("LocalStorage Error:", error);
            return { exists: () => false, data: () => ({}) };
        }
    },
    setDoc: async (ref, data, { merge } = {}) => {
        try {
            if (data.action === 'activate_trial' && isProcessing) return;
            
            const user = await window.localStorageDB.getUser(telegramId) || 
                await window.localStorageDB.createUser(telegramId);
            
            if (data.trial_used && data.status === 'active') {
                // Activate trial
                await window.localStorageDB.activateTrial(telegramId);
            } else if (data.vless_key && data.subscription_expiry) {
                // Update subscription
                await window.localStorageDB.updateUser(telegramId, {
                    vless_key: data.vless_key,
                    subscription_expiry: data.subscription_expiry,
                    status: 'active'
                });
            } else if (data.balance !== undefined) {
                // Update balance
                await window.localStorageDB.updateBalance(telegramId, data.balance);
            } else if (data.invited_count !== undefined) {
                // Update invited count
                await window.localStorageDB.updateInvitedCount(telegramId, data.invited_count);
            } else {
                // Update other fields
                await window.localStorageDB.updateUser(telegramId, data);
            }
            
            window.dispatchEvent(new Event('db-update'));
        } catch (error) {
            console.error("LocalStorage Push Error:", error);
            showToast('Storage error.', 'error');
            throw error;
        }
    },
    onSnapshot: (ref, callback) => {
        let isCancelled = false;
        const poll = async () => {
            if (isCancelled) return;
            const docSnap = await window.firestore.getDoc();
            callback(docSnap);
            if (!isCancelled) setTimeout(poll, 5000);
        };
        poll();
        const updateListener = () => { if (!isCancelled) poll(); };
        window.addEventListener('db-update', updateListener);
        return () => { isCancelled = true; window.removeEventListener('db-update', updateListener); };
    }
};

// --- Initialization ---
window.addEventListener('load', () => {
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();
        // Устанавливаем цвет хедера Telegram в цвет фона
        tg.setHeaderColor('#2a1b3d'); 
        tg.setBackgroundColor('#2a1b3d');
    }

    // Инициализация языка
    updateLanguage(currentLang);

    // Test mode: Reset test keys if requested
    if (ENV.RESET_TEST && window.localStorageDB) {
        window.localStorageDB.clearUserTestKeys(telegramId);
        console.log('Test keys reset for user:', telegramId);
    }

    userId = localStorage.getItem('shinobu_user_id') || 'local_' + Math.random().toString(36).substr(2, 9);
    telegramId = tg?.initDataUnsafe?.user?.id || 'DEV_USER';
    if (telegramId === 'DEV_USER') localStorage.setItem('shinobu_user_id', userId);
    else userId = String(telegramId);

    let userFirstName = 'User';
    let userLastName = '';
    let userUsername = 'None';

    if (tg?.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        userFirstName = user.first_name || 'User';
        userLastName = user.last_name || '';
        userUsername = user.username ? `@${user.username}` : 'None';

const avatarPlaceholder = document.getElementById('user-avatar-placeholder');

if (user.photo_url) {
    avatarPlaceholder.innerHTML = `<img src="${user.photo_url}" 
        style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
} else {
    const initials = (userFirstName[0] + (userLastName ? userLastName[0] : '')).toUpperCase().trim();
    if (initials) avatarPlaceholder.textContent = initials;
}

    }

    document.getElementById('telegram-id-display').textContent = telegramId;
    document.getElementById('user-full-name').textContent = `${userFirstName} ${userLastName}`.trim();
    document.getElementById('username-display').textContent = userUsername;

    renderTariffs();
    renderDownloadButtons();
    renderInstructionButtons();
    generateReferralLink();
    window.startSubscriptionListener();
    
    // Initialize test key system
    if (window.localStorageDB) {
        updateTrialCard();
    }
    
    switchTab('profile');
});

// --- Event Delegation ---
window.addEventListener('click', (e) => {
    const btn = e.target.closest("button, a");
    if (!btn) return;

    e.stopPropagation();
    if (btn.disabled || btn.classList.contains('disabled')) return;

    // 1. Navigation
    if (btn.classList.contains('nav-btn')) {
        switchTab(btn.dataset.target);
        return;
    }

    // 2. Special Navigation (Renew Button)
    if (btn.classList.contains('nav-btn-proxy')) {
        switchTab(btn.dataset.targetTab);
        return;
    }

    // 3. Controls (Только язык)
    if (btn.id === 'lang-toggle-btn') {
        const langs = ['ru', 'en', 'de', 'fr'];
        let idx = langs.indexOf(currentLang);
        currentLang = langs[(idx + 1) % langs.length];
        updateLanguage(currentLang);
        return;
    }

    // Modal controls
    if (btn.id === 'close-modal-btn') {
        document.getElementById('payment-modal').style.display = 'none';
        return;
    }
    if (btn.classList.contains('open-link-delegate')) {
        openLink(btn.dataset.url);
        return;
    }
    if (btn.id === 'go-to-yoomoney-btn') {
        openLink(btn.dataset.url);
        document.getElementById('payment-modal').style.display = 'none';
        return;
    }

    // 4. Instructions
    if (btn.classList.contains('accordion-btn')) {
        const contentId = btn.dataset.target;
        const content = document.getElementById(contentId);
        btn.classList.toggle('active');
        content.classList.toggle('open');
        return;
    }

    // --- CRITICAL ACTIONS ---
    if (isProcessing) {
        showToast(TRANSLATIONS[currentLang].processing, 'info');
        return;
    }

    const lockAction = async (actionFn, loadingTextKey = 'processing') => {
        isProcessing = true;
        btn.classList.add('disabled');
        const originalContent = btn.innerHTML;
        const loadingText = TRANSLATIONS[currentLang][loadingTextKey] || 'Processing...';
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;

        try {
            await actionFn();
        } catch (err) {
            console.error(err);
        } finally {
            setTimeout(() => {
                isProcessing = false;
                btn.classList.remove('disabled');
                btn.innerHTML = originalContent;
            }, 1000);
        }
    };

    if (btn.classList.contains('tariff-btn-delegate')) {
        const months = parseInt(btn.dataset.months);
        const price = parseFloat(btn.dataset.price);
        showPaymentModal(months, price);
    } else if (btn.id === 'start-trial-btn') {
    lockAction(async () => {
        // Telegram ID از WebApp
        const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'DEV_USER';

        // درخواست trial از backend
        const result = await requestTrial(tgId);

        if(result.key){
            // همان فانکشن UI موجود برای نمایش key و تایمر
            showKey(result.key, result.expire);
        } else {
            // پیام خطا / ترغیب به referral یا خرید
            if(result.error === "trial_limit") 
                alert("You reached max free trials. Invite friends or buy subscription.");
            else if(result.error === "active_trial") 
                alert("You already have an active trial.");
            else if(result.error === "no_keys") 
                alert("No available test keys. Try later.");
        }
    }, 'processing');
    } else if (btn.id === 'copy-test-key-btn') {
        lockAction(copyTestKey, 'processing');
    } else if (btn.id === 'toggle-test-qr-btn') {
        toggleTestQrCode();
    } else if (btn.id === 'copy-vless-btn') {
        lockAction(copyVlessLink, 'processing');
    } else if (btn.id === 'toggle-qr-btn') {
        toggleQrCode();
    } else if (btn.id === 'copy-referral-btn') {
        lockAction(async () => {
            const link = document.getElementById('referral-link-display').textContent;
            await copyText(link, TRANSLATIONS[currentLang].link_copied);
        }, 'processing');
    }
});

// --- Core Functions ---

function updateLanguage(lang) {
    localStorage.setItem('lang', lang);
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelector('#lang-toggle-btn .lang-text').textContent = lang.toUpperCase();

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (TRANSLATIONS[lang][key]) {
            el.textContent = TRANSLATIONS[lang][key];
        }
    });

    renderTariffs();
    window.dispatchEvent(new Event('db-update'));
}

function switchTab(targetId) {
    document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-target="${targetId}"]`)?.classList.add('active');
}

window.showPaymentModal = (months, price) => {
    if (telegramId === 'DEV_USER') return showToast('Run in Telegram to pay', 'error');

    const comment = `Pay_${months}m_${telegramId}`;
    const yoomoneyUrl = `https://yoomoney.ru/quickpay/confirm.xml?receiver=${YOOMONEY_RECIPIENT_ID}&quickpay-form=shop&targets=Shinobu+${months}m&sum=${price.toFixed(2)}&comment=${encodeURIComponent(comment)}&paymentType=AC`;

    const t = TRANSLATIONS[currentLang];
    const monthLabel = months === 1 ? t.month_1 : (months < 5 ? t.month_few : t.month_many);

    document.getElementById('modal-tariff-info').innerHTML = `
                <p><strong>${t.month_1 === 'месяц' ? 'Срок' : 'Period'}:</strong> ${months} ${monthLabel}</p>
                <p><strong>${t.balance_label}</strong> <span style="font-size: 1.2em; font-weight: bold;">${price.toFixed(2)} ₽</span></p>
                <p><strong>ID:</strong> ${telegramId}</p>
            `;

    document.getElementById('go-to-yoomoney-btn').dataset.url = yoomoneyUrl;
    document.getElementById('payment-modal').style.display = 'flex';
}

window.startTrial = async () => {
    await window.firestore.setDoc(null, { status: 'active', trial_used: true }, { merge: true });
    showToast(TRANSLATIONS[currentLang].trial_success, 'success');
};

window.openLink = (url) => {
    tg?.openLink ? tg.openLink(url) : window.open(url, '_blank');
};

async function copyText(text, msg) {
    if (!text || text.includes('...')) return;
    try {
        await navigator.clipboard.writeText(text);
        showToast(msg, 'success');
    } catch (err) {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(msg, 'success');
    }
}

window.copyVlessLink = async () => {
    const text = document.getElementById('vless-link-display').textContent.replace(/.*: /, '').trim();
    const t = TRANSLATIONS[currentLang];
    if (text.includes('...')) return showToast(t.loading, 'error');
    await copyText(text, t.copied);
};

window.toggleQrCode = () => {
    const vlessLink = document.getElementById('vless-link-display').textContent.replace(/.*: /, '').trim();
    const qrDisplay = document.getElementById('qr-code-display');
    const qrPlaceholder = document.getElementById('qr-code-placeholder');
    const qrBtn = document.getElementById('toggle-qr-btn');
    const t = TRANSLATIONS[currentLang];

    if (qrDisplay.style.display === 'block') {
        qrDisplay.style.display = 'none';
        qrBtn.classList.remove('btn-primary');
        return;
    }

    if (vlessLink.includes('...')) {
        showToast(t.key_inactive, 'error');
        return;
    }

    const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(vlessLink)}`;
    qrPlaceholder.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px; border: 4px solid #7b2cbf; display: block; margin: 0 auto; box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);">`;
    qrDisplay.style.display = 'block';
    qrBtn.classList.add('btn-primary');
};

window.generateReferralLink = () => {
    const link = `https://t.me/${BOT_USERNAME}?start=ref_${telegramId}`;
    document.getElementById('referral-link-display').textContent = link;
};

function renderTariffs() {
    const t = TRANSLATIONS[currentLang];
    const grid = document.getElementById('tariff-grid');
    grid.innerHTML = TARIFFS.map((tariff) => {
        const mLabel = tariff.months === 1 ? t.month_1 : (tariff.months < 5 ? t.month_few : t.month_many);
        // Убрал margin-left: auto, добавил margin-top для отступа от текста месяца
        return `
                <div class="tariff-card">
                    <button class="btn tariff-btn tariff-btn-delegate" data-months="${tariff.months}" data-price="${tariff.price}">
                        <i class="fas fa-calendar"></i>
                        ${tariff.months} ${mLabel}
                        <span style="font-weight: bold; font-size: 1.2em; margin-top: 5px;">${tariff.price.toFixed(0)} ₽</span>
                    </button>
                </div>`;
    }).join('');
}

function renderDownloadButtons() {
    document.getElementById('download-grid').innerHTML = Object.values(DOWNLOAD_LINKS).map(i => `
                <button class="btn download-btn open-link-delegate" data-url="${i.url}">
                    <i class="${i.icon}"></i> ${i.name}
                </button>`).join('');
}

function renderInstructionButtons() {
    const container = document.getElementById('instructions-grid');
    container.className = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '15px';

    container.innerHTML = Object.keys(INSTRUCTION_LINKS).map(key => {
        const i = INSTRUCTION_LINKS[key];
        return `
                <div class="instruction-wrapper">
                    <button class="btn accordion-btn" style="width: 100%; justify-content: space-between;" data-target="inst-${key}">
                        <span><i class="${i.icon}"></i> ${i.name}</span>
                        <i class="fas fa-chevron-down accordion-icon"></i>
                    </button>
                    <div id="inst-${key}" class="instruction-content">
                        ${i.html}
                    </div>
                </div>`;
    }).join('');
}

window.startSubscriptionListener = async function () {
    const indicator = document.getElementById('status-indicator');
    const info = document.getElementById('status-info');
    const vlessDisplay = document.getElementById('vless-link-display');
    const trialCard = document.getElementById('trial-card-status');
    const renewContainer = document.getElementById('renew-container');
    const qrBtn = document.getElementById('toggle-qr-btn');

    const handleSnapshot = (docSnap) => {
        const data = docSnap.data();
        const t = TRANSLATIONS[currentLang];

        const balance = data.balance ? parseFloat(data.balance).toFixed(2) : '0.00';
        document.getElementById('user-balance-display').textContent = `${balance} ₽`;

        const expiryTime = Number(data.subscription_expiry) * 1000;
        const now = Date.now();
        const isActive = data.vless_key && data.subscription_expiry && expiryTime > now;

        const daysLeft = isActive ? Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)) : 0;

        if (!isActive || daysLeft < 5) {
            renewContainer.style.display = 'block';
        } else {
            renewContainer.style.display = 'none';
        }

        if (!data.vless_key) {
            indicator.textContent = t.status_inactive; indicator.className = 'status-indicator status-inactive';
            info.innerHTML = `<p>${t.expiry_label} -</p>`;
            vlessDisplay.innerHTML = `<span style="color: #7b2cbf;">${t.key_inactive}</span>`;
            if (qrBtn) qrBtn.disabled = true;
        } else if (isActive) {
            const date = new Date(expiryTime);
            const formatted = date.toLocaleDateString(currentLang, { year: 'numeric', month: 'long', day: 'numeric' });

            if (daysLeft < 5) {
                indicator.textContent = `${t.status_active} (< 5 days)`;
                indicator.className = 'status-indicator status-warning';
            } else {
                indicator.textContent = t.status_active;
                indicator.className = 'status-indicator status-active';
            }

            info.innerHTML = `<p>${t.expiry_label} <span id="expiry-date">${formatted}</span></p>`;
            vlessDisplay.innerHTML = `<strong>${t.key_active}</strong> ${data.vless_key}`;
            if (qrBtn) qrBtn.disabled = false;
        } else {
            indicator.textContent = t.status_expired; indicator.className = 'status-indicator status-inactive';
            info.innerHTML = `<p>${t.expiry_label} ${t.status_expired}</p>`;
            vlessDisplay.innerHTML = `<strong>${t.key_active}</strong> ${data.vless_key}`;
            if (qrBtn) qrBtn.disabled = false;
        }

        // Let updateTrialCard handle the trial button logic (checks for active test key too)
        if (window.localStorageDB) {
            updateTrialCard();
        } else {
            // Fallback to old behavior if localStorageDB not available
            if (data.trial_used) {
                trialCard.innerHTML = `
                            <p style="color: #38a169; font-weight: bold; margin-bottom: 15px;"><i class="fas fa-check-circle"></i> ${t.trial_used}.</p>
                        `;
            } else {
                trialCard.innerHTML = `<button class="btn btn-primary" id="start-trial-btn"><i class="fas fa-gift"></i> ${t.trial_btn}</button>`;
            }
        }

        window.updateReferralUI(data.invited_count || 0);
    };
    window.firestore.onSnapshot(null, handleSnapshot);
};

window.updateReferralUI = (count) => {
    const t = TRANSLATIONS[currentLang];
    document.getElementById('invited-count-display').innerHTML = `${t.invited_text} <strong>${count}</strong>`;
};

window.showToast = (msg, type = 'info', dur = 3000) => {
    const container = document.getElementById('toast-container-box');
    const toast = document.createElement('div');
    let icon = '<i class="fas fa-info-circle"></i>';
    let className = 'toast-info';

    if (type === 'success') {
        icon = '<i class="fas fa-check-circle"></i>';
        className = 'toast-success';
    } else if (type === 'error') {
        icon = '<i class="fas fa-exclamation-circle"></i>';
        className = 'toast-error';
    }

    toast.className = `toast ${className}`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        toast.addEventListener('transitionend', () => toast.remove());
    }, dur);
};

// --- Test Key Functions ---
let usedTestKeys = new Set(JSON.parse(localStorage.getItem('usedTestKeys') || '[]'));

// Countdown timer for test key
let countdownInterval = null;

function updateTestKeyCountdown() {
    const countdownEl = document.getElementById('test-key-countdown');
    if (!countdownEl) return;
    
    const userId = String(telegramId);
    const user = window.localStorageDB ? window.localStorageDB.cache[userId] : null;
    if (!user || !user.test_key_expiry) {
        countdownEl.textContent = '';
        return;
    }
    
    const remaining = user.test_key_expiry - Date.now();
    
    if (remaining <= 0) {
        // Test key expired - hide the test key section
        document.getElementById('test-key-section').style.display = 'none';
        // Clear expired test key from database
        window.localStorageDB.clearActiveTestKey(telegramId);
        // Call updateTrialCard to show correct button based on referral status
        updateTrialCard();
        if (countdownInterval) clearInterval(countdownInterval);
        return;
    }
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    countdownEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function startTestKeyCountdown() {
    updateTestKeyCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateTestKeyCountdown, 1000);
}

function stopTestKeyCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

// Update trial card based on user status
async function updateTrialCard() {
    const trialCard = document.getElementById('trial-card-status');
    const t = TRANSLATIONS[currentLang];
    
    if (!window.localStorageDB) {
        // Fallback to old behavior
        trialCard.innerHTML = `<button class="btn btn-primary" id="start-trial-btn"><i class="fas fa-gift"></i> ${t.trial_btn}</button>`;
        return;
    }
    
    let user = await window.localStorageDB.getUser(telegramId);
    
    if (!user) {
        // New user - show trial button
        trialCard.innerHTML = `<button class="btn btn-primary" id="start-trial-btn"><i class="fas fa-gift"></i> ${t.trial_btn}</button>`;
        return;
    }
    
    // Check if there's an active test key
    if (user.test_key_expiry && user.test_key_expiry > Date.now()) {
        // Active test key - show the test key
        document.getElementById('test-key-display').textContent = user.current_test_key;
        document.getElementById('test-key-section').style.display = 'block';
        startTestKeyCountdown();
        trialCard.innerHTML = `<p style="color: #38a169; font-weight: bold; margin-bottom: 15px;"><i class="fas fa-check-circle"></i> ${t.trial_active}</p>`;
        return;
    }
    
    // Check if test key expired recently
    if (user.test_key_expiry && user.test_key_expiry <= Date.now()) {
        // Clear expired test key
        await window.localStorageDB.clearActiveTestKey(telegramId);
    }
    
    // Check if user has used all test keys
    if (user.test_keys_used >= window.MAX_TOTAL_TEST_KEYS) {
        // Show promotional message
        trialCard.innerHTML = `<p style="color: #ff6b6b; font-weight: bold; margin-bottom: 15px;">${t.trial_expired_message || 'All free tests used. Subscribe to continue using the service!'}</p>`;
        document.getElementById('test-key-section').style.display = 'none';
        return;
    }
    
    // Check if user needs referrals
    if (user.test_keys_used > 0 && user.invited_count < window.REFERRALS_NEEDED_FOR_TEST) {
        const remaining = window.REFERRALS_NEEDED_FOR_TEST - user.invited_count;
        trialCard.innerHTML = `
            <p style="color: #ffa500; font-weight: bold; margin-bottom: 10px;">${t.trial_referral_needed || 'Invite ' + remaining + ' more friends to get another free test!'}</p>
            <button class="btn btn-secondary nav-btn" data-target="referral"><i class="fas fa-users"></i> ${t.nav_referral}</button>
        `;
        document.getElementById('test-key-section').style.display = 'none';
        return;
    }
    
    // Show trial button
    trialCard.innerHTML = `<button class="btn btn-primary" id="start-trial-btn"><i class="fas fa-gift"></i> ${t.trial_btn}</button>`;
}

window.getTestKey = async () => {
    if (!window.localStorageDB) {
        showToast('Database not initialized', 'error');
        return;
    }
    
    try {
        let user = await window.localStorageDB.getUser(telegramId);
        
        // Check if user can get a new test key
        if (user) {
            const check = window.localStorageDB.canGetNewTest(user);
            if (!check.allowed) {
                if (check.reason === 'active_test') {
                    showToast(TRANSLATIONS[currentLang].trial_already_active || 'You already have an active test key!', 'error');
                    return;
                } else if (check.reason === 'max_used') {
                    showToast(TRANSLATIONS[currentLang].trial_all_used || 'You have used all free tests!', 'error');
                    return;
                } else if (check.reason === 'need_referrals') {
                    showToast(TRANSLATIONS[currentLang].trial_need_referrals || 'Invite more friends to get another test!', 'error');
                    return;
                }
            }
        }
        
        // Get test key from file
        const response = await fetch('test-keys.txt');
        const text = await response.text();
        const keys = text.split('\n').filter(k => k.trim());
        
        if (keys.length === 0) {
            showToast(TRANSLATIONS[currentLang].no_keys_available || 'No test keys available', 'error');
            return;
        }
        
        // Use a random key (for simplicity, just pick one)
        const selectedKey = keys[Math.floor(Math.random() * keys.length)];
        
        // Create or update user
        if (!user) {
            await window.localStorageDB.createUser(telegramId);
        }
        
        // Set active test key
        await window.localStorageDB.setActiveTestKey(telegramId, selectedKey);
        await window.localStorageDB.incrementTestKeysUsed(telegramId);
        
        // Display the key
        document.getElementById('test-key-display').textContent = selectedKey;
        document.getElementById('test-key-section').style.display = 'block';
        
        // Start countdown timer
        startTestKeyCountdown();
        
        // Update trial card
        updateTrialCard();
        
        showToast(TRANSLATIONS[currentLang].trial_success, 'success');
        
    } catch (error) {
        console.error('Error getting test key:', error);
        showToast('Error: ' + error.message, 'error');
    }
};

window.copyTestKey = async () => {
    const text = document.getElementById('test-key-display').textContent;
    if (!text || text === '...') {
        showToast(TRANSLATIONS[currentLang].loading || 'Loading...', 'error');
        return;
    }
    await copyText(text, TRANSLATIONS[currentLang].copied || 'Copied!');
};

window.toggleTestQrCode = () => {
    const testKey = document.getElementById('test-key-display').textContent;
    const qrDisplay = document.getElementById('test-qr-code-display');
    const qrPlaceholder = document.getElementById('test-qr-code-placeholder');
    const qrBtn = document.getElementById('toggle-test-qr-btn');
    const t = TRANSLATIONS[currentLang];

    if (qrDisplay.style.display === 'block') {
        qrDisplay.style.display = 'none';
        qrBtn.classList.remove('btn-primary');
        return;
    }

    if (!testKey || testKey === '...') {
        showToast(t.key_inactive || 'Key not available', 'error');
        return;
    }

    const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(testKey)}`;
    qrPlaceholder.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px; border: 4px solid #7b2cbf; display: block; margin: 0 auto; box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);">`;
    qrDisplay.style.display = 'block';
    qrBtn.classList.add('btn-primary');
};


