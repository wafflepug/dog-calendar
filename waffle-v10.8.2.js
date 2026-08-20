/* ============================================================
   WAFFLE HOUSE V10.8.2 — CARE CURRENT / PAST STAYS
   ============================================================ */

const V1082_PAST_LIMIT = 250;
let v1082ActiveStayView = 'current';
let v1082PastLoaded = false;
let v1082PastLoadPromise = null;
let v1082PastResponse = null;

function v1082Escape(value) {
    return escapeDashboardHtml(
        value == null
            ? ''
            : String(value)
    );
}

function v1082PastCardHtml(booking) {
    const stayKey =
        String(
            booking.stayKey ||
            ''
        );

    const dogName =
        String(
            booking.dogName ||
            'Guest'
        ).trim();

    const breed =
        String(
            booking.breed ||
            'Unknown'
        ).trim() ||
        'Unknown';

    const startDate =
        String(
            booking.startDate ||
            ''
        );

    const endDate =
        String(
            booking.endDate ||
            startDate
        );

    const ownerName =
        String(
            booking.ownerName ||
            ''
        ).trim();

    const phone =
        String(
            booking.phone ||
            ''
        ).trim();

    const notes =
        String(
            booking.notes ||
            ''
        ).trim();

    const dateLabel =
        `${formatStayDateShort(startDate)} – ${formatStayDateShort(endDate)}`;

    return `
        <div
            class="directory-card directory-card-fused belongings-pet-card v1082-past-card"
            data-directory-stay-key="${v1082Escape(stayKey)}"
            data-directory-dog-name="${v1082Escape(dogName)}"
            data-directory-start-date="${v1082Escape(startDate)}"
            data-directory-end-date="${v1082Escape(endDate)}"
            data-stay-key="${v1082Escape(stayKey)}"
            data-dog-name="${v1082Escape(dogName)}"
            data-start-date="${v1082Escape(startDate)}"
            data-end-date="${v1082Escape(endDate)}"
            data-v1082-past-stay="true">

            <button
                type="button"
                class="directory-guest-tile-open v1082-past-tile"
                data-open-directory-profile
                aria-label="Open ${v1082Escape(dogName)} past care profile">
                <span
                    class="directory-guest-tile-photo"
                    data-directory-tile-photo="${v1082Escape(stayKey)}"
                    aria-hidden="true"></span>
                <span class="directory-guest-tile-name">
                    ${v1082Escape(dogName)}
                </span>
                <span class="v1082-past-tile-date">
                    ${v1082Escape(dateLabel)}
                </span>
            </button>

            <div class="directory-profile-content">
                <div class="directory-card-header">
                    <div
                        class="directory-photo-shell v1087-past-photo-shell"
                        data-directory-photo="${v1082Escape(stayKey)}">
                        <div class="directory-photo-media">
                            <div
                                class="directory-photo-placeholder"
                                aria-label="No dog profile photo">🐶</div>
                        </div>
                        <button
                            type="button"
                            class="directory-photo-edit-button v1087-past-photo-edit"
                            data-upload-dog-photo
                            title="Add or change historical dog profile photo"
                            aria-label="Add or change ${v1082Escape(dogName)} historical profile photo">
                            ✎
                        </button>
                    </div>

                    <div class="directory-card-identity">
                        <div class="directory-name-row">
                            <span class="directory-dog-name-btn v1082-readonly-name">
                                ${v1082Escape(dogName)}
                            </span>
                            <span class="directory-status-tag v1082-past-status">
                                Past Stay
                            </span>
                        </div>

                        <span class="directory-primary-breed v1082-readonly-breed">
                            ${v1082Escape(breed)}
                        </span>

                        <div class="directory-stay-dates">
                            📅 ${v1082Escape(dateLabel)}
                        </div>
                    </div>
                </div>

                <nav
                    class="directory-main-profile-tabs"
                    role="tablist"
                    aria-label="${v1082Escape(dogName)} past stay profile sections">
                    <button
                        type="button"
                        class="directory-main-profile-tab is-active"
                        role="tab"
                        aria-selected="true"
                        data-directory-main-tab="profile">
                        <span aria-hidden="true">🐶</span>
                        <span>Profile</span>
                    </button>
                    <button
                        type="button"
                        class="directory-main-profile-tab"
                        role="tab"
                        aria-selected="false"
                        data-directory-main-tab="belongings">
                        <span aria-hidden="true">🧳</span>
                        <span>Belongings</span>
                    </button>
                </nav>

                <section
                    class="directory-main-profile-panel is-active"
                    role="tabpanel"
                    data-directory-main-panel="profile">

                    <div
                        class="directory-care-strip"
                        data-directory-care="${v1082Escape(stayKey)}">
                        <span class="directory-care-unset">
                            🛡️ No saved care alerts
                        </span>
                    </div>

                    <div
                        class="directory-intake-strip v1082-past-intake"
                        data-directory-intake="${v1082Escape(stayKey)}">
                        <div class="directory-intake-state">
                            <span class="directory-intake-dot is-not-sent"></span>
                            <span>No Digital Intake on record</span>
                        </div>
                    </div>

                    <div
                        class="directory-legacy-strip v1082-past-legacy"
                        data-directory-legacy="${v1082Escape(stayKey)}">
                        <div class="directory-legacy-state">
                            <span>📚 No Legacy Intake on record</span>
                        </div>
                    </div>

                    <div class="directory-attributes-grid directory-core-attributes v1082-past-core-details">
                        <div class="directory-attribute">
                            <span class="directory-field-label">Owner</span>
                            <span class="directory-field-value">${v1082Escape(ownerName || 'N/A')}</span>
                        </div>

                        <div class="directory-attribute">
                            <span class="directory-field-label">Contact</span>
                            <span class="directory-field-value">${v1082Escape(phone || 'N/A')}</span>
                        </div>

                        <div class="directory-attribute directory-attribute-wide">
                            <span class="directory-field-label">Notes</span>
                            <span class="directory-field-value">${v1082Escape(notes || 'None')}</span>
                        </div>
                    </div>

                    <section
                        class="directory-profile-section directory-profile-intake-section"
                        data-directory-detail="profile"
                        data-detail-loaded="false">
                        <div class="directory-profile-section-heading">
                            <div>
                                <span class="directory-profile-section-kicker">Past stay profile</span>
                                <h4>📋 Profile &amp; Care</h4>
                            </div>
                            <div class="directory-profile-section-tools">
                                <span
                                    class="intake-profile-source"
                                    data-intake-profile-summary>
                                    Loading profile…
                                </span>
                            </div>
                        </div>
                        <div
                            class="directory-fused-details-body"
                            data-directory-intake-attributes>
                            <div class="intake-profile-empty">
                                Open this profile to load saved intake attributes.
                            </div>
                        </div>
                    </section>
                </section>

                <section
                    class="directory-main-profile-panel"
                    role="tabpanel"
                    data-directory-main-panel="belongings"
                    hidden>
                    <section
                        class="directory-profile-section directory-belongings-only-section"
                        data-directory-detail="belongings"
                        data-detail-loaded="false">
                        <div class="directory-profile-section-heading">
                            <div>
                                <span class="directory-profile-section-kicker">Past stay belongings</span>
                                <h4>🧳 Items &amp; Photos</h4>
                            </div>
                        </div>
                        <div
                            class="directory-fused-details-body"
                            data-directory-belongings>
                            <div class="intake-profile-empty">
                                Open Belongings to load the saved record.
                            </div>
                        </div>
                    </section>
                </section>
            </div>
        </div>
    `;
}

