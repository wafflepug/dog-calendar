/* ============================================================
   WAFFLE HOUSE V10.8.8 — MINOR UX ENHANCEMENTS
   ============================================================ */

const V1088_VERSION =
    '10.8.8';

const v1088BasePastCardHtml =
    v1082PastCardHtml;

const v1088BaseApplyPastResponse =
    v1082ApplyPastResponse;

let v1088SelectedCalendarDate =
    '';


/* ============================================================
   1 + 2. PAST DOG PROFILES — CONSOLIDATE + RE-BOOK
   ============================================================ */

function v1088NormaliseDogKey(
    booking
) {
    const dog =
        String(
            booking?.dogName ||
            ''
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                ' '
            )
            .replace(
                /\s+/g,
                ' '
            )
            .trim();

    const breed =
        String(
            booking?.breed ||
            ''
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                ' '
            )
            .replace(
                /\s+/g,
                ' '
            )
            .trim();

    return (
        dog +
        '|' +
        breed
    );
}


function v1088GroupPastBookings(
    bookings
) {
    const groups =
        new Map();

    (
        Array.isArray(
            bookings
        )
            ? bookings
            : []
    )
        .forEach(
            booking => {
                const key =
                    v1088NormaliseDogKey(
                        booking
                    );

                if (
                    !key ||
                    key ===
                        '|'
                ) {
                    return;
                }

                if (
                    !groups.has(
                        key
                    )
                ) {
                    groups.set(
                        key,
                        []
                    );
                }

                groups
                    .get(
                        key
                    )
                    .push(
                        booking
                    );
            }
        );

    return Array
        .from(
            groups.values()
        )
        .map(
            stays => {
                stays.sort(
                    (a, b) => {
                        const end =
                            String(
                                b.endDate ||
                                b.startDate ||
                                ''
                            )
                                .localeCompare(
                                    String(
                                        a.endDate ||
                                        a.startDate ||
                                        ''
                                    )
                                );

                        if (end) {
                            return end;
                        }

                        return Number(
                            b.row ||
                            0
                        ) -
                        Number(
                            a.row ||
                            0
                        );
                    }
                );

                const latest = {
                    ...stays[0]
                };

                latest.v1088StayCount =
                    stays.length;

                latest.v1088AllStays =
                    stays.map(
                        stay => ({
                            stayKey:
                                stay.stayKey,
                            startDate:
                                stay.startDate,
                            endDate:
                                stay.endDate,
                            ownerName:
                                stay.ownerName,
                            phone:
                                stay.phone,
                            notes:
                                stay.notes,
                            bookingType:
                                stay.bookingType
                        })
                    );

                return latest;
            }
        )
        .sort(
            (a, b) =>
                String(
                    b.endDate ||
                    ''
                )
                    .localeCompare(
                        String(
                            a.endDate ||
                            ''
                        )
                    )
        );
}


v1082PastCardHtml =
    function(
        booking
    ) {
        let html =
            v1088BasePastCardHtml(
                booking
            );

        const stayCount =
            Math.max(
                1,
                Number(
                    booking
                        ?.v1088StayCount ||
                    1
                )
            );

        const allStays =
            Array.isArray(
                booking
                    ?.v1088AllStays
            )
                ? booking.v1088AllStays
                : [];

        const extraData =
            [
                [
                    'data-v1088-breed',
                    booking?.breed
                ],
                [
                    'data-v1088-owner-name',
                    booking?.ownerName
                ],
                [
                    'data-v1088-phone',
                    booking?.phone
                ],
                [
                    'data-v1088-notes',
                    booking?.notes
                ],
                [
                    'data-v1088-stay-count',
                    stayCount
                ],
                [
                    'data-v1088-all-stays',
                    JSON.stringify(
                        allStays
                    )
                ]
            ]
                .map(
                    ([name, value]) =>
                        `${name}="${v1082Escape(value)}"`
                )
                .join(
                    '\n            '
                );

        html =
            html.replace(
                'data-v1082-past-stay="true">',
                `data-v1082-past-stay="true"
            ${extraData}>`
            );

        if (
            stayCount >
            1
        ) {
            html =
                html.replace(
                    '</button>\n\n            <div class="directory-profile-content">',
                    `<span class="v1088-past-stay-count">
                        ${stayCount} stays
                    </span>
                </button>

            <div class="directory-profile-content">`
                );
        }

        html =
            html.replace(
                `<span class="directory-status-tag v1082-past-status">
                                Past Stay
                            </span>`,
                `<span class="directory-status-tag v1082-past-status">
                                Past Stay
                            </span>
                            <button
                                type="button"
                                class="v1088-rebook-button"
                                data-v1088-rebook
                                title="Create a new confirmed stay for ${v1082Escape(booking?.dogName || 'this dog')}">
                                ↻ Re-book
                            </button>`
            );

        if (
            stayCount >
            1
        ) {
            html =
                html.replace(
                    `<div class="directory-stay-dates">
                            📅 ${v1082Escape(
                                `${formatStayDateShort(booking.startDate)} – ${formatStayDateShort(booking.endDate || booking.startDate)}`
                            )}
                        </div>`,
                    `<div class="directory-stay-dates">
                            📅 Latest stay: ${v1082Escape(
                                `${formatStayDateShort(booking.startDate)} – ${formatStayDateShort(booking.endDate || booking.startDate)}`
                            )}
                            <span class="v1088-profile-stay-summary">
                                ${stayCount} completed stays are consolidated in this profile.
                            </span>
                        </div>`
                );
        }

        return html;
    };


