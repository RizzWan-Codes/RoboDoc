import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!global._firebaseAdminApp) {
  global._firebaseAdminApp = initializeApp({ projectId: "robodoc-db1d3" });
}
const db = getFirestore(global._firebaseAdminApp);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    const userRef = db.collection("wallets").doc(uid);
    const docSnap = await userRef.get();
    const coins = docSnap.exists ? docSnap.data().coins || 0 : 0;

    return res.status(200).json({ coins });
  } catch (err) {
    console.error("Get Balance Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
