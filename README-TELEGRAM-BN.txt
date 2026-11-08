Secret Video Smoky - আপডেট
===========================

এই সংস্করণে:
- Firebase project config নতুন telegram-secret-video প্রজেক্টে পরিবর্তন করা হয়েছে।
- Firebase Admin SDK এবং firebase-admin dependency বাদ দেওয়া হয়েছে।
- Telegram initData Vercel API-তে TELEGRAM_BOT_TOKEN দিয়ে যাচাই হয়।
- যাচাই সফল হলে Firebase Anonymous Authentication session ব্যবহার করে profile data Realtime Database-এ লেখা হয়।
- ImgBB API key config.js-এ রাখা হয়েছে (নিরাপত্তার জন্য ভবিষ্যতে server-side proxy ব্যবহার করুন)।
- নিচের বিজ্ঞাপন bottomBannerCode দিয়ে #bottomAdBox-এ দেখানো হবে।
- Contact links: Telegram Channel, Telegram এবং WhatsApp আগের মতো আছে।

ভিডিও শেয়ার সিস্টেম — টেলিগ্রাম মিনি অ্যাপ লিঙ্ক (t.me)
================================================================
- প্রতিটা ভিডিও কার্ডের বাম-উপরে এবং প্লেয়ার মোডালের বাম-উপরে শেয়ার বাটন আছে।
- শেয়ার করলে প্রথমে ভিডিওর থাম্বনেইল **ছবি হিসেবে** শেয়ার হয়, লিঙ্কটা ক্যাপশনে থাকে —
  তাই টেলিগ্রাম চ্যাটে সরাসরি সেই ভিডিওর ফটোই দেখাবে (ডিভাইস ছবি শেয়ার সমর্থন
  না করলে লিঙ্ক-প্রিভিউ কার্ড আসবে)।
- শেয়ার/কপি হওয়া লিঙ্ক = টেলিগ্রাম মিনি অ্যাপের সরাসরি ঠিকানা, যেমন:
  https://t.me/secret0video_bot/httpstelegramsecretvideoal?startapp=v_<ভিডিও আইডি>
  — লিঙ্কে ক্লিক করলেই টেলিগ্রাম মিনি অ্যাপ খুলে **সরাসরি সেই ভিডিওতেই** ঢুকবে,
  বটের প্রোফাইল/চ্যাটে যাবে না।
- এই লিঙ্ক তৈরি হয় config.js-এর TELEGRAM_SHARE থেকে:
    botUsername  = secret0video_bot
    appShortName = httpstelegramsecretvideoal
  ⚠ জরুরি: t.me/secret0video_bot/httpstelegramsecretvideoal — ঠিকানার /<অ্যাপ-সংক্ষেপ>
  অংশটা না থাকলে টেলিগ্রাম লিঙ্কটাকে বটের চ্যাট হিসেবে খোলে। তাই BotFather-এ
  অ্যাপের সংক্ষিপ্ত নাম হুবহু httpstelegramsecretvideoal-ই থাকতে হবে। BotFather-এ
  নাম কখনো বদলালে config.js-এর appShortName-ও হুবহু বদলে নিতে হবে — নইলে
  শেয়ার লিঙ্কগুলো বটের চ্যাটে চলে যাবে।
- লিঙ্ক থেকে খুললে অ্যাপ সাইটের লোগো-স্ক্রিন (preloader) একবারও দেখায় না — সরাসরি
  ওই ভিডিওর থাম্বনেইল/প্লেয়ার দেখায় (লোগো দেখিয়ে সময় নষ্ট হয় না)।
- অ্যাপের ভেতরেও: লক/"Watch Ad To Play" ও রেজিস্ট্রেশন মোডালে ভিডিওর নিজের ছবি
  দেখাবে, আর ভিডিও বাফার হওয়া পর্যন্ত প্লেয়ারে থাম্বনেইল দেখায় (কালো স্ক্রিন না)।
- প্রিমিয়াম ভিডিও হলে রেজিস্ট্রেশন/অ্যাড-আনলক নিয়ম আগের মতোই থাকবে।

