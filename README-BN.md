# Secret Video — Telegram Mini App + Bot

## কী আছে
- Public ভিডিও দেখতে লগইন দরকার নেই।
- Google Login বাটন ও Google sign-in কোড সরানো হয়েছে।
- Premium ভিডিওর আগের lock/approval/ad-progress লজিক রাখা হয়েছে।
- Telegram Mini App SDK যোগ করা হয়েছে।
- Vercel serverless webhook: `api/telegram.js`

## Vercel-এ চালানোর আগে ৩টি সেটিংস
1. `api/telegram.js` ফাইলে `TELEGRAM_BOT_TOKEN`-এ BotFather থেকে নতুন token বসান। পুরোনো token প্রকাশিত হয়েছে—আগে revoke করুন।
2. `MINI_APP_URL`-এ আপনার Vercel সাইটের HTTPS URL দিন।
3. `BOT_USERNAME` এবং `config.js`-এর `YOUR_TELEGRAM_BOT_USERNAME`-এর জায়গায় বটের username দিন ( @ ছাড়া)।

## Webhook সেট করা
ডিপ্লয় করার পর ব্রাউজারে এই URL খুলুন (আপনার domain বসিয়ে):
`https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://YOUR-PROJECT.vercel.app/api/telegram`

এই URL-এ token থাকে, তাই এটি কাউকে পাঠাবেন না। সেট করার পর Telegram-এ বটের `/start` পাঠিয়ে পরীক্ষা করুন।

## গুরুত্বপূর্ণ
- Telegram Mini App-এর জন্য অবশ্যই HTTPS domain এবং BotFather-এ Web App/domain সেটআপ লাগবে।
- Firebase client config ও ImgBB key frontend-এ থাকলে সেগুলো গোপন server secret নয়; ImgBB upload abuse ঠেকাতে key rotate করা এবং server-side upload proxy ব্যবহার করা ভালো।
- এই ZIP-এ live Vercel deployment বা real Telegram webhook test করা সম্ভব হয়নি; deploy করার পর সেটি পরীক্ষা করতে হবে।
