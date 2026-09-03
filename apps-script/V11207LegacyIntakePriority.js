/* ============================================================
 * WAFFLE HOUSE V11.2.07 — LEGACY INTAKE PROVIDER PRIORITY
 * ------------------------------------------------------------
 * Provider order for the Legacy Intake scanner:
 *   1. Groq Vision
 *   2. Gemini
 *   3. Browser Tesseract fallback (handled by LegacyIntake.html)
 *
 * Browser-rendered page images are supplied to this bridge so Groq can be
 * attempted first even for older stored PDFs that pre-date persisted Groq OCR
 * page assets. The existing V11.2.03 provider/apply pipeline remains the
 * source of truth for cloud OCR, conflict review, Profile/Care writes and
 * audit logging.
 * ============================================================ */

var LEGACY_INTAKE_PRIORITY_VERSION_V11207_ = '11.2.07';
var LEGACY_INTAKE_PRIORITY_MAX_PAGES_V11207_ = 20;


function retryLegacyIntakeAiPriorityV11207(payload) {
  assertWaffleActionAllowedDuringMaintenance_('retryLegacyIntakeAiPriorityV11207');

  payload = payload && typeof payload === 'object' ? payload : {};
  var documentId = String(payload.documentId || '').trim();
  if (!documentId) throw new Error('Legacy document ID is required.');

  var images = (Array.isArray(payload.ocrImages) ? payload.ocrImages : [])
    .filter(function(value) {
      return /^data:image\//i.test(String(value || ''));
    })
    .slice(0, LEGACY_INTAKE_PRIORITY_MAX_PAGES_V11207_);

  // V11.2.03 was originally capped at five prepared pages. Its Groq reader
  // already chunks requests according to the selected model, so temporarily
  // widening the total prepared-page cap lets the same proven reader process
  // the full browser-rendered intake while preserving model-safe chunk sizes.
  var previousMax = LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_;
  LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_ = LEGACY_INTAKE_PRIORITY_MAX_PAGES_V11207_;

  try {
    var result = processLegacyIntakeWithProvidersV11203_(
      documentId,
      images.length ? images : null
    );

    if (result && typeof result === 'object') {
      result.providerOrder = ['groq', 'gemini', 'tesseract'];
      result.priorityVersion = LEGACY_INTAKE_PRIORITY_VERSION_V11207_;
      result.browserPagesPrepared = images.length;
    }

    return result;
  } finally {
    LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_ = previousMax;
  }
}


function getLegacyIntakeProviderPriorityV11207() {
  var config = getLegacyIntakeProviderConfigV11203_();
  return {
    result: 'success',
    version: LEGACY_INTAKE_PRIORITY_VERSION_V11207_,
    providerOrder: ['groq', 'gemini', 'tesseract'],
    groqConfigured: !!config.groqApiKey,
    groqModel: config.groqModel,
    geminiConfigured: !!config.geminiApiKey,
    geminiFallbackEnabled: config.geminiFallbackEnabled,
    tesseractFallback: 'browser',
    maxPreparedPdfPages: LEGACY_INTAKE_PRIORITY_MAX_PAGES_V11207_
  };
}
