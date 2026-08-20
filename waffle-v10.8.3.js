/* ============================================================
   WAFFLE HOUSE V10.8.3 — OUTLOOK DAY DETAILS
   Hover / focus / click Capacity and Meet & Greet outlook days
   to inspect the day's actual bookings and visits.
   ============================================================ */

const V1083_OUTLOOK_VERSION = '10.8.3';

const v1083BaseRenderOperationsHome =
    renderV10OperationsHome;

const v1083OutlookDetails =
    new Map();

let v1083LatestOutlookEvents =
    [];

let v1083PinnedOutlookCell =
    null;

let v1083HoverHideTimer =
    null;


function v1083DateStringFromDate(date) {
    return (
        date.getFullYear() +
        '-' +
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            '0'
        ) +
        '-' +
        String(
            date.getDate()
        ).padStart(
            2,
            '0'
        )
    );
}


function v1083DateLabel(dateString) {
    const date =
        new Date(
            String(
                dateString ||
                ''
            ) +
            'T12:00:00'
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(
            dateString ||
            ''
        );
    }

    return date.toLocaleDateString(
        'en-AU',
        {
            weekday:
                'long',
            day:
                'numeric',
            month:
                'long'
        }
    );
}


function v1083ShortDateRange(
    startDate,
    endDate
) {
    if (
        !startDate &&
        !endDate
    ) {
        return '';
    }

    const start =
        startDate
            ? v10FormatDateLabel(
                startDate
              )
            : '';

    const end =
        endDate
            ? v10FormatDateLabel(
                endDate
              )
            : start;

    return (
        start === end
            ? start
            : `${start} → ${end}`
    );
}


function v1083NormaliseEventRange(event) {
    const props =
        event?.extendedProps ||
        {};

    const start =
        String(
            props.rawStartDate ||
            getCalendarEventDateString(
                event
            ) ||
            ''
        ).slice(
            0,
            10
        );

    let end =
        String(
            props.rawEndDate ||
            ''
        ).slice(
            0,
            10
        );

    if (
        !end &&
        event?.end
    ) {
        const exclusiveEnd =
            new Date(
                event.end
            );

        if (
            !Number.isNaN(
                exclusiveEnd.getTime()
            )
        ) {
            exclusiveEnd.setDate(
                exclusiveEnd.getDate() -
                1
            );

            end =
                v1083DateStringFromDate(
                    exclusiveEnd
                );
        }
    }

    if (!end) {
        end =
            start;
    }

    return {
        start,
        end
    };
}


function v1083EventOnDate(
    event,
    dateString
) {
    const range =
        v1083NormaliseEventRange(
            event
        );

    if (
        !range.start ||
        !dateString
    ) {
        return false;
    }

    return (
        dateString >=
            range.start &&
        dateString <=
            (
                range.end ||
                range.start
            )
    );
}


function v1083DogCount(
    dogName
) {
    const text =
        String(
            dogName ||
            ''
        ).trim();

    if (!text) {
        return 1;
    }

    if (
        text.includes(
            '&'
        ) ||
        /\s+and\s+/i.test(
            text
        )
    ) {
        return (
            text
                .split(
                    /&|\s+and\s+/i
                )
                .map(
                    part =>
                        part.trim()
                )
                .filter(Boolean)
                .length ||
            1
        );
    }

    return 1;
}


function v1083BookingType(
    event
) {
    const props =
        event?.extendedProps ||
        {};

    if (
        props.isPotential ===
        true
    ) {
        return 'Potential Stay';
    }

    if (
        props.isMeetGreet ===
        true
    ) {
        return 'Meet & Greet';
    }

    return (
        String(
            props.bookingType ||
            'Confirmed Stay'
        )
            .trim() ||
        'Confirmed Stay'
    );
}


function v1083EventDogName(
    event
) {
    const props =
        event?.extendedProps ||
        {};

    let dogName =
        String(
            props.dogName ||
            event?.title ||
            'Guest'
        ).trim();

    dogName =
        dogName
            .replace(
                /^❓\s*Potential:\s*/i,
                ''
            )
            .replace(
                /^\d{1,2}:\d{2}\s*-\s*Meet\s*&\s*Greet:\s*/i,
                ''
            )
            .replace(
                /^Meet\s*&\s*Greet:\s*/i,
                ''
            )
            .trim();

    return (
        dogName ||
        'Guest'
    );
}


