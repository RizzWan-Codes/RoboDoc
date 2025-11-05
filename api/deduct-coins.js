import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!global._firebaseAdminApp) {
  global._firebaseAdminApp = initializeApp({ projectId: "robodoc-db1d3" });
}
const db = getFirestore(global._firebaseAdminApp);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { uid, amount, reason } = req.body;
    if (!uid || !amount) return res.status(400).json({ success: false, message: "Missing fields" });

    const userRef = db.collection("wallets").doc(uid);
    const docSnap = await userRef.get();

    let balance = docSnap.exists ? docSnap.data().coins || 0 : 0;
    if (balance < amount)
      return res.status(400).json({ success: false, message: "Insufficient balance" });

    const newBalance = balance - amount;
    await userRef.update({
      coins: newBalance,
      lastDeduction: new Date().toISOString(),
      lastReason: reason || "usage",
    });

    return res.status(200).json({ success: true, newBalance });
  } catch (err) {
    console.error("Deduct Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
