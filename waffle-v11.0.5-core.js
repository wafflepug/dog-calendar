/* ============================================================
   WAFFLE HOUSE V11.0.5 — AUTHORITATIVE POTENTIAL STAY SYNC
   ============================================================ */

const V1105_VERSION =
    '11.0.5';

const V1105_POTENTIAL_CACHE_KEY =
    'calendar:shared-potential-stays:v1105';

let v1105PotentialSyncState = {
    loaded:
        false,
    serverCount:
        0,
    lastFetch:
        0,
    lastError:
        ''
};


function v1105PotentialKeyFromRecord(
    record
) {
    return makePotentialKey(
        record?.dogName ||
            '',
        record?.startDate ||
            '',
        record?.endDate ||
            record?.startDate ||
            ''
    );
}


function v1105ClearServerConfirmedTombstones(
    records
) {
    const serverKeys =
        new Set(
            (
                Array.isArray(
                    records
                )
                    ? records
                    : []
            )
                .map(
                    v1105PotentialKeyFromRecord
                )
                .filter(Boolean)
        );

    const pending =
        getPendingPotentialRemovals();

    /*
     * V11.0.4 bug:
     * pendingPotentialRemovals was originally designed to suppress stale
     * published-CSV rows after a local confirm/delete/update.
     *
     * Once Apps Script itself says a Potential Stay exists, that direct
     * server response must win. Keeping a matching local tombstone can hide a
     * valid shared Potential Stay forever on one device.
     */
    const cleanPending =
        pending.filter(
            key =>
                !serverKeys.has(
                    key
                )
        );

    if (
        cleanPending.length !==
        pending.length
    ) {
        setLocalArray(
            'pendingPotentialRemovals',
            cleanPending
        );
    }

    return serverKeys;
}

function v1105PendingStableStayRemovals() {
    try {
        const parsed = JSON.parse(localStorage.getItem('pendingStableStayRemovals') || '[]');
        return Array.isArray(parsed) ? parsed.map(value => typeof value === 'string' ? { stayId: value } : value).filter(value => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(value?.stayId || '').trim().toLowerCase())) : [];
    } catch (_) { return []; }
}

function v1105SetStableStayRemovals(ids) {
    try { localStorage.setItem('pendingStableStayRemovals', JSON.stringify(ids)); } catch (_) {}
}

function v1105AddStableStayRemoval(stayId, identity = {}) {
    const id = String(stayId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) return false;
    const record = { stayId: id, dogName: String(identity.dogName || '').trim(), dogId: String(identity.dogId || '').trim().toLowerCase(), ownerName: String(identity.ownerName || identity.owner || '').trim(), phone: String(identity.phone || '').trim() };
    v1105SetStableStayRemovals([...v1105PendingStableStayRemovals().filter(item => item.stayId !== id), record]);
    return true;
}

function v1105RemovalIdentityMatches(removal, candidate = {}) {
    const wantedDogId = String(removal?.dogId || '').trim().toLowerCase();
    const actualDogId = String(candidate?.dogId || '').trim().toLowerCase();
    if (wantedDogId || actualDogId) return !!wantedDogId && wantedDogId === actualDogId;
    const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const wantedName = norm(removal?.dogName);
    const actualName = norm(candidate?.dogName || candidate?.title);
    if (!wantedName || wantedName !== actualName) return false;
    const wantedOwner = norm(removal?.ownerName);
    const actualOwner = norm(candidate?.ownerName || candidate?.owner);
    const digits = value => String(value || '').replace(/\D/g, '');
    const wantedPhone = digits(removal?.phone);
    const actualPhone = digits(candidate?.phone);
    if (wantedOwner && actualOwner && wantedOwner !== actualOwner) return false;
    if (wantedPhone && actualPhone && wantedPhone !== actualPhone) return false;
    return !!((wantedOwner && actualOwner) || (wantedPhone && actualPhone));
}

function v1105PendingPotentialStayRemovals() {
    try {
        const parsed = JSON.parse(localStorage.getItem('pendingPotentialStayRemovals') || '[]');
        return Array.isArray(parsed) ? parsed.map(value => typeof value === 'string' ? { stayId: value } : value).filter(value => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(value?.stayId || '').trim().toLowerCase())) : [];
    } catch (_) { return []; }
}

