const { getAuth } = require("firebase-admin/auth");

// O Admin SDK ignora as Firestore Rules — por isso esta função precisa repetir,
// explicitamente, a mesma checagem de autorização que as rules fazem no cliente
// (accessControl.allowedEmails), em vez de confiar só em "token válido".
async function verifyAuthorizedUser(db, req) {
  const authHeader = req.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: 401, message: "missing bearer token" };
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return { error: 401, message: "invalid bearer token" };

  let decoded;
  try {
    // Sem checkRevoked (segundo argumento): isso evita uma chamada de rede extra
    // ao Firebase Auth a cada comando só para checar revogação — o token já
    // expira sozinho em ~1h, e um e-mail removido é bloqueado no próximo
    // comando de qualquer forma (checagem contra accessControl abaixo).
    decoded = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    return { error: 401, message: "invalid token", detail: err.message };
  }

  const email = (decoded.email || "").trim().toLowerCase();
  if (!email) return { error: 403, message: "forbidden" };

  const accessSnap = await db.collection("system").doc("accessControl").get();
  const allowedEmails = accessSnap.exists && Array.isArray(accessSnap.data().allowedEmails)
    ? accessSnap.data().allowedEmails.map((e) => String(e).trim().toLowerCase())
    : [];

  if (!allowedEmails.includes(email)) {
    return { error: 403, message: "forbidden" };
  }

  return { uid: decoded.uid, email };
}

module.exports = { verifyAuthorizedUser };
