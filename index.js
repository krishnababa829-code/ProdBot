'use strict';

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { handleAgentRequest } = require('./src/agent');
const { handleWebhookRequest } = require('./src/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────

// Use the json `verify` callback to capture the raw body buffer for
// webhook signature verification without consuming the stream twice.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Rate limiter for the agent endpoint (30 requests per minute per IP).
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait before sending another message.' },
});

// Rate limiter for the webhook endpoint (120 requests per minute per IP).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests.' },
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'ProdBot',
    description: 'GitHub Copilot Agent – DevOps & Production Engineering Expert',
    version: require('./package.json').version,
    endpoints: {
      webhook: '/webhook',
      agent: '/agent',
    },
    status: 'running',
  });
});

// ── Webhook endpoint ───────────────────────────────────────────────────────
app.post('/webhook', webhookLimiter, handleWebhookRequest);

// ── Agent endpoint (GitHub Copilot Extension) ──────────────────────────────
app.post('/agent', agentLimiter, handleAgentRequest);

// ── Error handler ──────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Start server ───────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🤖 ProdBot running on port ${PORT}`);
    console.log(`   Webhook : http://localhost:${PORT}/webhook`);
    console.log(`   Agent   : http://localhost:${PORT}/agent`);
  });
}

module.exports = app;
