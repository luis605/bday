import {
  json,
  readBody,
  validSessionId,
  questions,
  keyFor,
  format,
  loadSession,
  saveSession,
} from "../lib/shared.mjs";

export const config = { path: "/api/answer" };

function revealFor(question, entry) {
  if (question.scored === false) {
    return { choice: entry.choice, match: null, luisPick: null };
  }
  const luisPick = keyFor(question);
  return {
    choice: entry.choice,
    match: entry.choice === luisPick,
    luisPick,
  };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await readBody(req);
  if (!body || !validSessionId(body.sessionId)) {
    return json({ error: "bad request" }, 400);
  }

  const question = questions.get(body.questionId);
  if (!question) return json({ error: "unknown question" }, 400);

  const choice = body.choice;
  if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) {
    return json({ error: "bad choice" }, 400);
  }

  const session = await loadSession(body.sessionId);
  const existing = session.answers[question.id];
  if (existing) return json(revealFor(question, existing));

  if (session.result) return json({ error: "already finished" }, 409);

  const entry = {
    choice,
    label: format(question.options[choice]),
    question: format(question.text),
    section: question.sectionId,
    at: new Date().toISOString(),
  };
  session.answers[question.id] = entry;
  await saveSession(session);

  return json(revealFor(question, entry));
};
