const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {FieldValue, getFirestore} = require("firebase-admin/firestore");
const {GoogleGenAI} = require("@google/genai");

const {verifyAuthorizedUser} = require("./assistant/auth");
const {checkAndIncrementUsage, claimIdempotentRequest, completeIdempotentRequest, logExecution} =
  require("./assistant/guard");
const {buildContext, SYSTEM_PROMPT} = require("./assistant/context");
const {TOOLS} = require("./assistant/tools");
const {executeTool} = require("./assistant/executor");
const {isReadTool, formatWriteConfirmation, formatConfirmationPrompt} = require("./assistant/format");
const {detectSignal} = require("./assistant/signals");
const {sendPushToUser} = require("./assistant/push");

initializeApp();
const db = getFirestore();
// Rede de segurança: um campo `undefined` (ex: pendingArgs quando não há
// confirmação pendente) faz o Admin SDK rejeitar a escrita inteira por
// padrão — melhor ignorar esses campos do que descobrir isso em produção.
db.settings({ignoreUndefinedProperties: true});
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

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Flash-Lite é a família da Google desenhada especificamente pra isto —
// tarefas curtas, de alta frequência, com function-calling (não raciocínio
// profundo). Fixamos uma versão específica (não "-latest") porque a própria
// documentação recomenda isso em produção — um alias pode trocar de modelo
// por baixo dos panos sem aviso, como já nos mordeu antes com thinkingConfig.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const MAX_HISTORY_TURNS = 8;

// Traduz o erro técnico numa mensagem que a pessoa realmente consegue agir —
// "tenta de novo" é diferente de "espera um pouco, a API está sobrecarregada".
const friendlyErrorMessage = (error) => {
  const text = `${error?.message || ""} ${error?.status || ""}`;
  if (/too many requests|429|resource_exhausted/i.test(text)) {
    return "O Gemini está com limite de uso atingido no momento. Espera uns 30 segundos e tenta de novo.";
  }
  if (/unavailable|503|overloaded|high demand/i.test(text)) {
    return "O modelo está sobrecarregado agora. Tenta de novo em instantes.";
  }
  return "Não consegui completar isso agora. Tenta reformular ou de novo em instantes.";
};
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

// Histórico vem do cliente (texto puro, sem functionCall/functionResponse —
// isso mantém a function stateless de verdade, sem sessão guardada no
// servidor) só para dar memória de conversa ao modelo — perguntas de
// acompanhamento, ambiguidade resolvida no turno seguinte, etc.
const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({role: m.role === "user" ? "user" : "model", parts: [{text: m.text.trim()}]}));
};

