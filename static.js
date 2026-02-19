// --- Translations ---
const TRANSLATIONS = {
    ru: {
        test_key_title: "Ваш Тестовый Ключ",
        tagline: "Ваша приватность — наш приоритет",
        nav_profile: "Профиль", nav_billing: "Оплата", nav_setup: "Настройка", nav_referral: "Рефералка",
        title_status: "Ваш Статус и Ключ", balance_label: "Ваш Баланс:", status_label: "Текущий статус:",
        expiry_label: "Дата истечения:", loading: "Загрузка", loading_key: "Загрузка ключа...", copy_btn: "Копировать",
        title_trial: "Пробный Период", title_tariffs: "Тарифы и Оплата",
        payment_warning: "ВНИМАНИЕ: После оплаты вернитесь в чат с ботом. Активация — до 5 минут.",
        title_referral: "Реферальная Программа", invited_text: "Приглашено:",
        // ОБНОВЛЕННЫЙ ТЕКСТ РЕФЕРАЛКИ (Пункт 5)
        referral_desc: "Отправь ссылку другу. Когда он купит подписку — вы ОБА получите +10 дней бонусом!",
        title_setup: "Подключение", subtitle_download: "Скачать приложение", subtitle_instructions: "Инструкции",
        modal_title: "Оплата подписки", modal_warning: "ВНИМАНИЕ! После оплаты ОБЯЗАТЕЛЬНО вернитесь в чат с ботом.",
        modal_pay_btn: "Перейти к оплате", modal_close_btn: "Закрыть",
        status_active: "Активна", status_inactive: "Неактивна", status_expired: "Истекла",
        trial_btn: "Активировать 3 дня бесплатно", trial_used: "Пробный период использован",
        trial_already_active: "У вас уже есть активный тестовый ключ!",
        trial_all_used: "Вы использовали все бесплатные тесты!",
        trial_need_referrals: "Пригласите друзей, чтобы получить ещё один тест!",
        trial_referral_needed: "Пригласите ещё друзей для бесплатного теста!",
        trial_active: "Тестовый период активен",
        trial_expired_message: "Все бесплатные тесты использованы. Подпишитесь для продолжения!",
        month_1: "Мес.", month_few: "Мес.", month_many: "Мес.",
        key_active: "КЛЮЧ:", key_inactive: "Ключ появится после активации",
        renew_btn: "Продлить подписку",
        processing: "Обработка...",
        copied: "Скопировано!",
        link_copied: "Ссылка скопирована!",
        trial_success: "Пробный период активирован!",
        qr_btn: "QR-код", qr_title: "Сканируйте ключ", qr_note: "Используйте этот код в приложении для настройки."
    },
    en: {
        test_key_title: "Your Test Key",
        tagline: "Your privacy is our priority",
        nav_profile: "Profile", nav_billing: "Billing", nav_setup: "Setup", nav_referral: "Referral",
        title_status: "Your Status & Key", balance_label: "Your Balance:", status_label: "Current Status:",
        expiry_label: "Expiry Date:", loading: "Loading", loading_key: "Loading key...", copy_btn: "Copy",
        title_trial: "Trial Period", title_tariffs: "Tariffs & Payment",
        payment_warning: "ATTENTION: Return to the bot chat after payment. Activation takes up to 5 mins.",
        title_referral: "Referral Program", invited_text: "Invited:",
        referral_desc: "Invite friends — +10 days subscription for you and your friend!",
        title_setup: "Connection", subtitle_download: "Download App", subtitle_instructions: "Instructions",
        modal_title: "Subscription Payment", modal_warning: "ATTENTION! You MUST return to the bot chat after payment.",
        modal_pay_btn: "Proceed to Payment", modal_close_btn: "Close",
        status_active: "Active", status_inactive: "Inactive", status_expired: "Expired",
        trial_btn: "Activate 3 days for free", trial_used: "Trial period used",
        trial_already_active: "You already have an active test key!",
        trial_all_used: "You have used all free tests!",
        trial_need_referrals: "Invite more friends to get another test!",
        trial_referral_needed: "Invite more friends to get another free test!",
        trial_active: "Test period active",
        trial_expired_message: "All free tests used. Subscribe to continue using the service!",
        month_1: "month", month_few: "months", month_many: "months",
        key_active: "KEY:", key_inactive: "Key appears after activation",
        renew_btn: "Renew Subscription",
        processing: "Processing...",
        copied: "Copied!",
        link_copied: "Link copied!",
        trial_success: "Trial activated!",
        qr_btn: "QR Code", qr_title: "Scan the Key", qr_note: "Use this code in the app for setup."
    },
    // Можно добавить другие языки (de, fr) по аналогии
};

const DOWNLOAD_LINKS = {
    android: { name: 'Android', icon: 'fab fa-android', url: 'https://github.com/v2fly/v2rayNG/releases' },
    ios: { name: 'iOS (V2RayTun)', icon: 'fab fa-apple', url: 'https://apps.apple.com/app/v2raytun/id6444857502' },
    windows: { name: 'Windows (Hiddify)', icon: 'fab fa-windows', url: 'https://hiddify.com/download' },
    mac: { name: 'macOS', icon: 'fab fa-apple', url: 'https://github.com/v2rayA/v2rayA/releases' },
};

