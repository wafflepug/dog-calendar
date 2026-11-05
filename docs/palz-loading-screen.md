# Palz Stay loading screen

Main entry pages (Today/Calendar, Care, Organiser and Logs) now include a static loading surface before runtime execution. It uses the existing Palz/Stay word masks, a moving progress line, saved Settings accent and light/dark theme. No image generation, fonts or backend requests are added.

The overlay retires after document parsing and the canonical first-paint ready signal; there is no artificial minimum delay. An eight-second JavaScript/CSS fail-safe releases the screen if runtime readiness fails. Reduced motion makes the line static. Normal same-origin document links show the outgoing loader; modified/new-tab/download/same-document actions are excluded. BFCache pageshow clears outgoing state.

Validation: local fictional-data captures with bootstrap response held then released; 390px/1440px light, 390px dark-blue and 320px reduced-motion. Progress CSS and logo masks checked; ready overlay hidden; no script errors or page overflow. No production writes or broad regression suite. Before/after review: output/palz-loading-review/review.html. Exact token usage unavailable.
