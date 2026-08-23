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

        return v1105BaseApplyPotentialResponse(
            response,
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

        const allEvents =
            baseSheet.concat(
                meets,
                Array.from(
                    potentialMap.values()
                ),
                confirmed
            );

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
