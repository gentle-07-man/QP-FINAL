exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  try {
    const data = JSON.parse(event.body || "{}");
    let subject = (data.subject || "").toUpperCase();
    const clean = subject.replace(/[^A-Z]/g, "");

    let token = null;
    if (clean.includes("MATH")) token = process.env.MATHS_BOT_TOKEN;
    else if (clean.includes("P") && clean.includes("SCI")) token = process.env.P_SCI_BOT_TOKEN;
    else if (clean.includes("L") && clean.includes("SCI")) token = process.env.L_SCI_BOT_TOKEN;
    else if (clean.includes("BENGALI") || clean.includes("ENG") || clean.includes("LANG")) token = process.env.LANG_BOT_TOKEN;
    else if (clean.includes("HIST") || clean.includes("GEO")) token = process.env.HISTORY_GEOGRAPHY_BOT_TOKEN;

    if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: "No bot for " + subject }) };

    // Get Chat ID
    const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const updates = await updatesRes.json();
    const last = updates.result?.[updates.result.length - 1];
    const chatId = last?.message?.chat?.id || last?.my_chat_member?.chat?.id;
    if (!chatId) return { statusCode: 200, headers, body: JSON.stringify({ error: "Sir ke bolo bot e /start likhte" }) };

    // Base64 to Blob and send as FormData
    let base64 = data.photo_base64 || "";
    if (base64.includes(",")) base64 = base64.split(",")[1];
    const buffer = Buffer.from(base64, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", `📝 ${subject}\nFrom: ${data.userName || 'Student'}`);
    form.append("photo", blob, "answer.jpg");

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    const tgJson = await tgRes.json();

    if (!tgJson.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: tgJson.description }) };

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