function v1105SetPotentialStayRemovals(ids) {
    try { localStorage.setItem('pendingPotentialStayRemovals', JSON.stringify(ids)); } catch (_) {}
}

function v1105AddPotentialStayRemoval(stayId, identity = {}) {
    const id = String(stayId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) return false;
    const record = { stayId: id, dogName: String(identity.dogName || '').trim(), dogId: String(identity.dogId || '').trim().toLowerCase(), ownerName: String(identity.ownerName || identity.owner || '').trim(), phone: String(identity.phone || '').trim() };
    v1105SetPotentialStayRemovals([...v1105PendingPotentialStayRemovals().filter(item => item.stayId !== id), record]);
    return true;
}

function v1105IsPotentialStayTombstoned(stayId) {
    const id = String(stayId || '').trim().toLowerCase();
    const removal = v1105PendingPotentialStayRemovals().find(item => String(item.stayId || '').trim().toLowerCase() === id);
    return !!removal && v1105RemovalIdentityMatches(removal, arguments[1] || {});
}

function v1105IsStableStayTombstoned(stayId, candidate = {}) {
    const id = String(stayId || '').trim().toLowerCase();
    const removal = v1105PendingStableStayRemovals().find(item => String(item.stayId || '').trim().toLowerCase() === id);
    return !!removal && v1105RemovalIdentityMatches(removal, candidate);
}


/*
 * Clear stale device-local suppression BEFORE V11.0.4 builds the shared event
 * collection and refreshes FullCalendar.
 */
const v1105BaseApplyPotentialResponse =
    v1104ApplyPotentialResponse;

v1104ApplyPotentialResponse =
    function(
        response,
        options = {}
    ) {
        const records =
            Array.isArray(
                response?.records
            )
                ? response.records
                : [];

        v1105ClearServerConfirmedTombstones(
            records
        );

        v1105PotentialSyncState.loaded =
            true;

        v1105PotentialSyncState.serverCount =
            records.length;

        v1105PotentialSyncState.lastFetch =
            Date.now();

        v1105PotentialSyncState.lastError =
            '';

        const visibleRecords = records.filter(record => !v1105IsStableStayTombstoned(record?.stayId, record) && !v1105IsPotentialStayTombstoned(record?.stayId));
        return v1105BaseApplyPotentialResponse(
            { ...response, records: visibleRecords },
            options
        );
    };


/*
 * Server response is authoritative after it has loaded.
 *
 * Local pendingPotentialRemovals may still suppress stale CSV fallback rows
 * before the direct endpoint is available, but they are NEVER allowed to hide a
 * valid shared Potential Stay returned by Apps Script.
 */
function v1105ConfirmedStayIdentity(event) {
    const props = event?.extendedProps || {};
    if (props.isMeetGreet === true || props.isPotential === true) return '';

    const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const meaningful = value => {
        const token = normalize(value);
        return token && !['n/a', 'na', 'unknown', 'none', '-', '—'].includes(token)
            ? token
            : '';
    };
    const consistentValue = (...values) => {
        const tokens = [...new Set(values.map(meaningful).filter(Boolean))];
        return tokens.length === 1 ? tokens[0] : '';
    };
    const dogName = normalize(props.dogName || event?.title || '');
    const startDate = String(props.rawStartDate || props.startDate || event?.start || '').slice(0, 10);
    const endDate = String(props.rawEndDate || props.endDate || event?.end || startDate).slice(0, 10);
    const breed = meaningful(props.breed);
    const owner = consistentValue(props.ownerName, props.owner);
    const phone = consistentValue(props.phone, props.contact, props.ownerPhone);

    // A dog/date pair alone is ambiguous. Missing/sentinel owner or contact
    // values therefore never create a dedupe key. Operational stay keys keep
    // their existing schema; this is only a bounded Calendar merge identity.
    if (!dogName || !startDate || !owner || !phone) return '';
    return JSON.stringify([dogName, startDate, endDate, breed, owner, phone]);
}

