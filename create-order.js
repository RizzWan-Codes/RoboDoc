import Razorpay from "razorpay";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { coins, amount, uid } = req.body;
    if (!coins || !amount || !uid)
      return res.status(400).json({ error: "Missing fields" });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100, // amount in paise
      currency: "INR",
      receipt: `order_${uid}_${Date.now()}`,
      notes: { uid, coins },
    });

    return res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
