# My Money: AI-powered expense & finance tracker

Supabase (database + login + AI function) + a single-page web app hosted free on GitHub Pages.
Replaces the Google Sheets + AppSheet version, keeps the same Accounts / Categories / Types.

## What it does
- **Quick add with AI**: type "450 dinner Vaikuntam yesterday, Zerodha weekly 1210" or snap a receipt; Claude turns it into rows you review and save.
- **Ledger**: filter by month, type, search.
- **Dashboard**: income / expense / invested / left over / savings rate, expenses vs monthly budgets, 6-month trend.
- **Ask AI**: "Where am I overspending?", "What are my recurring costs?" answered from your last 12 months.
- **Import** your existing Sheet as CSV, **export** anytime.

## Setup (about 15 minutes)

### 1. New Supabase project (free, other email)
1. Sign up at supabase.com with the other email and create a project.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Authentication → Providers → Email: keep enabled. For personal use you can turn off "Confirm email".
4. Project Settings → API: copy the **Project URL** and the **anon / publishable key** into `docs/config.js`.

### 2. Deploy the AI function
Needs an Anthropic API key (console.anthropic.com; AI calls cost a few paise each).
```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai
```
Leave JWT verification on (the default). Only signed-in users can call it.

### 3. Host on GitHub Pages
1. Create a GitHub repo, push this folder.
2. Settings → Pages → Deploy from branch → `main` → folder `/docs`.
3. Open the Pages URL on your phone and "Add to Home Screen".
4. Repo → Settings → Secrets → Actions: add `SUPABASE_URL` and `SUPABASE_ANON_KEY` so the keep-alive workflow stops the free project pausing.

### 4. Import your data
Sign up in the app → Settings → Import. In your Sheet: Transactions tab → File → Download → CSV. Do it once only (re-importing duplicates rows).

## Notes
- Your Sheet's "Month", "Monthly Summary" tab and "Remaining" column are computed live now; nothing to maintain.
- "Left over" = income − expense − investments. Investments are not counted as spending.
- Back up occasionally with Settings → Export.
