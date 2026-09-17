'use strict';

const READ_ACTIONS = new Set([
  'maintenance_status', 'health', 'belongings_health', 'waffle_ai_health',
  'get_data_versions', 'get_audit_log', 'get_guest_directory', 'get_potential_stays',
  'get_past_guest_directory', 'get_guest_profile', 'get_guest_belongings',
  'get_stay_operations', 'get_dog_master_profile', 'get_dog_history',
  'get_notification_centre',
  'get_returning_guest_prefill', 'get_reminders_notes', 'get_intake_statuses',
  'get_legacy_intake_statuses', 'get_intake_prefill', 'get_belongings'
]);

function localBackendRequestPolicy({ method, action }) {
  const verb = String(method || 'GET').toUpperCase();
  const name = String(action || '');
  if (!['GET', 'HEAD'].includes(verb)) return { allowed: false, reason: 'non-read method' };
  if (!READ_ACTIONS.has(name)) return { allowed: false, reason: 'unapproved action' };
  return { allowed: true, reason: 'approved read' };
}

function resolveLocalBackendAction({ method, url }) {
  const parsed = new URL(String(url));
  const top = parsed.searchParams.get('action');
  let payload = null;
  try { payload = JSON.parse(parsed.searchParams.get('payload') || 'null'); } catch (_) { if (parsed.searchParams.has('payload')) return { action: null, policy: { allowed: false, reason: 'invalid payload' } }; }
  const nested = payload && typeof payload === 'object' ? String(payload.action || '') : '';
  if (top && nested && top !== nested) return { action: null, policy: { allowed: false, reason: 'conflicting actions' } };
  const action = top || nested;
  return { action, policy: localBackendRequestPolicy({ method, action }) };
}

module.exports = { localBackendRequestPolicy, resolveLocalBackendAction };
