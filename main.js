// === Configuration & State ===
let tg = null;
let telegramId = null;
let userId = null;
let currentLang = localStorage.getItem('lang') || 'fa';
let isProcessing = false;

// API Base URL - auto-detect or use relative path
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : '';

// Environment Variables - Read from window.env or use defaults
const ENV = {
    // These should be set via environment variables in production
    YOOMONEY_RECIPIENT_ID: window.env?.YOOMONEY_RECIPIENT_ID || '4100119271147598',
    BOT_USERNAME: window.env?.BOT_USERNAME || 'shinobu_vpn_bot',
    TRIAL_DAYS: 3,
    
    // Test mode - set via URL parameter ?test=1
    TEST_MODE: new URLSearchParams(window.location.search).get('test') === '1',
    
    // Debug: reset test keys via ?reset_test=1
    RESET_TEST: new URLSearchParams(window.location.search).get('reset_test') === '1'
};

// === API Helpers for PostgreSQL ===
window.api = {
    // Check test key eligibility from PostgreSQL
    async checkTestKeyEligibility(telegramId) {
        try {
            const res = await fetch(`${API_BASE}/api/test-keys?telegramId=${telegramId}`);
            return await res.json();
        } catch (e) {
            console.error('[API] Check test key error:', e);
            return { canGetNewTest: true, reason: null }; // Fallback to localStorage
        }
    },
    
    // Activate test key in PostgreSQL
    async activateTestKey(telegramId, testKeyIndex) {
        try {
            const res = await fetch(`${API_BASE}/api/test-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId, testKeyIndex })
            });
            return await res.json();
        } catch (e) {
            console.error('[API] Activate test key error:', e);
            return { success: true }; // Continue with localStorage
        }
    },
    
    // Get referral info from PostgreSQL
    async getReferralInfo(telegramId) {
        try {
            const res = await fetch(`${API_BASE}/api/referrals?telegramId=${telegramId}`);
            return await res.json();
        } catch (e) {
            console.error('[API] Get referral info error:', e);
            return { invitedCount: 0 };
        }
    },
    
    // Create referral in PostgreSQL
    async createReferral(referrerTelegramId, referredTelegramId, referralCode) {
        try {
            const res = await fetch(`${API_BASE}/api/referrals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ referrerTelegramId, referredTelegramId, referralCode })
            });
            return await res.json();
        } catch (e) {
            console.error('[API] Create referral error:', e);
            return { success: false };
        }
    }
};

// Tariffs Configuration
const TARIFFS = [
    { months: 1, price: 103.10 },
    { months: 2, price: 206.19 },
    { months: 3, price: 309.28 },
    { months: 6, price: 618.56 }
];

// Download Links
const DOWNLOAD_LINKS = {
    windows: {
        name: 'Windows',
        icon: 'fab fa-windows',
        url: 'https://github.com/2dust/v2rayN/releases/latest'
    },
    android: {
        name: 'Android',
        icon: 'fab fa-android',
        url: 'https://github.com/2dust/v2rayNG/releases/latest'
    },
    ios: {
        name: 'iOS',
        icon: 'fab fa-app-store-ios',
        url: 'https://apps.apple.com/app/v2box/id1642887082'
    },
    mac: {
        name: 'macOS',
        icon: 'fab fa-apple',
        url: 'https://github.com/2dust/v2rayN/releases/latest'
    },
    linux: {
        name: 'Linux',
        icon: 'fab fa-linux',
        url: 'https://github.com/2dust/v2rayN/releases/latest'
    }
};

// Instructions Content
const INSTRUCTION_LINKS = {
    windows: {
        name: 'ویندوز',
        icon: 'fab fa-windows',
        html: `
            <ol>
                <li>برنامه v2rayN را دانلود و نصب کنید</li>
                <li>برنامه را باز کنید و به Servers بروید</li>
                <li>Add VMess را بزنید</li>
                <li>کلید VPN خود را وارد کنید</li>
                <li>روی OK کلیک کنید</li>
                <li>در صفحه اصلی کلید Enter را بزنید</li>
            </ol>
        `
    },
    android: {
        name: 'اندروید',
        icon: 'fab fa-android',
        html: `
            <ol>
                <li>برنامه V2Box یا V2RayNG را نصب کنید</li>
                <li>برنامه را باز کنید</li>
                <li>دکمه + را بزنید</li>
                <li>Import from clipboard را انتخاب کنید</li>
                <li>کلید VPN را کپی کنید</li>
                <li>روی اتصال بزنید</li>
            </ol>
        `
    },
    ios: {
        name: 'آیفون',
        icon: 'fab fa-app-store-ios',
        html: `
            <ol>
                <li>برنامه V2Box را از App Store نصب کنید</li>
                <li>برنامه را باز کنید</li>
                <li>دکمه + را بزنید</li>
                <li>کلید VPN خود را وارد کنید</li>
                <li>روی تایید کلیک کنید</li>
                <li>به VPN متصل شوید</li>
            </ol>
        `
    },
    router: {
        name: 'روتر',
        icon: 'fas fa-router',
        html: `
            <ol>
                <li>به پنل روتر خود وصل شوید</li>
                <li>به بخش VPN Client بروید</li>
                <li>VLESS را انتخاب کنید</li>
                <li>کلید VPN را وارد کنید</li>
                <li>تنظیمات را ذخیره کنید</li>
            </ol>
        `
    }
};