function v1105StableStayCompatible(left, right, allowDateChange = false) {
    const leftStayId = String(left?.extendedProps?.stayId || '').trim().toLowerCase();
    const rightStayId = String(right?.extendedProps?.stayId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(leftStayId) || leftStayId !== rightStayId) return false;
        const leftProps = left?.extendedProps || {};
        const rightProps = right?.extendedProps || {};
        const leftDates = [leftProps.rawStartDate || left.start, leftProps.rawEndDate || leftProps.rawStartDate || left.start].map(value => String(value || '').slice(0, 10));
        const rightDates = [rightProps.rawStartDate || right.start, rightProps.rawEndDate || rightProps.rawStartDate || right.start].map(value => String(value || '').slice(0, 10));
        if (!allowDateChange && (leftDates[0] !== rightDates[0] || leftDates[1] !== rightDates[1])) return false;
        const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const leftName = norm(leftProps.dogName || left.title);
        const rightName = norm(rightProps.dogName || right.title);
        if (leftName && rightName && leftName !== rightName) return false;
        const leftBreed = norm(leftProps.breed);
        const rightBreed = norm(rightProps.breed);
        if (leftBreed && rightBreed && leftBreed !== rightBreed && leftBreed !== 'n/a' && rightBreed !== 'n/a') return false;
        const leftDogId = String(leftProps.dogId || '').trim().toLowerCase();
        const rightDogId = String(rightProps.dogId || '').trim().toLowerCase();
        if (leftDogId && rightDogId && leftDogId !== rightDogId) return false;
        const leftOwners = [leftProps.ownerName, leftProps.owner].map(norm).filter(Boolean);
        const rightOwners = [rightProps.ownerName, rightProps.owner].map(norm).filter(Boolean);
        const digits = value => String(value || '').replace(/\D/g, '');
        const leftPhones = [leftProps.phone, leftProps.contact, leftProps.ownerPhone].map(digits).filter(Boolean);
        const rightPhones = [rightProps.phone, rightProps.contact, rightProps.ownerPhone].map(digits).filter(Boolean);
        if (new Set([...leftOwners, ...rightOwners]).size > 1 || new Set([...leftPhones, ...rightPhones]).size > 1) return false;
        return true;
}

function v1105SameConfirmedStayIdentity(left, right) {
    const leftStayId = String(left?.extendedProps?.stayId || '').trim();
    const rightStayId = String(right?.extendedProps?.stayId || '').trim();
    if (leftStayId || rightStayId) return v1105StableStayCompatible(left, right, false);
    const leftIdentity = v1105ConfirmedStayIdentity(left);
    if (!leftIdentity || leftIdentity !== v1105ConfirmedStayIdentity(right)) return false;
    const leftDogId = String(left?.extendedProps?.dogId || '').trim().toLowerCase();
    const rightDogId = String(right?.extendedProps?.dogId || '').trim().toLowerCase();
    return !leftDogId || !rightDogId || leftDogId === rightDogId;
}

function v1105LegacyDateSourceMatches(source, optimistic) {
    const sourceProps = source?.extendedProps || {};
    const optimisticProps = optimistic?.extendedProps || {};
    if (String(sourceProps.stayId || '').trim() || !optimisticProps.dateUpdatePending) return false;
    const sourceDates = [sourceProps.rawStartDate || source.start, sourceProps.rawEndDate || sourceProps.rawStartDate || source.start].map(value => String(value || '').slice(0, 10));
    const originalDates = [optimisticProps.pendingOriginalStartDate, optimisticProps.pendingOriginalEndDate].map(value => String(value || '').slice(0, 10));
    const optimisticDates = [optimisticProps.rawStartDate || optimistic.start, optimisticProps.rawEndDate || optimisticProps.rawStartDate || optimistic.start].map(value => String(value || '').slice(0, 10));
    const matchesDates = dates => dates[0] && dates[1] && sourceDates[0] === dates[0] && sourceDates[1] === dates[1];
    // A pending edit's legacy CSV row can show either its old or published
    // range. Strong identity checks below are required to match either range.
    if (!matchesDates(originalDates) && !matchesDates(optimisticDates)) return false;
    const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm(sourceProps.dogName || source.title) !== norm(optimisticProps.dogName || optimistic.title)) return false;
    const sourceDogId = String(sourceProps.dogId || '').trim().toLowerCase();
    const optimisticDogId = String(optimisticProps.dogId || '').trim().toLowerCase();
    if ((sourceDogId || optimisticDogId) && sourceDogId !== optimisticDogId) return false;
    const sourceOwner = norm(sourceProps.ownerName || sourceProps.owner);
    const optimisticOwner = norm(optimisticProps.ownerName || optimisticProps.owner);
    const digits = value => String(value || '').replace(/\D/g, '');
    const sourcePhone = digits(sourceProps.phone);
    const optimisticPhone = digits(optimisticProps.phone);
    if (sourceOwner && optimisticOwner && sourceOwner !== optimisticOwner) return false;
    if (sourcePhone && optimisticPhone && sourcePhone !== optimisticPhone) return false;
    const sourceBreed = norm(sourceProps.breed);
    const optimisticBreed = norm(optimisticProps.breed);
    if (sourceBreed && optimisticBreed && sourceBreed !== optimisticBreed && sourceBreed !== 'n/a' && optimisticBreed !== 'n/a') return false;
    return sourceDogId ? !!optimisticDogId : !!(sourceOwner && optimisticOwner && sourcePhone && optimisticPhone);
}

