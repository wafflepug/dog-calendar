#!/usr/bin/env python3
from pathlib import Path

errors = []


def require(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle not in text:
        errors.append(f'{path}: missing {needle}')


def forbid(path, needle):
    text = Path(path).read_text(encoding='utf-8')
    if needle in text:
        errors.append(f'{path}: must not contain {needle}')


backend = 'apps-script/V11217EarlyCheckout.js'
frontend = 'waffle-v11.2.17.js'
mobile_fix = 'waffle-v11.2.19.js'
bootstrap = 'waffle-bootstrap.js'
service_worker = 'service-worker.js'

# Backend: early checkout is operational metadata, not a booking-date mutation.
require(backend, "'early_checkout_stay'")
require(backend, "EARLY_CHECKOUT_REASON_CODE_V11217_ = 'owner_request'")
require(backend, "EARLY_CHECKOUT_REASON_V11217_ = 'Owner requested early checkout'")
require(backend, "'Checkout Type'")
require(backend, "'Checkout Reason Code'")
require(backend, "'Original End Date'")
require(backend, "'Actual Checkout Date'")
require(backend, "'Checkout Requested By'")
require(backend, "auditAction")
require(backend, "'Dog Checked Out Early'")
require(backend, "touchWaffleDataVersion_('directory')")
require(backend, "isEarlyCheckout")
forbid(backend, 'updateV108BoardingDates_(')
forbid(backend, 'deleteRow(')

# Frontend: early action is explicit and the profile explains what happened.
require(frontend, "VERSION = '11.2.17'")
require(frontend, "REASON_CODE = 'owner_request'")
require(frontend, "REASON = 'Owner requested early checkout'")
require(frontend, 'data-v11217-early-checkout')
require(frontend, 'Confirm Early Checkout')
require(frontend, "action: 'early_checkout_stay'")
require(frontend, "checkoutType: 'early'")
require(frontend, 'originalEndDate: p.endDate')
require(frontend, 'actualCheckoutDate: actualDate')
require(frontend, 'checkoutRequestedBy: p.ownerName')
require(frontend, 'ORIGINALLY SCHEDULED')
require(frontend, 'ACTUAL CHECKOUT')
require(frontend, 'REQUESTED BY')
require(frontend, 'The original booking dates will be preserved.')
require(frontend, "p.endDate <= today")

# Mobile reachability: the fixed sitter navigation is z-index 2147481795, so the
# dialog must own a higher layer and a real touch-scroll region. The action row
# stays pinned inside the dialog and accounts for phone safe areas.
require(mobile_fix, "VERSION = '11.2.19'")
require(mobile_fix, "MODAL_ID = 'v11217EarlyCheckoutModal'")
require(mobile_fix, 'z-index: 2147482500 !important')
require(mobile_fix, 'overflow-y: auto !important')
require(mobile_fix, '-webkit-overflow-scrolling: touch !important')
require(mobile_fix, 'touch-action: pan-y !important')
require(mobile_fix, 'position: sticky !important')
require(mobile_fix, 'env(safe-area-inset-bottom)')
require(mobile_fix, 'window.visualViewport?.addEventListener')
require(mobile_fix, "modal.dataset.v11219MobileScrollReady = 'true'")

# Runtime: V11.2.19 is presentation-only and must load after both the original
# early-checkout flow and the current media layer so its mobile overrides win.
require(bootstrap, '"waffle-v11.2.17.js"')
require(bootstrap, '"waffle-v11.2.18.js"')
require(bootstrap, '"waffle-v11.2.19.js"')
require(bootstrap, 'const ASSET_REVISION = ')
require(bootstrap, "const BUILD = '2026.08.28.01';")
text = Path(bootstrap).read_text(encoding='utf-8')
if text.find('"waffle-v11.2.17.js"') < text.find('"waffle-v11.2.14.js"'):
    errors.append('waffle-bootstrap.js: early checkout must load after V11.2.14')
if text.find('"waffle-v11.2.19.js"') < text.find('"waffle-v11.2.17.js"'):
    errors.append('waffle-bootstrap.js: mobile early-checkout fix must load after V11.2.17')
if text.find('"waffle-v11.2.19.js"') < text.find('"waffle-v11.2.18.js"'):
    errors.append('waffle-bootstrap.js: mobile early-checkout fix must load after V11.2.18')

# The service worker must not serve a stale copy of the early-checkout runtime.
# This guards installed/PWA clients that may have opened before the mobile fix
# was added to the bootstrap runtime list.
require(service_worker, "path.endsWith('/waffle-v11.2.17.js')")
require(service_worker, "path.endsWith('/waffle-v11.2.19.js')")
require(service_worker, "fetch(request, { cache: 'no-store' })")
require(service_worker, "v11.4.19-mobile-home-cleanup-2026.09.16.02")

if errors:
    raise SystemExit('\n'.join(errors))

print('Early checkout contract passed.')
