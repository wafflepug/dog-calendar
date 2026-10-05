// Deployment-only public attribution. The workflow replaces this placeholder
// in its checkout before clasp push; local/manual pushes report unknown.
var WAFFLE_DEPLOYMENT_IDENTITY_ = null;

function getWaffleDeploymentIdentity_() {
  var value = WAFFLE_DEPLOYMENT_IDENTITY_;
  if (!value || value.schemaVersion !== 1 ||
      !/^[a-f0-9]{40}$/.test(String(value.commitSha || "")) ||
      !isFinite(Date.parse(String(value.generatedAt || ""))) ||
      !/^[0-9]+$/.test(String(value.workflowRunId || ""))) return null;
  // Return only public identifiers, never deploy credentials or configuration.
  return {
    schemaVersion: 1,
    commitSha: value.commitSha,
    generatedAt: value.generatedAt,
    workflowRunId: String(value.workflowRunId)
  };
}