// Translations
const TRANSLATIONS = {
    fa: {
        nav_profile: 'پروفایل',
        nav_subscription: 'اشتراک',
        nav_referral: 'رفرال',
        nav_downloads: 'دانلود',
        nav_instructions: 'راهنما',
        
        trial_title: 'نسخه رایگان',
        trial_description: '3 روز رایگان با تمام امکانات',
        trial_btn: 'دریافت نسخه رایگان',
        trial_success: 'نسخه رایگان فعال شد!',
        trial_used: 'نسخه رایگان استفاده شده',
        
        tariffs_title: 'خرید اشتراک',
        month_1: 'ماه',
        month_few: 'ماه',
        month_many: 'ماه',
        
        vpn_key: 'کلید VPN',
        key_active: 'فعال',
        key_inactive: 'غیرفعال',
        
        balance_label: 'موجودی کیف پول',
        
        status_active: 'فعال',
        status_inactive: 'غیرفعال',
        status_expired: 'منقضی',
        expiry_label: 'تاریخ انقضا',
        
        renew_subscription: 'تمدید اشتراک',
        
        referral_title: 'برنامه رفرال',
        referral_description: 'هر دوستی که دعوت کنید، 1 ماه اشتراک رایگان دریافت می‌کنید!',
        referrals_invited: 'دعوت شده‌ها',
        free_months: 'ماه رایگان',
        your_referral_link: 'لینک دعوت شما',
        copy_link: 'کپی لینک',
        link_copied: 'لینک کپی شد!',
        
        rules: 'قوانین',
        rule_1: 'دوست دعوت شده باید اشتراک بخرد',
        rule_2: '5 دعوت = 1 ماه رایگان',
        rule_3: 'بدون محدودیت در تعداد جوایز',
        
        download_apps: 'دانلود اپلیکیشن',
        
        setup_instructions: 'راهنمای نصب',
        
        copy: 'کپی',
        copied: 'کپی شد!',
        qr_code: 'QR',
        
        payment_confirmation: 'تایید پرداخت',
        payment_info: 'پس از پرداخت، اشتراک به صورت خودکار فعال می‌شود',
        go_to_payment: 'رفتن به پرداخت',
        
        processing: 'در حال پردازش...',
        loading: 'در حال بارگذاری...',
        
        error_no_telegram: 'لطفاً از طریق تلگرام وارد شوید',
        error_max_test_keys: 'تعداد تست‌های رایگان شما تمام شده',
        error_need_referrals: `برای دریافت تست رایگان جدید باید ${REFERRALS_NEEDED_FOR_TEST} نفر را دعوت کنید`,
        error_active_test: 'شما یک تست فعال دارید',
        error_payment: 'خطا در پرداخت'
    },
    en: {
        nav_profile: 'Profile',
        nav_subscription: 'Subscription',
        nav_referral: 'Referral',
        nav_downloads: 'Download',
        nav_instructions: 'Guide',
        
        trial_title: 'Free Trial',
        trial_description: '3 days free with all features',
        trial_btn: 'Get Free Trial',
        trial_success: 'Free trial activated!',
        trial_used: 'Free trial used',
        
        tariffs_title: 'Buy Subscription',
        month_1: 'month',
        month_few: 'months',
        month_many: 'months',
        
        vpn_key: 'VPN Key',
        key_active: 'Active',
        key_inactive: 'Inactive',
        
        balance_label: 'Wallet Balance',
        
        status_active: 'Active',
        status_inactive: 'Inactive',
        status_expired: 'Expired',
        expiry_label: 'Expiry Date',
        
        renew_subscription: 'Renew Subscription',
        
        referral_title: 'Referral Program',
        referral_description: 'Invite friends and get 1 month free!',
        referrals_invited: 'Invited',
        free_months: 'Free months',
        your_referral_link: 'Your referral link',
        copy_link: 'Copy Link',
        link_copied: 'Link copied!',
        
        rules: 'Rules',
        rule_1: 'Invited friend must buy a subscription',
        rule_2: '5 invites = 1 free month',
        rule_3: 'Unlimited rewards',
        
        download_apps: 'Download Apps',
        
        setup_instructions: 'Setup Guide',
        
        copy: 'Copy',
        copied: 'Copied!',
        qr_code: 'QR',
        
        payment_confirmation: 'Payment Confirmation',
        payment_info: 'Subscription will be activated automatically after payment',
        go_to_payment: 'Go to Payment',
        
        processing: 'Processing...',
        loading: 'Loading...',
        
        error_no_telegram: 'Please open in Telegram',
        error_max_test_keys: 'Your free tests are finished',
        error_need_referrals: `You need to invite ${REFERRALS_NEEDED_FOR_TEST} friends for a new free test`,
        error_active_test: 'You have an active test',
        error_payment: 'Payment error'
    },
    ru: {
        nav_profile: 'Профиль',
        nav_subscription: 'Подписка',
        nav_referral: 'Реферал',
        nav_downloads: 'Скачать',
        nav_instructions: 'Инструкция',
        
        trial_title: 'Бесплатный пробный',
        trial_description: '3 дня бесплатно со всеми функциями',
        trial_btn: 'Получить пробный',
        trial_success: 'Пробный активирован!',
        trial_used: 'Пробный использован',
        
        tariffs_title: 'Купить подписку',
        month_1: 'месяц',
        month_few: 'месяца',
        month_many: 'месяцев',
        
        vpn_key: 'VPN ключ',
        key_active: 'Активен',
        key_inactive: 'Неактивен',
        
        balance_label: 'Баланс кошелька',
        
        status_active: 'Активен',
        status_inactive: 'Неактивен',
        status_expired: 'Истёк',
        expiry_label: 'Срок действия',
        
        renew_subscription: 'Продлить подписку',
        
        referral_title: 'Реферальная программа',
        referral_description: 'Приглашайте друзей и получите 1 месяц бесплатно!',
        referrals_invited: 'Приглашено',
        free_months: 'Бесплатных месяцев',
        your_referral_link: 'Ваша реферальная ссылка',
        copy_link: 'Копировать ссылку',
        link_copied: 'Ссылка скопирована!',
        
        rules: 'Правила',
        rule_1: 'Приглашённый друг должен купить подписку',
        rule_2: '5 приглашений = 1 бесплатный месяц',
        rule_3: 'Безлимит на награды',
        
        download_apps: 'Скачать приложения',
        
        setup_instructions: 'Руководство по настройке',
        
        copy: 'Копировать',
        copied: 'Скопировано!',
        qr_code: 'QR',
        
        payment_confirmation: 'Подтверждение оплаты',
        payment_info: 'Подписка активируется автоматически после оплаты',
        go_to_payment: 'Перейти к оплате',
        
        processing: 'Обработка...',
        loading: 'Загрузка...',
        
        error_no_telegram: 'Пожалуйста, откройте в Telegram',
        error_max_test_keys: 'Ваши бесплатные тесты закончились',
        error_need_referrals: `Вам нужно пригласить ${REFERRALS_NEEDED_FOR_TEST} друзей для нового теста`,
        error_active_test: 'У вас есть активный тест',
        error_payment: 'Ошибка оплаты'
    },
    ar: {
        nav_profile: 'الملف الشخصي',
        nav_subscription: 'الاشتراك',
        nav_referral: 'الإحالة',
        nav_downloads: 'التحميل',
        nav_instructions: 'الدليل',
        
        trial_title: 'النسخة المجانية',
        trial_description: '3 أيام مجانية مع جميع الميزات',
        trial_btn: 'احصل على النسخة المجانية',
        trial_success: 'تم تفعيل النسخة المجانية!',
        trial_used: 'تم استخدام النسخة المجانية',
        
        tariffs_title: 'شراء الاشتراك',
        month_1: 'شهر',
        month_few: 'شهر',
        month_many: 'شهر',
        
        vpn_key: 'مفتاح VPN',
        key_active: 'نشط',
        key_inactive: 'غير نشط',
        
        balance_label: 'رصيد المحفظة',
        
        status_active: 'نشط',
        status_inactive: 'غير نشط',
        status_expired: 'منتهي الصلاحية',
        expiry_label: 'تاريخ الانتهاء',
        
        renew_subscription: 'تجديد الاشتراك',
        
        referral_title: 'برنامج الإحالة',
        referral_description: 'قم بدعوة الأصدقاء واحصل على شهر مجاني!',
        referrals_invited: 'المُحالون',
        free_months: 'أشهر مجانية',
        your_referral_link: 'رابط الإحالة الخاص بك',
        copy_link: 'نسخ الرابط',
        link_copied: 'تم نسخ الرابط!',
        
        rules: 'القواعد',
        rule_1: 'يجب على الصديق المُحال شراء اشتراك',
        rule_2: '5 إحالات = شهر مجاني',
        rule_3: 'مكافآت غير محدودة',
        
        download_apps: 'تحميل التطبيقات',
        
        setup_instructions: 'دليل الإعداد',
        
        copy: 'نسخ',
        copied: 'تم النسخ!',
        qr_code: 'QR',
        
        payment_confirmation: 'تأكيد الدفع',
        payment_info: 'سيتم تفعيل الاشتراك تلقائياً بعد الدفع',
        go_to_payment: 'انتقل إلى الدفع',
        
        processing: 'جاري المعالجة...',
        loading: 'جاري التحميل...',
        
        error_no_telegram: 'يرجى فتحه في تيليجرام',
        error_max_test_keys: 'انتهت اختباراتك المجانية',
        error_need_referrals: `تحتاج إلى دعوة ${REFERRALS_NEEDED_FOR_TEST} أصدقاء للحصول على اختبار مجاني جديد`,
        error_active_test: 'لديك اختبار نشط',
        error_payment: 'خطأ في الدفع'
    }
};

