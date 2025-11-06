import OpenAI from "openai";
import admin from "firebase-admin";

// 🧩 Initialize Firebase Admin safely
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

    // 🚫 Removed coin deduction — handled by dashboard
    // const walletRef = db.collection("wallets").doc(uid);
    // const walletSnap = await walletRef.get();
    // const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    // const cost = followUp ? 1 : 10;

    // 🧠 Context-aware prompt
    let prompt;
    if (followUp && lastResponse) {
      prompt = `
You are continuing a follow-up conversation as an Allopathic doctor.

Previously, you advised:
"${lastResponse}"

Now the patient says:
"${symptoms}"

Continue the conversation in a professional, clear, and evidence-based tone.
Keep it short, medically accurate, and focused.
`;
    } else {
      prompt = `
You are an Allopathic medical AI.
Use conventional Western medical reasoning to analyze the patient's details:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Symptoms: ${symptoms}
- Severity: ${severity}
- Additional Info: ${details || "None"}

Respond in 3 concise sections:
1. 🧠 Possible medical conditions (based on common differentials)
2. 💊 Over-the-counter steps or lifestyle precautions
3. 🚨 When to seek medical or emergency care
`;
    }

    // 💬 Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an AI doctor trained in evidence-based medicine. Provide accurate, safe, and helpful medical advice without overstepping ethical limits.",
        },
        { role: "user", content: prompt },
      ],
    });

    const result =
      completion.choices[0]?.message?.content?.trim() || "⚠️ No response received.";

    // 🩺 Save main analysis (not follow-ups)
    if (!followUp) {
      const data = {
        userId: uid,
        agent: "allopathic",
        form: { name, age, gender, symptoms, severity, details },
        results: { allopathic: result },
        createdAt: new Date().toISOString(),
      };
      await db.collection("analyses").add(data);
    }

    // ✅ Return result
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("💊 Allopathic AI Error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
}
