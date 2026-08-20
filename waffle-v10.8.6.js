/* ============================================================
   WAFFLE HOUSE V10.8.6 — CARE CURRENT / PAST STAYS FIX
   ============================================================ */

const V1086_VERSION =
    '10.8.6';

const V1086_PAST_CACHE_KEY =
    'directory:past-stays:v1086';

const v1086BaseApplyGuestDirectoryResponse =
    applyGuestDirectoryResponse;

let v1086BackgroundPastRequested =
    false;


function v1086IsoDate(
    value
) {
    const text =
        String(
            value ||
            ''
        )
            .replace(
                /^"|"$/g,
                ''
            )
            .trim();

    if (!text) {
        return '';
    }

    const iso =
        text.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

    if (iso) {
        return (
            iso[1] +
            '-' +
            iso[2] +
            '-' +
            iso[3]
        );
    }

    const au =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );

    if (au) {
        return (
            au[3] +
            '-' +
            String(
                au[2]
            ).padStart(
                2,
                '0'
            ) +
            '-' +
            String(
                au[1]
            ).padStart(
                2,
                '0'
            )
        );
    }

    return '';
}


function v1086CsvColumns(
    line
) {
    return String(
        line ||
        ''
    )
        .split(
            /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
        )
        .map(
            value =>
                String(
                    value ||
                    ''
                )
                    .replace(
                        /^"|"$/g,
                        ''
                    )
                    .replace(
                        /""/g,
                        '"'
                    )
                    .trim()
        );
}


function v1086PastBookingsFromCsv(
    csvText
) {
    const today =
        getLocalTodayDateString();

    const lines =
        String(
            csvText ||
            ''
        ).split(
            /\r?\n/
        );

    const bookings =
        [];

    for (
        let index = 1;
        index < lines.length;
        index++
    ) {
        if (
            !String(
                lines[index] ||
                ''
            ).trim()
        ) {
            continue;
        }

        const columns =
            v1086CsvColumns(
                lines[index]
            );

        const dogName =
            String(
                columns[1] ||
                ''
            ).trim();

        const startDate =
            v1086IsoDate(
                columns[3]
            );

        const endDate =
            v1086IsoDate(
                columns[4] ||
                columns[3]
            );

        const bookingType =
            String(
                columns[11] ||
                'Boarding'
            )
                .trim();

        const typeLower =
            bookingType
                .toLowerCase();

        if (
            !dogName ||
            !startDate ||
            !endDate ||
            endDate >= today ||
            typeLower ===
                'meet & greet' ||
            typeLower ===
                'potential stay'
        ) {
            continue;
        }

        bookings.push({
            row:
                index + 1,
            timestamp:
                String(
                    columns[0] ||
                    ''
                ),
            stayKey:
                (
                    typeof v110MakeStayKey ===
                        'function'
                        ? v110MakeStayKey(
                            dogName,
                            startDate,
                            endDate
                          )
                        : [
                            String(
                                dogName ||
                                ''
                            )
                                .trim()
                                .toLowerCase(),
                            startDate,
                            endDate
                          ].join('|')
                ),
            dogName,
            breed:
                String(
                    columns[2] ||
                    ''
                ).trim(),
            startDate,
            endDate,
            ownerName:
                String(
                    columns[5] ||
                    ''
                ).trim(),
            phone:
                String(
                    columns[6] ||
                    ''
                ).trim(),
            notes:
                String(
                    columns[9] ||
                    ''
                ).trim(),
            editLink:
                String(
                    columns[10] ||
                    ''
                ).trim(),
            bookingType:
                bookingType ||
                'Boarding'
        });
    }

    bookings.sort(
        (a, b) => {
            const endCompare =
                String(
                    b.endDate ||
                    ''
                ).localeCompare(
                    String(
                        a.endDate ||
                        ''
                    )
                );

            if (endCompare) {
                return endCompare;
            }

            return String(
                b.startDate ||
                ''
            ).localeCompare(
                String(
                    a.startDate ||
                    ''
                )
            );
        }
    );

    return bookings.slice(
        0,
        V1082_PAST_LIMIT
    );
}


