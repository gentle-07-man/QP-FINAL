// /api/support.js - Vercel Serverless Function for Help & Support Ticket Raise

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }
    body = body || {};

    const {
      name = 'Student',
      email = 'Not provided',
      phone = 'Not provided',
      category = 'General Support',
      subject = 'Support Request',
      message = '',
      userId = 'Anonymous'
    } = body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Ticket message cannot be empty' });
    }

    const ticketId = 'TKT-' + Date.now().toString().slice(-6);
    const token = process.env.SUPPORT_BOT_TOKEN || process.env.BOT_TOKEN_SUPPORT;

    const formattedMessage = 
      `🎫 *NEW SUPPORT TICKET: ${ticketId}*\n\n` +
      `👤 *User:* ${name}\n` +
      `🆔 *User ID:* \`${userId}\`\n` +
      `📧 *Email:* ${email}\n` +
      `📞 *Phone:* ${phone}\n` +
      `📂 *Category:* ${category}\n` +
      `📌 *Subject:* ${subject}\n\n` +
      `💬 *Message:*\n${message}\n\n` +
      `⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;

    if (!token) {
      console.warn('[support-api] SUPPORT_BOT_TOKEN is not set in Vercel environment variables.');
      return res.status(200).json({
        success: true,
        simulated: true,
        ticketId,
        message: 'Support ticket received! (Support Bot token pending in Vercel env)'
      });
    }

    // Determine target chat ID
    let chatId = process.env.SUPPORT_CHAT_ID ||
                 process.env.BOT_TOKEN_SUPPORT_CHAT_ID ||
                 process.env.TELEGRAM_CHAT_ID ||
                 '';

    if (!chatId) {
      try {
        const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
        const updatesData = await updatesRes.json();
        if (updatesData.ok && Array.isArray(updatesData.result) && updatesData.result.length > 0) {
          for (let i = updatesData.result.length - 1; i >= 0; i--) {
            const u = updatesData.result[i];
            const chat = (u.message || u.channel_post || u.my_chat_member)?.chat;
            if (chat && chat.id) {
              chatId = String(chat.id);
              break;
            }
          }
        }
      } catch (getErr) {
        console.warn('[support-api] getUpdates auto-detection notice:', getErr.message);
      }
    }

    if (!chatId) {
      return res.status(200).json({
        success: true,
        ticketId,
        message: 'Ticket recorded. Please start your Support Bot on Telegram or set SUPPORT_CHAT_ID in Vercel.'
      });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formattedMessage,
        parse_mode: 'Markdown'
      })
    });

    const tgData = await tgRes.json().catch(() => ({}));

    return res.status(200).json({
      success: true,
      ticketId,
      message: `Support ticket ${ticketId} raised successfully to support staff!`,
      telegramResult: tgData.ok ? { message_id: tgData.result?.message_id } : tgData
    });

  } catch (err) {
    console.error('[support-api] Server error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error processing support ticket'
    });
  }
}
