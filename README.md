# ProdBot (Enterprise Multi-Agent Edition)

ProdBot is an AI-powered GitHub Copilot Extension backend that turns POCs into production-ready systems using OpenAI, Retrieval-Augmented Generation (RAG), policy-as-code governance, and a monetization-ready paywall. It now features multi-agent orchestration (Planner → Coder → Reviewer), deterministic static checks, and granular SSE streaming for Copilot chat.

## What’s new in this edition
- Supabase-backed subscription/paywall for /agent (Pro/Enterprise tiers; 402 SSE response with Stripe placeholder checkout)
- Multi-agent pipeline (Planner, Coder, Reviewer) on gpt-4o
- Deterministic static analysis (YAML parse, npm audit) feeding the Reviewer
- Sandboxed approval loop with up to 3 self-correction iterations before PR
- Granular SSE events so users see real-time handoffs

## Prerequisites
- Node.js 18+
- npm
- OpenAI API key (`OPENAI_API_KEY`)
- GitHub token with repo read access (`GITHUB_TOKEN`)
- Supabase project (`SUPABASE_URL`, `SUPABASE_KEY`) with a `subscriptions` table (columns: github_login, tier, status, trial_expires_at)
- Stripe secret (`STRIPE_SECRET`) for real checkout (placeholder used by default)
- Optional: ngrok to expose localhost for Copilot Extension

## Setup
```bash
npm install
cp .env.example .env
# fill in OPENAI_API_KEY, GITHUB_TOKEN, SUPABASE_URL, SUPABASE_KEY, STRIPE_SECRET
npm start
```

## Endpoints
- `GET /health` – liveness
- `POST /webhook` – GitHub webhooks
- `GET /agent?owner=<org>&repo=<name>` – SSE stream (paywalled). Events:
  - `message` / stage updates
  - `trace` / planner, coder, reviewer, loop, tools steps
  - `result` / final artifacts + review verdict
  - `payment` / 402 payment-required SSE if subscription is missing

## Agent pipeline
1) Paywall middleware resolves GitHub user from `x-github-token`, checks Supabase subscriptions.
2) Planner selects RAG files + deterministic tools.
3) Coder drafts CI/CD, Dockerfiles, tests from context.
4) Deterministic tools run (YAML parse, npm audit) and feed Reviewer.
5) Reviewer enforces `prodbot_rules.yaml` (if present) and tool findings.
6) Approval loop (max 3 tries) until Reviewer returns `APPROVED`; otherwise surface gaps.

## Python CLI demo (unchanged)
```bash
pip install -r requirements.txt
python app.py run [keyword]
python app.py keywords
```

## Environment variables
- `OPENAI_API_KEY`, `GITHUB_TOKEN`
- `SUPABASE_URL`, `SUPABASE_KEY`
- `STRIPE_SECRET`
- `PRODBOT_TRIGGER_KEYWORD` (default ignite)
- `PORT` (default 3000)

## Notes
- Stripe checkout link currently uses placeholder: https://checkout.stripe.com/pay/cs_test_dummy_prodbot
- Deterministic tools are lightweight; extend `src/scanner/local-tools.js` for more checks as needed.
