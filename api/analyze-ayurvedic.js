import OpenAI from "openai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!global._firebaseApp) {
  global._firebaseApp = initializeApp({ projectId: "robodoc-db1d3" });
}
const db = getFirestore(global._firebaseApp);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { uid, name, age, gender, symptoms, severity, details } = req.body;
    if (!uid || !symptoms) return res.status(400).json({ error: "Missing fields" });

    // Deduct coins
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    if (oldCoins < 10) return res.status(400).json({ error: "Not enough coins" });

    await walletRef.update({
      coins: oldCoins - 10,
      lastTransaction: new Date().toISOString(),
    });

    const prompt = `
You are an Ayurvedic medical expert AI.
Use Ayurvedic principles (Dosha, Agni, Prakriti, etc.) to analyze the patient's details:
Name: ${name}
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Severity: ${severity}
Extra Info: ${details || "None"}

Give the response in 3 parts:
1. Likely Imbalances or Doshas
2. Suggested Ayurvedic Remedies (home treatments, herbs, diet)
3. When to consult an Ayurvedic practitioner
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional Ayurvedic AI doctor. Never give unsafe advice." },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0].message.content;

    const docRef = await db.collection("analyses").add({
      userId: uid,
      agent: "ayurvedic",
      form: { name, age, gender, symptoms, severity, details },
      results: { ayurvedic: result },
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, id: docRef.id, result });
  } catch (err) {
    console.error("Ayurvedic AI Error:", err);
    res.status(500).json({ error: err.message });
  }
}
