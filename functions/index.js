const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {FieldValue, getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const OWNER_EMAIL =
  (process.env.OWNER_EMAIL || "").trim().toLowerCase();

const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9-]+\.github\.io$/,
];

const requireOwner = async (req, res) => {
  const authHeader = req.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      ok: false,
      error: "missing bearer token",
    });
    return null;
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    res.status(401).json({
      ok: false,
      error: "invalid bearer token",
    });
    return null;
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken, true);
    const tokenEmail = (decoded.email || "").trim().toLowerCase();

    if (OWNER_EMAIL && tokenEmail !== OWNER_EMAIL) {
      res.status(403).json({
        ok: false,
        error: "forbidden",
      });
      return null;
    }

    return {
      uid: decoded.uid,
      email: tokenEmail,
    };
  } catch (error) {
    logger.warn("token verification failed", {error: error.message});
    res.status(401).json({
      ok: false,
      error: "invalid token",
    });
    return null;
  }
};

exports.api = onRequest(
    {
      region: "southamerica-east1",
      cors: allowedOrigins,
    },
    async (req, res) => {
      const cleanPath = (req.path || "/").replace(/\/+$/, "") || "/";

      if (req.method === "GET" && (cleanPath === "/" || cleanPath === "/health")) {
        return res.status(200).json({
          ok: true,
          service: "rotina-backend",
          timestamp: new Date().toISOString(),
        });
      }

      const owner = await requireOwner(req, res);
      if (!owner) {
        return;
      }

      if (req.method === "POST" && cleanPath === "/lead") {
        const body = req.body || {};
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const note = typeof body.note === "string" ? body.note.trim() : "";

        if (!name || !email) {
          return res.status(400).json({
            ok: false,
            error: "name and email are required",
          });
        }

        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailValid) {
          return res.status(400).json({
            ok: false,
            error: "invalid email",
          });
        }

        const doc = await db.collection("leads").add({
          name,
          email,
          note,
          ownerUid: owner.uid,
          ownerEmail: owner.email,
          createdAt: FieldValue.serverTimestamp(),
          source: req.get("origin") || "unknown",
        });

        logger.info("lead stored", {id: doc.id});

        return res.status(201).json({
          ok: true,
          id: doc.id,
        });
      }

      return res.status(404).json({
        ok: false,
        error: "route not found",
      });
    },
);
