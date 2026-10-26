// Vercel serverless Telegram Bot webhook. This file runs server-side, not in the browser.
// Replace TELEGRAM_BOT_TOKEN below with a freshly rotated token before public deployment.
const TELEGRAM_BOT_TOKEN = "8530994490:AAGZnVjEg1jIBAN1PvtPXp6by6CwYRvxNLY:";
const MINI_APP_URL = "https://new-video-xi.vercel.app/";
const BOT_USERNAME = "NewPursonal_bot";

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  return response.json();
}

module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "Telegram bot webhook", configured: !TELEGRAM_BOT_TOKEN.startsWith("REPLACE_") });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const update = req.body || {};
    const message = update.message || update.edited_message;
    if (message && message.chat && typeof message.text === "string") {
      const chatId = message.chat.id;
      const text = message.text.trim();
      if (text === "/start" || text.startsWith("/start ") || text === "/app") {
        const replyMarkup = { inline_keyboard: [[{ text: "▶ Open Secret Video", web_app: { url: MINI_APP_URL } }]] };
        await telegram("sendMessage", { chat_id: chatId, text: "Welcome! Public videos can be watched without login. Premium videos keep their existing lock.", reply_markup: replyMarkup });
      } else if (text === "/help") {
        await telegram("sendMessage", { chat_id: chatId, text: "Commands: /start — open the video Mini App; /help — show help." });
      } else {
        await telegram("sendMessage", { chat_id: chatId, text: "Use /start to open Secret Video." });
      }
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.status(500).json({ ok: false, error: "Webhook failed" });
  }
};
