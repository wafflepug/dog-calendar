/* ============================================================
   WAFFLE HOUSE V10.8.9 — PROFILE / LOADING UX POLISH
   ============================================================ */

const V1089_VERSION =
    '10.8.9';

const v1089BaseOpenHostedUploader =
    openHostedBelongingsPhotoUploader;


function v1089EnsureCardLoadingTile(
    card
) {
    if (!card) {
        return null;
    }

    let tile =
        card.querySelector(
            '[data-v1089-upload-loading]'
        );

    if (tile) {
        return tile;
    }

    tile =
        document.createElement(
            'div'
        );

    tile.className =
        'v1089-upload-loading';

    tile.setAttribute(
        'data-v1089-upload-loading',
        ''
    );

    tile.hidden =
        true;

    tile.innerHTML = `
        <div class="v1089-upload-loading-card">
            <span class="v1089-upload-spinner" aria-hidden="true"></span>

            <div class="v1089-upload-loading-copy">
                <strong data-v1089-upload-title>Preparing photos…</strong>
                <span data-v1089-upload-message>Please wait.</span>

                <div
                    class="v1089-upload-progress"
                    aria-hidden="true">
                    <i data-v1089-upload-progress-bar></i>
                </div>
            </div>
        </div>
    `;

    card.appendChild(
        tile
    );

    return tile;
}


function v1089SetCardUploadLoading(
    card,
    active,
    options = {}
) {
    const tile =
        v1089EnsureCardLoadingTile(
            card
        );

    if (!tile) {
        return;
    }

    if (!active) {
        tile.hidden =
            true;

        card.classList.remove(
            'is-v1089-uploading'
        );

        return;
    }

    card.classList.add(
        'is-v1089-uploading'
    );

    tile.hidden =
        false;

    const title =
        tile.querySelector(
            '[data-v1089-upload-title]'
        );

    const message =
        tile.querySelector(
            '[data-v1089-upload-message]'
        );

    const progress =
        tile.querySelector(
            '[data-v1089-upload-progress-bar]'
        );

    if (title) {
        title.textContent =
            options.title ||
            'Working on photos…';
    }

    if (message) {
        message.textContent =
            options.message ||
            'Please wait while the shared record updates.';
    }

    let percent =
        Number(
            options.percent
        );

    if (
        !Number.isFinite(
            percent
        )
    ) {
        percent =
            18;
    }

    percent =
        Math.max(
            4,
            Math.min(
                100,
                percent
            )
        );

    if (progress) {
        progress.style.width =
            `${percent}%`;
    }
}


function v1089UploadContextCard() {
    try {
        return (
            hostedBelongingsPhotoContext
                ?.card ||
            null
        );
    } catch (_) {
        return null;
    }
}


/*
 * Wrap the existing uploader opening sequence so slow Drive / Apps Script
 * preparation has an immediate visual loading tile on the dog profile.
 */
openHostedBelongingsPhotoUploader =
    async function(
        card,
        mode,
        photoType =
            'belongings'
    ) {
        const isProfile =
            photoType ===
            'dogProfile';

        v1089SetCardUploadLoading(
            card,
            true,
            {
                title:
                    isProfile
                        ? 'Preparing profile photo…'
                        : 'Preparing belongings photos…',
                message:
                    isProfile
                        ? 'Opening the crop and positioning tools.'
                        : 'Preparing the shared photo uploader.',
                percent:
                    12
            }
        );

        try {
            return await v1089BaseOpenHostedUploader(
                card,
                mode,
                photoType
            );

        } catch (error) {
            v1089SetCardUploadLoading(
                card,
                false
            );

            throw error;
        }
    };


/*
 * Code.gs V10.8.9 sends progress messages from the hosted uploader during
 * image preparation and each Drive upload. Existing saved/error messages are
 * still handled by waffle-app.js.
 */
window.addEventListener(
    'message',
    event => {
        const data =
            event?.data;

        if (
            !data ||
            typeof data !==
                'object'
        ) {
            return;
        }

        const card =
            v1089UploadContextCard();

        if (!card) {
            return;
        }

        if (
            data.type ===
            'waffleBelongingsPhotoUploaderReady'
        ) {
            v1089SetCardUploadLoading(
                card,
                false
            );

            return;
        }

        if (
            data.type ===
            'waffleBelongingsPhotoProgress'
        ) {
            const current =
                Number(
                    data.current ||
                    0
                );

            const total =
                Math.max(
                    1,
                    Number(
                        data.total ||
                        1
                    )
                );

            const percent =
                data.phase ===
                    'uploading'
                    ? (
                        34 +
                        (
                            current /
                            total
                        ) *
                        58
                      )
                    : (
                        10 +
                        (
                            current /
                            total
                        ) *
                        22
                      );

            v1089SetCardUploadLoading(
                card,
                true,
                {
                    title:
                        data.phase ===
                            'uploading'
                            ? (
                                total ===
                                1
                                    ? 'Uploading photo…'
                                    : `Uploading ${current} of ${total}…`
                              )
                            : 'Preparing photos…',
                    message:
                        String(
                            data.message ||
                            (
                                data.phase ===
                                    'uploading'
                                    ? 'Saving securely to Google Drive.'
                                    : 'Optimising the selected image.'
                            )
                        ),
                    percent
                }
            );

            return;
        }

        if (
            data.type ===
                'waffleBelongingsPhotoSaved' ||
            data.type ===
                'waffleBelongingsPhotoError'
        ) {
            v1089SetCardUploadLoading(
                card,
                false
            );
        }
    }
);


/* Clean any stale upload overlay when the hosted modal closes manually. */
document.addEventListener(
    'click',
    event => {
        if (
            event.target.closest(
                '#closeHostedBelongingsPhotoUploaderBtn'
            )
        ) {
            v1089SetCardUploadLoading(
                v1089UploadContextCard(),
                false
            );
        }
    },
    true
);