v1082ApplyPastResponse =
    function(
        response
    ) {
        response =
            response ||
            {};

        const grouped =
            v1088GroupPastBookings(
                response.bookings
            );

        const patched = {
            ...response,
            bookings:
                grouped,
            totalPastStays:
                grouped.length,
            totalHistoricalBookings:
                Number(
                    response
                        .totalPastStays ||
                    (
                        Array.isArray(
                            response.bookings
                        )
                            ? response.bookings.length
                            : 0
                    )
                )
        };

        /*
         * V10.8.6 uses the global response later to refresh the Past count.
         * Store the consolidated profile response so the count represents
         * unique historical dogs rather than individual boarding rows.
         */
        v1082PastResponse =
            patched;

        v1088BaseApplyPastResponse(
            patched
        );

        const note =
            document.querySelector(
                '.guest-directory-toolbar-note'
            );

        if (
            note &&
            v1082ActiveStayView ===
                'past'
        ) {
            note.textContent =
                'One tile per historical dog. Multiple stays are consolidated into their profile and History tab.';
        }
    };


function v1088OpenRebook(
    card
) {
    if (
        !card ||
        typeof v108OpenBoarding !==
            'function'
    ) {
        return;
    }

    v108OpenBoarding();

    const modal =
        document.getElementById(
            'v108BoardingModal'
        );

    if (!modal) {
        return;
    }

    const set =
        (
            key,
            value
        ) => {
            const input =
                modal.querySelector(
                    `[data-v108-board="${key}"]`
                );

            if (input) {
                input.value =
                    String(
                        value ||
                        ''
                    );
            }
        };

    set(
        'dogName',
        card.dataset
            .dogName ||
        card.dataset
            .directoryDogName
    );

    set(
        'breed',
        card.dataset
            .v1088Breed
    );

    set(
        'ownerName',
        card.dataset
            .v1088OwnerName
    );

    set(
        'phone',
        card.dataset
            .v1088Phone
    );

    /*
     * Previous stay notes are deliberately not copied into the new booking;
     * they may be outdated. Profile/care reuse remains enabled by default.
     */
    set(
        'notes',
        ''
    );

    const copy =
        modal.querySelector(
            '[data-v108-copy-profile]'
        );

    if (copy) {
        copy.checked =
            true;
    }

    const hint =
        modal.querySelector(
            '[data-v108-returning]'
        );

    if (hint) {
        hint.hidden =
            false;

        hint.innerHTML = `
            <span>↻</span>
            <div>
                <strong>Re-booking returning guest</strong>
                <small>
                    ${
                        Number(
                            card.dataset
                                .v1088StayCount ||
                            1
                        )
                    } previous stay${
                        Number(
                            card.dataset
                                .v1088StayCount ||
                            1
                        ) ===
                        1
                            ? ''
                            : 's'
                    } recorded. Previous profile/care can be reused.
                </small>
            </div>
        `;
    }

    modal
        .querySelector(
            '[data-v108-board="startDate"]'
        )
        ?.focus();
}


/* ============================================================
   3. MOBILE + BUTTON — DOCK INTO BOTTOM NAV
   ============================================================ */

