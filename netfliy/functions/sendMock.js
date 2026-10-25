exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    let subject = (data.subject || "").toUpperCase();

    // Dot, space sob remove kore normal kora
    const clean = subject.replace(/[^A-Z]/g, ""); // MATHS, PSCi, LSCi, BENGALI etc

    let token = null;
    if (clean.includes("MATH")) token = process.env.MATHS_BOT_TOKEN;
    else if (clean.includes("P") && clean.includes("SCI")) token = process.env.P_SCI_BOT_TOKEN;
    else if (clean.includes("L") && clean.includes("SCI")) token = process.env.L_SCI_BOT_TOKEN;
    else if (clean.includes("BENGALI") || clean.includes("ENG") || clean.includes("LANG")) token = process.env.LANG_BOT_TOKEN;
    else if (clean.includes("HIST") || clean.includes("GEO")) token = process.env.HISTORY_GEOGRAPHY_BOT_TOKEN;

    if (!token) return { statusCode: 400, body: JSON.stringify({ error: "No bot for " + subject }) };

    const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const updates = await updatesRes.json();
    const lastMsg = updates.result?.[updates.result.length - 1];
    const chatId = lastMsg?.message?.chat?.id || lastMsg?.my_chat_member?.chat?.id;

    if (!chatId) return { statusCode: 200, body: JSON.stringify({ msg: "Sir ke bolo bot e /start likhte" }) };

    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        caption: `📝 ${subject}\nFrom: ${data.userName || 'Student'}`,
        photo: data.photo_base64
      })
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