function v1082ApplyPastReadOnly(card) {
    if (!card || card.dataset.v1082PastStay !== 'true') {
        return;
    }

    card.classList.add(
        'is-v1082-readonly'
    );

    card
        .querySelectorAll(
            '[data-directory-main-panel="profile"] [data-intake-attribute], ' +
            '[data-directory-main-panel="profile"] [data-care-risk-flag], ' +
            '[data-directory-main-panel="belongings"] input, ' +
            '[data-directory-main-panel="belongings"] select, ' +
            '[data-directory-main-panel="belongings"] textarea'
        )
        .forEach(control => {
            control.disabled = true;
        });

    card
        .querySelectorAll(
            '[data-save-belongings], ' +
            '[data-take-belongings-photo], ' +
            '[data-upload-belongings-photo], ' +
            '[data-delete-belongings-photo], ' +
            '[data-toggle-profile-edit], ' +
            '[data-cancel-profile-edit], ' +
            '[data-create-intake-link], ' +
            '[data-upload-legacy-intake], ' +
            '[data-reassign-legacy-intake]'
        )
        .forEach(element => {
            element.hidden = true;
            element.style.display = 'none';
        });

    const intakeStrip =
        card.querySelector(
            '[data-directory-intake]'
        );

    if (intakeStrip) {
        const actionButtons =
            intakeStrip.querySelectorAll(
                'button[data-create-intake-link]'
            );

        actionButtons.forEach(button => button.remove());

        const stateText =
            intakeStrip.querySelector(
                '.directory-intake-state span:last-child'
            );

        if (
            stateText &&
            /intake not sent/i.test(
                stateText.textContent ||
                ''
            )
        ) {
            stateText.textContent =
                'No Digital Intake on record';
        }
    }

    const legacyStrip =
        card.querySelector(
            '[data-directory-legacy]'
        );

    if (legacyStrip) {
        legacyStrip
            .querySelectorAll(
                '[data-upload-legacy-intake], [data-reassign-legacy-intake]'
            )
            .forEach(button => button.remove());

        const state =
            legacyStrip.querySelector(
                '.directory-legacy-state'
            );

        if (
            state &&
            /not uploaded/i.test(
                state.textContent ||
                ''
            )
        ) {
            state.innerHTML =
                '<span>📚 No Legacy Intake on record</span>';
        }
    }
}

