'use strict';

/**
 * Generator
 * Produces GitHub Actions workflows, Dockerfiles, security configs,
 * and other production scaffolding files tailored to the detected language.
 */

// ---------------------------------------------------------------------------
// CI/CD Workflow templates
// ---------------------------------------------------------------------------

function generateCIWorkflow(lang) {
  const profile = lang.profile;

  const setupStep = buildSetupStep(lang.name, profile);
  const installStep = buildInstallStep(lang.name, profile);
  const lintStep = profile.lintCommand
    ? `      - name: Lint\n        run: ${profile.lintCommand}\n`
    : '';
  const buildStep = profile.buildCommand
    ? `      - name: Build\n        run: ${profile.buildCommand}\n`
    : '';
  const testStep = `      - name: Test\n        run: ${profile.testCommand}\n`;

  return `name: CI

on:
  push:
    branches: ["main", "master"]
  pull_request:
    branches: ["main", "master"]

permissions:
  contents: read

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

${setupStep}${installStep}${lintStep}${buildStep}${testStep}`;
}

function buildSetupStep(langName, profile) {
  switch (langName) {
    case 'javascript':
    case 'typescript':
      return `      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          cache: "npm"

`;
    case 'python':
      return `      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

`;
    case 'java':
      return `      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "21"
          cache: "maven"

`;
    case 'go':
      return `      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.22"

`;
    case 'ruby':
      return `      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: "3.3"
          bundler-cache: true

`;
    case 'php':
      return `      - name: Set up PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: "8.3"

`;
    case 'rust':
      return `      - name: Set up Rust toolchain
        uses: dtolnay/rust-toolchain@stable

`;
    default:
      return '';
  }
}

function buildInstallStep(langName, profile) {
  switch (langName) {
    case 'javascript':
    case 'typescript':
      return `      - name: Install dependencies
        run: npm ci

`;
    case 'python':
      return `      - name: Install dependencies
        run: pip install -r requirements.txt

`;
    case 'java':
      return '';
    case 'go':
      return `      - name: Download modules
        run: go mod download

`;
    case 'ruby':
      return '';
    case 'php':
      return `      - name: Install dependencies
        run: composer install --prefer-dist --no-progress

`;
    case 'rust':
      return '';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// CodeQL Workflow
// ---------------------------------------------------------------------------

function generateCodeQLWorkflow(langName) {
  const codeqlLang = mapToCodeQLLanguage(langName);
  return `name: CodeQL Security Scan

on:
  push:
    branches: ["main", "master"]
  pull_request:
    branches: ["main", "master"]
  schedule:
    - cron: "30 1 * * 0"

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${codeqlLang}

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${codeqlLang}"
`;
}

function mapToCodeQLLanguage(langName) {
  const map = {
    javascript: 'javascript',
    typescript: 'javascript',
    python: 'python',
    java: 'java',
    go: 'go',
    ruby: 'ruby',
    rust: 'rust',
    php: 'php',
  };
  return map[langName] || 'javascript';
}

// ---------------------------------------------------------------------------
// Dependabot configuration
// ---------------------------------------------------------------------------

function generateDependabotConfig(langName) {
  const ecosystem = mapToPackageEcosystem(langName);
  return `version: 2
updates:
  - package-ecosystem: "${ecosystem}"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "github-actions"
`;
}

function mapToPackageEcosystem(langName) {
  const map = {
    javascript: 'npm',
    typescript: 'npm',
    python: 'pip',
    java: 'maven',
    go: 'gomod',
    ruby: 'bundler',
    php: 'composer',
    rust: 'cargo',
  };
  return map[langName] || 'npm';
}

// ---------------------------------------------------------------------------
// Dockerfile
// ---------------------------------------------------------------------------

function generateDockerfile(lang) {
  const profile = lang.profile;

  switch (lang.name) {
    case 'javascript':
    case 'typescript':
      return `# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM ${profile.dockerBase} AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# ---- Production stage ----
FROM ${profile.dockerBase}
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3000
USER node
CMD ["node", "index.js"]
`;

    case 'python':
      return `# syntax=docker/dockerfile:1

FROM ${profile.dockerBase}
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
`;

    case 'java':
      return `# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

# ---- Production stage ----
FROM ${profile.dockerBase}
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
`;

    case 'go':
      return `# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server .

# ---- Production stage ----
FROM gcr.io/distroless/static-debian12
COPY --from=builder /server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
`;

    default:
      return `# syntax=docker/dockerfile:1

FROM ${profile.dockerBase}
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "echo 'Configure CMD for your application'"]
`;
  }
}

// ---------------------------------------------------------------------------
// SECURITY.md
// ---------------------------------------------------------------------------

function generateSecurityPolicy(repoFullName) {
  return `# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Please refer to the table below:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in **${repoFullName}**, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email the maintainers or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).
3. Include a detailed description of the vulnerability, steps to reproduce, and potential impact.

We aim to respond within **72 hours** and will coordinate a fix and responsible disclosure timeline with you.

## Security Scanning

This repository uses the following automated security tools:
- **GitHub CodeQL**: Static Application Security Testing (SAST) on every push and PR.
- **Dependabot**: Automated dependency vulnerability alerts and version updates.
`;
}

// ---------------------------------------------------------------------------
// .env.example
// ---------------------------------------------------------------------------

function generateEnvExample(langName) {
  return `# Application configuration
# Copy this file to .env and populate with real values.
# NEVER commit a populated .env file to source control.

NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Authentication
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1h

# External services (add your service credentials here)
# API_KEY=your_api_key_here
`;
}

// ---------------------------------------------------------------------------
// CONTRIBUTING.md
// ---------------------------------------------------------------------------

function generateContributing(repoFullName, lang) {
  const profile = lang ? lang.profile : null;
  const testCmd = profile ? profile.testCommand : 'npm test';

  return `# Contributing to ${repoFullName.split('/')[1]}

Thank you for your interest in contributing! Please read this guide before submitting a pull request.

## Development Setup

1. **Fork** the repository and clone your fork.
2. **Install dependencies**: follow the setup instructions in the README.
3. **Create a feature branch**: \`git checkout -b feat/your-feature-name\`

## Running Tests

\`\`\`bash
${testCmd}
\`\`\`

## Submitting Changes

1. Ensure all tests pass.
2. Keep commits small and focused with clear messages.
3. Open a Pull Request against the \`main\` branch.
4. Describe **what** you changed and **why**.

## Code Style

Please follow the existing code style conventions in the repository.

## Code of Conduct

Be respectful and constructive. See our [Code of Conduct](CODE_OF_CONDUCT.md) for details.
`;
}

module.exports = {
  generateCIWorkflow,
  generateCodeQLWorkflow,
  generateDependabotConfig,
  generateDockerfile,
  generateSecurityPolicy,
  generateEnvExample,
  generateContributing,
};
