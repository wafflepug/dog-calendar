'use strict';
const fs = require('node:fs');
const path = require('node:path');

function generate(env, now = new Date()) {
  const commitSha = String(env.GITHUB_SHA || '');
  const workflowRunId = String(env.GITHUB_RUN_ID || '');
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('A full deployment commit SHA is required.');
  if (!/^[0-9]+$/.test(workflowRunId)) throw new Error('A public workflow run ID is required.');
  const identity = { schemaVersion: 1, commitSha, generatedAt: now.toISOString(), workflowRunId };
  return 'var WAFFLE_DEPLOYMENT_IDENTITY_ = ' + JSON.stringify(identity) + ';\n';
}

if (require.main === module) {
  const target = path.resolve(__dirname, '../apps-script/DeploymentIdentity.js');
  const source = fs.readFileSync(target, 'utf8');
  if (!/^var WAFFLE_DEPLOYMENT_IDENTITY_ = null;$/m.test(source)) throw new Error('Expected the committed unknown-identity placeholder.');
  fs.writeFileSync(target, source.replace(/^var WAFFLE_DEPLOYMENT_IDENTITY_ = null;$/m, generate(process.env).trim()));
}
module.exports = { generate };
