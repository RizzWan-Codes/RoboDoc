import crypto from "crypto";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!global._firebaseAdminApp) {
  global._firebaseAdminApp = initializeApp({ projectId: "robodoc-db1d3" });
}
const db = getFirestore(global._firebaseAdminApp);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { uid, coins, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!uid || !coins || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, message: "Missing required fields" });

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const userRef = db.collection("wallets").doc(uid);
    const docSnap = await userRef.get();
    const oldBalance = docSnap.exists ? docSnap.data().coins || 0 : 0;
    const newBalance = oldBalance + Number(coins);

    await userRef.set(
      { coins: newBalance, lastTransaction: new Date().toISOString() },
      { merge: true }
    );

    return res.status(200).json({ success: true, newBalance });
  } catch (err) {
    console.error("Verify Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
