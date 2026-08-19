
const WAFFLE_PAGE =
    (document.body && document.body.dataset && document.body.dataset.wafflePage) ||
    'calendar';

let directoryConsolidatedLoadInProgress = false;
let directoryConsolidatedLastFetch = 0;
let directoryBookingStateSignature = '';
let directorySelectedProfileStayKey = '';
let directorySummaryRecordsCache = {};
let directoryProfileDetailCache = {};
let directoryBelongingsDetailCache = {};



/* ============================================================
   V8.3 CLIENT CACHE + REQUEST MANAGER
   ============================================================ */

const WAFFLE_CACHE_DB_NAME =
    'waffle-house-v83';

const WAFFLE_CACHE_DB_VERSION =
    1;

const WAFFLE_CACHE_STORE =
    'responses';

const WAFFLE_CACHE_MAX_STALE_MS =
    6 * 60 * 60 * 1000;

const waffleInFlightRequests =
    new Map();

let waffleCacheDbPromise =
    null;


function openWaffleCacheDb() {
    if (!('indexedDB' in window)) {
        return Promise.resolve(null);
    }

    if (waffleCacheDbPromise) {
        return waffleCacheDbPromise;
    }

    waffleCacheDbPromise =
        new Promise((resolve, reject) => {
            const request =
                indexedDB.open(
                    WAFFLE_CACHE_DB_NAME,
                    WAFFLE_CACHE_DB_VERSION
                );

            request.onupgradeneeded =
                event => {
                    const db =
                        event.target.result;

                    if (
                        !db.objectStoreNames
                            .contains(
                                WAFFLE_CACHE_STORE
                            )
                    ) {
                        db.createObjectStore(
                            WAFFLE_CACHE_STORE,
                            {
                                keyPath:
                                    'key'
                            }
                        );
                    }
                };

            request.onsuccess =
                () =>
                    resolve(
                        request.result
                    );

            request.onerror =
                () =>
                    reject(
                        request.error
                    );
        })
        .catch(error => {
            console.warn(
                'IndexedDB cache unavailable:',
                error
            );

            return null;
        });

    return waffleCacheDbPromise;
}


async function getWaffleCachedResponse(
    key,
    maxStaleMs =
        WAFFLE_CACHE_MAX_STALE_MS
) {
    const db =
        await openWaffleCacheDb();

    if (!db) return null;

    return new Promise(resolve => {
        try {
            const transaction =
                db.transaction(
                    WAFFLE_CACHE_STORE,
                    'readwrite'
                );

            const store =
                transaction.objectStore(
                    WAFFLE_CACHE_STORE
                );

            const request =
                store.get(key);

            request.onsuccess =
                () => {
                    const entry =
                        request.result ||
                        null;

                    if (!entry) {
                        resolve(null);
                        return;
                    }

                    const age =
                        Date.now() -
                        Number(
                            entry.savedAt ||
                            0
                        );

                    if (
                        !entry.savedAt ||
                        age > maxStaleMs
                    ) {
                        try {
                            store.delete(key);
                        } catch (_) {}

                        resolve(null);
                        return;
                    }

                    resolve(entry);
                };

            request.onerror =
                () =>
                    resolve(null);

        } catch (_) {
            resolve(null);
        }
    });
}


async function putWaffleCachedResponse(
    key,
    payload
) {
    if (
        !payload ||
        typeof payload !==
            'object'
    ) {
        return;
    }

    const db =
        await openWaffleCacheDb();

    if (!db) return;

    const entry = {
        key,
        savedAt:
            Date.now(),
        version:
            String(
                payload.version ||
                ''
            ),
        variant:
            String(
                payload.variant ||
                ''
            ),
        payload
    };

    return new Promise(resolve => {
        try {
            const transaction =
                db.transaction(
                    WAFFLE_CACHE_STORE,
                    'readwrite'
                );

            const store =
                transaction.objectStore(
                    WAFFLE_CACHE_STORE
                );

            const request =
                store.put(entry);

            request.onsuccess =
                () =>
                    resolve(true);

            request.onerror =
                () =>
                    resolve(false);

        } catch (_) {
            resolve(false);
        }
    });
}


async function removeWaffleCachedResponse(key) {
    const db =
        await openWaffleCacheDb();

    if (!db) return;

    return new Promise(resolve => {
        try {
            const transaction =
                db.transaction(
                    WAFFLE_CACHE_STORE,
                    'readwrite'
                );

            const store =
                transaction.objectStore(
                    WAFFLE_CACHE_STORE
                );

            const request =
                store.delete(key);

            request.onsuccess =
                () =>
                    resolve(true);

            request.onerror =
                () =>
                    resolve(false);

        } catch (_) {
            resolve(false);
        }
    });
}


function waffleReadRequestKey(payload) {
    const action =
        String(
            payload?.action ||
            ''
        );

    const readActions =
        new Set([
            'get_data_versions',
            'get_audit_log',
            'get_guest_directory',
            'get_guest_profile',
            'get_guest_belongings',
            'get_reminders_notes',
            'get_intake_statuses',
            'get_legacy_intake_statuses',
            'get_intake_prefill',
            'get_belongings'
        ]);

    if (!readActions.has(action)) {
        return '';
    }

    const normalized = {
        action,
        stayKey:
            String(
                payload?.stayKey ||
                ''
            ),
        stayKeys:
            Array.isArray(
                payload?.stayKeys
            )
                ? [...payload.stayKeys]
                    .map(String)
                    .sort()
                : [],
        limit:
            Number(
                payload?.limit ||
                0
            ),
        knownVersion:
            String(
                payload?.knownVersion ||
                ''
            ),
        knownVariant:
            String(
                payload?.knownVariant ||
                ''
            )
    };

    return JSON.stringify(normalized);
}


async function queryAppsScriptSWR(
    payload,
    options = {}
) {
    const cacheKey =
        String(
            options.cacheKey ||
            ''
        );

    const maxStaleMs =
        Number(
            options.maxStaleMs ||
            WAFFLE_CACHE_MAX_STALE_MS
        );

    const cached =
        cacheKey
            ? await getWaffleCachedResponse(
                cacheKey,
                maxStaleMs
            )
            : null;

    let cacheApplied = false;

    if (
        cached?.payload &&
        typeof options.onCached ===
            'function'
    ) {
        try {
            await options.onCached(
                cached.payload,
                cached
            );

            cacheApplied = true;

        } catch (error) {
            console.warn(
                'Cached render skipped:',
                error
            );
        }
    }

    if (
        navigator.onLine === false &&
        cached?.payload
    ) {
        setWaffleConnectionStatus(
            'offline'
        );

        return {
            data:
                cached.payload,
            cacheApplied,
            unchanged:
                true,
            offlineFallback:
                true
        };
    }

    if (
        navigator.onLine === false &&
        !cached?.payload
    ) {
        throw new Error(
            'Offline and no saved data is available yet.'
        );
    }

    const requestPayload = {
        ...payload
    };

    if (
        cached?.version &&
        cached?.variant
    ) {
        requestPayload.knownVersion =
            cached.version;

        requestPayload.knownVariant =
            cached.variant;
    }

    try {
        const response =
            await queryAppsScript(
                requestPayload,
                options
            );

        if (
            response?.unchanged &&
            cached?.payload
        ) {
            await putWaffleCachedResponse(
                cacheKey,
                cached.payload
            );

            return {
                data:
                    cached.payload,
                cacheApplied,
                unchanged:
                    true,
                offlineFallback:
                    false
            };
        }

        if (
            cacheKey &&
            response &&
            response.result ===
                'success'
        ) {
            await putWaffleCachedResponse(
                cacheKey,
                response
            );
        }

        return {
            data:
                response,
            cacheApplied,
            unchanged:
                false,
            offlineFallback:
                false
        };

    } catch (error) {
        if (cached?.payload) {
            console.warn(
                'Network refresh failed; using cached Waffle data:',
                error
            );

            return {
                data:
                    cached.payload,
                cacheApplied,
                unchanged:
                    true,
                offlineFallback:
                    true,
                error
            };
        }

        throw error;
    }
}


async function invalidateWaffleClientCaches(scopes) {
    const wanted =
        new Set(
            Array.isArray(scopes)
                ? scopes
                : [scopes]
        );

    const keys = [];

    if (wanted.has('directory')) {
        keys.push(
            'directory:summary'
        );

        directoryConsolidatedLastFetch =
            0;
    }

    if (wanted.has('reminders')) {
        keys.push(
            'reminders:all'
        );
    }

    if (wanted.has('audit')) {
        keys.push(
            'audit:latest-500'
        );
    }

    await Promise.all(
        keys.map(
            key =>
                removeWaffleCachedResponse(key)
        )
    );
}




/* ============================================================
   V8.4 PWA / OFFLINE APP SHELL
   ============================================================ */

let waffleDeferredInstallPrompt = null;
let waffleActiveNetworkRequests = 0;

function isWaffleStandalone() {
    return (
        window.matchMedia &&
        window
            .matchMedia(
                '(display-mode: standalone)'
            )
            .matches
    ) ||
    window.navigator.standalone === true;
}


function isWaffleIosDevice() {
    const ua =
        navigator.userAgent ||
        '';

    return (
        /iphone|ipad|ipod/i.test(ua) ||
        (
            navigator.platform ===
                'MacIntel' &&
            navigator.maxTouchPoints > 1
        )
    );
}


function ensureWaffleConnectionStatus() {
    let status =
        document.getElementById(
            'waffleConnectionStatus'
        );

    if (status) return status;

    status =
        document.createElement(
            'div'
        );

    status.id =
        'waffleConnectionStatus';

    status.className =
        'waffle-connection-status';

    status.setAttribute(
        'role',
        'status'
    );

    status.setAttribute(
        'aria-live',
        'polite'
    );

    const header =
        document.querySelector(
            '.calendar-header-branding'
        );

    if (header) {
        header.appendChild(status);
    } else {
        document.body.appendChild(status);
    }

    return status;
}


function setWaffleConnectionStatus(
    mode,
    label
) {
    const status =
        ensureWaffleConnectionStatus();

    status.dataset.mode =
        mode || 'live';

    if (label) {
        status.textContent =
            label;
        return;
    }

    if (mode === 'offline') {
        status.textContent =
            '● Offline · saved data';
        return;
    }

    if (mode === 'updating') {
        status.textContent =
            '↻ Updating';
        return;
    }

    status.textContent =
        '● Live';
}


function beginWaffleNetworkActivity() {
    waffleActiveNetworkRequests++;

    if (navigator.onLine !== false) {
        setWaffleConnectionStatus(
            'updating'
        );
    }
}


function endWaffleNetworkActivity() {
    waffleActiveNetworkRequests =
        Math.max(
            0,
            waffleActiveNetworkRequests - 1
        );

    if (
        waffleActiveNetworkRequests === 0
    ) {
        setWaffleConnectionStatus(
            navigator.onLine === false
                ? 'offline'
                : 'live'
        );
    }
}


function ensureWaffleInstallButton() {
    if (isWaffleStandalone()) {
        return null;
    }

    let button =
        document.getElementById(
            'waffleInstallButton'
        );

    if (button) return button;

    button =
        document.createElement(
            'button'
        );

    button.id =
        'waffleInstallButton';

    button.type =
        'button';

    button.className =
        'waffle-install-button';

    button.innerHTML =
        '<span aria-hidden="true">⬇️</span><span>Install</span>';

    button.hidden =
        true;

    const header =
        document.querySelector(
            '.calendar-header-branding'
        );

    if (header) {
        const theme =
            document.getElementById(
                'themeToggle'
            );

        if (
            theme &&
            theme.parentNode === header
        ) {
            header.insertBefore(
                button,
                theme
            );
        } else {
            header.appendChild(button);
        }
    }

    return button;
}


function showWaffleIosInstallGuide() {
    let modal =
        document.getElementById(
            'waffleInstallGuide'
        );

    if (!modal) {
        modal =
            document.createElement(
                'div'
            );

        modal.id =
            'waffleInstallGuide';

        modal.className =
            'waffle-install-guide';

        modal.innerHTML = `
            <div
                class="waffle-install-guide-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="waffleInstallGuideTitle">
                <button
                    type="button"
                    class="waffle-install-guide-close"
                    aria-label="Close install instructions">
                    ×
                </button>

                <div class="waffle-install-guide-icon">🐾</div>

                <h3 id="waffleInstallGuideTitle">
                    Add Waffle House to your Home Screen
                </h3>

                <ol>
                    <li>Tap the browser <strong>Share</strong> button.</li>
                    <li>Choose <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong>.</li>
                </ol>

                <p>
                    It will open as a standalone Waffle House app after installation.
                </p>
            </div>
        `;

        document.body.appendChild(
            modal
        );

        modal
            .querySelector(
                '.waffle-install-guide-close'
            )
            ?.addEventListener(
                'click',
                () => {
                    modal.hidden =
                        true;
                }
            );

        modal.addEventListener(
            'click',
            event => {
                if (
                    event.target ===
                    modal
                ) {
                    modal.hidden =
                        true;
                }
            }
        );
    }

    modal.hidden = false;
}


async function handleWaffleInstallClick() {
    if (waffleDeferredInstallPrompt) {
        try {
            waffleDeferredInstallPrompt.prompt();

            await waffleDeferredInstallPrompt
                .userChoice;

        } catch (error) {
            console.warn(
                'Install prompt failed:',
                error
            );
        }

        waffleDeferredInstallPrompt =
            null;

        const button =
            document.getElementById(
                'waffleInstallButton'
            );

        if (button) {
            button.hidden =
                true;
        }

        return;
    }

    if (isWaffleIosDevice()) {
        showWaffleIosInstallGuide();
    }
}


function initialiseWafflePwaUi() {
    document.documentElement
        .classList
        .toggle(
            'waffle-standalone',
            isWaffleStandalone()
        );

    const installButton =
        ensureWaffleInstallButton();

    installButton
        ?.addEventListener(
            'click',
            handleWaffleInstallClick
        );

    /*
     * iOS Safari does not expose beforeinstallprompt.
     * Keep the install button available there so the user can
     * open the Add to Home Screen instructions.
     */
    if (
        installButton &&
        isWaffleIosDevice() &&
        !isWaffleStandalone()
    ) {
        installButton.hidden =
            false;
    }

    setWaffleConnectionStatus(
        navigator.onLine === false
            ? 'offline'
            : 'live'
    );
}


function registerWaffleServiceWorker() {
    if (
        !('serviceWorker' in navigator)
    ) {
        return;
    }

    window.addEventListener(
        'load',
        () => {
            navigator
                .serviceWorker
                .register(
                    './service-worker.js?v=8.4.1.1',
                    {
                        scope: './'
                    }
                )
                .then(registration => {
                    registration
                        .update()
                        .catch(() => {});
                })
                .catch(error => {
                    console.warn(
                        'Waffle service worker registration failed:',
                        error
                    );
                });
        }
    );
}


window.addEventListener(
    'beforeinstallprompt',
    event => {
        event.preventDefault();

        waffleDeferredInstallPrompt =
            event;

        const button =
            ensureWaffleInstallButton();

        if (button) {
            button.hidden =
                false;
        }
    }
);


window.addEventListener(
    'appinstalled',
    () => {
        waffleDeferredInstallPrompt =
            null;

        const button =
            document.getElementById(
                'waffleInstallButton'
            );

        if (button) {
            button.hidden =
                true;
        }

        document.documentElement
            .classList
            .add(
                'waffle-standalone'
            );
    }
);


window.addEventListener(
    'online',
    () => {
        setWaffleConnectionStatus(
            'live'
        );

        /*
         * Revalidate the active operational page after connectivity
         * returns. Existing per-page freshness/dedupe guards remain.
         */
        if (WAFFLE_PAGE === 'directory') {
            directoryConsolidatedLastFetch =
                0;

            loadGuestDirectoryConsolidated({
                quiet: true
            }).catch(() => {});
        } else if (
            WAFFLE_PAGE ===
            'reminders'
        ) {
            loadRemindersNotes()
                .catch(() => {});
        } else if (
            WAFFLE_PAGE ===
            'audit'
        ) {
            loadAuditLog()
                .catch(() => {});
        } else if (
            WAFFLE_PAGE ===
            'calendar'
        ) {
            syncSpreadsheetData()
                .catch(() => {});
        }
    }
);


window.addEventListener(
    'offline',
    () => {
        setWaffleConnectionStatus(
            'offline'
        );
    }
);


