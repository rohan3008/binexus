export const ACTIONS = new Set(['pause', 'strip', 'delete']);

export function validatePlan(plan, report) {
  if (plan?.version !== 1) throw new Error('plan.json: unsupported version (expected 1)');
  if (report?.version !== 1) throw new Error('report.json: unsupported version (expected 1)');
  if (!Array.isArray(plan.actions)) throw new Error('plan.json: actions must be an array');
  return plan.actions.map((a, i) => {
    if (!ACTIONS.has(a.action)) throw new Error(`plan.json: actions[${i}] has unknown action "${a.action}" (pause|strip|delete)`);
    const project = report.projects.find((p) => p.path === a.path);
    if (!project) throw new Error(`plan.json: actions[${i}] path ${a.path} is not in report.json`);
    return { action: a.action, project, acknowledgeProtected: a.acknowledgeProtected === true };
  });
}
