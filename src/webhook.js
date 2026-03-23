'use strict';

/**
 * Webhook Handler
 *
 * Handles POST /webhook from GitHub (installation events, ping, etc.)
 * The webhook signature should be verified using the WEBHOOK_SECRET env var.
 */

const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * Verify the X-Hub-Signature-256 header from GitHub.
 * Returns true if valid, false otherwise.
 * @param {Buffer|string} rawBody
 * @param {string} signature
 */
function verifySignature(rawBody, signature) {
  if (!WEBHOOK_SECRET) {
    // If no secret is configured, skip verification (dev mode).
    return true;
  }
  if (!signature || !signature.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Main webhook request handler.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function handleWebhookRequest(req, res) {
  const signature = req.headers['x-hub-signature-256'] || '';
  const event = req.headers['x-github-event'] || 'unknown';

  // Verify signature
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  if (!verifySignature(rawBody, signature)) {
    console.warn('[webhook] Invalid signature received');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const payload = req.body || {};
  console.log(`[webhook] Received event: ${event}, action: ${payload.action || 'none'}`);

  switch (event) {
    case 'ping':
      res.json({ message: 'ProdBot webhook is alive! 🤖' });
      break;

    case 'installation':
      handleInstallation(payload, res);
      break;

    case 'installation_repositories':
      handleInstallationRepositories(payload, res);
      break;

    default:
      // Acknowledge all other events gracefully.
      res.json({ message: `Event '${event}' received and acknowledged.` });
  }
}

function handleInstallation(payload, res) {
  const { action, installation } = payload;
  const account = installation?.account?.login || 'unknown';

  switch (action) {
    case 'created':
      console.log(`[webhook] ProdBot installed by: ${account}`);
      res.json({ message: `Welcome, ${account}! ProdBot is ready. Use @ProdBot in Copilot Chat.` });
      break;
    case 'deleted':
      console.log(`[webhook] ProdBot uninstalled by: ${account}`);
      res.json({ message: 'ProdBot uninstalled.' });
      break;
    default:
      res.json({ message: `Installation event '${action}' acknowledged.` });
  }
}

function handleInstallationRepositories(payload, res) {
  const { action, repositories_added, repositories_removed } = payload;
  const added = (repositories_added || []).map((r) => r.full_name);
  const removed = (repositories_removed || []).map((r) => r.full_name);

  if (action === 'added') {
    console.log(`[webhook] Repos added: ${added.join(', ')}`);
  } else if (action === 'removed') {
    console.log(`[webhook] Repos removed: ${removed.join(', ')}`);
  }

  res.json({ message: `Repositories ${action}: ${[...added, ...removed].join(', ')}` });
}

module.exports = { handleWebhookRequest, verifySignature };