function v1083CapacityEntriesForDate(
    events,
    dateString
) {
    return (
        Array.isArray(
            events
        )
            ? events
            : []
    )
        .filter(event => {
            const props =
                event?.extendedProps ||
                {};

            if (
                props.isMeetGreet ===
                true
            ) {
                return false;
            }

            return v1083EventOnDate(
                event,
                dateString
            );
        })
        .sort(
            (a, b) => {
                const aPotential =
                    a?.extendedProps
                        ?.isPotential ===
                    true;

                const bPotential =
                    b?.extendedProps
                        ?.isPotential ===
                    true;

                if (
                    aPotential !==
                    bPotential
                ) {
                    return aPotential
                        ? 1
                        : -1;
                }

                return v1083EventDogName(
                    a
                ).localeCompare(
                    v1083EventDogName(
                        b
                    )
                );
            }
        );
}


function v1083MeetEntriesForDate(
    events,
    dateString
) {
    return (
        Array.isArray(
            events
        )
            ? events
            : []
    )
        .filter(event => {
            const props =
                event?.extendedProps ||
                {};

            return (
                props.isMeetGreet ===
                    true &&
                getCalendarEventDateString(
                    event
                ) ===
                    dateString
            );
        })
        .sort(
            (a, b) =>
                meetGreetTimeToMinutes(
                    getMeetGreetTime(
                        a
                    )
                ) -
                meetGreetTimeToMinutes(
                    getMeetGreetTime(
                        b
                    )
                )
        );
}


function v1083CapacityDetailHtml(
    dateString,
    events
) {
    const entries =
        v1083CapacityEntriesForDate(
            events,
            dateString
        );

    const displayedCount =
        Number(
            dailyCapacityCounts[
                dateString
            ] ||
            0
        );

    const calculatedCount =
        entries.reduce(
            (
                total,
                event
            ) =>
                total +
                v1083DogCount(
                    v1083EventDogName(
                        event
                    )
                ),
            0
        );

    const dogCount =
        displayedCount ||
        calculatedCount;

    const stayCount =
        entries.length;

    const band =
        dogCount >=
            4
            ? 'Full / 4+'
            : (
                dogCount ===
                    3
                    ? 'Busy'
                    : 'Available'
              );

    const list =
        entries.length
            ? entries
                .map(event => {
                    const props =
                        event?.extendedProps ||
                        {};

                    const dogName =
                        v1083EventDogName(
                            event
                        );

                    const type =
                        v1083BookingType(
                            event
                        );

                    const range =
                        v1083NormaliseEventRange(
                            event
                        );

                    const dogCountForBooking =
                        v1083DogCount(
                            dogName
                        );

                    const owner =
                        String(
                            props.ownerName ||
                            props.owner ||
                            ''
                        ).trim();

                    const badgeClass =
                        props.isPotential ===
                            true
                            ? 'potential'
                            : 'confirmed';

                    return `
                        <div class="v1083-outlook-detail-row">
                            <span class="v1083-outlook-type-dot ${badgeClass}"></span>
                            <div class="v1083-outlook-detail-copy">
                                <div class="v1083-outlook-detail-title">
                                    <strong>${escapeDashboardHtml(dogName)}</strong>
                                    <span>${escapeDashboardHtml(type)}</span>
                                </div>
                                <small>
                                    ${escapeDashboardHtml(v1083ShortDateRange(range.start, range.end))}
                                    ${dogCountForBooking > 1 ? ` · ${dogCountForBooking} dogs` : ''}
                                    ${owner ? ` · ${escapeDashboardHtml(owner)}` : ''}
                                </small>
                            </div>
                        </div>
                    `;
                })
                .join('')
            : `
                <div class="v1083-outlook-empty">
                    No boarding stays are scheduled on this date.
                </div>
              `;

    return `
        <div class="v1083-outlook-popover-heading capacity">
            <div>
                <span>CAPACITY</span>
                <strong>${escapeDashboardHtml(v1083DateLabel(dateString))}</strong>
            </div>
            <span class="v1083-outlook-summary-pill">${dogCount} dog${dogCount === 1 ? '' : 's'}</span>
        </div>

        <div class="v1083-outlook-popover-summary">
            <strong>${escapeDashboardHtml(band)}</strong>
            <span>
                ${stayCount} stay${stayCount === 1 ? '' : 's'}
                ${displayedCount !== calculatedCount && calculatedCount
                    ? ` · ${calculatedCount} visible dog${calculatedCount === 1 ? '' : 's'}`
                    : ''}
            </span>
        </div>

        <div class="v1083-outlook-detail-list">
            ${list}
        </div>
    `;
}


