/* ============================================================
   WAFFLE HOUSE V11.0.4 — SHARED POTENTIAL STAYS HOTFIX
   Potential Stays now read directly from Apps Script / Google Sheets.
   ============================================================ */

const V1104_VERSION =
    '11.0.4';

const V1104_POTENTIAL_CACHE_KEY =
    'calendar:shared-potential-stays:v1104';

const V1104_POTENTIAL_REFRESH_MS =
    20000;

let v1104SharedPotentialEvents =
    [];

let v1104SharedPotentialLoaded =
    false;

let v1104SharedPotentialLoadPromise =
    null;

let v1104SharedPotentialLastFetch =
    0;

let v1104SharedPotentialTimer =
    null;


function v1104PotentialKeyFromEvent(
    event
) {
    const props =
        event?.extendedProps ||
        {};

    return makePotentialKey(
        props.dogName ||
            event?.title ||
            '',
        props.rawStartDate ||
            event?.start ||
            '',
        props.rawEndDate ||
            props.rawStartDate ||
            event?.start ||
            ''
    );
}


function v1104PotentialEventFromRecord(
    record
) {
    return buildPotentialEvent(
        String(
            record?.id ||
            (
                'shared_pot_' +
                String(
                    record?.row ||
                    Date.now()
                )
            )
        ),
        String(
            record?.dogName ||
            ''
        ).trim(),
        String(
            record?.breed ||
            ''
        ).trim(),
        String(
            record?.startDate ||
            ''
        ).trim(),
        String(
            record?.endDate ||
            record?.startDate ||
            ''
        ).trim(),
        String(
            record?.ownerName ||
            ''
        ).trim(),
        String(
            record?.phone ||
            ''
        ).trim(),
        String(
            record?.notes ||
            ''
        ).trim()
    );
}


function v1104ServerPotentialKeys() {
    return new Set(
        v1104SharedPotentialEvents
            .map(
                v1104PotentialKeyFromEvent
            )
            .filter(Boolean)
    );
}


async function v1104QueuedPotentialSaveKeys() {
    if (
        typeof v108QueueAll !==
        'function'
    ) {
        return new Set();
    }

    try {
        const queued =
            await v108QueueAll();

        return new Set(
            queued
                .filter(entry => {
                    const action =
                        String(
                            entry?.payload?.action ||
                            ''
                        );

                    return (
                        action ===
                            'create_potential' ||
                        action ===
                            'update_potential'
                    );
                })
                .map(entry => {
                    const payload =
                        entry.payload ||
                        {};

                    return makePotentialKey(
                        payload.dogName,
                        payload.startDate,
                        payload.endDate ||
                            payload.startDate
                    );
                })
                .filter(Boolean)
        );

    } catch (error) {
        console.warn(
            'Could not inspect the offline Potential Stay queue:',
            error
        );

        return new Set();
    }
}


async function v1104ReconcileLocalPotentialCache() {
    const serverKeys =
        v1104ServerPotentialKeys();

    const queuedKeys =
        await v1104QueuedPotentialSaveKeys();

    const local =
        getLocalArray(
            'temporaryPotentialStays'
        );

    const clean =
        local.filter(event => {
            const key =
                v1104PotentialKeyFromEvent(
                    event
                );

            return (
                serverKeys.has(
                    key
                ) ||
                queuedKeys.has(
                    key
                )
            );
        });

    if (
        clean.length !==
        local.length
    ) {
        setLocalArray(
            'temporaryPotentialStays',
            clean
        );
    }
}


/*
 * When the direct Apps Script snapshot has loaded, it becomes authoritative
 * for Potential Stays. CSV Potential rows are deliberately removed from the
 * Calendar composition so a delayed published CSV can neither hide a new
 * Potential Stay nor resurrect a deleted/confirmed one.
 *
 * Device-local queued creates/updates are merged back in so offline work is
 * still visible on the device that created it until the queue syncs.
 */
