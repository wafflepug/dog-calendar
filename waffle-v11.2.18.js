/* ============================================================
   WAFFLE HOUSE V11.2.18 — BELONGINGS / MEDIA GALLERY CAROUSEL
   ----------------------------------------------------------------
   Turns Profile, Stay and Belongings photo grids into accessible, touch-first
   carousels. Photos remain in the existing media data model; this layer only
   improves how already-uploaded media is browsed.
   ============================================================ */
(function () {
  'use strict';

  if (window.__WAFFLE_MEDIA_CAROUSEL_V11218__) return;
  window.__WAFFLE_MEDIA_CAROUSEL_V11218__ = true;

  const VERSION = '11.2.18';
  const baseRenderMedia = window.v110RenderMedia;
  let carouselSequence = 0;
  let enhanceQueued = false;

  function reducedMotion() {
    try { return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function ensureStyles() {
    if (document.getElementById('v11218MediaCarouselStyles')) return;
    const style = document.createElement('style');
    style.id = 'v11218MediaCarouselStyles';
    style.textContent = `
      .v11218-carousel{position:relative;margin-top:2px;border:1px solid var(--v10-border,#e2e8f0);border-radius:15px;background:color-mix(in srgb,var(--v10-card-soft,#f8fafc) 86%,transparent);overflow:hidden}
      .v11218-carousel-viewport{position:relative;overflow:hidden}.v11218-carousel .v110-media-grid.v11218-carousel-track{display:flex!important;grid-template-columns:none!important;gap:12px;overflow-x:auto;overflow-y:hidden;margin:0;padding:14px 14%;scroll-snap-type:x mandatory;scroll-padding-inline:14%;scroll-behavior:smooth;overscroll-behavior-inline:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}
      .v11218-carousel .v110-media-grid.v11218-carousel-track::-webkit-scrollbar{display:none}.v11218-carousel-slide{flex:0 0 min(72%,420px);scroll-snap-align:center;scroll-snap-stop:always;opacity:.58;transform:scale(.955);transition:opacity .24s ease,transform .24s ease,box-shadow .24s ease;border-radius:13px!important;box-shadow:0 4px 14px rgba(15,23,42,.08)}.v11218-carousel-slide.is-active{opacity:1;transform:scale(1);box-shadow:0 12px 28px rgba(15,23,42,.16)}
      .v11218-carousel-slide .v110-media-view{background:#0f172a}.v11218-carousel-slide .v110-media-view img{width:100%;aspect-ratio:4/3!important;object-fit:contain!important;background:#0f172a}.v11218-carousel-slide .v110-media-photo-meta{min-height:38px;padding:7px 9px}.v11218-carousel-slide .v110-media-photo-meta span{font-size:9px}
      .v11218-carousel-nav{position:absolute;top:50%;z-index:3;display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;margin-top:-23px;border:1px solid rgba(255,255,255,.5);border-radius:50%;background:rgba(15,23,42,.72);color:#fff;box-shadow:0 6px 20px rgba(15,23,42,.24);font:900 24px/1 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(7px);transition:transform .18s ease,background .18s ease,opacity .18s ease}.v11218-carousel-prev{left:10px}.v11218-carousel-next{right:10px}.v11218-carousel-nav:hover:not(:disabled){background:rgba(15,23,42,.9);transform:scale(1.06)}.v11218-carousel-nav:focus-visible{outline:3px solid rgba(139,92,246,.48);outline-offset:3px}.v11218-carousel-nav:disabled{opacity:.25;cursor:default}.v11218-carousel[data-count="1"] .v11218-carousel-nav{display:none}
      .v11218-carousel-footer{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;padding:9px 11px 11px;border-top:1px solid var(--v10-border,#e2e8f0);background:var(--v10-card,#fff)}.v11218-carousel-counter{min-width:48px;padding:6px 8px;border-radius:999px;background:var(--v10-card-soft,#f1f5f9);color:var(--v10-muted,#64748b);font-size:9px;font-weight:950;text-align:center;font-variant-numeric:tabular-nums}
      .v11218-carousel-thumbs{display:flex;gap:6px;min-width:0;overflow-x:auto;padding:2px;scrollbar-width:thin;scroll-behavior:smooth}.v11218-carousel-thumb{flex:0 0 54px;width:54px;height:42px;padding:2px;border:2px solid transparent;border-radius:8px;background:transparent;cursor:pointer;opacity:.58;transition:opacity .18s ease,border-color .18s ease,transform .18s ease}.v11218-carousel-thumb img{display:block;width:100%;height:100%;object-fit:cover;border-radius:5px;background:#0f172a}.v11218-carousel-thumb.is-active{border-color:#8b5cf6;opacity:1;transform:translateY(-1px)}.v11218-carousel-thumb:focus-visible{outline:3px solid rgba(139,92,246,.32);outline-offset:1px}
      .v11218-carousel-track:focus-visible{outline:3px solid rgba(139,92,246,.32);outline-offset:-4px}.v11218-carousel-hint{position:absolute;left:50%;bottom:8px;z-index:2;transform:translateX(-50%);pointer-events:none;padding:4px 7px;border-radius:999px;background:rgba(15,23,42,.62);color:#fff;font-size:7.5px;font-weight:800;opacity:0;transition:opacity .18s ease}.v11218-carousel.is-scrolling .v11218-carousel-hint{opacity:1}
      body.dark-theme .v11218-carousel-footer{background:var(--v10-card,#172033)}body.dark-theme .v11218-carousel-counter{background:#243149;color:#cbd5e1}
      @media(max-width:768px){.v11218-carousel .v110-media-grid.v11218-carousel-track{gap:9px;padding-inline:8%;scroll-padding-inline:8%}.v11218-carousel-slide{flex-basis:84%}.v11218-carousel-nav{width:44px;height:44px;margin-top:-22px;font-size:22px}.v11218-carousel-prev{left:5px}.v11218-carousel-next{right:5px}.v11218-carousel-footer{grid-template-columns:1fr;gap:7px}.v11218-carousel-counter{justify-self:start}.v11218-carousel-thumbs{width:100%}.v11218-carousel-thumb{flex-basis:50px;width:50px;height:39px}}
      @media(prefers-reduced-motion:reduce){.v11218-carousel .v110-media-grid.v11218-carousel-track,.v11218-carousel-thumbs{scroll-behavior:auto!important}.v11218-carousel-slide,.v11218-carousel-nav,.v11218-carousel-thumb,.v11218-carousel-hint{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function sectionLabel(section) {
    const title = section?.querySelector?.('.v110-media-section-title strong')?.textContent || 'Photo gallery';
    return String(title).replace(/^\s*[\p{Extended_Pictographic}\uFE0F]+\s*/u, '').trim() || 'Photo gallery';
  }

  function nearestIndex(track, slides) {
    if (!slides.length) return 0;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const delta = Math.abs(slideCenter - center);
      if (delta < distance) {
        distance = delta;
        best = index;
      }
    });
    return best;
  }

  function enhanceGrid(grid, section) {
    if (!grid || grid.dataset.v11218CarouselReady === 'true') return;
    const slides = Array.from(grid.querySelectorAll(':scope > .v110-media-photo'));
    if (!slides.length) return;

    ensureStyles();
    grid.dataset.v11218CarouselReady = 'true';
    grid.classList.add('v11218-carousel-track');
    grid.tabIndex = 0;
    grid.setAttribute('role', 'list');
    grid.setAttribute('aria-roledescription', 'carousel');

    const label = sectionLabel(section);
    const id = `v11218Carousel${++carouselSequence}`;
    grid.id = grid.id || `${id}Track`;
    grid.setAttribute('aria-label', `${label}. Swipe or use Previous and Next to browse uploaded photos.`);

    const shell = document.createElement('div');
    shell.className = 'v11218-carousel';
    shell.dataset.v11218Carousel = '';
    shell.dataset.count = String(slides.length);
    shell.dataset.activeIndex = '0';

    const viewport = document.createElement('div');
    viewport.className = 'v11218-carousel-viewport';
    grid.parentNode.insertBefore(shell, grid);
    shell.appendChild(viewport);
    viewport.appendChild(grid);

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'v11218-carousel-nav v11218-carousel-prev';
    previous.dataset.v11218CarouselPrev = '';
    previous.setAttribute('aria-label', `Previous ${label} photo`);
    previous.innerHTML = '<span aria-hidden="true">‹</span>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'v11218-carousel-nav v11218-carousel-next';
    next.dataset.v11218CarouselNext = '';
    next.setAttribute('aria-label', `Next ${label} photo`);
    next.innerHTML = '<span aria-hidden="true">›</span>';

    const hint = document.createElement('span');
    hint.className = 'v11218-carousel-hint';
    hint.textContent = 'Swipe to browse';
    viewport.append(previous, next, hint);

    const footer = document.createElement('div');
    footer.className = 'v11218-carousel-footer';
    const counter = document.createElement('span');
    counter.className = 'v11218-carousel-counter';
    counter.dataset.v11218CarouselCounter = '';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');

    const thumbs = document.createElement('div');
    thumbs.className = 'v11218-carousel-thumbs';
    thumbs.setAttribute('aria-label', `${label} uploaded photos`);

    slides.forEach((slide, index) => {
      slide.classList.add('v11218-carousel-slide');
      slide.dataset.v11218CarouselIndex = String(index);
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);

      const image = slide.querySelector('.v110-media-view img');
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'v11218-carousel-thumb';
      thumb.dataset.v11218CarouselThumb = String(index);
      thumb.setAttribute('aria-label', `View ${label} photo ${index + 1} of ${slides.length}`);
      if (image?.src) {
        const thumbImage = document.createElement('img');
        thumbImage.src = image.src;
        thumbImage.alt = '';
        thumbImage.loading = 'lazy';
        thumb.appendChild(thumbImage);
      } else {
        thumb.textContent = String(index + 1);
      }
      thumbs.appendChild(thumb);
    });

    footer.append(counter, thumbs);
    shell.appendChild(footer);

    let scrollTimer = 0;
    let frame = 0;

    function update(index, options = {}) {
      index = Math.max(0, Math.min(slides.length - 1, Number(index) || 0));
      shell.dataset.activeIndex = String(index);
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
      Array.from(thumbs.children).forEach((thumb, i) => {
        const active = i === index;
        thumb.classList.toggle('is-active', active);
        thumb.setAttribute('aria-current', active ? 'true' : 'false');
      });
      previous.disabled = index <= 0;
      next.disabled = index >= slides.length - 1;
      counter.textContent = `${index + 1} / ${slides.length}`;
      counter.setAttribute('aria-label', `${label} photo ${index + 1} of ${slides.length}`);
      if (options.revealThumb !== false) {
        thumbs.children[index]?.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block:'nearest', inline:'nearest' });
      }
    }

    function go(index, options = {}) {
      index = Math.max(0, Math.min(slides.length - 1, Number(index) || 0));
      const slide = slides[index];
      const left = Math.max(0, slide.offsetLeft - (grid.clientWidth - slide.offsetWidth) / 2);
      grid.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
      update(index, { revealThumb:true });
      if (options.focusTrack) grid.focus({ preventScroll:true });
    }

    previous.addEventListener('click', () => go(Number(shell.dataset.activeIndex || 0) - 1));
    next.addEventListener('click', () => go(Number(shell.dataset.activeIndex || 0) + 1));
    thumbs.addEventListener('click', event => {
      const button = event.target.closest('[data-v11218-carousel-thumb]');
      if (!button) return;
      go(Number(button.dataset.v11218CarouselThumb));
    });

    grid.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(Number(shell.dataset.activeIndex || 0) - 1, { focusTrack:true });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(Number(shell.dataset.activeIndex || 0) + 1, { focusTrack:true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        go(0, { focusTrack:true });
      } else if (event.key === 'End') {
        event.preventDefault();
        go(slides.length - 1, { focusTrack:true });
      }
    });

    grid.addEventListener('scroll', () => {
      shell.classList.add('is-scrolling');
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update(nearestIndex(grid, slides), { revealThumb:false }));
      clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        shell.classList.remove('is-scrolling');
        update(nearestIndex(grid, slides), { revealThumb:true });
      }, 140);
    }, { passive:true });

    update(0, { revealThumb:false });
  }

  function enhanceMediaHost(host) {
    if (!host) return;
    host.querySelectorAll('.v110-media-section').forEach(section => {
      const grid = section.querySelector(':scope > .v110-media-grid');
      if (grid) enhanceGrid(grid, section);
    });
  }

  function enhanceCard(card) {
    enhanceMediaHost(card?.querySelector?.('[data-v110-media-host]'));
  }

  function enhanceAll() {
    document.querySelectorAll('[data-v110-media-host]').forEach(enhanceMediaHost);
  }

  function queueEnhanceAll() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      enhanceAll();
    });
  }

  if (typeof baseRenderMedia === 'function') {
    window.v110RenderMedia = function(card, record) {
      const result = baseRenderMedia(card, record);
      enhanceCard(card);
      return result;
    };
  }

  function observe() {
    if (!document.body || window.__WAFFLE_MEDIA_CAROUSEL_OBSERVER_V11218__) return;
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node =>
        node?.nodeType === 1 && (
          node.matches?.('.v110-media-grid,[data-v110-media-host]') ||
          node.querySelector?.('.v110-media-grid,[data-v110-media-host]')
        )
      ))) queueEnhanceAll();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.__WAFFLE_MEDIA_CAROUSEL_OBSERVER_V11218__ = observer;
  }

  ensureStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { enhanceAll(); observe(); }, { once:true });
  } else {
    enhanceAll();
    observe();
  }
  window.addEventListener('waffle:maintenance-clear', queueEnhanceAll);

  window.WAFFLE_MEDIA_CAROUSEL_V11218 = Object.freeze({
    version: VERSION,
    behavior: 'smooth-snap-carousel-with-prev-next-peek-thumbnails-keyboard-and-swipe',
    autoplay: false,
    reducedMotionAware: true
  });
})();
