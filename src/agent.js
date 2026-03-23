'use strict';

/**
 * Agent Handler
 *
 * Handles POST /agent requests from the GitHub Copilot Extension protocol.
 *
 * Request body (OpenAI-compatible):
 * {
 *   "messages": [{ "role": "user", "content": "..." }],
 *   "copilot_references": [{ "type": "github.repository", "data": { ... } }]
 * }
 *
 * The token for the GitHub API is provided via the Authorization header as
 * "Bearer <token>".
 */

const { initSSE, streamText, sendDone, sendError } = require('./sse');
const { runHappyPath } = require('./happy-path');
const { analyzeRepository } = require('./analyzer');
const { createClient, listRepositoryFiles } = require('./github-client');

/**
 * Keywords that trigger the full happy-path productionization workflow.
 */
const ACTION_KEYWORDS = [
  'prodify',
  'make.*production.?ready',
  'productionize',
  'production.?ready',
  'make.*prod',
  'make this.*prod',
  'deploy.*ready',
  'add.*ci',
  'add.*cd',
  'add.*ci.?cd',
  'create.*pipeline',
  'add.*workflow',
  'add.*github.?actions',
  'make.*secure',
  'add.*dockerfile',
  'add.*docker',
  'transform.*poc',
  'poc.*production',
];

/**
 * Determine user intent from the last message.
 * @param {string} message
 * @returns {'analysis' | 'action' | 'help'}
 */
function detectIntent(message) {
  const lower = message.toLowerCase();

  // Check for action triggers
  for (const kw of ACTION_KEYWORDS) {
    if (new RegExp(kw, 'i').test(lower)) return 'action';
  }

  // Analysis intent
  if (
    lower.includes('ready') ||
    lower.includes('analyze') ||
    lower.includes('analyse') ||
    lower.includes('analysis') ||
    lower.includes('review') ||
    lower.includes('missing') ||
    lower.includes('check') ||
    lower.includes('what is') ||
    lower.includes("what's") ||
    lower.includes('status') ||
    lower.includes('assess') ||
    lower.includes('gaps') ||
    lower.includes('poc')
  ) {
    return 'analysis';
  }

  return 'help';
}

/**
 * Extract the GitHub repository reference from the Copilot references array.
 * @param {Array} references
 * @returns {{ owner: string, repo: string }|null}
 */