async function v1086BuildPastFallback() {
    let csvText =
        String(
            localStorage.getItem(
                'boardingDataCache'
            ) ||
            ''
        );

    try {
        csvText =
            await fetchSpreadsheetCsv();

        if (
            csvText &&
            csvText.includes(',')
        ) {
            localStorage.setItem(
                'boardingDataCache',
                csvText
            );
        }
    } catch (error) {
        console.warn(
            'Past Stay fallback is using the last cached spreadsheet snapshot:',
            error
        );
    }

    const bookings =
        v1086PastBookingsFromCsv(
            csvText
        );

    return {
        result:
            'success',
        action:
            'get_past_guest_directory',
        fallback:
            true,
        totalPastStays:
            bookings.length,
        returned:
            bookings.length,
        bookings,
        summaries:
            [],
        digitalIntakes:
            [],
        legacyIntakes:
            []
    };
}


function v1086UpdateCareStayCounts() {
    const current =
        document.getElementById(
            'v1082CurrentStayCount'
        );

    const past =
        document.getElementById(
            'v1082PastStayCount'
        );

    if (current) {
        const currentCards =
            document.querySelectorAll(
                '#directory-grid .directory-guest-tile-open'
            );

        current.textContent =
            String(
                currentCards.length
            );
    }

    if (
        past &&
        v1082PastResponse
    ) {
        past.textContent =
            String(
                Number(
                    v1082PastResponse
                        .totalPastStays ||
                    v1082PastResponse
                        .bookings
                        ?.length ||
                    0
                )
            );
    }
}


/*
 * The original Current count could run before the consolidated directory
 * finished rebuilding the cards. Update it at the exact point the directory
 * response has been applied.
 */
applyGuestDirectoryResponse =
    function(
        response,
        options = {}
    ) {
        const result =
            v1086BaseApplyGuestDirectoryResponse(
                response,
                options
            );

        queueMicrotask(
            v1086UpdateCareStayCounts
        );

        setTimeout(
            v1086UpdateCareStayCounts,
            80
        );

        return result;
    };


/*
 * V10.8.2 used the generic directory:past-stays IndexedDB key. A cached empty
 * response could therefore remain visible for hours. V10.8.6 deliberately
 * moves Past Stays to a fresh cache key and falls back to the published
 * boarding history if the endpoint returns an unexpected empty result.
 */
v1082LoadPastStays =
    async function(
        options = {}
    ) {
        if (
            v1082PastLoadPromise &&
            !options.force
        ) {
            return v1082PastLoadPromise;
        }

        const grid =
            document.getElementById(
                'past-directory-grid'
            );

        if (
            grid &&
            (
                !v1082PastLoaded ||
                options.force
            )
        ) {
            grid.innerHTML =
                v101SkeletonHtml(
                    'directory',
                    6
                );
        }

        v1082PastLoadPromise =
            (async () => {
                let cachedRendered =
                    false;

                let response =
                    null;

                try {
                    const swr =
                        await queryAppsScriptSWR(
                            {
                                action:
                                    'get_past_guest_directory',
                                limit:
                                    V1082_PAST_LIMIT
                            },
                            {
                                cacheKey:
                                    V1086_PAST_CACHE_KEY,
                                maxStaleMs:
                                    2 *
                                    60 *
                                    60 *
                                    1000,
                                maxAttempts:
                                    2,
                                timeoutMs:
                                    45000,
                                onCached:
                                    cached => {
                                        cachedRendered =
                                            true;

                                        response =
                                            cached;

                                        v1082PastResponse =
                                            cached;

                                        v1082ApplyPastResponse(
                                            cached
                                        );

                                        v1086UpdateCareStayCounts();
                                    }
                            }
                        );

                    response =
                        swr.data ||
                        response;

                    if (
                        !swr.unchanged ||
                        !cachedRendered
                    ) {
                        if (response) {
                            v1082PastResponse =
                                response;

                            v1082ApplyPastResponse(
                                response
                            );

                            v1086UpdateCareStayCounts();
                        }
                    }

                } catch (error) {
                    console.warn(
                        'Past Stays endpoint failed; trying boarding-history fallback:',
                        error
                    );
                }

                /*
                 * If the endpoint says zero but the shared published booking
                 * history contains completed boarding rows, use that history
                 * rather than presenting an incorrect empty Past Stays tab.
                 */
                if (
                    !response ||
                    !Array.isArray(
                        response.bookings
                    ) ||
                    response.bookings.length ===
                        0
                ) {
                    const fallback =
                        await v1086BuildPastFallback();

                    if (
                        fallback.bookings.length ||
                        !response
                    ) {
                        response =
                            fallback;

                        v1082PastResponse =
                            fallback;

                        v1082ApplyPastResponse(
                            fallback
                        );

                        v1086UpdateCareStayCounts();
                    }
                }

                v1082PastLoaded =
                    true;

                return (
                    response ||
                    v1082PastResponse
                );

            })();

        try {
            return await v1082PastLoadPromise;
        } finally {
            v1082PastLoadPromise =
                null;
        }
    };


