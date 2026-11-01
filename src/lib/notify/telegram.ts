import "server-only";

/**
 * Sends a message to the agency's private Telegram group. Configured with TELEGRAM_BOT_TOKEN
 * and TELEGRAM_CHAT_ID (server only, set by `npm run telegram:setup`). Never throws: a
 * Telegram outage must not lose a booking, which is already saved in the database.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) console.error("[telegram] send failed:", res.status);
    return res.ok;
  } catch (e) {
    console.error("[telegram] send failed:", (e as Error).name);
    return false;
  }
}