function v1105DedupeConfirmedStays(events) {
    const groups = new Map();
    events.forEach(event => {
        if (event?.extendedProps?.isPotential === true || event?.extendedProps?.isMeetGreet === true) return;
        const stayId = String(event?.extendedProps?.stayId || '').trim().toLowerCase();
        const identity = v1105ConfirmedStayIdentity(event);
        // Stable IDs survive harmless changes in descriptive formatting.
        // Compatibility below still protects dates, Dog IDs, owners, and phones.
        const key = stayId ? `stay:${stayId}` : identity;
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event);
    });
    const seen = new Map();
    return events.filter(event => {
        if (event?.extendedProps?.isPotential === true || event?.extendedProps?.isMeetGreet === true) return true;
        const stayId = String(event?.extendedProps?.stayId || '').trim().toLowerCase();
        const identity = v1105ConfirmedStayIdentity(event);
        // Stable IDs survive harmless changes in descriptive formatting.
        // Compatibility below still protects dates, Dog IDs, owners, and phones.
        const key = stayId ? `stay:${stayId}` : identity;
        if (!key) return true;
        const group = groups.get(key) || [];
        const dogIds = new Set(group.map(candidate => String(candidate?.extendedProps?.dogId || '').trim().toLowerCase()).filter(Boolean));
        const eventDogId = String(event?.extendedProps?.dogId || '').trim().toLowerCase();
        // An ID-less copy is compatible with one known ID, but cannot be used
        // as a bridge between two different persisted dogs.
        if (dogIds.size > 1 && !eventDogId) return true;
        const matches = seen.get(key) || [];
        const retained = matches.find(candidate => {
            if (dogIds.size > 1 && String(candidate?.extendedProps?.dogId || '').trim().toLowerCase() !== eventDogId) return false;
            return v1105SameConfirmedStayIdentity(candidate, event);
        });
        if (retained) {
            // Keep the first event (the sheet is composed first and is thus
            // authoritative), but retain a usable edit link if it was only
            // present on a later local copy.
            const retainedProps = retained?.extendedProps;
            const duplicateLink = event?.extendedProps?.editLink;
            if (retainedProps && !retainedProps.editLink && duplicateLink) retainedProps.editLink = duplicateLink;
            return false;
        }
        matches.push(event);
        seen.set(key, matches);
        return true;
    });
}

