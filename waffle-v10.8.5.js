/* ============================================================
   WAFFLE HOUSE V10.8.5 — MEET & GREET OUTLOOK LIVE REFRESH FIX
   ============================================================ */

const V1085_VERSION =
    '10.8.5';

const v1085BaseRenderOperationsHome =
    renderV10OperationsHome;


/*
 * Parse ONLY Meet & Greet rows from the current boarding CSV.
 *
 * This intentionally does not call parseCSVToEvents(), because that function
 * also rebuilds other dashboard/directory state as a side effect.
 */
function v1085MeetEventsFromCachedCsv() {
    const csvText =
        String(
            localStorage.getItem(
                'boardingDataCache'
            ) ||
            ''
        );

    if (
        !csvText ||
        !csvText.includes(',')
    ) {
        return [];
    }

    const lines =
        csvText.split(
            /\r?\n/
        );

    const events = [];

    for (
        let index = 1;
        index < lines.length;
        index++
    ) {
        const line =
            String(
                lines[index] ||
                ''
            );

        if (!line.trim()) {
            continue;
        }

        const columns =
            line.split(
                /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
            );

        const clean =
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
                    .trim();

        const bookingType =
            clean(
                columns[11]
            );

        if (
            bookingType.toLowerCase() !==
            'meet & greet'
        ) {
            continue;
        }

        const dogName =
            clean(
                columns[1]
            );

        const breed =
            clean(
                columns[2]
            );

        const startDate =
            parseCsvDate(
                clean(
                    columns[3]
                )
            );

        const ownerName =
            clean(
                columns[5]
            );

        const phone =
            clean(
                columns[6]
            );

        const notes =
            clean(
                columns[9]
            );

        if (
            !dogName ||
            !startDate
        ) {
            continue;
        }

        const timeMatch =
            notes.match(
                /(\d{1,2}:\d{2})/
            );

        const time =
            timeMatch
                ? timeMatch[1]
                : '10:00';

        events.push({
            id:
                `v1085_sheet_meet_${index}_${startDate}_${dogName}`,
            title:
                `⏰ ${time} - Meet & Greet: ${dogName}`,
            start:
                startDate,
            end:
                startDate,
            allDay:
                true,
            backgroundColor:
                '#0f766e',
            textColor:
                '#ffffff',
            extendedProps: {
                isMeetGreet:
                    true,
                isPotential:
                    false,
                dogName,
                breed:
                    breed ||
                    'Unknown',
                time,
                owner:
                    ownerName ||
                    'Database Synced',
                ownerName:
                    ownerName ||
                    '',
                phone:
                    phone ||
                    'N/A',
                notes,
                bookingType:
                    'Meet & Greet',
                rawStartDate:
                    startDate,
                rawEndDate:
                    startDate,
                editLink:
                    ''
            }
        });
    }

    return events;
}


function v1085MeetKey(
    event
) {
    const props =
        event?.extendedProps ||
        {};

    return [
        getCalendarEventDateString(
            event
        ),
        String(
            props.dogName ||
            event?.title ||
            ''
        )
            .trim()
            .toLowerCase(),
        getMeetGreetTime(
            event
        )
    ].join('|');
}


function v1085MergeMeetEvents(
    events
) {
    const passed =
        Array.isArray(
            events
        )
            ? events
            : [];

    const nonMeet =
        passed.filter(
            event =>
                event?.extendedProps
                    ?.isMeetGreet !==
                true
        );

    /*
     * boardingDataCache is the shared-sheet snapshot currently driving the
     * Calendar. It is authoritative after syncSpreadsheetData() succeeds.
     *
     * temporaryMeetGreets covers a just-created local visit before the
     * published CSV has caught up.
     */
    const cachedMeets =
        v1085MeetEventsFromCachedCsv();

    const localMeets =
        typeof getLocalArray ===
            'function'
            ? getLocalArray(
                'temporaryMeetGreets'
              )
            : [];

    const passedMeets =
        passed.filter(
            event =>
                event?.extendedProps
                    ?.isMeetGreet ===
                true
        );

    /*
     * Prefer the current CSV + local unsynchronised Meet & Greets.
     * If there is no usable CSV yet, use the events supplied by FullCalendar.
     */
    const candidates =
        cachedMeets.length ||
        String(
            localStorage.getItem(
                'boardingDataCache'
            ) ||
            ''
        ).includes(',')
            ? [
                ...cachedMeets,
                ...localMeets
              ]
            : passedMeets;

    const byKey =
        new Map();

    candidates.forEach(
        event => {
            if (
                event?.extendedProps
                    ?.isMeetGreet !==
                true
            ) {
                return;
            }

            const key =
                v1085MeetKey(
                    event
                );

            if (
                !key ||
                key.startsWith(
                    '||'
                )
            ) {
                return;
            }

            /*
             * Local entries come later in candidates, so they can temporarily
             * enrich/replace an older cached row until spreadsheet sync catches up.
             */
            byKey.set(
                key,
                event
            );
        }
    );

    /*
     * Safety fallback for a transient source-refresh race:
     * if the CSV parser returned no rows but FullCalendar already has valid
     * Meet & Greets, do not blank the dashboard.
     */
    if (
        byKey.size ===
            0 &&
        passedMeets.length
    ) {
        passedMeets.forEach(
            event =>
                byKey.set(
                    v1085MeetKey(
                        event
                    ),
                    event
                )
        );
    }

    return [
        ...nonMeet,
        ...Array.from(
            byKey.values()
        )
    ];
}


/*
 * V10.8.3 already wraps renderV10OperationsHome for the hover/click detail
 * popovers. This final wrapper feeds that whole render chain a stable,
 * authoritative Meet & Greet collection so both:
 *
 *   1. the 7-day tiles, and
 *   2. the day-detail popovers
 *
 * stay in sync during the automatic spreadsheet refresh.
 */
renderV10OperationsHome =
    function(
        events
    ) {
        const stableEvents =
            v1085MergeMeetEvents(
                events
            );

        v1085BaseRenderOperationsHome(
            stableEvents
        );
    };


/*
 * A successful sync updates boardingDataCache immediately before
 * refreshCalendarData(). The render wrapper above handles that refresh.
 *
 * This extra reconciliation handles FullCalendar's later source lifecycle too,
 * without allowing a temporary empty event collection to blank the outlook.
 */
function v1085RefreshMeetOutlookFromAuthoritativeCache() {
    if (
        WAFFLE_PAGE !==
        'calendar'
    ) {
        return;
    }

    const currentEvents =
        globalCalendar
            ?.getEvents()
            ?.slice() ||
        [];

    renderV10OperationsHome(
        currentEvents
    );
}


document.addEventListener(
    'DOMContentLoaded',
    () => {
        if (
            WAFFLE_PAGE !==
            'calendar'
        ) {
            return;
        }

        /*
         * The app performs several startup spreadsheet refreshes.
         * Reconcile after each common startup window.
         */
        [
            500,
            1800,
            4300,
            10300
        ].forEach(
            delay => {
                setTimeout(
                    v1085RefreshMeetOutlookFromAuthoritativeCache,
                    delay
                );
            }
        );
    }
);


window.addEventListener(
    'storage',
    event => {
        if (
            WAFFLE_PAGE ===
                'calendar' &&
            event.key ===
                'boardingDataCache'
        ) {
            v1085RefreshMeetOutlookFromAuthoritativeCache();
        }
    }
);