function v1088DockQuickAddButton() {
    const button =
        document.getElementById(
            'v10QuickAddButton'
        );

    const nav =
        document.querySelector(
            '.app-tabs'
        );

    if (
        !button ||
        !nav
    ) {
        return;
    }

    const mobile =
        window.matchMedia(
            '(max-width: 768px)'
        )
            .matches;

    if (mobile) {
        if (
            button.parentElement !==
            nav
        ) {
            const reminder =
                nav.querySelector(
                    '[data-page-link="reminders"]'
                );

            nav.insertBefore(
                button,
                reminder ||
                null
            );
        }

        button.classList.add(
            'v1088-nav-quick-add'
        );

        nav.classList.add(
            'v1088-has-quick-add'
        );

        button.setAttribute(
            'aria-label',
            'Add booking, potential stay, Meet and Greet or reminder'
        );

        return;
    }

    if (
        button.parentElement !==
        document.body
    ) {
        document.body.appendChild(
            button
        );
    }

    button.classList.remove(
        'v1088-nav-quick-add'
    );

    nav.classList.remove(
        'v1088-has-quick-add'
    );
}


/* ============================================================
   4. CALENDAR DATE CLICK — CHOOSE BOOKING TYPE
   ============================================================ */

function v1088EnsureDateChoiceModal() {
    let modal =
        document.getElementById(
            'v1088DateChoiceModal'
        );

    if (modal) {
        return modal;
    }

    modal =
        document.createElement(
            'div'
        );

    modal.id =
        'v1088DateChoiceModal';

    modal.className =
        'v108-modal';

    modal.hidden =
        true;

    modal.innerHTML = `
        <div class="v108-modal-card v1088-date-choice-card">
            <div class="v108-modal-head">
                <div>
                    <small>CALENDAR DATE</small>
                    <h3>＋ Add to this date</h3>
                    <p data-v1088-date-choice-label>
                        Choose what you want to schedule.
                    </p>
                </div>
                <button
                    type="button"
                    data-v1088-date-close
                    aria-label="Close">
                    ×
                </button>
            </div>

            <div class="v1088-date-choice-grid">
                <button
                    type="button"
                    data-v1088-date-action="confirmed">
                    <span>🏡</span>
                    <strong>Confirmed Stay</strong>
                    <small>Create boarding + Digital Intake link</small>
                </button>

                <button
                    type="button"
                    data-v1088-date-action="potential">
                    <span>❓</span>
                    <strong>Potential Stay</strong>
                    <small>Pending booking request</small>
                </button>

                <button
                    type="button"
                    data-v1088-date-action="meet">
                    <span>🤝</span>
                    <strong>Meet &amp; Greet</strong>
                    <small>Schedule a visit</small>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(
        modal
    );

    modal.addEventListener(
        'click',
        event => {
            if (
                event.target ===
                    modal ||
                event.target.closest(
                    '[data-v1088-date-close]'
                )
            ) {
                modal.hidden =
                    true;

                return;
            }

            const action =
                event.target.closest(
                    '[data-v1088-date-action]'
                );

            if (!action) {
                return;
            }

            modal.hidden =
                true;

            const date =
                v1088SelectedCalendarDate ||
                getLocalTodayDateString();

            if (
                action.dataset
                    .v1088DateAction ===
                'confirmed'
            ) {
                v108OpenBoarding();

                const boarding =
                    document.getElementById(
                        'v108BoardingModal'
                    );

                const start =
                    boarding
                        ?.querySelector(
                            '[data-v108-board="startDate"]'
                        );

                const end =
                    boarding
                        ?.querySelector(
                            '[data-v108-board="endDate"]'
                        );

                if (start) {
                    start.value =
                        date;
                }

                if (end) {
                    end.value =
                        date;
                }

                return;
            }

            if (
                action.dataset
                    .v1088DateAction ===
                'meet'
            ) {
                openV10MeetGreetModal(
                    date
                );

                return;
            }

            /*
             * openNewPotentialModal() is scoped inside the existing Calendar
             * DOMContentLoaded handler. Trigger its already-wired legacy button
             * and then apply the selected Calendar date.
             */
            const potentialTrigger =
                document.getElementById(
                    'openPotentialBtn'
                );

            if (potentialTrigger) {
                potentialTrigger.click();

                const start =
                    document.getElementById(
                        'potStartDate'
                    );

                const end =
                    document.getElementById(
                        'potEndDate'
                    );

                if (start) {
                    start.value =
                        date;
                }

                if (end) {
                    end.value =
                        date;
                }
            }
        }
    );

    return modal;
}


function v1088OpenDateChoice(
    dateString
) {
    v1088SelectedCalendarDate =
        String(
            dateString ||
            getLocalTodayDateString()
        );

    const modal =
        v1088EnsureDateChoiceModal();

    const label =
        modal.querySelector(
            '[data-v1088-date-choice-label]'
        );

    if (label) {
        const date =
            new Date(
                v1088SelectedCalendarDate +
                'T12:00:00'
            );

        label.textContent =
            Number.isNaN(
                date.getTime()
            )
                ? 'Choose what you want to schedule.'
                : (
                    date.toLocaleDateString(
                        'en-AU',
                        {
                            weekday:
                                'long',
                            day:
                                'numeric',
                            month:
                                'long',
                            year:
                                'numeric'
                        }
                    ) +
                    ' · choose the booking type.'
                  );
    }

    modal.hidden =
        false;
}


function v1088InstallCalendarDateClick() {
    if (
        WAFFLE_PAGE !==
            'calendar' ||
        !globalCalendar
    ) {
        return;
    }

    globalCalendar.setOption(
        'dateClick',
        info => {
            v1088OpenDateChoice(
                info.dateStr
            );
        }
    );
}


/* ============================================================
   5. MEET & GREET / POTENTIAL MODAL VISUAL NORMALISATION
   ============================================================ */

function v1088StyleLegacyBookingModal(
    id,
    kicker
) {
    const modal =
        document.getElementById(
            id
        );

    if (!modal) {
        return;
    }

    modal.classList.add(
        'v1088-booking-modal'
    );

    const panel =
        modal.querySelector(
            '.modal-content-panel'
        );

    if (!panel) {
        return;
    }

    panel.classList.add(
        'v1088-booking-modal-card'
    );

    const heading =
        panel.querySelector(
            'h3'
        );

    if (
        heading &&
        !panel.querySelector(
            '.v1088-modal-kicker'
        )
    ) {
        const kickerElement =
            document.createElement(
                'span'
            );

        kickerElement.className =
            'v1088-modal-kicker';

        kickerElement.textContent =
            kicker;

        panel.insertBefore(
            kickerElement,
            heading
        );
    }

    if (
        !panel.querySelector(
            '.v1088-modal-x'
        )
    ) {
        const close =
            document.createElement(
                'button'
            );

        close.type =
            'button';

        close.className =
            'v1088-modal-x';

        close.textContent =
            '×';

        close.setAttribute(
            'aria-label',
            'Close'
        );

        close.addEventListener(
            'click',
            () => {
                const existing =
                    id ===
                    'customBookingModal'
                        ? document.getElementById(
                            'closeModalBtn'
                          )
                        : document.getElementById(
                            'closePotentialModalBtn'
                          );

                if (existing) {
                    existing.click();
                } else {
                    modal.style.display =
                        'none';
                }
            }
        );

        panel.appendChild(
            close
        );
    }
}


function v1088StyleBookingModals() {
    v1088StyleLegacyBookingModal(
        'customBookingModal',
        'MEET & GREET'
    );

    v1088StyleLegacyBookingModal(
        'potentialStayModal',
        'PENDING STAY'
    );
}


/* ============================================================
   6. PAST TILE NAME / DATE — REMOVE BLURRED BANNERS
   Implemented in V10.8.8 CSS.
   ============================================================ */


/* ============================================================
   7. DESKTOP HEADER CONTROLS — ICON ONLY
   Implemented in V10.8.8 CSS.
   ============================================================ */


/* ============================================================
   GLOBAL EVENT HANDLERS
   ============================================================ */

document.addEventListener(
    'click',
    event => {
        const rebook =
            event.target.closest(
                '[data-v1088-rebook]'
            );

        if (!rebook) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        v1088OpenRebook(
            rebook.closest(
                '.directory-card'
            )
        );
    },
    true
);


document.addEventListener(
    'DOMContentLoaded',
    () => {
        v1088StyleBookingModals();

        /*
         * ensureV10QuickAdd() and FullCalendar are initialised by earlier
         * scripts in the same DOMContentLoaded cycle.
         */
        setTimeout(
            v1088DockQuickAddButton,
            100
        );

        setTimeout(
            v1088InstallCalendarDateClick,
            220
        );

        /*
         * V10.8 calendar enhancement runs shortly after startup. Re-apply
         * dateClick once more afterwards so the date-type chooser remains
         * authoritative.
         */
        setTimeout(
            v1088InstallCalendarDateClick,
            650
        );
    }
);


window.addEventListener(
    'resize',
    () => {
        clearTimeout(
            window
                .v1088DockTimer
        );

        window.v1088DockTimer =
            setTimeout(
                v1088DockQuickAddButton,
                80
            );
    }
);