registerWaffleServiceWorker();


    const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT63UsPjcg3GB4lTB6cewLaTRS_yJP4kpOMSMsTTnvTw1Wbjn3CgtZc_c6li28ihjzkHnphFt0XcFTt/pub?gid=1639615540&single=true&output=csv';
    const APPS_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';

    let globalCalendar = null;
    let dailyCapacityCounts = {};
    let auditLogRecords = [];
    let remindersNotesRecords = [];
    let activeReminderNoteId = null;
    let directoryPhotoRecordsCache = {};
    let directoryIntakeStatusCache = {};
    let directoryIntakeStatusCacheLastFetch = 0;
    let directoryLegacyIntakeCache = {};
    let directoryLegacyIntakeCacheLastFetch = 0;
    let activeDirectoryEditContext = null; 
    let isUpdatingDropdowns = false; 
    let selectedClickDateStr = ""; 
    let activeEditingEvent = null; 
    let activeEditingPotentialId = null;
    let activeEditingPotential = null;
    let belongingsRecordsCache = {};
    let belongingsUploadInProgress = false;
    let belongingsCameraStream = null;
    let belongingsCameraCard = null;
    let hostedBelongingsPhotoContext = null;

    const BELONGINGS_ITEMS = [
        { key: 'waterBowls', label: 'Water Bowls', placeholder: 'e.g. 2 stainless steel bowls, one marked BLUE' },
        { key: 'foodBowls', label: 'Food Bowls', placeholder: 'e.g. 1 slow-feeder bowl, grey silicone' },
        { key: 'blankets', label: 'Blankets', placeholder: 'e.g. 2 fleece blankets, blue and white' },
        { key: 'beds', label: 'Beds', placeholder: 'e.g. Large round bed with grey cover' },
        { key: 'petCrates', label: 'Pet Crates', placeholder: 'e.g. Black folding crate, medium size' },
        { key: 'toys', label: 'Toys', placeholder: 'e.g. Red Kong, rope toy and tennis ball' },
        { key: 'leadsHarnesses', label: 'Leads / Harnesses', placeholder: 'e.g. Purple harness and black lead' },
        { key: 'medication', label: 'Medication', placeholder: 'e.g. Labelled container in zip-lock bag' },
        { key: 'other', label: 'Other', placeholder: 'Anything else the owner supplied' }
    ];


    const CARE_SAFETY_FLAGS = [
        { key: 'escapeRisk', label: 'Escape Risk', icon: '🚪', className: 'risk-escape' },
        { key: 'foodAllergy', label: 'Food Allergy', icon: '⚠️', className: 'risk-allergy' },
        { key: 'medicated', label: 'Medicated', icon: '💊', className: 'risk-medicated' },
        { key: 'separationAnxiety', label: 'Separation Anxiety', icon: '😟', className: 'risk-anxiety' },
        { key: 'weightManagement', label: 'Weight Management', icon: '⚖️', className: 'risk-weight' }
    ];


    const INTAKE_ATTRIBUTE_UI_GROUPS = [
        {
            title: 'Owner & Emergency',
            fields: [
                { key: 'emergencyContact', label: 'Emergency Contact' },
                { key: 'emergencyPhone', label: 'Emergency Phone' }
            ]
        },
        {
            title: 'Dog Information',
            fields: [
                { key: 'age', label: 'Age' },
                { key: 'weight', label: 'Weight' },
                { key: 'sex', label: 'Sex', type: 'sex' },
                { key: 'desexed', label: 'Desexed', type: 'yesno' },
                { key: 'vaccinated', label: 'Vaccinated', type: 'yesno' },
                { key: 'microchipped', label: 'Microchipped', type: 'yesno' },
                { key: 'weightManagement', label: 'Weight Management', type: 'yesno' }
            ]
        },
        {
            title: 'Behaviour & Personality',
            fields: [
                { key: 'friendlyDogs', label: 'Friendly with Dogs', type: 'yesno' },
                { key: 'friendlyCats', label: 'Friendly with Cats', type: 'yesno' },
                { key: 'friendlyChildren', label: 'Friendly with Children', type: 'yesno' },
                { key: 'friendlyStrangers', label: 'Friendly with Strangers', type: 'yesno' },
                { key: 'separationAnxiety', label: 'Separation Anxiety', type: 'yesno' },
                { key: 'aggression', label: 'Aggression', type: 'yesno' },
                { key: 'foodAggression', label: 'Food Aggression', type: 'yesno' },
                { key: 'escapeAttempts', label: 'Escape Attempts', type: 'yesno' },
                { key: 'indoorAccidents', label: 'Indoor Accidents', type: 'yesno' },
                { key: 'chewingFurniture', label: 'Chewing Furniture', type: 'yesno' },
                { key: 'triggersFears', label: 'Triggers or Fears', type: 'textarea', wide: true }
            ]
        },
        {
            title: 'Feeding',
            fields: [
                { key: 'foodBrandType', label: 'Food Brand / Type' },
                { key: 'feedingTimes', label: 'Feeding Times' },
                { key: 'foodAmount', label: 'Food Amount' },
                { key: 'allowedTreats', label: 'Allowed Treats', type: 'yesno' },
                { key: 'foodAllergies', label: 'Food Allergies', type: 'textarea', wide: true }
            ]
        },
        {
            title: 'Walking',
            fields: [
                { key: 'walksPerDay', label: 'Walks per Day' },
                { key: 'walkDuration', label: 'Walk Duration' },
                { key: 'offLeashAllowed', label: 'Off-Leash Allowed', type: 'yesno' },
                { key: 'pullsOnLeash', label: 'Pulls on Leash', type: 'yesno' }
            ]
        },
        {
            title: 'Medical',
            fields: [
                { key: 'medicalConditions', label: 'Medical Conditions', type: 'textarea', wide: true },
                { key: 'medicationInstructions', label: 'Medication Instructions', type: 'textarea', wide: true },
                { key: 'regularVetClinic', label: 'Regular Vet Clinic' },
                { key: 'vetPhone', label: 'Vet Phone' }
            ]
        },
        {
            title: 'Sleeping & Home Routine',
            fields: [
                { key: 'sleepLocation', label: 'Where Dog Sleeps', type: 'textarea', wide: true },
                { key: 'crateTrained', label: 'Crate Trained', type: 'yesno' },
                { key: 'canBeLeftAlone', label: 'Can Be Left Alone', type: 'yesno' },
                { key: 'aloneDuration', label: 'If Yes, How Long?', wide: true }
            ]
        }
    ];




    const DIRECTORY_PROFILE_SECONDARY_TABS = [
        {
            key: 'overview',
            label: 'Overview',
            icon: '🐶',
            groups: ['Owner & Emergency', 'Dog Information']
        },
        {
            key: 'behaviour',
            label: 'Behaviour',
            icon: '🧠',
            groups: ['Behaviour & Personality']
        },
        {
            key: 'foodWalks',
            label: 'Food & Walks',
            icon: '🥣',
            groups: ['Feeding', 'Walking']
        },
        {
            key: 'healthHome',
            label: 'Health & Home',
            icon: '🩺',
            groups: ['Medical', 'Sleeping & Home Routine']
        },
        {
            key: 'care',
            label: 'Care',
            icon: '🛡️',
            groups: []
        }
    ];

    let careRiskRecordsCache = {};

    function getLocalTodayDateString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000; 
        return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
    }

    let waffleLayoutResizeTimer = null;
    window.addEventListener('resize', function() {
        clearTimeout(waffleLayoutResizeTimer);
        waffleLayoutResizeTimer = setTimeout(function() {
            if (globalCalendar) {
                globalCalendar.updateSize();
            }
        }, 120);
    });

    window.addEventListener('pageshow', function(event) {
        console.log(
            '[Waffle House] pageshow',
            { persisted: !!event.persisted, time: new Date().toISOString() }
        );
    });

    window.addEventListener('beforeunload', function() {
        console.log('[Waffle House] browser page is unloading');
    });

    function initialiseMobileDashboardLayout() {
        const panel =
            document.getElementById(
                'calendarTabPanel'
            );

        if (panel) {
            panel.classList.remove(
                'mobile-dashboards-collapsed'
            );
        }
    }


    document.addEventListener('DOMContentLoaded', function() {
        initialiseWafflePwaUi();
        initialiseMobileDashboardLayout();

        const cachedData = localStorage.getItem('boardingDataCache');

        if (
            WAFFLE_PAGE === 'calendar' &&
            cachedData
        ) {
            parseCSVToEvents(cachedData);
        }

        const jumpYearSelect = document.getElementById('jumpYear');

        if (WAFFLE_PAGE === 'calendar') {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 2; y <= currentYear + 3; y++) {
            const opt = document.createElement('option'); opt.value = y; opt.innerText = y;
            if (y === currentYear) opt.selected = true;
            jumpYearSelect.appendChild(opt);
        }
        document.getElementById('jumpMonth').value = String(new Date().getMonth()).padStart(2, '0');

        const calendarEl = document.getElementById('calendar');
        globalCalendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            displayEventTime: false, 
            height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
            allDaySlot: true,
            selectable: true,
            
            datesSet: function(info) {
                applyCurrentSearchFilter();
                if (!isUpdatingDropdowns) {
                    const viewCurrentDate = globalCalendar.getDate();
                    document.getElementById('jumpMonth').value = String(viewCurrentDate.getMonth()).padStart(2, '0');
                    document.getElementById('jumpYear').value = viewCurrentDate.getFullYear();
                }
            },
            
            dateClick: function(info) {
                activeEditingEvent = null;
                selectedClickDateStr = info.dateStr;
                
                document.getElementById('modalTitle').innerText = "🤝 New Meet & Greet";
                document.getElementById('modalDogName').value = "";
                document.getElementById('modalBreed').value = "";
                document.getElementById('modalBookingTime').value = "10:00";
                document.getElementById('deleteModalBtn').style.display = "none";
                
                document.getElementById('customBookingModal').style.display = "flex";
                document.getElementById('modalDogName').focus();
            },
            
            eventClick: function(info) {
                if (info.event.extendedProps.isPotential) {
                    openEditPotentialModal(info.event);
                } else if (info.event.extendedProps.isMeetGreet) {
                    activeEditingEvent = info.event;
                    selectedClickDateStr = info.event.startStr;
                    
                    document.getElementById('modalTitle').innerText = "✏️ Edit Meet & Greet";
                    document.getElementById('modalDogName').value = info.event.extendedProps.dogName || "";
                    document.getElementById('modalBreed').value = info.event.extendedProps.breed === "N/A" ? "" : info.event.extendedProps.breed;
                    document.getElementById('modalBookingTime').value = info.event.extendedProps.time || "10:00";
                    document.getElementById('deleteModalBtn').style.display = "inline-block";
                    
                    document.getElementById('customBookingModal').style.display = "flex";
                } else {
                    routeToDatabaseCell(info.event.extendedProps.editLink, 'B', info.event.title);
                }
            },
            
            events: function(info, successCallback, failureCallback) {
                const csvText = localStorage.getItem('boardingDataCache') || "";
                const spreadsheetEvents = parseCSVToEvents(csvText);
                const localMeets = getLocalArray('temporaryMeetGreets');
                const localPotentials = getLocalArray('temporaryPotentialStays');
                const localConfirmed = getLocalArray('temporaryConfirmedStays');

                localPotentials.forEach(addLocalEventCapacity);
                localConfirmed.forEach(addLocalEventCapacity);

                const allCalendarEvents = spreadsheetEvents.concat(localMeets, localPotentials, localConfirmed);

                updateFullyBookedPanel();
                updateTodayMeetGreetPanel(allCalendarEvents);
                updateUpcomingSevenDaysPanel(allCalendarEvents);
                successCallback(allCalendarEvents);
            },

            dayCellDidMount: function(info) {
                const dateStr = info.date.toISOString().split('T')[0];
                const count = dailyCapacityCounts[dateStr] || 0;
                
                const oldIndicator = info.el.querySelector('.capacity-indicator');
                if (oldIndicator) oldIndicator.remove();

                let topContainer = info.el.querySelector('.fc-daygrid-day-top');
                if (topContainer) {
                    if (count === 3) {
                        info.el.style.backgroundColor = 'rgba(245, 158, 11, 0.08)'; 
                        topContainer.insertAdjacentHTML('afterbegin', '<span class="capacity-indicator" title="3 Dogs - Busy">🟡</span>');
                    } else if (count >= 4) {
                        info.el.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';  
                        topContainer.insertAdjacentHTML('afterbegin', '<span class="capacity-indicator" title="4+ Dogs - Full Capacity">🔴</span>');
                    }
                }
            }
        });

        globalCalendar.render();
        }


        if (WAFFLE_PAGE === 'calendar') {
            setTimeout(function() {
                if (globalCalendar) globalCalendar.refetchEvents();
            }, 100);

            // Calendar owns the live Google Sheet polling.
            setTimeout(function() {
                syncSpreadsheetData().catch(() => {});
            }, 300);

            setInterval(function() {
                syncSpreadsheetData().catch(() => {});
            }, 60000);
        }

        // Modal Controls
        document.getElementById('closeModalBtn').addEventListener('click', function() {
            document.getElementById('customBookingModal').style.display = "none";
        });
        document.getElementById('closePotentialModalBtn').addEventListener('click', function() {
            document.getElementById('potentialStayModal').style.display = "none";
        });

        document.getElementById('openPotentialBtn').addEventListener('click', function() {
            openNewPotentialModal();
        });

        // V8 uses four real HTML pages. Navigation is handled by
        // normal links, so there is no in-page tab switching here.

        document.getElementById('refreshGuestDirectoryBtn').addEventListener('click', async function() {
            if (belongingsUploadInProgress) {
                alert('A photo upload is currently in progress. Please wait for it to finish before refreshing.');
                return;
            }

            await loadGuestDirectoryConsolidated({
                button: this,
                force: true
            });
        });

        document.getElementById('refreshAuditBtn').addEventListener('click', function() {
            loadAuditLog({ button: this }).catch(error => console.error(error));
        });

        document.getElementById('addReminderNoteBtn').addEventListener('click', function() {
            openReminderComposer();
        });

        document.getElementById('refreshRemindersBtn').addEventListener('click', function() {
            loadRemindersNotes({ button: this }).catch(error => console.error(error));
        });

        document.getElementById('closeReminderComposerBtn').addEventListener('click', closeReminderComposer);
        document.getElementById('cancelReminderBtn').addEventListener('click', closeReminderComposer);
        document.getElementById('saveReminderBtn').addEventListener('click', saveReminderNote);
        document.getElementById('remindersStatusFilter').addEventListener('change', renderRemindersNotes);

        document.getElementById('remindersNotesGrid').addEventListener('click', function(event) {
            const button = event.target.closest('[data-reminder-action]');
            if (!button) return;

            const card = button.closest('[data-reminder-note-id]');
            const noteId = String(card?.dataset.reminderNoteId || '');
            if (!noteId) return;

            const action = String(button.dataset.reminderAction || '');
            const record = remindersNotesRecords.find(item =>
                String(item.noteId || '') === noteId
            );

            if (action === 'edit' && record) {
                openReminderComposer(record);
                return;
            }

            if (action === 'done') {
                setReminderDone(noteId, true);
                return;
            }

            if (action === 'reopen') {
                setReminderDone(noteId, false);
                return;
            }

            if (action === 'delete') {
                deleteReminderNote(noteId);
            }
        });

        document
            .getElementById('openLegacyIntakeUploadBtn')
            .addEventListener('click', function() {
                openLegacyIntakeUploader();
            });

        window.addEventListener('message', function(event) {
            const data =
                event && event.data
                    ? event.data
                    : null;

            if (
                !data ||
                data.type !==
                    'waffle-legacy-intake-updated'
            ) {
                return;
            }

            if (WAFFLE_PAGE === 'directory') {
                loadGuestDirectoryConsolidated({
                    force: true
                }).catch(error =>
                    console.error(error)
                );
            }
        });


        let directoryIntakeFocusRefreshTimer = null;

        function refreshDirectoryIntakesAfterReturn() {
            clearTimeout(
                directoryIntakeFocusRefreshTimer
            );

            directoryIntakeFocusRefreshTimer =
                setTimeout(() => {
                    if (
                        document.visibilityState ===
                        'hidden'
                    ) {
                        return;
                    }

                    if (WAFFLE_PAGE !== 'directory') {
                        return;
                    }

                    loadGuestDirectoryConsolidated()
                        .catch(error =>
                            console.error(error)
                        );
                }, 250);
        }

        window.addEventListener(
            'focus',
            refreshDirectoryIntakesAfterReturn
        );

        document.addEventListener(
            'visibilitychange',
            function() {
                if (
                    document.visibilityState ===
                    'visible'
                ) {
                    refreshDirectoryIntakesAfterReturn();
                }
            }
        );


        setInterval(() => {
            if (
                WAFFLE_PAGE !== 'directory' ||
                document.visibilityState !== 'visible'
            ) {
                return;
            }

            loadGuestDirectoryConsolidated({
                quiet: true
            }).catch(error =>
                console.error(error)
            );
        }, 60000);

        document.getElementById('auditSearch').addEventListener('input', renderAuditLog);
        document.getElementById('auditCategoryFilter').addEventListener('change', renderAuditLog);

        const directoryGrid = document.getElementById('directory-grid');

        document
            .getElementById(
                'directoryBackToGuestsBtn'
            )
            ?.addEventListener(
                'click',
                function() {
                    closeDirectoryGuestProfile();
                }
            );

        directoryGrid.addEventListener('click', async function(event) {
            const mainProfileTab =
                event.target.closest(
                    '[data-directory-main-tab]'
                );

            if (mainProfileTab) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    mainProfileTab.closest(
                        '.directory-card'
                    );

                switchDirectoryProfileMainTab(
                    card,
                    mainProfileTab.dataset.directoryMainTab
                );

                return;
            }

            const profileSubTab =
                event.target.closest(
                    '[data-profile-subtab]'
                );

            if (profileSubTab) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    profileSubTab.closest(
                        '.directory-card'
                    );

                switchDirectoryProfileSubTab(
                    card,
                    profileSubTab.dataset.profileSubtab
                );

                return;
            }

            const openProfileButton =
                event.target.closest(
                    '[data-open-directory-profile]'
                );

            if (openProfileButton) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    openProfileButton.closest(
                        '.directory-card'
                    );

                await openDirectoryGuestProfile(
                    card
                );

                return;
            }

            const retryDetailButton =
                event.target.closest(
                    '[data-retry-directory-detail]'
                );

            if (retryDetailButton) {
                event.preventDefault();
                event.stopPropagation();

                const details =
                    retryDetailButton.closest(
                        '[data-directory-detail]'
                    );

                if (details) {
                    details.dataset.detailLoaded =
                        'false';

                    await ensureDirectoryDetailLoaded(
                        details,
                        {
                            force: true
                        }
                    );
                }

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
                    await openHostedBelongingsPhotoUploader(
                        card,
                        'upload',
                        'dogProfile'
                    );
                }

                return;
            }

            const takePhotoButton =
                event.target.closest(
                    '[data-take-belongings-photo]'
                );

            if (takePhotoButton) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    takePhotoButton.closest(
                        '.belongings-pet-card'
                    );

                if (card) {
                    await openHostedBelongingsPhotoUploader(
                        card,
                        'camera'
                    );
                }

                return;
            }

            const uploadPhotoButton =
                event.target.closest(
                    '[data-upload-belongings-photo]'
                );

            if (uploadPhotoButton) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    uploadPhotoButton.closest(
                        '.belongings-pet-card'
                    );

                if (card) {
                    await openHostedBelongingsPhotoUploader(
                        card,
                        'upload'
                    );
                }

                return;
            }

            const saveBelongingsButton =
                event.target.closest(
                    '[data-save-belongings]'
                );

            if (saveBelongingsButton) {
                event.preventDefault();
                event.stopPropagation();

                await saveBelongingsCard(
                    saveBelongingsButton.closest(
                        '.belongings-pet-card'
                    ),
                    saveBelongingsButton
                );

                return;
            }

            const deletePhotoButton =
                event.target.closest(
                    '[data-delete-belongings-photo]'
                );

            if (deletePhotoButton) {
                event.preventDefault();
                event.stopPropagation();

                await deleteBelongingsPhoto(
                    deletePhotoButton.closest(
                        '.belongings-pet-card'
                    ),
                    deletePhotoButton
                );

                return;
            }

            const legacyReassignTrigger =
                event.target.closest(
                    '[data-reassign-legacy-intake]'
                );

            if (legacyReassignTrigger) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    legacyReassignTrigger.closest(
                        '.directory-card'
                    );

                openLegacyIntakeUploader(
                    String(
                        card?.dataset
                            .directoryStayKey ||
                        ''
                    ),
                    String(
                        legacyReassignTrigger.dataset
                            .legacyDocumentId ||
                        ''
                    )
                );

                return;
            }

            const legacyUploadTrigger =
                event.target.closest(
                    '[data-upload-legacy-intake]'
                );

            if (legacyUploadTrigger) {
                event.preventDefault();
                event.stopPropagation();

                const card =
                    legacyUploadTrigger.closest(
                        '.directory-card'
                    );

                openLegacyIntakeUploader(
                    String(
                        card?.dataset
                            .directoryStayKey ||
                        ''
                    )
                );

                return;
            }

            const intakeTrigger = event.target.closest(
                '[data-create-intake-link]'
            );

            if (intakeTrigger) {
                event.preventDefault();
                event.stopPropagation();

                const card = intakeTrigger.closest(
                    '.directory-card'
                );

                createOrCopyDirectoryIntakeLink(card)
                    .catch(error => {
                        console.error(error);
                        alert(
                            '❌ INTAKE LINK COULD NOT BE CREATED\n\n' +
                            error.message
                        );
                    });

                return;
            }

            const editTrigger = event.target.closest(
                '[data-directory-edit-field]'
            );

            if (!editTrigger) return;

            event.preventDefault();
            event.stopPropagation();
            openGuestDetailEditor(editTrigger);
        });

        document.getElementById('closeGuestDetailEditModal')
            .addEventListener('click', closeGuestDetailEditor);

        document.getElementById('cancelGuestDetailEdit')
            .addEventListener('click', closeGuestDetailEditor);

        document.getElementById('saveGuestDetailEdit')
            .addEventListener('click', function() {
                saveGuestDetailFromEditor()
                    .catch(error => console.error(error));
            });

        document.getElementById('guestDetailEditModal')
            .addEventListener('click', function(event) {
                if (event.target === this) {
                    closeGuestDetailEditor();
                }
            });

        document.addEventListener('keydown', function(event) {
            const modal = document.getElementById('guestDetailEditModal');

            if (
                event.key === 'Escape' &&
                modal &&
                modal.classList.contains('open')
            ) {
                closeGuestDetailEditor();
            }

            if (
                event.key === 'Enter' &&
                modal &&
                modal.classList.contains('open') &&
                activeDirectoryEditContext &&
                !DIRECTORY_EDIT_FIELD_CONFIG[
                    activeDirectoryEditContext.fieldKey
                ]?.multiline
            ) {
                event.preventDefault();
                saveGuestDetailFromEditor()
                    .catch(error => console.error(error));
            }
        });

        directoryGrid.addEventListener('change', async function(event) {
            if (event.target.matches('[data-belongings-photo-input]')) {
                event.preventDefault();
                event.stopPropagation();

                const input = event.target;
                const card =
                    input.closest(
                        '.belongings-pet-card'
                    );

                const files =
                    Array.from(
                        input.files ||
                        []
                    );

                if (!card || !files.length) {
                    input.value = '';
                    return;
                }

                try {
                    for (
                        let index = 0;
                        index < files.length;
                        index++
                    ) {
                        await uploadBelongingsPhoto(
                            card,
                            files[index]
                        );
                    }
                } finally {
                    input.value = '';
                }
            }
        });

        document.getElementById('belongingsCameraCancelBtn').addEventListener('click', function() {
            closeBelongingsCamera();
        });

        document.getElementById('closeHostedBelongingsPhotoUploader').addEventListener('click', function() {
            closeHostedBelongingsPhotoUploader();
        });

        document.getElementById('belongingsCameraCaptureBtn').addEventListener('click', async function() {
            await captureBelongingsCameraPhoto();
        });

        // Each section has its own page in V8; no active-tab state is restored.

        if (WAFFLE_PAGE === 'calendar') {
            document.getElementById('calendarSearch')
                .addEventListener(
                    'input',
                    applyCurrentSearchFilter
                );

            const jumpMonthSelect =
                document.getElementById('jumpMonth');

            function executeCalendarJump() {
                if (!globalCalendar) return;

                isUpdatingDropdowns = true;

                const targetDateStr =
                    jumpYearSelect.value +
                    '-' +
                    String(
                        Number(jumpMonthSelect.value) + 1
                    ).padStart(2, '0') +
                    '-02';

                globalCalendar.gotoDate(
                    targetDateStr
                );

                isUpdatingDropdowns = false;
            }

            jumpMonthSelect.addEventListener(
                'change',
                executeCalendarJump
            );

            jumpYearSelect.addEventListener(
                'change',
                executeCalendarJump
            );
        }

        if (WAFFLE_PAGE === 'directory') {
            document.getElementById('guestDirectorySearch')
                .addEventListener(
                    'input',
                    filterGuestDirectoryCards
                );
        }

        const themeToggleBtn = document.getElementById('themeToggle');
        const themeToggleIcon = themeToggleBtn.querySelector('.theme-toggle-icon');

        function syncThemeToggleUi() {
            const isDark = document.body.classList.contains('dark-theme');
            themeToggleIcon.textContent = isDark ? '☀️' : '🌙';
            themeToggleBtn.setAttribute(
                'aria-label',
                isDark
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
            );
            themeToggleBtn.title =
                isDark
                    ? 'Switch to light mode'
                    : 'Switch to dark mode';
        }

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
        }

        syncThemeToggleUi();

        themeToggleBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');

            localStorage.setItem(
                'theme',
                document.body.classList.contains('dark-theme')
                    ? 'dark'
                    : 'light'
            );

            syncThemeToggleUi();
        });

        if (WAFFLE_PAGE === 'calendar') {
            document.getElementById('manualRefreshBtn')
                .addEventListener(
                    'click',
                    function() {
                        syncSpreadsheetData({
                            button: this
                        }).catch(() => {});
                    }
                );
        }

        // Potential Stay Event Handlers
        document.getElementById('potentialIntakeLinkBtn')
            .addEventListener('click', function() {
                createOrCopyPotentialIntakeLink()
                    .catch(error => {
                        console.error(error);
                        alert(
                            '❌ INTAKE LINK COULD NOT BE CREATED\n\n' +
                            error.message
                        );
                    });
            });

        document.getElementById('savePotentialBtn').addEventListener('click', async function() {
            const button = this;
            const dogName = document.getElementById('potDogName').value.trim();
            const breed = document.getElementById('potBreed').value.trim();
            const startDate = document.getElementById('potStartDate').value;
            const endDate = document.getElementById('potEndDate').value;
            const ownerName = document.getElementById('potOwnerName').value.trim();
            const phone = document.getElementById('potPhone').value.trim();
            const notes = document.getElementById('potNotes').value.trim();

            if (!dogName || !breed || !startDate || !endDate || !ownerName || !phone) {
                alert("Please complete all required fields: Dog Name, Breed, Check-In Date, Check-Out Date, Owner Name and Contact Number.");
                return;
            }

            if (endDate < startDate) {
                alert("Check-Out Date cannot be earlier than Check-In Date.");
                return;
            }

            const isEditing = !!activeEditingPotential;
            const original = activeEditingPotential ? {
                dogName: activeEditingPotential.dogName,
                startDate: activeEditingPotential.rawStartDate,
                endDate: activeEditingPotential.rawEndDate
            } : null;

            const potId = (activeEditingPotentialId && !String(activeEditingPotentialId).startsWith('sheet_pot_'))
                ? activeEditingPotentialId
                : 'pot_' + Date.now();

            const payload = isEditing && original ? {
                action: "update_potential",
                originalDogName: original.dogName,
                originalStartDate: original.startDate,
                originalEndDate: original.endDate,
                dogName: dogName,
                breed: breed,
                startDate: startDate,
                endDate: endDate,
                ownerName: ownerName,
                phone: phone,
                notes: notes,
                bookingType: "Potential Stay"
            } : {
                action: "create_potential",
                id: potId,
                dogName: dogName,
                breed: breed,
                startDate: startDate,
                endDate: endDate,
                ownerName: ownerName,
                phone: phone,
                notes: notes,
                bookingType: "Potential Stay"
            };

            const originalText = button.innerText;
            button.disabled = true;
            button.innerText = isEditing ? "⏳ Updating..." : "⏳ Saving...";

            try {
                // The UI is only updated after Apps Script confirms that the
                // Google Sheet write actually succeeded.
                await sendPayloadToAppsScript(payload);

                if (isEditing && original) {
                    addPendingPotentialRemoval(
                        makePotentialKey(original.dogName, original.startDate, original.endDate)
                    );
                }

                let localPotentials = getLocalArray('temporaryPotentialStays');
                if (activeEditingPotentialId) {
                    localPotentials = localPotentials.filter(p => p.id !== activeEditingPotentialId);
                }

                localPotentials.push(
                    buildPotentialEvent(
                        potId,
                        dogName,
                        breed,
                        startDate,
                        endDate,
                        ownerName,
                        phone,
                        notes
                    )
                );
                setLocalArray('temporaryPotentialStays', localPotentials);

                document.getElementById('potentialStayModal').style.display = "none";
                refreshCalendarData();

                activeEditingPotential = null;
                activeEditingPotentialId = null;

            } catch (error) {
                console.error("Potential Stay save failed:", error);
                alert(
                    "❌ NOT SAVED TO GOOGLE SHEETS\n\n" +
                    error.message +
                    "\n\nThe booking has not been added locally, so another device will not see a false booking."
                );
            } finally {
                button.disabled = false;
                button.innerText = originalText;
            }
        });

        document.getElementById('confirmStayBtn').addEventListener('click', async function() {
            if (!activeEditingPotential) return;

            const button = this;
            const dogName = document.getElementById('potDogName').value.trim();
            const breed = document.getElementById('potBreed').value.trim();
            const startDate = document.getElementById('potStartDate').value;
            const endDate = document.getElementById('potEndDate').value;
            const ownerName = document.getElementById('potOwnerName').value.trim();
            const phone = document.getElementById('potPhone').value.trim();
            const notes = document.getElementById('potNotes').value.trim();

            if (!dogName || !breed || !startDate || !endDate || !ownerName || !phone) {
                alert("Please complete all required fields before confirming: Dog Name, Breed, Check-In Date, Check-Out Date, Owner Name and Contact Number.");
                return;
            }

            if (endDate < startDate) {
                alert("Check-Out Date cannot be earlier than Check-In Date.");
                return;
            }

            if (!confirm(`Confirm stay for ${dogName}? The Google Sheet Booking Type will change from "Potential Stay" to "Confirmed Boarding".`)) return;

            const original = {
                dogName: activeEditingPotential.dogName,
                startDate: activeEditingPotential.rawStartDate,
                endDate: activeEditingPotential.rawEndDate
            };

            const payload = {
                action: "confirm_potential",
                originalDogName: original.dogName,
                originalStartDate: original.startDate,
                originalEndDate: original.endDate,
                dogName: dogName,
                breed: breed,
                startDate: startDate,
                endDate: endDate,
                ownerName: ownerName,
                phone: phone,
                notes: notes,
                bookingType: "Confirmed Boarding"
            };

            const originalText = button.innerText;
            button.disabled = true;
            button.innerText = "⏳ Confirming...";

            try {
                // Do not remove the Potential Stay from the UI until the
                // database confirms the same row was changed successfully.
                await sendPayloadToAppsScript(payload);

                document.getElementById('potentialStayModal').style.display = "none";

                addPendingPotentialRemoval(
                    makePotentialKey(original.dogName, original.startDate, original.endDate)
                );

                let localPotentials = getLocalArray('temporaryPotentialStays');
                localPotentials = localPotentials.filter(p => p.id !== activeEditingPotentialId);
                setLocalArray('temporaryPotentialStays', localPotentials);

                let localConfirmed = getLocalArray('temporaryConfirmedStays');
                const confirmedKey = makePotentialKey(dogName, startDate, endDate);

                localConfirmed = localConfirmed.filter(item => {
                    const props = item.extendedProps || {};
                    const itemKey = makePotentialKey(
                        props.dogName || item.title || "",
                        props.rawStartDate || item.start || "",
                        props.rawEndDate || props.rawStartDate || item.start || ""
                    );
                    return itemKey !== confirmedKey;
                });

                localConfirmed.push(
                    buildConfirmedEvent(
                        'confirmed_' + Date.now(),
                        dogName,
                        breed,
                        startDate,
                        endDate,
                        ownerName,
                        phone,
                        notes
                    )
                );
                setLocalArray('temporaryConfirmedStays', localConfirmed);

                refreshCalendarData();

                activeEditingPotential = null;
                activeEditingPotentialId = null;

            } catch (error) {
                console.error("Potential Stay confirmation failed:", error);
                alert(
                    "❌ CONFIRMATION WAS NOT SAVED\n\n" +
                    error.message +
                    "\n\nThe Potential Stay has been left unchanged so the UI stays consistent with Google Sheets."
                );
            } finally {
                button.disabled = false;
                button.innerText = originalText;
            }
        });

        document.getElementById('deletePotentialBtn').addEventListener('click', async function() {
            if (!activeEditingPotential) return;

            const button = this;
            const dogName = activeEditingPotential.dogName || document.getElementById('potDogName').value.trim();
            if (!confirm(`Delete potential booking request for ${dogName}?`)) return;

            const original = {
                dogName: activeEditingPotential.dogName,
                startDate: activeEditingPotential.rawStartDate,
                endDate: activeEditingPotential.rawEndDate
            };

            const payload = {
                action: "delete_potential",
                originalDogName: original.dogName,
                originalStartDate: original.startDate,
                originalEndDate: original.endDate,
                dogName: original.dogName
            };

            const originalText = button.innerText;
            button.disabled = true;
            button.innerText = "⏳ Deleting...";

            try {
                await sendPayloadToAppsScript(payload);

                document.getElementById('potentialStayModal').style.display = "none";

                addPendingPotentialRemoval(
                    makePotentialKey(original.dogName, original.startDate, original.endDate)
                );

                let localPotentials = getLocalArray('temporaryPotentialStays');
                localPotentials = localPotentials.filter(p => p.id !== activeEditingPotentialId);
                setLocalArray('temporaryPotentialStays', localPotentials);

                refreshCalendarData();

                activeEditingPotential = null;
                activeEditingPotentialId = null;

            } catch (error) {
                console.error("Potential Stay deletion failed:", error);
                alert(
                    "❌ DELETE WAS NOT SAVED\n\n" +
                    error.message +
                    "\n\nThe Potential Stay has been left in place."
                );
            } finally {
                button.disabled = false;
                button.innerText = originalText;
            }
        });

        document.getElementById('saveModalBtn').addEventListener('click', function() {
            const dogName = document.getElementById('modalDogName').value.trim();
            const bookingTime = document.getElementById('modalBookingTime').value.trim();
            const breed = document.getElementById('modalBreed').value.trim() || "N/A";
            
            if (!dogName) {
                alert("Please enter a dog name.");
                return;
            }
            
            document.getElementById('customBookingModal').style.display = "none";
            const displayTitle = `⏰ ${bookingTime} - Meet & Greet: ${dogName}`;
            let localMeets = JSON.parse(localStorage.getItem('temporaryMeetGreets') || '[]');
            
            if (activeEditingEvent) {
                const originalProps = activeEditingEvent.extendedProps;
                localMeets = localMeets.map(meet => {
                    if (meet.start === selectedClickDateStr && meet.extendedProps.dogName === originalProps.dogName) {
                        meet.title = displayTitle;
                        meet.extendedProps.dogName = dogName;
                        meet.extendedProps.breed = breed;
                        meet.extendedProps.time = bookingTime;
                        meet.extendedProps.notes = `Meet & Greet scheduled at ${bookingTime}`;
                    }
                    return meet;
                });
                localStorage.setItem('temporaryMeetGreets', JSON.stringify(localMeets));
                refreshCalendarData();

                sendPayloadToAppsScript({
                    action: "update", originalDogName: originalProps.dogName, originalStartDate: selectedClickDateStr,
                    dogName: dogName, breed: breed, notes: `Meet & Greet scheduled at ${bookingTime}`
                });
            } else {
                const newMeet = {
                    id: 'meet_' + Date.now(), title: displayTitle, start: selectedClickDateStr, end: selectedClickDateStr, allDay: true, backgroundColor: '#0f766e', textColor: '#ffffff',
                    extendedProps: { isMeetGreet: true, breed: breed, time: bookingTime, dogName: dogName, owner: "Temporary Booking", phone: "N/A", notes: `Meet & Greet scheduled at ${bookingTime}`, editLink: "" }
                };
                localMeets.push(newMeet);
                localStorage.setItem('temporaryMeetGreets', JSON.stringify(localMeets));
                refreshCalendarData();

                sendPayloadToAppsScript({
                    action: "create", dogName: dogName, breed: breed, startDate: selectedClickDateStr, endDate: selectedClickDateStr, notes: `Meet & Greet scheduled at ${bookingTime}`
                });
            }
        });

        document.getElementById('deleteModalBtn').addEventListener('click', function() {
            if (!activeEditingEvent) return;
            const originalProps = activeEditingEvent.extendedProps;
            if (!confirm(`Are you sure you want to permanently delete the Meet & Greet for ${originalProps.dogName}?`)) return;

            document.getElementById('customBookingModal').style.display = "none";
            let localMeets = JSON.parse(localStorage.getItem('temporaryMeetGreets') || '[]');
            localMeets = localMeets.filter(meet => !(meet.start === selectedClickDateStr && meet.extendedProps.dogName === originalProps.dogName));
            localStorage.setItem('temporaryMeetGreets', JSON.stringify(localMeets));
            refreshCalendarData();

            sendPayloadToAppsScript({
                action: "delete", originalDogName: originalProps.dogName, originalStartDate: selectedClickDateStr
            });
        });

        if (WAFFLE_PAGE === 'directory') {
            loadGuestDirectoryConsolidated()
                .catch(error =>
                    console.error(error)
                );
        }

        if (WAFFLE_PAGE === 'reminders') {
            loadRemindersNotes()
                .catch(error =>
                    console.error(error)
                );
        }

        if (WAFFLE_PAGE === 'audit') {
            loadAuditLog()
                .catch(error =>
                    console.error(error)
                );
        }
    });

    function openNewPotentialModal() {
        activeEditingPotentialId = null;
        activeEditingPotential = null;

        document.getElementById('potentialModalTitle').innerText = "❓ Add Potential Stay Request";
        document.getElementById('potDogName').value = "";
        document.getElementById('potBreed').value = "";
        document.getElementById('potStartDate').value = getLocalTodayDateString();
        document.getElementById('potEndDate').value = getLocalTodayDateString();
        document.getElementById('potOwnerName').value = "";
        document.getElementById('potPhone').value = "";
        document.getElementById('potNotes').value = "";

        document.getElementById('deletePotentialBtn').style.display = "none";
        document.getElementById('confirmStayBtn').style.display = "none";
        document.getElementById('potentialIntakeLinkBtn').style.display = "none";
        document.getElementById('savePotentialBtn').innerText = "Submit Potential";

        document.getElementById('potentialStayModal').style.display = "flex";
        document.getElementById('potDogName').focus();
    }

    function openEditPotentialModal(event) {
        activeEditingPotentialId = event.id;
        const props = event.extendedProps;

        activeEditingPotential = {
            id: event.id,
            dogName: props.dogName || "",
            breed: props.breed || "N/A",
            rawStartDate: props.rawStartDate || event.startStr,
            rawEndDate: props.rawEndDate || props.rawStartDate || event.startStr,
            ownerName: props.owner || props.ownerName || "",
            phone: props.phone || "",
            notes: props.notes || ""
        };

        document.getElementById('potentialModalTitle').innerText = "❓ Manage Potential Stay";
        document.getElementById('potDogName').value = activeEditingPotential.dogName;
        document.getElementById('potBreed').value = activeEditingPotential.breed === "N/A" ? "" : activeEditingPotential.breed;
        document.getElementById('potStartDate').value = activeEditingPotential.rawStartDate;
        document.getElementById('potEndDate').value = activeEditingPotential.rawEndDate;
        document.getElementById('potOwnerName').value = activeEditingPotential.ownerName;
        document.getElementById('potPhone').value = activeEditingPotential.phone;
        document.getElementById('potNotes').value = activeEditingPotential.notes;

        document.getElementById('deletePotentialBtn').style.display = "inline-block";
        document.getElementById('confirmStayBtn').style.display = "inline-block";
        document.getElementById('potentialIntakeLinkBtn').style.display = "inline-block";
        document.getElementById('savePotentialBtn').innerText = "Update Details";

        document.getElementById('potentialStayModal').style.display = "flex";
    }

    function getLocalArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn(`Unable to read ${key} from localStorage.`, error);
            return [];
        }
    }

    function setLocalArray(key, value) {
        localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
    }

    function makePotentialKey(dogName, startDate, endDate) {
        return [
            String(dogName || "").trim().toLowerCase(),
            String(startDate || "").trim(),
            String(endDate || startDate || "").trim()
        ].join('|');
    }

    function getPendingPotentialRemovals() {
        return getLocalArray('pendingPotentialRemovals');
    }

    function addPendingPotentialRemoval(key) {
        if (!key) return;
        const pending = getPendingPotentialRemovals();
        if (!pending.includes(key)) {
            pending.push(key);
            setLocalArray('pendingPotentialRemovals', pending);
        }
    }

    function buildDisplayEndDate(endDate) {
        const parts = String(endDate || "").split('-');
        if (parts.length !== 3) return endDate;

        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        dateObj.setDate(dateObj.getDate() + 1);

        return dateObj.getFullYear() + '-' +
            String(dateObj.getMonth() + 1).padStart(2, '0') + '-' +
            String(dateObj.getDate()).padStart(2, '0');
    }

    function buildPotentialEvent(id, dogName, breed, startDate, endDate, ownerName, phone, notes) {
        return {
            id: id,
            title: `❓ Potential: ${dogName}`,
            start: startDate,
            end: buildDisplayEndDate(endDate),
            allDay: true,
            classNames: ['fc-event-potential'],
            extendedProps: {
                isPotential: true,
                isMeetGreet: false,
                dogName: dogName,
                breed: breed,
                owner: ownerName,
                ownerName: ownerName,
                phone: phone,
                rawStartDate: startDate,
                rawEndDate: endDate,
                notes: notes,
                bookingType: "Potential Stay",
                editLink: ""
            }
        };
    }

    function buildConfirmedEvent(id, dogName, breed, startDate, endDate, ownerName, phone, notes) {
        return {
            id: id,
            title: dogName,
            start: startDate,
            end: buildDisplayEndDate(endDate),
            allDay: true,
            backgroundColor: stringToColor(dogName),
            textColor: '#ffffff',
            extendedProps: {
                isPotential: false,
                isMeetGreet: false,
                dogName: dogName,
                breed: breed,
                owner: ownerName,
                ownerName: ownerName,
                phone: phone,
                notes: notes || "Confirmed from Potential Stay",
                rawStartDate: startDate,
                rawEndDate: endDate,
                bookingType: "Confirmed Boarding",
                editLink: ""
            }
        };
    }

    function countDogsInName(name) {
        const text = String(name || "");
        if (text.includes('&') || text.toLowerCase().includes(' and ')) {
            return text.split(/&|\s+and\s+/i).map(s => s.trim()).filter(Boolean).length || 1;
        }
        return 1;
    }

    function addLocalEventCapacity(event) {
        if (!event) return;

        const props = event.extendedProps || {};
        const name = props.dogName || event.title || "";
        const dogCount = countDogsInName(name);

        const startDate = props.rawStartDate || event.start;
        const endDate = props.rawEndDate || startDate;
        if (!startDate) return;

        const start = new Date(String(startDate).split('T')[0] + 'T00:00:00');
        const end = new Date(String(endDate).split('T')[0] + 'T00:00:00');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

        const cursor = new Date(start.getTime());
        while (cursor <= end) {
            const dateStr = cursor.getFullYear() + '-' +
                String(cursor.getMonth() + 1).padStart(2, '0') + '-' +
                String(cursor.getDate()).padStart(2, '0');
            dailyCapacityCounts[dateStr] = (dailyCapacityCounts[dateStr] || 0) + dogCount;
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    function parseCsvDate(value) {
        const text = String(value || "").replace(/^"|"$/g, '').trim();
        if (!text) return "";

        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

        const slashParts = text.split('/');
        if (slashParts.length === 3) {
            return slashParts[2] + '-' + slashParts[1].padStart(2, '0') + '-' + slashParts[0].padStart(2, '0');
        }

        return text;
    }

    function getCsvBookingRecords(csvText) {
        if (!csvText) return [];

        const lines = csvText.split(/\r?\n/);
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const columns = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            const dogName = columns[1] ? columns[1].replace(/^"|"$/g, '').trim() : '';
            const startDate = parseCsvDate(columns[3]);
            const endDate = parseCsvDate(columns[4]) || startDate;
            const bookingType = columns[11] ? columns[11].replace(/^"|"$/g, '').trim() : '';

            if (dogName && startDate) {
                records.push({
                    dogName,
                    startDate,
                    endDate,
                    bookingType,
                    key: makePotentialKey(dogName, startDate, endDate)
                });
            }
        }

        return records;
    }

    function reconcileTemporaryEvents(csvText) {
        const records = getCsvBookingRecords(csvText);

        const sheetPotentialKeys = new Set(
            records
                .filter(r => r.bookingType.toLowerCase() === 'potential stay')
                .map(r => r.key)
        );

        const sheetBoardingKeys = new Set(
            records
                .filter(r => {
                    const type = r.bookingType.toLowerCase();
                    return type === 'boarding' || type === 'confirmed boarding';
                })
                .map(r => r.key)
        );

        const meetKeys = new Set(
            records
                .filter(r => r.bookingType.toLowerCase() === 'meet & greet')
                .map(r => r.dogName.trim().toLowerCase() + '|' + r.startDate)
        );

        const localPotentials = getLocalArray('temporaryPotentialStays').filter(event => {
            const props = event.extendedProps || {};
            const key = makePotentialKey(
                props.dogName,
                props.rawStartDate || event.start,
                props.rawEndDate || props.rawStartDate || event.start
            );
            return !sheetPotentialKeys.has(key);
        });
        setLocalArray('temporaryPotentialStays', localPotentials);

        const localConfirmed = getLocalArray('temporaryConfirmedStays').filter(event => {
            const props = event.extendedProps || {};
            const key = makePotentialKey(
                props.dogName || event.title,
                props.rawStartDate || event.start,
                props.rawEndDate || props.rawStartDate || event.start
            );
            return !sheetBoardingKeys.has(key);
        });
        setLocalArray('temporaryConfirmedStays', localConfirmed);

        const localMeets = getLocalArray('temporaryMeetGreets').filter(event => {
            const props = event.extendedProps || {};
            const key = String(props.dogName || "").trim().toLowerCase() + '|' + parseCsvDate(event.start);
            return !meetKeys.has(key);
        });
        setLocalArray('temporaryMeetGreets', localMeets);

        const stillPending = getPendingPotentialRemovals().filter(key => sheetPotentialKeys.has(key));
        setLocalArray('pendingPotentialRemovals', stillPending);
    }

    function fetchSpreadsheetCsv() {
        const separator = SHEET_CSV_URL.includes('?') ? '&' : '?';
        const cacheBustedUrl = SHEET_CSV_URL + separator + '_ts=' + Date.now();

        return fetch(cacheBustedUrl, { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error("HTTP Error: " + response.status);
                return response.text();
            })
            .then(csvText => {
                if (!csvText || csvText.trim().length < 20 || !csvText.includes(',')) {
                    throw new Error("Corrupted spreadsheet payload.");
                }
                return csvText;
            });
    }

    function syncSpreadsheetData(options = {}) {
        const btn = options.button || null;
        const backupCache = localStorage.getItem('boardingDataCache');

        if (btn) {
            btn.innerText = "⏳ Syncing...";
            btn.style.background = "#7f8c8d";
            btn.disabled = true;
        }

        return fetchSpreadsheetCsv()
            .then(csvText => {
                localStorage.setItem('boardingDataCache', csvText);
                reconcileTemporaryEvents(csvText);
                directoryPhotoRecordsCache = {};
                directoryIntakeStatusCache = {};
                directoryLegacyIntakeCache = {};
                refreshCalendarData();
                loadCareRiskDashboard(csvText).catch(() => {});

                if (btn) {
                    btn.innerText = "✅ Synced!";
                    btn.style.background = "#2ecc71";
                    setTimeout(() => {
                        btn.innerText = "🔄 Sync Spreadsheet";
                        btn.style.background = "#3498db";
                        btn.disabled = false;
                    }, 2000);
                }

                return csvText;
            })
            .catch(error => {
                console.error(error);

                if (backupCache) {
                    localStorage.setItem('boardingDataCache', backupCache);
                    refreshCalendarData();
                }

                if (btn) {
                    alert("⚠️ SYNC FAILED\n\nReason: " + error.message);
                    btn.innerText = "❌ Failed";
                    btn.style.background = "#e74c3c";
                    setTimeout(() => {
                        btn.innerText = "🔄 Sync Spreadsheet";
                        btn.style.background = "#3498db";
                        btn.disabled = false;
                    }, 3000);
                }

                throw error;
            });
    }

    function scheduleSpreadsheetSync() {
        [1500, 4000, 10000].forEach(delay => {
            setTimeout(() => {
                syncSpreadsheetData().catch(() => {});
            }, delay);
        });
    }

    /**
     * Reliable cross-origin Apps Script call.
     *
     * The previous version used fetch(..., mode: 'no-cors'). That returns an
     * opaque response, so the page cannot tell whether Apps Script saved the
     * row or returned an error. This JSONP call receives the real backend
     * success/error response before the UI is changed.
     */
    function sendPayloadToAppsScript(payload) {
        return new Promise((resolve, reject) => {
            if (!APPS_SCRIPT_WEBAPP_URL || APPS_SCRIPT_WEBAPP_URL.includes('YOUR_APPS_SCRIPT_WEBAPP_URL_HERE')) {
                reject(new Error("Apps Script Web App URL is not configured."));
                return;
            }

            const callbackName = '__waffleAppsScript_' +
                Date.now() + '_' + Math.random().toString(36).slice(2);

            const script = document.createElement('script');
            let finished = false;

            const cleanup = () => {
                if (finished) return;
                finished = true;
                clearTimeout(timeoutId);
                try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
                if (script.parentNode) script.parentNode.removeChild(script);
            };

            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(
                    "Apps Script did not respond. Check that the Web App is deployed as 'Execute as: Me' and 'Who has access: Anyone', then confirm the /exec URL in index.html is the current deployment URL."
                ));
            }, 15000);

            window[callbackName] = response => {
                cleanup();

                if (response && response.result === 'success') {
                    console.log(`Apps Script action (${payload.action}) saved successfully.`, response);

                    // Boarding/calendar actions still need the published CSV to refresh.
                    // Belongings actions use their own shared Pet_Belongings sheet and
                    // should NOT trigger delayed calendar syncs, because those syncs
                    // rebuild the belongings DOM while a photo upload is still running.
                    const belongingsOnlyActions = new Set([
                        'save_belongings',
                        'delete_belongings_photo'
                    ]);

                    if (!belongingsOnlyActions.has(String(payload.action || ''))) {
                        scheduleSpreadsheetSync();
                    }

                    resolve(response);
                } else {
                    reject(new Error(
                        response && response.error
                            ? response.error
                            : "Apps Script returned an unknown error."
                    ));
                }
            };

            script.onerror = () => {
                cleanup();
                reject(new Error(
                    "Could not reach the Apps Script Web App. Check the deployment URL and Web App access permissions."
                ));
            };

            const separator = APPS_SCRIPT_WEBAPP_URL.includes('?') ? '&' : '?';
            script.src =
                APPS_SCRIPT_WEBAPP_URL +
                separator +
                'callback=' + encodeURIComponent(callbackName) +
                '&payload=' + encodeURIComponent(JSON.stringify(payload)) +
                '&_ts=' + Date.now();

            document.body.appendChild(script);
        });
    }

    function formatReminderTimestamp(value) {
        if (!value) return '';

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value);
        }

        return date.toLocaleString(
            'en-AU',
            {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }
        );
    }

    function formatReminderDate(dateStr) {
        if (!dateStr) return '';

        const date =
            new Date(
                dateStr +
                'T00:00:00'
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return dateStr;
        }

        return date.toLocaleDateString(
            'en-AU',
            {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }
        );
    }

    function formatReminderTime(timeStr) {
        const text =
            String(timeStr || '')
                .trim();

        if (
            !/^\d{1,2}:\d{2}$/
                .test(text)
        ) {
            return text;
        }

        const [hours, minutes] =
            text.split(':')
                .map(Number);

        const date =
            new Date();

        date.setHours(
            hours,
            minutes,
            0,
            0
        );

        return date.toLocaleTimeString(
            'en-AU',
            {
                hour: 'numeric',
                minute: '2-digit'
            }
        );
    }

    function getReminderState(record) {
        if (
            String(
                record.status || ''
            ).toLowerCase() ===
                'done'
        ) {
            return {
                key: 'done',
                label: 'Done'
            };
        }

        if (!record.reminderDate) {
            return {
                key: 'note',
                label: 'Note'
            };
        }

        const today =
            getLocalTodayDateString();

        if (
            record.reminderDate <
            today
        ) {
            return {
                key: 'overdue',
                label: 'Overdue'
            };
        }

        if (
            record.reminderDate ===
            today
        ) {
            if (
                record.reminderTime &&
                /^\d{1,2}:\d{2}$/.test(
                    String(
                        record.reminderTime
                    )
                )
            ) {
                const now =
                    new Date();

                const [hours, minutes] =
                    String(
                        record.reminderTime
                    )
                        .split(':')
                        .map(Number);

                const due =
                    new Date();

                due.setHours(
                    hours,
                    minutes,
                    0,
                    0
                );

                if (
                    due.getTime() <
                    now.getTime()
                ) {
                    return {
                        key: 'overdue',
                        label: 'Overdue'
                    };
                }
            }

            return {
                key: 'today',
                label: 'Today'
            };
        }

        return {
            key: 'upcoming',
            label: 'Upcoming'
        };
    }

    function getReminderScheduleText(record) {
        if (!record.reminderDate) {
            return '🗒️ General note';
        }

        const dateText =
            formatReminderDate(
                record.reminderDate
            );

        const timeText =
            record.reminderTime
                ? formatReminderTime(
                    record.reminderTime
                )
                : '';

        return (
            '⏰ ' +
            dateText +
            (
                timeText
                    ? ' · ' +
                      timeText
                    : ''
            )
        );
    }

    function renderRemindersNotes() {
        const grid =
            document.getElementById(
                'remindersNotesGrid'
            );

        const countEl =
            document.getElementById(
                'remindersResultCount'
            );

        if (
            !grid ||
            !countEl
        ) {
            return;
        }

        const filter =
            document.getElementById(
                'remindersStatusFilter'
            )?.value ||
            'open';

        const filtered =
            remindersNotesRecords
                .filter(record => {
                    const isDone =
                        String(
                            record.status || ''
                        ).toLowerCase() ===
                            'done';

                    if (
                        filter ===
                        'open'
                    ) {
                        return !isDone;
                    }

                    if (
                        filter ===
                        'done'
                    ) {
                        return isDone;
                    }

                    return true;
                });

        countEl.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? 'note'
                    : 'notes'
            }`;

        if (!filtered.length) {
            grid.innerHTML =
                filter === 'done'
                    ? '<div class="reminders-empty">No completed reminders yet.</div>'
                    : '<div class="reminders-empty">No open reminders or notes. Use “Add Sticky Note” to leave something for the team.</div>';

            return;
        }

        grid.innerHTML =
            filtered
                .map(record => {
                    const state =
                        getReminderState(
                            record
                        );

                    const dog =
                        String(
                            record.dogName ||
                            ''
                        ).trim();

                    const author =
                        String(
                            record.author ||
                            'Team member'
                        ).trim();

                    const schedule =
                        getReminderScheduleText(
                            record
                        );

                    const created =
                        formatReminderTimestamp(
                            record.createdAt
                        );

                    const completed =
                        record.completedAt
                            ? formatReminderTimestamp(
                                record.completedAt
                            )
                            : '';

                    const isDone =
                        state.key ===
                        'done';

                    return `
                        <article
                            class="reminder-sticky state-${escapeDashboardHtml(state.key)}"
                            data-reminder-note-id="${escapeDashboardHtml(record.noteId || '')}">
                            <div class="reminder-sticky-top">
                                <div class="reminder-sticky-dog">
                                    ${dog
                                        ? `🐾 ${escapeDashboardHtml(dog)}`
                                        : '📌 Team note'}
                                </div>
                                <span class="reminder-state-chip">
                                    ${escapeDashboardHtml(state.label)}
                                </span>
                            </div>

                            <div class="reminder-sticky-schedule">
                                ${escapeDashboardHtml(schedule)}
                            </div>

                            <div class="reminder-sticky-text">${escapeDashboardHtml(record.note || '')}</div>

                            <div class="reminder-sticky-footer">
                                <div class="reminder-sticky-author">
                                    By ${escapeDashboardHtml(author)}
                                    ${created
                                        ? `<br>${escapeDashboardHtml(created)}`
                                        : ''}
                                    ${completed
                                        ? `<br>Completed ${escapeDashboardHtml(completed)}`
                                        : ''}
                                </div>

                                <div class="reminder-sticky-actions">
                                    ${!isDone
                                        ? `
                                            <button
                                                type="button"
                                                class="reminder-icon-btn"
                                                data-reminder-action="edit"
                                                title="Edit note"
                                                aria-label="Edit note">✏️</button>

                                            <button
                                                type="button"
                                                class="reminder-icon-btn"
                                                data-reminder-action="done"
                                                title="Mark complete"
                                                aria-label="Mark complete">✓</button>
                                          `
                                        : `
                                            <button
                                                type="button"
                                                class="reminder-icon-btn"
                                                data-reminder-action="reopen"
                                                title="Reopen reminder"
                                                aria-label="Reopen reminder">↺</button>
                                          `
                                    }

                                    <button
                                        type="button"
                                        class="reminder-icon-btn"
                                        data-reminder-action="delete"
                                        title="Delete note"
                                        aria-label="Delete note">🗑️</button>
                                </div>
                            </div>
                        </article>
                    `;
                })
                .join('');
    }

    async function loadRemindersNotes(options = {}) {
        const button =
            options.button ||
            null;

        const grid =
            document.getElementById(
                'remindersNotesGrid'
            );

        if (button) {
            button.disabled = true;
            button.textContent =
                '⏳ Refreshing...';
        }

        if (
            grid &&
            !remindersNotesRecords.length
        ) {
            grid.innerHTML =
                '<div class="reminders-empty">⏳ Loading shared reminders and notes...</div>';
        }

        const applyResponse =
            response => {
                remindersNotesRecords =
                    Array.isArray(
                        response.records
                    )
                        ? response.records
                        : [];

                renderRemindersNotes();
            };

        try {
            let cachedRendered = false;

            const swr =
                await queryAppsScriptSWR(
                    {
                        action:
                            'get_reminders_notes',
                        limit: 500
                    },
                    {
                        cacheKey:
                            'reminders:all',
                        maxAttempts: 2,
                        timeoutMs: 45000,
                        maxStaleMs:
                            6 * 60 * 60 * 1000,
                        onCached:
                            cachedResponse => {
                                cachedRendered =
                                    true;

                                applyResponse(
                                    cachedResponse
                                );
                            }
                    }
                );

            if (
                !swr.unchanged ||
                !cachedRendered
            ) {
                applyResponse(swr.data);
            }

        } catch (error) {
            console.error(
                'Reminders & Notes load failed:',
                error
            );

            if (
                grid &&
                !remindersNotesRecords.length
            ) {
                grid.innerHTML =
                    `<div class="reminders-error">⚠️ Reminders &amp; Notes could not be loaded.<br>${escapeDashboardHtml(error.message || String(error))}</div>`;
            }

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent =
                    '🔄 Refresh';
            }
        }
    }


    function openReminderComposer(record = null) {
        const composer =
            document.getElementById(
                'reminderComposer'
            );

        activeReminderNoteId =
            record
                ? String(
                    record.noteId ||
                    ''
                )
                : null;

        document.getElementById(
            'reminderComposerTitle'
        ).textContent =
            record
                ? 'Edit Sticky Note'
                : 'Add Sticky Note';

        document.getElementById(
            'reminderDogName'
        ).value =
            record
                ? String(
                    record.dogName ||
                    ''
                )
                : '';

        document.getElementById(
            'reminderDate'
        ).value =
            record
                ? String(
                    record.reminderDate ||
                    ''
                )
                : '';

        document.getElementById(
            'reminderTime'
        ).value =
            record
                ? String(
                    record.reminderTime ||
                    ''
                )
                : '';

        document.getElementById(
            'reminderText'
        ).value =
            record
                ? String(
                    record.note ||
                    ''
                )
                : '';

        const savedAuthor =
            localStorage.getItem(
                'waffleReminderAuthor'
            ) || '';

        document.getElementById(
            'reminderAuthor'
        ).value =
            record
                ? String(
                    record.author ||
                    savedAuthor
                )
                : savedAuthor;

        const status =
            document.getElementById(
                'reminderComposerStatus'
            );

        status.textContent = '';
        status.className =
            'reminder-composer-status';

        document.getElementById(
            'saveReminderBtn'
        ).textContent =
            record
                ? '💾 Save Changes'
                : '📌 Save Sticky Note';

        composer.hidden = false;

        setTimeout(() => {
            document.getElementById(
                'reminderText'
            ).focus();

            composer.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 0);
    }

    function closeReminderComposer() {
        activeReminderNoteId = null;

        document.getElementById(
            'reminderComposer'
        ).hidden = true;

        document.getElementById(
            'reminderComposerStatus'
        ).textContent = '';
    }

    async function saveReminderNote() {
        const note =
            String(
                document.getElementById(
                    'reminderText'
                ).value ||
                ''
            ).trim();

        const author =
            String(
                document.getElementById(
                    'reminderAuthor'
                ).value ||
                ''
            ).trim();

        const dogName =
            String(
                document.getElementById(
                    'reminderDogName'
                ).value ||
                ''
            ).trim();

        const reminderDate =
            String(
                document.getElementById(
                    'reminderDate'
                ).value ||
                ''
            ).trim();

        const reminderTime =
            String(
                document.getElementById(
                    'reminderTime'
                ).value ||
                ''
            ).trim();

        const status =
            document.getElementById(
                'reminderComposerStatus'
            );

        if (!note) {
            status.textContent =
                'Please enter the reminder or note.';
            status.className =
                'reminder-composer-status error';

            document.getElementById(
                'reminderText'
            ).focus();

            return;
        }

        if (
            reminderTime &&
            !reminderDate
        ) {
            status.textContent =
                'Choose a reminder date when adding an expected time.';
            status.className =
                'reminder-composer-status error';

            document.getElementById(
                'reminderDate'
            ).focus();

            return;
        }

        const button =
            document.getElementById(
                'saveReminderBtn'
            );

        button.disabled = true;
        button.textContent =
            '⏳ Saving...';

        status.textContent =
            'Saving shared note...';
        status.className =
            'reminder-composer-status';

        try {
            if (author) {
                localStorage.setItem(
                    'waffleReminderAuthor',
                    author
                );
            }

            await queryAppsScript(
                {
                    action:
                        'save_reminder_note',
                    noteId:
                        activeReminderNoteId ||
                        '',
                    note,
                    dogName,
                    reminderDate,
                    reminderTime,
                    author
                },
                {
                    maxAttempts: 2,
                    timeoutMs: 45000
                }
            );

            closeReminderComposer();

            await invalidateWaffleClientCaches(['reminders', 'audit']);
            await loadRemindersNotes();

        } catch (error) {
            console.error(
                'Reminder save failed:',
                error
            );

            status.textContent =
                error.message ||
                String(error);

            status.className =
                'reminder-composer-status error';

        } finally {
            button.disabled = false;
            button.textContent =
                activeReminderNoteId
                    ? '💾 Save Changes'
                    : '📌 Save Sticky Note';
        }
    }

    async function setReminderDone(
        noteId,
        isDone
    ) {
        try {
            await queryAppsScript(
                {
                    action:
                        'set_reminder_note_done',
                    noteId,
                    isDone:
                        isDone === true
                },
                {
                    maxAttempts: 2,
                    timeoutMs: 45000
                }
            );

            await invalidateWaffleClientCaches(['reminders', 'audit']);
            await loadRemindersNotes();

        } catch (error) {
            console.error(
                'Reminder status update failed:',
                error
            );

            alert(
                'The reminder could not be updated.\n\n' +
                (
                    error.message ||
                    String(error)
                )
            );
        }
    }

    async function deleteReminderNote(noteId) {
        if (
            !confirm(
                'Delete this shared sticky note? This cannot be undone.'
            )
        ) {
            return;
        }

        try {
            await queryAppsScript(
                {
                    action:
                        'delete_reminder_note',
                    noteId
                },
                {
                    maxAttempts: 2,
                    timeoutMs: 45000
                }
            );

            await invalidateWaffleClientCaches(['reminders', 'audit']);
            await loadRemindersNotes();

        } catch (error) {
            console.error(
                'Reminder delete failed:',
                error
            );

            alert(
                'The reminder could not be deleted.\n\n' +
                (
                    error.message ||
                    String(error)
                )
            );
        }
    }


    function switchAppTab(tabName) {
        if (tabName === 'calendar' || tabName === 'directory' || tabName === 'reminders' || tabName === 'audit') {
            localStorage.setItem('waffleActiveTab', tabName);
        }

        document.querySelectorAll('[data-app-tab]').forEach(button => {
            const active = button.dataset.appTab === tabName;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('[data-app-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.appPanel === tabName);
        });

        if (tabName === 'calendar' && globalCalendar) {
            setTimeout(() => globalCalendar.updateSize(), 0);
        }

        if (
            tabName === 'directory' &&
            WAFFLE_PAGE === 'directory' &&
            !belongingsUploadInProgress
        ) {
            setTimeout(() => {
                loadGuestDirectoryConsolidated({
                    quiet: true
                }).catch(error =>
                    console.error(error)
                );
            }, 0);
        }

        if (tabName === 'reminders') {
            loadRemindersNotes()
                .catch(error => console.error(error));
        }

        if (tabName === 'audit') {
            loadAuditLog().catch(error => console.error(error));
        }
    }

    function auditCategoryIcon(category, action) {
        const text = `${category || ''} ${action || ''}`.toLowerCase();

        if (text.includes('reminder') || text.includes('sticky') || text.includes('note')) return '📌';
        if (text.includes('photo')) return '📷';
        if (text.includes('intake')) return '📝';
        if (text.includes('meet')) return '🤝';
        if (text.includes('potential')) return '❓';
        if (text.includes('belong')) return '🧳';
        if (text.includes('detail')) return '✏️';
        if (text.includes('system')) return '⚙️';
        return '🐾';
    }

    function formatAuditTimestamp(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value || '');

        return date.toLocaleString('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function parseAuditObject(value) {
        const text =
            String(value || '').trim();

        if (!text) return null;

        try {
            const parsed = JSON.parse(text);

            return (
                parsed &&
                typeof parsed === 'object'
            )
                ? parsed
                : null;

        } catch (_) {
            return null;
        }
    }

    function auditDisplayLabel(key) {
        const labels = {
            dogName: 'Dog Name',
            breed: 'Breed',
            startDate: 'Start Date',
            endDate: 'End Date',
            ownerName: 'Owner',
            phone: 'Contact Number',
            likes: 'Likes',
            dislikes: 'Dislikes',
            notes: 'Notes',
            editLink: 'Edit Link',
            bookingType: 'Booking Type',
            stayKey: 'Stay',
            escapeRisk: 'Escape Risk',
            foodAllergy: 'Food Allergy',
            medicated: 'Medicated',
            separationAnxiety: 'Separation Anxiety',
            weightManagement: 'Weight Management',
            present: 'Present',
            description: 'Description',
            photoCount: 'Photo Count',
            dogPhoto: 'Dog Photo',
            reminderDate: 'Reminder Date',
            reminderTime: 'Reminder Time',
            note: 'Reminder / Note',
            author: 'Added By',
            status: 'Status',
            completedAt: 'Completed At'
        };

        if (labels[key]) return labels[key];

        return String(key || '')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, letter =>
                letter.toUpperCase()
            );
    }

    function formatAuditValue(value) {
        if (value === true) return 'Yes';
        if (value === false) return 'No';

        if (
            value === null ||
            value === undefined ||
            value === ''
        ) {
            return 'blank';
        }

        if (Array.isArray(value)) {
            return value.length
                ? value
                    .map(item =>
                        formatAuditValue(item)
                    )
                    .join(', ')
                : 'none';
        }

        if (
            typeof value === 'object'
        ) {
            const summary =
                Object.entries(value)
                    .filter(([, nested]) =>
                        nested !== null &&
                        nested !== undefined &&
                        nested !== ''
                    )
                    .slice(0, 5)
                    .map(([key, nested]) =>
                        auditDisplayLabel(key) +
                        ': ' +
                        formatAuditValue(nested)
                    );

            return summary.length
                ? summary.join('; ')
                : 'none';
        }

        const text = String(value).trim();

        if (
            /^\d{4}-\d{2}-\d{2}$/.test(text)
        ) {
            const date =
                new Date(text + 'T00:00:00');

            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {
                return date.toLocaleDateString(
                    'en-AU',
                    {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    }
                );
            }
        }

        return text;
    }

    function flattenAuditObject(
        object,
        prefix = '',
        output = {}
    ) {
        if (
            !object ||
            typeof object !== 'object'
        ) {
            return output;
        }

        Object.entries(object)
            .forEach(([key, value]) => {
                const path =
                    prefix
                        ? `${prefix}.${key}`
                        : key;

                if (
                    value &&
                    typeof value === 'object' &&
                    !Array.isArray(value)
                ) {
                    flattenAuditObject(
                        value,
                        path,
                        output
                    );
                    return;
                }

                output[path] = value;
            });

        return output;
    }

    function auditPathLabel(path) {
        const parts =
            String(path || '').split('.');

        if (
            parts[0] === 'items' &&
            parts.length >= 3
        ) {
            const itemLabels = {
                waterBowls: 'Water Bowls',
                foodBowls: 'Food Bowls',
                blankets: 'Blankets',
                beds: 'Beds',
                petCrates: 'Pet Crates',
                toys: 'Toys',
                leadsHarnesses: 'Leads / Harnesses',
                medication: 'Medication',
                other: 'Other Belongings'
            };

            const item =
                itemLabels[parts[1]] ||
                auditDisplayLabel(parts[1]);

            return parts[2] === 'present'
                ? item
                : (
                    item +
                    ' ' +
                    auditDisplayLabel(parts[2])
                );
        }

        if (
            ['riskFlags', 'booking', 'directory', 'care']
                .includes(parts[0]) &&
            parts[1]
        ) {
            return auditDisplayLabel(parts[1]);
        }

        return auditDisplayLabel(
            parts[parts.length - 1]
        );
    }

    function buildReadableAuditChanges(record) {
        const before =
            parseAuditObject(record.beforeJson) || {};

        const after =
            parseAuditObject(record.afterJson) || {};

        const beforeFlat =
            flattenAuditObject(before);

        const afterFlat =
            flattenAuditObject(after);

        const keys =
            Array.from(
                new Set([
                    ...Object.keys(beforeFlat),
                    ...Object.keys(afterFlat)
                ])
            );

        const lines = [];

        keys.forEach(path => {
            if (
                /(^|\.)(stayKey|photoIds|pdfFileId|documentId|noteId|editLink)$/i
                    .test(path)
            ) {
                return;
            }

            const oldValue = beforeFlat[path];
            const newValue = afterFlat[path];

            if (
                JSON.stringify(oldValue ?? '') ===
                JSON.stringify(newValue ?? '')
            ) {
                return;
            }

            const label =
                auditPathLabel(path);

            if (oldValue === undefined) {
                lines.push(
                    `<strong>${escapeDashboardHtml(label)}</strong> set to ${escapeDashboardHtml(formatAuditValue(newValue))}.`
                );
                return;
            }

            if (newValue === undefined) {
                lines.push(
                    `<strong>${escapeDashboardHtml(label)}</strong> removed (was ${escapeDashboardHtml(formatAuditValue(oldValue))}).`
                );
                return;
            }

            lines.push(
                `<strong>${escapeDashboardHtml(label)}</strong> changed from ${escapeDashboardHtml(formatAuditValue(oldValue))} to ${escapeDashboardHtml(formatAuditValue(newValue))}.`
            );
        });

        if (
            !lines.length &&
            Object.keys(afterFlat).length
        ) {
            Object.entries(afterFlat)
                .filter(([path, value]) =>
                    value !== '' &&
                    value !== null &&
                    value !== undefined &&
                    !/(^|\.)(stayKey|photoIds|noteId|editLink)$/i
                        .test(path)
                )
                .slice(0, 8)
                .forEach(([path, value]) => {
                    lines.push(
                        `<strong>${escapeDashboardHtml(auditPathLabel(path))}</strong>: ${escapeDashboardHtml(formatAuditValue(value))}.`
                    );
                });
        }

        if (
            !lines.length &&
            Object.keys(beforeFlat).length
        ) {
            Object.entries(beforeFlat)
                .filter(([path, value]) =>
                    value !== '' &&
                    value !== null &&
                    value !== undefined &&
                    !/(^|\.)(stayKey|photoIds|noteId|editLink)$/i
                        .test(path)
                )
                .slice(0, 8)
                .forEach(([path, value]) => {
                    lines.push(
                        `<strong>${escapeDashboardHtml(auditPathLabel(path))}</strong> was ${escapeDashboardHtml(formatAuditValue(value))}.`
                    );
                });
        }

        return lines.slice(0, 12);
    }

    function getAuditMeetGreetSchedule(record) {
        if (
            String(record.category || '')
                .toLowerCase() !==
                'meet & greet'
        ) {
            return '';
        }

        const before =
            parseAuditObject(record.beforeJson);

        const after =
            parseAuditObject(record.afterJson);

        const snapshot =
            after || before || {};

        const dateValue =
            snapshot.startDate || '';

        const notes =
            String(snapshot.notes || '');

        const timeMatch =
            notes.match(/(\d{1,2}:\d{2})/);

        const dateText =
            dateValue
                ? formatAuditValue(dateValue)
                : '';

        const timeText =
            timeMatch
                ? timeMatch[1]
                : '';

        if (
            dateText &&
            timeText
        ) {
            return `${dateText} at ${timeText}`;
        }

        return dateText || timeText;
    }

    function getReadableAuditSummary(record) {
        const base =
            String(record.summary || '').trim();

        const schedule =
            getAuditMeetGreetSchedule(record);

        if (!schedule) return base;

        if (
            base.toLowerCase()
                .includes(
                    schedule.toLowerCase()
                )
        ) {
            return base;
        }

        return (
            base.replace(/\.$/, '') +
            ' — ' +
            schedule +
            '.'
        );
    }

    function renderAuditLog() {
        const container = document.getElementById('auditLogContainer');
        const countEl = document.getElementById('auditResultCount');
        if (!container || !countEl) return;

        const search = (document.getElementById('auditSearch')?.value || '')
            .toLowerCase()
            .trim();
        const category = document.getElementById('auditCategoryFilter')?.value || '';

        const filtered = auditLogRecords.filter(record => {
            if (category && record.category !== category) return false;
            if (!search) return true;

            const haystack = [
                record.category,
                record.action,
                record.dogName,
                record.bookingType,
                record.reference,
                record.summary,
                record.changedFields,
                record.source,
                record.actor
            ].join(' ').toLowerCase();

            return haystack.includes(search);
        });

        countEl.textContent =
            `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`;

        if (!filtered.length) {
            container.innerHTML =
                '<div class="audit-empty">No audit activity matches this filter.</div>';
            return;
        }

        container.innerHTML = filtered.map(record => {
            const readableChanges =
                buildReadableAuditChanges(record);

            const icon =
                auditCategoryIcon(
                    record.category,
                    record.action
                );

            const actorText =
                record.actor &&
                record.actor !==
                    'Web App / Unavailable'
                    ? ` · ${escapeDashboardHtml(record.actor)}`
                    : '';

            const readableSummary =
                getReadableAuditSummary(record);

            return `
                <article class="audit-entry">
                    <div class="audit-entry-icon" aria-hidden="true">${icon}</div>
                    <div class="audit-entry-body">
                        <div class="audit-entry-topline">
                            <div class="audit-entry-title">
                                <strong>${escapeDashboardHtml(record.action || 'Activity')}</strong>
                                <span class="audit-category-chip audit-category-${String(record.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
                                    ${escapeDashboardHtml(record.category || 'Activity')}
                                </span>
                            </div>
                            <time>${escapeDashboardHtml(formatAuditTimestamp(record.timestamp))}</time>
                        </div>

                        <div class="audit-entry-summary">
                            ${escapeDashboardHtml(readableSummary)}
                        </div>

                        <div class="audit-entry-meta">
                            ${record.dogName ? `<span>🐾 ${escapeDashboardHtml(record.dogName)}</span>` : ''}
                            ${record.changedFields ? `<span>✏️ ${escapeDashboardHtml(record.changedFields)}</span>` : ''}
                            ${record.source ? `<span>📍 ${escapeDashboardHtml(record.source)}${actorText}</span>` : ''}
                        </div>

                        ${readableChanges.length ? `
                            <div class="audit-readable-changes">
                                ${readableChanges
                                    .map(change =>
                                        `<div class="audit-readable-change">${change}</div>`
                                    )
                                    .join('')}
                            </div>
                        ` : ''}
                    </div>
                </article>
            `;
        }).join('');
    }

    async function loadAuditLog(options = {}) {
        const button =
            options.button ||
            null;

        const container =
            document.getElementById(
                'auditLogContainer'
            );

        if (button) {
            button.disabled = true;
            button.textContent =
                '⏳ Refreshing...';
        }

        if (
            container &&
            !auditLogRecords.length
        ) {
            container.innerHTML =
                '<div class="audit-empty">⏳ Loading recent audit activity...</div>';
        }

        const applyResponse =
            response => {
                auditLogRecords =
                    Array.isArray(
                        response.records
                    )
                        ? response.records
                        : [];

                renderAuditLog();
            };

        try {
            let cachedRendered = false;

            const swr =
                await queryAppsScriptSWR(
                    {
                        action:
                            'get_audit_log',
                        limit: 500
                    },
                    {
                        cacheKey:
                            'audit:latest-500',
                        maxAttempts: 2,
                        timeoutMs: 45000,
                        maxStaleMs:
                            4 * 60 * 60 * 1000,
                        onCached:
                            cachedResponse => {
                                cachedRendered =
                                    true;

                                applyResponse(
                                    cachedResponse
                                );
                            }
                    }
                );

            if (
                !swr.unchanged ||
                !cachedRendered
            ) {
                applyResponse(swr.data);
            }

        } catch (error) {
            console.error(
                'Audit log load failed:',
                error
            );

            if (
                container &&
                !auditLogRecords.length
            ) {
                container.innerHTML =
                    `<div class="audit-error">⚠️ Audit log could not be loaded.<br>${escapeDashboardHtml(error.message || String(error))}</div>`;
            }

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent =
                    '🔄 Refresh Log';
            }
        }
    }


    function getCurrentBoardingStays(csvText) {
        if (!csvText) return [];

        const lines = csvText.split(/\r?\n/);
        const todayStr = getLocalTodayDateString();
        const today = new Date(todayStr + 'T00:00:00');
        const pickedUpDogs = getLocalArray('pickedUpDogs_' + todayStr);
        const stays = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const columns = lines[i].split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/);
            const dogName = columns[1] ? columns[1].replace(/^\"|\"$/g, '').trim() : '';
            const breed = columns[2] ? columns[2].replace(/^\"|\"$/g, '').trim() : '';
            const startDate = parseCsvDate(columns[3]);
            const endDate = parseCsvDate(columns[4]) || startDate;
            const ownerName = columns[5] ? columns[5].replace(/^\"|\"$/g, '').trim() : '';
            const phone = columns[6] ? columns[6].replace(/^\"|\"$/g, '').trim() : '';
            const bookingType = columns[11] ? columns[11].replace(/^\"|\"$/g, '').trim().toLowerCase() : '';

            if (!dogName || !startDate || !endDate) continue;
            if (bookingType === 'meet & greet' || bookingType === 'potential stay') continue;

            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
            if (today < start || today > end) continue;

            const pickupKey = dogName + '_' + startDate + '_' + endDate;
            if (pickedUpDogs.includes(pickupKey)) continue;

            stays.push({
                stayKey: makePotentialKey(dogName, startDate, endDate),
                dogName,
                breed: breed || 'Unknown',
                ownerName: ownerName || 'N/A',
                phone: phone || 'N/A',
                startDate,
                endDate,
                bookingType: bookingType || 'boarding'
            });
        }

        return stays.sort((a, b) => a.dogName.localeCompare(b.dogName));
    }

    function queryAppsScriptRaw(payload, options = {}) {
        const maxAttempts = Number(options.maxAttempts || 2);
        const timeoutMs = Number(options.timeoutMs || 45000);

        return new Promise((resolve, reject) => {
            if (!APPS_SCRIPT_WEBAPP_URL || APPS_SCRIPT_WEBAPP_URL.includes('YOUR_APPS_SCRIPT_WEBAPP_URL_HERE')) {
                reject(new Error('Apps Script Web App URL is not configured.'));
                return;
            }

            let attempt = 0;

            function runAttempt() {
                attempt += 1;

                const callbackName = '__waffleQuery_' +
                    Date.now() + '_' +
                    Math.random().toString(36).slice(2);

                const script = document.createElement('script');
                let finished = false;

                const cleanup = () => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeoutId);
                    try {
                        delete window[callbackName];
                    } catch (_) {
                        window[callbackName] = undefined;
                    }
                    if (script.parentNode) script.parentNode.removeChild(script);
                };

                const retryOrReject = (message) => {
                    cleanup();

                    if (attempt < maxAttempts) {
                        setTimeout(runAttempt, 1200);
                        return;
                    }

                    const actionName = payload && payload.action
                        ? String(payload.action)
                        : 'unknown action';

                    reject(new Error(
                        message +
                        '\n\nApps Script action: ' + actionName +
                        '\nAttempts: ' + attempt
                    ));
                };

                const timeoutId = setTimeout(() => {
                    retryOrReject(
                        'Apps Script did not respond in time. This can happen during a cold start or when the deployed Web App is not the same version as the front end.'
                    );
                }, timeoutMs);

                window[callbackName] = response => {
                    cleanup();

                    if (response && response.result === 'success') {
                        resolve(response);
                    } else {
                        reject(new Error(
                            response && response.error
                                ? response.error
                                : 'Apps Script returned an unknown error.'
                        ));
                    }
                };

                script.onerror = () => {
                    retryOrReject(
                        'Could not reach the Apps Script Web App.'
                    );
                };

                const separator = APPS_SCRIPT_WEBAPP_URL.includes('?') ? '&' : '?';
                script.src =
                    APPS_SCRIPT_WEBAPP_URL +
                    separator +
                    'callback=' + encodeURIComponent(callbackName) +
                    '&payload=' + encodeURIComponent(JSON.stringify(payload)) +
                    '&_ts=' + Date.now() +
                    '&_attempt=' + attempt;

                document.body.appendChild(script);
            }

            runAttempt();
        });
    }

    function queryAppsScript(
        payload,
        options = {}
    ) {
        const key =
            options.dedupe === false
                ? ''
                : waffleReadRequestKey(
                    payload
                );

        if (
            key &&
            waffleInFlightRequests.has(
                key
            )
        ) {
            return waffleInFlightRequests.get(
                key
            );
        }

        beginWaffleNetworkActivity();

        const request =
            queryAppsScriptRaw(
                payload,
                options
            );

        request.finally(
            endWaffleNetworkActivity
        );

        if (!key) {
            return request;
        }

        waffleInFlightRequests.set(
            key,
            request
        );

        const clearRequest = () => {
            if (
                waffleInFlightRequests.get(
                    key
                ) ===
                request
            ) {
                waffleInFlightRequests.delete(
                    key
                );
            }
        };

        request.then(
            clearRequest,
            clearRequest
        );

        return request;
    }


    function getActiveCareFlags(record) {
        const riskFlags = (record && record.riskFlags) || {};

        return CARE_SAFETY_FLAGS.filter(flag => riskFlags[flag.key] === true);
    }

    function findDirectoryCareElement(stayKey) {
        return Array.from(
            document.querySelectorAll('[data-directory-care]')
        ).find(element =>
            String(element.dataset.directoryCare || '') === String(stayKey || '')
        ) || null;
    }

    function setDirectoryCareFlags(stayKey, record) {
        const profileCard =
            getDirectoryProfileCard(
                stayKey
            );

        if (profileCard) {
            renderDirectoryCareProfile(
                profileCard,
                record || {
                    riskFlags: {}
                }
            );
        }

        const container = findDirectoryCareElement(stayKey);
        if (!container) return;

        if (!record) {
            container.classList.remove('has-alerts', 'care-clear');
            container.classList.add('care-unset');
            container.innerHTML =
                '<span class="directory-care-unset">🛡️ Care profile not set</span>';
            refreshDirectoryCareSummary();
            return;
        }

        const activeFlags = getActiveCareFlags(record);

        if (!activeFlags.length) {
            container.classList.remove('has-alerts', 'care-unset');
            container.classList.add('care-clear');
            container.innerHTML =
                '<span class="directory-care-clear">✓ No active care alerts</span>';
            refreshDirectoryCareSummary();
            return;
        }

        container.classList.remove('care-clear', 'care-unset');
        container.classList.add('has-alerts');

        container.innerHTML = activeFlags.map(flag => `
            <span
                class="care-alert-badge directory-care-badge ${escapeDashboardHtml(flag.className)}"
                data-directory-care-alert
                title="${escapeDashboardHtml(flag.label)}">
                <span class="directory-care-icon" aria-hidden="true">
                    ${escapeDashboardHtml(flag.icon)}
                </span>
                <span>${escapeDashboardHtml(flag.label)}</span>
            </span>
        `).join('');

        refreshDirectoryCareSummary();
    }

    function refreshDirectoryCareSummary() {
        const summary = document.getElementById('directory-care-summary');
        if (!summary) return;

        const flaggedCards = Array.from(
            document.querySelectorAll(
                '.directory-care-strip.has-alerts'
            )
        );

        const totalAlerts = flaggedCards.reduce((total, container) => {
            return total +
                container.querySelectorAll('[data-directory-care-alert]').length;
        }, 0);

        if (!totalAlerts) {
            summary.textContent = 'No active care alerts';
            summary.classList.remove('has-alerts');
            return;
        }

        summary.textContent =
            `${totalAlerts} ${totalAlerts === 1 ? 'alert' : 'alerts'} · ` +
            `${flaggedCards.length} ${flaggedCards.length === 1 ? 'dog' : 'dogs'}`;

        summary.classList.add('has-alerts');
    }

    function renderCareRiskDashboard(stays) {
        const currentStays = Array.isArray(stays) ? stays : [];

        currentStays.forEach(stay => {
            setDirectoryCareFlags(
                stay.stayKey,
                careRiskRecordsCache[stay.stayKey] || null
            );
        });

        refreshDirectoryCareSummary();
    }

    async function loadCareRiskDashboard(csvText) {
        const csv = csvText || localStorage.getItem('boardingDataCache') || '';
        const stays = getCurrentBoardingStays(csv);

        if (!stays.length) {
            careRiskRecordsCache = {};
            renderCareRiskDashboard([]);
            return;
        }

        try {
            const response = await queryAppsScript({
                action: 'get_belongings',
                stayKeys: stays.map(stay => stay.stayKey)
            }, {
                maxAttempts: 2,
                timeoutMs: 45000
            });

            careRiskRecordsCache = {};

            (response.records || []).forEach(record => {
                careRiskRecordsCache[record.stayKey] = record;
            });

            renderCareRiskDashboard(stays);
        } catch (error) {
            console.error('Care & Safety alert load failed:', error);

            const list = document.getElementById('care-alert-list');
            const count = document.getElementById('care-alert-count');

            if (list) {
                list.innerHTML =
                    '<div class="care-alert-load-error">⚠️ Care & Safety alerts could not be refreshed.</div>';
            }

            if (count) {
                count.textContent = 'Sync issue';
                count.classList.remove('has-alerts');
            }
        }
    }




    function directoryBookingCsvEscape(value) {
        const text =
            String(
                value ?? ''
            );

        if (
            /[",\n\r]/.test(
                text
            )
        ) {
            return (
                '"' +
                text.replace(
                    /"/g,
                    '""'
                ) +
                '"'
            );
        }

        return text;
    }

    function guestDirectoryBookingsToCsv(bookings) {
        const header = [
            'Timestamp',
            'Dog Name',
            'Breed',
            'Start Date',
            'End Date',
            "Owner's Name",
            'Contact Number',
            'Likes',
            'Dislikes',
            'Notes',
            'Edit Link',
            'Booking Type'
        ];

        const rows = [
            header
        ];

        (Array.isArray(bookings)
            ? bookings
            : []
        ).forEach(booking => {
            rows.push([
                booking.timestamp || '',
                booking.dogName || '',
                booking.breed || '',
                booking.startDate || '',
                booking.endDate || '',
                booking.ownerName || '',
                booking.phone || '',
                '',
                '',
                booking.notes || '',
                booking.editLink || '',
                booking.bookingType || 'Boarding'
            ]);
        });

        return rows
            .map(row =>
                row
                    .map(
                        directoryBookingCsvEscape
                    )
                    .join(',')
            )
            .join('\n');
    }


    function getDirectoryBookingSignature(
        bookings
    ) {
        return (
            Array.isArray(bookings)
                ? bookings
                : []
        )
            .map(booking => [
                booking.stayKey || '',
                booking.dogName || '',
                booking.breed || '',
                booking.startDate || '',
                booking.endDate || '',
                booking.ownerName || '',
                booking.phone || '',
                booking.notes || ''
            ].join('|'))
            .sort()
            .join('||');
    }

    function findDirectoryCardByStayKey(
        stayKey
    ) {
        return Array.from(
            document.querySelectorAll(
                '.directory-card[data-directory-stay-key]'
            )
        ).find(card =>
            String(
                card.dataset
                    .directoryStayKey ||
                ''
            ) ===
            String(
                stayKey || ''
            )
        ) || null;
    }

    function renderDirectoryLazySummary(
        stayKey,
        summary
    ) {
        const card =
            findDirectoryCardByStayKey(
                stayKey
            );

        if (!card) return;

        summary =
            summary || {
                stayKey,
                riskFlags: {},
                dogPhoto: null,
                intakeFieldCount: 0,
                intakeAttributesSource: '',
                belongingsItemCount: 0,
                belongingsPhotoCount: 0,
                hasBelongingsRecord: false
            };

        const fieldCount =
            Number(
                summary.intakeFieldCount ||
                0
            );

        const source =
            String(
                summary.intakeAttributesSource ||
                ''
            ).trim();

        const profileChip =
            card.querySelector(
                '[data-intake-profile-summary]'
            );

        if (profileChip) {
            profileChip.textContent =
                fieldCount
                    ? `${fieldCount} fields · ${source || 'Stored profile'}`
                    : (
                        source ||
                        'No intake saved yet'
                    );
        }

        const profileDetails =
            card.querySelector(
                '[data-directory-detail="profile"]'
            );

        const profileHost =
            card.querySelector(
                '[data-directory-intake-attributes]'
            );

        if (
            profileDetails &&
            profileDetails.dataset
                .detailLoaded !==
                'true' &&
            profileHost
        ) {
            profileHost.innerHTML =
                fieldCount
                    ? `
                        <div class="directory-lazy-placeholder">
                            <div>
                                <strong>📋 ${fieldCount} intake fields available</strong>
                                <span>${escapeDashboardHtml(source || 'Stored profile')}</span>
                            </div>
                            <span class="directory-lazy-hint">Open this section to load the full profile.</span>
                        </div>
                      `
                    : `
                        <div class="directory-lazy-placeholder">
                            <div>
                                <strong>📋 No stored intake profile yet</strong>
                                <span>Digital or Legacy Intake details will appear here when available.</span>
                            </div>
                        </div>
                      `;
        }

        const belongingsDetails =
            card.querySelector(
                '[data-directory-detail="belongings"]'
            );

        const belongingsHost =
            card.querySelector(
                '[data-directory-belongings]'
            );

        if (
            belongingsDetails &&
            belongingsDetails.dataset
                .detailLoaded !==
                'true' &&
            belongingsHost
        ) {
            const itemCount =
                Number(
                    summary.belongingsItemCount ||
                    0
                );

            const photoCount =
                Number(
                    summary.belongingsPhotoCount ||
                    0
                );

            const bits = [];

            if (itemCount) {
                bits.push(
                    `${itemCount} item${itemCount === 1 ? '' : 's'}`
                );
            }

            if (photoCount) {
                bits.push(
                    `${photoCount} photo${photoCount === 1 ? '' : 's'}`
                );
            }

            belongingsHost.innerHTML = `
                <div class="directory-lazy-placeholder">
                    <div>
                        <strong>🧳 ${bits.length ? bits.join(' · ') : 'Belongings & care'}</strong>
                        <span>Care alerts stay visible on the card without loading the full belongings record.</span>
                    </div>
                    <span class="directory-lazy-hint">Open this section to load details and photos.</span>
                </div>
            `;
        }
    }

    function setDirectoryDetailLoading(
        details,
        type
    ) {
        const host =
            details.querySelector(
                type === 'profile'
                    ? '[data-directory-intake-attributes]'
                    : '[data-directory-belongings]'
            );

        if (!host) return;

        host.innerHTML = `
            <div class="directory-lazy-placeholder is-loading">
                <div>
                    <strong>⏳ Loading ${type === 'profile' ? 'intake profile' : 'belongings & photos'}…</strong>
                    <span>Only this dog's details are being requested.</span>
                </div>
            </div>
        `;
    }

    function setDirectoryDetailError(
        details,
        type,
        error
    ) {
        const host =
            details.querySelector(
                type === 'profile'
                    ? '[data-directory-intake-attributes]'
                    : '[data-directory-belongings]'
            );

        if (!host) return;

        host.innerHTML = `
            <div class="directory-lazy-placeholder is-error">
                <div>
                    <strong>⚠️ Could not load this section</strong>
                    <span>${escapeDashboardHtml(error?.message || String(error || 'Unknown error'))}</span>
                </div>
                <button
                    type="button"
                    class="directory-intake-action"
                    data-retry-directory-detail="${escapeDashboardHtml(type)}">
                    ↻ Retry
                </button>
            </div>
        `;
    }

    async function loadDirectoryProfileDetail(
        card,
        details,
        options = {}
    ) {
        const stayKey =
            String(
                card?.dataset?.stayKey ||
                card?.dataset?.directoryStayKey ||
                ''
            ).trim();

        if (!stayKey) return;

        if (
            !options.force &&
            directoryProfileDetailCache[
                stayKey
            ]
        ) {
            renderDirectoryIntakeAttributes(
                card,
                directoryProfileDetailCache[
                    stayKey
                ]
            );

            details.dataset.detailLoaded =
                'true';

            return;
        }

        if (
            details.dataset.detailLoading ===
            'true'
        ) {
            return;
        }

        details.dataset.detailLoading =
            'true';

        setDirectoryDetailLoading(
            details,
            'profile'
        );

        const applyRecord =
            record => {
                directoryProfileDetailCache[
                    stayKey
                ] = record;

                renderDirectoryIntakeAttributes(
                    card,
                    record
                );

                details.dataset.detailLoaded =
                    'true';

                reconcileDirectoryDigitalIntakeFromProfile(
                    stayKey,
                    record
                );
            };

        try {
            let cachedRendered = false;

            const swr =
                await queryAppsScriptSWR(
                    {
                        action:
                            'get_guest_profile',
                        stayKey
                    },
                    {
                        cacheKey:
                            'directory:profile:' +
                            stayKey,
                        maxAttempts: 2,
                        timeoutMs: 30000,
                        maxStaleMs:
                            6 * 60 * 60 * 1000,
                        onCached:
                            cachedResponse => {
                                cachedRendered =
                                    true;

                                applyRecord(
                                    cachedResponse.record ||
                                    {
                                        stayKey,
                                        intakeAttributes: {},
                                        intakeAttributesSource: ''
                                    }
                                );
                            }
                    }
                );

            if (
                !swr.unchanged ||
                !cachedRendered
            ) {
                applyRecord(
                    swr.data.record ||
                    {
                        stayKey,
                        intakeAttributes: {},
                        intakeAttributesSource: ''
                    }
                );
            }

        } catch (error) {
            console.error(
                'Guest profile lazy load failed:',
                error
            );

            setDirectoryDetailError(
                details,
                'profile',
                error
            );

        } finally {
            details.dataset.detailLoading =
                'false';
        }
    }


    async function loadDirectoryBelongingsDetail(
        card,
        details,
        options = {}
    ) {
        const stayKey =
            String(
                card?.dataset?.stayKey ||
                card?.dataset?.directoryStayKey ||
                ''
            ).trim();

        if (!stayKey) return;

        if (
            !options.force &&
            directoryBelongingsDetailCache[
                stayKey
            ]
        ) {
            renderDirectoryBelongings(
                card,
                directoryBelongingsDetailCache[
                    stayKey
                ]
            );

            details.dataset.detailLoaded =
                'true';

            return;
        }

        if (
            details.dataset.detailLoading ===
            'true'
        ) {
            return;
        }

        details.dataset.detailLoading =
            'true';

        setDirectoryDetailLoading(
            details,
            'belongings'
        );

        const applyRecord =
            record => {
                directoryBelongingsDetailCache[
                    stayKey
                ] = record;

                belongingsRecordsCache[
                    stayKey
                ] = {
                    ...(
                        belongingsRecordsCache[
                            stayKey
                        ] ||
                        {}
                    ),
                    ...record
                };

                directoryPhotoRecordsCache[
                    stayKey
                ] = {
                    ...(
                        directoryPhotoRecordsCache[
                            stayKey
                        ] ||
                        {}
                    ),
                    ...record
                };

                careRiskRecordsCache[
                    stayKey
                ] = {
                    ...(
                        careRiskRecordsCache[
                            stayKey
                        ] ||
                        {}
                    ),
                    ...record
                };

                setDirectoryDogPhoto(
                    stayKey,
                    record
                );

                setDirectoryCareFlags(
                    stayKey,
                    record
                );

                renderDirectoryBelongings(
                    card,
                    record
                );

                details.dataset.detailLoaded =
                    'true';
            };

        try {
            let cachedRendered = false;

            const swr =
                await queryAppsScriptSWR(
                    {
                        action:
                            'get_guest_belongings',
                        stayKey
                    },
                    {
                        cacheKey:
                            'directory:belongings:' +
                            stayKey,
                        maxAttempts: 2,
                        timeoutMs: 30000,
                        maxStaleMs:
                            6 * 60 * 60 * 1000,
                        onCached:
                            cachedResponse => {
                                cachedRendered =
                                    true;

                                applyRecord(
                                    cachedResponse.record ||
                                    {
                                        stayKey,
                                        items: {},
                                        photos: [],
                                        riskFlags: {},
                                        dogPhoto: null
                                    }
                                );
                            }
                    }
                );

            if (
                !swr.unchanged ||
                !cachedRendered
            ) {
                applyRecord(
                    swr.data.record ||
                    {
                        stayKey,
                        items: {},
                        photos: [],
                        riskFlags: {},
                        dogPhoto: null
                    }
                );
            }

        } catch (error) {
            console.error(
                'Guest belongings lazy load failed:',
                error
            );

            setDirectoryDetailError(
                details,
                'belongings',
                error
            );

        } finally {
            details.dataset.detailLoading =
                'false';
        }
    }


    async function ensureDirectoryDetailLoaded(
        details,
        options = {}
    ) {
        if (!details) {
            return;
        }

        const card =
            details.closest(
                '.directory-card'
            );

        if (!card) return;

        const type =
            String(
                details.dataset
                    .directoryDetail ||
                ''
            );

        if (type === 'profile') {
            await loadDirectoryProfileDetail(
                card,
                details,
                options
            );
            return;
        }

        if (type === 'belongings') {
            await loadDirectoryBelongingsDetail(
                card,
                details,
                options
            );
        }
    }


    function applyGuestDirectoryResponse(
        response,
        options = {}
    ) {
        const bookings =
            response.bookings ||
            [];

        const nextSignature =
            getDirectoryBookingSignature(
                bookings
            );

        const existingCards =
            document.querySelector(
                '.directory-card[data-directory-stay-key]'
            );

        const shouldRebuildCards =
            !options.quiet ||
            !existingCards ||
            !directoryBookingStateSignature ||
            directoryBookingStateSignature !==
                nextSignature;

        directorySummaryRecordsCache = {};
        directoryPhotoRecordsCache = {};
        careRiskRecordsCache = {};
        directoryIntakeStatusCache = {};
        directoryLegacyIntakeCache = {};

        if (options.force) {
            directoryProfileDetailCache = {};
            directoryBelongingsDetailCache = {};
            belongingsRecordsCache = {};
        }

        (response.summaries || [])
            .forEach(summary => {
                if (!summary.stayKey) return;

                directorySummaryRecordsCache[
                    summary.stayKey
                ] = summary;

                directoryPhotoRecordsCache[
                    summary.stayKey
                ] = summary;

                careRiskRecordsCache[
                    summary.stayKey
                ] = summary;
            });

        (response.digitalIntakes || [])
            .forEach(record => {
                if (record.stayKey) {
                    directoryIntakeStatusCache[
                        record.stayKey
                    ] = record;
                }
            });

        (response.legacyIntakes || [])
            .forEach(group => {
                if (group.stayKey) {
                    directoryLegacyIntakeCache[
                        group.stayKey
                    ] = group;
                }
            });

        directoryIntakeStatusCacheLastFetch =
            Date.now();

        directoryLegacyIntakeCacheLastFetch =
            Date.now();

        directoryConsolidatedLastFetch =
            Date.now();

        if (shouldRebuildCards) {
            const csv =
                guestDirectoryBookingsToCsv(
                    bookings
                );

            parseCSVToEvents(csv);

            directoryBookingStateSignature =
                nextSignature;
        }

        Object.entries(
            directorySummaryRecordsCache
        ).forEach(
            ([stayKey, summary]) => {
                setDirectoryDogPhoto(
                    stayKey,
                    summary
                );

                setDirectoryCareFlags(
                    stayKey,
                    summary
                );

                renderDirectoryLazySummary(
                    stayKey,
                    summary
                );

                reconcileDirectoryDigitalIntakeFromProfile(
                    stayKey,
                    summary
                );
            }
        );

        Object.entries(
            directoryIntakeStatusCache
        ).forEach(
            ([stayKey, record]) => {
                setDirectoryIntakeStatus(
                    stayKey,
                    record
                );
            }
        );

        Object.entries(
            directoryLegacyIntakeCache
        ).forEach(
            ([stayKey, group]) => {
                setDirectoryLegacyIntakeStatus(
                    stayKey,
                    group
                );
            }
        );

        refreshDirectoryCareSummary();
        filterGuestDirectoryCards();
        restoreSelectedDirectoryProfile();
    }


    async function loadGuestDirectoryConsolidated(
        options = {}
    ) {
        if (WAFFLE_PAGE !== 'directory') {
            return;
        }

        if (
            directoryConsolidatedLoadInProgress
        ) {
            return;
        }

        if (
            !options.force &&
            directoryConsolidatedLastFetch &&
            Date.now() -
                directoryConsolidatedLastFetch <
                15000
        ) {
            return;
        }

        directoryConsolidatedLoadInProgress =
            true;

        const button =
            options.button ||
            null;

        const grid =
            document.getElementById(
                'directory-grid'
            );

        const previousButtonText =
            button
                ? button.textContent
                : '';

        if (button) {
            button.disabled = true;
            button.textContent =
                '⏳ Refreshing...';
        }

        if (
            grid &&
            !options.quiet &&
            !grid.querySelector(
                '.directory-card'
            )
        ) {
            grid.innerHTML =
                '<div class="directory-page-loading">⏳ Loading Guest Directory…</div>';
        }

        try {
            let cachedRendered = false;

            const swr =
                await queryAppsScriptSWR(
                    {
                        action:
                            'get_guest_directory'
                    },
                    {
                        cacheKey:
                            'directory:summary',
                        maxAttempts: 2,
                        timeoutMs: 45000,
                        maxStaleMs:
                            6 * 60 * 60 * 1000,
                        onCached:
                            cachedResponse => {
                                cachedRendered =
                                    true;

                                applyGuestDirectoryResponse(
                                    cachedResponse,
                                    {
                                        ...options,
                                        quiet: false,
                                        force: false,
                                        fromCache: true
                                    }
                                );
                            }
                    }
                );

            if (
                !swr.unchanged ||
                !cachedRendered
            ) {
                applyGuestDirectoryResponse(
                    swr.data,
                    {
                        ...options,
                        quiet:
                            cachedRendered
                                ? true
                                : options.quiet,
                        force:
                            options.force &&
                            !cachedRendered
                    }
                );
            }

        } catch (error) {
            console.error(
                'Guest Directory load failed:',
                error
            );

            if (
                grid &&
                !grid.querySelector(
                    '.directory-card'
                )
            ) {
                grid.innerHTML =
                    `<div class="directory-page-loading">⚠️ Guest Directory could not be loaded.<br>${escapeDashboardHtml(error.message || String(error))}</div>`;
            }

            throw error;

        } finally {
            directoryConsolidatedLoadInProgress =
                false;

            if (button) {
                button.disabled = false;
                button.textContent =
                    previousButtonText ||
                    '🔄 Refresh';
            }
        }
    }



    function getDirectoryProfileCard(stayKey) {
        return Array.from(
            document.querySelectorAll(
                '.directory-card[data-directory-stay-key]'
            )
        ).find(card =>
            String(
                card.dataset
                    .directoryStayKey ||
                ''
            ) ===
            String(
                stayKey || ''
            )
        ) || null;
    }



    function switchDirectoryProfileMainTab(card, tabName) {
        if (!card) return;

        tabName =
            tabName === 'belongings'
                ? 'belongings'
                : 'profile';

        card.dataset.mainProfileTab =
            tabName;

        card
            .querySelectorAll(
                '[data-directory-main-tab]'
            )
            .forEach(button => {
                const active =
                    button.dataset.directoryMainTab ===
                    tabName;

                button.classList.toggle(
                    'is-active',
                    active
                );

                button.setAttribute(
                    'aria-selected',
                    active ? 'true' : 'false'
                );
            });

        card
            .querySelectorAll(
                '[data-directory-main-panel]'
            )
            .forEach(panel => {
                const active =
                    panel.dataset.directoryMainPanel ===
                    tabName;

                panel.classList.toggle(
                    'is-active',
                    active
                );

                panel.hidden =
                    !active;
            });

        if (tabName === 'belongings') {
            const details =
                card.querySelector(
                    '[data-directory-detail="belongings"]'
                );

            if (details) {
                loadDirectoryBelongingsDetail(
                    card,
                    details
                ).catch(error =>
                    console.error(error)
                );
            }
        }
    }


    function switchDirectoryProfileSubTab(card, tabName) {
        if (!card) return;

        const valid =
            DIRECTORY_PROFILE_SECONDARY_TABS
                .some(tab =>
                    tab.key ===
                    tabName
                );

        tabName =
            valid
                ? tabName
                : 'overview';

        card.dataset.profileSubTab =
            tabName;

        card
            .querySelectorAll(
                '[data-profile-subtab]'
            )
            .forEach(button => {
                const active =
                    button.dataset.profileSubtab ===
                    tabName;

                button.classList.toggle(
                    'is-active',
                    active
                );

                button.setAttribute(
                    'aria-selected',
                    active ? 'true' : 'false'
                );
            });

        card
            .querySelectorAll(
                '[data-profile-subpanel]'
            )
            .forEach(panel => {
                const active =
                    panel.dataset.profileSubpanel ===
                    tabName;

                panel.classList.toggle(
                    'is-active',
                    active
                );

                panel.hidden =
                    !active;
            });
    }


    async function openDirectoryGuestProfile(
        card,
        options = {}
    ) {
        if (!card) return;

        const stayKey =
            String(
                card.dataset
                    .directoryStayKey ||
                ''
            ).trim();

        if (!stayKey) return;

        directorySelectedProfileStayKey =
            stayKey;

        const dashboard =
            document.querySelector(
                '.directory-dashboard-fused'
            );

        const backBar =
            document.getElementById(
                'directoryProfileBackBar'
            );

        const breadcrumb =
            document.getElementById(
                'directoryProfileBreadcrumbName'
            );

        const dogName =
            String(
                card.dataset
                    .directoryDogName ||
                card.dataset
                    .dogName ||
                'Guest'
            );

        document
            .querySelectorAll(
                '.directory-card.is-profile-active'
            )
            .forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove(
                        'is-profile-active'
                    );
                }
            });

        card.classList.add(
            'is-profile-active'
        );

        dashboard?.classList.add(
            'is-profile-mode'
        );

        if (backBar) {
            backBar.hidden = false;
        }

        if (breadcrumb) {
            breadcrumb.textContent =
                dogName;
        }

        /*
         * V8.4.1 opens directly into Profile.
         * Belongings remains lazy until selected.
         */
        switchDirectoryProfileMainTab(
            card,
            'profile'
        );

        switchDirectoryProfileSubTab(
            card,
            card.dataset.profileSubTab ||
            'overview'
        );

        const profileSection =
            card.querySelector(
                '[data-directory-detail="profile"]'
            );

        if (profileSection) {
            loadDirectoryProfileDetail(
                card,
                profileSection,
                {
                    force:
                        options.force === true
                }
            ).catch(error =>
                console.error(error)
            );
        }

        if (!options.preserveScroll) {
            document
                .querySelector(
                    '.directory-dashboard-fused'
                )
                ?.scrollIntoView({
                    behavior:
                        options.instant
                            ? 'auto'
                            : 'smooth',
                    block:
                        'start'
                });
        }
    }


    function closeDirectoryGuestProfile(
        options = {}
    ) {
        directorySelectedProfileStayKey =
            '';

        const dashboard =
            document.querySelector(
                '.directory-dashboard-fused'
            );

        const backBar =
            document.getElementById(
                'directoryProfileBackBar'
            );

        dashboard?.classList.remove(
            'is-profile-mode'
        );

        document
            .querySelectorAll(
                '.directory-card.is-profile-active'
            )
            .forEach(card =>
                card.classList.remove(
                    'is-profile-active'
                )
            );

        if (backBar) {
            backBar.hidden = true;
        }

        filterGuestDirectoryCards();

        if (!options.preserveScroll) {
            document
                .querySelector(
                    '.directory-dashboard-fused'
                )
                ?.scrollIntoView({
                    behavior:
                        options.instant
                            ? 'auto'
                            : 'smooth',
                    block:
                        'start'
                });
        }
    }


    function restoreSelectedDirectoryProfile() {
        if (
            !directorySelectedProfileStayKey
        ) {
            return;
        }

        const card =
            getDirectoryProfileCard(
                directorySelectedProfileStayKey
            );

        if (!card) {
            closeDirectoryGuestProfile({
                preserveScroll:
                    true
            });
            return;
        }

        openDirectoryGuestProfile(
            card,
            {
                preserveScroll:
                    true,
                instant:
                    true
            }
        ).catch(error =>
            console.error(error)
        );
    }


    function filterGuestDirectoryCards() {
        const search =
            String(
                document.getElementById(
                    'guestDirectorySearch'
                )?.value ||
                ''
            )
                .toLowerCase()
                .trim();

        const profileMode =
            document
                .querySelector(
                    '.directory-dashboard-fused'
                )
                ?.classList
                .contains(
                    'is-profile-mode'
                ) ||
            false;

        document
            .querySelectorAll(
                '.directory-card'
            )
            .forEach(card => {
                if (profileMode) {
                    card.style.display =
                        card.classList.contains(
                            'is-profile-active'
                        )
                            ? 'block'
                            : 'none';
                    return;
                }

                card.style.display =
                    !search ||
                    card.innerText
                        .toLowerCase()
                        .includes(search)
                        ? 'block'
                        : 'none';
            });
    }

    function intakeAttributeControlHtml(field, value) {
        const safeKey =
            escapeDashboardHtml(
                field.key
            );

        const safeLabel =
            escapeDashboardHtml(
                field.label
            );

        const safeValue =
            escapeDashboardHtml(
                value || ''
            );

        const wideClass =
            field.wide
                ? ' is-wide'
                : '';

        if (field.type === 'yesno') {
            return `
                <div class="intake-profile-field${wideClass}">
                    <label for="">${safeLabel}</label>
                    <select
                        class="intake-profile-control"
                        data-intake-attribute="${safeKey}">
                        <option value="" ${!value ? 'selected' : ''}>Not provided</option>
                        <option value="Yes" ${String(value).toLowerCase() === 'yes' ? 'selected' : ''}>Yes</option>
                        <option value="No" ${String(value).toLowerCase() === 'no' ? 'selected' : ''}>No</option>
                    </select>
                </div>
            `;
        }

        if (field.type === 'sex') {
            return `
                <div class="intake-profile-field${wideClass}">
                    <label>${safeLabel}</label>
                    <select
                        class="intake-profile-control"
                        data-intake-attribute="${safeKey}">
                        <option value="" ${!value ? 'selected' : ''}>Not provided</option>
                        <option value="Male" ${String(value).toLowerCase() === 'male' ? 'selected' : ''}>Male</option>
                        <option value="Female" ${String(value).toLowerCase() === 'female' ? 'selected' : ''}>Female</option>
                        <option value="Other" ${String(value).toLowerCase() === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
            `;
        }

        if (field.type === 'textarea') {
            return `
                <div class="intake-profile-field${wideClass}">
                    <label>${safeLabel}</label>
                    <textarea
                        class="intake-profile-control"
                        data-intake-attribute="${safeKey}"
                        placeholder="Not provided">${safeValue}</textarea>
                </div>
            `;
        }

        return `
            <div class="intake-profile-field${wideClass}">
                <label>${safeLabel}</label>
                <input
                    type="text"
                    class="intake-profile-control"
                    data-intake-attribute="${safeKey}"
                    value="${safeValue}"
                    placeholder="Not provided">
            </div>
        `;
    }

    function renderDirectoryIntakeAttributes(card, record) {
        const host =
            card.querySelector(
                '[data-directory-intake-attributes]'
            );

        if (!host) return;

        const details =
            host.closest(
                '[data-directory-detail="profile"]'
            );

        if (details) {
            details.dataset.detailLoaded =
                'true';
        }

        const attributes =
            record &&
            record.intakeAttributes &&
            typeof record.intakeAttributes === 'object'
                ? record.intakeAttributes
                : {};

        const populatedCount =
            Object.values(attributes)
                .filter(value =>
                    String(value ?? '').trim()
                ).length;

        const source =
            String(
                record?.intakeAttributesSource ||
                ''
            ).trim();

        const sourceLabel =
            source
                ? escapeDashboardHtml(source)
                : (
                    populatedCount
                        ? 'Stored profile'
                        : 'No intake saved yet'
                );

        const summaryChip =
            card.querySelector(
                '[data-intake-profile-summary]'
            );

        if (summaryChip) {
            summaryChip.textContent =
                populatedCount
                    ? `${populatedCount} fields · ${sourceLabel}`
                    : sourceLabel;
        }

        const selectedSubTab =
            String(
                card.dataset.profileSubTab ||
                'overview'
            );

        const tabButtons =
            DIRECTORY_PROFILE_SECONDARY_TABS
                .map(tab => {
                    const active =
                        tab.key === selectedSubTab;

                    return `
                        <button
                            type="button"
                            class="directory-profile-subtab ${active ? 'is-active' : ''}"
                            role="tab"
                            aria-selected="${active ? 'true' : 'false'}"
                            data-profile-subtab="${escapeDashboardHtml(tab.key)}">
                            <span aria-hidden="true">${escapeDashboardHtml(tab.icon)}</span>
                            <span>${escapeDashboardHtml(tab.label)}</span>
                        </button>
                    `;
                })
                .join('');

        const panels =
            DIRECTORY_PROFILE_SECONDARY_TABS
                .map(tab => {
                    const active =
                        tab.key === selectedSubTab;

                    if (tab.key === 'care') {
                        return `
                            <section
                                class="directory-profile-subpanel ${active ? 'is-active' : ''}"
                                role="tabpanel"
                                data-profile-subpanel="care"
                                ${active ? '' : 'hidden'}>
                                <div
                                    class="directory-profile-care-host"
                                    data-directory-profile-care>
                                    <div class="intake-profile-empty">
                                        Loading care settings…
                                    </div>
                                </div>
                            </section>
                        `;
                    }

                    const groupsHtml =
                        tab.groups
                            .map(groupTitle => {
                                const group =
                                    INTAKE_ATTRIBUTE_UI_GROUPS
                                        .find(item =>
                                            item.title === groupTitle
                                        );

                                if (!group) return '';

                                const fieldsHtml =
                                    group.fields
                                        .map(field =>
                                            intakeAttributeControlHtml(
                                                field,
                                                attributes[field.key]
                                            )
                                        )
                                        .join('');

                                return `
                                    <section class="intake-profile-group">
                                        <div class="intake-profile-group-title">
                                            ${escapeDashboardHtml(group.title)}
                                        </div>
                                        <div class="intake-profile-grid">
                                            ${fieldsHtml}
                                        </div>
                                    </section>
                                `;
                            })
                            .join('');

                    return `
                        <section
                            class="directory-profile-subpanel ${active ? 'is-active' : ''}"
                            role="tabpanel"
                            data-profile-subpanel="${escapeDashboardHtml(tab.key)}"
                            ${active ? '' : 'hidden'}>
                            ${groupsHtml}
                        </section>
                    `;
                })
                .join('');

        host.innerHTML = `
            <div class="intake-profile-source directory-profile-source-line">
                📋 ${sourceLabel}
            </div>

            <div
                class="directory-profile-subtabs"
                role="tablist"
                aria-label="Profile details">
                ${tabButtons}
            </div>

            <div class="directory-profile-subpanels">
                ${panels}
            </div>
        `;

        renderDirectoryCareProfile(
            card,
            careRiskRecordsCache[
                card.dataset.stayKey
            ] ||
            directorySummaryRecordsCache[
                card.dataset.stayKey
            ] ||
            belongingsRecordsCache[
                card.dataset.stayKey
            ] ||
            {
                riskFlags: {}
            }
        );
    }


    function renderDirectoryCareProfile(card, record) {
        const host =
            card.querySelector(
                '[data-directory-profile-care]'
            );

        if (!host) return;

        const riskFlags =
            record &&
            record.riskFlags &&
            typeof record.riskFlags === 'object'
                ? record.riskFlags
                : {};

        const riskFlagsHtml =
            CARE_SAFETY_FLAGS
                .map(flag => `
                    <label class="care-risk-option ${escapeDashboardHtml(flag.className)}">
                        <input
                            type="checkbox"
                            data-care-risk-flag="${escapeDashboardHtml(flag.key)}"
                            ${riskFlags[flag.key] ? 'checked' : ''}>
                        <span class="care-risk-icon" aria-hidden="true">${escapeDashboardHtml(flag.icon)}</span>
                        <span class="care-risk-label">${escapeDashboardHtml(flag.label)}</span>
                    </label>
                `)
                .join('');

        host.innerHTML = `
            <div class="care-profile-compact">
                <div class="care-risk-section-heading">
                    <div>
                        <strong>🛡️ Care &amp; Safety</strong>
                        <span>
                            Operational alerts stored with this guest profile.
                        </span>
                    </div>
                </div>

                <div class="care-risk-grid">
                    ${riskFlagsHtml}
                </div>
            </div>
        `;
    }


    function renderDirectoryBelongings(card, record) {
        const host =
            card.querySelector(
                '[data-directory-belongings]'
            );

        if (!host) return;

        const details =
            host.closest(
                '[data-directory-detail="belongings"]'
            );

        if (details) {
            details.dataset.detailLoaded =
                'true';
        }

        record =
            record || {
                items: {},
                photos: [],
                riskFlags: {},
                dogPhoto: null
            };

        renderDirectoryCareProfile(
            card,
            record
        );

        const itemsHtml =
            BELONGINGS_ITEMS
                .map(item => {
                    const saved =
                        record.items?.[item.key] ||
                        {};

                    return `
                        <div class="belongings-item-row">
                            <label class="belongings-item-label">
                                <input
                                    type="checkbox"
                                    data-belongings-item-present="${escapeDashboardHtml(item.key)}"
                                    ${saved.present ? 'checked' : ''}>
                                <span>${escapeDashboardHtml(item.label)}</span>
                            </label>
                            <input
                                type="text"
                                class="belongings-description"
                                data-belongings-item-description="${escapeDashboardHtml(item.key)}"
                                value="${escapeDashboardHtml(saved.description || '')}"
                                placeholder="${escapeDashboardHtml(item.placeholder)}">
                        </div>
                    `;
                })
                .join('');

        const photos =
            Array.isArray(record.photos)
                ? record.photos
                : [];

        const photosHtml =
            photos.length
                ? photos
                    .map(photo => `
                        <div class="belongings-photo-card">
                            <button
                                type="button"
                                class="belongings-photo-delete"
                                data-delete-belongings-photo="${escapeDashboardHtml(photo.id || '')}"
                                title="Delete photo">×</button>
                            <a
                                href="${escapeDashboardHtml(photo.driveUrl || photo.previewUrl || '#')}"
                                target="_blank"
                                rel="noopener noreferrer">
                                <img
                                    src="${escapeDashboardHtml(photo.previewUrl || '')}"
                                    alt="${escapeDashboardHtml(photo.label || 'Belongings photo')}"
                                    loading="lazy">
                            </a>
                            <div class="belongings-photo-caption">
                                ${escapeDashboardHtml(photo.label || 'Belongings photo')}
                            </div>
                        </div>
                    `)
                    .join('')
                : `
                    <div class="belongings-photo-status belongings-photo-empty">
                        No belongings photos saved yet.
                    </div>
                `;

        host.innerHTML = `
            <div class="directory-belongings-section">
                <div class="belongings-item-section-heading">
                    <div>
                        <strong>🧳 Belongings Checklist</strong>
                        <span>
                            Tick what arrived and add a short note only where needed.
                        </span>
                    </div>
                </div>

                <div class="belongings-item-list">
                    ${itemsHtml}
                </div>

                <div class="belongings-photo-upload-card">
                    <div class="belongings-photo-upload-copy">
                        <strong>📷 Belongings Photos</strong>
                        <span>
                            Add several photos from your library in one selection, or use the camera.
                        </span>
                    </div>

                    <input
                        type="text"
                        class="belongings-description belongings-photo-note"
                        data-belongings-photo-label
                        placeholder="Optional note for this group of photos">

                    <div class="belongings-actions belongings-actions-compact">
                        <button
                            type="button"
                            class="belongings-camera-btn"
                            data-take-belongings-photo>
                            📷 Take Photo
                        </button>

                        <button
                            type="button"
                            class="belongings-upload-btn"
                            data-upload-belongings-photo>
                            🖼️ Add Photos
                        </button>

                        <input
                            type="file"
                            accept="image/*"
                            data-belongings-photo-input
                            multiple
                            hidden>
                    </div>

                    <div
                        class="belongings-photo-status"
                        data-belongings-photo-status></div>
                </div>

                <div class="belongings-photo-gallery">
                    ${photosHtml}
                </div>

                <div class="directory-profile-save-bar directory-belongings-save-bar">
                    <button
                        type="button"
                        class="belongings-save-btn"
                        data-save-belongings>
                        💾 Save Belongings
                    </button>
                </div>
            </div>
        `;
    }


    function renderDirectoryOperationalSections(
        stayKey,
        record
    ) {
        const card =
            Array.from(
                document.querySelectorAll(
                    '.directory-card[data-directory-stay-key]'
                )
            )
            .find(item =>
                String(
                    item.dataset
                        .directoryStayKey ||
                    ''
                ) ===
                String(
                    stayKey || ''
                )
            );

        if (!card) return;

        const normalized =
            record || {
                stayKey,
                items: {},
                photos: [],
                riskFlags: {},
                dogPhoto: null,
                intakeAttributes: {}
            };

        renderDirectoryIntakeAttributes(
            card,
            normalized
        );

        renderDirectoryBelongings(
            card,
            normalized
        );
    }

    function collectIntakeAttributes(card) {
        const attributes = {};

        card
            .querySelectorAll(
                '[data-intake-attribute]'
            )
            .forEach(control => {
                const key =
                    String(
                        control.dataset
                            .intakeAttribute ||
                        ''
                    ).trim();

                if (!key) return;

                attributes[key] =
                    String(
                        control.value || ''
                    ).trim();
            });

        return attributes;
    }

    function hasMeaningfulProfileText(value) {
        const text =
            String(
                value || ''
            )
                .trim()
                .toLowerCase();

        return !!text &&
            ![
                'no',
                'none',
                'nil',
                'n/a',
                'na',
                'not applicable',
                'none known'
            ].includes(text);
    }

    function syncPositiveCareFlagsFromIntake(
        card,
        attributes
    ) {
        const shouldEnable = {
            escapeRisk:
                String(
                    attributes.escapeAttempts ||
                    ''
                ).toLowerCase() ===
                    'yes',
            foodAllergy:
                hasMeaningfulProfileText(
                    attributes.foodAllergies
                ),
            medicated:
                hasMeaningfulProfileText(
                    attributes.medicationInstructions
                ),
            separationAnxiety:
                String(
                    attributes.separationAnxiety ||
                    ''
                ).toLowerCase() ===
                    'yes',
            weightManagement:
                String(
                    attributes.weightManagement ||
                    ''
                ).toLowerCase() ===
                    'yes'
        };

        Object.entries(
            shouldEnable
        ).forEach(([key, enabled]) => {
            if (!enabled) return;

            const checkbox =
                card.querySelector(
                    `[data-care-risk-flag="${key}"]`
                );

            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }


    async function loadBelongingsDashboard(options = {}) {
        /*
         * Backwards-compatible alias retained for older callbacks.
         * Belongings are now rendered inside Guest Directory & Care.
         */
        await hydrateDirectoryDogPhotos({
            force:
                options.force === true
        });
    }

    function formatStayDateShort(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    }

    function renderBelongingsDashboard(stays, loadError = '') {
        // Legacy compatibility alias. Belongings now render inside Guest Directory & Care.
        document
            .querySelectorAll(
                '.directory-card[data-directory-stay-key]'
            )
            .forEach(card => {
                const stayKey =
                    card.dataset
                        .directoryStayKey;

                renderDirectoryOperationalSections(
                    stayKey,
                    belongingsRecordsCache[
                        stayKey
                    ] || null
                );
            });
    }

    function collectBelongingsItems(card) {
        const items = {};
        BELONGINGS_ITEMS.forEach(item => {
            const present = card.querySelector(`[data-belongings-item-present="${item.key}"]`)?.checked || false;
            const description = card.querySelector(`[data-belongings-item-description="${item.key}"]`)?.value.trim() || '';
            items[item.key] = { present, description };
        });
        return items;
    }

    function collectCareSafetyFlags(card) {
        const riskFlags = {};

        CARE_SAFETY_FLAGS.forEach(flag => {
            riskFlags[flag.key] =
                card.querySelector(`[data-care-risk-flag="${flag.key}"]`)?.checked || false;
        });

        return riskFlags;
    }

    function getBelongingsCardPayload(card) {
        const profileDetails =
            card.querySelector(
                '[data-directory-detail="profile"]'
            );

        const belongingsDetails =
            card.querySelector(
                '[data-directory-detail="belongings"]'
            );

        const profileLoaded =
            profileDetails?.dataset.detailLoaded ===
                'true';

        const belongingsLoaded =
            belongingsDetails?.dataset.detailLoaded ===
                'true';

        const intakeAttributes =
            profileLoaded
                ? collectIntakeAttributes(card)
                : undefined;

        if (profileLoaded) {
            syncPositiveCareFlagsFromIntake(
                card,
                intakeAttributes
            );
        }

        const payload = {
            stayKey: card.dataset.stayKey,
            dogName: card.dataset.dogName,
            startDate: card.dataset.startDate,
            endDate: card.dataset.endDate,
            riskFlags:
                collectCareSafetyFlags(card)
        };

        if (belongingsLoaded) {
            payload.items =
                collectBelongingsItems(card);
        }

        if (profileLoaded) {
            payload.intakeAttributes =
                intakeAttributes;
        }

        return payload;
    }


    async function saveBelongingsCard(card, button) {
        if (!card || !button) return;

        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = '⏳ Saving...';

        try {
            const payload = getBelongingsCardPayload(card);
            await sendPayloadToAppsScript({ action: 'save_belongings', ...payload });

            belongingsRecordsCache[payload.stayKey] = {
                ...(belongingsRecordsCache[payload.stayKey] || {}),
                stayKey: payload.stayKey,
                dogName: payload.dogName,
                startDate: payload.startDate,
                endDate: payload.endDate,
                ...(payload.items
                    ? {
                        items:
                            payload.items
                      }
                    : {}),
                riskFlags: payload.riskFlags,
                ...(payload.intakeAttributes
                    ? {
                        intakeAttributes:
                            payload.intakeAttributes,
                        intakeAttributesSource:
                            'Web App'
                      }
                    : {}),
                photos: belongingsRecordsCache[payload.stayKey]?.photos || [],
                dogPhoto: belongingsRecordsCache[payload.stayKey]?.dogPhoto || null
            };

            careRiskRecordsCache[payload.stayKey] = {
                ...(careRiskRecordsCache[payload.stayKey] || {}),
                stayKey: payload.stayKey,
                dogName: payload.dogName,
                riskFlags: payload.riskFlags
            };

            directoryBelongingsDetailCache[
                payload.stayKey
            ] = {
                ...(directoryBelongingsDetailCache[
                    payload.stayKey
                ] || {}),
                stayKey: payload.stayKey,
                dogName: payload.dogName,
                startDate: payload.startDate,
                endDate: payload.endDate,
                ...(payload.items
                    ? {
                        items:
                            payload.items
                      }
                    : {}),
                riskFlags: payload.riskFlags,
                photos:
                    belongingsRecordsCache[
                        payload.stayKey
                    ]?.photos ||
                    [],
                dogPhoto:
                    belongingsRecordsCache[
                        payload.stayKey
                    ]?.dogPhoto ||
                    null
            };

            if (payload.intakeAttributes) {
                directoryProfileDetailCache[
                    payload.stayKey
                ] = {
                    ...(directoryProfileDetailCache[
                        payload.stayKey
                    ] || {}),
                    stayKey: payload.stayKey,
                    dogName: payload.dogName,
                    intakeAttributes:
                        payload.intakeAttributes,
                    intakeAttributesSource:
                        'Web App'
                };
            }

            renderCareRiskDashboard(
                getCurrentBoardingStays(
                    localStorage.getItem('boardingDataCache') || ''
                )
            );

            await invalidateWaffleClientCaches(
                [
                    'directory',
                    'audit'
                ]
            );

            button.innerText = '✅ Saved';
            setTimeout(() => { button.innerText = originalText; }, 1800);
        } catch (error) {
            console.error(error);
            alert('❌ BELONGINGS WERE NOT SAVED\n\n' + error.message);
            button.innerText = originalText;
        } finally {
            button.disabled = false;
        }
    }

    function makeHostedPhotoRequestToken() {
        return 'hosted_photo_' + Date.now() + '_' +
            Math.random().toString(36).slice(2, 12);
    }

    function closeHostedBelongingsPhotoUploader() {
        const modal = document.getElementById('hostedBelongingsPhotoUploaderModal');
        const frame = document.getElementById('hostedBelongingsPhotoUploaderFrame');

        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }

        if (frame) {
            frame.src = 'about:blank';
        }

        hostedBelongingsPhotoContext = null;
        belongingsUploadInProgress = false;
    }

    async function openHostedBelongingsPhotoUploader(card, mode, photoType = 'belongings') {
        if (!card) return;

        const status = card.querySelector('[data-belongings-photo-status]');
        const photoLabelInput = card.querySelector('[data-belongings-photo-label]');
        const payloadBase = getBelongingsCardPayload(card);
        const isDogProfile = photoType === 'dogProfile';
        const requestToken = makeHostedPhotoRequestToken();

        belongingsUploadInProgress = true;

        try {
            if (status) {
                status.textContent = isDogProfile
                    ? '💾 Preparing dog profile...'
                    : '💾 Saving belongings details...';
            }

            // Ensure an existing shared Pet_Belongings row is present. The
            // Apps Script-hosted uploader only appends a photo to this record.
            await sendPayloadToAppsScript({
                action: 'save_belongings',
                ...payloadBase
            });

            hostedBelongingsPhotoContext = {
                card,
                stayKey: payloadBase.stayKey,
                requestToken,
                photoType
            };

            const params = new URLSearchParams({
                action: 'photo_uploader',
                mode: mode || 'camera',
                stayKey: payloadBase.stayKey || '',
                dogName: payloadBase.dogName || '',
                startDate: payloadBase.startDate || '',
                endDate: payloadBase.endDate || '',
                photoLabel: isDogProfile
                    ? `${payloadBase.dogName || 'Dog'} profile photo`
                    : (photoLabelInput?.value.trim() || ''),
                photoType,
                requestToken,
                _ts: String(Date.now())
            });

            const frame = document.getElementById('hostedBelongingsPhotoUploaderFrame');
            const modal = document.getElementById('hostedBelongingsPhotoUploaderModal');
            const modalTitle =
                document.getElementById(
                    'hostedBelongingsPhotoUploaderTitle'
                );

            if (modalTitle) {
                modalTitle.textContent =
                    isDogProfile
                        ? '🐶 Position Dog Photo'
                        : '📷 Add Belongings Photos';
            }

            frame.src = APPS_SCRIPT_WEBAPP_URL + '?' + params.toString();
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');

            if (status) {
                status.textContent = isDogProfile
                    ? '🐶 Dog photo uploader opened.'
                    : '📷 Photo uploader opened. Choose or take a photo.';
            }

        } catch (error) {
            belongingsUploadInProgress = false;
            hostedBelongingsPhotoContext = null;
            if (status) status.textContent = '❌ ' + error.message;
            alert('❌ PHOTO UPLOADER COULD NOT OPEN\n\n' + error.message);
        }
    }

    window.addEventListener('message', async function(event) {
        const data = event && event.data;
        const context = hostedBelongingsPhotoContext;

        if (!context || !data || typeof data !== 'object') return;
        if (data.requestToken !== context.requestToken) return;
        if (data.stayKey !== context.stayKey) return;
        if ((data.photoType || 'belongings') !== (context.photoType || 'belongings')) return;

        const card = context.card;
        const status = card && card.querySelector('[data-belongings-photo-status]');

        if (data.type === 'waffleBelongingsPhotoUploaderReady') {
            if (status) {
                status.textContent =
                    context.photoType === 'dogProfile'
                        ? '🐶 Dog photo uploader ready.'
                        : '📷 Photo uploader ready.';
            }
            return;
        }

        if (data.type === 'waffleBelongingsPhotoError') {
            belongingsUploadInProgress = false;
            if (status) status.textContent = '❌ ' + (data.error || 'Photo upload failed.');
            alert('❌ PHOTO WAS NOT SAVED\n\n' + (data.error || 'Photo upload failed.'));
            return;
        }

        if (data.type === 'waffleBelongingsPhotoSaved') {
            try {
                if (status) status.textContent = '🔎 Refreshing shared photo record...';

                const response = await queryAppsScript({
                    action: 'get_belongings',
                    stayKeys: [context.stayKey]
                }, {
                    maxAttempts: 2,
                    timeoutMs: 45000
                });

                const record = (response.records || [])
                    .find(item => item.stayKey === context.stayKey);

                if (record) {
                    belongingsRecordsCache[context.stayKey] = record;
                    careRiskRecordsCache[context.stayKey] = record;
                    directoryPhotoRecordsCache[context.stayKey] = record;
                    setDirectoryDogPhoto(context.stayKey, record);
                    setDirectoryCareFlags(context.stayKey, record);
                }

                if (status) {
                    const savedCount =
                        Math.max(
                            1,
                            Number(
                                data.count ||
                                1
                            )
                        );

                    status.textContent =
                        context.photoType === 'dogProfile'
                            ? '✅ Dog photo positioned and saved'
                            : (
                                savedCount === 1
                                    ? '✅ Photo saved to Google Drive'
                                    : `✅ ${savedCount} photos saved to Google Drive`
                            );
                }

                closeHostedBelongingsPhotoUploader();

                if (record) {
                    renderDirectoryOperationalSections(
                        context.stayKey,
                        record
                    );
                }

            } catch (error) {
                belongingsUploadInProgress = false;
                if (status) status.textContent = '⚠️ Photo saved, but the shared record could not be refreshed.';
                alert(
                    '✅ The photo was saved by Apps Script, but the web page could not reload the Pet_Belongings record.\n\n' +
                    error.message
                );
            }
        }
    });


    function closeBelongingsCamera() {
        if (belongingsCameraStream) {
            belongingsCameraStream.getTracks().forEach(track => {
                try { track.stop(); } catch (_) {}
            });
        }
        belongingsCameraStream = null;

        const video = document.getElementById('belongingsCameraVideo');
        if (video) video.srcObject = null;

        const modal = document.getElementById('belongingsCameraModal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    async function openBelongingsCamera(card) {
        belongingsCameraCard = card;
        localStorage.setItem('waffleActiveTab', 'belongings');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const input = card && card.querySelector('[data-belongings-photo-input]');
            alert('This browser cannot open the in-page camera. Please use "Upload Photo" instead.');
            if (input) input.click();
            return;
        }

        closeBelongingsCamera();

        const modal = document.getElementById('belongingsCameraModal');
        const video = document.getElementById('belongingsCameraVideo');

        try {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');

            belongingsCameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 960 }
                }
            });

            video.srcObject = belongingsCameraStream;
            await video.play();
        } catch (error) {
            closeBelongingsCamera();
            console.error('Camera could not be opened:', error);
            alert(
                'Camera access could not be opened.\n\n' +
                'Please allow camera permission for this site, or use "Upload Photo" instead.'
            );
        }
    }

    async function captureBelongingsCameraPhoto() {
        const card = belongingsCameraCard;
        const video = document.getElementById('belongingsCameraVideo');
        if (!card || !video || !video.videoWidth || !video.videoHeight) {
            alert('The camera is not ready yet. Please wait a moment and try again.');
            return;
        }

        const captureButton = document.getElementById('belongingsCameraCaptureBtn');
        captureButton.disabled = true;
        captureButton.innerText = '⏳ Capturing...';

        try {
            const maxDimension = 900;
            const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
            const width = Math.max(1, Math.round(video.videoWidth * scale));
            const height = Math.max(1, Math.round(video.videoHeight * scale));

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d', { alpha: false });
            context.drawImage(video, 0, 0, width, height);

            const photoData = canvas.toDataURL('image/jpeg', 0.68);

            closeBelongingsCamera();

            await uploadBelongingsPhotoData(card, photoData, null);
        } catch (error) {
            console.error('Camera capture failed:', error);
            alert('❌ PHOTO WAS NOT SAVED\n\n' + error.message);
        } finally {
            captureButton.disabled = false;
            captureButton.innerText = '📸 Capture Photo';
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Unable to read the selected photo.'));
            reader.readAsDataURL(file);
        });
    }

    async function compressBelongingsPhoto(file) {
        if (!file || !String(file.type || '').startsWith('image/')) {
            throw new Error('Please choose an image file.');
        }

        let imageSource = null;
        let sourceWidth = 0;
        let sourceHeight = 0;
        let objectToClose = null;

        try {
            if ('createImageBitmap' in window) {
                try {
                    const bitmap = await createImageBitmap(file);
                    imageSource = bitmap;
                    objectToClose = bitmap;
                    sourceWidth = bitmap.width;
                    sourceHeight = bitmap.height;
                } catch (_) {
                    // Fall back to FileReader/Image below.
                }
            }

            if (!imageSource) {
                const sourceDataUrl = await readFileAsDataUrl(file);
                const image = new Image();

                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = () => reject(new Error(
                        'This image format could not be opened. Try taking or uploading a JPG/PNG photo instead.'
                    ));
                    image.src = sourceDataUrl;
                });

                imageSource = image;
                sourceWidth = image.naturalWidth || image.width;
                sourceHeight = image.naturalHeight || image.height;
            }

            const maxDimension = 900;
            const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
            const width = Math.max(1, Math.round(sourceWidth * scale));
            const height = Math.max(1, Math.round(sourceHeight * scale));

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d', { alpha: false });
            context.drawImage(imageSource, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', 0.68);
            if (compressed.length > 6.5 * 1024 * 1024) {
                throw new Error('The photo is still too large after compression. Please choose a smaller photo.');
            }

            return compressed;
        } finally {
            if (objectToClose && typeof objectToClose.close === 'function') {
                try { objectToClose.close(); } catch (_) {}
            }
        }
    }

    async function uploadBelongingsPhoto(card, file, input) {
        if (!card || !file) return;

        const status = card.querySelector('[data-belongings-photo-status]');
        if (status) status.textContent = '⏳ Preparing photo...';
        if (input) input.disabled = true;

        try {
            const photoData = await compressBelongingsPhoto(file);
            await uploadBelongingsPhotoData(card, photoData, input);
        } catch (error) {
            console.error('Photo upload failed:', error);
            if (status) status.textContent = '❌ ' + error.message;
            alert('❌ PHOTO WAS NOT SAVED\n\n' + error.message);
            if (input) input.disabled = false;
        }
    }

    function submitBelongingsPhotoViaForm(payload) {
        return new Promise((resolve, reject) => {
            if (
                !APPS_SCRIPT_WEBAPP_URL ||
                APPS_SCRIPT_WEBAPP_URL.includes('YOUR_APPS_SCRIPT_WEBAPP_URL_HERE')
            ) {
                reject(new Error('Apps Script Web App URL is not configured.'));
                return;
            }

            const uploadToken = String(
                (payload && payload.uploadToken) || Date.now()
            ).replace(/[^A-Za-z0-9_-]/g, '');

            const frameName = 'wafflePhotoUploadFrame_' + uploadToken;

            const iframe = document.createElement('iframe');
            iframe.name = frameName;
            iframe.id = frameName;
            iframe.style.display = 'none';
            iframe.setAttribute('aria-hidden', 'true');

            const form = document.createElement('form');
            form.method = 'POST';

            // Also place action/token in the URL. If the body is rejected or
            // truncated, Apps Script can still mark the exact upload as failed.
            const urlSeparator = APPS_SCRIPT_WEBAPP_URL.includes('?') ? '&' : '?';
            form.action =
                APPS_SCRIPT_WEBAPP_URL +
                urlSeparator +
                'action=upload_belongings_photo' +
                '&uploadToken=' + encodeURIComponent(uploadToken);

            form.target = frameName;
            form.enctype = 'application/x-www-form-urlencoded';
            form.acceptCharset = 'UTF-8';
            form.style.display = 'none';

            const addField = (name, value, useTextarea = false) => {
                const field = useTextarea
                    ? document.createElement('textarea')
                    : document.createElement('input');

                field.name = name;

                if (!useTextarea) {
                    field.type = 'hidden';
                }

                field.value = value == null ? '' : String(value);
                form.appendChild(field);
            };

            // Send separate form fields rather than one very large JSON field.
            addField('action', 'upload_belongings_photo');
            addField('uploadToken', uploadToken);
            addField('stayKey', payload.stayKey || '');
            addField('dogName', payload.dogName || '');
            addField('startDate', payload.startDate || '');
            addField('endDate', payload.endDate || '');
            addField('photoLabel', payload.photoLabel || '');
            addField('itemsJson', JSON.stringify(payload.items || {}), true);
            addField('photoData', payload.photoData || '', true);

            document.body.appendChild(iframe);
            document.body.appendChild(form);

            let submitted = false;

            iframe.addEventListener('load', function() {
                if (!submitted) return;
                console.log(
                    '[Waffle House] hidden photo upload iframe completed a navigation'
                );
            });

            try {
                submitted = true;
                form.submit();

                // Keep BOTH the form and iframe alive while Google follows its
                // Apps Script redirect chain. Removing either too quickly can
                // cancel a large POST on mobile browsers.
                setTimeout(() => {
                    if (form.parentNode) form.parentNode.removeChild(form);
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                }, 120000);

                // We cannot read the cross-origin iframe response, so the
                // separate upload-status endpoint remains the source of truth.
                resolve();

            } catch (error) {
                if (form.parentNode) form.parentNode.removeChild(form);
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);

                reject(new Error(
                    'The browser could not submit the photo to Apps Script: ' +
                    (error && error.message
                        ? error.message
                        : String(error))
                ));
            }
        });
    }


    function makeBelongingsPhotoUploadToken() {
        return 'photo_' + Date.now() + '_' +
            Math.random().toString(36).slice(2, 12);
    }

    async function uploadBelongingsPhotoData(card, photoData, input) {
        if (!card || !photoData) return;

        belongingsUploadInProgress = true;

        const status = card.querySelector('[data-belongings-photo-status]');
        const photoLabelInput = card.querySelector('[data-belongings-photo-label]');
        const payloadBase = getBelongingsCardPayload(card);
        const previousCount = belongingsRecordsCache[payloadBase.stayKey]?.photos?.length || 0;
        const uploadToken = makeBelongingsPhotoUploadToken();

        if (input) input.disabled = true;

        try {
            if (status) status.textContent = '💾 Saving belongings details...';

            await sendPayloadToAppsScript({
                action: 'save_belongings',
                ...payloadBase
            });

            await queryAppsScript({
                action: 'begin_belongings_photo_upload',
                uploadToken
            });

            const photoLabel = photoLabelInput?.value.trim() || 'Belongings photo';
            if (status) status.textContent = '☁️ Sending photo securely to Apps Script...';

            await submitBelongingsPhotoViaForm({
                action: 'upload_belongings_photo',
                uploadToken,
                ...payloadBase,
                photoLabel,
                photoData
            });

            if (status) status.textContent = '🔎 Waiting for Google Drive confirmation...';

            const uploadResult = await waitForBelongingsPhotoUploadStatus(uploadToken);

            if (uploadResult.state !== 'success') {
                throw new Error(
                    uploadResult.error ||
                    uploadResult.message ||
                    'The photo upload failed.'
                );
            }

            const updatedRecord = await waitForBelongingsPhotoRecord(
                payloadBase.stayKey,
                previousCount
            );

            belongingsRecordsCache[payloadBase.stayKey] = updatedRecord;

            if (status) status.textContent = '✅ Photo saved to Google Drive';

            directoryPhotoRecordsCache[
                payloadBase.stayKey
            ] = updatedRecord;

            careRiskRecordsCache[
                payloadBase.stayKey
            ] = updatedRecord;

            setDirectoryDogPhoto(
                payloadBase.stayKey,
                updatedRecord
            );

            setDirectoryCareFlags(
                payloadBase.stayKey,
                updatedRecord
            );

            renderDirectoryOperationalSections(
                payloadBase.stayKey,
                updatedRecord
            );

        } catch (error) {
            console.error('Photo upload failed:', error);
            if (status) status.textContent = '❌ ' + error.message;
            throw error;
        } finally {
            belongingsUploadInProgress = false;
            if (input) input.disabled = false;
        }
    }

    async function waitForBelongingsPhotoUploadStatus(uploadToken) {
        let lastStatus = null;

        for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(resolve =>
                setTimeout(resolve, attempt === 0 ? 800 : 1400)
            );

            const response = await queryAppsScript({
                action: 'get_belongings_photo_upload_status',
                uploadToken
            }, {
                maxAttempts: 2,
                timeoutMs: 45000
            });

            lastStatus = response.uploadStatus || null;

            if (!lastStatus) continue;

            if (lastStatus.state === 'success') {
                return lastStatus;
            }

            if (lastStatus.state === 'error') {
                throw new Error(
                    lastStatus.error ||
                    'Apps Script reported an unknown photo upload error.'
                );
            }
        }

        if (lastStatus && (lastStatus.state === 'pending' || lastStatus.state === 'missing')) {
            throw new Error(
                'The browser prepared the upload, but the photo POST request did not reach Apps Script. Check the Web App URL and deployment access.'
            );
        }

        if (lastStatus && (lastStatus.state === 'received' || lastStatus.state === 'processing')) {
            throw new Error(
                lastStatus.state === 'received'
                    ? 'The photo POST reached Apps Script, but Apps Script did not finish decoding the form body. Check Apps Script > Executions for the exact doPost error.'
                    : 'Apps Script decoded the photo but did not finish saving it within 45 seconds. Check Apps Script > Executions for the exact Drive/Sheets error.'
            );
        }

        throw new Error(
            'No server-side photo upload status was returned. Check that the latest Code.gs version is deployed.'
        );
    }

    async function waitForBelongingsPhotoRecord(stayKey, previousCount) {
        for (let attempt = 0; attempt < 8; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 700));
            }

            const response = await queryAppsScript({
                action: 'get_belongings',
                stayKeys: [stayKey]
            }, {
                maxAttempts: 2,
                timeoutMs: 45000
            });

            const record = (response.records || [])
                .find(item => item.stayKey === stayKey);

            if (
                record &&
                Array.isArray(record.photos) &&
                record.photos.length > previousCount
            ) {
                return record;
            }
        }

        throw new Error(
            'Google Drive reported success, but the new photo is not visible in the Pet_Belongings sheet yet.'
        );
    }

    async function deleteBelongingsPhoto(card, button) {
        if (!card || !button) return;
        const photoId = button.dataset.deleteBelongingsPhoto;
        if (!photoId) return;
        if (!confirm('Delete this belongings photo from the shared record and Google Drive?')) return;

        button.disabled = true;
        try {
            await sendPayloadToAppsScript({
                action: 'delete_belongings_photo',
                stayKey: card.dataset.stayKey,
                photoId
            });

            const response = await queryAppsScript({
                action: 'get_belongings',
                stayKeys: [card.dataset.stayKey]
            });

            const record =
                (response.records || [])
                    .find(item =>
                        item.stayKey ===
                        card.dataset.stayKey
                    );

            if (record) {
                belongingsRecordsCache[
                    card.dataset.stayKey
                ] = record;

                careRiskRecordsCache[
                    card.dataset.stayKey
                ] = record;

                directoryPhotoRecordsCache[
                    card.dataset.stayKey
                ] = record;

                setDirectoryDogPhoto(
                    card.dataset.stayKey,
                    record
                );

                setDirectoryCareFlags(
                    card.dataset.stayKey,
                    record
                );

                renderDirectoryOperationalSections(
                    card.dataset.stayKey,
                    record
                );
            }
        } catch (error) {
            alert('❌ PHOTO WAS NOT DELETED\n\n' + error.message);
            button.disabled = false;
        }
    }

    function escapeDashboardHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getCalendarEventDateString(event) {
        if (!event) return "";

        const props = event.extendedProps || {};
        const rawValue = props.rawStartDate || event.start || event.startStr || "";

        if (rawValue instanceof Date) {
            return rawValue.getFullYear() + '-' +
                String(rawValue.getMonth() + 1).padStart(2, '0') + '-' +
                String(rawValue.getDate()).padStart(2, '0');
        }

        return parseCsvDate(rawValue).slice(0, 10);
    }

    function getMeetGreetTime(event) {
        const props = (event && event.extendedProps) || {};

        if (props.time && String(props.time).trim()) {
            return String(props.time).trim();
        }

        const titleMatch = String((event && event.title) || "").match(/(\d{1,2}:\d{2})/);
        if (titleMatch) return titleMatch[1];

        const notesMatch = String(props.notes || "").match(/(\d{1,2}:\d{2})/);
        return notesMatch ? notesMatch[1] : "10:00";
    }

    function meetGreetTimeToMinutes(timeValue) {
        const match = String(timeValue || "").match(/(\d{1,2}):(\d{2})/);
        if (!match) return 24 * 60;

        const hours = Math.max(0, Math.min(23, Number(match[1])));
        const minutes = Math.max(0, Math.min(59, Number(match[2])));
        return (hours * 60) + minutes;
    }

    function updateTodayMeetGreetPanel(events) {
        const list = document.getElementById('today-meet-greet-list');
        const dateLabel = document.getElementById('meet-greet-today-date');
        if (!list) return;

        const todayStr = getLocalTodayDateString();
        const todayDate = new Date(todayStr + 'T00:00:00');

        if (dateLabel && !isNaN(todayDate.getTime())) {
            dateLabel.textContent = todayDate.toLocaleDateString('en-AU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
            });
        }

        const todayMeetGreets = (Array.isArray(events) ? events : [])
            .filter(event => {
                const props = (event && event.extendedProps) || {};
                return props.isMeetGreet === true &&
                    getCalendarEventDateString(event) === todayStr;
            })
            .map(event => {
                const props = event.extendedProps || {};
                return {
                    time: getMeetGreetTime(event),
                    dogName: props.dogName || String(event.title || "").replace(/^.*Meet & Greet:\s*/i, '').trim() || "Unnamed dog",
                    breed: props.breed && props.breed !== "N/A" ? props.breed : ""
                };
            })
            .sort((a, b) => {
                const timeDiff = meetGreetTimeToMinutes(a.time) - meetGreetTimeToMinutes(b.time);
                if (timeDiff !== 0) return timeDiff;
                return a.dogName.localeCompare(b.dogName);
            });

        if (todayMeetGreets.length === 0) {
            list.innerHTML = '<li class="no-dogs">No Meet & Greets scheduled today</li>';
            return;
        }

        list.innerHTML = todayMeetGreets.map(item => {
            const safeTime = escapeDashboardHtml(item.time);
            const safeDogName = escapeDashboardHtml(item.dogName);
            const safeBreed = escapeDashboardHtml(item.breed);

            return `
                <li class="meet-greet-item">
                    <span class="meet-greet-time-badge">⏰ ${safeTime}</span>
                    <span class="meet-greet-details">
                        <span class="meet-greet-dog-name">🐾 ${safeDogName}</span>
                        ${safeBreed ? `<span class="meet-greet-breed">${safeBreed}</span>` : ''}
                    </span>
                </li>
            `;
        }).join('');
    }

    function updateUpcomingSevenDaysPanel(events) {
        const list =
            document.getElementById(
                'upcoming-list'
            );

        if (!list) return;

        const todayStr =
            getLocalTodayDateString();

        const today =
            new Date(
                todayStr +
                'T00:00:00'
            );

        const sevenDaysFromNow =
            new Date(
                today.getTime()
            );

        sevenDaysFromNow.setDate(
            sevenDaysFromNow.getDate() +
            7
        );

        const endStr =
            sevenDaysFromNow
                .getFullYear() +
            '-' +
            String(
                sevenDaysFromNow
                    .getMonth() + 1
            ).padStart(2, '0') +
            '-' +
            String(
                sevenDaysFromNow
                    .getDate()
            ).padStart(2, '0');

        const items = [];
        const seen = new Set();

        (Array.isArray(events)
            ? events
            : []
        ).forEach(event => {
            const props =
                (event &&
                 event.extendedProps) ||
                {};

            const dateStr =
                getCalendarEventDateString(
                    event
                );

            /*
             * Keep the same behaviour as the existing arrivals panel:
             * tomorrow through seven days from today. Today's Meet & Greets
             * remain in the separate "Meet & Greets Today" panel.
             */
            if (
                !dateStr ||
                dateStr <= todayStr ||
                dateStr > endStr
            ) {
                return;
            }

            if (
                props.isPotential === true
            ) {
                return;
            }

            const dogName =
                String(
                    props.dogName ||
                    event.title ||
                    'Unnamed dog'
                )
                    .replace(
                        /^.*Meet & Greet:\s*/i,
                        ''
                    )
                    .replace(
                        /^⏰\s*\d{1,2}:\d{2}\s*-\s*/i,
                        ''
                    )
                    .trim() ||
                'Unnamed dog';

            if (
                props.isMeetGreet === true
            ) {
                const time =
                    getMeetGreetTime(
                        event
                    );

                const key =
                    [
                        'meet',
                        dogName.toLowerCase(),
                        dateStr,
                        time
                    ].join('|');

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);

                items.push({
                    type: 'meet',
                    dateStr,
                    time,
                    sortTime:
                        meetGreetTimeToMinutes(
                            time
                        ),
                    dogName
                });

                return;
            }

            /*
             * Normal/confirmed boarding event:
             * the event start is the arrival date.
             */
            const bookingType =
                String(
                    props.bookingType ||
                    ''
                ).toLowerCase();

            if (
                bookingType ===
                    'meet & greet' ||
                bookingType ===
                    'potential stay'
            ) {
                return;
            }

            const key =
                [
                    'arrival',
                    dogName.toLowerCase(),
                    dateStr
                ].join('|');

            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            items.push({
                type: 'arrival',
                dateStr,
                time: '',
                sortTime: -1,
                dogName
            });
        });

        items.sort((a, b) => {
            const dateCompare =
                a.dateStr.localeCompare(
                    b.dateStr
                );

            if (dateCompare !== 0) {
                return dateCompare;
            }

            /*
             * Boarding arrivals appear first on a shared date,
             * followed by Meet & Greets in expected-time order.
             */
            if (a.type !== b.type) {
                return a.type ===
                    'arrival'
                    ? -1
                    : 1;
            }

            if (
                a.type === 'meet'
            ) {
                const timeCompare =
                    a.sortTime -
                    b.sortTime;

                if (timeCompare !== 0) {
                    return timeCompare;
                }
            }

            return a.dogName
                .localeCompare(
                    b.dogName
                );
        });

        if (!items.length) {
            list.innerHTML =
                '<li class="no-dogs">No arrivals or Meet & Greets scheduled in the next 7 days</li>';
            return;
        }

        list.innerHTML =
            items.map(item => {
                const date =
                    new Date(
                        item.dateStr +
                        'T00:00:00'
                    );

                const dateLabel =
                    Number.isNaN(
                        date.getTime()
                    )
                        ? item.dateStr
                        : (
                            date.getDate() +
                            '/' +
                            (
                                date.getMonth() +
                                1
                            )
                        );

                const safeDog =
                    escapeDashboardHtml(
                        item.dogName
                    );

                const safeDate =
                    escapeDashboardHtml(
                        dateLabel
                    );

                if (
                    item.type ===
                    'meet'
                ) {
                    const safeTime =
                        escapeDashboardHtml(
                            item.time
                        );

                    return `
                        <li class="upcoming-meet-greet">
                            <span class="upcoming-meet-greet-label">
                                🤝 Meet &amp; Greet: ${safeDog}
                            </span>
                            <span class="upcoming-meet-greet-meta">
                                <span class="upcoming-meet-time">
                                    ⏰ ${safeTime}
                                </span>
                                <span class="date-badge">
                                    ${safeDate}
                                </span>
                            </span>
                        </li>
                    `;
                }

                return `
                    <li>
                        <span>
                            ⏳ ${safeDog}
                        </span>
                        <span class="date-badge">
                            ${safeDate}
                        </span>
                    </li>
                `;
            }).join('');
    }


    function refreshCalendarData() {
        if (!globalCalendar) return;

        globalCalendar.getEventSources().forEach(source => source.remove());

        const csvText = localStorage.getItem('boardingDataCache') || "";
        dailyCapacityCounts = {}; 

        const spreadsheetEvents = parseCSVToEvents(csvText);
        const localMeets = getLocalArray('temporaryMeetGreets');
        const localPotentials = getLocalArray('temporaryPotentialStays');
        const localConfirmed = getLocalArray('temporaryConfirmedStays');

        localPotentials.forEach(addLocalEventCapacity);
        localConfirmed.forEach(addLocalEventCapacity);

        const allCalendarEvents = spreadsheetEvents.concat(localMeets, localPotentials, localConfirmed);

        updateFullyBookedPanel();
        updateTodayMeetGreetPanel(allCalendarEvents);
        updateUpcomingSevenDaysPanel(allCalendarEvents);
        globalCalendar.addEventSource(allCalendarEvents);
        applyCurrentSearchFilter();
    }

    function updateFullyBookedPanel() {
        const capacityList =
            document.getElementById('full-dates-list');

        if (!capacityList) return;

        const todayStr =
            getLocalTodayDateString();

        const addDays = (dateStr, days) => {
            const date =
                new Date(dateStr + 'T00:00:00');

            date.setDate(
                date.getDate() + days
            );

            return (
                date.getFullYear() +
                '-' +
                String(date.getMonth() + 1).padStart(2, '0') +
                '-' +
                String(date.getDate()).padStart(2, '0')
            );
        };

        // Always show at least a 14-day capacity outlook.
        const minimumHorizonEnd =
            addDays(todayStr, 13);

        const futureScheduledDates =
            Object.keys(dailyCapacityCounts)
                .filter(dateStr =>
                    dateStr >= todayStr
                )
                .sort();

        const latestScheduledDate =
            futureScheduledDates.length
                ? futureScheduledDates[
                    futureScheduledDates.length - 1
                  ]
                : todayStr;

        const horizonEnd =
            latestScheduledDate > minimumHorizonEnd
                ? latestScheduledDate
                : minimumHorizonEnd;

        const capacityBand = count => {
            if (count >= 4) {
                return {
                    key: 'red',
                    label: 'Full',
                    dot: '🔴',
                    badgeClass: 'capacity-red'
                };
            }

            if (count === 3) {
                return {
                    key: 'amber',
                    label: 'Busy',
                    dot: '🟠',
                    badgeClass: 'capacity-amber'
                };
            }

            return {
                key: 'green',
                label: 'Available',
                dot: '🟢',
                badgeClass: 'capacity-green'
            };
        };

        const dates = [];
        let cursor = todayStr;

        while (cursor <= horizonEnd) {
            const count =
                Number(
                    dailyCapacityCounts[cursor] || 0
                );

            dates.push({
                date: cursor,
                count,
                band: capacityBand(count)
            });

            cursor = addDays(cursor, 1);
        }

        // Group consecutive dates by colour/status.
        const ranges = [];

        dates.forEach(item => {
            const current =
                ranges[ranges.length - 1];

            if (
                current &&
                current.band.key === item.band.key &&
                addDays(current.end, 1) === item.date
            ) {
                current.end = item.date;
                current.counts.push(item.count);
                return;
            }

            ranges.push({
                start: item.date,
                end: item.date,
                counts: [item.count],
                band: item.band
            });
        });

        const formatCapacityDate = dateStr => {
            const dateObj =
                new Date(dateStr + 'T00:00:00');

            return dateObj.toLocaleDateString(
                'en-AU',
                {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }
            );
        };

        capacityList.innerHTML =
            ranges.map(range => {
                const startLabel =
                    formatCapacityDate(range.start);

                const endLabel =
                    formatCapacityDate(range.end);

                const dateLabel =
                    range.start === range.end
                        ? startLabel
                        : `${startLabel} – ${endLabel}`;

                const minDogs =
                    Math.min(...range.counts);

                const maxDogs =
                    Math.max(...range.counts);

                const dogLabel =
                    minDogs === maxDogs
                        ? `${minDogs} ${minDogs === 1 ? 'DOG' : 'DOGS'}`
                        : `${minDogs}–${maxDogs} DOGS`;

                return `
                    <li>
                        <span class="capacity-range-label">
                            ${range.band.dot}
                            📅 ${dateLabel}
                        </span>
                        <span
                            class="date-badge ${range.band.badgeClass}"
                            title="${range.band.label}">
                            ${dogLabel}
                        </span>
                    </li>
                `;
            }).join('');
    }

    function applyCurrentSearchFilter() {
        if (!globalCalendar) return;
        const searchTerm = (document.getElementById('calendarSearch')?.value || "").toLowerCase().trim();
        globalCalendar.getEvents().forEach(ev => {
            if (searchTerm === "") { ev.setProp('display', 'auto'); } 
            else {
                const title = ev.title.toLowerCase();
                const breed = (ev.extendedProps.breed || '').toLowerCase();
                ev.setProp('display', (title.includes(searchTerm) || breed.includes(searchTerm)) ? 'auto' : 'none');
            }
        });

    }

    const BOARDING_EVENT_PALETTE = [
        '#334155', // slate
        '#1e3a8a', // navy blue
        '#1d4ed8', // royal blue
        '#4338ca', // indigo
        '#5b21b6', // violet
        '#166534', // forest green
        '#3f6212', // olive green
        '#7c2d12', // earth brown
        '#9f1239', // deep rose
        '#374151'  // graphite
    ];

    function stringToColor(str) {
        let hash = 0;
        const value = String(str || 'Boarding');
        for (let i = 0; i < value.length; i++) {
            hash = value.charCodeAt(i) + ((hash << 5) - hash);
        }
        return BOARDING_EVENT_PALETTE[Math.abs(hash) % BOARDING_EVENT_PALETTE.length];
    }

    function triggerCheckoutFlow(stayId, dogName) {
        if (confirm(`Has ${dogName} been picked up?`)) {
            const todayStr = getLocalTodayDateString();
            let currentlyPickedUp = JSON.parse(localStorage.getItem('pickedUpDogs_' + todayStr) || '[]');
            if (!currentlyPickedUp.includes(stayId)) {
                currentlyPickedUp.push(stayId);
                localStorage.setItem('pickedUpDogs_' + todayStr, JSON.stringify(currentlyPickedUp));
            }
            const csvText = localStorage.getItem('boardingDataCache') || "";
            parseCSVToEvents(csvText);
            if (globalCalendar) globalCalendar.refetchEvents();
        }
    }

    function routeToCalendarDate(dateStr) {
        if (globalCalendar && dateStr) {
            globalCalendar.gotoDate(dateStr);
        }
    }

    const DIRECTORY_EDIT_FIELD_CONFIG = {
        dogName: {
            label: 'Dog Name',
            placeholder: 'e.g. Waffle',
            multiline: false
        },
        breed: {
            label: 'Breed',
            placeholder: 'e.g. Pug',
            multiline: false
        },
        ownerName: {
            label: 'Owner',
            placeholder: 'Owner name',
            multiline: false
        },
        phone: {
            label: 'Contact Number',
            placeholder: 'e.g. 0412 345 678',
            multiline: false
        },
        notes: {
            label: 'Notes',
            placeholder: 'General guest notes',
            multiline: true
        }
    };

    function closeGuestDetailEditor() {
        const modal = document.getElementById('guestDetailEditModal');
        if (!modal) return;

        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        activeDirectoryEditContext = null;

        const status = document.getElementById('guestDetailEditStatus');
        if (status) {
            status.textContent = '';
            status.className = 'guest-detail-edit-status';
        }
    }

    function openGuestDetailEditor(trigger) {
        if (!trigger) return;

        const card = trigger.closest('.directory-card');
        const fieldKey = String(
            trigger.dataset.directoryEditField || ''
        ).trim();

        const config = DIRECTORY_EDIT_FIELD_CONFIG[fieldKey];

        if (!card || !config) return;

        const dogName = String(
            card.dataset.directoryDogName || ''
        ).trim();

        const startDate = String(
            card.dataset.directoryStartDate || ''
        ).trim();

        const endDate = String(
            card.dataset.directoryEndDate || ''
        ).trim();

        const currentValue = String(
            trigger.dataset.directoryCurrentValue || ''
        );

        activeDirectoryEditContext = {
            card,
            trigger,
            fieldKey,
            originalDogName: dogName,
            startDate,
            endDate,
            oldStayKey: String(
                card.dataset.directoryStayKey || ''
            ).trim()
        };

        const modal = document.getElementById('guestDetailEditModal');
        const title = document.getElementById('guestDetailEditTitle');
        const dogLine = document.getElementById('guestDetailEditDog');
        const label = document.getElementById('guestDetailEditLabel');
        const input = document.getElementById('guestDetailEditInput');
        const textarea = document.getElementById('guestDetailEditTextarea');
        const status = document.getElementById('guestDetailEditStatus');

        title.textContent = `✏️ Edit ${config.label}`;
        dogLine.textContent =
            `${dogName} · ${formatStayDateShort(startDate)} – ${formatStayDateShort(endDate)}`;
        label.textContent = config.label;

        input.style.display = config.multiline ? 'none' : 'block';
        textarea.style.display = config.multiline ? 'block' : 'none';

        if (config.multiline) {
            textarea.value = currentValue;
            textarea.placeholder = config.placeholder;
        } else {
            input.value = currentValue;
            input.placeholder = config.placeholder;
            input.type = fieldKey === 'phone' ? 'tel' : 'text';
        }

        status.textContent =
            'Changes are saved directly to the shared Google Sheet.';
        status.className = 'guest-detail-edit-status';

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            const control = config.multiline ? textarea : input;
            control.focus();
            if (!config.multiline) control.select();
        }, 30);
    }

    function decodeDirectoryCsvCell(value) {
        let text = String(value ?? '');

        if (text.startsWith('"') && text.endsWith('"')) {
            text = text.slice(1, -1).replace(/""/g, '"');
        }

        return text;
    }

    function encodeDirectoryCsvCell(value) {
        const text = String(value ?? '');

        if (/[",\r\n]/.test(text)) {
            return '"' + text.replace(/"/g, '""') + '"';
        }

        return text;
    }

    function patchGuestRecordInCachedCsv(original, record) {
        const csv = localStorage.getItem('boardingDataCache') || '';
        if (!csv || !record) return false;

        const lines = csv.split(/\r?\n/);
        const targetDog = String(
            original.originalDogName || ''
        ).trim().toLowerCase();

        const targetStart = String(original.startDate || '').trim();
        const targetEnd = String(
            original.endDate || original.startDate || ''
        ).trim();

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const rawCells = lines[i].split(
                /,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/
            );

            const cells = rawCells.map(decodeDirectoryCsvCell);

            while (cells.length < 12) cells.push('');

            const rowDog = String(cells[1] || '').trim().toLowerCase();
            const rowStart = parseCsvDate(cells[3]);
            const rowEnd = parseCsvDate(cells[4]) || rowStart;
            const rowType = String(cells[11] || '').trim().toLowerCase();

            if (
                rowType === 'meet & greet' ||
                rowType === 'potential stay'
            ) {
                continue;
            }

            if (rowDog !== targetDog) continue;
            if (rowStart !== targetStart) continue;
            if (rowEnd !== targetEnd) continue;

            cells[1] = record.dogName || '';
            cells[2] = record.breed || '';
            cells[3] = record.startDate || targetStart;
            cells[4] = record.endDate || targetEnd;
            cells[5] = record.ownerName || '';
            cells[6] = record.phone || '';
            // Likes / Dislikes columns are legacy and no longer managed by the Web App.
            cells[9] = record.notes || '';
            cells[10] = record.editLink || cells[10] || '';
            cells[11] = record.bookingType || cells[11] || 'Boarding';

            lines[i] = cells
                .map(encodeDirectoryCsvCell)
                .join(',');

            localStorage.setItem(
                'boardingDataCache',
                lines.join('\n')
            );

            return true;
        }

        return false;
    }

    function migrateDirectoryClientStayKey(
        oldStayKey,
        newStayKey,
        newDogName,
        startDate,
        endDate
    ) {
        if (!oldStayKey || !newStayKey || oldStayKey === newStayKey) {
            return;
        }

        [
            belongingsRecordsCache,
            careRiskRecordsCache,
            directoryPhotoRecordsCache,
            directoryIntakeStatusCache,
            directoryLegacyIntakeCache
        ].forEach(cache => {
            if (
                !cache ||
                !Object.prototype.hasOwnProperty.call(cache, oldStayKey)
            ) {
                return;
            }

            const oldRecord = cache[oldStayKey];
            delete cache[oldStayKey];

            if (oldRecord && typeof oldRecord === 'object') {
                cache[newStayKey] = {
                    ...oldRecord,
                    stayKey: newStayKey,
                    dogName: newDogName
                };
            } else {
                cache[newStayKey] = oldRecord;
            }
        });

        const todayKey =
            'pickedUpDogs_' + getLocalTodayDateString();

        const pickedUp = getLocalArray(todayKey);
        const oldPickupKey =
            `${activeDirectoryEditContext?.originalDogName || ''}_${startDate}_${endDate}`;
        const newPickupKey =
            `${newDogName}_${startDate}_${endDate}`;

        const oldIndex = pickedUp.indexOf(oldPickupKey);

        if (oldIndex !== -1) {
            pickedUp[oldIndex] = newPickupKey;
            setLocalArray(todayKey, Array.from(new Set(pickedUp)));
        }
    }

    async function saveGuestDetailFromEditor() {
        const context = activeDirectoryEditContext;
        if (!context) return;

        const config = DIRECTORY_EDIT_FIELD_CONFIG[context.fieldKey];
        if (!config) return;

        const input = document.getElementById('guestDetailEditInput');
        const textarea = document.getElementById('guestDetailEditTextarea');
        const saveButton = document.getElementById('saveGuestDetailEdit');
        const cancelButton = document.getElementById('cancelGuestDetailEdit');
        const closeButton = document.getElementById('closeGuestDetailEditModal');
        const status = document.getElementById('guestDetailEditStatus');

        const value = String(
            config.multiline ? textarea.value : input.value
        ).trim();

        if (context.fieldKey === 'dogName' && !value) {
            status.textContent = '⚠️ Dog Name cannot be blank.';
            status.className =
                'guest-detail-edit-status is-error';
            return;
        }

        saveButton.disabled = true;
        cancelButton.disabled = true;
        closeButton.disabled = true;
        saveButton.textContent = '⏳ Saving...';

        status.textContent =
            'Saving to the shared Google Sheet...';
        status.className = 'guest-detail-edit-status is-saving';

        try {
            const response = await sendPayloadToAppsScript({
                action: 'update_guest_detail',
                fieldKey: context.fieldKey,
                value,
                originalDogName: context.originalDogName,
                startDate: context.startDate,
                endDate: context.endDate
            });

            const record = response.record || null;

            if (!record) {
                throw new Error(
                    'The server saved the change but did not return the updated guest record.'
                );
            }

            patchGuestRecordInCachedCsv(context, record);

            const oldStayKey =
                response.oldStayKey ||
                context.oldStayKey ||
                makePotentialKey(
                    context.originalDogName,
                    context.startDate,
                    context.endDate
                );

            const newStayKey =
                response.newStayKey ||
                makePotentialKey(
                    record.dogName,
                    record.startDate,
                    record.endDate
                );

            migrateDirectoryClientStayKey(
                oldStayKey,
                newStayKey,
                record.dogName,
                record.startDate,
                record.endDate
            );

            status.textContent =
                `✅ ${response.fieldLabel || config.label} saved and synced.`;
            status.className =
                'guest-detail-edit-status is-success';

            // Re-render all dashboard and calendar references immediately
            // from the locally patched copy while the published CSV catches up.
            refreshCalendarData();

            const cachedCsv =
                localStorage.getItem('boardingDataCache') || '';

            loadCareRiskDashboard(cachedCsv)
                .catch(() => {});

            setTimeout(() => {
                closeGuestDetailEditor();
            }, 500);

        } catch (error) {
            console.error('Guest detail update failed:', error);

            status.textContent =
                '❌ ' + (error.message || String(error));

            status.className =
                'guest-detail-edit-status is-error';

        } finally {
            saveButton.disabled = false;
            cancelButton.disabled = false;
            closeButton.disabled = false;
            saveButton.textContent = '💾 Save Changes';
        }
    }

    function routeToDatabaseCell(
        baseEditLink,
        targetColumnLetter,
        petName,
        attributeName = 'Booking Details'
    ) {
        // Kept only for calendar-event compatibility. Guest Directory
        // attributes now edit directly in the web app.
        if (baseEditLink && baseEditLink.startsWith('http')) {
            const confirmRedirect = confirm(
                `✏️ Open ${attributeName} for ${petName} in the master Google Sheet?`
            );

            if (confirmRedirect) {
                let targetUrl = baseEditLink
                    .replace(
                        /range=\d+/,
                        `range=${targetColumnLetter}\$&`
                    )
                    .replace(
                        'range=',
                        `range=${targetColumnLetter}`
                    );

                if (!targetUrl.includes('range=')) {
                    const rowMatch =
                        baseEditLink.match(/range=(\d+)/) ||
                        baseEditLink.match(/=(\d+)$/);

                    const rowNum = rowMatch ? rowMatch[1] : '';

                    targetUrl =
                        baseEditLink.split('&range=')[0] +
                        `&range=${targetColumnLetter}${rowNum}`;
                }

                window.open(targetUrl, '_blank');
            }
        }
    }

    function getExternalIntakeBaseUrl() {
        return String(APPS_SCRIPT_WEBAPP_URL || '')
            .replace(/[?#].*$/, '');
    }

    function buildExternalIntakeLink(token) {
        if (!token) return '';

        const baseUrl = getExternalIntakeBaseUrl();
        if (!baseUrl) return '';

        return (
            baseUrl +
            '?action=intake&token=' +
            encodeURIComponent(token)
        );
    }

    async function copyIntakeLinkToClipboard(link) {
        if (!link) return false;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
                return true;
            }
        } catch (_) {}

        window.prompt(
            'Copy this Waffle Boarding House intake link:',
            link
        );
        return false;
    }

    function getIntakeCompletionTimestamp(record, fallback = Infinity) {
        if (!record) return fallback;

        const raw =
            record.submittedAt ||
            record.uploadedAt ||
            record.updatedAt ||
            '';

        const parsed =
            Date.parse(String(raw || ''));

        return Number.isFinite(parsed)
            ? parsed
            : fallback;
    }

    function getStoredDigitalProfileIntakeStatus(stayKey) {
        const record =
            directoryPhotoRecordsCache[stayKey] ||
            belongingsRecordsCache[stayKey] ||
            careRiskRecordsCache[stayKey] ||
            null;

        if (!record) return null;

        const source =
            String(record.intakeAttributesSource || '')
                .trim()
                .toLowerCase();

        const attributes =
            record.intakeAttributes &&
            typeof record.intakeAttributes === 'object'
                ? record.intakeAttributes
                : {};

        const hasAttributes =
            Number(
                record.intakeFieldCount ||
                0
            ) > 0 ||
            Object.values(attributes)
                .some(value =>
                    String(value ?? '').trim()
                );

        if (
            !hasAttributes ||
            !source.startsWith('digital intake')
        ) {
            return null;
        }

        return {
            stayKey,
            status: 'Complete',
            token: '',
            dogName: record.dogName || '',
            submittedAt: record.updatedAt || '',
            pdfUrl: '',
            storedProfileFallback: true
        };
    }

    function getEffectiveDirectoryDigitalIntakeRecord(stayKey) {
        const cached =
            directoryIntakeStatusCache[stayKey] || null;

        if (
            cached &&
            String(cached.status || '')
                .toLowerCase() === 'complete'
        ) {
            return cached;
        }

        return (
            getStoredDigitalProfileIntakeStatus(stayKey) ||
            cached
        );
    }

    function reconcileDirectoryDigitalIntakeFromProfile(
        stayKey,
        profileRecord
    ) {
        if (!profileRecord) return;

        const source =
            String(profileRecord.intakeAttributesSource || '')
                .trim()
                .toLowerCase();

        const attributes =
            profileRecord.intakeAttributes &&
            typeof profileRecord.intakeAttributes === 'object'
                ? profileRecord.intakeAttributes
                : {};

        const hasAttributes =
            Object.values(attributes)
                .some(value =>
                    String(value ?? '').trim()
                );

        if (
            !hasAttributes ||
            !source.startsWith('digital intake')
        ) {
            return;
        }

        const existing =
            directoryIntakeStatusCache[stayKey] || null;

        if (
            existing &&
            String(existing.status || '')
                .toLowerCase() === 'complete'
        ) {
            return;
        }

        directoryIntakeStatusCache[stayKey] = {
            stayKey,
            status: 'Complete',
            token: existing?.token || '',
            dogName:
                profileRecord.dogName ||
                existing?.dogName ||
                '',
            submittedAt:
                existing?.submittedAt ||
                profileRecord.updatedAt ||
                '',
            pdfUrl: existing?.pdfUrl || '',
            storedProfileFallback: true
        };

        setDirectoryIntakeStatus(
            stayKey,
            directoryIntakeStatusCache[stayKey]
        );
    }


    function applyDirectoryIntakeMethodVisibility(stayKey) {
        const digitalStrip = Array.from(
            document.querySelectorAll(
                '[data-directory-intake]'
            )
        ).find(element =>
            String(
                element.dataset.directoryIntake ||
                ''
            ) ===
            String(stayKey || '')
        );

        const legacyStrip = Array.from(
            document.querySelectorAll(
                '[data-directory-legacy]'
            )
        ).find(element =>
            String(
                element.dataset.directoryLegacy ||
                ''
            ) ===
            String(stayKey || '')
        );

        if (
            !digitalStrip ||
            !legacyStrip
        ) {
            return;
        }

        const digitalRecord =
            getEffectiveDirectoryDigitalIntakeRecord(
                stayKey
            );

        const legacyGroup =
            directoryLegacyIntakeCache[
                stayKey
            ] || null;

        const digitalComplete =
            !!digitalRecord &&
            String(
                digitalRecord.status || ''
            ).toLowerCase() ===
                'complete';

        const legacyComplete =
            !!legacyGroup &&
            !!legacyGroup.latest;

        let showDigital = true;
        let showLegacy = true;

        if (
            digitalComplete &&
            legacyComplete
        ) {
            /*
             * Historical edge case: both document types already exist.
             * Preserve the method that was completed first so the card
             * still presents one clear source-of-record intake method.
             */
            const digitalTime =
                getIntakeCompletionTimestamp(
                    digitalRecord
                );

            const legacyTime =
                getIntakeCompletionTimestamp(
                    legacyGroup.latest
                );

            if (
                legacyTime <
                digitalTime
            ) {
                showDigital = false;
                showLegacy = true;
            } else {
                showDigital = true;
                showLegacy = false;
            }

        } else if (digitalComplete) {
            showDigital = true;
            showLegacy = false;

        } else if (legacyComplete) {
            showDigital = false;
            showLegacy = true;
        }

        digitalStrip.hidden =
            !showDigital;

        legacyStrip.hidden =
            !showLegacy;

        const card =
            digitalStrip.closest(
                '.directory-card'
            );

        if (card) {
            card.dataset.intakeMethod =
                digitalComplete &&
                showDigital
                    ? 'digital'
                    : legacyComplete &&
                      showLegacy
                        ? 'legacy'
                        : 'none';
        }
    }


    function setDirectoryIntakeStatus(stayKey, record) {
        record = record || getStoredDigitalProfileIntakeStatus(stayKey);

        const strip = Array.from(
            document.querySelectorAll('[data-directory-intake]')
        ).find(element =>
            String(element.dataset.directoryIntake || '') ===
            String(stayKey || '')
        );

        if (!strip) return;

        if (!record) {
            strip.innerHTML = `
                <div class="directory-intake-state">
                    <span class="directory-intake-dot is-not-sent"></span>
                    <span>Intake not sent</span>
                </div>
                <button
                    type="button"
                    class="directory-intake-action"
                    data-create-intake-link>
                    📝 Create Link
                </button>
            `;

            applyDirectoryIntakeMethodVisibility(
                stayKey
            );
            return;
        }

        const status = String(record.status || 'Awaiting Owner');
        const submitted = record.submittedAt
            ? formatAuditTimestamp(record.submittedAt)
            : '';

        if (status === 'Complete') {
            strip.innerHTML = `
                <div class="directory-intake-state">
                    <span class="directory-intake-dot is-complete"></span>
                    <span>
                        Intake complete${record.storedProfileFallback ? ' · Stored profile' : ''}${submitted ? ` · ${escapeDashboardHtml(submitted)}` : ''}
                    </span>
                </div>
                <div class="directory-intake-actions">
                    ${record.pdfUrl ? `
                        <a
                            href="${escapeDashboardHtml(record.pdfUrl)}"
                            target="_blank"
                            rel="noopener"
                            class="directory-intake-action is-pdf">
                            📄 PDF
                        </a>
                    ` : ''}
                    ${record.token ? `
                        <button
                            type="button"
                            class="directory-intake-action"
                            data-create-intake-link>
                            🔗 Copy Link
                        </button>
                    ` : `
                        <span class="directory-intake-action is-pdf">
                            ✓ Saved
                        </span>
                    `}
                </div>
            `;

            applyDirectoryIntakeMethodVisibility(
                stayKey
            );
            return;
        }

        strip.innerHTML = `
            <div class="directory-intake-state">
                <span class="directory-intake-dot is-awaiting"></span>
                <span>Awaiting owner</span>
            </div>
            <button
                type="button"
                class="directory-intake-action"
                data-create-intake-link>
                🔗 Copy Link
            </button>
        `;

        applyDirectoryIntakeMethodVisibility(
            stayKey
        );
    }

    async function hydrateDirectoryIntakeStatuses(options = {}) {
        const force = options.force === true;

        const cards = Array.from(
            document.querySelectorAll(
                '.directory-card[data-directory-stay-key]'
            )
        );

        if (!cards.length) return;

        const keys = Array.from(new Set(
            cards
                .map(card =>
                    String(
                        card.dataset.directoryStayKey || ''
                    ).trim()
                )
                .filter(Boolean)
        ));

        const cacheAge =
            Date.now() -
            Number(
                directoryIntakeStatusCacheLastFetch || 0
            );

        const cacheFresh =
            !force &&
            directoryIntakeStatusCacheLastFetch > 0 &&
            cacheAge < 15000;

        const keysToFetch =
            force
                ? keys
                : keys.filter(key =>
                    !Object.prototype.hasOwnProperty.call(
                        directoryIntakeStatusCache,
                        key
                    ) ||
                    !cacheFresh
                );

        keys.forEach(key => {
            if (
                Object.prototype.hasOwnProperty.call(
                    directoryIntakeStatusCache,
                    key
                )
            ) {
                setDirectoryIntakeStatus(
                    key,
                    directoryIntakeStatusCache[key]
                );
            }
        });

        if (!keysToFetch.length) return;

        try {
            const response = await queryAppsScript({
                action: 'get_intake_statuses',
                stayKeys: keysToFetch
            }, {
                maxAttempts: 2,
                timeoutMs: 45000
            });

            directoryIntakeStatusCacheLastFetch =
                Date.now();

            keysToFetch.forEach(key => {
                directoryIntakeStatusCache[key] = null;
            });

            (response.records || []).forEach(record => {
                if (!record || !record.stayKey) return;
                directoryIntakeStatusCache[record.stayKey] = record;
            });

            keysToFetch.forEach(key => {
                setDirectoryIntakeStatus(
                    key,
                    directoryIntakeStatusCache[key]
                );
            });

        } catch (error) {
            console.error(
                'Digital intake status could not be loaded:',
                error
            );
        }
    }

    async function createOrCopyDirectoryIntakeLink(card) {
        if (!card) return;

        const dogName = String(
            card.dataset.directoryDogName || ''
        ).trim();

        const startDate = String(
            card.dataset.directoryStartDate || ''
        ).trim();

        const endDate = String(
            card.dataset.directoryEndDate || ''
        ).trim();

        const stayKey = String(
            card.dataset.directoryStayKey || ''
        ).trim();

        const existing =
            directoryIntakeStatusCache[stayKey] || null;

        if (existing && existing.token) {
            const existingLink =
                buildExternalIntakeLink(existing.token);

            await copyIntakeLinkToClipboard(existingLink);

            alert(
                existing.status === 'Complete'
                    ? `✅ Intake link copied for ${dogName}. The latest signed PDF remains available from this card.`
                    : `✅ Intake link copied for ${dogName}.`
            );

            return;
        }

        const response = await sendPayloadToAppsScript({
            action: 'create_intake_link',
            dogName,
            startDate,
            endDate,
            intakeBaseUrl: getExternalIntakeBaseUrl()
        });

        const intake = response.intake;

        if (!intake || !intake.token) {
            throw new Error(
                'The intake link was not returned by Apps Script.'
            );
        }

        directoryIntakeStatusCache[stayKey] = intake;
        directoryIntakeStatusCacheLastFetch =
            Date.now();

        setDirectoryIntakeStatus(stayKey, intake);

        await copyIntakeLinkToClipboard(intake.link);

        alert(
            `✅ Digital intake link ready for ${dogName}.\n\n` +
            `Send the copied link to the owner.`
        );
    }

    async function createOrCopyPotentialIntakeLink() {
        if (!activeEditingPotential) {
            alert(
                'Save the Potential Stay first, then reopen it to create an intake link.'
            );
            return;
        }

        const response = await sendPayloadToAppsScript({
            action: 'create_intake_link',
            dogName: activeEditingPotential.dogName,
            startDate: activeEditingPotential.rawStartDate,
            endDate: activeEditingPotential.rawEndDate,
            intakeBaseUrl: getExternalIntakeBaseUrl()
        });

        const intake = response.intake;

        if (!intake || !intake.link) {
            throw new Error(
                'The intake link was not returned by Apps Script.'
            );
        }

        await copyIntakeLinkToClipboard(intake.link);

        alert(
            `✅ Digital intake link ready for ${activeEditingPotential.dogName}.\n\n` +
            `Send the copied link to the owner.`
        );
    }


    function buildLegacyIntakeUrl(
        stayKey = '',
        documentId = ''
    ) {
        const baseUrl =
            String(APPS_SCRIPT_WEBAPP_URL || '')
                .replace(/[?#].*$/, '');

        if (!baseUrl) return '';

        const params = new URLSearchParams({
            action: 'legacy_intake'
        });

        if (stayKey) {
            params.set('stayKey', stayKey);
        }

        if (documentId) {
            params.set('documentId', documentId);
        }

        return baseUrl + '?' + params.toString();
    }

    function openLegacyIntakeUploader(
        stayKey = '',
        documentId = ''
    ) {
        const url = buildLegacyIntakeUrl(
            stayKey,
            documentId
        );

        if (!url) {
            alert(
                'The Apps Script Web App URL is not configured.'
            );
            return;
        }

        let popup = window.open(
            url,
            'waffleLegacyIntake',
            'width=860,height=860,resizable=yes,scrollbars=yes'
        );

        if (!popup) {
            popup =
                window.open(
                    url,
                    '_blank'
                );
        }

        /*
         * The Apps Script intake page and GitHub dashboard are on
         * different origins. postMessage normally refreshes this card,
         * but some mobile/PWA navigation paths do not keep window.opener.
         * Polling for the child window to close gives us a second,
         * browser-independent refresh path.
         */
        if (popup) {
            const closeWatch =
                setInterval(() => {
                    try {
                        if (!popup.closed) {
                            return;
                        }
                    } catch (_) {
                        return;
                    }

                    clearInterval(
                        closeWatch
                    );

                    directoryLegacyIntakeCache = {};
                    directoryLegacyIntakeCacheLastFetch = 0;

                    hydrateDirectoryLegacyIntakes({
                        force: true
                    }).catch(error =>
                        console.error(error)
                    );
                }, 700);
        }
    }

    function setDirectoryLegacyIntakeStatus(
        stayKey,
        group
    ) {
        const strip = Array.from(
            document.querySelectorAll(
                '[data-directory-legacy]'
            )
        ).find(element =>
            String(
                element.dataset.directoryLegacy || ''
            ) ===
            String(stayKey || '')
        );

        if (!strip) return;

        if (
            !group ||
            !group.latest
        ) {
            strip.classList.remove(
                'has-document'
            );

            strip.innerHTML = `
                <div class="directory-legacy-state">
                    <span>📚 Legacy intake not uploaded</span>
                </div>
                <button
                    type="button"
                    class="directory-intake-action"
                    data-upload-legacy-intake>
                    ＋ PDF
                </button>
            `;

            applyDirectoryIntakeMethodVisibility(
                stayKey
            );
            return;
        }

        const latest = group.latest;
        const count =
            Number(group.count || 1);

        const uploaded =
            latest.uploadedAt
                ? formatAuditTimestamp(
                    latest.uploadedAt
                )
                : '';

        const aiStatus =
            String(
                latest.aiStatus || ''
            ).trim();

        const conflictCount =
            Number(
                latest.conflictCount || 0
            );

        let aiStatusHtml = '';

        if (
            aiStatus ===
            'Review Required'
        ) {
            aiStatusHtml =
                `<span class="directory-legacy-ai-status review">⚠️ ${conflictCount || ''} review</span>`;
        } else if (
            aiStatus ===
            'AI Failed'
        ) {
            aiStatusHtml =
                '<span class="directory-legacy-ai-status failed">⚠️ AI retry</span>';
        } else if (
            aiStatus ===
            'Complete'
        ) {
            aiStatusHtml =
                '<span class="directory-legacy-ai-status">✨ AI read</span>';
        } else {
            aiStatusHtml =
                '<span class="directory-legacy-ai-status">✨ Read available</span>';
        }

        strip.classList.add(
            'has-document'
        );

        strip.innerHTML = `
            <div class="directory-legacy-state">
                📚 Legacy intake ·
                ${count} ${count === 1 ? 'file' : 'files'}
                ${uploaded ? ` · ${escapeDashboardHtml(uploaded)}` : ''}
                ${aiStatusHtml}
            </div>
            <div class="directory-legacy-actions">
                ${latest.pdfUrl ? `
                    <a
                        href="${escapeDashboardHtml(latest.pdfUrl)}"
                        target="_blank"
                        rel="noopener"
                        class="directory-intake-action directory-legacy-view">
                        📄 View
                    </a>
                ` : ''}
                <button
                    type="button"
                    class="directory-intake-action"
                    data-upload-legacy-intake>
                    ＋ PDF
                </button>
                <button
                    type="button"
                    class="directory-intake-action"
                    data-reassign-legacy-intake
                    data-legacy-document-id="${escapeDashboardHtml(latest.documentId || '')}">
                    ✨ Review / Reassign
                </button>
            </div>
        `;

        applyDirectoryIntakeMethodVisibility(
            stayKey
        );
    }

    async function hydrateDirectoryLegacyIntakes(
        options = {}
    ) {
        const force =
            options.force === true;

        const cards = Array.from(
            document.querySelectorAll(
                '.directory-card[data-directory-stay-key]'
            )
        );

        if (!cards.length) return;

        const keys = Array.from(
            new Set(
                cards
                    .map(card =>
                        String(
                            card.dataset
                                .directoryStayKey ||
                            ''
                        ).trim()
                    )
                    .filter(Boolean)
            )
        );

        const cacheAge =
            Date.now() -
            Number(
                directoryLegacyIntakeCacheLastFetch ||
                0
            );

        const cacheFresh =
            !force &&
            directoryLegacyIntakeCacheLastFetch > 0 &&
            cacheAge < 15000;

        const keysToFetch =
            force
                ? keys
                : keys.filter(key =>
                    !Object.prototype.hasOwnProperty.call(
                        directoryLegacyIntakeCache,
                        key
                    ) ||
                    !cacheFresh
                );

        keys.forEach(key => {
            if (
                Object.prototype.hasOwnProperty.call(
                    directoryLegacyIntakeCache,
                    key
                )
            ) {
                setDirectoryLegacyIntakeStatus(
                    key,
                    directoryLegacyIntakeCache[key]
                );
            }
        });

        if (!keysToFetch.length) return;

        try {
            const response =
                await queryAppsScript({
                    action:
                        'get_legacy_intake_statuses',
                    stayKeys:
                        keysToFetch
                }, {
                    maxAttempts: 2,
                    timeoutMs: 45000
                });

            keysToFetch.forEach(key => {
                directoryLegacyIntakeCache[key] =
                    null;
            });

            directoryLegacyIntakeCacheLastFetch =
                Date.now();

            (response.records || [])
                .forEach(group => {
                    if (
                        !group ||
                        !group.stayKey
                    ) {
                        return;
                    }

                    directoryLegacyIntakeCache[
                        group.stayKey
                    ] = group;
                });

            keysToFetch.forEach(key => {
                setDirectoryLegacyIntakeStatus(
                    key,
                    directoryLegacyIntakeCache[key]
                );
            });

        } catch (error) {
            console.error(
                'Legacy intake status could not be loaded:',
                error
            );
        }
    }


    function setDirectoryDogPhoto(stayKey, record) {
        const card =
            getDirectoryProfileCard(
                stayKey
            );

        if (!card) return;

        const shell =
            card.querySelector(
                '[data-directory-photo]'
            );

        const media =
            shell?.querySelector(
                '.directory-photo-media'
            ) ||
            null;

        const tileShell =
            card.querySelector(
                '[data-directory-tile-photo]'
            );

        const dogPhoto =
            record &&
            record.dogPhoto
                ? record.dogPhoto
                : null;

        const imageUrl =
            dogPhoto &&
            dogPhoto.previewUrl
                ? String(
                    dogPhoto.previewUrl
                )
                : '';

        const dogName =
            card.dataset
                .directoryDogName ||
            'Dog';

        /*
         * IMPORTANT:
         * Only replace the media inside the photo shell.
         * The edit button is a sibling and must remain mounted.
         */
        if (!imageUrl) {
            card.classList.remove(
                'has-profile-photo'
            );

            if (media) {
                media.innerHTML =
                    '<div class="directory-photo-placeholder" aria-label="No dog profile photo">🐶</div>';
            }

            if (tileShell) {
                tileShell.innerHTML = '';
            }

            return;
        }

        card.classList.add(
            'has-profile-photo'
        );

        if (media) {
            media.innerHTML = `
                <img
                    src="${escapeDashboardHtml(imageUrl)}"
                    alt="${escapeDashboardHtml(dogName)}"
                    class="directory-dog-photo"
                    loading="lazy">
            `;
        }

        if (tileShell) {
            tileShell.innerHTML = `
                <img
                    src="${escapeDashboardHtml(imageUrl)}"
                    alt=""
                    class="directory-guest-tile-image"
                    loading="lazy">
            `;
        }
    }

    async function hydrateDirectoryDogPhotos(options = {}) {
        const force = options.force === true;
        const cards = Array.from(
            document.querySelectorAll('.directory-card[data-directory-stay-key]')
        );

        if (!cards.length) return;

        const keys = Array.from(new Set(
            cards
                .map(card => String(card.dataset.directoryStayKey || '').trim())
                .filter(Boolean)
        ));

        const queryKeys = [];

        keys.forEach(stayKey => {
            let record = null;
            let hasKnownValue = false;

            if (
                Object.prototype.hasOwnProperty.call(
                    directoryPhotoRecordsCache,
                    stayKey
                )
            ) {
                record = directoryPhotoRecordsCache[stayKey];
                hasKnownValue = true;
            } else if (belongingsRecordsCache[stayKey]) {
                record = belongingsRecordsCache[stayKey];
                directoryPhotoRecordsCache[stayKey] = record;
                hasKnownValue = true;
            } else if (careRiskRecordsCache[stayKey]) {
                record = careRiskRecordsCache[stayKey];
                directoryPhotoRecordsCache[stayKey] = record;
                hasKnownValue = true;
            }

            if (hasKnownValue && !force) {
                setDirectoryDogPhoto(stayKey, record);
                setDirectoryCareFlags(stayKey, record);
                renderDirectoryOperationalSections(
                    stayKey,
                    record
                );

                reconcileDirectoryDigitalIntakeFromProfile(
                    stayKey,
                    record
                );
            } else {
                queryKeys.push(stayKey);
            }
        });

        if (!queryKeys.length && !force) {
            refreshDirectoryCareSummary();
            return;
        }

        const keysToFetch = force ? keys : queryKeys;

        try {
            const response = await queryAppsScript({
                action: 'get_belongings',
                stayKeys: keysToFetch
            }, {
                maxAttempts: 2,
                timeoutMs: 45000
            });

            // A null cache entry means we checked this stay and no shared
            // belongings/profile record exists yet.
            keysToFetch.forEach(key => {
                directoryPhotoRecordsCache[key] = null;
            });

            (response.records || []).forEach(record => {
                if (!record || !record.stayKey) return;

                directoryPhotoRecordsCache[record.stayKey] = record;
                careRiskRecordsCache[record.stayKey] = record;

                if (belongingsRecordsCache[record.stayKey]) {
                    belongingsRecordsCache[record.stayKey] = record;
                }
            });

            keysToFetch.forEach(key => {
                const record = directoryPhotoRecordsCache[key];
                setDirectoryDogPhoto(key, record);
                setDirectoryCareFlags(key, record);
                renderDirectoryOperationalSections(
                    key,
                    record
                );

                reconcileDirectoryDigitalIntakeFromProfile(
                    key,
                    record
                );
            });

            refreshDirectoryCareSummary();
        } catch (error) {
            console.error(
                'Directory dog profile photos could not be loaded:',
                error
            );
        }
    }


    function parseCSVToEvents(csvText) {
        if (!csvText) return [];
        const lines = csvText.split(/\r?\n/); const events = [];
        const localTodayStr = getLocalTodayDateString(); const today = new Date(localTodayStr + 'T00:00:00');
        const sevenDaysFromNow = new Date(today.getTime()); sevenDaysFromNow.setDate(today.getDate() + 7); sevenDaysFromNow.setHours(23,59,59,999);

        const pickedUpDogs = JSON.parse(localStorage.getItem('pickedUpDogs_' + localTodayStr) || '[]');
        const atHomeDogs = []; const leavingDogs = []; const upcomingDogs = []; const directoryCardsHTML = [];

        dailyCapacityCounts = {};

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const columns = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
            
            const dogName = columns[1] ? columns[1].replace(/^"|"$/g, '') : '';
            const breed = columns[2] ? columns[2].replace(/^"|"$/g, '') : '';
            const startDate = columns[3]; const endDate = columns[4];
            const ownerName = columns[5] ? columns[5].replace(/^"|"$/g, '') : '';
            const phone = columns[6] ? columns[6].replace(/^"|"$/g, '') : '';
            // Columns 8 and 9 (Likes / Dislikes) are retained only for historical sheet compatibility.
            // The Web App no longer reads or writes them.
            const notes = columns[9] ? columns[9].replace(/^"|"$/g, '') : '';
            const editLink = columns[10] ? columns[10].replace(/^"|"$/g, '') : '';
            const bookingType = columns[11] ? columns[11].replace(/^"|"$/g, '').trim() : '';
            
            const isMeetGreetType = (bookingType.toLowerCase() === 'meet & greet');
            const isPotentialType = (bookingType.toLowerCase() === 'potential stay');

            if (dogName && startDate) {
                let startParsed = "", endParsed = "";
                if (startDate.includes('/')) {
                    const sParts = startDate.trim().split('/'); if (sParts[2]) startParsed = sParts[2] + '-' + sParts[1].padStart(2, '0') + '-' + sParts[0].padStart(2, '0');
                } else if (startDate.includes('-')) { startParsed = startDate.trim().split('T')[0]; }
                
                if (endDate && endDate.includes('/')) {
                    const eParts = endDate.trim().split('/'); if (eParts[2]) endParsed = eParts[2] + '-' + eParts[1].padStart(2, '0') + '-' + eParts[0].padStart(2, '0');
                } else if (endDate && endDate.includes('-')) { endParsed = endDate.trim().split('T')[0]; } 
                else { endParsed = startParsed; }

                if (startParsed && endParsed) {
                    const checkStart = new Date(startParsed + 'T00:00:00'); const checkEnd = new Date(endParsed + 'T00:00:00');

                    if (!isNaN(checkStart.getTime()) && !isNaN(checkEnd.getTime())) {
                        const breedTxt = breed ? breed.trim() : 'Unknown';
                        const displayDate = checkEnd.getDate() + '/' + (checkEnd.getMonth() + 1);
                        
                        const potentialKey = makePotentialKey(dogName.trim(), startParsed, endParsed);
                        if (isPotentialType && getPendingPotentialRemovals().includes(potentialKey)) {
                            continue;
                        }

                        let dogsInBooking = 1;
                        if (dogName.includes('&') || dogName.toLowerCase().includes(' and ')) {
                            dogsInBooking = dogName.split(/&|\s+and\s+/i).map(s => s.trim()).filter(Boolean).length || 1;
                        }

                        if (!isMeetGreetType) {
                            let tempLoopDate = new Date(checkStart.getTime());

                            while (tempLoopDate <= checkEnd) {
                                const tempStr =
                                    tempLoopDate
                                        .toISOString()
                                        .split('T')[0];

                                dailyCapacityCounts[tempStr] =
                                    (dailyCapacityCounts[tempStr] || 0) +
                                    dogsInBooking;

                                tempLoopDate.setDate(
                                    tempLoopDate.getDate() + 1
                                );
                            }
                        }

                        if (isPotentialType) {
                            const parts = endParsed.split('-'); const dateObject = new Date(parts[0], parts[1] - 1, parts[2]); dateObject.setDate(dateObject.getDate() + 1);
                            const forcedDisplayEnd = dateObject.getFullYear() + '-' + String(dateObject.getMonth() + 1).padStart(2, '0') + '-' + String(dateObject.getDate()).padStart(2, '0');

                            events.push({
                                id: 'sheet_pot_' + i,
                                title: `❓ Potential: ${dogName.trim()}`, start: startParsed, end: forcedDisplayEnd, allDay: true,
                                classNames: ['fc-event-potential'],
                                extendedProps: {
                                    isPotential: true, dogName: dogName.trim(), breed: breedTxt,
                                    owner: ownerName ? ownerName.trim() : "", ownerName: ownerName ? ownerName.trim() : "",
                                    phone: phone ? phone.trim() : "",
                                    rawStartDate: startParsed, rawEndDate: endParsed, notes: notes.trim(), bookingType: "Potential Stay", editLink: editLink.trim()
                                }
                            });
                            continue;
                        }

                        if (!isMeetGreetType) {
                            const listLabel = dogsInBooking > 1 ? '👥 ' + dogName.trim() : '🐾 ' + dogName.trim();
                            let isTodayTheEndDate = (endParsed === localTodayStr);
                            let isCurrentlyAtHome = (today >= checkStart && today <= checkEnd);
                            let isUpcoming = (checkStart > today && checkStart <= sevenDaysFromNow);

                            const localizedStayId = dogName.trim() + '_' + startParsed + '_' + endParsed;
                            const hasBeenPickedUp = pickedUpDogs.includes(localizedStayId);

                            if (!hasBeenPickedUp) {
                                if (isCurrentlyAtHome) atHomeDogs.push('<li><span>' + listLabel + ' (' + breedTxt + ')</span></li>');
                                if (isTodayTheEndDate) {
                                    const cleanDogName = dogName.trim().replace(/'/g, "\\'");
                                    leavingDogs.push('<li><span>' + listLabel + ' (' + breedTxt + ')</span> <span class="date-badge today-badge" style="cursor: pointer;" onclick="triggerCheckoutFlow(\'' + localizedStayId + '\', \'' + cleanDogName + '\')">TODAY</span></li>');
                                } else if (checkEnd > today && checkEnd <= sevenDaysFromNow) {
                                    leavingDogs.push('<li><span>' + listLabel + ' (' + breedTxt + ')</span> <span class="date-badge">' + displayDate + '</span></li>');
                                }
                            }

                            if (isUpcoming) upcomingDogs.push('<li><span>⏳ ' + dogName.trim() + '</span> <span class="date-badge">' + (checkStart.getDate() + '/' + (checkStart.getMonth() + 1)) + '</span></li>');

                            if ((isCurrentlyAtHome || isUpcoming) && WAFFLE_PAGE === 'directory') {
                                const statusTag = (isCurrentlyAtHome && !hasBeenPickedUp) ? '<span class="directory-status-tag tag-at-home">At Home</span>' : (hasBeenPickedUp ? '<span class="directory-status-tag" style="background:#e2e8f0; color:#64748b;">Checked Out</span>' : '<span class="directory-status-tag tag-upcoming">Upcoming</span>');
                                const cleanName = dogName.trim().replace(/'/g, "\\'"); const cleanLnk = editLink.trim();

                                const directoryStayKey = potentialKey;
                                const stayDateLabel =
                                    `${formatStayDateShort(startParsed)} – ${formatStayDateShort(endParsed)}`;

                                directoryCardsHTML.push(`
                                    <div
                                        class="directory-card directory-card-fused belongings-pet-card"
                                        data-directory-stay-key="${escapeDashboardHtml(directoryStayKey)}"
                                        data-directory-dog-name="${escapeDashboardHtml(dogName.trim())}"
                                        data-directory-start-date="${escapeDashboardHtml(startParsed)}"
                                        data-directory-end-date="${escapeDashboardHtml(endParsed)}"
                                        data-stay-key="${escapeDashboardHtml(directoryStayKey)}"
                                        data-dog-name="${escapeDashboardHtml(dogName.trim())}"
                                        data-start-date="${escapeDashboardHtml(startParsed)}"
                                        data-end-date="${escapeDashboardHtml(endParsed)}"
                                        style="${hasBeenPickedUp ? 'opacity: 0.6;' : ''}">

                                        <button
                                            type="button"
                                            class="directory-guest-tile-open"
                                            data-open-directory-profile
                                            aria-label="Open ${escapeDashboardHtml(dogName.trim())} care profile">
                                            <span
                                                class="directory-guest-tile-photo"
                                                data-directory-tile-photo="${escapeDashboardHtml(directoryStayKey)}"
                                                aria-hidden="true"></span>
                                            <span class="directory-guest-tile-name">
                                                ${escapeDashboardHtml(dogName.trim())}
                                            </span>
                                        </button>

                                        <div class="directory-profile-content">
                                        <div class="directory-card-header">
                                            <div
                                                class="directory-photo-shell"
                                                data-directory-photo="${escapeDashboardHtml(directoryStayKey)}">
                                                <div class="directory-photo-media">
                                                    <div
                                                        class="directory-photo-placeholder"
                                                        aria-label="No dog profile photo">🐶</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    class="directory-photo-edit-button"
                                                    data-upload-dog-photo
                                                    title="Change and position dog profile photo"
                                                    aria-label="Change and position ${escapeDashboardHtml(dogName.trim())} profile photo">
                                                    ✎
                                                </button>
                                            </div>

                                            <div class="directory-card-identity">
                                                <div class="directory-name-row">
                                                    <button
                                                        type="button"
                                                        class="directory-dog-name-btn"
                                                        data-directory-edit-field="dogName"
                                                        data-directory-current-value="${escapeDashboardHtml(dogName.trim())}"
                                                        title="Tap to edit Dog Name">
                                                        ${escapeDashboardHtml(dogName.trim())}
                                                    </button>
                                                    ${statusTag}
                                                </div>

                                                <button
                                                    type="button"
                                                    class="directory-primary-breed"
                                                    data-directory-edit-field="breed"
                                                    data-directory-current-value="${escapeDashboardHtml(breed ? breed.trim() : '')}"
                                                    title="Tap to edit Breed">
                                                    ${escapeDashboardHtml(breedTxt)}
                                                </button>

                                                <div class="directory-stay-dates">
                                                    📅 ${escapeDashboardHtml(stayDateLabel)}
                                                </div>
                                            </div>
                                        </div>

                                        <nav
                                            class="directory-main-profile-tabs"
                                            role="tablist"
                                            aria-label="${escapeDashboardHtml(dogName.trim())} profile sections">
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
                                            data-directory-care="${escapeDashboardHtml(directoryStayKey)}">
                                            <span class="directory-care-unset">
                                                🛡️ Care profile not set
                                            </span>
                                        </div>

                                        <div
                                            class="directory-intake-strip"
                                            data-directory-intake="${escapeDashboardHtml(directoryStayKey)}">
                                            <div class="directory-intake-state">
                                                <span class="directory-intake-dot is-not-sent"></span>
                                                <span>Intake not sent</span>
                                            </div>
                                            <button
                                                type="button"
                                                class="directory-intake-action"
                                                data-create-intake-link>
                                                📝 Create Link
                                            </button>
                                        </div>

                                        <div
                                            class="directory-legacy-strip"
                                            data-directory-legacy="${escapeDashboardHtml(directoryStayKey)}">
                                            <div class="directory-legacy-state">
                                                <span>📚 Legacy intake not uploaded</span>
                                            </div>
                                            <button
                                                type="button"
                                                class="directory-intake-action"
                                                data-upload-legacy-intake>
                                                ＋ PDF
                                            </button>
                                        </div>

                                        <div class="directory-attributes-grid directory-core-attributes">
                                            <button
                                                type="button"
                                                class="directory-attribute"
                                                data-directory-edit-field="ownerName"
                                                data-directory-current-value="${escapeDashboardHtml(ownerName ? ownerName.trim() : '')}"
                                                title="Tap to edit Owner">
                                                <span class="directory-field-label">Owner</span>
                                                <span class="directory-field-value">${escapeDashboardHtml(ownerName ? ownerName.trim() : 'N/A')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                class="directory-attribute"
                                                data-directory-edit-field="phone"
                                                data-directory-current-value="${escapeDashboardHtml(phone ? phone.trim() : '')}"
                                                title="Tap to edit Contact">
                                                <span class="directory-field-label">Contact</span>
                                                <span class="directory-field-value">${escapeDashboardHtml(phone ? phone.trim() : 'N/A')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                class="directory-attribute directory-attribute-wide"
                                                data-directory-edit-field="notes"
                                                data-directory-current-value="${escapeDashboardHtml(notes ? notes.trim() : '')}"
                                                title="Tap to edit Notes">
                                                <span class="directory-field-label">Notes</span>
                                                <span class="directory-field-value">${escapeDashboardHtml(notes ? notes.trim() : 'None')}</span>
                                            </button>
                                        </div>

                                        <section
                                            class="directory-profile-section directory-profile-intake-section"
                                            data-directory-detail="profile"
                                            data-detail-loaded="false">
                                            <div class="directory-profile-section-heading">
                                                <div>
                                                    <span class="directory-profile-section-kicker">Guest profile</span>
                                                    <h4>📋 Profile &amp; Care</h4>
                                                </div>
                                                <span
                                                    class="intake-profile-source"
                                                    data-intake-profile-summary>
                                                    Loading profile…
                                                </span>
                                            </div>
                                            <div
                                                class="directory-fused-details-body"
                                                data-directory-intake-attributes>
                                                <div class="intake-profile-empty">
                                                    Loading profile…
                                                </div>
                                            </div>
                                        </section>

                                        <div class="directory-profile-save-bar">
                                            <button
                                                type="button"
                                                class="belongings-save-btn"
                                                data-save-belongings>
                                                💾 Save Profile &amp; Care
                                            </button>
                                        </div>
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
                                                        <span class="directory-profile-section-kicker">Belongings</span>
                                                        <h4>🧳 Items &amp; Photos</h4>
                                                    </div>
                                                </div>
                                                <div
                                                    class="directory-fused-details-body"
                                                    data-directory-belongings>
                                                    <div class="intake-profile-empty">
                                                        Open Belongings to load items and photos.
                                                    </div>
                                                </div>
                                            </section>
                                        </section>
                                        </div>
                                    </div>
                                `);
                            }
                        } else {
                            const timeParts = notes.match(/(\d{1,2}:\d{2})/);
                            const parsedTime = timeParts ? timeParts[1] : "10:00";
                            
                            events.push({
                                title: `⏰ ${parsedTime} - Meet & Greet: ${dogName.trim()}`, start: startParsed, end: startParsed, allDay: true, backgroundColor: '#0f766e', textColor: '#ffffff',
                                extendedProps: { isMeetGreet: true, breed: breedTxt, time: parsedTime, dogName: dogName.trim(), owner: "Database Synced", phone: "N/A", notes: notes.trim(), editLink: "" }
                            });
                            continue;
                        }

                        const parts = endParsed.split('-'); const dateObject = new Date(parts[0], parts[1] - 1, parts[2]); dateObject.setDate(dateObject.getDate() + 1);
                        const forcedDisplayEnd = dateObject.getFullYear() + '-' + String(dateObject.getMonth() + 1).padStart(2, '0') + '-' + String(dateObject.getDate()).padStart(2, '0');

                        events.push({
                            title: dogName.trim(), start: startParsed, end: forcedDisplayEnd, allDay: true, backgroundColor: stringToColor(dogName.trim()), textColor: '#ffffff',
                            extendedProps: { isMeetGreet: false, isPotential: false, breed: breedTxt, dogName: dogName.trim(), owner: ownerName ? ownerName.trim() : "N/A", ownerName: ownerName ? ownerName.trim() : "N/A", phone: phone ? phone.trim() : "N/A", notes: notes ? notes.trim() : "None", rawStartDate: startParsed, rawEndDate: endParsed, bookingType: bookingType || "Boarding", editLink: editLink.trim() }
                        });
                    }
                }
            }
        }

        document.getElementById('at-home-list').innerHTML = atHomeDogs.length > 0 ? atHomeDogs.join('') : '<li class="no-dogs">No remaining guests at home right now</li>';
        document.getElementById('leaving-list').innerHTML = leavingDogs.length > 0 ? leavingDogs.join('') : '<li class="no-dogs">No checkouts scheduled this week</li>';
        document.getElementById('upcoming-list').innerHTML = upcomingDogs.length > 0 ? upcomingDogs.join('') : '<li class="no-dogs">No new arrivals scheduled this week</li>';
        document.getElementById('directory-grid').innerHTML = directoryCardsHTML.length > 0 ? directoryCardsHTML.join('') : '<div class="no-dogs" style="grid-column: 1/-1; text-align: center; padding: 20px;">No active guests to display.</div>';

        if (
            WAFFLE_PAGE === 'directory' &&
            directoryCardsHTML.length > 0 &&
            !directoryConsolidatedLoadInProgress
        ) {
            loadGuestDirectoryConsolidated({
                force: true,
                quiet: true
            }).catch(error =>
                console.error(error)
            );
        }

        return events;
    }
