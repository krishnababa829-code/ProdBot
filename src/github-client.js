'use strict';

/**
 * GitHub Client
 * Wraps @octokit/rest to provide high-level operations used by ProdBot.
 */

const { Octokit } = require('@octokit/rest');

/**
 * Create an Octokit instance authenticated with the given token.
 * @param {string} token - GitHub token (user or app installation token)
 */
function createClient(token) {
  return new Octokit({ auth: token });
}

/**
 * Fetch all file paths in a repository tree (recursive).
 * @param {Octokit} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} [ref='HEAD']
 */
async function listRepositoryFiles(octokit, owner, repo, ref = 'HEAD') {
  try {
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref,
      recursive: '1',
    });
    return data.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);
  } catch {
    return [];
  }
}

/**
 * Create a new branch from the default branch.
 * @param {Octokit} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} branchName
 */
async function createBranch(octokit, owner, repo, branchName) {
  // Get default branch SHA
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const sha = refData.object.sha;

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha,
  });

  return { defaultBranch, sha };
}

/**
 * Create or update a file in the repository.
 * @param {Octokit} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string} path
 * @param {string} content
 * @param {string} message
 */
async function upsertFile(octokit, owner, repo, branch, path, content, message) {
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    sha = data.sha;
  } catch {
    sha = undefined;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  });
}

/**
 * Create a Pull Request.
 * @param {Octokit} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} head
 * @param {string} base
 * @param {string} title
 * @param {string} body
 */
async function createPullRequest(octokit, owner, repo, head, base, title, body) {
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });
  return data;
}

module.exports = {
  createClient,
  listRepositoryFiles,
  createBranch,
  upsertFile,
  createPullRequest,
};
