import crypto from "crypto";
import admin from "firebase-admin";

// ✅ Initialize Firebase Admin (once)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin initialized with service account");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { uid, coins, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // ✅ Validate required fields
    if (!uid || !coins || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ✅ Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.warn("⚠️ Invalid Razorpay Signature");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // ✅ Update Firestore wallet balance
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await walletRef.get();
    const oldBalance = walletSnap.exists ? walletSnap.data().coins || 0 : 0;
    const newBalance = oldBalance + Number(coins);

    await walletRef.set(
      {
        coins: newBalance,
        lastTransaction: new Date().toISOString(),
        lastPaymentId: razorpay_payment_id,
        lastOrderId: razorpay_order_id,
      },
      { merge: true }
    );

    console.log(`✅ User ${uid} credited with ${coins} coins. New balance: ${newBalance}`);

    return res.status(200).json({ success: true, newBalance });
  } catch (err) {
    console.error("🔥 Verify-payment Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}
