/* Safe, side-effect-free validation helpers for confirmed care inheritance. */
function validateDogCareInheritanceReviewV1_(review, source) {
  review = review && typeof review === 'object' ? review : {};
  source = source && typeof source === 'object' ? source : {};
  if (review.confirmed !== true) throw new Error('Care inheritance requires explicit review confirmation.');
  ['sourceDogId', 'sourceStayKey', 'sourceEndDate'].forEach(function(key) {
    if (!String(review[key] || '').trim() || String(review[key]) !== String(source[key] || '')) {
      throw new Error('Reviewed care source does not match the selected stay.');
    }
  });
  if (review.sourceStayId && String(review.sourceStayId) !== String(source.sourceStayId || '')) throw new Error('Reviewed care source does not match the selected stay.');
  function plainObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object.');
    var copy = {};
    Object.keys(value).forEach(function(key) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
      var item = value[key];
      if (item === null || item === undefined || (typeof item === 'string' && !item.trim())) return;
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') copy[key] = item;
    });
    return copy;
  }
  return {
    profile: plainObject(review.profile, 'Reviewed care profile'),
    riskFlags: plainObject(review.riskFlags, 'Reviewed care flags')
  };
}

/* Merge only supplied reviewed values. Missing/blank source data never clears a destination field. */
function mergeReviewedDogCareFieldsV1_(current, reviewed) {
  current = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  reviewed = reviewed && typeof reviewed === 'object' && !Array.isArray(reviewed) ? reviewed : {};
  var merged = {};
  Object.keys(current).forEach(function(key) { merged[key] = current[key]; });
  Object.keys(reviewed).forEach(function(key) {
    var value = reviewed[key];
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') merged[key] = value;
  });
  return merged;
}
