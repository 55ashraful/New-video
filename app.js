
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getDatabase, ref, onValue, set, get, update, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
    import { getAuth, signOut, onAuthStateChanged, signInAnonymously, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    import { firebaseConfig, IMGBB_API_KEY, TELEGRAM_SHARE } from './config.js';

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const auth = getAuth(app);

    let currentUser = null;
    let telegramProfileData = {};
    let adTimerInterval = null;
    let userAccessStatus = 'none';
    let pendingVideo = null;

    /* ✅ এড প্রগ্রেস localStorage-এ সেভ থাকবে */
    let videoAdProgress = JSON.parse(localStorage.getItem('videoAdProgress') || '{}');
    function saveProgress() {
      localStorage.setItem('videoAdProgress', JSON.stringify(videoAdProgress));
    }

    /* ✅ বাংলা সংখ্যায় কনভার্ট (১০, ৯, ৮...) */
    function toBn(num) {
      const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
      return String(num).split('').map(d => bn[+d] !== undefined ? bn[+d] : d).join('');
    }

    /* ✅ নতুন: ভাঙা ডেটা থেকে ক্র্যাশ বন্ধ করার হেল্পার */
    function safeText(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return '';
    }

    /* ✅✅ শেয়ার সিস্টেম — ভিডিও শেয়ার, লিঙ্ক কপি এবং শেয়ার করা লিঙ্কে ক্লিক করলে
       মিনি অ্যাপ খুলে সেই ভিডিওতেই আসা।
       শেয়ার লিঙ্ক (টেলিগ্রাম মিনি অ্যাপের সরাসরি ঠিকানা):
         https://t.me/<বট>/<অ্যাপ-সংক্ষেপ>?startapp=v_<ভিডিও আইডি>
         → লিঙ্কে ক্লিক করলেই মিনি অ্যাপ খুলে সরাসরি সেই ভিডিওতে ঢোকে — বটের
           প্রোফাইলে যায় না। বট/অ্যাপের নাম config.js-এর TELEGRAM_SHARE থেকে আসে। */
    let currentPlayingKey = null;
    let currentPlayingTitle = "";
    let sharedVideoKey = null;
    let videosHasData = false;   /* অন্তত একবার আসল ভিডিও ডেটা (খালি নয়) এসেছে */
    let premHasData = false;
    let authResolved = false;
    let deepLinkTried = false;

    function buildVideoShareLink(key) {
      /* শেয়ার লিঙ্ক = টেলিগ্রাম মিনি অ্যাপের সরাসরি ঠিকানা:
         https://t.me/secret0video_bot/t.me/premiumsecretvideo_bot/merahaihttpsnewvideoivoryte?startapp=v_<ভিডিও আইডি>
         ঠিকানার /<অ্যাপ-সংক্ষেপ> অংশটা না থাকলে টেলিগ্রাম লিঙ্কটাকে বটের চ্যাট হিসেবে
         খোলে — তাই এই অংশ কখনো বাদ দেওয়া যাবে না। নাম দুটো config.js-এর
         TELEGRAM_SHARE-এ লেখা এবং BotFather-এর অ্যাপ নামের সাথে হুবহু মিলতে হয়। */
      const bot = safeText(TELEGRAM_SHARE.botUsername).trim();
      const app = safeText(TELEGRAM_SHARE.appShortName).trim();
      if (bot && app) {
        return 'https://t.me/' + bot + '/' + app + '?startapp=v_' + String(key);
      }
      /* ফলব্যাক: কনফিগ খালি হলে সাইটের নিজের ঠিকানা + ?v=<ভিডিও আইডি> — অ্যাপ এটাও চেনে */
      const origin = String(location.origin || '');
      return origin + '/?v=' + encodeURIComponent(String(key));
    }

    function showToast(msg) {
      const t = document.getElementById('toastBox');
      if (!t) return;
      t.innerText = msg;
      t.classList.add('show');
      clearTimeout(showToast._timer);
      showToast._timer = setTimeout(() => t.classList.remove('show'), 2400);
    }

    function copyTextToClipboard(text) {
      const fallbackCopy = (t) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = t;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch (e) { return false; }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
      }
      return Promise.resolve(fallbackCopy(text));
    }

    function titleForShare(key) {
      const it = (allVideos && allVideos[key]) || (premiumVideos && premiumVideos[key]);
      return (it && it.title) || currentPlayingTitle || 'Secret Video Smoky 🎬';
    }

    window.shareVideo = async (ev, key) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      if (!key) key = currentPlayingKey;
      const url = key ? buildVideoShareLink(key) : location.origin;
      const title = key ? titleForShare(key) : 'Secret Video Smoky 🎬';
      const text = '🎬 ' + title + '\n\n👇 ভিডিওটি দেখতে নিচের লিঙ্কে ক্লিক করুন\n' + url;

      /* ১ম পছন্দ: ভিডিওর থাম্বনেইল ছবি হিসেবে শেয়ার — টেলিগ্রামে চ্যাটেই সেই ভিডিওর
         ফটো দেখাবে (লিঙ্ক ক্যাপশনে থাকে)। সাইটের লোগো/বটের ফটো আসার সুযোগই থাকে না। */
      const file = await getShareImageFile(key);
      if (file && canShareFiles(file)) {
        try {
          await navigator.share({ files: [file], text: text });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return; /* ইউজার বাতিল করলে */
        }
      }

      /* ২য়: মিনি অ্যাপ লিঙ্ক শেয়ার — t.me লিঙ্ক টেলিগ্রামের যেকোনো চ্যাটে কাজ করে,
         ক্লিক করলেই মিনি অ্যাপ খুলে সরাসরি ওই ভিডিওতে ঢোকে */
      if (navigator.share) {
        try {
          await navigator.share({ title: title, text: '🎬 ' + title + '\n\n👇 ভিডিওটি দেখতে নিচের লিঙ্কে ক্লিক করুন', url: url });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }

      /* ৩য়: লিঙ্ক কপি */
      copyTextToClipboard(url).then(ok => showToast(ok ? 'লিঙ্ক কপি হয়েছে ✅ এখন বন্ধুদের কাছে পাঠিয়ে দিন' : 'কপি করা যায়নি!'));
    };

    /* ভিডিওর থাম্বনেইল ছবি ফাইল হিসেবে আনা। ImgBB/YouTube ইত্যাদির কোনো CORS
       অনুমতি নেই, তাই ফ্রি প্রক্সি images.weserv.nl দিয়ে আনা হয়। */
    function getShareImageFile(key) {
      try {
        const it = (allVideos && allVideos[key]) || (premiumVideos && premiumVideos[key]);
        if (!it) return Promise.resolve(null);
        const thumb = String(autoGetThumbnail(it, it.videoUrl) || '').trim();
        if (thumb.indexOf('http') !== 0) return Promise.resolve(null);

        const proxied = 'https://images.weserv.nl/?url=' + encodeURIComponent(thumb.replace(/^https?:\/\//, '')) + '&w=640&output=jpg';
        const opt = { mode: 'cors' };
        if (window.AbortSignal && AbortSignal.timeout) opt.signal = AbortSignal.timeout(7000);
        return fetch(proxied, opt)
          .then(r => { if (!r.ok) return null; return r.blob(); })
          .then(blob => {
            if (!blob || !blob.size || blob.size < 100) return null;
            return new File([blob], 'video.jpg', { type: blob.type || 'image/jpeg' });
          })
          .catch(() => null);
      } catch (e) { return Promise.resolve(null); }
    }

    function canShareFiles(file) {
      try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); }
      catch (e) { return false; }
    }

    window.copyVideoLink = (ev, key) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      if (!key) key = currentPlayingKey;
      const url = key ? buildVideoShareLink(key) : location.origin;
      copyTextToClipboard(url).then(ok => showToast(ok ? 'লিঙ্ক কপি হয়েছে ✅' : 'কপি করা যায়নি!'));
    };

    window.shareModalVideo = () => {
      if (currentPlayingKey) { window.shareVideo(null, currentPlayingKey); return; }
      copyTextToClipboard(location.origin).then(ok => showToast(ok ? 'লিঙ্ক কপি হয়েছে ✅' : 'কপি করা যায়নি!'));
    };

    function parseSharedKey() {
      try {
        /* শেয়ার করা লিঙ্কে ভিডিওর আইডি যেসব নামে আসতে পারে:
           ?v=<key>                 — সাইটের নিজের লিঙ্ক (ব্রাউজার/ইন-অ্যাপ ব্রাউজার)
           ?startapp=<key>          — t.me লিঙ্কের মূল প্যারামিটার
           ?tgWebAppStartParam=...  — টেলিগ্রাম মিনি অ্যাপ খুললে URL-এ যোগ করে
           #tgWebAppStartParam=...  — কিছু টেলিগ্রাম ক্লায়েন্ট hash-এ পাঠায়
           initDataUnsafe.start_param — Telegram WebApp SDK থেকে */
        const names = ['v', 'tgWebAppStartParam', 'startapp', 'start_param'];
        const grab = (params) => {
          for (const n of names) {
            const val = params.get(n);
            if (val) return val;
          }
          return "";
        };
        let raw = "";
        try { raw = grab(new URLSearchParams(window.location.search)); } catch (e) {}
        if (!raw && window.location.hash && window.location.hash.length > 1) {
          try { raw = grab(new URLSearchParams(window.location.hash.slice(1))); } catch (e) {}
        }
        if (!raw && window.Telegram && window.Telegram.WebApp) {
          const du = window.Telegram.WebApp.initDataUnsafe;
          raw = (du && du.start_param) || "";
        }
        if (raw && String(raw).indexOf('%') !== -1) {
          try { raw = decodeURIComponent(String(raw)); } catch (e) {}
        }
        raw = String(raw || '').trim();
        if (!raw) return null;
        if (raw.slice(0, 2) === 'v_') raw = raw.slice(2);
        if (/^[A-Za-z0-9_-]{1,64}$/.test(raw)) return raw;
        return null;
      } catch (e) { return null; }
    }

    /* সাইটের লোগো-স্ক্রিন (preloader) সাথে সাথে সরানো — শেয়ার করা লিঙ্ক থেকে খুললে
       ২.৫ সেকেন্ড লোগো দেখিয়ে সময় না নষ্ট করে সরাসরি ভিডিওর থাম্বনেইল/প্লেয়ার
       দেখানো হয়। html ট্যাগে deeplink-open ক্লাস দিলে CSS-ও লোগো লুকিয়ে রাখে। */
    function hidePreloaderNow() {
      try {
        document.documentElement.classList.add('deeplink-open');
        const p = document.getElementById('preloader');
        if (p) p.classList.add('preloader-hidden');
      } catch (e) {}
    }

    function maybeOpenSharedVideo() {
      if (deepLinkTried || !sharedVideoKey) return;
      const key = sharedVideoKey;
      /* লিঙ্ক থেকে খোলা হয়েছে — লোগো নয়, ভিডিওর থাম্বনেইল দেখাবে */
      hidePreloaderNow();

      if (allVideos[key]) {
        deepLinkTried = true; sharedVideoKey = null;
        handleNormalVideoClick(key, allVideos[key]);
        return;
      }
      if (premiumVideos[key]) {
        if (!authResolved) return; /* লগইন যাচাইয়ের ফল আসা পর্যন্ত অপেক্ষা */
        deepLinkTried = true; sharedVideoKey = null;
        handlePremiumVideoClick(key, premiumVideos[key]);
        return;
      }
      /* দুই তালিকাতেই আসল ডেটা এসে গেছে, অথচ ভিডিওটি নেই */
      if (videosHasData && premHasData) {
        deepLinkTried = true; sharedVideoKey = null;
        showToast('শেয়ার করা ভিডিওটি পাওয়া যায়নি');
      }
    }
    sharedVideoKey = parseSharedKey();
    if (sharedVideoKey) hidePreloaderNow();
    /* কিছু টেলিগ্রাম ক্লায়েন্টে Telegram WebApp SDK/প্যারামিটার দেরিতে আসে —
       পেজ লোড শেষে ও এক সেকেন্ড পরে আরেকবার চেষ্টা করি */
    const reparseDeepLink = () => {
      if (!sharedVideoKey) {
        sharedVideoKey = parseSharedKey();
        if (sharedVideoKey) hidePreloaderNow();
        maybeOpenSharedVideo();
      }
    };
    window.addEventListener('load', reparseDeepLink);
    setTimeout(reparseDeepLink, 1200);


    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      authResolved = true;
      telegramProfileData = {};
      updateProfileUI();
      if (user) {
        try {
          const profileSnap = await get(ref(db, `users/${user.uid}`));
          telegramProfileData = profileSnap.val() || {};
        } catch (error) {
          console.warn('Telegram profile read failed:', error);
        }
        checkUserAccessStatus();
      } else {
        userAccessStatus = 'none';
        renderVideos();
        maybeOpenSharedVideo();
      }
    });

    function checkUserAccessStatus() {
      if (!currentUser) return;
      onValue(ref(db, `accessRequests/${currentUser.uid}`), (snapshot) => {
        if (snapshot.exists()) {
          userAccessStatus = snapshot.val().status || 'pending';
        } else {
          userAccessStatus = 'none';
        }
        renderVideos();
        maybeOpenSharedVideo();
      });
    }

    let adUrlData = "";
    let adInterval = 0;
    let nativeAdCodeData = "";
    let timerBannerCode = "";
    let allVideos = {};
    let premiumVideos = {};
    let categoriesList = [];
    let categoriesByKey = {};
    let selectedCat = "All";
    let searchQuery = "";
    let autoSlideTimer = null;
    let currentTab = "home"; 
    let pinnedVideos = JSON.parse(localStorage.getItem('pinnedVideos') || '[]');

    /* ✅ একসাথে ৬০টা ভিডিও দেখাবে — প্রতি ক্যাটাগরিতে ৫০+ ভিডিও পুরোপুরি দেখা যাবে */
    let homeRenderLimit = 60;
    let premRenderLimit = 60;

    let videosReadError = "";
    let premiumReadError = "";

    // Read Admin Ad Configuration
    onValue(ref(db, 'settings/adConfig'), (snapshot) => {
      const config = snapshot.val();
      if (config) {
        adUrlData = config.adUrl || "";
        adInterval = config.adInterval !== undefined ? parseInt(config.adInterval) : 0;
        nativeAdCodeData = config.nativeAdCode || "";

        timerBannerCode = config.timerBannerImg || config.timerBannerCode || config.bottomBannerCode || config.topBannerCode || nativeAdCodeData || "";

        if (config.topBannerCode) renderAnyAd('topAdBox', config.topBannerCode);
        if (config.bottomBannerCode) renderAnyAd('bottomAdBox', config.bottomBannerCode, 'auto');
        if (config.popupAdCode) injectAdsterraScript(config.popupAdCode, 'popunderAdContainer');
        if (config.socialBarAdCode) injectAdsterraScript(config.socialBarAdCode, 'socialBarAdContainer');
      }
    });

    document.addEventListener('click', function(e) {
      if (!adUrlData || adInterval <= 0) return;
      
      if (e.target.closest('.close-modal, input, textarea, select, button, a')) return;

      const lastClickAdTime = localStorage.getItem('lastClickAdTime') || 0;
      const now = Date.now();

      const intervalMs = adInterval * 60 * 1000;
      if (now - lastClickAdTime >= intervalMs) {
        let targetUrl = adUrlData.trim();
        if (targetUrl.includes("src=")) {
          const match = targetUrl.match(/src=["']([^"']+)["']/);
          if (match && match[1]) targetUrl = match[1];
        }
        if (targetUrl) {
          window.open(targetUrl, '_blank');
          localStorage.setItem('lastClickAdTime', now);
        }
      }
    }, true);

    function injectAdsterraScript(scriptCode, containerId) {
      if (!scriptCode) return;
      try {
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div');
          container.id = containerId;
          document.body.appendChild(container);
        }
        container.innerHTML = "";
        
        const range = document.createRange();
        range.selectNode(container);
        const documentFragment = range.createContextualFragment(scriptCode);
        container.appendChild(documentFragment);
      } catch (e) { console.error("Ad script error:", e); }
    }

    /* ✅ boxHeight দিলে সেই সাইজের বক্সে অ্যাড বসবে — bottomAdBox (৯০px) এর ভেতরে সাদা ফাঁক থাকবে না */
    /* ✅ boxHeight='auto' হলে ব্যানারের আসল উচ্চতা মেপে বক্স ঠিক ততটাই হবে — নিচের অ্যাডে ফাঁকা সাদা জায়গা থাকবে না, ব্যানার নেভবারের গায়ে লেগে থাকবে */
    function renderAnyAd(containerId, rawCode, boxHeight) {
      const container = document.getElementById(containerId);
      if (!container || !rawCode) return;
      container.innerHTML = "";

      const autoFit = boxHeight === 'auto';
      const boxH = autoFit ? 0 : (parseInt(boxHeight) > 0 ? parseInt(boxHeight) : 180);
      const imgH = autoFit ? 0 : Math.max(boxH - 20, 40);

      if (rawCode.startsWith("http://") || rawCode.startsWith("https://")) {
        const a = document.createElement('a');
        a.href = rawCode;
        a.target = "_blank";
        a.innerHTML = "<span style='color:#e50914; font-size:11px; font-weight:bold;'>Click Here To Watch Ad</span>";
        container.appendChild(a);
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.width = '100%';
        iframe.style.height = autoFit ? '90px' : boxH + 'px';
        iframe.style.overflow = 'hidden';
        iframe.scrolling = 'no';

        iframe.srcdoc = autoFit
          ? `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;overflow:hidden;background:transparent}body{line-height:0}img{display:block;width:100%!important;height:auto!important;max-width:100%!important}iframe{width:100%!important;border:0}</style></head><body>${rawCode}</body></html>`
          : `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;height:${boxH}px;overflow:hidden;background:transparent}body{display:flex;justify-content:center;align-items:center}img{display:block;width:100%!important;max-width:100%!important;height:${imgH}px!important;object-fit:contain}iframe{width:100%!important;height:${boxH}px!important;border:0}</style></head><body>${rawCode}</body></html>`;

        if (autoFit) {
          /* ব্যানার লোড হওয়ার পরে ভেতরের আসল উচ্চতা মেপে iframe-এর হাইট ঠিক করা */
          const fitToContent = () => {
            try {
              const doc = iframe.contentDocument;
              if (!doc || !doc.body) return;
              /* body.scrollHeight = আসল কনটেন্ট হাইট (ছোট হলে ছোট, বড় হলে বড় দেয়); documentElement ভিউপোর্ট হাইট দেয় বলে সেটা fallback হিসেবেই শুধু */
              let h = doc.body.scrollHeight;
              if (h < 20 && doc.documentElement) h = doc.documentElement.scrollHeight;
              if (h >= 20 && h <= 120) iframe.style.height = h + 'px';
            } catch (e) {}
          };
          iframe.addEventListener('load', () => {
            fitToContent();
            try {
              iframe.contentDocument.querySelectorAll('img').forEach(im => im.addEventListener('load', fitToContent));
            } catch (e) {}
            setTimeout(fitToContent, 800);
            setTimeout(fitToContent, 2500);
          });
        }

        container.appendChild(iframe);
      }
    }

    /* ✅ নতুন: ক্যাটাগরি নাম মিলানোর হেল্পার — অ্যাডমিন যেভাবেই লিখুক না কেন,
       ফাঁকা স্পেস / বড়-ছোট হাতের অক্ষর / নামের বদলে আইডি — সব ক্ষেত্রেই ম্যাচ করবে */
    function normCat(s) {
      return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
    function resolveCategoryName(raw) {
      const t = String(raw || '').trim();
      if (!t) return '';
      if (categoriesList.includes(t)) return t;
      const n = normCat(t);
      const byName = categoriesList.find(c => normCat(c) === n);
      if (byName) return byName;
      if (categoriesByKey[t]) return categoriesByKey[t];
      const byKey = Object.keys(categoriesByKey).find(k => normCat(k) === n);
      if (byKey) return categoriesByKey[byKey];
      return t;
    }

    onValue(ref(db, 'categories'), (snapshot) => {
      categoriesList = [];
      categoriesByKey = {};
      const data = snapshot.val();
      if (data) {
        Object.keys(data).forEach(key => {
          const v = data[key];
          /* অ্যাডমিন প্যানেল {id: {name: 'X'}} বা {id: 'X'} — দুই ফরম্যাটেই পড়া যাবে */
          const name = typeof v === 'string' ? v : safeText(v && (v.name || v.title));
          if (!name) return;
          categoriesList.push(name);
          categoriesByKey[key] = name;
        });
      }
      renderCategoryBar();
      /* ক্যাটাগরি ভিডিওর পরে লোড হলেও ফিল্টার ঠিকভাবে কাজ করার জন্য আবার রেন্ডার */
      if (currentTab === 'home') renderVideos();
    });

    /* ✅✅ ফিক্স: ভাঙা ডেটা বাদ দিয়ে নিরাপদে ভিডিও লোড */
    onValue(ref(db, 'videos'), (snapshot) => {
      videosReadError = "";
      const raw = snapshot.val() || {};
      allVideos = {};
      Object.keys(raw).forEach(k => {
        const it = raw[k];
        if (!it || typeof it !== 'object') return;
        it.title = safeText(it.title) || "Untitled";
        it.category = safeText(it.category) || safeText(it.cat) || safeText(it.categoryName);
        it.videoUrl = safeText(it.videoUrl);
        it.imgUrl = safeText(it.imgUrl);
        it.posterUrl = safeText(it.posterUrl);
        it.thumbnailUrl = safeText(it.thumbnailUrl);
        it.adUrl = safeText(it.adUrl);
        if (it.adLimit !== undefined) it.adLimit = parseInt(it.adLimit) || 0;
        allVideos[k] = it;
      });
      updateVideoCounts();
      renderCategoryBar();
      renderVideos();
      videosHasData = Object.keys(allVideos).length > 0;
      maybeOpenSharedVideo();
    }, (error) => {
      videosReadError = error.message;
      renderVideos();
    });

    onValue(ref(db, 'premiumVideos'), (snapshot) => {
      premiumReadError = "";
      const raw = snapshot.val() || {};
      premiumVideos = {};
      Object.keys(raw).forEach(k => {
        const it = raw[k];
        if (!it || typeof it !== 'object') return;
        it.title = safeText(it.title) || "Untitled";
        it.category = safeText(it.category) || safeText(it.cat) || safeText(it.categoryName);
        it.videoUrl = safeText(it.videoUrl);
        it.imgUrl = safeText(it.imgUrl);
        it.posterUrl = safeText(it.posterUrl);
        it.thumbnailUrl = safeText(it.thumbnailUrl);
        it.adUrl = safeText(it.adUrl);
        if (it.adLimit !== undefined) it.adLimit = parseInt(it.adLimit) || 0;
        premiumVideos[k] = it;
      });
      updateVideoCounts();
      if (currentTab === 'trending') renderVideos();
      premHasData = Object.keys(premiumVideos).length > 0;
      maybeOpenSharedVideo();
    }, (error) => {
      premiumReadError = error.message;
      if (currentTab === 'trending') renderVideos();
    });

    /* ✅ ৩০০+/২০০+ কাউন্ট */
    function updateVideoCounts() {
      const nEl = document.getElementById('normalVideoCount');
      const pEl = document.getElementById('premiumVideoCount');
      if (nEl) nEl.innerText = Math.max(300, Object.keys(allVideos).length);
      if (pEl) pEl.innerText = Math.max(200, Object.keys(premiumVideos).length);
    }

    function renderCategoryBar() {
      const catBar = document.getElementById('catBar');
      if (!catBar) return;
      catBar.innerHTML = "";

      const allBtn = document.createElement('button');
      allBtn.className = `cat-btn ${selectedCat === 'All' ? 'active' : ''}`;
      allBtn.innerText = "All";
      allBtn.onclick = () => filterCat('All', allBtn);
      catBar.appendChild(allBtn);

      categoriesList.forEach(catName => {
        const btn = document.createElement('button');
        btn.className = `cat-btn ${selectedCat === catName ? 'active' : ''}`;
        btn.innerText = catName;
        btn.onclick = () => filterCat(catName, btn);
        catBar.appendChild(btn);
      });
    }

    window.filterCat = (catName, btnElement) => {
      selectedCat = catName;
      homeRenderLimit = 60;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btnElement.classList.add('active');
      renderVideos();
    };

    onValue(ref(db, 'heroBanners'), (snapshot) => {
      const heroSlider = document.getElementById('heroSlider');
      heroSlider.innerHTML = "";
      const data = snapshot.val();
      if (data) {
        const banners = Object.values(data);
        banners.forEach(b => {
          const div = document.createElement('div');
          div.className = 'hero-banner';
          div.style.backgroundImage = `url('${safeText(b.imgUrl)}')`;
          
          div.onclick = () => {
            if (b.videoUrl) {
              handleNormalVideoClick(b.videoUrl, b.title || 'Banner Video');
            } else if (b.linkUrl) {
              window.open(b.linkUrl, '_blank');
            }
          };

          div.innerHTML = `
            <div class="hero-content">
              <span class="hero-badge">FEATURED</span>
              <h2 class="hero-title">${safeText(b.title)}</h2>
              <div class="hero-desc">${safeText(b.desc)}</div>
              <button class="btn-play"><i class="fa-solid fa-play"></i> Watch Now</button>
            </div>
          `;
          heroSlider.appendChild(div);
        });

        startAutoSlider(heroSlider, banners.length);
      } else {
        heroSlider.style.display = 'none';
      }
    });

    function startAutoSlider(slider, total) {
      if (autoSlideTimer) clearInterval(autoSlideTimer);
      if (total <= 1) return;

      let currentIndex = 0;
      autoSlideTimer = setInterval(() => {
        currentIndex = (currentIndex + 1) % total;
        const bannerWidth = slider.clientWidth;
        slider.scrollTo({
          left: bannerWidth * currentIndex,
          behavior: 'smooth'
        });
      }, 3500);
    }

    window.togglePin = (e, videoId) => {
      e.stopPropagation();
      const index = pinnedVideos.indexOf(videoId);
      if (index > -1) {
        pinnedVideos.splice(index, 1);
      } else {
        pinnedVideos.push(videoId);
      }
      localStorage.setItem('pinnedVideos', JSON.stringify(pinnedVideos));
      renderVideos();
    };

    function createErrorBox(msg) {
      const box = document.createElement('div');
      box.className = 'db-error-box';
      box.innerHTML = `<b>⚠️ ডেটাবেস সমস্যা:</b> ${msg}`;
      return box;
    }

    /* ✅✅ সোশ্যাল মিডিয়া লিংককে embed লিংকে অটো রূপান্তর */
    function convertToEmbedUrl(rawUrl) {
      let url = String(rawUrl).trim();

     /* ✅ এডমিন প্যানেল থেকে আসা রেডি embed লিংক আর কনভার্ট হবে না (ফেসবুক "Video unavailable" ফিক্স) */
      if (url.includes('facebook.com/plugins/') || url.includes('tiktok.com/embed/') || url.includes('dailymotion.com/embed/') || url.includes('ok.ru/videoembed/') || url.includes('player.vimeo.com/') || url.includes('streamable.com/e/') || url.includes('drive.google.com')) return url;

      // YouTube
      let m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (m) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0';

      // Facebook
      if (url.includes('facebook.com') || url.includes('fb.watch')) {
        let fm = url.match(/facebook\.com\/watch\/?\?v=(\d+)/);
        if (!fm) fm = url.match(/facebook\.com\/[^\/]+\/videos\/(?:[^\/]+\/)?(\d+)/);
        if (!fm) fm = url.match(/facebook\.com\/reel\/(\d+)/);
        if (!fm) fm = url.match(/facebook\.com\/(?:photo|video)\.php\?v=(\d+)/);
        const fbId = fm ? fm[1] : null;
        if (fbId) {
          return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent('https://www.facebook.com/watch/?v=' + fbId) + '&show_text=false&autoplay=0&width=560';
        }
        return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&autoplay=0&width=560';
      }

      // TikTok
      m = url.match(/tiktok\.com\/(?:@[^\/]+\/)?video\/(\d+)/);
      if (m) return 'https://www.tiktok.com/embed/v2/' + m[1];

      // Dailymotion
      m = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
      if (m) return 'https://www.dailymotion.com/embed/video/' + m[1];
      m = url.match(/dai\.ly\/([a-zA-Z0-9]+)/);
      if (m) return 'https://www.dailymotion.com/embed/video/' + m[1];

      // Vimeo
      m = url.match(/vimeo\.com\/(\d+)/);
      if (m) return 'https://player.vimeo.com/video/' + m[1];

      // Streamable
      m = url.match(/streamable\.com\/([a-zA-Z0-9]+)/);
      if (m) return 'https://streamable.com/e/' + m[1];

      // OK.ru
      m = url.match(/ok\.ru\/video\/(\d+)/);
      if (m) return 'https://ok.ru/videoembed/' + m[1];

      // Google Drive
      m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';

      // XNXX
      m = url.match(/xnxx\.com\/video-([^\/\?\#]+)/);
      if (m) return 'https://www.xnxx.com/embedframe/' + m[1];

      return url;
    }

    /* ✅ অটো থাম্বনেইল */
    function autoGetThumbnail(item, videoUrl) {
      const manual = item.imgUrl || item.posterUrl || item.thumbnailUrl || (item.episodes && item.episodes[0] ? item.episodes[0].thumbnailUrl : '');
      if (manual && String(manual).trim() !== '') return String(manual).trim();

      if (!videoUrl) return '';

      let m = String(videoUrl).match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (m) return 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg';

      m = String(videoUrl).match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
      if (m) return 'https://www.dailymotion.com/thumbnail/video/' + m[1];

      return '';
    }

    function createCard(key, item, isPinned, isPremium) {
      const card = document.createElement('div');
      card.className = 'poster-card';
      
      const requiredAds = item.adLimit !== undefined ? parseInt(item.adLimit) : 5;
      const currentCount = videoAdProgress[key] || 0;
      
      const isUnlocked = isPremium ? (userAccessStatus === 'approved' || currentCount >= requiredAds) : true;

      const rawCover = autoGetThumbnail(item, item.videoUrl);
      const coverImage = (rawCover && rawCover.trim() !== '') ? rawCover : 'https://placehold.co/300x450/1e1e1e/ffffff?text=Secret+Video';

      card.onclick = () => {
        if (isPremium) {
          handlePremiumVideoClick(key, item);
        } else {
          handleNormalVideoClick(key, item);
        }
      };

      card.innerHTML = `
        ${isPremium ? `
          <div class="premium-lock-badge">
            <i class="fa-solid ${isUnlocked ? 'fa-unlock' : 'fa-lock'}"></i>
          </div>
        ` : ''}
        ${!isPremium ? `<div class="pin-btn ${isPinned ? 'pinned' : ''}" onclick="togglePin(event, '${key}')" title="Pin Video"><i class="fa-solid fa-bookmark"></i></div>` : ''}
        <div class="share-btn" onclick="shareVideo(event, '${key}')" title="Share Video"><i class="fa-solid fa-share-nodes"></i></div>
        
        <img src="${coverImage}" class="poster-img" alt="${safeText(item.title)}" onerror="this.onerror=null; this.src='https://placehold.co/300x450/1e1e1e/ffffff?text=Video';" oncontextmenu="return false;">
        
        <div class="play-overlay"><i class="fa-solid ${isPremium && !isUnlocked ? 'fa-lock' : 'fa-play'}"></i></div>
        <div class="poster-title-overlay">
          <span class="poster-title-text">${safeText(item.title)}</span>
        </div>
      `;

      /* ✅ TikTok থাম্বনেইল অটো আনা */
      if ((!rawCover || rawCover.trim() === '') && item.videoUrl) {
        const tm = String(item.videoUrl).match(/tiktok\.com\/(?:@[^\/]+\/)?video\/(\d+)/);
        if (tm) {
          const imgEl = card.querySelector('img');
          fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(String(item.videoUrl).trim()))
            .then(r => r.json())
            .then(data => {
              if (data && data.thumbnail_url && imgEl) imgEl.src = data.thumbnail_url;
            })
            .catch(() => {});
        }
      }

      return card;
    }

    /* ✅✅ ফিক্স: একটা ভিডিও/এডে সমস্যা থাকলে শুধু সেটার জায়গায় সতর্ক কার্ড — পুরো পেজ আর উধাও হবে না */
    function renderVideos() {
      const mainContainer = document.getElementById('mainContentContainer');
      mainContainer.innerHTML = "";

      function brokenCard() {
        const d = document.createElement('div');
        d.className = 'poster-card';
        d.innerHTML = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;color:#ffb0b0;font-size:10px;z-index:3;text-align:center;padding:6px;"><i class="fa-solid fa-triangle-exclamation" style="font-size:20px;color:#ff4757;"></i>ভিডিও ডেটায় সমস্যা!</div>`;
        return d;
      }

      try {
        if (currentTab === "profile") {
          renderProfileSection(mainContainer);
          return;
        }

        if (currentTab === "trending") {
          if (premiumReadError) {
            mainContainer.appendChild(createErrorBox(premiumReadError));
          }

          const headerDiv = document.createElement('div');
          headerDiv.className = 'section-header';
          headerDiv.innerHTML = `<span class="section-title">👑 Premium Content (200+ Videos)</span>`;
          mainContainer.appendChild(headerDiv);

          const premGrid = document.createElement('div');
          premGrid.className = 'mini-grid';
          const keys = Object.keys(premiumVideos).reverse();
          let count = 0;
          let totalMatch = 0;

          keys.forEach((key) => {
            try {
              const item = premiumVideos[key];
              if (!item || typeof item !== 'object') return;
              if (safeText(item.title).toLowerCase().includes(searchQuery.toLowerCase())) {
                totalMatch++;
                if (count < premRenderLimit) {
                  count++;
                  premGrid.appendChild(createCard(key, item, false, true));

                  /* ✅ প্রতি ৪টা প্রিমিয়াম ভিডিওর পরে নেটিভ এড বক্স */
                  if (nativeAdCodeData && count % 4 === 0) {
                    try {
                      const nativeBox = document.createElement('div');
                      nativeBox.className = 'native-ad-container';
                      premGrid.appendChild(nativeBox);
                      setTimeout(() => renderAnyAdByElement(nativeBox, nativeAdCodeData), 0);
                    } catch (e) { console.error("Premium ad insert error:", e); }
                  }
                }
              }
            } catch (e) { console.error("Premium card error:", key, e); premGrid.appendChild(brokenCard()); }
          });

          if (totalMatch === 0) {
            mainContainer.innerHTML += "<p style='color:#888; font-size:11px; text-align:center; padding:30px;'>কোনো প্রিমিয়াম ভিডিও উপলব্ধ নেই!</p>";
          } else {
            mainContainer.appendChild(premGrid);

            if (totalMatch > premRenderLimit) {
              const wrap = document.createElement('div');
              wrap.className = 'load-more-wrap';
              wrap.innerHTML = `<button class="load-more-btn" onclick="loadMorePremium()">আরো দেখুন (${premRenderLimit}/${totalMatch}) <i class="fa-solid fa-chevron-down"></i></button>`;
              mainContainer.appendChild(wrap);
            }
          }
          // লিস্টের নিচের কমপ্যাক্ট ব্যানার — ৪-এর গুণিতকে ইন-ফিড অ্যাড ঠিক আগেই বসে, তাই ডাবল অ্যাড এড়াতে বাদ
          if (nativeAdCodeData && count % 4 !== 0) {
            const premiumAd = document.createElement('div');
            premiumAd.className = 'premium-bottom-ad';
            mainContainer.appendChild(premiumAd);
            setTimeout(() => renderAnyAdByElement(premiumAd, nativeAdCodeData), 0);
          }
          return;
        }

        if (currentTab === "mylist") {
          const myGrid = document.createElement('div');
          myGrid.className = 'mini-grid';
          let pinnedCount = 0;

          Object.keys(allVideos).reverse().forEach(key => {
            try {
              const item = allVideos[key];
              if (!item || typeof item !== 'object') return;
              const isPinned = pinnedVideos.includes(key);
              const titleMatch = safeText(item.title).toLowerCase().includes(searchQuery.toLowerCase());

              if (isPinned && titleMatch) {
                pinnedCount++;
                myGrid.appendChild(createCard(key, item, isPinned, false));
              }
            } catch (e) { console.error("Pinned card error:", key, e); }
          });

          const headerDiv = document.createElement('div');
          headerDiv.className = 'section-header';
          headerDiv.innerHTML = `<span class="section-title">My Pinned Videos</span>`;
          mainContainer.appendChild(headerDiv);

          if (pinnedCount === 0) {
            mainContainer.innerHTML += "<p style='color:#888; font-size:11px; text-align:center; padding:30px;'>আপনার কোনো পিন করা ভিডিও নেই!</p>";
          } else {
            mainContainer.appendChild(myGrid);
          }
          return;
        }

        if (videosReadError) {
          mainContainer.appendChild(createErrorBox(videosReadError));
        }

        const keys = Object.keys(allVideos).reverse();
        const groupedVideos = {};
        
        keys.forEach(key => {
          try {
            const item = allVideos[key];
            if (!item || typeof item !== 'object') return;
            /* অ্যাডমিন প্যানেলের ক্যাটাগরি নামের সাথে যেকোনো ভাবেই মিলিয়ে নেওয়া হয় */
            const category = resolveCategoryName(safeText(item.category)) || "Featured Videos";
            const titleMatch = safeText(item.title).toLowerCase().includes(searchQuery.toLowerCase());

            if (titleMatch) {
              if (!groupedVideos[category]) {
                groupedVideos[category] = [];
              }
              groupedVideos[category].push({ key, data: item });
            }
          } catch (e) { console.error("Group error:", key, e); }
        });

        let totalRendered = 0;
        let totalAvailable = 0;
        const categoriesToDisplay = selectedCat === "All" ? Object.keys(groupedVideos) : [selectedCat];

        categoriesToDisplay.forEach(catName => {
          totalAvailable += (groupedVideos[catName] || []).length;
        });

        categoriesToDisplay.forEach(catName => {
          const videoList = groupedVideos[catName];

          if (videoList && videoList.length > 0 && totalRendered < homeRenderLimit) {
            const section = document.createElement('div');
            section.className = 'category-section';

            const secHeader = document.createElement('div');
            secHeader.className = 'section-header';
            secHeader.innerHTML = `<span class="section-title">${catName}</span>`;

            const grid = document.createElement('div');
            grid.className = 'mini-grid';

            videoList.forEach((obj, idx) => {
              if (totalRendered >= homeRenderLimit) return;
              try {
                const isPinned = pinnedVideos.includes(obj.key);
                grid.appendChild(createCard(obj.key, obj.data, isPinned, false));
              } catch (e) {
                console.error("Card error:", obj.key, e);
                grid.appendChild(brokenCard());
              }
              totalRendered++;

              /* ✅ নেটিভ এড বক্স — প্রতি ৪টা ভিডিওর পরে দেখাবে (সব সেকশন মিলিয়ে গোনা হয়) */
              if (nativeAdCodeData && totalRendered % 4 === 0) {
                try {
                  const nativeBox = document.createElement('div');
                  nativeBox.className = 'native-ad-container';
                  grid.appendChild(nativeBox);
                  setTimeout(() => renderAnyAdByElement(nativeBox, nativeAdCodeData), 0);
                } catch (e) { console.error("Ad insert error:", e); }
              }
            });

            section.appendChild(secHeader);
            section.appendChild(grid);
            mainContainer.appendChild(section);
          }
        });

        if (totalAvailable > homeRenderLimit) {
          const wrap = document.createElement('div');
          wrap.className = 'load-more-wrap';
          wrap.innerHTML = `<button class="load-more-btn" onclick="loadMoreVideos()">আরো দেখুন (${homeRenderLimit}/${totalAvailable}) <i class="fa-solid fa-chevron-down"></i></button>`;
          mainContainer.appendChild(wrap);
        }

        if (totalAvailable === 0 && !videosReadError) {
          mainContainer.innerHTML = selectedCat !== "All"
            ? `<p style='color:#888; font-size:12px; text-align:center; padding:20px;'>"${selectedCat}" ক্যাটাগরিতে এখনো কোনো ভিডিও যোগ করা হয়নি।</p>`
            : "<p style='color:#888; font-size:11px; text-align:center; padding:20px;'>No videos found matching your request.</p>";
        }
      } catch (err) {
        console.error("Render error:", err);
        const ebox = document.createElement('div');
        ebox.className = 'db-error-box';
        ebox.innerHTML = `<b>⚠️ ডিসপ্লে সমস্যা:</b> ${err.message}`;
        mainContainer.appendChild(ebox);
      }
    }

    window.loadMoreVideos = () => {
      homeRenderLimit += 60;
      renderVideos();
    };
    window.loadMorePremium = () => {
      premRenderLimit += 60;
      renderVideos();
    };

    /* ✅✅ ফিক্স: srcdoc ব্যবহার — আগের doc.write পদ্ধতিতে ৬ষ্ঠ ভিডিওর পর ক্র্যাশ হতো */
    function renderAnyAdByElement(container, rawCode) {
      if (!container || !rawCode) return;
      try {
        container.innerHTML = "";
        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.width = '100%';
        iframe.style.height = '180px';
        iframe.style.overflow = 'hidden';
        iframe.srcdoc = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;height:180px;overflow:hidden;background:transparent}body{display:flex;justify-content:center;align-items:center}img{display:block;width:100%!important;max-width:100%!important;height:160px!important;object-fit:contain}iframe{width:100%!important;height:180px!important;border:0}</style></head><body>${rawCode}</body></html>`;
        container.appendChild(iframe);
      } catch (e) {
        console.error("Native ad error:", e);
      }
    }

    window.handleNormalVideoClick = (firstArg, secondArg, thirdArg) => {
      let key, item, videoUrl, title, specificAdUrl;

      if (secondArg && typeof secondArg === 'object') {
        key = firstArg;
        item = secondArg;
        videoUrl = item.videoUrl;
        title = item.title || 'Untitled';
        specificAdUrl = item.adUrl;
      } else {
        videoUrl = firstArg;
        title = secondArg || 'Untitled';
        specificAdUrl = thirdArg;
        key = null;
        item = { videoUrl: videoUrl, title: title, adUrl: specificAdUrl };
      }

      if (!videoUrl) { alert("ভিডিও লিংক পাওয়া যায়নি!"); return; }

      const adSource = (specificAdUrl && String(specificAdUrl).trim()) || (adUrlData ? adUrlData.trim() : "");

      if (!adSource || !key) {
        openVideoPlayer(videoUrl, title, key);
        return;
      }

      const requiredAds = (item.adLimit !== undefined && parseInt(item.adLimit) > 0) ? parseInt(item.adLimit) : 1;

      if (!videoAdProgress[key]) videoAdProgress[key] = 0;
      openLockModal(key, item, videoAdProgress[key], requiredAds, false);
    };

    function handlePremiumVideoClick(key, item) {
      if (!currentUser) {
        showRegisterRequiredModal(item);
        return;
      }

      if (userAccessStatus === 'approved') {
        openVideoPlayer(item.videoUrl, item.title, key);
        return;
      }

      const requiredAds = item.adLimit !== undefined ? parseInt(item.adLimit) : 5;
      if (!videoAdProgress[key]) videoAdProgress[key] = 0;

      if (videoAdProgress[key] < requiredAds) {
        openLockModal(key, item, videoAdProgress[key], requiredAds, true);
      } else {
        openVideoPlayer(item.videoUrl, item.title, key);
      }
    }

    /* লক/রেজিস্ট্রেশন মোডালের উপরে ভিডিওর নিজের ছবি — ইউজার যেন বুঝতে পারে
       কোন ভিডিওটি লক করা আছে (শেয়ার করা লিঙ্ক থেকে খুললেও) */
    function lockVideoThumb(item) {
      try {
        if (!item) return '';
        const cover = autoGetThumbnail(item, item.videoUrl);
        if (!cover) return '';
        return `<img src="${cover}" class="lock-video-thumb" alt="" onerror="this.remove();">`;
      } catch (e) { return ''; }
    }

    window.showRegisterRequiredModal = (item) => {
      const modal = document.getElementById('lockModal');
      const lockBox = modal.querySelector('.lock-box, .timer-overlay-card');

      lockBox.className = "lock-box";
      lockBox.innerHTML = `
        ${lockVideoThumb(item)}
        <i class="fa-solid fa-user-lock" style="color:#e50914; font-size:45px;"></i>
        <h3 style="font-size:17px;">রেজিস্ট্রেশন প্রয়োজন!</h3>
        <p style="font-size:13px;">এটি একটি <b style="color:#e50914;">প্রিমিয়াম ভিডিও</b>।<br>দেখতে হলে আপনাকে প্রথমে <b>ফ্রি রেজিস্ট্রেশন / লগইন</b> করতে হবে।</p>
        <button class="lock-btn" style="font-size:14px; padding:12px;" onclick="goToProfileForLogin()">
          এখনই রেজিস্ট্রেশন / লগইন করুন
        </button>
      `;
      modal.style.display = 'flex';
    };

    window.goToProfileForLogin = () => {
      closeLockModal();
      switchTab('profile', document.querySelectorAll('.nav-link')[3]);
    };

    /* ✅ এড আসল লিংক দিয়ে খুলবে — ব্লক হওয়া অসম্ভব */
    window.openLockModal = (key, item, currentCount, requiredAds, isPremium) => {
      pendingVideo = { key: key, item: item, requiredAds: requiredAds, isPremium: isPremium !== undefined ? isPremium : true };

      let adLink = (item.adUrl && String(item.adUrl).trim()) || adUrlData.trim() || "https://google.com";
      if (adLink.includes("src=")) {
        const match = adLink.match(/src=["']([^"']+)["']/);
        if (match && match[1]) adLink = match[1];
      }
      pendingVideo.adLink = adLink;

      const modal = document.getElementById('lockModal');
      const lockBox = modal.querySelector('.lock-box, .timer-overlay-card');
      const closeBtnOuter = document.getElementById('lockModalCloseBtn');
      if (closeBtnOuter) closeBtnOuter.style.display = 'flex';
      
      lockBox.className = "lock-box";
      lockBox.innerHTML = `
        ${lockVideoThumb(item)}
        <i class="fa-solid fa-lock" style="color:#e50914;"></i>
        <h3>${pendingVideo.isPremium ? 'Locked Premium Content' : 'Watch Ad To Play'}</h3>
        <p>${pendingVideo.isPremium 
          ? `ভিডিওটি আনলক করতে আরও <b>${toBn(requiredAds - currentCount)}</b> টি এড দেখুন অথবা এডমিন এক্সেস রিকোয়েস্ট পাঠান।`
          : `ভিডিওটি দেখতে আরও <b>${toBn(requiredAds - currentCount)}</b> টি এড দেখুন।`}</p>

        <a id="watchAdLink" href="${adLink}" target="_blank" rel="noopener"
           class="lock-btn" style="display:block; text-decoration:none; color:#fff; margin-bottom:8px;"
           onclick="startAdTimer()">
           Watch Ad (${toBn(currentCount)}/${toBn(requiredAds)})
        </a>
        ${pendingVideo.isPremium ? `<button class="lock-btn" style="background:#28a745;" onclick="sendAccessRequest()">Request Admin Access</button>` : ''}
      `;
      modal.style.display = 'flex';
    };

    window.sendAccessRequest = async () => {
      if (!currentUser) {
        alert("রিকোয়েস্ট পাঠাতে আগে প্রোফাইল ট্যাব থেকে ফ্রি রেজিস্ট্রেশন/লগইন করুন।");
        return;
      }
      try {
        /* ✅ প্রতিটা রিকোয়েস্ট আলাদা এন্ট্রি (push) — আগে set() ব্যবহার হতো, তাই
           একই ইউজারের নতুন রিকোয়েস্ট আগেরটাকে মুছে দিত। এখন কোন ভিডিওর
           রিকোয়েস্ট (নাম+থাম্বনেইল) সেটাসহ প্রতিটা আলাদা করে জমা হয়,
           আর এডমিন প্যানেলে প্রতিটা আলাদা রো হিসেবে দেখা যায়। */
        let videoTitle = '';
        let videoThumb = '';
        try {
          const it = pendingVideo && pendingVideo.item;
          if (it) {
            videoTitle = it.title || '';
            videoThumb = String(autoGetThumbnail(it, it.videoUrl) || '');
          }
        } catch (e) {}
        await push(ref(db, 'accessRequests'), {
          uid: currentUser.uid,
          userEmail: currentUser.email || '',
          telegramId: currentUser.uid.replace(/^tg_/, ''),
          telegramUsername: currentUser.reloadUserInfo?.screenName || '',
          videoKey: (pendingVideo && pendingVideo.key) || '',
          videoTitle: videoTitle,
          videoThumb: videoThumb,
          status: 'pending',
          requestedAt: new Date().toLocaleString(),
          createdAt: Date.now()
        });
        /* ইউজারের নিজের স্ট্যাটাস নোড — প্রোফাইলে PENDING/APPROVED দেখায়।
           kind:'userStatus' দেওয়ায় এডমিন প্যানেল এটাকে আলাদা রিকোয়েস্ট হিসেবে দেখায় না। */
        await update(ref(db, `accessRequests/${currentUser.uid}`), {
          kind: 'userStatus',
          status: 'pending',
          userEmail: currentUser.email || '',
          telegramId: currentUser.uid.replace(/^tg_/, ''),
          telegramUsername: currentUser.reloadUserInfo?.screenName || '',
          requestedAt: new Date().toLocaleString()
        });
        alert("আপনার এক্সেস রিকোয়েস্ট এডমিনের কাছে পাঠানো হয়েছে!");
        closeLockModal();
      } catch(e) {
        alert("রিকোয়েস্ট পাঠানো যায়নি: " + e.message +
          "\n\nসমাধান: Firebase Console → Realtime Database → Rules-এ accessRequests নোডে লগইন করা ইউজারের read + write অনুমতি যোগ করুন (নমুনা নিয়ম README-তে আছে)।");
      }
    };

    /* ✅✅ সবুজ টাইমার পপআপ */
    window.startAdTimer = () => {
      if (!pendingVideo) return;
      const modal = document.getElementById('lockModal');
      const lockBox = modal.querySelector('.lock-box, .timer-overlay-card');

      const closeBtnOuter = document.getElementById('lockModalCloseBtn');
      if (closeBtnOuter) closeBtnOuter.style.display = 'none';

      lockBox.className = "timer-overlay-card";
      lockBox.innerHTML = `
        <div class="timer-close-x" id="timerCloseX" onclick="finishAdCount()">
          <i class="fa-solid fa-xmark"></i>
        </div>

        <div class="timer-header">
          <div class="timer-bell-icon">🔔</div>
          <div>
            <div class="timer-title">ভিডিও আনলক</div>
            <div class="timer-subtitle" id="timerSubtitle">${toBn(10)} সেকেন্ড অপেক্ষা করুন...</div>
          </div>
        </div>

        <div class="timer-ad-banner-img" id="timerAdBanner"></div>
      `;

      renderTimerBanner();

      let timeLeft = 10;
      if (adTimerInterval) clearInterval(adTimerInterval);

      adTimerInterval = setInterval(() => {
        timeLeft--;
        const subtitle = document.getElementById('timerSubtitle');

        if (timeLeft > 0) {
          if (subtitle) subtitle.innerText = toBn(timeLeft) + " সেকেন্ড বাকি আছে...";
        } else {
          clearInterval(adTimerInterval);
          if (subtitle) subtitle.innerText = "বিজ্ঞাপন দেখা শেষ!";
          const xBtn = document.getElementById('timerCloseX');
          if (xBtn) xBtn.style.display = 'block';
        }
      }, 1000);
    };

    /* ✅ পপআপের ভিতরের সাদা ব্যানার */
    function renderTimerBanner() {
      const bannerBox = document.getElementById('timerAdBanner');
      if (!bannerBox) return;

      if (!timerBannerCode || String(timerBannerCode).trim() === "") {
        bannerBox.style.display = 'none';
        return;
      }

      bannerBox.style.display = 'flex';
      bannerBox.innerHTML = "";
      const code = String(timerBannerCode).trim();

      if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(code)) {
        const img = document.createElement('img');
        img.src = code;
        img.alt = "Ad";
        bannerBox.appendChild(img);
        return;
      }

      if (code.startsWith("http://") || code.startsWith("https://")) {
        const a = document.createElement('a');
        a.href = code;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = "<span style='color:#e50914; font-size:12px; font-weight:bold;'>📢 Click Here To Watch Ad</span>";
        bannerBox.appendChild(a);
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.srcdoc = `<body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center; background:transparent;">${code}</body>`;
        bannerBox.appendChild(iframe);
      }
    }

    window.finishAdCount = () => {
      if (!pendingVideo) return;
      const key = pendingVideo.key;
      const item = pendingVideo.item;
      const requiredAds = pendingVideo.requiredAds;
      const isPremium = pendingVideo.isPremium;

      videoAdProgress[key] = (videoAdProgress[key] || 0) + 1;
      saveProgress();

      if (videoAdProgress[key] >= requiredAds) {
        closeLockModal();
        renderVideos();
        openVideoPlayer(item.videoUrl, item.title, key);
      } else {
        openLockModal(key, item, videoAdProgress[key], requiredAds, isPremium);
      }
    };

    window.closeLockModal = () => {
      if (adTimerInterval) clearInterval(adTimerInterval);
      const modal = document.getElementById('lockModal');
      const lockBox = modal.querySelector('.lock-box, .timer-overlay-card');
      if(lockBox) lockBox.className = "lock-box";
      const closeBtnOuter = document.getElementById('lockModalCloseBtn');
      if (closeBtnOuter) closeBtnOuter.style.display = 'flex';
      modal.style.display = 'none';
      pendingVideo = null;
    };

    window.switchTab = (tabName, navElement) => {
      currentTab = tabName;

      searchQuery = "";
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = "";
      const searchBox = document.getElementById('searchBox');
      if (searchBox) searchBox.style.display = 'none';
      homeRenderLimit = 60;
      premRenderLimit = 60;

      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
      navElement.classList.add('active');

      const heroSlider = document.getElementById('heroSlider');
      const catBar = document.getElementById('catBar');
      const statsBar = document.getElementById('statsBar');

      if (tabName === "mylist" || tabName === "trending" || tabName === "profile") {
        heroSlider.style.display = 'none';
        catBar.style.display = 'none';
        if (statsBar) statsBar.style.display = 'none';
      } else {
        heroSlider.style.display = 'flex';
        catBar.style.display = 'flex';
        if (statsBar) statsBar.style.display = 'flex';
      }

      renderVideos();
    };

    function renderProfileSection(container) {
      if (!currentUser) {
        const tg = window.Telegram && window.Telegram.WebApp;
        const inTelegram = !!(tg && tg.initData);
        container.innerHTML = `
          <div class="profile-card">
            <h3 style="margin-bottom:8px;">Telegram Login</h3>
            <p style="font-size:12px;color:#666;margin-bottom:15px;">Telegram অ্যাপ থেকে Secret Video Smoky খুলুন। আপনার Telegram অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে যাচাই হবে।</p>
            <button class="auth-btn btn-primary" onclick="loginWithTelegram()"><i class="fa-brands fa-telegram"></i> ${inTelegram ? 'Continue with Telegram' : 'Open in Telegram'}</button>
            <p id="telegramLoginStatus" style="font-size:12px;color:#666;margin-top:10px;"></p>
          </div>`;
      } else {
        const photo = currentUser.photoURL || 'https://via.placeholder.com/90';
        const telegramLabel = currentUser.displayName || 'Telegram User';
        const telegramHandle = telegramProfileData.telegramUsername
          ? '@' + telegramProfileData.telegramUsername
          : 'Telegram ID: ' + currentUser.uid.replace(/^tg_/,'');
        const telegramId = telegramProfileData.telegramId || currentUser.uid.replace(/^tg_/,'');
        container.innerHTML = `
          <div class="profile-card">
            <div class="profile-img-container"><img src="${photo}" id="userAvatar" class="profile-img" oncontextmenu="return false;"></div>
            <div class="profile-name">${telegramLabel}</div>
            <div class="profile-email">${telegramHandle}</div>
            <div class="profile-email">Telegram ID: ${telegramId}</div>
            <p style="font-size:12px;margin-bottom:12px;color:${userAccessStatus === 'approved' ? '#28a745' : '#e50914'};">Status: <b>${userAccessStatus.toUpperCase()}</b></p>
            <button class="auth-btn btn-danger" onclick="logoutUser()"><i class="fa-solid fa-right-from-bracket"></i> Sign Out</button>
          </div>`;
      }
    }

    window.loginWithTelegram = async () => {
      const status = document.getElementById('telegramLoginStatus');
      const tg = window.Telegram && window.Telegram.WebApp;
      if (!tg || !tg.initData) {
        if (status) status.textContent = 'এই লিংকটি Telegram Bot-এর Menu Button থেকে খুলুন।';
        return;
      }
      try {
        tg.ready(); tg.expand();
        if (status) status.textContent = 'Telegram account যাচাই হচ্ছে…';
        const response = await fetch('/api/telegram-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({initData:tg.initData}) });
        const result = await response.json();
        if (!response.ok || !result.verified || !result.user) throw new Error(result.error || 'Telegram verification failed');
        // Firebase anonymous session; Telegram initData has already been verified by the Vercel API.
        const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
        const tUser = result.user || {};
        const displayName = [tUser.first_name,tUser.last_name].filter(Boolean).join(' ') || 'Telegram User';
        await updateProfile(credential.user, {displayName, photoURL:tUser.photo_url || null});
        const userRef = ref(db, `users/${credential.user.uid}`);
        const old = await get(userRef); const existing = old.val() || {};
        const profileRecord = {
          telegramId: String(tUser.id),
          telegramUsername: tUser.username || '',
          firstName: tUser.first_name || '',
          lastName: tUser.last_name || '',
          displayName,
          photoURL: tUser.photo_url || '',
          platform: 'telegram',
          createdAt: existing.createdAt || Date.now(),
          lastSeenAt: Date.now()
        };
        await update(userRef, profileRecord);
        telegramProfileData = profileRecord;
        currentUser = credential.user; updateProfileUI(); checkUserAccessStatus(); renderVideos();
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      } catch (error) {
        console.error('Telegram login:',error);
        if (status) status.textContent = error.message || 'Login failed';
        alert('Telegram Login সমস্যা: ' + (error.message || 'Unknown error'));
      }
    };

    window.logoutUser = () => signOut(auth).then(() => { currentUser=null; userAccessStatus='none'; updateProfileUI(); renderVideos(); });

    window.handleImageUpload = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("image", file);

      alert("ছবি আপলোড হচ্ছে...");

      fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.data && data.data.url) {
          const newPhotoUrl = data.data.url;
          updateProfile(auth.currentUser, { photoURL: newPhotoUrl }).then(() => {
            alert("প্রোফাইল পিকচার আপডেট হয়েছে!");
            renderVideos();
          });
        }
      });
    };

    function updateProfileUI() {
      const profileNavBtn = document.getElementById('navProfileIcon');
      if (profileNavBtn) {
        if (currentUser && currentUser.photoURL) {
          profileNavBtn.outerHTML = `<img src="${currentUser.photoURL}" id="navProfileIcon">`;
        } else {
          profileNavBtn.outerHTML = `<i class="fa-solid fa-user" id="navProfileIcon"></i>`;
        }
      }
    }

    window.toggleSearch = () => {
      const searchBox = document.getElementById('searchBox');
      const searchInput = document.getElementById('searchInput');
      if (searchBox.style.display === 'block') {
        searchBox.style.display = 'none';
        searchQuery = "";
        searchInput.value = "";
        renderVideos();
      } else {
        searchBox.style.display = 'block';
        searchInput.focus();
      }
    };

    window.handleSearch = (e) => {
      searchQuery = e.target.value.trim();
      renderVideos();
    };

    window.openVideoPlayer = (url, title, key) => {
      const modal = document.getElementById('playerModal');
      const videoContainer = document.getElementById('videoPlayerContainer');
      document.getElementById('modalTitle').innerText = title;
      /* শেয়ার বাটনের জন্য এই মুহূর্তে চলা ভিডিওর আইডি মনে রাখা */
      currentPlayingKey = key || null;
      currentPlayingTitle = title || "";

      url = String(url).trim();

      if (url.includes('<iframe')) {
        /* হোস্ট সাইটের লিঙ্কে টাচ করে যাওয়া বন্ধ: এমবেড কোড থেকে <a> লিঙ্ক সরানো হয়
           এবং প্রতিটি iframe-এ sandbox বসানো হয় — ফলে ভিডিওর ভেতর টাচ করলে বাইরের
           ওয়েবসাইট খোলে না / পেজ চলে যায় না; প্লে-পজ-সিক-ফুলস্ক্রিন আগের মতোই কাজ করে */
        let cleanedCode = url;
        try {
          const parsed = new DOMParser().parseFromString(url, 'text/html');
          parsed.querySelectorAll('a').forEach(a => {
            while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
            a.remove();
          });
          parsed.querySelectorAll('iframe').forEach(f => f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation'));
          cleanedCode = parsed.body.innerHTML;
        } catch (e) { cleanedCode = url; }
        videoContainer.innerHTML = cleanedCode;
        videoContainer.querySelectorAll('iframe').forEach(iframe => {
          iframe.setAttribute('allowfullscreen', 'true');
          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
          iframe.style.width = '100%';
          iframe.style.height = '100%';
        });
      } else if (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('cloudinary') || url.includes('firebasestorage')) {
        /* ভিডিও লোড না হওয়া পর্যন্ত নিজের থাম্বনেইল দেখায় — কালো স্ক্রিন না */
        let posterAttr = '';
        try {
          const it = (allVideos && allVideos[key]) || (premiumVideos && premiumVideos[key]);
          const poster = it ? autoGetThumbnail(it, it.videoUrl) : '';
          if (poster) posterAttr = ` poster="${poster}"`;
        } catch (e) {}
        videoContainer.innerHTML = `<video src="${url}"${posterAttr} controls autoplay controlsList="nodownload" allowfullscreen oncontextmenu="return false;" playsinline></video>`;
      } else {
        const embedUrl = convertToEmbedUrl(url);
        videoContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%;"></iframe>`;
      }

      modal.style.display = 'flex';
    };

    window.closePlayer = () => {
      const modal = document.getElementById('playerModal');
      const videoContainer = document.getElementById('videoPlayerContainer');
      videoContainer.innerHTML = "";
      modal.style.display = 'none';
    };
    window.switchTab = switchTab;
  
// Telegram Mini App: authenticate automatically when opened from the bot.
if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
  window.loginWithTelegram();
}