// Stateless por design: nenhuma variável guardada em memória entre chamadas.
// Como o Cloud Functions pode rodar várias instâncias ao mesmo tempo, qualquer
// estado "na memória da função" existiria só naquela instância — por isso o
// rate limit e a idempotência vivem no Firestore (assistant/guard.js), nunca aqui.
exports.assistantCommand = onRequest(
    {
      region: "southamerica-east1",
      cors: allowedOrigins,
      secrets: ["GEMINI_API_KEY"],
    },
    async (req, res) => {
      const t0 = Date.now();
      if (req.method !== "POST") {
        return res.status(405).json({ok: false, error: "method not allowed"});
      }

      const authResult = await verifyAuthorizedUser(db, req);
      if (authResult.error) {
        return res.status(authResult.error).json({ok: false, error: authResult.message});
      }
      const {uid} = authResult;
      const tAuth = Date.now();

      const body = req.body || {};
      const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
      const clientDate = DATE_KEY_RE.test(body.clientDate || "")
        ? body.clientDate
        : new Date().toISOString().slice(0, 10);

      if (!requestId) {
        return res.status(400).json({ok: false, error: "requestId is required"});
      }

      // Idempotência e rate limit tocam documentos diferentes e não dependem
      // um do outro para decidir se a requisição prossegue — rodar em paralelo
      // evita uma rodada inteira de latência de Firestore.
      const [claim, usage] = await Promise.all([
        claimIdempotentRequest(db, uid, requestId),
        checkAndIncrementUsage(db, uid, clientDate),
      ]);
      const tGuard = Date.now();

      if (!claim.claimed) {
        if (claim.cached) return res.status(200).json(claim.cached);
        return res.status(409).json({ok: false, error: "request already in progress"});
      }

      if (!usage.allowed) {
        const failure = {ok: false, error: `limite diário de ${usage.limit} comandos atingido`};
        await completeIdempotentRequest(db, uid, requestId, failure);
        return res.status(429).json(failure);
      }

      // ── Modo confirmação: o usuário já aprovou uma ação proposta no turno
      // anterior. Executa direto, sem tocar o Gemini — rápido, e o único
      // caminho onde uma ferramenta de escrita realmente grava algo.
      if (body.confirm === true) {
        const tool = typeof body.tool === "string" ? body.tool : "";
        const args = (body.args && typeof body.args === "object") ? body.args : {};

        if (!TOOL_NAMES.has(tool) || isReadTool(tool)) {
          const failure = {ok: false, error: "invalid tool for confirmation"};
          await completeIdempotentRequest(db, uid, requestId, failure);
          return res.status(400).json(failure);
        }

        try {
          const toolResult = await executeTool(db, uid, clientDate, tool, args, {dryRun: false});
          const message = formatWriteConfirmation(tool, toolResult);
          const result = {ok: true, message, tool, toolResult};

          await Promise.all([
            completeIdempotentRequest(db, uid, requestId, result),
            logExecution(db, uid, {command: `[confirm] ${tool}`, tool, toolResult, requestId}),
          ]);

          logger.info("assistantCommand confirm", {uid, tool, totalMs: Date.now() - t0});
          return res.status(200).json(result);
        } catch (error) {
          logger.error("assistantCommand confirm failed", {error: error.message, errorName: error.name, uid, tool});
          const failure = {ok: false, error: friendlyErrorMessage(error)};
          await completeIdempotentRequest(db, uid, requestId, failure);
          return res.status(500).json(failure);
        }
      }

      // ── Modo normal: primeira mensagem do usuário sobre um novo comando.
      const command = typeof body.command === "string" ? body.command.trim() : "";
      if (!command) {
        return res.status(400).json({ok: false, error: "command is required"});
      }

      try {
        const context = await buildContext(db, uid, clientDate);
        const tContext = Date.now();

        // Sobrecarga temporária da própria API do Gemini (429/500/502/503/504) é
        // esperada em uso normal — a SDK já tem retry com backoff exponencial
        // embutido, só precisa ser ligado via httpOptions.retryOptions.
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          // 6 tentativas com backoff exponencial já chegou a levar ~30s numa
          // única mensagem de chat — melhor falhar rápido com uma mensagem
          // clara (friendlyErrorMessage) do que travar a pessoa esperando.
          // timeout limita cada tentativa individual — sem isso, uma única
          // chamada lenta (visto: ~29s numa chamada só, sem nem precisar de
          // retry) some no meio do caminho sem teto nenhum.
          httpOptions: {timeout: 12000, retryOptions: {attempts: 2}},
        });

        const config = {
          systemInstruction: `${SYSTEM_PROMPT}\n\nContexto atual (JSON):\n${JSON.stringify(context)}`,
          tools: [{functionDeclarations: TOOLS}],
          // Resposta é sempre 1-2 frases curtas por design — travar um teto
          // baixo de tokens corta o tempo de geração (é literalmente
          // token-a-token), sem perder nada do que já pedimos no prompt.
          maxOutputTokens: 300,
          // thinkingConfig.thinkingLevel foi tentado para cortar latência, mas
          // "gemini-flash-latest" rejeitou o campo com 400 Bad Request — removido
          // até confirmar qual geração do modelo aceita esse parâmetro.
        };

        const contents = [...sanitizeHistory(body.history), {role: "user", parts: [{text: command}]}];

        let response = await ai.models.generateContent({model: GEMINI_MODEL, contents, config});
        const tGemini1 = Date.now();

        let toolName = null;
        let toolResult = null;
        let message = null;
        let needsConfirmation = false;
        let pendingArgs = null;

        const calls = response.functionCalls;
        if (calls && calls.length > 0) {
          const call = calls[0]; // uma ação por comando, por design — nada de paralelismo aqui.
          toolName = call.name;
          const args = call.args || {};

          if (isReadTool(call.name)) {
            // Leitura: sem risco, executa direto; só o modelo sabe transformar
            // os dados brutos em prosa, por isso a segunda chamada.
            toolResult = await executeTool(db, uid, clientDate, call.name, args);
            contents.push({role: "model", parts: response.candidates[0].content.parts});
            contents.push({
              role: "user",
              parts: [{
                functionResponse: {id: call.id, name: call.name, response: {result: toolResult}},
              }],
            });
            response = await ai.models.generateContent({model: GEMINI_MODEL, contents, config});
            message = response.text || "Feito.";
          } else {
            // Escrita: nunca executa aqui. Resolve/valida em modo dryRun (sem
            // gravar nada) e devolve uma pergunta de confirmação — a ação só
            // acontece de fato se o usuário confirmar no chat.
            const preview = await executeTool(db, uid, clientDate, call.name, args, {dryRun: true});
            toolResult = preview;
            if (!preview.ok) {
              message = formatWriteConfirmation(call.name, preview);
            } else {
              needsConfirmation = true;
              pendingArgs = args;
              message = formatConfirmationPrompt(call.name, args, preview);
            }
          }
        } else {
          message = response.text || "Feito.";
        }
        const tTool = Date.now();

        const result = {
          ok: true,
          message,
          tool: toolName,
          toolResult,
          needsConfirmation,
          pendingArgs: needsConfirmation ? pendingArgs : undefined,
        };

        await Promise.all([
          completeIdempotentRequest(db, uid, requestId, result),
          logExecution(db, uid, {command, tool: toolName, toolResult, requestId}),
        ]);

        logger.info("assistantCommand timing", {
          uid,
          tool: toolName,
          needsConfirmation,
          authMs: tAuth - t0,
          guardMs: tGuard - tAuth,
          contextMs: tContext - tGuard,
          gemini1Ms: tGemini1 - tContext,
          toolAndGemini2Ms: tTool - tGemini1,
          totalMs: Date.now() - t0,
        });

        return res.status(200).json(result);
      } catch (error) {
        // error.message do AbortError do p-retry (erros HTTP não-retentáveis,
        // como 400) não inclui o corpo da resposta — name + status ajudam a
        // não ficar às cegas na próxima vez.
        logger.error("assistantCommand failed", {
          error: error.message,
          errorName: error.name,
          status: error.status,
          uid,
        });
        const failure = {ok: false, error: friendlyErrorMessage(error)};
        await completeIdempotentRequest(db, uid, requestId, failure);
        return res.status(500).json(failure);
      }
    },
);

