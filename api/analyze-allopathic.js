import OpenAI from "openai";
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

// ✅ Firebase Admin Safe Init (works on Vercel)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin initialized with service account");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
}

const db = admin.firestore();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { uid, name, age, gender, symptoms, severity, details } = req.body;
    if (!uid || !symptoms)
      return res.status(400).json({ success: false, error: "Missing required fields" });

    // 🪙 Wallet check + deduction (flat 10 coins)
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;

    if (oldCoins < 10) {
      return res.status(400).json({ success: false, error: "Not enough coins" });
    }

    await walletRef.update({
      coins: oldCoins - 10,
      lastTransaction: new Date().toISOString(),
      source: "analyze-allopathic",
    });

    // 🧠 AI prompt
    const prompt = `
You are an Allopathic medical AI.
Use conventional Western medical reasoning to analyze the patient.
---
Patient Info:
Name: ${name}
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Severity: ${severity}
Extra Info: ${details || "None"}
---
Respond in 3 clear sections:
1️⃣ Possible medical conditions (common differentials)
2️⃣ Recommended over-the-counter remedies or precautions
3️⃣ When to seek urgent or emergency medical care

Never Use these: #, *, and special symbols.
    `;

    // 🩺 OpenAI Chat Completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an evidence-based allopathic doctor." },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0].message.content.trim();

    // 📄 Save result in Firestore
    const docRef = await db.collection("analyses").add({
      userId: uid,
      agent: "allopathic",
      form: { name, age, gender, symptoms, severity, details },
      results: { allopathic: result },
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, id: docRef.id, result });
  } catch (err) {
    console.error("💥 Allopathic AI Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

