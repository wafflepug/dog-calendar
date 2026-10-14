(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WAFFLE_BOOKING_PLAN = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MAX_DAYS = 90;
  const MAX_VISITS = 12;
  const MAX_DOGS = 5;
  const MAX_ROWS = 30;

  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }

  function dateString(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function dayNumber(value) {
    const date = parseDate(value);
    return date ? Math.floor(date.getTime() / 86400000) : NaN;
  }

  function weeklyVisits(start, until) {
    const first = parseDate(start);
    const last = parseDate(until);
    if (!first || !last || last < first) throw new RangeError('Start and end must be valid dates, with end on or after start.');
    const span = Math.floor((last - first) / 86400000);
    if (span > MAX_DAYS) throw new RangeError('Weekly visit range cannot exceed 90 days.');
    const visits = [];
    for (let offset = 0; offset <= span; offset += 7) {
      if (visits.length >= MAX_VISITS) throw new RangeError('A plan cannot contain more than 12 visits.');
      const date = new Date(first.getTime() + offset * 86400000);
      const value = dateString(date);
      visits.push({ startDate: value, endDate: value });
    }
    return visits;
  }

  function normalizedName(value) {
    return String(value || '').toLocaleLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function isConfirmed(row) {
    const type = String(row && row.bookingType || '').toLowerCase();
    return type === 'boarding' || type === 'confirmed boarding';
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && bStart <= aEnd;
  }

  function validatePlan(input, existingRows, settings) {
    const issues = [];
    const warnings = [];
    const plan = input || {};
    const dogs = Array.isArray(plan.dogs) ? plan.dogs : [];
    const visits = Array.isArray(plan.visits) ? plan.visits : [];
    const rows = Array.isArray(existingRows) ? existingRows.filter(isConfirmed) : [];
    const limits = settings || {};
    const preferred = Number.isFinite(Number(limits.preferred)) ? Math.max(1, Number(limits.preferred)) : 6;
    const absolute = Number.isFinite(Number(limits.absolute)) ? Math.max(preferred, Number(limits.absolute)) : Math.max(preferred, 8);

    if (!String(plan.ownerName || '').trim()) issues.push('Owner name is required.');
    if (!String(plan.phone || '').trim()) issues.push('Phone is required.');
    if (dogs.length < 1) issues.push('Add at least one dog.');
    if (dogs.length > MAX_DOGS) issues.push('A plan cannot contain more than 5 dogs.');
    if (visits.length < 1) issues.push('Add at least one visit.');
    if (visits.length > MAX_VISITS) issues.push('A plan cannot contain more than 12 visits.');
    if (dogs.length * visits.length > MAX_ROWS) issues.push('A plan cannot contain more than 30 dog visits.');
    if (!['stay', 'same-day'].includes(plan.visitMode)) issues.push('Visit mode must be stay or same-day.');
    if (dogs.length > MAX_DOGS || visits.length > MAX_VISITS || dogs.length * visits.length > MAX_ROWS) {
      return { issues, warnings, peak: 0 };
    }

    const keys = new Set();
    const dogIds = new Set();
    const seenNames = new Set();
    for (const dog of dogs) {
      if (!dog || typeof dog.key !== 'string' || !dog.key.trim()) issues.push('Every dog needs an explicit key.');
      else if (keys.has(dog.key)) issues.push(`Duplicate dog key: ${dog.key}.`);
      else keys.add(dog.key);
      if (!String(dog && dog.dogName || '').trim()) issues.push('Dog name is required.');
      if (!String(dog && dog.breed || '').trim()) issues.push(`Breed is required for ${dog && dog.dogName || 'each dog'}.`);
      if (dog && dog.dogId) {
        if (!UUID.test(String(dog.dogId))) issues.push(`Dog ID for ${dog.dogName || 'a dog'} must be a UUID.`);
        else if (dogIds.has(String(dog.dogId).toLowerCase())) issues.push(`Duplicate Dog ID: ${dog.dogId}.`);
        else dogIds.add(String(dog.dogId).toLowerCase());
      }
      if (dog) {
        const name = normalizedName(dog.dogName);
        if (name && seenNames.has(name)) issues.push(`Duplicate dog name in plan: ${dog.dogName}.`);
        else if (name) seenNames.add(name);
      }
    }

    const validVisits = [];
    for (const visit of visits) {
      const start = visit && visit.startDate;
      const end = visit && visit.endDate;
      if (!parseDate(start) || !parseDate(end)) {
        issues.push('Every visit must use real YYYY-MM-DD dates.');
        continue;
      }
      if (end < start) {
        issues.push(`Visit end must be on or after its start (${start}).`);
        continue;
      }
      if (dayNumber(end) - dayNumber(start) > MAX_DAYS) {
        issues.push(`Visit ${start}–${end} exceeds the 90-day limit.`);
        continue;
      }
      if (plan.visitMode === 'same-day' && end !== start) issues.push(`Same-day visits must end on their start date (${start}).`);
      validVisits.push({ start, end });
    }
    const orderedVisits = validVisits.slice().sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    for (let i = 1; i < orderedVisits.length; i++) {
      if (overlaps(orderedVisits[i - 1].start, orderedVisits[i - 1].end, orderedVisits[i].start, orderedVisits[i].end)) {
        issues.push('Visits cannot duplicate or overlap.');
        break;
      }
    }

    for (const dog of dogs) {
      const review = dog && dog.inheritCareReview;
      if (!review) continue;
      const hasValues = !!((review.profile && typeof review.profile === 'object' && Object.keys(review.profile).length) || (review.riskFlags && typeof review.riskFlags === 'object' && Object.keys(review.riskFlags).length));
      if (!dog.dogId || !UUID.test(String(dog.dogId)) || String(review.sourceDogId || '').toLowerCase() !== String(dog.dogId || '').toLowerCase()) issues.push(`Reviewed care for ${dog.dogName || 'a dog'} must match that dog's exact Dog ID.`);
      if (review.confirmed !== true) issues.push(`Reviewed care for ${dog.dogName || 'a dog'} needs explicit confirmation.`);
      if (!review.sourceStayKey || !parseDate(review.sourceEndDate)) issues.push(`Reviewed care for ${dog.dogName || 'a dog'} needs a valid source stay and end date.`);
      if (review.sourceCompletedDate && !parseDate(review.sourceCompletedDate)) issues.push(`Reviewed care for ${dog.dogName || 'a dog'} needs a valid completed date.`);
      if (!hasValues) issues.push(`Reviewed care for ${dog.dogName || 'a dog'} has no saved profile or risk values.`);
      const completedDate = review.sourceCompletedDate || review.sourceEndDate;
      if (parseDate(review.sourceEndDate) && parseDate(completedDate) && validVisits.some(visit => review.sourceEndDate >= visit.start || completedDate >= visit.start)) {
        issues.push(`Reviewed care for ${dog.dogName || 'a dog'} must come from a completed stay before every planned visit.`);
      }
    }

    for (const dog of dogs) {
      if (!dog || !dog.dogName) continue;
      const name = normalizedName(dog.dogName);
      for (const visit of validVisits) {
        for (const row of rows) {
          if (!parseDate(row.startDate) || !parseDate(row.endDate) || row.endDate < row.startDate) continue;
          const sameName = normalizedName(row.dogName || row.normalizedDog) === name;
          const sameId = !!dog.dogId && String(row.dogId || '').toLowerCase() === String(dog.dogId).toLowerCase();
          if (sameName && row.startDate === visit.start && row.endDate === visit.end) {
            issues.push(`A confirmed stay for ${dog.dogName} already exists on ${visit.start}–${visit.end}.`);
          }
          if (sameId && overlaps(visit.start, visit.end, row.startDate, row.endDate)) {
            issues.push(`Confirmed visits for Dog ID ${dog.dogId} overlap ${row.startDate}–${row.endDate}.`);
          } else if (sameName && !dog.dogId && overlaps(visit.start, visit.end, row.startDate, row.endDate)) {
            warnings.push(`A confirmed stay with the same legacy name (${dog.dogName}) overlaps ${row.startDate}–${row.endDate}; identity cannot be verified.`);
          }
        }
      }
    }

    const daily = new Map();
    const requestedDogs = dogs.reduce((total, dog) => total + countDogs(dog?.dogName), 0);
    for (const visit of validVisits) {
      const from = dayNumber(visit.start), to = dayNumber(visit.end);
      for (let day = from; day <= to; day++) daily.set(day, (daily.get(day) || 0) + requestedDogs);
    }
    function countDogs(name) {
      const count = String(name || '').split(/&|\s+and\s+/i).map(value => value.trim()).filter(Boolean).length;
      return Math.max(1, count);
    }
    for (const row of rows) {
      const from = dayNumber(row.startDate), to = dayNumber(row.endDate);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
      for (const day of daily.keys()) if (day >= from && day <= to) daily.set(day, daily.get(day) + countDogs(row.dogName));
    }
    const peak = Math.max(0, ...daily.values());
    if (peak > absolute) warnings.push(`Capacity would reach ${peak}, above the absolute setting of ${absolute}.`);
    else if (peak > preferred) warnings.push(`Capacity would reach ${peak}, above the preferred setting of ${preferred}.`);
    return { issues: [...new Set(issues)], warnings: [...new Set(warnings)], peak };
  }

  function createPlan(input, uuid) {
    if (typeof uuid !== 'function') throw new TypeError('createPlan requires a UUID generator.');
    const source = input || {};
    const validation = validatePlan(source);
    if (validation.issues.length) {
      const error = new Error(validation.issues.join(' '));
      error.issues = validation.issues;
      throw error;
    }
    const dogs = JSON.parse(JSON.stringify(Array.isArray(source.dogs) ? source.dogs : []));
    const visits = JSON.parse(JSON.stringify(Array.isArray(source.visits) ? source.visits : []));
    const rows = [];
    dogs.forEach(dog => visits.forEach(visit => {
      const stayId = uuid();
      const notes = [dog.notes, source.source && source.source !== 'Other' ? `Source: ${String(source.source).trim()}` : '', source.visitMode === 'same-day' ? 'Same-day care visit' : ''].filter(Boolean).join('\n');
      const payload = {
        action: 'create_boarding',
        stayIdentityVersion: 1,
        stayId,
        clientMutationId: uuid(),
        dogName: String(dog.dogName || '').trim(),
        breed: String(dog.breed || '').trim(),
        startDate: visit.startDate,
        endDate: visit.endDate,
        ownerName: String(source.ownerName || '').trim(),
        phone: String(source.phone || '').trim(),
        notes
      };
      if (dog.dogId) {
        payload.dogId = dog.dogId;
        payload.inheritDogPhoto = true;
      }
      const review = dog.inheritCareReview;
      const completionDate = review && (review.sourceCompletedDate || review.sourceEndDate);
      const hasReviewedValues = review && ((review.profile && Object.keys(review.profile).length) || (review.riskFlags && Object.keys(review.riskFlags).length));
      if (review && review.confirmed === true && dog.dogId && String(review.sourceDogId || '').toLowerCase() === String(dog.dogId).toLowerCase() && review.sourceStayKey && parseDate(review.sourceEndDate) && parseDate(completionDate) && hasReviewedValues && visits.every(item => parseDate(item.startDate) && review.sourceEndDate < item.startDate && completionDate < item.startDate)) {
        payload.inheritCareReview = JSON.parse(JSON.stringify({
          sourceDogId: review.sourceDogId,
          sourceStayId: review.sourceStayId || '',
          sourceStayKey: review.sourceStayKey,
          sourceEndDate: review.sourceEndDate,
          ...(review.sourceCompletedDate ? { sourceCompletedDate: review.sourceCompletedDate } : {}),
          confirmed: true,
          profile: JSON.parse(JSON.stringify(review.profile || {})),
          riskFlags: JSON.parse(JSON.stringify(review.riskFlags || {}))
        }));
      }
      rows.push({ key: `${dog.key}:${visit.startDate}:${visit.endDate}`, dogKey: dog.key, payload, status: 'pending', attempted: false, error: '', intakeLink: '', dogNumber: '' });
    }));
    return { dogs, rows, locked: false };
  }

  function safeHttps(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) { return ''; }
  }

  async function savePlan(plan, options) {
    const config = options || {};
    if (!plan || !Array.isArray(plan.rows)) throw new TypeError('A booking plan with rows is required.');
    if (plan.locked) return { status: 'locked' };
    if (typeof config.write !== 'function') throw new TypeError('savePlan requires a write function.');
    plan.locked = true;
    const changed = () => { if (typeof config.onChange === 'function') { try { config.onChange(plan); } catch (_) { /* UI notification failures do not change save state. */ } } };
    try {
      changed();
      for (let i = 0; i < plan.rows.length; i++) {
        const row = plan.rows[i];
        if (row.status === 'saved') continue;
        row.status = 'saving'; row.error = ''; changed();
        row.attempted = true;
        try {
          const response = await config.write(JSON.parse(JSON.stringify(row.payload)));
          const dogId = response && (response.dogId || (response.booking && response.booking.dogId));
          const echoedStayId = response && (response.stayId || (response.booking && response.booking.stayId));
          const expectedId = row.payload.dogId;
          if (!response || response.result !== 'success' || response.queued === true) {
            row.status = response && response.queued === true ? 'queued' : 'pending';
            row.error = row.status === 'queued' ? 'The save was queued and needs reconciliation before continuing.' : String(response && (response.error || response.message) || 'The save did not return success.');
            changed();
            return { status: row.status, row };
          }
          if (!UUID.test(String(dogId || ''))) throw new Error('The response did not confirm a valid Dog ID.');
          if (String(echoedStayId || '') !== String(row.payload.stayId)) throw new Error('The response did not confirm this stay identity.');
          if (expectedId && String(dogId).toLowerCase() !== String(expectedId).toLowerCase()) throw new Error('The response Dog ID did not match the selected dog.');
          row.status = 'saved'; row.error = '';
          row.dogNumber = String(response.dogNumber || (response.booking && response.booking.dogNumber) || '');
          const savedDog = plan.dogs.find(item => item.key === row.dogKey);
          if (savedDog && row.dogNumber) savedDog.dogNumber = row.dogNumber;
          row.intakeLink = safeHttps(response.intake && response.intake.link || response.intakeLink || '');
          if (!expectedId) {
            const dog = plan.dogs.find(item => item.key === row.dogKey);
            if (dog && !dog.dogId) dog.dogId = dogId;
            for (let j = i + 1; j < plan.rows.length; j++) {
              const next = plan.rows[j];
              if (next.dogKey !== row.dogKey || next.status !== 'pending' || next.attempted) continue;
              next.payload.dogId = dogId;
              next.payload.inheritDogPhoto = true;
            }
          }
          changed();
        } catch (error) {
          row.status = 'pending'; row.error = String(error && error.message || error); changed();
          return { status: 'pending', row };
        }
      }
      return { status: 'saved' };
    } finally {
      plan.locked = false;
      changed();
    }
  }

  return { weeklyVisits, validatePlan, createPlan, savePlan };
});