function v1082ApplyPastResponse(response) {
    response = response || {};

    const grid =
        document.getElementById(
            'past-directory-grid'
        );

    if (!grid) return;

    const bookings =
        Array.isArray(
            response.bookings
        )
            ? response.bookings
            : [];

    const total =
        Number(
            response.totalPastStays ||
            bookings.length
        );

    const count =
        document.getElementById(
            'v1082PastStayCount'
        );

    if (count) {
        count.textContent =
            String(total);
    }

    if (!bookings.length) {
        grid.innerHTML = `
            <div class="v1082-past-empty">
                <span>🕘</span>
                <strong>No past stays yet</strong>
                <small>Completed boarding stays will appear here automatically.</small>
            </div>
        `;
        return;
    }

    grid.innerHTML =
        bookings
            .map(v1082PastCardHtml)
            .join('');

    (response.summaries || [])
        .forEach(summary => {
            if (!summary?.stayKey) return;

            directorySummaryRecordsCache[
                summary.stayKey
            ] = summary;

            directoryPhotoRecordsCache[
                summary.stayKey
            ] = summary;

            careRiskRecordsCache[
                summary.stayKey
            ] = summary;

            setDirectoryDogPhoto(
                summary.stayKey,
                summary
            );

            setDirectoryCareFlags(
                summary.stayKey,
                summary
            );

            renderDirectoryLazySummary(
                summary.stayKey,
                summary
            );

            reconcileDirectoryDigitalIntakeFromProfile(
                summary.stayKey,
                summary
            );
        });

    (response.digitalIntakes || [])
        .forEach(record => {
            if (!record?.stayKey) return;

            directoryIntakeStatusCache[
                record.stayKey
            ] = record;

            setDirectoryIntakeStatus(
                record.stayKey,
                record
            );
        });

    (response.legacyIntakes || [])
        .forEach(group => {
            if (!group?.stayKey) return;

            directoryLegacyIntakeCache[
                group.stayKey
            ] = group;

            setDirectoryLegacyIntakeStatus(
                group.stayKey,
                group
            );
        });

    grid
        .querySelectorAll(
            '.directory-card[data-v1082-past-stay="true"]'
        )
        .forEach(card => {
            if (
                typeof v108EnhanceCard ===
                'function'
            ) {
                v108EnhanceCard(card);
            }

            v1082ApplyPastReadOnly(card);
        });

    filterGuestDirectoryCards();
}

async function v1082LoadPastStays(options = {}) {
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
        !v1082PastLoaded
    ) {
        grid.innerHTML =
            v101SkeletonHtml(
                'directory',
                6
            );
    }

    v1082PastLoadPromise =
        (async () => {
            let cachedRendered = false;

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
                            'directory:past-stays',
                        maxStaleMs:
                            12 *
                            60 *
                            60 *
                            1000,
                        maxAttempts:
                            2,
                        timeoutMs:
                            45000,
                        onCached:
                            cached => {
                                cachedRendered = true;
                                v1082PastResponse = cached;
                                v1082ApplyPastResponse(cached);
                            }
                    }
                );

            if (
                !swr.unchanged ||
                !cachedRendered
            ) {
                v1082PastResponse =
                    swr.data;

                v1082ApplyPastResponse(
                    swr.data
                );
            }

            v1082PastLoaded = true;

            return v1082PastResponse;
        })();

    try {
        return await v1082PastLoadPromise;
    } finally {
        v1082PastLoadPromise = null;
    }
}

