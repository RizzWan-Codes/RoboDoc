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

    // 🚫 Removed wallet deduction (handled in dashboard)
    // const walletRef = db.collection("wallets").doc(uid);
    // const walletSnap = await walletRef.get();
    // const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    // const cost = followUp ? 1 : 10;
    // if (oldCoins < cost) return res.status(400).json({ error: "Not enough coins" });
    // await walletRef.update({ coins: oldCoins - cost });

    // 🧠 Smart prompt
    let prompt;
    if (followUp && lastResponse) {
      prompt = `
You are continuing a follow-up Ayurvedic consultation.

Previously, you advised:
"${lastResponse}"

Now the patient says:
"${symptoms}"

Continue naturally using Ayurvedic reasoning — focus on Dosha balance, diet, lifestyle, and herbs.
Keep it concise, warm, and personalized.
`;
    } else {
      prompt = `
You are an experienced Ayurvedic doctor AI.
Analyze the patient's condition using traditional Ayurvedic principles such as Dosha imbalance, Agni, and Prakriti.

Patient details:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Symptoms: ${symptoms}
- Severity: ${severity}
- Additional Info: ${details || "None"}

Provide a structured response with:
1. 🌿 Dosha Imbalance Analysis
2. 🍵 Home Remedies, Herbs, and Diet
3. ⚕️ When to Consult a Practitioner
`;
    }

    // 💬 Generate response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional Ayurvedic AI doctor. Use authentic Ayurvedic reasoning but keep it simple, safe, and practical for modern users.",
        },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0]?.message?.content?.trim() || "⚠️ No response received from AI.";

    // 🧾 Save analysis (main only)
    if (!followUp) {
      const cleanData = {
        userId: uid,
        agent: "ayurvedic",
        form: { name, age, gender, symptoms, severity, details },
        results: { ayurvedic: result },
        createdAt: new Date().toISOString(),
      };
      await db.collection("analyses").add(cleanData);
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("🌿 Ayurvedic AI Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
