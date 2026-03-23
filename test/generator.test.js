'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  generateCIWorkflow,
  generateCodeQLWorkflow,
  generateDependabotConfig,
  generateDockerfile,
  generateSecurityPolicy,
  generateEnvExample,
} = require('../src/generator');

const JS_LANG = {
  name: 'javascript',
  profile: {
    dockerBase: 'node:20-alpine',
    testCommand: 'npm test',
    buildCommand: 'npm run build',
    lintCommand: 'npm run lint',
    testFrameworks: ['jest'],
  },
};

const PYTHON_LANG = {
  name: 'python',
  profile: {
    dockerBase: 'python:3.12-slim',
    testCommand: 'pytest',
    buildCommand: null,
    lintCommand: 'flake8 .',
    testFrameworks: ['pytest'],
  },
};

// ---------------------------------------------------------------------------
// generateCIWorkflow
// ---------------------------------------------------------------------------

describe('generateCIWorkflow', () => {
  it('generates a valid YAML structure for JavaScript', () => {
    const yaml = generateCIWorkflow(JS_LANG);
    assert.ok(yaml.includes('name: CI'));
    assert.ok(yaml.includes('actions/checkout@v4'));
    assert.ok(yaml.includes('actions/setup-node@v4'));
    assert.ok(yaml.includes('npm ci'));
    assert.ok(yaml.includes('npm test'));
    assert.ok(yaml.includes('npm run lint'));
    assert.ok(yaml.includes('npm run build'));
  });

  it('generates a valid YAML structure for Python', () => {
    const yaml = generateCIWorkflow(PYTHON_LANG);
    assert.ok(yaml.includes('actions/setup-python@v5'));
    assert.ok(yaml.includes('pip install -r requirements.txt'));
    assert.ok(yaml.includes('pytest'));
    assert.ok(yaml.includes('flake8 .'));
  });

  it('omits build step when buildCommand is null', () => {
    const yaml = generateCIWorkflow(PYTHON_LANG);
    assert.ok(!yaml.includes('Build\n'));
  });

  it('includes push and pull_request triggers', () => {
    const yaml = generateCIWorkflow(JS_LANG);
    assert.ok(yaml.includes('push:'));
    assert.ok(yaml.includes('pull_request:'));
  });
});

// ---------------------------------------------------------------------------
// generateCodeQLWorkflow
// ---------------------------------------------------------------------------

describe('generateCodeQLWorkflow', () => {
  it('generates CodeQL workflow for JavaScript', () => {
    const yaml = generateCodeQLWorkflow('javascript');
    assert.ok(yaml.includes('github/codeql-action/init@v3'));
    assert.ok(yaml.includes('languages: javascript'));
    assert.ok(yaml.includes('security-events: write'));
  });

  it('maps TypeScript to javascript CodeQL language', () => {
    const yaml = generateCodeQLWorkflow('typescript');
    assert.ok(yaml.includes('languages: javascript'));
  });

  it('generates CodeQL workflow for Python', () => {
    const yaml = generateCodeQLWorkflow('python');
    assert.ok(yaml.includes('languages: python'));
  });

  it('includes weekly schedule', () => {
    const yaml = generateCodeQLWorkflow('go');
    assert.ok(yaml.includes('schedule:'));
    assert.ok(yaml.includes('cron:'));
  });
});

// ---------------------------------------------------------------------------
// generateDependabotConfig
// ---------------------------------------------------------------------------

describe('generateDependabotConfig', () => {
  it('generates npm ecosystem for JavaScript', () => {
    const yaml = generateDependabotConfig('javascript');
    assert.ok(yaml.includes('package-ecosystem: "npm"'));
    assert.ok(yaml.includes('package-ecosystem: "github-actions"'));
  });

  it('generates pip ecosystem for Python', () => {
    const yaml = generateDependabotConfig('python');
    assert.ok(yaml.includes('package-ecosystem: "pip"'));
  });

  it('generates gomod ecosystem for Go', () => {
    const yaml = generateDependabotConfig('go');
    assert.ok(yaml.includes('package-ecosystem: "gomod"'));
  });

  it('includes weekly schedule', () => {
    const yaml = generateDependabotConfig('javascript');
    assert.ok(yaml.includes('interval: "weekly"'));
  });
});

// ---------------------------------------------------------------------------
// generateDockerfile
// ---------------------------------------------------------------------------

describe('generateDockerfile', () => {
  it('generates a multi-stage Dockerfile for JavaScript', () => {
    const dockerfile = generateDockerfile(JS_LANG);
    assert.ok(dockerfile.includes('FROM node:20-alpine AS builder'));
    assert.ok(dockerfile.includes('npm ci --omit=dev'));
    assert.ok(dockerfile.includes('USER node'));
    assert.ok(dockerfile.includes('EXPOSE 3000'));
  });

  it('generates a Dockerfile for Python', () => {
    const dockerfile = generateDockerfile(PYTHON_LANG);
    assert.ok(dockerfile.includes('FROM python:3.12-slim'));
    assert.ok(dockerfile.includes('pip install --no-cache-dir'));
    assert.ok(dockerfile.includes('EXPOSE 8000'));
  });
});

// ---------------------------------------------------------------------------
// generateSecurityPolicy
// ---------------------------------------------------------------------------

describe('generateSecurityPolicy', () => {
  it('generates a security policy with the repo name', () => {
    const md = generateSecurityPolicy('owner/my-repo');
    assert.ok(md.includes('owner/my-repo'));
    assert.ok(md.includes('Reporting a Vulnerability'));
    assert.ok(md.includes('CodeQL'));
    assert.ok(md.includes('Dependabot'));
  });
});

// ---------------------------------------------------------------------------
// generateEnvExample
// ---------------------------------------------------------------------------

describe('generateEnvExample', () => {
  it('generates an env example with common keys', () => {
    const env = generateEnvExample('javascript');
    assert.ok(env.includes('NODE_ENV=production'));
    assert.ok(env.includes('PORT='));
    assert.ok(env.includes('DATABASE_URL='));
    // Placeholder values in comments are acceptable for documentation purposes
    assert.ok(env.includes('API_KEY'));
  });
});
