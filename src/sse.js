'use strict';

/**
 * SSE (Server-Sent Events) helpers for GitHub Copilot Agent streaming responses.
 *
 * The Copilot Agent protocol expects streaming responses in OpenAI-compatible
 * chat completion delta format, sent as SSE events.
 */

/**
 * Configure the HTTP response for SSE streaming.
 * @param {import('express').Response} res
 */
function initSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/**
 * Send a text chunk as a delta SSE event.
 * @param {import('express').Response} res
 * @param {string} text
 */
function sendChunk(res, text) {
  const payload = {
    choices: [{ delta: { content: text }, finish_reason: null }],
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Send the stop event and close the stream.
 * @param {import('express').Response} res
 */
function sendDone(res) {
  const stopPayload = {
    choices: [{ delta: {}, finish_reason: 'stop' }],
  };
  res.write(`data: ${JSON.stringify(stopPayload)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Send an error message as a streamed response and close.
 * @param {import('express').Response} res
 * @param {string} message
 */
function sendError(res, message) {
  sendChunk(res, `\n⚠️ **Error:** ${message}\n`);
  sendDone(res);
}

/**
 * Stream a full string with word-level chunking for a typewriter effect.
 * @param {import('express').Response} res
 * @param {string} text
 */
async function streamText(res, text) {
  // Split on word boundaries, keeping delimiters so markdown isn't broken.
  const words = text.match(/(\S+|\s+)/g) || [];
  for (const word of words) {
    sendChunk(res, word);
    // Tiny delay to create a readable streaming appearance.
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

module.exports = { initSSE, sendChunk, sendDone, sendError, streamText };