function v1083MeetDetailHtml(
    dateString,
    events
) {
    const entries =
        v1083MeetEntriesForDate(
            events,
            dateString
        );

    const list =
        entries.length
            ? entries
                .map(event => {
                    const props =
                        event?.extendedProps ||
                        {};

                    const dogName =
                        v1083EventDogName(
                            event
                        );

                    const time =
                        getMeetGreetTime(
                            event
                        );

                    const breed =
                        String(
                            props.breed ||
                            ''
                        ).trim();

                    const owner =
                        String(
                            props.ownerName ||
                            props.owner ||
                            ''
                        ).trim();

                    const phone =
                        String(
                            props.phone ||
                            ''
                        ).trim();

                    return `
                        <div class="v1083-outlook-detail-row">
                            <span class="v1083-outlook-time">${escapeDashboardHtml(time)}</span>
                            <div class="v1083-outlook-detail-copy">
                                <div class="v1083-outlook-detail-title">
                                    <strong>${escapeDashboardHtml(dogName)}</strong>
                                    <span>Meet &amp; Greet</span>
                                </div>
                                <small>
                                    ${breed ? escapeDashboardHtml(breed) : 'Breed not recorded'}
                                    ${owner ? ` · ${escapeDashboardHtml(owner)}` : ''}
                                    ${phone ? ` · ${escapeDashboardHtml(phone)}` : ''}
                                </small>
                            </div>
                        </div>
                    `;
                })
                .join('')
            : `
                <div class="v1083-outlook-empty">
                    No Meet &amp; Greets are scheduled on this date.
                </div>
              `;

    return `
        <div class="v1083-outlook-popover-heading meet">
            <div>
                <span>MEET &amp; GREET</span>
                <strong>${escapeDashboardHtml(v1083DateLabel(dateString))}</strong>
            </div>
            <span class="v1083-outlook-summary-pill">${entries.length} visit${entries.length === 1 ? '' : 's'}</span>
        </div>

        <div class="v1083-outlook-detail-list">
            ${list}
        </div>
    `;
}


function v1083EnsurePopover() {
    let popover =
        document.getElementById(
            'v1083OutlookPopover'
        );

    if (popover) {
        return popover;
    }

    popover =
        document.createElement(
            'div'
        );

    popover.id =
        'v1083OutlookPopover';

    popover.className =
        'v1083-outlook-popover';

    popover.hidden =
        true;

    popover.setAttribute(
        'role',
        'dialog'
    );

    popover.setAttribute(
        'aria-label',
        'Outlook day details'
    );

    document.body.appendChild(
        popover
    );

    popover.addEventListener(
        'pointerenter',
        () => {
            clearTimeout(
                v1083HoverHideTimer
            );
        }
    );

    popover.addEventListener(
        'pointerleave',
        () => {
            if (
                !v1083PinnedOutlookCell
            ) {
                v1083SchedulePopoverHide();
            }
        }
    );

    return popover;
}


function v1083PositionPopover(
    target
) {
    const popover =
        v1083EnsurePopover();

    if (
        !target ||
        popover.hidden
    ) {
        return;
    }

    const rect =
        target.getBoundingClientRect();

    const gap =
        9;

    const margin =
        10;

    const popRect =
        popover.getBoundingClientRect();

    let left =
        rect.left +
        (
            rect.width /
            2
        ) -
        (
            popRect.width /
            2
        );

    left =
        Math.max(
            margin,
            Math.min(
                left,
                window.innerWidth -
                popRect.width -
                margin
            )
        );

    let top =
        rect.bottom +
        gap;

    let placement =
        'bottom';

    if (
        top +
        popRect.height >
        window.innerHeight -
        margin
    ) {
        top =
            rect.top -
            popRect.height -
            gap;

        placement =
            'top';
    }

    if (
        top <
        margin
    ) {
        top =
            Math.max(
                margin,
                Math.min(
                    rect.bottom +
                    gap,
                    window.innerHeight -
                    popRect.height -
                    margin
                )
            );
    }

    popover.style.left =
        `${Math.round(left)}px`;

    popover.style.top =
        `${Math.round(top)}px`;

    popover.dataset.placement =
        placement;
}


