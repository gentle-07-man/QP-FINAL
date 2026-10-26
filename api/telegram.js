// /api/telegram.js - Clean Version - No Support Bot Needed

const SUBJECT_BOTS = {
  'MATHS': {
    username: 'El_examinador_bot',
    envKey: 'BOT_TOKEN_MATHS',
    chatIdEnv: 'TELEGRAM_CHAT_ID_MATHS',
    fallbackEnv: 'MATHS_BOT_TOKEN',
    title: 'Mathematics'
  },
  'P_SCI': {
    username: 'Therealitusbot',
    envKey: 'BOT_TOKEN_PSCI',
    chatIdEnv: 'TELEGRAM_CHAT_ID_PSCI',
    fallbackEnv: 'PSCI_BOT_TOKEN',
    title: 'Physical Science'
  },
  'L_SCI': {
    username: 'life_ico_bot',
    envKey: 'BOT_TOKEN_LSCI',
    chatIdEnv: 'TELEGRAM_CHAT_ID_LSCI',
    fallbackEnv: 'LSCI_BOT_TOKEN',
    title: 'Life Science'
  },
  'BENGALI_ENGLISH': {
    username: 'Benglish_k_bot',
    envKey: 'BOT_TOKEN_BENGALI',
    chatIdEnv: 'TELEGRAM_CHAT_ID_BENGALI',
    fallbackEnv: 'BENGALI_BOT_TOKEN',
    title: 'Bengali & English'
  },
  'HIST_GEO': {
    username: 'HIST_GEO_BOT',
    envKey: 'BOT_TOKEN_HISTGEO',
    chatIdEnv: 'TELEGRAM_CHAT_ID_HISTGEO',
    fallbackEnv: 'HISTORY_BOT_TOKEN',
    title: 'History & Geography',
    pending: true
  }
};

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    body = body || {};

    const normSub = normalizeSubject(body.subject || 'MATHS');
    const botConfig = SUBJECT_BOTS[normSub];

    if (!botConfig) {
      return res.status(400).json({ error: `Unknown subject: ${body.subject}` });
    }

    const token = process.env[botConfig.envKey] || process.env[botConfig.fallbackEnv];

    if (!token) {
      return res.status(200).json({
        success: true,
        simulated: true,
        subject: normSub,
        message: `Token ${botConfig.envKey} not set, simulated`
      });
    }

    let chatId = process.env[botConfig.chatIdEnv] ||
                 process.env[botConfig.envKey + '_CHAT_ID'] ||
                 process.env[botConfig.fallbackEnv + '_CHAT_ID'] || '';

    if (!chatId) {
      try {
        const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
        const updatesData = await updatesRes.json();
        if (updatesData.ok && updatesData.result.length > 0) {
          const last = updatesData.result[updatesData.result.length - 1];
          const chat = (last.message || last.channel_post || last.my_chat_member)?.chat;
          if (chat?.id) chatId = String(chat.id);
        }
      } catch (e) {
        console.warn('getUpdates failed', e.message);
      }
    }

    // No Chat ID = Simulated (No Support Fallback)
    if (!chatId) {
      return res.status(200).json({
        success: true,
        simulated: true,
        subject: normSub,
        message: `${botConfig.title} submitted! Chat ID pending for ${botConfig.chatIdEnv}`
      });
    }

    const studentName = body.userName || body.gcName || body.name || 'Student';
    const studentId = body.userId || body.uid || 'Anonymous';
    const batch = body.batch || 'General';
    const base64Data = body.photo_base64 || body.imageBase64 || body.imageUrl || '';

    const caption = `📝 New Mock Submission
👤 Student: ${studentName}
🆔 ID: ${studentId}
🏷️ Batch: ${batch}
📚 Subject: ${botConfig.title}
⏱️ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;

    if (base64Data && base64Data.length > 20) {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'answersheet.jpg');
      formData.append('caption', caption);

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: formData });
      const tgData = await tgRes.json().catch(() => ({}));
      if (!tgRes.ok || !tgData.ok) {
        return res.status(400).json({ error: `Telegram error: ${tgData.description}` });
      }
      return res.status(200).json({ success: true, subject: normSub, message_id: tgData.result.message_id });
    } else {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption })
      });
      return res.status(200).json({ success: true, subject: normSub });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
