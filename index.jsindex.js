const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = "myfbwebhook2025"; // ✅ رمز التحقق الثابت

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verified");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object === "page") {
        for (const entry of body.entry) {
            for (const change of entry.changes) {
                if (change.field === "feed" && change.value.comment_id) {
                    const commentId = change.value.comment_id;
                    const commentMessage = change.value.message;

                    console.log("💬 تعليق جديد:", commentMessage);

                    const reply = await generateAIReply(commentMessage);
                    await replyToComment(commentId, reply);
                }
            }
        }
        res.status(200).send("EVENT_RECEIVED");
    } else {
        res.sendStatus(404);
    }
});

async function replyToComment(commentId, message) {
    const url = `https://graph.facebook.com/v18.0/${commentId}/comments?access_token=${PAGE_ACCESS_TOKEN}`;
    try {
        await axios.post(url, { message });
        console.log("✅ تم الرد على التعليق:", message);
    } catch (error) {
        console.error("❌ فشل في الرد:", error.response?.data || error.message);
    }
}

async function generateAIReply(userComment) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "أنت مساعد ذكي ترد بأدب وباختصار على تعليقات المتابعين على فيسبوك." },
                    { role: "user", content: userComment }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("❌ فشل توليد الرد:", error.response?.data || error.message);
        return "شكرًا لتعليقك! سنقوم بالرد عليك قريبًا 😊";
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Webhook يعمل على المنفذ ${PORT}`);
});