function v1083ShowPopover(
    target,
    pinned = false
) {
    const key =
        String(
            target?.dataset
                ?.v1083OutlookKey ||
            ''
        );

    const detail =
        v1083OutlookDetails.get(
            key
        );

    if (
        !target ||
        !detail
    ) {
        return;
    }

    clearTimeout(
        v1083HoverHideTimer
    );

    const popover =
        v1083EnsurePopover();

    popover.innerHTML =
        detail.html;

    popover.dataset.kind =
        detail.kind;

    popover.hidden =
        false;

    if (pinned) {
        v1083PinnedOutlookCell =
            target;
    }

    document
        .querySelectorAll(
            '[data-v1083-outlook-key]'
        )
        .forEach(cell => {
            const active =
                cell ===
                target;

            cell.classList.toggle(
                'is-v1083-active',
                active
            );

            cell.setAttribute(
                'aria-expanded',
                active
                    ? 'true'
                    : 'false'
            );
        });

    requestAnimationFrame(
        () =>
            v1083PositionPopover(
                target
            )
    );
}


function v1083HidePopover(
    force = false
) {
    if (
        v1083PinnedOutlookCell &&
        !force
    ) {
        return;
    }

    clearTimeout(
        v1083HoverHideTimer
    );

    const popover =
        document.getElementById(
            'v1083OutlookPopover'
        );

    if (popover) {
        popover.hidden =
            true;
    }

    document
        .querySelectorAll(
            '[data-v1083-outlook-key]'
        )
        .forEach(cell => {
            cell.classList.remove(
                'is-v1083-active'
            );

            cell.setAttribute(
                'aria-expanded',
                'false'
            );
        });

    v1083PinnedOutlookCell =
        null;
}


function v1083SchedulePopoverHide() {
    clearTimeout(
        v1083HoverHideTimer
    );

    v1083HoverHideTimer =
        setTimeout(
            () =>
                v1083HidePopover(),
            150
        );
}


function v1083DecorateOutlookDays(
    events
) {
    if (
        WAFFLE_PAGE !==
        'calendar'
    ) {
        return;
    }

    v1083LatestOutlookEvents =
        Array.isArray(
            events
        )
            ? events
            : [];

    v1083OutlookDetails.clear();

    const today =
        getLocalTodayDateString();

    const capacityCells =
        Array.from(
            document.querySelectorAll(
                '#v10CapacityStrip .v10-capacity-day'
            )
        );

    const meetCells =
        Array.from(
            document.querySelectorAll(
                '#v108MeetOutlook .v108-meet-day'
            )
        );

    for (
        let offset = 0;
        offset < 7;
        offset++
    ) {
        const date =
            new Date(
                today +
                'T12:00:00'
            );

        date.setDate(
            date.getDate() +
            offset
        );

        const dateString =
            v1083DateStringFromDate(
                date
            );

        const capacityKey =
            `capacity|${dateString}`;

        const meetKey =
            `meet|${dateString}`;

        v1083OutlookDetails.set(
            capacityKey,
            {
                kind:
                    'capacity',
                dateString,
                html:
                    v1083CapacityDetailHtml(
                        dateString,
                        v1083LatestOutlookEvents
                    )
            }
        );

        v1083OutlookDetails.set(
            meetKey,
            {
                kind:
                    'meet',
                dateString,
                html:
                    v1083MeetDetailHtml(
                        dateString,
                        v1083LatestOutlookEvents
                    )
            }
        );

        const capacityCell =
            capacityCells[
                offset
            ];

        if (capacityCell) {
            capacityCell.dataset
                .v1083OutlookKey =
                capacityKey;

            capacityCell.dataset
                .v1083OutlookKind =
                'capacity';

            capacityCell.tabIndex =
                0;

            capacityCell.setAttribute(
                'role',
                'button'
            );

            capacityCell.setAttribute(
                'aria-haspopup',
                'dialog'
            );

            capacityCell.setAttribute(
                'aria-expanded',
                'false'
            );

            capacityCell.setAttribute(
                'aria-label',
                `${v1083DateLabel(dateString)} capacity details. Hover, focus or click for bookings.`
            );
        }

        const meetCell =
            meetCells[
                offset
            ];

        if (meetCell) {
            meetCell.dataset
                .v1083OutlookKey =
                meetKey;

            meetCell.dataset
                .v1083OutlookKind =
                'meet';

            meetCell.tabIndex =
                0;

            meetCell.setAttribute(
                'role',
                'button'
            );

            meetCell.setAttribute(
                'aria-haspopup',
                'dialog'
            );

            meetCell.setAttribute(
                'aria-expanded',
                'false'
            );

            meetCell.setAttribute(
                'aria-label',
                `${v1083DateLabel(dateString)} Meet and Greet details. Hover, focus or click for visits.`
            );
        }
    }

    if (
        v1083PinnedOutlookCell &&
        !document.body.contains(
            v1083PinnedOutlookCell
        )
    ) {
        v1083HidePopover(
            true
        );
    }
}