function v1082UpdateCurrentCount() {
    const count =
        document.getElementById(
            'v1082CurrentStayCount'
        );

    if (!count) return;

    const cards =
        document.querySelectorAll(
            '#directory-grid .directory-card[data-directory-stay-key]'
        );

    count.textContent =
        String(cards.length);
}

function v1082SwitchStayView(view, options = {}) {
    view =
        view === 'past'
            ? 'past'
            : 'current';

    v1082ActiveStayView = view;

    closeDirectoryGuestProfile({
        preserveScroll: true,
        instant: true
    });

    document
        .querySelectorAll(
            '[data-v1082-stay-tab]'
        )
        .forEach(button => {
            const active =
                button.dataset
                    .v1082StayTab ===
                view;

            button.classList.toggle(
                'is-active',
                active
            );

            button.setAttribute(
                'aria-selected',
                active
                    ? 'true'
                    : 'false'
            );
        });

    document
        .querySelectorAll(
            '[data-v1082-stay-panel]'
        )
        .forEach(panel => {
            const active =
                panel.dataset
                    .v1082StayPanel ===
                view;

            panel.hidden =
                !active;

            panel.classList.toggle(
                'is-active',
                active
            );
        });

    const search =
        document.getElementById(
            'guestDirectorySearch'
        );

    const note =
        document.querySelector(
            '.guest-directory-toolbar-note'
        );

    const legacyUpload =
        document.getElementById(
            'openLegacyIntakeUploadBtn'
        );

    const careSummary =
        document.getElementById(
            'directory-care-summary'
        );

    if (search) {
        search.placeholder =
            view === 'past'
                ? '🔍 Search past dog, breed, owner, date, intake or belongings...'
                : '🔍 Search dog, breed, owner, care, intake or belongings...';
    }

    if (note) {
        note.textContent =
            view === 'past'
                ? 'Past stays are read-only snapshots. Select a tile to open that stay.'
                : 'Tap a guest tile to open their full profile.';
    }

    if (legacyUpload) {
        legacyUpload.hidden =
            view === 'past';
    }

    if (careSummary) {
        careSummary.hidden =
            view === 'past';
    }

    filterGuestDirectoryCards();

    if (view === 'past') {
        v1082LoadPastStays({
            force:
                options.force === true
        }).catch(error => {
            const grid =
                document.getElementById(
                    'past-directory-grid'
                );

            if (grid) {
                grid.innerHTML = `
                    <div class="v1082-past-empty is-error">
                        <span>⚠️</span>
                        <strong>Past stays could not be loaded</strong>
                        <small>${v1082Escape(error?.message || String(error))}</small>
                    </div>
                `;
            }
        });
    }
}

function v1082HandlePastGridClick(event) {
    const grid =
        document.getElementById(
            'past-directory-grid'
        );

    if (!grid || !grid.contains(event.target)) {
        return;
    }

    const dogPhotoButton =
        event.target.closest(
            '[data-upload-dog-photo]'
        );

    if (dogPhotoButton) {
        event.preventDefault();
        event.stopPropagation();

        const card =
            dogPhotoButton.closest(
                '.belongings-pet-card'
            );

        if (card) {
            openHostedBelongingsPhotoUploader(
                card,
                'upload',
                'dogProfile'
            );
        }

        return;
    }

    const open =
        event.target.closest(
            '[data-open-directory-profile]'
        );

    if (open) {
        event.preventDefault();
        event.stopPropagation();

        const card =
            open.closest(
                '.directory-card'
            );

        openDirectoryGuestProfile(
            card
        )
            .then(() => {
                v1082ApplyPastReadOnly(card);
            })
            .catch(error =>
                console.error(error)
            );

        return;
    }

    const mainTab =
        event.target.closest(
            '[data-directory-main-tab]'
        );

    if (mainTab) {
        event.preventDefault();
        event.stopPropagation();

        const card =
            mainTab.closest(
                '.directory-card'
            );

        switchDirectoryProfileMainTab(
            card,
            mainTab.dataset
                .directoryMainTab
        );

        setTimeout(
            () =>
                v1082ApplyPastReadOnly(card),
            80
        );

        return;
    }

    const subTab =
        event.target.closest(
            '[data-profile-subtab]'
        );

    if (subTab) {
        event.preventDefault();
        event.stopPropagation();

        const card =
            subTab.closest(
                '.directory-card'
            );

        switchDirectoryProfileSubTab(
            card,
            subTab.dataset
                .profileSubtab
        );
    }
}

