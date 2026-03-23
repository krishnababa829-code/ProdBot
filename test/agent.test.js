'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { detectIntent, extractRepoRef } = require('../src/agent');

// ---------------------------------------------------------------------------
// detectIntent
// ---------------------------------------------------------------------------

describe('detectIntent', () => {
  it('returns "action" for "prodify this repository"', () => {
    assert.equal(detectIntent('prodify this repository'), 'action');
  });

  it('returns "action" for "make this production ready"', () => {
    assert.equal(detectIntent('make this production ready'), 'action');
  });

  it('returns "action" for "productionize this repo"', () => {
    assert.equal(detectIntent('productionize this repo'), 'action');
  });

  it('returns "action" for "create a CI/CD pipeline"', () => {
    assert.equal(detectIntent('create a CI/CD pipeline'), 'action');
  });

  it('returns "action" for "add a dockerfile"', () => {
    assert.equal(detectIntent('add a dockerfile'), 'action');
  });

  it('returns "action" for "add github actions"', () => {
    assert.equal(detectIntent('add github actions'), 'action');
  });

  it('returns "action" for "transform this poc"', () => {
    assert.equal(detectIntent('transform this poc'), 'action');
  });

  it('returns "action" for "is this repository production ready?"', () => {
    assert.equal(detectIntent('is this repository production ready?'), 'action');
  });

  it('returns "analysis" for "analyze this repository"', () => {
    assert.equal(detectIntent('analyze this repository'), 'analysis');
  });

  it('returns "analysis" for "what is missing?"', () => {
    assert.equal(detectIntent('what is missing?'), 'analysis');
  });

  it('returns "analysis" for "check production readiness"', () => {
    assert.equal(detectIntent('check production readiness'), 'analysis');
  });

  it('returns "help" for a generic question', () => {
    assert.equal(detectIntent('hello, what can you do?'), 'help');
  });

  it('is case-insensitive', () => {
    assert.equal(detectIntent('PRODIFY'), 'action');
    assert.equal(detectIntent('ANALYZE THIS REPO'), 'analysis');
  });
});

// ---------------------------------------------------------------------------
// extractRepoRef
// ---------------------------------------------------------------------------

describe('extractRepoRef', () => {
  it('extracts owner and repo from copilot references', () => {
    const refs = [
      {
        type: 'github.repository',
        data: { owner: { login: 'octocat' }, name: 'hello-world' },
      },
    ];
    const result = extractRepoRef(refs);
    assert.deepEqual(result, { owner: 'octocat', repo: 'hello-world' });
  });

  it('handles owner as plain string', () => {
    const refs = [
      {
        type: 'github.repository',
        data: { owner: 'octocat', name: 'my-repo' },
      },
    ];
    const result = extractRepoRef(refs);
    assert.deepEqual(result, { owner: 'octocat', repo: 'my-repo' });
  });

  it('returns null when no github.repository reference exists', () => {
    const refs = [{ type: 'github.user', data: {} }];
    assert.equal(extractRepoRef(refs), null);
  });

  it('returns null for undefined input', () => {
    assert.equal(extractRepoRef(undefined), null);
  });

  it('returns null for empty array', () => {
    assert.equal(extractRepoRef([]), null);
  });

  it('returns null when data is missing name', () => {
    const refs = [{ type: 'github.repository', data: { owner: { login: 'octocat' } } }];
    assert.equal(extractRepoRef(refs), null);
  });
});
