import OpenAI from "openai";
import admin from "firebase-admin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method Not Allowed" });

  try {
    const { uid } = req.body;
    if (!uid) return res.json({ success: false, error: "Missing user ID" });

    // 🔍 Fetch last 10 analyses for deeper health context
    const analysesRef = db.collection("analyses")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(10);

    const snap = await analysesRef.get();
    if (snap.empty) return res.json({ success: false, error: "No analyses found" });

    const history = [];
    snap.forEach(doc => {
      const f = doc.data().form || {};
      history.push({
        date: doc.data().createdAt || "Recent",
        symptoms: f.symptoms || "N/A",
        severity: f.severity || "-",
        age: f.age || "-",
        gender: f.gender || "-"
      });
    });

    const formattedHistory = history.map((h, i) => 
      `${i + 1}. [${h.date?.seconds ? new Date(h.date.seconds * 1000).toLocaleDateString() : "Recent"}] Symptoms: ${h.symptoms} | Severity: ${h.severity} | Age: ${h.age} | Gender: ${h.gender}`
    ).join("\n");

    // 💰 Deduct 2 coins for summary
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    if (oldCoins < 2) return res.json({ success: false, error: "Not enough coins" });
    await walletRef.update({ coins: oldCoins - 2, lastTransaction: new Date().toISOString() });

    // 🧠 AI Health Summarizer Prompt
    const prompt = `
You are RoboDoc's Health Summarizer — a smart AI medical analyst.

Here is the patient's recent health data:
${formattedHistory}

Your task:
1. Provide a short intro greeting and overall health summary.
2. Identify key patterns or recurring symptoms.
3. Mention the most common or likely issues they've been facing.
4. Analyze how their health is improving or declining over time.
5. Suggest 3 concrete improvements they can make.
6. Give a positivity score out of 10.
7. End with a short, motivational health message.

Format:
🧾 Health Overview:
📈 Trends:
⚠️ Common Issues:
💪 Suggestions:
⭐ Health Score:
💬 Final Advice:
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert AI health summarizer that provides friendly, insightful, and safe feedback." },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0].message.content.trim();
    res.json({ success: true, result });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
}