function v1082PastObserver() {
    const grid =
        document.getElementById(
            'past-directory-grid'
        );

    if (!grid) return;

    new MutationObserver(() => {
        grid
            .querySelectorAll(
                '.directory-card[data-v1082-past-stay="true"]'
            )
            .forEach(v1082ApplyPastReadOnly);
    }).observe(
        grid,
        {
            childList: true,
            subtree: true
        }
    );
}

/* Only CURRENT cards contribute to the active-care header count. */
refreshDirectoryCareSummary =
    function() {
        const summary =
            document.getElementById(
                'directory-care-summary'
            );

        if (!summary) return;

        const flaggedCards =
            Array.from(
                document.querySelectorAll(
                    '#directory-grid .directory-care-strip.has-alerts'
                )
            );

        const totalAlerts =
            flaggedCards.reduce(
                (total, container) =>
                    total +
                    container
                        .querySelectorAll(
                            '[data-directory-care-alert]'
                        )
                        .length,
                0
            );

        if (!totalAlerts) {
            summary.textContent =
                'No active care alerts';

            summary.classList.remove(
                'has-alerts'
            );

            return;
        }

        summary.textContent =
            `${totalAlerts} ${totalAlerts === 1 ? 'alert' : 'alerts'} · ` +
            `${flaggedCards.length} ${flaggedCards.length === 1 ? 'dog' : 'dogs'}`;

        summary.classList.add(
            'has-alerts'
        );
    };

async function v1082TryPastDeepLink() {
    if (WAFFLE_PAGE !== 'directory') {
        return;
    }

    const stayKey =
        String(
            new URLSearchParams(
                window.location.search
            ).get('stayKey') ||
            ''
        ).trim();

    if (!stayKey) return;

    await new Promise(resolve =>
        setTimeout(resolve, 1400)
    );

    let card =
        getDirectoryProfileCard(
            stayKey
        );

    if (card) {
        return;
    }

    v1082SwitchStayView(
        'past'
    );

    try {
        await v1082LoadPastStays();
    } catch (_) {
        return;
    }

    card =
        getDirectoryProfileCard(
            stayKey
        );

    if (!card) return;

    await openDirectoryGuestProfile(
        card,
        {
            instant: true
        }
    );

    v1082ApplyPastReadOnly(card);
}

function initialiseV1082CareStays() {
    if (WAFFLE_PAGE !== 'directory') {
        return;
    }

    document
        .querySelectorAll(
            '[data-v1082-stay-tab]'
        )
        .forEach(button => {
            button.addEventListener(
                'click',
                () =>
                    v1082SwitchStayView(
                        button.dataset
                            .v1082StayTab
                    )
            );
        });

    document.addEventListener(
        'click',
        v1082HandlePastGridClick,
        true
    );

    v1082PastObserver();

    const currentGrid =
        document.getElementById(
            'directory-grid'
        );

    if (currentGrid) {
        new MutationObserver(
            v1082UpdateCurrentCount
        ).observe(
            currentGrid,
            {
                childList: true,
                subtree: false
            }
        );
    }

    v1082UpdateCurrentCount();

    document
        .getElementById(
            'refreshGuestDirectoryBtn'
        )
        ?.addEventListener(
            'click',
            () => {
                if (
                    v1082ActiveStayView ===
                    'past'
                ) {
                    v1082PastLoaded = false;
                    removeWaffleCachedResponse(
                        'directory:past-stays'
                    ).catch(() => {});

                    setTimeout(
                        () =>
                            v1082LoadPastStays({
                                force: true
                            }),
                        180
                    );
                }
            }
        );

    setTimeout(
        v1082TryPastDeepLink,
        250
    );
}

document.addEventListener(
    'DOMContentLoaded',
    initialiseV1082CareStays
);
