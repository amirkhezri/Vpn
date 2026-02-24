// --- Configuration & State ---
let tg = null, telegramId = null, userId = null;
let currentLang = localStorage.getItem('lang') || 'ru';
let isProcessing = false; // Anti-spam lock

const YOOMONEY_RECIPIENT_ID = '4100119271147598';
const BOT_USERNAME = 'Toni_vpn_bot';
const TRIAL_DAYS = 3;
const getApiBase = () => {
    const saved = localStorage.getItem('shinobu_api_base');
    const defaultBase = `${window.location.origin}/api`;

    if (!saved) return defaultBase;

    const isLocalSaved = /localhost|127\.0\.0\.1/.test(saved);
    const isLocalHost = /localhost|127\.0\.0\.1/.test(window.location.hostname);

    return (isLocalSaved && !isLocalHost) ? defaultBase : saved;
};

let API_BASE = getApiBase();



const TARIFFS = [
    { months: 1, price: 103.10 },
    { months: 2, price: 206.19 },
    { months: 3, price: 309.28 },
    { months: 6, price: 618.56 }
];




// --- Firebase Mock ---
window.firestore = {
    doc: () => ({}),
    getDoc: async () => {
        
        try {
            const res = await fetch(`${API_BASE}/user/${userId}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            return { exists: () => !!data.vless_key || !!data.subscription_expiry, data: () => data };
        } catch (error) {
            console.error("API Error:", error);
            return { exists: () => false, data: () => ({}) };
        }
    },
setDoc: async (ref, data, { merge } = {}) => {
    if(!telegramId) return
        try {
            if (data.action === 'checkTrialStatus' && isProcessing) return;
           const res = await fetch(`${API_BASE}/trial/activate`,{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify({
    telegram_id: telegramId
   })
  })
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `HTTP error! status: ${res.status}`);

            window.dispatchEvent(new Event('db-update'));
            return data;
        }catch(e){

  console.log(e)
  showToast("Network error","error")
  throw e

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
    setTimeout(() => checkTrialStatus(), 500);
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
    } else if (btn.id === 'activate-trial') {
        lockAction(window.startTrial, 'processing');
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
    const result = await window.firestore.setDoc(null, { status: 'active' }, { merge: true });

    if (result?.status === 'activated') {
        showToast(TRANSLATIONS[currentLang].trial_success, 'success');
        return;
    }

    if (result?.status === 'no_keys') return showNoKeys();
    if (result?.status === 'referral') return showReferralMessage(result.need);
    if (result?.status === 'limit') return showLimitMessage();

    showToast('Trial activation failed', 'error');
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

        if (data.trial_used) {
            trialCard.innerHTML = `
                        <p style="color: #38a169; font-weight: bold; margin-bottom: 15px;"><i class="fas fa-check-circle"></i> ${t.trial_used}.</p>
                    `;
        } else {
            trialCard.innerHTML = `<button class="btn btn-primary" id="activate-trial"><i class="fas fa-gift"></i> ${t.trial_btn}</button>`;
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






// ===== TONI VPN TRIAL SYSTEM =====



function getTelegramId(){

 try{

  if (window.Telegram?.WebApp) {
   tg = window.Telegram.WebApp
   tg.ready()
  }

  if(tg.initDataUnsafe && tg.initDataUnsafe.user){

   telegramId = tg.initDataUnsafe.user.id

   console.log("Telegram ID:",telegramId)

  }

 }catch(e){

  console.log("telegram id error",e)

 }

}

getTelegramId()



const getTrialButton = () => document.querySelector("#activate-trial")
const getTrialContainer = () => document.querySelector("#trial-container")



async function checkTrialStatus(){

 if(!telegramId) return

 try{

  const res = await fetch(`${API_BASE}/trial/status?telegram_id=${encodeURIComponent(telegramId)}`)
  const data = await res.json()

  if(data.status==="active"){
   showActiveKey(data.key,data.expire)
  }

  if(data.status==="limit"){
   showLimitMessage()
  }

  if(data.status==="referral"){
   showReferralMessage(data.need)
  }

 }catch(e){
  console.log("status error")
 }

}



async function activateTrial(){

 if(!telegramId) return

 try{

  const res = await fetch(`${API_BASE}/trial/activate`,{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify({
    telegram_id: telegramId
   })
  })

  const data = await res.json()

  if(data.status==="activated"){
   showActiveKey(data.key,data.expire)
  }

  if(data.status==="no_keys"){
   showNoKeys()
  }

  if(data.status==="referral"){
   showReferralMessage(data.need)
  }

  if(data.status==="limit"){
   showLimitMessage()
  }

 }catch(e){
  console.log("activate error")
 }

}



function showActiveKey(key,expire){

    const trialButton = getTrialButton()
 const trialContainer = getTrialContainer()
 const testKeySection = document.getElementById("test-key-section")
 const trialCard = document.getElementById("trial-card-status")
 if(!trialContainer) return
    
 if(trialButton){
  trialButton.style.display="none"
 }

 if(trialCard){
  trialCard.innerHTML = '<p style="color:#38a169;font-weight:bold;"><i class="fas fa-check-circle"></i> Trial active</p>'
 }
    
 if(testKeySection){
  testKeySection.style.display = "block"
 }

 trialContainer.textContent = key

 startTimer(expire)

}



function startTimer(expire){

 const timer=document.getElementById("trial-timer")
if(!timer) return
    
 const interval=setInterval(()=>{

  const now=new Date().getTime()
  const end=new Date(expire).getTime()

  const distance=end-now

  if(distance<=0){

   clearInterval(interval)

   timer.innerHTML="Expired"

   location.reload()

   return
  }

  const days=Math.floor(distance/(1000*60*60*24))
  const hours=Math.floor((distance%(1000*60*60*24))/(1000*60*60))
  const minutes=Math.floor((distance%(1000*60*60))/(1000*60))

  timer.innerHTML=`${days}d ${hours}h ${minutes}m`

 },1000)

}



function showNoKeys(){

    const trialButton = getTrialButton()
    
 if(!trialButton) return

 trialButton.innerText="No free keys available"

 setTimeout(()=>{
  trialButton.innerText="Activate 3 Days For Free"
 },4000)

}



function showReferralMessage(need=5){

    const trialButton = getTrialButton()
 const trialContainer = getTrialContainer()
 if(!trialContainer) return
    
 if(!trialButton) return

 trialButton.style.display="none"

 const msg=document.createElement("div")

 msg.className="referral-required"

 msg.innerHTML=`
 Invite ${need} friends to get another free trial
 <button id="goto-referral">Referral</button>
 `

 trialContainer.appendChild(msg)

 const btn=document.getElementById("goto-referral")

 btn.onclick=()=>{
  document.querySelector("#referral")?.scrollIntoView()
 }

}



function showLimitMessage(){

    const trialButton = getTrialButton()
 const trialContainer = getTrialContainer()
 if(!trialContainer) return
    
 if(!trialButton) return

 trialButton.style.display="none"

 const msg=document.createElement("div")

 msg.className="trial-limit"

 msg.innerHTML="You used too many free trials. Please buy subscription."

 trialContainer.appendChild(msg)

}

