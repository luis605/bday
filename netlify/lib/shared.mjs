import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import questionData from "../../public/questions.json";
import answerKey from "./answer-key.json";

export const SCORE_FLOOR = 78;
export const SCORE_CEIL = 100;

const flat = [];
for (const section of questionData.sections) {
  for (const question of section.questions) {
    flat.push({ ...question, sectionId: section.id });
  }
}

export const allQuestions = flat;
export const questions = new Map(flat.map((q) => [q.id, q]));
export const scoredQuestions = flat.filter((q) => q.scored !== false);

export function format(text) {
  const meta = questionData.meta;
  return String(text)
    .replaceAll("{name}", meta.herName)
    .replaceAll("{me}", meta.myName);
}

export function keyFor(question) {
  return Number.isInteger(answerKey[question.id]) ? answerKey[question.id] : null;
}

export function store() {
  return getStore({ name: "birthday-quiz", consistency: "strong" });
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function validSessionId(id) {
  return typeof id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(id);
}

export async function readBody(req) {
  const text = await req.text();
  if (text.length > 2000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function sessionKey(id) {
  return `session/${id}`;
}

export async function findSession(id) {
  return store().get(sessionKey(id), { type: "json" });
}

export async function loadSession(id) {
  const existing = await findSession(id);
  if (existing) return existing;
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, answers: {}, result: null };
}

export async function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  await store().setJSON(sessionKey(session.id), session);
}

export function computeScore(session) {
  let matches = 0;
  for (const question of scoredQuestions) {
    const entry = session.answers[question.id];
    if (entry && entry.choice === keyFor(question)) matches += 1;
  }
  const total = scoredQuestions.length;
  const ratio = total ? matches / total : 0;
  const percent = SCORE_FLOOR + Math.round((SCORE_CEIL - SCORE_FLOOR) * ratio);
  return { matches, total, percent };
}

export function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(String(provided)).digest();
  const b = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(a, b);
}
