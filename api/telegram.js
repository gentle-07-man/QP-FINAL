// /api/telegram.js - Vercel Serverless Function for 5 Subject Evaluation Bots

const SUBJECT_BOTS = {
  'MATHS': {
    username: 'El_examinador_bot',
    envKey: 'BOT_TOKEN_MATHS',
    fallbackEnv: 'MATHS_BOT_TOKEN',
    title: 'Mathematics'
  },
  'P_SCI': {
    username: 'Therealitusbot',
    envKey: 'BOT_TOKEN_PSCI',
    fallbackEnv: 'PSCI_BOT_TOKEN',
    title: 'Physical Science'
  },
  'L_SCI': {
    username: 'life_ico_bot',
    envKey: 'BOT_TOKEN_LSCI',
    fallbackEnv: 'LSCI_BOT_TOKEN',
    title: 'Life Science'
  },
  'BENGALI_ENGLISH': {
    username: 'Benglish_k_bot',
    envKey: 'BOT_TOKEN_BENGALI',
    fallbackEnv: 'BENGALI_BOT_TOKEN',
    title: 'Bengali & English'
  },
  'HIST_GEO': {
    username: '',
    envKey: 'BOT_TOKEN_HISTGEO',
    fallbackEnv: 'HISTORY_BOT_TOKEN',
    title: 'History & Geography',
    disabled: true
  }
};

// Aliases helper
function normalizeSubject(sub) {
  if (!sub) return 'MATHS';
  const s = String(sub).trim().toUpperCase();
  if (s.includes('MATH')) return 'MATHS';
  if (s.includes('P_SCI') || s.includes('PHYS') || s.includes('P. SCI') || s.includes('P.SCI')) return 'P_SCI';
  if (s.includes('L_SCI') || s.includes('LIFE') || s.includes('L. SCI') || s.includes('L.SCI')) return 'L_SCI';
  if (s.includes('BENG') || s.includes('ENG') || s.includes('LANG')) return 'BENGALI_ENGLISH';
  if (s.includes('HIST') || s.includes('GEO') || s.includes('SST')) return 'HIST_GEO';
  return s;
}

export default async function handler(req, res) {
  // Always set CORS & JSON headers
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
      } catch (parseErr) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }
    body = body || {};

    const rawSubject = body.subject || 'MATHS';
    const normSub = normalizeSubject(rawSubject);
    const botConfig = SUBJECT_BOTS[normSub];

    if (!botConfig) {
      return res.status(400).json({
        error: `Unknown subject: "${rawSubject}". Supported subjects: MATHS, P_SCI, L_SCI, BENGALI_ENGLISH, HIST_GEO`
      });
    }

    // Check if subject is pending/disabled (e.g. HIST_GEO)
    if (botConfig.disabled) {
      return res.status(400).json({
        error: `${botConfig.title} evaluator bot is currently pending. Coming Soon!`,
        disabled: true,
        subject: normSub
      });
    }

    const token = process.env[botConfig.envKey] || 
                  process.env[botConfig.fallbackEnv] || 
                  (normSub === 'MATHS' ? process.env.BOT_TOKEN : null) || 
                  process.env.BOT_TOKEN;
    const username = botConfig.username;
    const studentName = body.userName || body.gcName || body.name || 'Student';
    const studentId = body.userId || body.uid || 'Anonymous';
    const batch = body.batch || 'General';
    const base64Data = body.photo_base64 || body.imageBase64 || body.imageUrl || '';

    // If bot token is not configured in Vercel environment variables yet
    if (!token) {
      console.warn(`[telegram-router] Token for ${normSub} (${botConfig.envKey}) is not set in Vercel env.`);
      return res.status(200).json({
        success: true,
        simulated: true,
        botUsername: username,
        subject: normSub,
        message: `Token ${botConfig.envKey} is not configured in Vercel yet. Submission simulated successfully!`
      });
    }

    // Determine target chat ID
    let chatId = process.env[botConfig.envKey + '_CHAT_ID'] ||
                 process.env[botConfig.fallbackEnv + '_CHAT_ID'] ||
                 process.env.TELEGRAM_CHAT_ID ||
                 process.env.CHAT_ID ||
                 '';

    // Auto-detect chat_id from getUpdates if not specified in env
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
        console.warn('[telegram-router] getUpdates auto-detection notice:', getErr.message);
      }
    }

    if (!chatId) {
      return res.status(400).json({
        error: `Bot token for @${username} is detected, but Telegram needs a recipient. Please open Telegram, search @${username}, tap START, or add TELEGRAM_CHAT_ID in Vercel environment variables.`,
        needsStart: true,
        botUsername: username
      });
    }

    const caption = `📝 New Mock Submission\n👤 Student: ${studentName}\n🆔 ID: ${studentId}\n🏷️ Batch: ${batch}\n📚 Subject: ${botConfig.title}\n⏱️ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;

    // Send Photo
    if (base64Data && base64Data.length > 20) {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'answersheet.jpg');
      formData.append('caption', caption);

      const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      const telegramData = await telegramRes.json().catch(() => ({}));

      if (!telegramRes.ok || !telegramData.ok) {
        const desc = telegramData.description || 'Telegram rejected photo upload';
        console.error('[telegram-router] Telegram error:', desc);
        return res.status(400).json({
          error: `Telegram error: ${desc}. Make sure @${username} is started or added to your chat/channel.`,
          botUsername: username
        });
      }

      return res.status(200).json({
        success: true,
        botUsername: username,
        subject: normSub,
        message: `Answer sent to @${username} for checking!`,
        telegramResult: telegramData.result ? { message_id: telegramData.result.message_id } : {}
      });
    } else {
      // Send text-only notification if no photo attached
      const textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: caption
        })
      });
      const textData = await textRes.json().catch(() => ({}));

      return res.status(200).json({
        success: true,
        botUsername: username,
        subject: normSub,
        message: `Submission registered with @${username}`,
        telegramResult: textData
      });
    }

  } catch (err) {
    console.error('[telegram-router] Server error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error processing Telegram submission'
    });
  }
}
