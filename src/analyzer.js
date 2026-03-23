'use strict';

/**
 * Repository Analyzer
 * Performs deep analysis of a GitHub repository to assess production readiness.
 */

const LANGUAGE_PROFILES = {
  javascript: {
    files: ['package.json'],
    testFrameworks: ['jest', 'mocha', 'vitest', 'tape'],
    ciTemplate: 'node',
    dockerBase: 'node:20-alpine',
    testCommand: 'npm test',
    buildCommand: 'npm run build',
    lintCommand: 'npm run lint',
  },
  typescript: {
    files: ['tsconfig.json'],
    testFrameworks: ['jest', 'vitest', 'mocha'],
    ciTemplate: 'node',
    dockerBase: 'node:20-alpine',
    testCommand: 'npm test',
    buildCommand: 'npm run build',
    lintCommand: 'npm run lint',
  },
  python: {
    files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    testFrameworks: ['pytest', 'unittest'],
    ciTemplate: 'python',
    dockerBase: 'python:3.12-slim',
    testCommand: 'pytest',
    buildCommand: null,
    lintCommand: 'flake8 .',
  },
  java: {
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    testFrameworks: ['junit', 'testng'],
    ciTemplate: 'java',
    dockerBase: 'eclipse-temurin:21-jre-alpine',
    testCommand: 'mvn test',
    buildCommand: 'mvn package',
    lintCommand: 'mvn checkstyle:check',
  },
  go: {
    files: ['go.mod'],
    testFrameworks: ['testing'],
    ciTemplate: 'go',
    dockerBase: 'golang:1.22-alpine',
    testCommand: 'go test ./...',
    buildCommand: 'go build ./...',
    lintCommand: 'golangci-lint run',
  },
  ruby: {
    files: ['Gemfile'],
    testFrameworks: ['rspec', 'minitest'],
    ciTemplate: 'ruby',
    dockerBase: 'ruby:3.3-alpine',
    testCommand: 'bundle exec rspec',
    buildCommand: null,
    lintCommand: 'bundle exec rubocop',
  },
  php: {
    files: ['composer.json'],
    testFrameworks: ['phpunit'],
    ciTemplate: 'php',
    dockerBase: 'php:8.3-fpm-alpine',
    testCommand: 'vendor/bin/phpunit',
    buildCommand: null,
    lintCommand: 'vendor/bin/phpcs',
  },
  rust: {
    files: ['Cargo.toml'],
    testFrameworks: ['cargo test'],
    ciTemplate: 'rust',
    dockerBase: 'rust:1.77-alpine',
    testCommand: 'cargo test',
    buildCommand: 'cargo build --release',
    lintCommand: 'cargo clippy',
  },
};

/**
 * Detect the primary language of the repository from its file list.
 * @param {string[]} files - Array of file paths in the repository.
 * @returns {{ name: string, profile: object }|null}
 */
function detectLanguage(files) {
  const filenames = files.map((f) => f.split('/').pop());
  for (const [lang, profile] of Object.entries(LANGUAGE_PROFILES)) {
    if (profile.files.some((indicator) => filenames.includes(indicator))) {
      return { name: lang, profile };
    }
  }
  return null;
}

/**
 * Check which production readiness indicators are present.
 * @param {string[]} files
 * @param {{ name: string, profile: object }|null} lang
 */
function checkIndicators(files, lang) {
  const filenames = files.map((f) => f.toLowerCase());

  const hasWorkflow = filenames.some(
    (f) => f.includes('.github/workflows/') && f.endsWith('.yml'),
  );
  const hasDockerfile = filenames.some((f) => f.endsWith('dockerfile'));
  const hasReadme = filenames.some((f) => f.includes('readme'));
  const hasContributing = filenames.some((f) => f.includes('contributing'));
  const hasLicense = filenames.some((f) => f.includes('license'));
  const hasEnvExample = filenames.some(
    (f) => f.includes('.env.example') || f.includes('.env.sample'),
  );
  const hasDependabot = filenames.some((f) =>
    f.includes('.github/dependabot'),
  );
  const hasCodeql = filenames.some((f) =>
    f.includes('.github/workflows/codeql'),
  );
  const hasSecurityPolicy = filenames.some(
    (f) => f.includes('security.md') || f.includes('.github/security'),
  );
  const hasTests = filenames.some(
    (f) =>
      f.includes('test/') ||
      f.includes('tests/') ||
      f.includes('spec/') ||
      f.includes('.test.') ||
      f.includes('.spec.'),
  );
  const hasIaC = filenames.some(
    (f) =>
      f.endsWith('.tf') ||
      f.includes('helm/') ||
      f.includes('k8s/') ||
      f.includes('kubernetes/') ||
      f.endsWith('docker-compose.yml'),
  );

  return {
    hasWorkflow,
    hasDockerfile,
    hasReadme,
    hasContributing,
    hasLicense,
    hasEnvExample,
    hasDependabot,
    hasCodeql,
    hasSecurityPolicy,
    hasTests,
    hasIaC,
  };
}

