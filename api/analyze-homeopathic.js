import OpenAI from "openai";
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

// ✅ Firebase Admin Safe Init
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin initialized with service account (Homeopathic)");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
}

const db = admin.firestore();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

  try {
    const { uid, name, age, gender, symptoms, severity, details } = req.body;
    if (!uid || !symptoms) return res.status(400).json({ success: false, error: "Missing fields" });

    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    if (oldCoins < 10)
      return res.status(400).json({ success: false, error: "Not enough coins" });

    await walletRef.update({
      coins: oldCoins - 10,
      lastTransaction: new Date().toISOString(),
      source: "analyze-homeopathic",
    });

    const prompt = `
You are a **Homeopathic AI Doctor**.
Apply classical Homeopathy principles (similia similibus curentur, temperament, emotional state) to analyze this patient.

Patient Details:
Name: ${name}
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Severity: ${severity}
Extra Info: ${details || "None"}

Respond in 3 parts:
1️⃣ Possible Homeopathic remedies (based on overall constitution)
2️⃣ Lifestyle & mental balance tips
3️⃣ Red flags for in-person doctor consultation

Never use these: #, *, and special symbols.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a gentle, safe, Homeopathic AI. Avoid unsafe or unverified advice." },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0].message.content.trim();

    await db.collection("analyses").add({
      userId: uid,
      agent: "homeopathic",
      form: { name, age, gender, symptoms, severity, details },
      results: { homeopathic: result },
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("💥 Homeopathic AI Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
