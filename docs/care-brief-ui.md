# Care Brief UI

The selected Care profile now opens with a compact brief before the existing
profile tabs. Its first paint uses only data already present in the directory
response:

- dog identity, stay dates and stay status remain in the profile header;
- the five operational safety flags come from the directory summary;
- feeding and medication remain explicitly marked as loading until the
  existing `get_guest_profile` read supplies the saved intake attributes;
- missing saved values are labelled `Not provided` and missing summary data is
  labelled `Safety profile not yet available`.

The brief does not issue a request. `Full profile` moves to the existing
detailed profile, `Belongings` uses the existing lazy belongings path, and
`Edit care details` enters the existing profile edit mode. All three actions
have a 44px minimum target, visible keyboard focus, single-column phone layout
and wrapping for long care text.

This improves useful first paint and information hierarchy. It does not claim
to reduce the latency of the existing Apps Script profile read; that remains a
separate measured backlog item.