const PUSH_TITLES = {
  overdue_tasks: "Tarefa vencida",
  habit_at_risk: "Sequência em risco",
  stalled_goal: "Meta parada",
};

const buildSignalPrompt = (signal) => {
  switch (signal.kind) {
    case "overdue_tasks":
      return `O usuário tem ${signal.data.count} tarefa(s) vencida(s): ${signal.data.titles.join(", ")}. ` +
        "Escreva o corpo de uma notificação push (1 frase curta, até ~90 caracteres) chamando atenção " +
        "pra isso de forma direta e pessoal — pode ser uma pergunta ou provocação leve, nunca genérica.";
    case "habit_at_risk":
      return `O hábito "${signal.data.name}" está com sequência de ${signal.data.streak} dias e ainda não ` +
        "foi marcado hoje. Escreva o corpo de uma notificação push (1 frase curta, até ~90 caracteres) " +
        "incentivando a manter a sequência hoje, direto e pessoal, sem ser genérico.";
    case "stalled_goal":
      return `A meta "${signal.data.title}" está parada há ${signal.data.days} dias, sem nenhum progresso. ` +
        "Escreva o corpo de uma notificação push (1 frase curta, até ~90 caracteres) chamando atenção pra " +
        "isso — pode ser uma pergunta provocativa tipo perguntar se ainda importa, sem ser genérica.";
    default:
      return null;
  }
};

// Roda 1x por dia — nunca mais. Só chama o Gemini quando (a) o usuário tem
// pelo menos uma inscrição de push ativa E (b) há um sinal real e específico
// pra contar (nada de "oi, tudo bem?" — ver assistant/signals.js). Na
// maioria dos dias, pra maioria dos usuários, isso não gasta nem um token.
exports.dailySignalCheck = onSchedule(
    {
      schedule: "every day 19:00",
      timeZone: "America/Sao_Paulo",
      region: "southamerica-east1",
      secrets: ["GEMINI_API_KEY", "VAPID_PRIVATE_KEY"],
    },
    async () => {
      const clientDate = new Date().toLocaleDateString("en-CA", {timeZone: "America/Sao_Paulo"});

      const accessSnap = await db.collection("system").doc("accessControl").get();
      const emails = accessSnap.exists && Array.isArray(accessSnap.data().allowedEmails)
        ? accessSnap.data().allowedEmails
        : [];

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {timeout: 12000, retryOptions: {attempts: 2}},
      });

      for (const email of emails) {
        try {
          const user = await getAuth().getUserByEmail(email).catch(() => null);
          if (!user) continue;
          const uid = user.uid;

          // Pula tudo (nem consulta os dados) se não há nenhuma inscrição —
          // não há como avisar ninguém, então não vale nem o custo de checar.
          const subsSnap = await db.collection("users").doc(uid).collection("pushSubscriptions").limit(1).get();
          if (subsSnap.empty) continue;

          const signal = await detectSignal(db, uid, clientDate);
          if (!signal) continue;

          const prompt = buildSignalPrompt(signal);
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{role: "user", parts: [{text: prompt}]}],
            config: {maxOutputTokens: 80},
          });
          const body = (response.text || "").trim();
          if (!body) continue;

          const result = await sendPushToUser(db, uid, {
            title: PUSH_TITLES[signal.kind] || "Raio",
            body,
            url: "/rotina-alto-desempenho/",
          });

          logger.info("dailySignalCheck sent", {uid, kind: signal.kind, sent: result.sent});
        } catch (error) {
          logger.error("dailySignalCheck failed for user", {email, error: error.message});
        }
      }
    },
);