v1104ComposeCalendarEvents =
    function(
        spreadsheetEvents,
        localMeets,
        localPotentials,
        localConfirmed
    ) {
        const sheet =
            Array.isArray(
                spreadsheetEvents
            )
                ? spreadsheetEvents
                : [];

        const meets =
            Array.isArray(
                localMeets
            )
                ? localMeets
                : [];

        const localPotentialList =
            Array.isArray(
                localPotentials
            )
                ? localPotentials
                : [];

        const confirmed =
            Array.isArray(
                localConfirmed
            )
                ? localConfirmed
                : [];

        const pendingRemovals =
            new Set(
                getPendingPotentialRemovals()
            );

        let baseSheet =
            sheet;

        const potentialMap =
            new Map();

        if (
            v1104SharedPotentialLoaded
        ) {
            /*
             * Remove Potential rows from the published CSV completely.
             * Direct Apps Script data is now the only shared source of truth.
             */
            baseSheet =
                sheet.filter(
                    event =>
                        event?.extendedProps
                            ?.isPotential !==
                        true
                );

            v1104SharedPotentialEvents
                .forEach(
                    event => {
                        if (v1105IsPotentialStayTombstoned(event?.extendedProps?.stayId)) return;
                        const key =
                            v1104PotentialKeyFromEvent(
                                event
                            );

                        if (key) {
                            /*
                             * No local tombstone check here.
                             * If Apps Script returned it, it exists.
                             */
                            potentialMap.set(
                                key,
                                event
                            );
                        }
                    }
                );

        } else {
            /*
             * Startup/offline fallback only.
             * The old tombstone behaviour remains appropriate for stale CSV.
             */
            sheet
                .filter(
                    event =>
                        event?.extendedProps
                            ?.isPotential ===
                        true
                )
                .forEach(
                    event => {
                        const key =
                            v1104PotentialKeyFromEvent(
                                event
                            );

                        if (
                            key &&
                            !pendingRemovals.has(
                                key
                            )
                        ) {
                            potentialMap.set(
                                key,
                                event
                            );
                        }
                    }
                );
        }

        /*
         * Device-local optimistic/offline events remain visible.
         * Once a server snapshot is available, v1104ReconcileLocalPotentialCache
         * keeps only server-confirmed or actually queued events.
         */
        localPotentialList
            .forEach(
                event => {
                    if (v1105IsPotentialStayTombstoned(event?.extendedProps?.stayId)) return;
                    const key =
                        v1104PotentialKeyFromEvent(
                            event
                        );

                    if (
                        key &&
                        (
                            v1104SharedPotentialLoaded ||
                            !pendingRemovals.has(
                                key
                            )
                        )
                    ) {
                        potentialMap.set(
                            key,
                            event
                        );
                    }
                }
            );

        const pendingDateEdits = confirmed.filter(event => event?.extendedProps?.dateUpdatePending && String(event?.extendedProps?.stayId || '').trim());
        const sheetWithoutStaleDateRows = baseSheet.filter(event => {
            const stayId = String(event?.extendedProps?.stayId || '').trim();
            const optimistic = stayId
                ? pendingDateEdits.find(candidate => String(candidate?.extendedProps?.stayId || '').trim() === stayId)
                : pendingDateEdits.find(candidate => v1105LegacyDateSourceMatches(event, candidate));
            if (!optimistic) return true;
            if (!stayId) {
                const matchingSourceRows = baseSheet.filter(candidate => v1105LegacyDateSourceMatches(candidate, optimistic));
                return matchingSourceRows.length !== 1;
            }
            if (!v1105StableStayCompatible(event, optimistic, true)) return true;
            const sameStayRows = baseSheet.filter(candidate => String(candidate?.extendedProps?.stayId || '').trim() === stayId);
            const knownDogIds = new Set(sameStayRows.map(candidate => String(candidate?.extendedProps?.dogId || '').trim().toLowerCase()).filter(Boolean));
            const optimisticDogId = String(optimistic?.extendedProps?.dogId || '').trim().toLowerCase();
            if (knownDogIds.size > 1 && (!optimisticDogId || !knownDogIds.has(optimisticDogId))) return true;
            const sourceProps = event?.extendedProps || {};
            const optimisticProps = optimistic?.extendedProps || {};
            const sourceDates = [sourceProps.rawStartDate || event.start, sourceProps.rawEndDate || sourceProps.rawStartDate || event.start].map(value => String(value || '').slice(0, 10));
            const optimisticDates = [optimisticProps.rawStartDate || optimistic.start, optimisticProps.rawEndDate || optimisticProps.rawStartDate || optimistic.start].map(value => String(value || '').slice(0, 10));
            return sourceDates[0] === optimisticDates[0] && sourceDates[1] === optimisticDates[1];
        });
        const allEvents =
            v1105DedupeConfirmedStays(sheetWithoutStaleDateRows.concat(
                meets,
                Array.from(
                    potentialMap.values()
                ),
                confirmed
            ));

        dailyCapacityCounts =
            {};

        allEvents
            .filter(
                event =>
                    event?.extendedProps
                        ?.isMeetGreet !==
                    true
            )
            .forEach(
                addLocalEventCapacity
            );

        return allEvents;
    };


/*
 * New cache key + direct network refresh.
 *
 * The server V11.0.5 endpoint deliberately returns a fresh Sheet scan rather
 * than a version-handshake "unchanged" response. IndexedDB is still used as
 * an offline/instant-render fallback, but cannot override a successful direct
 * response.
 */
