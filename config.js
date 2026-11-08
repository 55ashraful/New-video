// Firebase Web SDK configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCL4BbICa_2lVY9BuUTHXYwzc6SaHLW_C0",
  authDomain: "telegram-secret-video.firebaseapp.com",
  databaseURL: "https://telegram-secret-video-default-rtdb.firebaseio.com",
  projectId: "telegram-secret-video",
  storageBucket: "telegram-secret-video.firebasestorage.app",
  messagingSenderId: "438211964208",
  appId: "1:438211964208:web:3648b6f61dfee23643acf5",
  measurementId: "G-18JF5FB7PT"
};

// ImgBB key supplied by the site owner. Prefer proxying uploads server-side.
export const IMGBB_API_KEY = "d617dab9d2117228e38549791d42104a";

// টেলিগ্রাম মিনি অ্যাপের ঠিকানা — শেয়ার লিঙ্ক এখান থেকেই তৈরি হয়:
//   https://t.me/<botUsername>/<appShortName>?startapp=v_<ভিডিও আইডি>
// লিঙ্কে ক্লিক করলেই মিনি অ্যাপ খুলে সরাসরি সেই ভিডিওতে ঢুকবে — বটের প্রোফাইলে যাবে না।
// গুরুত্বপূর্ণ: BotFather-এ অ্যাপের সংক্ষিপ্ত নাম হুবহু এটাই থাকতে হবে।
// BotFather-এ নাম বদলালে এখানেও হুবহু বদলে নিতে হবে, নইলে লিঙ্ক বটের চ্যাটে যাবে।
export const TELEGRAM_SHARE = {
  botUsername: "secret0video_bot",
  appShortName: "httpstelegramsecretvideoal"
};
