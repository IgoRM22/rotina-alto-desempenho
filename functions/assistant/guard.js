const { FieldValue } = require("firebase-admin/firestore");

const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT || 200);

// Limite diário via transação no Firestore, nunca em memória — com múltiplas
// instâncias da função rodando ao mesmo tempo, uma variável local perderia
// incrementos por corrida entre instâncias.
async function checkAndIncrementUsage(db, uid, clientDate) {
  const ref = db.collection("users").doc(uid).collection("assistantUsage").doc(clientDate);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data().count || 0) : 0;

    if (current >= DAILY_LIMIT) {
      return { allowed: false, count: current, limit: DAILY_LIMIT };
    }

    tx.set(ref, {
      count: current + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { allowed: true, count: current + 1, limit: DAILY_LIMIT };
  });
}

// requestId gerado pelo cliente garante que uma retentativa de rede (timeout,
// reconexão) nunca duplica uma escrita. Se o mesmo requestId já foi concluído,
// devolve a resposta cacheada em vez de executar de novo.
async function claimIdempotentRequest(db, uid, requestId) {
  const ref = db.collection("users").doc(uid).collection("assistantRequests").doc(requestId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data();
      if (data.status === "done") return { claimed: false, cached: data.response };
      return { claimed: false, cached: null }; // pending — cliente deve tentar de novo mais tarde
    }

    tx.set(ref, { status: "pending", createdAt: FieldValue.serverTimestamp() });
    return { claimed: true };
  });
}

const completeIdempotentRequest = (db, uid, requestId, response) =>
  db.collection("users").doc(uid).collection("assistantRequests").doc(requestId).set({
    status: "done",
    response,
    completedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

const logExecution = (db, uid, entry) =>
  db.collection("users").doc(uid).collection("assistantLogs").add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });

module.exports = { checkAndIncrementUsage, claimIdempotentRequest, completeIdempotentRequest, logExecution };
