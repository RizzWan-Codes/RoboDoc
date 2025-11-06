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

    // 🔍 Fetch last 5 analyses
    const analysesRef = db.collection("analyses")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(5);

    const snap = await analysesRef.get();
    if (snap.empty) return res.json({ success: false, error: "No past analyses found" });

    const history = [];
    snap.forEach(doc => {
      const f = doc.data().form || {};
      history.push(`Symptoms: ${f.symptoms || "N/A"} | Severity: ${f.severity || "-"} | Age: ${f.age || "-"} | Gender: ${f.gender || "-"}`);
    });

    const formattedHistory = history.join("\n");

    // 💰 Deduct 2 coins
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldCoins = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    if (oldCoins < 2) return res.json({ success: false, error: "Not enough coins" });
    await walletRef.update({ coins: oldCoins - 2, lastTransaction: new Date().toISOString() });

    // 🧠 AI prompt
    const prompt = `
You are an AI Nutritionist.
Based on the following patient's recent health records:
${formattedHistory}

Generate:
1. A summary of the user's current health condition.
2. Personalized nutrition goals.
3. A daily meal plan (Breakfast, Lunch, Dinner).
4. Calorie & macronutrient targets.
5. General advice for better recovery and energy.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional AI Nutritionist giving safe, science-based advice." },
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