// Test Keys (for demo purposes - in production, these would come from an API)
const TEST_KEYS = [
    'vless://test-key-001@server1.example.com:443?encryption=none&security=tls&type=ws&host=server1.example.com&path=%2Fws#TestKey001',
    'vless://test-key-002@server1.example.com:443?encryption=none&security=tls&type=ws&host=server1.example.com&path=%2Fws#TestKey002',
    'vless://test-key-003@server1.example.com:443?encryption=none&security=tls&type=ws&host=server1.example.com&path=%2Fws#TestKey003'
];

// === Firestore Mock (localStorage-based) ===
window.firestore = {
    doc: () => ({}),
    
    getDoc: async () => {
        try {
            if (!telegramId) {
                return { exists: () => false, data: () => ({}) };
            }
            
            // Check URL for referral code
            const urlParams = new URLSearchParams(window.location.search);
            const startParam = urlParams.get('ref') || urlParams.get('start');
            
            // Extract referral code from start parameter (format: ref_SXXXXX)
            let referralCode = null;
            if (startParam && startParam.startsWith('ref_')) {
                referralCode = startParam.substring(4); // Remove 'ref_' prefix
            } else if (startParam) {
                referralCode = startParam;
            }
            
            const user = await window.localStorageDB.getUser(telegramId);
            
            if (!user) {
                // Create new user with referral code if present
                await window.localStorageDB.createUser(telegramId, referralCode);
                
                // Also create referral in PostgreSQL if valid code
                if (referralCode) {
                    // Get referrer's telegram ID from the referral code
                    const referrerUser = await window.localStorageDB.getUserByReferralCode(referralCode);
                    if (referrerUser) {
                        await window.api.createReferral(
                            referrerUser.telegram_id,
                            telegramId,
                            referralCode
                        );
                    }
                }
                return { 
                    exists: () => false, 
                    data: () => ({}) 
                };
            }
            
            // Get referral count from PostgreSQL
            const pgReferrals = await window.api.getReferralInfo(telegramId);
            const pgInvitedCount = pgReferrals?.invitedCount || 0;
            
            return { 
                exists: () => !!user, 
                data: () => ({
                    vless_key: user.vless_key,
                    subscription_expiry: user.subscription_expiry,
                    balance: user.balance,
                    trial_used: user.trial_used,
                    trial_expiry: user.trial_expiry,
                    invited_count: pgInvitedCount || user.invited_count, // Use PostgreSQL count
                    referral_code: user.referral_code,
                    status: user.status,
                    test_keys_used: user.test_keys_used,
                    current_test_key: user.current_test_key,
                    test_key_expiry: user.test_key_expiry
                })
            };
        } catch (error) {
            console.error('[Firestore] Get Error:', error);
            return { exists: () => false, data: () => ({}) };
        }
    },
    
    setDoc: async (ref, data, { merge } = {}) => {
        try {
            if (data.action === 'activate_trial' && isProcessing) return;
            
            if (!telegramId) return;
            
            const user = await window.localStorageDB.getUser(telegramId) || 
                await window.localStorageDB.createUser(telegramId);
            
            if (data.trial_used && data.status === 'active') {
                await window.localStorageDB.activateTrial(telegramId);
            } else if (data.vless_key && data.subscription_expiry) {
                await window.localStorageDB.updateUser(telegramId, {
                    vless_key: data.vless_key,
                    subscription_expiry: data.subscription_expiry,
                    status: 'active'
                });
            } else if (data.balance !== undefined) {
                await window.localStorageDB.updateBalance(telegramId, data.balance);
            } else if (data.invited_count !== undefined) {
                await window.localStorageDB.updateInvitedCount(telegramId, data.invited_count);
            } else {
                await window.localStorageDB.updateUser(telegramId, data);
            }
            
            window.dispatchEvent(new Event('db-update'));
        } catch (error) {
            console.error('[Firestore] Set Error:', error);
            showToast('خطا در ذخیره‌سازی', 'error');
            throw error;
        }
    },
    
    onSnapshot: (ref, callback) => {
        let isCancelled = false;
        
        const poll = async () => {
            if (isCancelled) return;
            try {
                const docSnap = await window.firestore.getDoc();
                callback(docSnap);
            } catch (e) {
                console.error('[Firestore] Poll error:', e);
            }
            if (!isCancelled) setTimeout(poll, 5000);
        };
        
        poll();
        
        const updateListener = () => { if (!isCancelled) poll(); };
        window.addEventListener('db-update', updateListener);
        
        return () => { 
            isCancelled = true; 
            window.removeEventListener('db-update', updateListener); 
        };
    }
};

