'use strict';

/**
 * Happy Path Orchestrator
 *
 * When ProdBot detects a "prodify" or similar action keyword, it executes a
 * pre-defined, visually impressive end-to-end workflow:
 *
 *  1. Fetch repository file tree via the GitHub API.
 *  2. Analyse production readiness.
 *  3. Generate all missing scaffolding files.
 *  4. Create a new branch and commit files.
 *  5. Open a Pull Request with a comprehensive summary.
 *  6. Stream the entire process to the user in real-time.
 */

const {
  createClient,
  listRepositoryFiles,
  createBranch,
  upsertFile,
  createPullRequest,
} = require('./github-client');
const { analyzeRepository } = require('./analyzer');
const {
  generateCIWorkflow,
  generateCodeQLWorkflow,
  generateDependabotConfig,
  generateDockerfile,
  generateSecurityPolicy,
  generateEnvExample,
  generateContributing,
} = require('./generator');
const { streamText, sendDone } = require('./sse');

/**
 * Severity emoji map for the readiness matrix.
 */
const SCORE_EMOJI = (score) => {
  if (score >= 75) return '🟢';
  if (score >= 40) return '🟡';
  return '🔴';
};

const SEVERITY_EMOJI = { critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' };

/**
 * Build a markdown readiness matrix table.
 */
function buildMatrixMarkdown(matrix) {
  return `| Dimension | Score | Status |
|-----------|-------|--------|
| 🔐 Security | ${matrix.security}% | ${SCORE_EMOJI(matrix.security)} |
| ⚙️ Reliability | ${matrix.reliability}% | ${SCORE_EMOJI(matrix.reliability)} |
| 🛠️ Maintainability | ${matrix.maintainability}% | ${SCORE_EMOJI(matrix.maintainability)} |
| 📦 Scalability | ${matrix.scalability}% | ${SCORE_EMOJI(matrix.scalability)} |
| **Overall** | **${matrix.overall}%** | ${SCORE_EMOJI(matrix.overall)} |`;
}

/**
 * Build a gaps summary markdown.
 */
function buildGapsMarkdown(gaps) {
  if (gaps.length === 0) return '_No critical gaps found. Repository is near production-ready!_';
  return gaps
    .map(
      (g) =>
        `- ${SEVERITY_EMOJI[g.severity] || '•'} **[${g.category}]** ${g.description}`,
    )
    .join('\n');
}

/**
 * Execute the full happy-path productionization workflow.
 *
 * @param {import('express').Response} res - Express response for SSE streaming.
 * @param {string} token - GitHub OAuth token for the requesting user.
 * @param {string} owner - Repository owner.
 * @param {string} repoName - Repository name.
 */
async function runHappyPath(res, token, owner, repoName) {
  const octokit = createClient(token);
  const repoFullName = `${owner}/${repoName}`;

  // ── Step 1: Repository analysis ──────────────────────────────────────────
  await streamText(res, `## 🤖 ProdBot – Productionization Report\n\n`);
  await streamText(res, `**Repository:** \`${repoFullName}\`\n\n`);
  await streamText(res, `🔍 **Scanning repository...**\n\n`);

  const files = await listRepositoryFiles(octokit, owner, repoName);
  const analysis = analyzeRepository(files, repoFullName);

  // ── Step 2: Readiness Matrix ──────────────────────────────────────────────
  await streamText(res, `### 📊 Production Readiness Matrix\n\n`);
  await streamText(res, buildMatrixMarkdown(analysis.matrix) + '\n\n');

  const lang = analysis.language !== 'unknown' ? analysis.language : null;
  await streamText(
    res,
    `> **Detected language:** ${lang ? `\`${lang}\`` : 'unknown'} · **Overall score:** ${analysis.matrix.overall}%\n\n`,
  );

  if (analysis.matrix.overall < 40) {
    await streamText(
      res,
      `> ⚠️ This repository is a **POC**. It requires significant scaffolding before it can be safely deployed to production.\n\n`,
    );
  } else if (analysis.matrix.overall < 75) {
    await streamText(
      res,
      `> 🟡 This repository has a **partial production setup**. Several key gaps need to be addressed.\n\n`,
    );
  } else {
    await streamText(
      res,
      `> 🟢 This repository has a **strong production foundation**. ProdBot will fill remaining gaps.\n\n`,
    );
  }

  // ── Step 3: Gap Analysis ──────────────────────────────────────────────────
  await streamText(res, `### 🔎 Key Gaps Discovered\n\n`);
  await streamText(res, buildGapsMarkdown(analysis.gaps) + '\n\n');

  // ── Step 4: Generate scaffolding ─────────────────────────────────────────
  await streamText(res, `### ⚙️ Generating Production Scaffolding\n\n`);

  const filesToCreate = [];

  if (!analysis.indicators.hasWorkflow && analysis.languageProfile) {
    const ciContent = generateCIWorkflow({
      name: analysis.language,
      profile: analysis.languageProfile,
    });
    filesToCreate.push({
      path: '.github/workflows/ci.yml',
      content: ciContent,
      label: 'GitHub Actions CI workflow',
    });
  }

  if (!analysis.indicators.hasCodeql) {
    const codeqlContent = generateCodeQLWorkflow(analysis.language);
    filesToCreate.push({
      path: '.github/workflows/codeql.yml',
      content: codeqlContent,
      label: 'CodeQL SAST scanning workflow',
    });
  }

  if (!analysis.indicators.hasDependabot) {
    const dependabotContent = generateDependabotConfig(analysis.language);
    filesToCreate.push({
      path: '.github/dependabot.yml',
      content: dependabotContent,
      label: 'Dependabot configuration',
    });
  }

  if (!analysis.indicators.hasDockerfile && analysis.languageProfile) {
    const dockerContent = generateDockerfile({
      name: analysis.language,
      profile: analysis.languageProfile,
    });
    filesToCreate.push({
      path: 'Dockerfile',
      content: dockerContent,
      label: 'Multi-stage Dockerfile',
    });
  }

  if (!analysis.indicators.hasSecurityPolicy) {
    filesToCreate.push({
      path: 'SECURITY.md',
      content: generateSecurityPolicy(repoFullName),
      label: 'Security policy (SECURITY.md)',
    });
  }

  if (!analysis.indicators.hasEnvExample) {
    filesToCreate.push({
      path: '.env.example',
      content: generateEnvExample(analysis.language),
      label: 'Environment configuration template (.env.example)',
    });
  }

  if (!analysis.indicators.hasContributing) {
    filesToCreate.push({
      path: 'CONTRIBUTING.md',
      content: generateContributing(repoFullName, analysis.languageProfile ? { profile: analysis.languageProfile } : null),
      label: 'Contributing guide (CONTRIBUTING.md)',
    });
  }

  if (filesToCreate.length === 0) {
    await streamText(
      res,
      `✅ No missing files detected. Repository is already well-configured!\n\n`,
    );
    sendDone(res);
    return;
  }

  for (const file of filesToCreate) {
    await streamText(res, `- ⏳ Preparing \`${file.path}\` (${file.label})\n`);
  }

  await streamText(res, `\n`);

  // ── Step 5: Create branch and commit files ───────────────────────────────
  const branchName = `prodbot/productionize-${Date.now()}`;
  await streamText(res, `🌿 **Creating branch:** \`${branchName}\`\n\n`);

  let defaultBranch = 'main';
  try {
    const branchResult = await createBranch(octokit, owner, repoName, branchName);
    defaultBranch = branchResult.defaultBranch;
  } catch (err) {
    await streamText(
      res,
      `⚠️ Could not create branch: ${err.message}. Ensure ProdBot has write access to the repository.\n\n`,
    );
    sendDone(res);
    return;
  }

  await streamText(res, `📝 **Committing production scaffolding...**\n\n`);

  for (const file of filesToCreate) {
    try {
      await upsertFile(
        octokit,
        owner,
        repoName,
        branchName,
        file.path,
        file.content,
        `chore: add ${file.label} [ProdBot]`,
      );
      await streamText(res, `- ✅ Committed \`${file.path}\`\n`);
    } catch (err) {
      await streamText(res, `- ❌ Failed to commit \`${file.path}\`: ${err.message}\n`);
    }
  }

  await streamText(res, `\n`);

  // ── Step 6: Create Pull Request ──────────────────────────────────────────
  await streamText(res, `🚀 **Opening Pull Request...**\n\n`);

  const prTitle = `🤖 ProdBot: Productionize ${repoName}`;
  const prBody = buildPRBody(repoFullName, analysis, filesToCreate);

  let pr;
  try {
    pr = await createPullRequest(
      octokit,
      owner,
      repoName,
      branchName,
      defaultBranch,
      prTitle,
      prBody,
    );
  } catch (err) {
    await streamText(
      res,
      `⚠️ Could not open Pull Request: ${err.message}\n\n`,
    );
    sendDone(res);
    return;
  }

  // ── Step 7: Summary ───────────────────────────────────────────────────────
  await streamText(res, `---\n\n`);
  await streamText(res, `### ✅ Productionization Complete!\n\n`);
  await streamText(
    res,
    `ProdBot has generated **${filesToCreate.length} production-ready files** and opened a Pull Request for your review:\n\n`,
  );
  await streamText(res, `🔗 **[${pr.title}](${pr.html_url})**\n\n`);
  await streamText(res, `**What's included in the PR:**\n`);
  for (const file of filesToCreate) {
    await streamText(res, `- \`${file.path}\` – ${file.label}\n`);
  }
  await streamText(res, `\n`);
  await streamText(
    res,
    `> 📌 Review the changes, adjust configurations to your environment, then merge to complete your journey from POC to Production.\n`,
  );

  sendDone(res);
}

/**
 * Build a comprehensive PR body with the full analysis.
 */
function buildPRBody(repoFullName, analysis, files) {
  const matrix = analysis.matrix;
  const matrixRows = [
    `| 🔐 Security | ${matrix.security}% |`,
    `| ⚙️ Reliability | ${matrix.reliability}% |`,
    `| 🛠️ Maintainability | ${matrix.maintainability}% |`,
    `| 📦 Scalability | ${matrix.scalability}% |`,
    `| **Overall** | **${matrix.overall}%** |`,
  ].join('\n');

  const gapsList = analysis.gaps
    .map((g) => `- **[${g.category}]** ${g.description}`)
    .join('\n');

  const filesList = files.map((f) => `- \`${f.path}\` – ${f.label}`).join('\n');

  return `## 🤖 ProdBot Productionization Report

This PR was automatically generated by **ProdBot** to transform \`${repoFullName}\` from a Proof-of-Concept into a production-ready system.

---

### 📊 Production Readiness Matrix (Before)

| Dimension | Score |
|-----------|-------|
${matrixRows}

**Detected Language:** \`${analysis.language}\`

---

### 🔎 Gaps Addressed

${gapsList || '_None – repository was already well-configured._'}

---

### 📁 Files Generated

${filesList}

---

### 🔍 Next Steps

1. **Review** each generated file and customize it to your specific application.
2. **Enable GitHub Advanced Security** in your repository settings for CodeQL results.
3. **Configure GitHub Environments** (staging / production) for deployment workflows.
4. **Set required secrets** (e.g., \`DEPLOY_KEY\`, \`DOCKER_USERNAME\`) referenced in workflows.
5. **Merge** this PR and enjoy your production-ready repository! 🚀

---

_Generated by ProdBot – your DevOps & Production Engineering expert._
`;
}

module.exports = { runHappyPath };
