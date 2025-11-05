import OpenAI from "openai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";

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
const db = getFirestore(global._firebaseApp);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { uid, name, age, gender, symptoms, severity, details } = req.body;
    if (!uid || !symptoms) return res.status(400).json({ error: "Missing fields" });

    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    // 🪙 Deduct coins (10 for first analysis, 1 for follow-ups)
const cost = req.body.followUp ? 1 : 10;

if (oldCoins < cost) return res.status(400).json({ error: "Not enough coins" });

await walletRef.update({
  coins: oldCoins - cost,
  lastTransaction: new Date().toISOString(),
  source: req.body.followUp ? "chat-message" : "full-analysis",
});


    const prompt = `
You are an Allopathic medical AI.
Use conventional Western medical reasoning to analyze the patient:
Name: ${name}
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Severity: ${severity}
Extra Info: ${details || "None"}

Respond in 3 sections:
1. Possible medical conditions (based on common differentials)
2. Recommended over-the-counter steps or precautions
3. When to seek medical or emergency care
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an AI doctor who follows evidence-based medicine." },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0].message.content;

    const docRef = await db.collection("analyses").add({
      userId: uid,
      agent: "allopathic",
      form: { name, age, gender, symptoms, severity, details },
      results: { allopathic: result },
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, id: docRef.id, result });
  } catch (err) {
    console.error("Allopathic AI Error:", err);
    res.status(500).json({ error: err.message });
  }
}

