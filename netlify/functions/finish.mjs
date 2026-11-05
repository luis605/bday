import {
  json,
  readBody,
  validSessionId,
  allQuestions,
  findSession,
  saveSession,
  computeScore,
} from "../lib/shared.mjs";

export const config = { path: "/api/finish" };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await readBody(req);
  if (!body || !validSessionId(body.sessionId)) {
    return json({ error: "bad request" }, 400);
  }

  const session = await findSession(body.sessionId);
  if (!session) return json({ error: "unknown session" }, 404);

  const missing = allQuestions
    .filter((question) => !session.answers[question.id])
    .map((question) => question.id);
  if (missing.length) return json({ error: "incomplete", missing }, 409);

  if (!session.result) {
    session.result = { ...computeScore(session), at: new Date().toISOString() };
    await saveSession(session);
  }

  const { percent, matches, total } = session.result;
  return json({ percent, matches, total });
};
