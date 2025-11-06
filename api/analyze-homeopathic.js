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

    if (!uid || !symptoms) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🧠 Smart prompt handling
    let prompt;

    if (followUp && lastResponse) {
      prompt = `
You are continuing a follow-up conversation as a compassionate Homeopathic doctor.

Your last advice was:
"${lastResponse}"

Now the patient says:
"${symptoms}"

Continue naturally as a kind, professional homeopath.
Be concise but caring. Keep the reply under 180 words.
`;
    } else {
      prompt = `
You are a compassionate Homeopathic doctor AI.
Use classical Homeopathic reasoning (constitution, modality, temperament, miasm) to understand the patient's condition.

Patient Details:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Symptoms: ${symptoms}
- Severity: ${severity}
- Extra Info: ${details || "None"}

Respond in 3 clear sections:
1. 🌿 Remedy suggestions (based on symptom pattern)
2. 🧘 Lifestyle advice for faster recovery
3. 🚨 When to consult a human doctor
`;
    }

    // 💬 Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a qualified Homeopathic AI providing gentle, safe, and educational advice. Never diagnose or prescribe real medication.",
        },
        { role: "user", content: prompt },
      ],
    });

    const result = completion.choices[0]?.message?.content?.trim() || "⚠️ No response received from AI.";

    // 🩺 Save analysis only for new sessions (not follow-ups)
    if (!followUp) {
      const cleanData = {
        userId: uid,
        agent: "homeopathic",
        form: { name, age, gender, symptoms, severity, details },
        results: { homeopathic: result },
        createdAt: new Date().toISOString(),
      };
      await db.collection("analyses").add(cleanData);
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("💊 Homeopathic AI Error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
}