v1104LoadSharedPotentialStays =
    async function(
        options = {}
    ) {
        const force =
            options.force ===
            true;

        if (
            v1104SharedPotentialLoadPromise &&
            !force
        ) {
            return v1104SharedPotentialLoadPromise;
        }

        if (
            !force &&
            v1104SharedPotentialLoaded &&
            (
                Date.now() -
                v1104SharedPotentialLastFetch
            ) <
            5000
        ) {
            return {
                records:
                    v1104SharedPotentialEvents
            };
        }

        const request =
            (async () => {
                try {
                    const swr =
                        await queryAppsScriptSWR(
                            {
                                action:
                                    'get_potential_stays'
                            },
                            {
                                cacheKey:
                                    V1105_POTENTIAL_CACHE_KEY,
                                maxStaleMs:
                                    6 *
                                    60 *
                                    60 *
                                    1000,
                                maxAttempts:
                                    2,
                                timeoutMs:
                                    30000,
                                onCached:
                                    cached => {
                                        v1104ApplyPotentialResponse(
                                            cached,
                                            {
                                                refresh:
                                                    false
                                            }
                                        );
                                    }
                            }
                        );

                    if (
                        swr?.data
                    ) {
                        v1104ApplyPotentialResponse(
                            swr.data,
                            {
                                refresh:
                                    false
                            }
                        );
                    }

                    await v1104ReconcileLocalPotentialCache();

                    if (
                        WAFFLE_PAGE ===
                        'calendar'
                    ) {
                        refreshCalendarData();
                    }

                    return (
                        swr?.data ||
                        null
                    );

                } catch (error) {
                    v1105PotentialSyncState.lastError =
                        error?.message ||
                        String(
                            error
                        );

                    console.warn(
                        'Authoritative Potential Stay sync failed:',
                        error
                    );

                    return null;
                }
            })();

        v1104SharedPotentialLoadPromise =
            request;

        try {
            return await request;
        } finally {
            if (
                v1104SharedPotentialLoadPromise ===
                request
            ) {
                v1104SharedPotentialLoadPromise =
                    null;
            }
        }
    };


/*
 * Show a tiny sync indicator inside the Potential Stay pipeline. It makes the
 * shared backend state visible without opening developer tools.
 */
const v1105BaseRenderPotentialPipeline =
    renderV10PotentialPipeline;

renderV10PotentialPipeline =
    function(
        events
    ) {
        v1105BaseRenderPotentialPipeline(
            events
        );

        const host =
            document.getElementById(
                'v10PotentialCards'
            );

        if (!host) {
            return;
        }

        const existing =
            host.querySelector(
                '.v1105-potential-sync'
            );

        if (existing) {
            existing.remove();
        }

        const status =
            document.createElement(
                'div'
            );

        status.className =
            'v1105-potential-sync';

        if (
            v1105PotentialSyncState.lastError
        ) {
            status.classList.add(
                'is-error'
            );

            status.textContent =
                '⚠ Shared Potential sync unavailable';

            status.title =
                v1105PotentialSyncState.lastError;

        } else if (
            v1105PotentialSyncState.loaded
        ) {
            status.textContent =
                `☁ Shared · ${v1105PotentialSyncState.serverCount}`;

            status.title =
                'Potential Stays read directly from the shared Google Sheet via Apps Script.';

        } else {
            status.textContent =
                '☁ Shared · syncing…';
        }

        host.insertBefore(
            status,
            host.firstChild
        );
    };


/*
 * Lightweight diagnostic available in the browser console if ever needed.
 * It intentionally contains no secrets.
 */
window.wafflePotentialSyncStatus =
    function() {
        return {
            version:
                V1105_VERSION,
            loaded:
                v1105PotentialSyncState.loaded,
            serverCount:
                v1105PotentialSyncState.serverCount,
            visibleSharedEvents:
                v1104SharedPotentialEvents.length,
            pendingPotentialRemovals:
                getPendingPotentialRemovals(),
            temporaryPotentialStays:
                getLocalArray(
                    'temporaryPotentialStays'
                ).length,
            lastFetch:
                v1105PotentialSyncState.lastFetch,
            lastError:
                v1105PotentialSyncState.lastError
        };
    };
