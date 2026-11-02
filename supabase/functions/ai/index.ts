// Supabase Edge Function: AI features for the expense tracker.
// Actions: "parse" (free text / receipt photo -> transactions) and "ask" (questions about your money).
// Requires secret ANTHROPIC_API_KEY. JWT verification stays ON (default), so only logged-in users can call it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5-5";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function claude(system: string, content: unknown, maxTokens = 1500): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON in AI response");
  return JSON.parse(text.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return json({ error: "Not signed in" }, 401);

    const body = await req.json();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    if (body.action === "parse") {
      const cats: { name: string; type: string }[] = body.categories ?? [];
      const accounts: string[] = body.accounts ?? ["Bank Account", "Credit Card"];
      const system = `You turn informal expense notes or receipts into ledger rows for an Indian personal finance tracker (INR).
Today is ${today} (Asia/Kolkata). Resolve words like "yesterday" or "last Friday" to real dates (YYYY-MM-DD).
Allowed accounts: ${accounts.join(", ")}. Default to "${accounts[0]}"; use "Credit Card" only if the text says card/credit card/CC.
Allowed categories (name [type]): ${cats.map((c) => `${c.name} [${c.type}]`).join(", ")}.
type must be Income, Expense or Investment and must match the category's type. Choose the closest category.
amount is a positive number in rupees (no symbols). note is a short, tidy label (e.g. "Vaikuntam dinner").
One row per distinct payment; for a receipt use the total as one row unless clearly separate purchases.
Reply with ONLY JSON: {"transactions":[{"date":"YYYY-MM-DD","type":"","account":"","category":"","note":"","amount":0}]}`;
      const content: unknown[] = [];
      if (body.image?.data) {
        content.push({ type: "image", source: { type: "base64", media_type: body.image.media_type || "image/jpeg", data: body.image.data } });
      }
      content.push({ type: "text", text: body.text?.trim() || "Extract the transaction(s) from this image." });
      const out = extractJson(await claude(system, content, 1200));
      return json({ transactions: out.transactions ?? [] });
    }

    if (body.action === "ask") {
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      const [{ data: tx }, { data: budgets }] = await Promise.all([
        supabase.from("transactions").select("date,type,account,category,note,amount")
          .gte("date", since.toISOString().slice(0, 10)).order("date", { ascending: false }).limit(2500),
        supabase.from("budgets").select("category,monthly_amount"),
      ]);
      const lines = (tx ?? []).map((t) => `${t.date}|${t.type}|${t.account}|${t.category}|${t.note}|${t.amount}`).join("\n");
      const bl = (budgets ?? []).map((b) => `${b.category}: ${b.monthly_amount}`).join(", ") || "none set";
      const system = `You are a careful personal-finance analyst for one person in India. Amounts are INR (use ₹ and Indian digit grouping).
Today is ${today}. Answer ONLY from the ledger below (columns: date|type|account|category|note|amount, last 12 months).
Types: Income, Expense, Investment. Investments are money moved to assets, not spending; Savings = Income - Expense - Investment is "unallocated cash".
Be concise and specific: compute real numbers, name the categories and months involved, flag anomalies or one-off big items separately from habits.
Suggest practical improvements when asked or clearly useful. This is not licensed investment advice; do not recommend specific securities.
Monthly budgets: ${bl}

LEDGER:
${lines}`;
      const answer = await claude(system, String(body.question ?? "Give me a monthly review."), 1500);
      return json({ answer });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
