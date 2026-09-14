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
bootstrap = 'waffle-bootstrap.js'

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

# Runtime: load the additive feature after the current V11.2.14 layer and bump
# the asset revision without changing the canonical build pin.
require(bootstrap, '"waffle-v11.2.17.js"')
require(bootstrap, "const ASSET_REVISION = '2026.09.14.01';")
require(bootstrap, "const BUILD = '2026.08.28.01';")
text = Path(bootstrap).read_text(encoding='utf-8')
if text.find('"waffle-v11.2.17.js"') < text.find('"waffle-v11.2.14.js"'):
    errors.append('waffle-bootstrap.js: early checkout must load after V11.2.14')

if errors:
    raise SystemExit('\n'.join(errors))

print('Early checkout contract passed.')
