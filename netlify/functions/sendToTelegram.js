
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const subject = String(data.subject || "").trim().toUpperCase();

    let token;

    if (subject.includes("MATH")) {
      token = process.env.MATHS_BOT_TOKEN;
    } else if (subject.includes("PHYSICAL") || subject === "P SCI") {
      token = process.env.P_SCI_BOT_TOKEN;
    } else if (subject.includes("LIFE") || subject === "L SCI") {
      token = process.env.L_SCI_BOT_TOKEN;
    } else if (subject.includes("BENGALI") || subject.includes("ENGLISH")) {
      token = process.env.LANG_BOT_TOKEN;
    } else if (subject.includes("HISTORY") || subject.includes("GEOGRAPHY")) {
      token = process.env.HISTORY_GEOGRAPHY_BOT_TOKEN;
    } else {
      return reply(400, { error: "Unsupported subject: " + subject });
    }

    if (!token) {
      return reply(500, { error: "Bot token is missing in Netlify." });
    }

    const updatesRes = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`
    );
    const updates = await updatesRes.json();

    if (!updatesRes.ok || !updates.ok) {
      return reply(502, {
        error: updates.description || "Could not retrieve Telegram updates."
      });
    }

    const messages = (updates.result || []).filter(
      (item) => item.message?.chat?.id != null
    );

    const last = messages[messages.length - 1];
    const chatId = last?.message?.chat?.id;

    if (!chatId) {
      return reply(400, {
        error: "Start the correct Telegram bot and send it /start first."
      });
    }

    let base64 = String(data.photo_base64 || "");
    if (base64.includes(",")) {
      base64 = base64.split(",")[1];
    }

    if (!base64) {
      return reply(400, { error: "Answer-sheet photo is missing." });
    }

    const buffer = Buffer.from(base64, "base64");

    if (!buffer.length) {
      return reply(400, { error: "Invalid photo data." });
    }

    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append(
      "caption",
      `📝 ${subject}\nFrom: ${data.userName || "Student"}`
    );
    form.append(
      "photo",
      new Blob([buffer], { type: "image/jpeg" }),
      "answer.jpg"
    );

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      { method: "POST", body: form }
    );

    const tgJson = await tgRes.json();

    if (!tgRes.ok || !tgJson.ok) {
      return reply(502, {
        error: tgJson.description || "Telegram failed to send the photo."
      });
    }

    return reply(200, { success: true, message: "Answer sheet sent." });
  } catch (error) {
    return reply(500, {
      error: error.message || "Internal server error"
    });
  }
};