শেয়ার করা লিঙ্ক যেভাবে চেনে (কোনো সেটআপ লাগে না)
================================================
অ্যাপ সব জায়গায় ভিডিওর আইডি খোঁজে: t.me লিঙ্কের ?startapp=, URL-এর ?v=,
?tgWebAppStartParam=, hash-এ #tgWebAppStartParam=, এবং Telegram WebApp SDK-র
start_param — কোন টেলিগ্রাম ক্লায়েন্ট কীভাবেই পাঠাক, সেই ভিডিওতেই ঢুকবে।
আগের সংস্করণে শেয়ার হওয়া সাইটের ?v= লিঙ্কগুলোও তাই এখনো কাজ করবে।

config.js-এর TELEGRAM_SHARE দিয়েই এখন শেয়ার লিঙ্ক তৈরি হয় — BotFather-এর
অ্যাপ নামের সাথে মিল রাখা বাধ্যতামূলক (উপরের অংশ দেখুন)।

প্রিমিয়াম এক্সেস রিকোয়েস্ট সিস্টেম (ইউজার → এডমিন প্যানেল)
================================================================
- ইউজার কোনো প্রিমিয়াম ভিডিওর লক স্ক্রিনে "Request Admin Access" চাপলে
  **প্রতিবার আলাদা রিকোয়েস্ট** জমা হয় — কোন ভিডিও (ছবি+নাম), কোন ইউজার
  (ইমেইল/টেলিগ্রাম আইডি), কখন — সবসহ। আগে set() ব্যবহার হতো বলে এক ইউজারের
  নতুন রিকোয়েস্ট আগেরটাকে মুছে দিত; এখন push() দিয়ে প্রতিটাই আলাদা থাকে।
- এডমিন প্যানেল (admin-panel.html) → "🔑 প্রিমিয়াম এক্সেস রিকোয়েস্ট" কার্ডে
  প্রতিটা রিকোয়েস্ট আলাদা রো দেখাবে; ডানপাশে ৩টা বাটন:
    ⏳ Pending  = আবার পেন্ডিং করা
    ✔ Approve  = ইউজারকে প্রিমিয়াম এক্সেস (তার অ্যাপে সাথে সাথে আনলক)
    🗑 Delete  = রিকোয়েস্ট মুছে ফেলা
- রিকোয়েস্টগুলো নতুন→পুরোনো ক্রমে সাজানো থাকে এবং হেডিংয়ে মোট সংখ্যা দেখায়।
- রিকোয়েস্ট না এলে কার্ডের ভেতরেই লাল এররে কারণ দেখাবে — প্রায় সব সময় এটা
  Firebase Realtime Database Rules সমস্যা; নিচের rules-এ accessRequests নোড
  খোলা আছে কিনা দেখুন। ইউজার পাশে রিকোয়েস্ট পাঠাতে গিয়ে এরর পেলেও একই সমাধান।
- ⚠️ এডমিন প্যানেল (admin-panel.html) একটা **আলাদা একক ফাইল** — ইউজার অ্যাপের
  সাথে একসাথে ডিপ্লয় করার দরকার নেই। যেকোনো আলাদা ওয়েবসাইট/হোস্টিংয়ে (Vercel,
  Netlify, GitHub Pages — যেটাতে খুশি) শুধু এই একটা ফাইল আপলোড করলেই চলবে;
  ভেতরে Firebase config, IMGBB কী সবই লেখা আছে। দুটো সাইটই একই Firebase
  প্রজেক্টের সাথে যুক্ত, তাই রিকোয়েস্ট সরাসরি এডমিন প্যানেলে আসবে।

api/video-share.js (ঐচ্ছিক — পুরোনো লিঙ্ক ও পোস্টার পেজের জন্য)
====================================================================
নতুন শেয়ার লিঙ্ক আর api ব্যবহার করে না। api ফোল্ডার ডিপ্লয় করলে দুটো অতিরিক্ত লাভ:
1) আগে শেয়ার হয়ে যাওয়া পুরোনো /api/video-share?v=... লিঙ্কগুলো (চ্যাটে যেগুলো
   এখন 404 দেখাচ্ছে) তখন একটা পোস্টার পেজ দেখাবে — ভিডিওর বড় ছবি + নাম +
   লাল "▶ এই ভিডিওটি দেখুন" বাটন; বাটনে চাপ দিলে মিনি অ্যাপের সেই ভিডিওতে ঢুকবে।
   api ডিপ্লয় না করলে পুরোনো লিঙ্কগুলো 404-ই থাকবে (নতুন শেয়ার ঠিক চলবে)।