function v1086BackgroundLoadPastStays() {
    if (
        WAFFLE_PAGE !==
            'directory' ||
        v1086BackgroundPastRequested
    ) {
        return;
    }

    v1086BackgroundPastRequested =
        true;

    v1082LoadPastStays()
        .then(
            v1086UpdateCareStayCounts
        )
        .catch(
            error =>
                console.warn(
                    'Background Past Stays count could not be loaded:',
                    error
                )
        );
}


function v1086ObserveCareDirectory() {
    if (
        WAFFLE_PAGE !==
        'directory'
    ) {
        return;
    }

    const currentGrid =
        document.getElementById(
            'directory-grid'
        );

    if (currentGrid) {
        new MutationObserver(
            () => {
                v1086UpdateCareStayCounts();
            }
        ).observe(
            currentGrid,
            {
                childList:
                    true,
                subtree:
                    true
            }
        );
    }

    const pastGrid =
        document.getElementById(
            'past-directory-grid'
        );

    if (pastGrid) {
        new MutationObserver(
            () => {
                v1086UpdateCareStayCounts();
            }
        ).observe(
            pastGrid,
            {
                childList:
                    true,
                subtree:
                    true
            }
        );
    }
}


function v1086PolishCareTabs() {
    const tabs =
        document.querySelector(
            '.v1082-stay-tabs'
        );

    if (!tabs) return;

    tabs.setAttribute(
        'aria-label',
        'Choose current or historical care stays'
    );

    const current =
        tabs.querySelector(
            '[data-v1082-stay-tab="current"]'
        );

    const past =
        tabs.querySelector(
            '[data-v1082-stay-tab="past"]'
        );

    if (current) {
        current.innerHTML = `
            <span class="v1086-stay-tab-icon" aria-hidden="true">🏡</span>
            <span class="v1086-stay-tab-copy">
                <strong>Current</strong>
                <small>At home &amp; upcoming</small>
            </span>
            <span class="v1086-stay-tab-count" id="v1082CurrentStayCount">…</span>
        `;
    }

    if (past) {
        past.innerHTML = `
            <span class="v1086-stay-tab-icon" aria-hidden="true">🕘</span>
            <span class="v1086-stay-tab-copy">
                <strong>Past Stays</strong>
                <small>Historical care profiles</small>
            </span>
            <span class="v1086-stay-tab-count" id="v1082PastStayCount">…</span>
        `;
    }
}


document.addEventListener(
    'DOMContentLoaded',
    () => {
        if (
            WAFFLE_PAGE !==
            'directory'
        ) {
            return;
        }

        v1086PolishCareTabs();
        v1086ObserveCareDirectory();

        setTimeout(
            v1086UpdateCareStayCounts,
            350
        );

        /*
         * Populate the historical count in the background so "Past Stays 0"
         * is never shown merely because the user has not clicked the tab yet.
         */
        setTimeout(
            v1086BackgroundLoadPastStays,
            1600
        );

        setTimeout(
            v1086UpdateCareStayCounts,
            2800
        );
    }
);