function v1104ComposeCalendarEvents(
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
         * Direct backend data is the cross-device source of truth.
         */
        baseSheet =
            sheet.filter(event =>
                event?.extendedProps
                    ?.isPotential !==
                true
            );

        v1104SharedPotentialEvents
            .forEach(event => {
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
            });

    } else {
        /*
         * Startup/offline fallback before the direct endpoint is available.
         */
        sheet
            .filter(event =>
                event?.extendedProps
                    ?.isPotential ===
                true
            )
            .forEach(event => {
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
            });
    }

    /*
     * Local optimistic/offline changes take visual precedence on the device
     * that created them.
     */
    localPotentialList
        .forEach(event => {
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
        });

    let allEvents =
        baseSheet.concat(
            meets,
            Array.from(
                potentialMap.values()
            ),
            confirmed
        );

    /*
     * parseCSVToEvents() calculates capacity while parsing. Recalculate from
     * the final authoritative event collection so stale CSV Potential rows do
     * not inflate capacity after they were confirmed/deleted on another device.
     */
    dailyCapacityCounts =
        {};

    allEvents
        .filter(event =>
            event?.extendedProps
                ?.isMeetGreet !==
            true
        )
        .forEach(
            addLocalEventCapacity
        );

    return allEvents;
}


function v1104ApplyPotentialResponse(
    response,
    options = {}
) {
    const records =
        Array.isArray(
            response?.records
        )
            ? response.records
            : [];

    v1104SharedPotentialEvents =
        records
            .map(
                v1104PotentialEventFromRecord
            )
            .filter(event =>
                event?.extendedProps
                    ?.dogName &&
                event?.extendedProps
                    ?.rawStartDate
            );

    v1104SharedPotentialLoaded =
        true;

    v1104SharedPotentialLastFetch =
        Date.now();

    if (
        options.refresh !==
        false &&
        WAFFLE_PAGE ===
        'calendar'
    ) {
        refreshCalendarData();
    }
}


async function v1104LoadSharedPotentialStays(
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
        ) < 5000
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
                                V1104_POTENTIAL_CACHE_KEY,
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
                                        cached
                                    );
                                }
                        }
                    );

                if (
                    swr?.data
                ) {
                    v1104ApplyPotentialResponse(
                        swr.data
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
                console.warn(
                    'Shared Potential Stays could not be refreshed:',
                    error
                );

                /*
                 * Do not blank the calendar on a network failure. Existing CSV,
                 * IndexedDB and device-local optimistic data remain available.
                 */
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
}


/* ============================================================
   Mutation / manual-sync integration
   ============================================================ */

const v1104BaseSendPayloadToAppsScript =
    sendPayloadToAppsScript;

sendPayloadToAppsScript =
    async function(
        payload
    ) {
        const response =
            await v1104BaseSendPayloadToAppsScript(
                payload
            );

        const action =
            String(
                payload?.action ||
                ''
            );

        if (
            [
                'create_potential',
                'update_potential',
                'confirm_potential',
                'delete_potential'
            ].includes(
                action
            ) &&
            !response?.queued
        ) {
            try {
                await removeWaffleCachedResponse(
                    V1104_POTENTIAL_CACHE_KEY
                );
            } catch (_) {}

            setTimeout(
                () => {
                    v1104LoadSharedPotentialStays({
                        force:
                            true
                    });
                },
                80
            );
        }

        return response;
    };


const v1104BaseSyncSpreadsheetData =
    syncSpreadsheetData;

syncSpreadsheetData =
    async function(
        options = {}
    ) {
        const result =
            await v1104BaseSyncSpreadsheetData(
                options
            );

        await v1104LoadSharedPotentialStays({
            force:
                true
        });

        return result;
    };


function v1104StartPotentialPolling() {
    if (
        WAFFLE_PAGE !==
        'calendar'
    ) {
        return;
    }

    if (
        v1104SharedPotentialTimer
    ) {
        clearInterval(
            v1104SharedPotentialTimer
        );
    }

    v1104SharedPotentialTimer =
        setInterval(
            () => {
                if (
                    document.visibilityState ===
                    'visible'
                ) {
                    v1104LoadSharedPotentialStays({
                        force:
                            true
                    });
                }
            },
            V1104_POTENTIAL_REFRESH_MS
        );
}


document.addEventListener(
    'visibilitychange',
    () => {
        if (
            WAFFLE_PAGE ===
                'calendar' &&
            document.visibilityState ===
                'visible'
        ) {
            v1104LoadSharedPotentialStays({
                force:
                    true
            });
        }
    }
);


window.addEventListener(
    'focus',
    () => {
        if (
            WAFFLE_PAGE ===
            'calendar'
        ) {
            v1104LoadSharedPotentialStays({
                force:
                    true
            });
        }
    }
);


document.addEventListener(
    'DOMContentLoaded',
    () => {
        if (
            WAFFLE_PAGE !==
            'calendar'
        ) {
            return;
        }

        setTimeout(
            () => {
                v1104LoadSharedPotentialStays({
                    force:
                        true
                });
            },
            180
        );

        v1104StartPotentialPolling();
    }
);