2) /api/telegram-auth কাজ করবে (টেলিগ্রাম প্রোফাইল/initData যাচাই)।

api ফোল্ডার ডিপ্লয় করতে চাইলে:
1) এই জিপের পুরো ফোল্ডারটা (index.html, app.js, style.css, config.js, package.json
   এবং **api ফোল্ডার** — ভেতরে telegram-auth.js + video-share.js আছে) একসাথে Vercel-এ
   আপলোড/Redeploy করুন। শুধু একক ফাইল আপলোড করলে api ফাংশন ডিপ্লয় হয় না।
2) ডিপ্লয়ের পর ব্রাউজারে খুলে দেখুন:
   https://telegram-secret-video.vercel.app/api/video-share?v=test
   — এতে পোস্টার পেজ আসবে (404 আসা মানে api ফোল্ডার এখনো উঠেনি)।
3) Firebase Realtime Database rules-এ videos ও premiumVideos নোডে পাবলিক read থাকতে হবে
   (অ্যাপ যেভাবে ভিডিও পড়ে, প্রিভিউ ফাংশনও সেভাবেই পড়ে)।
4) লিঙ্ক-প্রিভিউ ক্যাশ হয় ৩ মিনিট; থাম্বনেইল বদলালে কয়েক মিনিট অপেক্ষা করলেই নতুন ছবি দেখাবে।


Vercel Environment Variable:
TELEGRAM_BOT_TOKEN = BotFather token

এরপর Vercel-এ Redeploy করুন।

গুরুত্বপূর্ণ Firebase Authentication:
Firebase Console > Authentication > Sign-in method থেকে:
1) Anonymous চালু করুন (Telegram Mini App visitor session-এর জন্য)
2) Email/Password চালু রাখুন (শুধু Admin Panel-এর জন্য)
Google বন্ধ রাখতে পারেন।

Realtime Database Rules:
বর্তমান ডাটাবেজে read:false/write:false থাকলে অ্যাপ ডেটা পড়তে/লিখতে পারবে না।
নিচের নিয়মগুলো একটি প্রাথমিক উদাহরণ; আপনার Admin Panel-এর প্রকৃত UID/role অনুযায়ী admin অনুমতি যোগ করে নিন।

⚠️ রিকোয়েস্ট সিস্টেমের জন্য accessRequests নোড সবচেয়ে জরুরি — এটা খোলা না
থাকলে ইউজারের রিকোয়েস্ট পাঠানো যাবে না / এডমিন প্যানেলে দেখা যাবে না।

{
  "rules": {
    ".read": false,
    ".write": false,
    "videos": { ".read": true },
    "premiumVideos": { ".read": true },
    "categories": { ".read": true },
    "heroBanners": { ".read": true },
    "settings": { ".read": true },
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "accessRequests": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}

(উপরের নমুনায় এডমিন প্যানেল লগইন করা অবস্থায় videos/categories/heroBanners/
settings-এ লিখতে পারে কিনা আপনার বর্তমান rules-এর সাথে মিলিয়ে দেখুন — লিখতে
না পারলে ভিডিও/ক্যাটাগরি সেভ হবে না। সহজ সমাধান চাইলে নিরাপত্তা ঝুঁকি বুঝে
"auth != null" এর জায়গায় প্রয়োজনীয় নোডগুলোতে write-ও খুলে দিতে পারেন।)

নিরাপত্তা সীমাবদ্ধতা:
এই Admin-SDK-বিহীন সংস্করণে Telegram initData সার্ভারে যাচাই হয়, কিন্তু Firebase Anonymous UID Telegram ID-এর সঙ্গে cryptographically bind করা নয়। তাই users/$uid-এর নিজস্ব profile data-কে admin-verified Telegram identity ধরে গুরুত্বপূর্ণ অনুমতি/পেমেন্ট দেবেন না। শক্ত binding প্রয়োজন হলে Firebase Admin SDK বা অন্য trusted server-side credential broker দরকার।

বিজ্ঞাপন:
Vercel/Admin settings-এর bottomBannerCode-এ Banner/Native Banner কোড দিন। Social Bar সাধারণত floating ad; নির্দিষ্ট bottom box-এ বাধ্যতামূলকভাবে বসে না।