renderV10OperationsHome =
    function(
        events
    ) {
        v1083BaseRenderOperationsHome(
            events
        );

        v1083DecorateOutlookDays(
            events
        );
    };


function v1083OutlookCellFromEvent(
    event
) {
    return event.target
        ?.closest(
            '[data-v1083-outlook-key]'
        ) ||
        null;
}


document.addEventListener(
    'pointerover',
    event => {
        const cell =
            v1083OutlookCellFromEvent(
                event
            );

        if (
            !cell ||
            cell.contains(
                event.relatedTarget
            )
        ) {
            return;
        }

        if (
            event.pointerType ===
            'touch'
        ) {
            return;
        }

        if (
            !v1083PinnedOutlookCell
        ) {
            v1083ShowPopover(
                cell,
                false
            );
        }
    }
);


document.addEventListener(
    'pointerout',
    event => {
        const cell =
            v1083OutlookCellFromEvent(
                event
            );

        if (
            !cell ||
            cell.contains(
                event.relatedTarget
            )
        ) {
            return;
        }

        if (
            event.pointerType ===
            'touch'
        ) {
            return;
        }

        if (
            !v1083PinnedOutlookCell
        ) {
            v1083SchedulePopoverHide();
        }
    }
);


document.addEventListener(
    'focusin',
    event => {
        const cell =
            v1083OutlookCellFromEvent(
                event
            );

        if (
            cell &&
            !v1083PinnedOutlookCell
        ) {
            v1083ShowPopover(
                cell,
                false
            );
        }
    }
);


document.addEventListener(
    'focusout',
    event => {
        const cell =
            v1083OutlookCellFromEvent(
                event
            );

        if (
            cell &&
            !v1083PinnedOutlookCell
        ) {
            v1083SchedulePopoverHide();
        }
    }
);


document.addEventListener(
    'click',
    event => {
        const cell =
            v1083OutlookCellFromEvent(
                event
            );

        if (cell) {
            event.preventDefault();
            event.stopPropagation();

            if (
                v1083PinnedOutlookCell ===
                cell
            ) {
                v1083HidePopover(
                    true
                );
            } else {
                v1083PinnedOutlookCell =
                    cell;

                v1083ShowPopover(
                    cell,
                    true
                );
            }

            return;
        }

        const popover =
            document.getElementById(
                'v1083OutlookPopover'
            );

        if (
            v1083PinnedOutlookCell &&
            popover &&
            !popover.contains(
                event.target
            )
        ) {
            v1083HidePopover(
                true
            );
        }
    },
    true
);


document.addEventListener(
    'keydown',
    event => {
        if (
            event.key ===
            'Escape'
        ) {
            v1083HidePopover(
                true
            );

            return;
        }

        const cell =
            event.target
                ?.closest(
                    '[data-v1083-outlook-key]'
                );

        if (
            cell &&
            (
                event.key ===
                    'Enter' ||
                event.key ===
                    ' '
            )
        ) {
            event.preventDefault();

            if (
                v1083PinnedOutlookCell ===
                cell
            ) {
                v1083HidePopover(
                    true
                );
            } else {
                v1083PinnedOutlookCell =
                    cell;

                v1083ShowPopover(
                    cell,
                    true
                );
            }
        }
    }
);


window.addEventListener(
    'resize',
    () => {
        if (
            v1083PinnedOutlookCell
        ) {
            v1083PositionPopover(
                v1083PinnedOutlookCell
            );
        }
    }
);


window.addEventListener(
    'scroll',
    () => {
        if (
            v1083PinnedOutlookCell
        ) {
            v1083PositionPopover(
                v1083PinnedOutlookCell
            );
        }
    },
    true
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

        v1083EnsurePopover();

        setTimeout(
            () =>
                v1083DecorateOutlookDays(
                    globalCalendar
                        ?.getEvents() ||
                    v1083LatestOutlookEvents
                ),
            650
        );
    }
);
