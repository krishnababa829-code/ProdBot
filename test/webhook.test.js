'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { verifySignature } = require('../src/webhook');

describe('verifySignature', () => {
  it('returns true when WEBHOOK_SECRET is not set (dev mode)', () => {
    // The module reads process.env.WEBHOOK_SECRET at load time, but verifySignature
    // reads the module-level constant. Without a secret configured, any signature passes.
    const result = verifySignature(Buffer.from('{}'), '');
    assert.equal(result, true);
  });
});