// === Initialization ===
window.addEventListener('load', async () => {
    console.log('[App] Initializing...');
    
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();
        
        // Set Telegram colors
        tg.setHeaderColor('#1a1a2e');
        tg.setBackgroundColor('#1a1a2e');
    }
    
    // Initialize language
    updateLanguage(currentLang);
    
    // Get Telegram user info
    telegramId = tg?.initDataUnsafe?.user?.id || localStorage.getItem('shinobu_user_id') || null;
    
    if (!telegramId) {
        // Generate local user ID for development
        telegramId = 'local_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('shinobu_user_id', telegramId);
        console.log('[App] Using local user ID:', telegramId);
    } else {
        telegramId = String(telegramId);
    }
    
    // Get user info
    let userFirstName = 'کاربر';
    let userLastName = '';
    let userUsername = 'None';
    
    if (tg?.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        userFirstName = user.first_name || 'کاربر';
        userLastName = user.last_name || '';
        userUsername = user.username ? `@${user.username}` : 'None';
        
        // Update avatar
        const avatarPlaceholder = document.getElementById('user-avatar-placeholder');
        if (user.photo_url) {
            avatarPlaceholder.innerHTML = `<img src="${user.photo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            const initials = (userFirstName[0] + (userLastName ? userLastName[0] : '')).toUpperCase().trim();
            if (initials) avatarPlaceholder.textContent = initials;
        }
    }
    
    // Display user info
    document.getElementById('telegram-id-display').textContent = telegramId;
    document.getElementById('user-full-name').textContent = `${userFirstName} ${userLastName}`.trim();
    document.getElementById('username-display').textContent = userUsername;
    
    // Render UI components
    renderTariffs();
    renderDownloadButtons();
    renderInstructionButtons();
    generateReferralLink();
    
    // Start subscription listener
    window.startSubscriptionListener();
    
    // Initial render
    switchTab('profile');
    
    console.log('[App] Initialized');
});

// === Event Delegation ===
window.addEventListener('click', (e) => {
    const btn = e.target.closest("button, a");
    if (!btn) return;
    
    e.stopPropagation();
    if (btn.disabled || btn.classList.contains('disabled')) return;
    
    // Navigation
    if (btn.classList.contains('nav-btn')) {
        switchTab(btn.dataset.target);
        return;
    }
    
    // Special Navigation (Renew Button)
    if (btn.classList.contains('nav-btn-proxy')) {
        switchTab(btn.dataset.targetTab);
        return;
    }
    
    // Language Toggle
    if (btn.id === 'lang-toggle-btn') {
        const langs = ['fa', 'en', 'ru', 'ar'];
        let idx = langs.indexOf(currentLang);
        currentLang = langs[(idx + 1) % langs.length];
        updateLanguage(currentLang);
        return;
    }
    
    // Modal Controls
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
    
    // Accordion
    if (btn.classList.contains('accordion-btn')) {
        const contentId = btn.dataset.target;
        const content = document.getElementById(contentId);
        btn.classList.toggle('active');
        content.classList.toggle('open');
        return;
    }
    
    // === Protected Actions ===
    if (isProcessing) {
        showToast(TRANSLATIONS[currentLang].processing, 'info');
        return;
    }
    
    const lockAction = async (actionFn, loadingTextKey = 'processing') => {
        isProcessing = true;
        btn.classList.add('disabled');
        const originalContent = btn.innerHTML;
        const loadingText = TRANSLATIONS[currentLang][loadingTextKey] || '...';
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        
        try {
            await actionFn();
        } catch (err) {
            console.error('[Action] Error:', err);
        } finally {
            setTimeout(() => {
                isProcessing = false;
                btn.classList.remove('disabled');
                btn.innerHTML = originalContent;
            }, 1000);
        }
    };
    
    // Tariff Button
    if (btn.classList.contains('tariff-btn-delegate')) {
        const months = parseInt(btn.dataset.months);
        const price = parseFloat(btn.dataset.price);
        showPaymentModal(months, price);
        return;
    }
    
    // Trial Button
    if (btn.id === 'start-trial-btn') {
        lockAction(activateTrial, 'processing');
        return;
    }
    
    // Copy VPN Key
    if (btn.id === 'copy-vless-btn') {
        lockAction(copyVlessLink, 'processing');
        return;
    }
    
    // Toggle QR Code
    if (btn.id === 'toggle-qr-btn') {
        toggleQrCode();
        return;
    }
    
    // Copy Referral Link
    if (btn.id === 'copy-referral-btn') {
        lockAction(async () => {
            const link = document.getElementById('referral-link-display').textContent;
            await copyText(link, TRANSLATIONS[currentLang].link_copied);
        }, 'processing');
        return;
    }
});

// === Core Functions ===

function updateLanguage(lang) {
    localStorage.setItem('lang', lang);
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'rtl';
    document.querySelector('#lang-toggle-btn .lang-text').textContent = lang.toUpperCase();
    
    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (TRANSLATIONS[lang][key]) {
            el.textContent = TRANSLATIONS[lang][key];
        }
    });
    
    // Re-render dynamic content
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
    const t = TRANSLATIONS[currentLang];
    
    const comment = `Pay_${months}m_${telegramId}`;
    const yoomoneyUrl = `https://yoomoney.ru/quickpay/confirm.xml?receiver=${ENV.YOOMONEY_RECIPIENT_ID}&quickpay-form=shop&targets=Shinobu+${months}m&sum=${price.toFixed(2)}&comment=${encodeURIComponent(comment)}&paymentType=AC`;
    
    const monthLabel = months === 1 ? t.month_1 : (months < 5 ? t.month_few : t.month_many);
    
    document.getElementById('modal-tariff-info').innerHTML = `
        <p><strong>${t.month_1 === 'месяц' ? 'مدت' : 'Period'}:</strong> ${months} ${monthLabel}</p>
        <p><strong>${t.balance_label}:</strong> <span style="font-size: 1.2em; font-weight: bold;">${price.toFixed(2)} ₽</span></p>
        <p><strong>ID:</strong> ${telegramId}</p>
    `;
    
    document.getElementById('go-to-yoomoney-btn').dataset.url = yoomoneyUrl;
    document.getElementById('payment-modal').style.display = 'flex';
};

async function activateTrial() {
    const t = TRANSLATIONS[currentLang];
    
    if (!telegramId || telegramId.startsWith('local_')) {
        showToast(t.error_no_telegram, 'error');
        return;
    }
    
    // Check PostgreSQL for test key eligibility first
    const pgCheck = await window.api.checkTestKeyEligibility(telegramId);
    
    if (!pgCheck.canGetNewTest) {
        if (pgCheck.reason === 'max_used') {
            showToast(t.error_max_test_keys, 'error');
        } else if (pgCheck.reason === 'need_referrals') {
            showToast(t.error_need_referrals.replace('${REFERRALS_NEEDED_FOR_TEST}', pgCheck.referralsNeeded), 'error');
        } else if (pgCheck.reason === 'active_test') {
            showToast(t.error_active_test, 'error');
        }
        return;
    }
    
    // Get user from localStorage
    const user = await window.localStorageDB.getUser(telegramId);
    const canGet = window.localStorageDB.canGetNewTest(user);
    
    if (!canGet.allowed) {
        if (canGet.reason === 'max_used') {
            showToast(t.error_max_test_keys, 'error');
        } else if (canGet.reason === 'need_referrals') {
            showToast(t.error_need_referrals, 'error');
        } else if (canGet.reason === 'active_test') {
            showToast(t.error_active_test, 'error');
        }
        return;
    }
    
    // Get a test key
    const testKeyIndex = (user?.test_keys_used || 0) % TEST_KEYS.length;
    const testKey = TEST_KEYS[testKeyIndex];
    
    // Activate in PostgreSQL first
    await window.api.activateTestKey(telegramId, testKeyIndex);
    
    // Activate trial with test key in localStorage (for user profile)
    await window.localStorageDB.activateTrial(telegramId);
    await window.localStorageDB.setActiveTestKey(telegramId, testKey);
    await window.localStorageDB.incrementTestKeysUsed(telegramId);
    
    showToast(t.trial_success, 'success');
}

window.openLink = (url) => {
    if (tg?.openLink) {
        tg.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

async function copyText(text, msg) {
    if (!text || text.includes('...') || text === 'None') return;
    
    try {
        await navigator.clipboard.writeText(text);
        showToast(msg, 'success');
    } catch (err) {
        // Fallback
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(msg, 'success');
    }
}

async function copyVlessLink() {
    const text = document.getElementById('vless-link-display').textContent.replace(/.*: /, '').trim();
    const t = TRANSLATIONS[currentLang];
    
    if (text.includes('...') || text === 'None') {
        showToast(t.key_inactive, 'error');
        return;
    }
    
    await copyText(text, t.copied);
}

function toggleQrCode() {
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
    
    if (vlessLink.includes('...') || vlessLink === 'None') {
        showToast(t.key_inactive, 'error');
        return;
    }
    
    // Generate QR code
    try {
        qrPlaceholder.innerHTML = '';
        QRCode.toCanvas(vlessLink, { 
            width: 200,
            margin: 2,
            color: {
                dark: '#7b2cbf',
                light: '#ffffff'
            }
        }, (err, canvas) => {
            if (err) {
                console.error('QR Error:', err);
                return;
            }
            canvas.style.borderRadius = '8px';
            canvas.style.border = '4px solid #7b2cbf';
            canvas.style.boxShadow = '0 0 10px rgba(123, 44, 191, 0.5)';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            qrPlaceholder.appendChild(canvas);
        });
        
        qrDisplay.style.display = 'block';
        qrBtn.classList.add('btn-primary');
    } catch (e) {
        console.error('QR Generation error:', e);
    }
}

function generateReferralLink() {
    const link = `https://t.me/${ENV.BOT_USERNAME}?start=ref_${telegramId}`;
    document.getElementById('referral-link-display').textContent = link;
    
    // Also fetch referral count from PostgreSQL
    if (telegramId && !telegramId.startsWith('local_')) {
        window.api.getReferralInfo(telegramId).then(data => {
            if (data && data.invitedCount !== undefined) {
                const countEl = document.getElementById('referral-count');
                if (countEl) {
                    countEl.textContent = data.invitedCount;
                }
                // Check for unclaimed rewards
                if (data.unclaimedRewards > 0) {
                    showToast(`شما ${data.unclaimedRewards} ماه اشتراک رایگان دارید!`, 'success');
                }
            }
        }).catch(console.error);
    }
}

function renderTariffs() {
    const t = TRANSLATIONS[currentLang];
    const grid = document.getElementById('tariff-grid');
    
    grid.innerHTML = TARIFFS.map((tariff) => {
        const mLabel = tariff.months === 1 ? t.month_1 : (tariff.months < 5 ? t.month_few : t.month_many);
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

// === Subscription Listener ===
window.startSubscriptionListener = async function () {
    const indicator = document.getElementById('status-indicator');
    const info = document.getElementById('status-info');
    const vlessDisplay = document.getElementById('vless-link-display');
    const trialCard = document.getElementById('trial-card-status');
    const renewContainer = document.getElementById('renew-container');
    const qrBtn = document.getElementById('toggle-qr-btn');
    
    const handleSnapshot = async (docSnap) => {
        const data = docSnap.data();
        const t = TRANSLATIONS[currentLang];
        
        if (!data) {
            // User not found, show trial
            trialCard.innerHTML = `
                <button class="btn btn-primary" id="start-trial-btn">
                    <i class="fas fa-gift"></i>
                    <span data-i18n="trial_btn">${t.trial_btn}</span>
                </button>`;
            return;
        }
        
        const balance = data.balance ? parseFloat(data.balance).toFixed(2) : '0.00';
        document.getElementById('user-balance-display').textContent = `${balance} ₽`;
        
        // Calculate subscription status
        const expiryTime = Number(data.subscription_expiry) * 1000;
        const trialExpiryTime = Number(data.trial_expiry) * 1000;
        const now = Date.now();
        
        const hasSubscription = data.vless_key && data.subscription_expiry && expiryTime > now;
        const hasTrial = data.trial_used && data.trial_expiry && trialExpiryTime > now;
        const isActive = hasSubscription || hasTrial;
        
        const daysLeft = isActive ? Math.ceil((Math.max(expiryTime, trialExpiryTime) - now) / (1000 * 60 * 60 * 24)) : 0;
        
        // Show/hide renew button
        if (!isActive || daysLeft < 5) {
            renewContainer.style.display = 'block';
        } else {
            renewContainer.style.display = 'none';
        }
        
        // Update status indicator
        if (!data.vless_key && !data.trial_used) {
            indicator.textContent = t.status_inactive;
            indicator.className = 'status-indicator status-inactive';
            info.innerHTML = `<p>${t.expiry_label}: -</p>`;
            vlessDisplay.innerHTML = `<span style="color: #7b2cbf;">${t.key_inactive}</span>`;
            if (qrBtn) qrBtn.disabled = true;
        } else if (isActive) {
            const date = new Date(Math.max(expiryTime, trialExpiryTime));
            const formatted = date.toLocaleDateString(currentLang, { year: 'numeric', month: 'long', day: 'numeric' });
            
            if (daysLeft < 5) {
                indicator.textContent = `${t.status_active} (${daysLeft} روز)`;
                indicator.className = 'status-indicator status-warning';
            } else {
                indicator.textContent = t.status_active;
                indicator.className = 'status-indicator status-active';
            }
            
            info.innerHTML = `<p>${t.expiry_label}: <span id="expiry-date">${formatted}</span></p>`;
            const key = data.current_test_key || data.vless_key || 'N/A';
            vlessDisplay.innerHTML = `<strong>${t.key_active}:</strong> ${key}`;
            if (qrBtn) qrBtn.disabled = false;
        } else {
            indicator.textContent = t.status_expired;
            indicator.className = 'status-indicator status-inactive';
            info.innerHTML = `<p>${t.expiry_label}: ${t.status_expired}</p>`;
            const key = data.vless_key || 'N/A';
            vlessDisplay.innerHTML = `<strong>${t.key_active}:</strong> ${key}`;
            if (qrBtn) qrBtn.disabled = false;
        }
        
        // Update referral UI
        window.updateReferralUI(data.invited_count || 0);
        
        // Update trial card
        const user = await window.localStorageDB.getUser(telegramId);
        updateTrialCard(user);
    };
    
    window.firestore.onSnapshot(null, handleSnapshot);
};

// === Referral UI Update ===
window.updateReferralUI = function(invitedCount) {
    const referralCount = document.getElementById('referral-count');
    const rewardMonths = document.getElementById('reward-months');
    
    if (referralCount) referralCount.textContent = invitedCount;
    
    const freeMonths = window.localStorageDB.getFreeMonths(invitedCount);
    if (rewardMonths) rewardMonths.textContent = freeMonths;
};

function updateTrialCard(user) {
    const trialCard = document.getElementById('trial-card-status');
    const t = TRANSLATIONS[currentLang];
    
    if (!user) {
        trialCard.innerHTML = `
            <button class="btn btn-primary" id="start-trial-btn">
                <i class="fas fa-gift"></i>
                <span data-i18n="trial_btn">${t.trial_btn}</span>
            </button>`;
        return;
    }
    
    const canGet = window.localStorageDB.canGetNewTest(user);
    
    if (user.trial_used) {
        // Check if trial is still active
        if (user.trial_expiry && user.trial_expiry > Date.now()) {
            const daysLeft = Math.ceil((user.trial_expiry - Date.now()) / (1000 * 60 * 60 * 24));
            trialCard.innerHTML = `
                <p style="color: #38a169; font-weight: bold; margin-bottom: 15px;">
                    <i class="fas fa-check-circle"></i> ${t.trial_used} (${daysLeft} روز)
                </p>`;
        } else {
            trialCard.innerHTML = `
                <p style="color: #d69e2e; font-weight: bold; margin-bottom: 15px;">
                    <i class="fas fa-check-circle"></i> ${t.trial_used}
                </p>`;
        }
    } else if (!canGet.allowed) {
        // Show why they can't get a trial
        if (canGet.reason === 'max_used') {
            trialCard.innerHTML = `
                <p style="color: #e53e3e; font-weight: bold; margin-bottom: 15px;">
                    <i class="fas fa-times-circle"></i> ${t.error_max_test_keys}
                </p>`;
        } else if (canGet.reason === 'need_referrals') {
            trialCard.innerHTML = `
                <p style="color: #d69e2e; font-weight: bold; margin-bottom: 15px;">
                    <i class="fas fa-info-circle"></i> ${t.error_need_referrals}
                </p>
                <p style="font-size: 0.85rem; color: #a0a0a0;">
                    ${canGet.current || 0} / ${canGet.needed || REFERRALS_NEEDED_FOR_TEST} ${t.referrals_invited}
                </p>`;
        } else if (canGet.reason === 'active_test') {
            const daysLeft = Math.ceil((canGet.expiry - Date.now()) / (1000 * 60 * 60 * 24));
            trialCard.innerHTML = `
                <p style="color: #38a169; font-weight: bold; margin-bottom: 15px;">
                    <i class="fas fa-check-circle"></i> تست فعال (${daysLeft} روز)
                </p>`;
        }
    } else {
        trialCard.innerHTML = `
            <button class="btn btn-primary" id="start-trial-btn">
                <i class="fas fa-gift"></i>
                <span data-i18n="trial_btn">${t.trial_btn}</span>
            </button>`;
    }
}

// === Toast Notifications ===
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

console.log('[App] Main script loaded');