// --- Instruction Content ---
const INSTRUCTION_LINKS = {
    android: {
        name: 'Android',
        icon: 'fab fa-android',
        html: `
                    <h4>Настройка для Android (v2rayNG)</h4>
                    <ol>
                        <li>Скопируйте ваш ключ доступа на вкладке "Профиль".</li>
                        <li>Скачайте приложение нажатием на кнопку <b>Android</b> (кнопка выше).</li>
                        
                        <li>Откройте приложение и нажмите <b>+</b> (или иконку меню).</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/android/3.png" class="instruction-img" alt="Шаг 2">
                        
                        <li>Выберите "Импорт из буфера обмена".</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/android/4.png" class="instruction-img" alt="Шаг 3">
                        
                        <li>Нажмите кнопку <b>►</b> (подключиться) внизу.</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/android/5.png" class="instruction-img" alt="Шаг 5">
                    </ol>`
    },
    ios: {
        name: 'iOS',
        icon: 'fab fa-apple',
        html: `
                    <h4>Настройка для iPhone (V2RayTun)</h4>
                    <ol>
                        <li>Скопируйте ваш ключ доступа на вкладке "Профиль".</li>
                        
                        <li>Скачайте приложение нажатием на кнопку <b>IOS(V2RayTun)</b>.</li>
                        
                        <li>В правом верхнем углу приложения нажмите <b>+</b> .</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/iphone/3.png" class="instruction-img" alt="Шаг 3">

                        <li>Выберите "Добавить из буфера".</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/iphone/4.png" class="instruction-img" alt="Шаг 4">

                        <li>В центре нажмите на кнопку.</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/iphone/5.png" class="instruction-img" alt="Шаг 5">
                    </ol>`
    },
    windows: {
        name: 'Windows',
        icon: 'fab fa-windows',
        html: `
                    <h4>Настройка для Windows (Hiddify)</h4>
                    <ol>
                        <li>Скопируйте ваш ключ доступа на вкладке "Профиль".</li>
                        
                        <li>Скачайте приложение нажатием на кнопку и установите (кнопка выше) <b>Windows</b>.</li>
                        
                        <li>Откройте программу, нажмите "Новый профиль" или "+".</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/win/3.png" class="instruction-img" alt="Шаг 3">

                        <li>Выберите "Добавить из буфера обмена".</li>
                        
                        <img src="https://shinobubest.github.io/web/resources/win/4.png" class="instruction-img" alt="Шаг 4">

                        <li>Нажмите большую кнопку подключения по центру.</li>
                    </ol>`
    },
    androidtv: {
        name: 'Android TV',
        icon: 'fas fa-tv',
        html: `
                    <h4>Android TV</h4>
                    <ol>
                        <li>Скачайте приложение на Android(кнопка выше) и еще установите Send Files to TV из Google Play .</li>
                        <li>Откройте на андроид смартфоне "Проводник" или Файловый менеджер и найдите скачанный файл v2rayNG.apk и "скриншот QR-кода" и нажмите кнопку поделиться и из предложенного списка приложений найдите иконку приложения Send files to TV.</li>
                        <img src="https://shinobubest.github.io/web/resources/atv/2.png" class="instruction-img">
                        <li>На телевизоре запустите приложение Send Files to TV (приложение запросит разрешение на доступ к фото и видео - нажмите Разрешить).</li>
                        <li>На андроид смартфоне выберите вашу приставку, на телевизоре подтвердите скачивание и приложение отправится на Android TV.</li>
                        <img src="https://shinobubest.github.io/web/resources/atv/3.png" class="instruction-img">
                        <li>Теперь вы можете открыть Файловый менеджер (File Manager+) и в загрузках найдите приложение v2rayNG.apk, установите его и зайдите в приложение.</li>
                        <li>В правом верхнем углу приложения нажмите «+» → выберите пункт «Импорт из QR-кода».</li>
                        <img src="https://shinobubest.github.io/web/resources/atv/4.png" class="instruction-img">
                        <img src="https://shinobubest.github.io/web/resources/atv/5.png" class="instruction-img">
                        <li>Теперь вы должны нажать на иконку "Изображение" в правом верхнем углу.</li>
                        <img src="https://shinobubest.github.io/web/resources/atv/6.png" class="instruction-img">
                        <li>Внизу приложения нажмите «Запуск» и подтвердите разрешение на использование VPN-подключения.</li>
                        <img src="https://shinobubest.github.io/web/resources/atv/7.png" class="instruction-img">
                    </ol>`
    },
    faq: {
        name: 'FAQ',
        icon: 'fas fa-lightbulb',
        html: `
                    <h4>Частые вопросы</h4>
                    <p>Здесь будут ответы на частые вопросы.</p>`
    }
};