/**
 * Compute a production readiness matrix with dimensional scores (0-100).
 * @param {object} indicators
 */
function computeMatrix(indicators) {
  const security = Math.round(
    ([
      indicators.hasCodeql,
      indicators.hasDependabot,
      indicators.hasSecurityPolicy,
      indicators.hasEnvExample,
    ].filter(Boolean).length /
      4) *
      100,
  );

  const reliability = Math.round(
    ([
      indicators.hasWorkflow,
      indicators.hasTests,
      indicators.hasDockerfile,
    ].filter(Boolean).length /
      3) *
      100,
  );

  const maintainability = Math.round(
    ([
      indicators.hasReadme,
      indicators.hasContributing,
      indicators.hasLicense,
    ].filter(Boolean).length /
      3) *
      100,
  );

  const scalability = Math.round(
    ([indicators.hasIaC, indicators.hasDockerfile].filter(Boolean).length / 2) *
      100,
  );

  const overall = Math.round(
    (security + reliability + maintainability + scalability) / 4,
  );

  return { security, reliability, maintainability, scalability, overall };
}

/**
 * Identify the gaps between POC and production readiness.
 * @param {object} indicators
 * @param {{ name: string, profile: object }|null} lang
 */
function identifyGaps(indicators, lang) {
  const gaps = [];

  if (!indicators.hasWorkflow) {
    gaps.push({
      category: 'CI/CD',
      severity: 'critical',
      description: 'No GitHub Actions workflow found.',
      fix: 'Generate a `.github/workflows/ci.yml` with build, lint, and test steps.',
    });
  }
  if (!indicators.hasTests) {
    gaps.push({
      category: 'Testing',
      severity: 'critical',
      description: 'No automated tests detected.',
      fix: lang
        ? `Scaffold tests using ${lang.profile.testFrameworks[0] || 'the native test framework'}.`
        : 'Add a test suite to validate core logic.',
    });
  }
  if (!indicators.hasDockerfile) {
    gaps.push({
      category: 'Containerization',
      severity: 'high',
      description: 'No Dockerfile found.',
      fix: 'Add a multi-stage Dockerfile for efficient, reproducible builds.',
    });
  }
  if (!indicators.hasCodeql) {
    gaps.push({
      category: 'Security (SAST)',
      severity: 'high',
      description: 'GitHub CodeQL scanning not configured.',
      fix: 'Add `.github/workflows/codeql.yml` to enable Static Application Security Testing.',
    });
  }
  if (!indicators.hasDependabot) {
    gaps.push({
      category: 'Security (Dependencies)',
      severity: 'high',
      description: 'Dependabot not configured.',
      fix: 'Add `.github/dependabot.yml` to automate dependency vulnerability alerts.',
    });
  }
  if (!indicators.hasSecurityPolicy) {
    gaps.push({
      category: 'Governance',
      severity: 'medium',
      description: 'No SECURITY.md or security policy found.',
      fix: 'Add a `SECURITY.md` file describing the vulnerability disclosure process.',
    });
  }
  if (!indicators.hasEnvExample) {
    gaps.push({
      category: 'Configuration',
      severity: 'medium',
      description: 'No `.env.example` or environment template found.',
      fix: 'Add `.env.example` to document required environment variables.',
    });
  }
  if (!indicators.hasIaC) {
    gaps.push({
      category: 'Infrastructure-as-Code',
      severity: 'medium',
      description: 'No IaC configuration detected (Terraform, Helm, Kubernetes manifests).',
      fix: 'Add deployment manifests or Terraform configuration for reproducible infrastructure.',
    });
  }
  if (!indicators.hasLicense) {
    gaps.push({
      category: 'Compliance',
      severity: 'low',
      description: 'No LICENSE file found.',
      fix: 'Add a LICENSE file (MIT, Apache 2.0, etc.) to clarify usage rights.',
    });
  }
  if (!indicators.hasContributing) {
    gaps.push({
      category: 'Maintainability',
      severity: 'low',
      description: 'No CONTRIBUTING.md guide found.',
      fix: 'Add CONTRIBUTING.md describing how to set up the development environment and submit changes.',
    });
  }

  return gaps;
}

/**
 * Run a full production readiness analysis on repository file list.
 * @param {string[]} files - Array of file paths.
 * @param {string} repoFullName - e.g. "owner/repo"
 */
function analyzeRepository(files, repoFullName) {
  const lang = detectLanguage(files);
  const indicators = checkIndicators(files, lang);
  const matrix = computeMatrix(indicators);
  const gaps = identifyGaps(indicators, lang);

  return {
    repoFullName,
    language: lang ? lang.name : 'unknown',
    languageProfile: lang ? lang.profile : null,
    indicators,
    matrix,
    gaps,
  };
}

module.exports = { analyzeRepository, detectLanguage, checkIndicators, computeMatrix, identifyGaps };