function extractRepoRef(references) {
  if (!Array.isArray(references)) return null;
  const ref = references.find((r) => r.type === 'github.repository');
  if (!ref || !ref.data) return null;
  const owner = ref.data.owner?.login || ref.data.owner;
  const repo = ref.data.name;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * Build a read-only analysis response without creating any files.
 */
async function handleAnalysis(res, octokit, owner, repo) {
  const repoFullName = `${owner}/${repo}`;

  await streamText(res, `## 🤖 ProdBot – Production Readiness Analysis\n\n`);
  await streamText(res, `**Repository:** \`${repoFullName}\`\n\n`);
  await streamText(res, `🔍 Scanning repository structure...\n\n`);

  const files = await listRepositoryFiles(octokit, owner, repo);

  if (files.length === 0) {
    await streamText(
      res,
      `⚠️ Repository appears to be empty or ProdBot does not have read access.\n\n`,
    );
    sendDone(res);
    return;
  }

  const analysis = analyzeRepository(files, repoFullName);
  const { matrix, gaps, language } = analysis;

  const scoreEmoji = (s) => (s >= 75 ? '🟢' : s >= 40 ? '🟡' : '🔴');

  await streamText(res, `### 📊 Production Readiness Matrix\n\n`);
  await streamText(
    res,
    `| Dimension | Score | Status |\n|-----------|-------|--------|\n` +
      `| 🔐 Security | ${matrix.security}% | ${scoreEmoji(matrix.security)} |\n` +
      `| ⚙️ Reliability | ${matrix.reliability}% | ${scoreEmoji(matrix.reliability)} |\n` +
      `| 🛠️ Maintainability | ${matrix.maintainability}% | ${scoreEmoji(matrix.maintainability)} |\n` +
      `| 📦 Scalability | ${matrix.scalability}% | ${scoreEmoji(matrix.scalability)} |\n` +
      `| **Overall** | **${matrix.overall}%** | ${scoreEmoji(matrix.overall)} |\n\n`,
  );

  await streamText(
    res,
    `> **Language:** \`${language}\` · **Files analyzed:** ${files.length}\n\n`,
  );

  if (gaps.length > 0) {
    await streamText(res, `### 🔎 Gaps Detected\n\n`);
    const sevEmoji = { critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' };
    for (const g of gaps) {
      await streamText(
        res,
        `- ${sevEmoji[g.severity] || '•'} **[${g.category}]** ${g.description}\n` +
          `  _Fix: ${g.fix}_\n\n`,
      );
    }
  } else {
    await streamText(
      res,
      `### ✅ No Critical Gaps Found\n\nThis repository appears to be production-ready!\n\n`,
    );
  }

  await streamText(res, `### 🚀 Suggested Actions\n\n`);
  await streamText(
    res,
    `To automatically fix all gaps, say:\n\n` +
      `> **"@ProdBot prodify this repository"**\n\n` +
      `ProdBot will generate all missing files and open a Pull Request for your review.\n`,
  );

  sendDone(res);
}

/**
 * Build a help / introduction response.
 */
async function handleHelp(res) {
  await streamText(res, `## 🤖 ProdBot – DevOps & Production Engineering Expert\n\n`);
  await streamText(
    res,
    `I help you transform experimental repositories into **secure, production-ready systems**.\n\n`,
  );
  await streamText(res, `### What I can do:\n\n`);
  await streamText(
    res,
    `- 📊 **Analyse** your repository against a Production Readiness Matrix\n` +
      `- 🔐 **Security**: Configure CodeQL SAST and Dependabot\n` +
      `- ⚙️ **CI/CD**: Generate GitHub Actions workflows\n` +
      `- 🐳 **Containerization**: Create optimized multi-stage Dockerfiles\n` +
      `- 🛡️ **Governance**: Add security policies and CONTRIBUTING guides\n` +
      `- 🚀 **Pull Requests**: Open a PR with all generated files automatically\n\n`,
  );
  await streamText(res, `### Example commands:\n\n`);
  await streamText(
    res,
    `- _"Is this repository production ready?"_\n` +
      `- _"Analyze this POC repository"_\n` +
      `- _"@ProdBot prodify this repository"_\n` +
      `- _"Make this project production ready"_\n` +
      `- _"Create a CI/CD pipeline for this repo"_\n`,
  );

  sendDone(res);
}

/**
 * Main agent request handler.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleAgentRequest(req, res) {
  // ── Set up SSE stream ─────────────────────────────────────────────────────
  initSSE(res);

  // ── Extract GitHub token ──────────────────────────────────────────────────
  const authHeader = req.headers['x-github-token'] || req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // ── Extract last user message ─────────────────────────────────────────────
  const messages = req.body?.messages || [];
  const lastMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user')?.content || '';

  // ── Extract repository reference ──────────────────────────────────────────
  const references = req.body?.copilot_references || [];
  const repoRef = extractRepoRef(references);

  // ── Route by intent ───────────────────────────────────────────────────────
  const intent = detectIntent(lastMessage);

  if (!repoRef) {
    if (intent === 'help') {
      await handleHelp(res);
      return;
    }
    await streamText(
      res,
      `⚠️ **No repository context found.**\n\nPlease open a repository in GitHub and use ProdBot from the Copilot Chat panel within that repository context.\n`,
    );
    sendDone(res);
    return;
  }

  const { owner, repo } = repoRef;

  if (!token) {
    await streamText(
      res,
      `⚠️ **Authentication required.**\n\nProdBot needs a GitHub token to access repository data. Please ensure you have authorized the GitHub Copilot Extension.\n`,
    );
    sendDone(res);
    return;
  }

  const octokit = createClient(token);

  if (intent === 'action') {
    await runHappyPath(res, token, owner, repo);
  } else if (intent === 'analysis') {
    await handleAnalysis(res, octokit, owner, repo);
  } else {
    await handleHelp(res);
  }
}

module.exports = { handleAgentRequest, detectIntent, extractRepoRef };
