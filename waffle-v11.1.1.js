/* ============================================================
   WAFFLE HOUSE V11.1.1 — QUICK PHOTO / MOBILE UI FOLLOW-UP
   ============================================================ */

const V1111_VERSION = '11.1.1';

/*
 * Quick Photos should feel like selecting a dog in Care. Reuse the same Care
 * tile classes (photo + dog name) rather than maintaining a second card style.
 */
if (typeof v111RenderQuickPhotoDogs === 'function') {
    v111RenderQuickPhotoDogs = async function() {
        const modal = v111EnsureQuickPhotoModal();
        const host = modal.querySelector('[data-v111-dog-grid]');

        v111QuickPhotoState.events = v111CurrentDogEvents();
        v111QuickPhotoState.selectedIndex = -1;
        modal.querySelector('[data-v111-photo-actions]').hidden = true;

        if (!v111QuickPhotoState.events.length) {
            host.innerHTML = '<div class="v111-photo-empty"><span>🐾</span><strong>No current dogs found</strong><small>Current boarding stays will appear here.</small></div>';
            return;
        }

        host.innerHTML = v111QuickPhotoState.events.map((eventRecord, index) => {
            const props = eventRecord.extendedProps || {};
            const dogName = String(props.dogName || eventRecord.title || 'Guest');

            return `<button
                type="button"
                class="directory-guest-tile-open v111-dog-tile v111-care-dog-tile"
                data-v111-dog-index="${index}"
                aria-label="Select ${v110Escape(dogName)} for photos">
                <span
                    class="directory-guest-tile-photo v111-dog-photo"
                    data-v111-dog-photo="${index}"
                    aria-hidden="true">🐶</span>
                <span class="directory-guest-tile-name">${v110Escape(dogName)}</span>
            </button>`;
        }).join('');

        v111QuickPhotoState.events.forEach(async (eventRecord, index) => {
            const url = await v110PhotoForStay(v110StayKeyForEvent(eventRecord));
            if (!url) return;

            const target = host.querySelector(`[data-v111-dog-photo="${index}"]`);
            if (target) {
                target.innerHTML = `<img src="${v110Escape(url)}" alt="" loading="lazy">`;
            }
        });
    };
}

/* Re-apply the icon-only notification treatment after any legacy UI refresh
   that may rewrite notification button content/classes. */
function v1111NormaliseMobileNotificationButton() {
    const button = document.getElementById('waffleNotificationButton');
    if (!button) return;

    button.setAttribute('aria-label', 'Notifications');

    const icon = button.querySelector('.waffle-notification-button-icon');
    if (icon && !String(icon.textContent || '').trim()) {
        icon.textContent = '🔔';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', v1111NormaliseMobileNotificationButton, { once: true });
} else {
    v1111NormaliseMobileNotificationButton();
}

setTimeout(v1111NormaliseMobileNotificationButton, 600);
setTimeout(v1111NormaliseMobileNotificationButton, 1800);
