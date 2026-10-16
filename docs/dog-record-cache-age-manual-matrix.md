# Dog Record cache age manual matrix

Use synthetic cache entries and responses only. Do not save or edit production records.

| Scenario | Setup | Expected Dog Record status |
| --- | --- | --- |
| Recent cached copy | Matching dog cache entry with a valid `savedAt` from a few minutes ago; delay the network response | Keeps the record visible, identifies the local saved copy and its age, and does not claim a verified network check |
| Old cached copy | Matching entry with a valid `savedAt` from the prior day | Says it is a local saved copy and shows the save date/time |
| Unknown or invalid time | Omit `savedAt`, use an invalid date, or use an implausibly future date | Says copy save time is unavailable; never says checked just now |
| Successful fresh response | Return a validated response, including an unchanged response | Says “Dog record checked just now”; does not call this the owner’s edit time |
| Offline fallback | Set offline and return a known or unknown cache entry | Explicitly says saved profile data is shown offline and retains the cache age when known |
| Failed refresh | Return a cached entry and reject the network refresh | Explicitly says refresh failed, retains age when known, and keeps Retry available |
| Delayed guest switch | Start a cache callback or network read for one stay, then switch the card to a different stay before it resolves | Old guest data, cache age, disclosure state and save feedback do not render on the new stay |
| Layout and accessibility | Check 320, 390 and 1440px widths, light/dark themes and enlarged text | Status and Update dog record remain readable without horizontal overflow; actions remain at least 44px tall |
