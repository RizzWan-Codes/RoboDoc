import Razorpay from "razorpay";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { coins, amount, uid } = req.body;

    if (!coins || !amount || !uid) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🪙 Initialize Razorpay client
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // ✅ Generate a safe short receipt (< 40 chars)
    const shortUid = uid.slice(0, 8); // first 8 chars of uid
    const shortTime = Date.now().toString(36); // compact timestamp
    const receipt = `rcpt_${shortUid}_${shortTime}`.slice(0, 40); // always < 40

    // 🧾 Create order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // amount in paise
      currency: "INR",
      receipt, // safe short one
      notes: { uid, coins },
    });

    // ✅ Respond to frontend
    return res.status(200).json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error("⚠️ Razorpay Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  }
}
