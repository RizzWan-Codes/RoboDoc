import OpenAI from "openai";
import admin from "firebase-admin";

// 🧩 Safe Firebase Admin init
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
}

const db = admin.firestore();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const {
      uid,
      name,
      age,
      gender,
      symptoms,
      severity,
      details,
      followUp,
      lastResponse,
    } = req.body;

    if (!uid || !symptoms)
      return res.status(400).json({ error: "Missing fields" });

    // 💰 Wallet check and deduction
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;

    const cost = followUp ? 1 : 10; // 1 for follow-ups, 10 for first-time analysis
    if (oldCoins < cost)
      return res.status(400).json({ error: "Not enough coins" });

    await walletRef.update({
      coins: oldCoins - cost,
      lastTransaction: new Date().toISOString(),
      source: followUp ? "chat-message" : "full-analysis",
    });

    // 🧠 Smart prompt — remembers past response if follow-up
    let prompt;
    if (followUp && lastResponse) {
      prompt = `
You are continuing a follow-up Ayurvedic consultation.

Previously, you said:
"${lastResponse}"

Now the patient asks:
"${symptoms}"

Continue advising based on Ayurvedic reasoning (Dosha balance, diet, herbs, routine, etc.).
Keep it short, clear, and context-aware.
`;
    } else {
      prompt = `
You are an Ayurvedic medical expert AI.
Use Ayurvedic principles (Dosha, Agni, Prakriti, etc.) to analyze the patient's details:
Name: ${name}
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Severity: ${severity}
Extra Info: ${details || "None"}

Give the response in 3 parts:
1. Likely Imbalances or Doshas involved
2. Ayurvedic Remedies (home treatments, herbs, diet, and routine)
3. When to consult an Ayurvedic practitioner
`;
    }

    // 🪷 Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional Ayurvedic AI doctor. Use traditional Ayurvedic reasoning safely and clearly.",
        },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0]?.message?.content || "No response";

    // 🧾 Save only main analyses (not follow-ups)
    if (!followUp) {
      await db.collection("analyses").add({
        userId: uid,
        agent: "ayurvedic",
        form: { name, age, gender, symptoms, severity, details },
        results: { ayurvedic: result },
        createdAt: new Date().toISOString(),
      });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("🌿 Ayurvedic AI Error:", err);
    res.status(500).json({ error: err.message });
  }
}
