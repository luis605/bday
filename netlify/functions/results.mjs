import { json, store, tokenMatches } from "../lib/shared.mjs";

export const config = { path: "/api/results" };

export default async (req) => {
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const expected = process.env.RESULTS_TOKEN;
  if (!expected) return json({ error: "RESULTS_TOKEN is not configured" }, 503);

  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!tokenMatches(provided, expected)) return json({ error: "unauthorized" }, 401);

  const db = store();
  const listing = await db.list({ prefix: "session/" });
  const sessions = await Promise.all(
    listing.blobs.map((blob) => db.get(blob.key, { type: "json" })),
  );

  const present = sessions
    .filter(Boolean)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return json({ count: present.length, sessions: present });
};
