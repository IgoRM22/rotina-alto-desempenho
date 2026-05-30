const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {FieldValue, getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9-]+\.github\.io$/,
];

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
