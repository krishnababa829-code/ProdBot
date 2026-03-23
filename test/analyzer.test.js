'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRepository, detectLanguage, checkIndicators, computeMatrix, identifyGaps } = require('../src/analyzer');

// ---------------------------------------------------------------------------
// detectLanguage
// ---------------------------------------------------------------------------

describe('detectLanguage', () => {
  it('detects JavaScript from package.json', () => {
    const result = detectLanguage(['src/index.js', 'package.json', 'README.md']);
    assert.equal(result.name, 'javascript');
  });

  it('detects TypeScript from tsconfig.json', () => {
    const result = detectLanguage(['tsconfig.json', 'src/app.ts']);
    assert.equal(result.name, 'typescript');
  });

  it('detects Python from requirements.txt', () => {
    const result = detectLanguage(['requirements.txt', 'app.py']);
    assert.equal(result.name, 'python');
  });

  it('detects Go from go.mod', () => {
    const result = detectLanguage(['go.mod', 'main.go']);
    assert.equal(result.name, 'go');
  });

  it('detects Java from pom.xml', () => {
    const result = detectLanguage(['pom.xml', 'src/Main.java']);
    assert.equal(result.name, 'java');
  });

  it('returns null for unknown language', () => {
    const result = detectLanguage(['README.md', 'LICENSE']);
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// checkIndicators
// ---------------------------------------------------------------------------

describe('checkIndicators', () => {
  it('detects CI workflow', () => {
    const indicators = checkIndicators(['.github/workflows/ci.yml']);
    assert.equal(indicators.hasWorkflow, true);
  });

  it('detects Dockerfile', () => {
    const indicators = checkIndicators(['Dockerfile']);
    assert.equal(indicators.hasDockerfile, true);
  });

  it('detects tests in test/ directory', () => {
    const indicators = checkIndicators(['test/app.test.js']);
    assert.equal(indicators.hasTests, true);
  });

  it('detects .test. extension', () => {
    const indicators = checkIndicators(['src/app.test.ts']);
    assert.equal(indicators.hasTests, true);
  });

  it('detects CodeQL workflow', () => {
    const indicators = checkIndicators(['.github/workflows/codeql.yml']);
    assert.equal(indicators.hasCodeql, true);
  });

  it('detects Dependabot', () => {
    const indicators = checkIndicators(['.github/dependabot.yml']);
    assert.equal(indicators.hasDependabot, true);
  });

  it('detects README', () => {
    const indicators = checkIndicators(['README.md']);
    assert.equal(indicators.hasReadme, true);
  });

  it('detects .env.example', () => {
    const indicators = checkIndicators(['.env.example']);
    assert.equal(indicators.hasEnvExample, true);
  });

  it('detects Terraform IaC', () => {
    const indicators = checkIndicators(['infra/main.tf']);
    assert.equal(indicators.hasIaC, true);
  });

  it('flags nothing on empty repo', () => {
    const indicators = checkIndicators([]);
    assert.equal(indicators.hasWorkflow, false);
    assert.equal(indicators.hasTests, false);
    assert.equal(indicators.hasDockerfile, false);
  });
});

// ---------------------------------------------------------------------------
// computeMatrix
// ---------------------------------------------------------------------------

describe('computeMatrix', () => {
  it('returns 0% overall for completely bare repo', () => {
    const indicators = {
      hasWorkflow: false,
      hasDockerfile: false,
      hasReadme: false,
      hasContributing: false,
      hasLicense: false,
      hasEnvExample: false,
      hasDependabot: false,
      hasCodeql: false,
      hasSecurityPolicy: false,
      hasTests: false,
      hasIaC: false,
    };
    const matrix = computeMatrix(indicators);
    assert.equal(matrix.overall, 0);
  });

  it('returns 100% when all indicators are present', () => {
    const indicators = {
      hasWorkflow: true,
      hasDockerfile: true,
      hasReadme: true,
      hasContributing: true,
      hasLicense: true,
      hasEnvExample: true,
      hasDependabot: true,
      hasCodeql: true,
      hasSecurityPolicy: true,
      hasTests: true,
      hasIaC: true,
    };
    const matrix = computeMatrix(indicators);
    assert.equal(matrix.overall, 100);
    assert.equal(matrix.security, 100);
    assert.equal(matrix.reliability, 100);
    assert.equal(matrix.maintainability, 100);
    assert.equal(matrix.scalability, 100);
  });

  it('scores correctly for partial indicators', () => {
    const indicators = {
      hasWorkflow: true,
      hasDockerfile: false,
      hasReadme: true,
      hasContributing: false,
      hasLicense: false,
      hasEnvExample: false,
      hasDependabot: false,
      hasCodeql: false,
      hasSecurityPolicy: false,
      hasTests: true,
      hasIaC: false,
    };
    const matrix = computeMatrix(indicators);
    assert.equal(matrix.security, 0);
    assert.equal(matrix.reliability, 67); // workflow + tests = 2/3
    assert.equal(matrix.maintainability, 33); // readme = 1/3
    assert.equal(matrix.scalability, 0);
  });
});

// ---------------------------------------------------------------------------
// identifyGaps
// ---------------------------------------------------------------------------

describe('identifyGaps', () => {
  it('reports no gaps when fully configured', () => {
    const indicators = {
      hasWorkflow: true,
      hasDockerfile: true,
      hasReadme: true,
      hasContributing: true,
      hasLicense: true,
      hasEnvExample: true,
      hasDependabot: true,
      hasCodeql: true,
      hasSecurityPolicy: true,
      hasTests: true,
      hasIaC: true,
    };
    const gaps = identifyGaps(indicators, { name: 'javascript', profile: {} });
    assert.equal(gaps.length, 0);
  });

  it('reports CI/CD gap as critical', () => {
    const indicators = {
      hasWorkflow: false, hasDockerfile: true, hasReadme: true,
      hasContributing: true, hasLicense: true, hasEnvExample: true,
      hasDependabot: true, hasCodeql: true, hasSecurityPolicy: true,
      hasTests: true, hasIaC: true,
    };
    const gaps = identifyGaps(indicators, null);
    const ciGap = gaps.find((g) => g.category === 'CI/CD');
    assert.ok(ciGap);
    assert.equal(ciGap.severity, 'critical');
  });

  it('reports Testing gap as critical', () => {
    const indicators = {
      hasWorkflow: true, hasDockerfile: true, hasReadme: true,
      hasContributing: true, hasLicense: true, hasEnvExample: true,
      hasDependabot: true, hasCodeql: true, hasSecurityPolicy: true,
      hasTests: false, hasIaC: true,
    };
    const gaps = identifyGaps(indicators, null);
    const testGap = gaps.find((g) => g.category === 'Testing');
    assert.ok(testGap);
    assert.equal(testGap.severity, 'critical');
  });

  it('identifies all gaps for a bare repo', () => {
    const indicators = {
      hasWorkflow: false, hasDockerfile: false, hasReadme: false,
      hasContributing: false, hasLicense: false, hasEnvExample: false,
      hasDependabot: false, hasCodeql: false, hasSecurityPolicy: false,
      hasTests: false, hasIaC: false,
    };
    const gaps = identifyGaps(indicators, null);
    // All 11 possible gaps should be reported
    assert.ok(gaps.length >= 9);
    const categories = gaps.map((g) => g.category);
    assert.ok(categories.includes('CI/CD'));
    assert.ok(categories.includes('Testing'));
    assert.ok(categories.includes('Security (SAST)'));
  });
});

// ---------------------------------------------------------------------------
// analyzeRepository (integration)
// ---------------------------------------------------------------------------

describe('analyzeRepository', () => {
  it('produces a complete analysis for a typical POC', () => {
    const files = ['README.md', 'package.json', 'src/index.js'];
    const result = analyzeRepository(files, 'owner/my-poc');

    assert.equal(result.repoFullName, 'owner/my-poc');
    assert.equal(result.language, 'javascript');
    assert.ok(result.indicators);
    assert.ok(result.matrix);
    assert.ok(Array.isArray(result.gaps));
    assert.ok(result.matrix.overall >= 0 && result.matrix.overall <= 100);
    // A bare POC should have a low score
    assert.ok(result.matrix.overall < 50);
  });

  it('produces a high score for a well-configured repo', () => {
    const files = [
      'README.md',
      'package.json',
      'Dockerfile',
      '.github/workflows/ci.yml',
      '.github/workflows/codeql.yml',
      '.github/dependabot.yml',
      'SECURITY.md',
      '.env.example',
      'CONTRIBUTING.md',
      'LICENSE',
      'test/app.test.js',
      'infra/main.tf',
    ];
    const result = analyzeRepository(files, 'owner/my-app');
    assert.ok(result.matrix.overall >= 75);
    assert.equal(result.gaps.length, 0);
  });
});
