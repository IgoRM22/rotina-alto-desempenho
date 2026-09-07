const webpush = require("web-push");

const VAPID_SUBJECT = "mailto:igor.ramosc1@gmail.com";
// Chave pública VAPID — não é segredo por design (vai exposta no frontend
// também), só a privada (VAPID_PRIVATE_KEY) fica no Secret Manager.
const VAPID_PUBLIC_KEY = "BCYGN6VJOkXH3uCUoHubsQ5xgbm0osWw2WkoAmdqE5ETmVLYlf1CveKlj0lpLQUeLLgkBAr4ue-OmuyazCIF7SI";

let configured = false;
const ensureConfigured = () => {
  if (configured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  configured = true;
};

const base = (db, uid) => db.collection("users").doc(uid).collection("pushSubscriptions");

// Manda pra todas as inscrições do usuário; remove do Firestore as que o
// navegador já invalidou (410 Gone / 404) — evita acumular lixo e tentar
// de novo pra sempre num dispositivo que não existe mais.
async function sendPushToUser(db, uid, payload) {
  ensureConfigured();
  const snap = await base(db, uid).get();
  if (snap.empty) return {sent: 0};

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(snap.docs.map(async (doc) => {
    try {
      await webpush.sendNotification(doc.data().subscription, body);
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await doc.ref.delete();
      }
    }
  }));

  return {sent};
}

module.exports = {sendPushToUser};
