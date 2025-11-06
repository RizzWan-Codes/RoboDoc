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

    // 💰 Wallet check + deduction
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;

    const cost = followUp ? 1 : 10; // 1 coin for follow-up, 10 for new analysis
    
    // 🧠 Smart prompt
    let prompt;
    if (followUp && lastResponse) {
      prompt = `
You are continuing a follow-up conversation as a compassionate Homeopathic doctor.

Previously, you said:
"${lastResponse}"

Now the patient asks:
"${symptoms}"

Continue your response in the same gentle, classical Homeopathic tone.
Provide short, specific, and context-aware advice.
`;
    } else {
      prompt = `
You are a compassionate Homeopathic doctor AI.
Use classical Homeopathic reasoning to understand the patient's details:
Name: ${name}
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Severity: ${severity}
Extra Info: ${details || "None"}

Respond in 3 parts:
1. Remedy suggestions (based on symptom pattern, temperament)
2. Lifestyle advice for faster recovery
3. Red flags when a doctor visit is essential
`;
    }

    // 💬 AI Response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a qualified Homeopathic AI that provides safe, general suggestions only. Use classical homeopathic principles (constitution, modality, miasm, etc.).",
        },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0]?.message?.content || "No response";

    // 🩺 Save main analysis only (not follow-ups)
    if (!followUp) {
      await db.collection("analyses").add({
        userId: uid,
        agent: "homeopathic",
        form: { name, age, gender, symptoms, severity, details },
        results: { homeopathic: result },
        createdAt: new Date().toISOString(),
      });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("💊 Homeopathic AI Error:", err);
    res.status(500).json({ error: err.message });
  }
}

