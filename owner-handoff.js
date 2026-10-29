/* Shared, explicit owner form handoff. No messages are sent automatically. */
(function () {
  'use strict';
  if (window.WAFFLE_OWNER_HANDOFF) return;

  function validLink(value) {
    try {
      const url = new URL(String(value || ''));
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }

  function date(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    });
  }

  function isVisible(node) {
    if (!node || !node.isConnected || !node.getClientRects().length) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      if (parent.hidden || parent.inert || parent.getAttribute('aria-hidden') === 'true' || (parent.tagName === 'DETAILS' && !parent.open && parent !== node)) return false;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
    }
    return true;
  }

  function canRestoreCopyFocus(control, origin, moved, fallbackField) {
    const active = document.activeElement;
    const ownedFocus = origin === control || origin === fallbackField || origin === document.body || origin === document.documentElement;
    return ownedFocus && !moved && isVisible(control) && (active === control || active === fallbackField || active === document.body || active === document.documentElement);
  }

  const pendingLinkCopies = new WeakSet();
  async function copyLink(value, options = {}) {
    const link = validLink(value);
    const button = options.button;
    const status = options.status;
    const host = options.host;
    if (!link || !button || !status || !host || !host.isConnected || pendingLinkCopies.has(button)) return false;
    const current = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
    let fallback = host.querySelector('[data-owner-care-link-fallback]');
    if (!current()) {
      if (fallback) fallback.remove();
      status.textContent = 'The selected stay changed. Review it before copying the care link.';
      return false;
    }
    const startingFocus = document.activeElement;
    let focusMoved = false;
    const trackFocus = event => { if (event.target !== startingFocus && event.target !== document.body && event.target !== document.documentElement) focusMoved = true; };
    const trackInput = () => { focusMoved = true; };
    document.addEventListener('focusin', trackFocus, true);
    document.addEventListener('pointerdown', trackInput, true);
    document.addEventListener('keydown', trackInput, true);
    pendingLinkCopies.add(button);
    button.disabled = true;
    status.textContent = 'Copying care link…';
    try {
      if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
      if (!host.isConnected) return false;
      if (!current()) {
        if (fallback) fallback.remove();
        status.textContent = 'The selected stay changed while copying. Review the current stay before copying again.';
        return false;
      }
      if (fallback) fallback.remove();
      status.textContent = 'Care link copied. Paste it into the owner’s usual chat and send.';
      return true;
    } catch (_) {
      if (!host.isConnected) return false;
      if (!current()) {
        if (fallback) fallback.remove();
        status.textContent = 'The selected stay changed while copying. Review the current stay before copying again.';
        return false;
      }
      if (!fallback) {
        fallback = document.createElement('textarea');
        fallback.dataset.ownerCareLinkFallback = '';
        fallback.setAttribute('aria-label', 'Owner care link for manual copying');
        fallback.readOnly = true;
        fallback.rows = 2;
        fallback.style.minHeight = '3.5rem';
        fallback.style.height = '3.5rem';
        fallback.style.resize = 'vertical';
        host.insertBefore(fallback, status);
      }
      fallback.value = link;
      fallback.hidden = false;
      const canSelect = isVisible(host) && !focusMoved && (document.activeElement === startingFocus || document.activeElement === document.body || document.activeElement === document.documentElement);
      if (canSelect) {
        fallback.focus();
        fallback.select();
        status.textContent = 'Copy was blocked. The care link is selected: press and hold to copy, then paste it into the owner’s chat.';
      } else status.textContent = 'Copy was blocked. The care link is available in the field above for manual copying.';
      return false;
    } finally {
      pendingLinkCopies.delete(button);
      document.removeEventListener('focusin', trackFocus, true);
      document.removeEventListener('pointerdown', trackInput, true);
      document.removeEventListener('keydown', trackInput, true);
      if (host.isConnected) button.disabled = false;
    }
  }

  function renderCompact(host, details, link, dog, start, end, message) {
    const card = document.createElement('section');
    card.className = 'owner-handoff owner-handoff-compact';
    card.dataset.ownerHandoff = 'true';
    const heading = document.createElement('h4');
    heading.textContent = 'Owner care link ready';
    heading.tabIndex = -1;
    const hint = document.createElement('p');
    const stayDate = start && end ? (start === end ? ` · ${start}` : ` · ${start}–${end}`) : '';
    hint.textContent = `For ${dog}${stayDate}. Paste the copied link into the owner’s chat.`;
    const linkLabel = document.createElement('label');
    linkLabel.className = 'owner-handoff-message owner-handoff-link-label';
    const linkCaption = document.createElement('span');
    linkCaption.textContent = 'Owner care link';
    const linkField = document.createElement('textarea');
    linkField.setAttribute('aria-label', 'Owner care link');
    linkField.readOnly = true;
    linkField.rows = 2;
    linkField.value = link;
    linkLabel.hidden = true;
    linkField.style.minHeight = '3.5rem';
    linkField.style.height = '3.5rem';
    linkField.style.resize = 'vertical';
    linkLabel.append(linkCaption, linkField);

    const actions = document.createElement('div');
    actions.className = 'owner-handoff-actions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'primary';
    copyButton.textContent = 'Copy owner care link';
    const status = document.createElement('p');
    status.className = 'owner-handoff-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Ready to copy.';
    let actionPending = false;
    const actionButtons = [copyButton];
    let focusOrigin = null;
    let focusMoved = false;
    function trackActionFocus(event) { if (event.target !== focusOrigin && event.target !== document.body && event.target !== document.documentElement) focusMoved = true; }
    function trackActionInput() { focusMoved = true; }
    function beginAction(message) {
      if (actionPending || !card.isConnected) return false;
      actionPending = true;
      actions.setAttribute('aria-busy', 'true');
      focusOrigin = document.activeElement;
      focusMoved = false;
      document.addEventListener('focusin', trackActionFocus, true);
      document.addEventListener('pointerdown', trackActionInput, true);
      document.addEventListener('keydown', trackActionInput, true);
      actionButtons.forEach(button => { button.disabled = true; });
      status.textContent = message;
      return true;
    }
    function endAction() {
      actionPending = false;
      actions.removeAttribute('aria-busy');
      document.removeEventListener('focusin', trackActionFocus, true);
      document.removeEventListener('pointerdown', trackActionInput, true);
      document.removeEventListener('keydown', trackActionInput, true);
      if (card.isConnected) actionButtons.forEach(button => { button.disabled = false; });
    }
    copyButton.addEventListener('click', async () => {
      if (actionPending || !card.isConnected) return;
      const focusWasOnControls = document.activeElement === copyButton || document.activeElement === linkField || document.activeElement === document.body || document.activeElement === document.documentElement;
      if (!beginAction('Copying link…')) return;
      let copied = false;
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(link);
        if (!card.isConnected) return;
        status.textContent = 'Owner care link copied. Paste it into the owner’s usual chat and send.';
        copied = true;
        linkLabel.hidden = true;
      } catch (_) {
        if (!card.isConnected) return;
        if (linkLabel.parentNode !== card) card.insertBefore(linkLabel, actions);
        linkLabel.hidden = false;
        const active = document.activeElement;
        const canSelectFallback = !focusMoved && isVisible(card) && isVisible(linkField) && focusWasOnControls && (active === linkField || active === copyButton || active === document.body || active === document.documentElement);
        if (canSelectFallback) {
          linkField.focus();
          linkField.select();
          status.textContent = 'Copy was blocked. The link is selected: press and hold to copy, then paste it into the owner’s chat.';
        } else {
          status.textContent = 'Copy was blocked. The link is available in the field above for manual copying.';
        }
      } finally {
        const restore = copied && canRestoreCopyFocus(copyButton, focusOrigin, focusMoved, linkField);
        endAction();
        if (restore) copyButton.focus({ preventScroll: true });
      }
    });
    actions.appendChild(copyButton);
    if (typeof navigator.share === 'function') {
      const shareButton = document.createElement('button');
      shareButton.type = 'button';
      shareButton.textContent = 'Share';
      shareButton.addEventListener('click', async () => {
        if (!beginAction('Opening share sheet…')) return;
        try {
          await navigator.share({ title: `${dog} — owner care form`, text: message });
          if (!card.isConnected) return;
          status.textContent = 'Share sheet closed. Check your chosen app to confirm the message was sent.';
        } catch (error) {
          if (!card.isConnected) return;
          if (error?.name === 'AbortError') status.textContent = 'Sharing cancelled. Your message is still ready to copy or share.';
          else status.textContent = 'Sharing is unavailable. Choose Copy owner care link and paste it into the owner’s chat.';
        } finally {
          const restore = card.isConnected && shareButton.isConnected && !focusMoved && (document.activeElement === shareButton || document.activeElement === focusOrigin || document.activeElement === document.body || document.activeElement === document.documentElement) && isVisible(shareButton);
          endAction();
          if (restore) shareButton.focus();
        }
      });
      actions.appendChild(shareButton);
      actionButtons.push(shareButton);
    }

    const other = document.createElement('details');
    other.className = 'owner-handoff-options';
    other.dataset.secondaryOptions = 'true';
    const summary = document.createElement('summary');
    summary.textContent = 'More options';
    const secondary = document.createElement('div');
    secondary.className = 'owner-handoff-secondary';
    const context = document.createElement('p');
    const dateText = start && end ? (start === end ? ` · ${start}` : ` · ${start}–${end}`) : '';
    context.textContent = `Stay for ${dog}${dateText}. Ask the owner to review saved details and update anything that has changed.`;
    const messageLabel = document.createElement('label');
    messageLabel.className = 'owner-handoff-message';
    const messageCaption = document.createElement('span');
    messageCaption.textContent = 'Message to owner';
    const messageField = document.createElement('textarea');
    messageField.setAttribute('aria-label', 'Message to owner');
    messageField.readOnly = true;
    messageField.rows = 7;
    messageField.value = message;
    messageLabel.append(messageCaption, messageField);
    const secondaryActions = document.createElement('div');
    secondaryActions.className = 'owner-handoff-actions';
    async function copy(value, success, fallbackField, control) {
      const startingFocus = document.activeElement;
      if (!beginAction('Copying message…')) return;
      let copied = false;
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        if (!card.isConnected) return;
        status.textContent = success;
        copied = true;
      } catch (_) {
        if (!card.isConnected) return;
        const active = document.activeElement;
        if (!focusMoved && isVisible(card) && isVisible(other) && isVisible(fallbackField) && other.open && (active === startingFocus || active === document.body || active === document.documentElement)) {
          fallbackField.focus();
          fallbackField.select();
          status.textContent = 'Copy was blocked. The text is selected: press and hold to copy, then paste it into the owner’s chat.';
        } else status.textContent = 'Copy was blocked. The message is available above for manual copying.';
      } finally {
        const restore = copied && canRestoreCopyFocus(control, focusOrigin, focusMoved, fallbackField);
        endAction();
        if (restore) control.focus({ preventScroll: true });
      }
    }
    function secondaryButton(text, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', handler);
      secondaryActions.appendChild(button);
      actionButtons.push(button);
      return button;
    }
    secondaryButton('Copy message', event => copy(message, 'Message copied. Paste it into the owner’s chat and send.', messageField, event.currentTarget)).className = 'primary';
    secondary.append(context, messageLabel, secondaryActions);
    other.append(summary, secondary);
    card.append(heading, hint, linkLabel, actions, other, status);
    host.appendChild(card);
    return card;
  }

  function render(host, details, options = {}) {
    if (!host) return null;
    host.replaceChildren();
    host.hidden = false;
    const link = validLink(details?.link);
    if (!link) {
      host.textContent = 'The stay is saved. Open Owner Care Link in Care to prepare the owner form.';
      return null;
    }
    const dog = String(details?.dogName || 'your dog').trim() || 'your dog';
    const start = date(details?.startDate), end = date(details?.endDate);
    const dates = start && end ? (start === end ? ` on ${start}` : ` from ${start} to ${end}`) : '';
    const message = `Hi! Please complete or review ${dog}’s care form for their stay${dates}. You can check the saved details and update anything that has changed.\n\n${link}\n\nThank you!`;
    if (options?.compact) return renderCompact(host, details, link, dog, start, end, message);
    const card = document.createElement('section');
    card.className = 'owner-handoff';
    const heading = document.createElement('h4');
    heading.textContent = 'Owner message ready';
    heading.tabIndex = -1;
    const hint = document.createElement('p');
    hint.textContent = 'Copy this message into your usual chat with the owner, or choose Share.';
    const label = document.createElement('label');
    label.className = 'owner-handoff-message';
    const caption = document.createElement('span');
    caption.textContent = 'Message to owner';
    const field = document.createElement('textarea');
    field.readOnly = true;
    field.rows = 7;
    field.value = message;
    label.append(caption, field);
    const actions = document.createElement('div');
    actions.className = 'owner-handoff-actions';
    const status = document.createElement('p');
    status.className = 'owner-handoff-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'The owner can use this link on their phone. Send it through your usual chat.';

    let actionPending = false;
    const actionButtons = [];
    let focusOrigin = null, focusMoved = false;
    function trackFocus(event) { if (event.target !== focusOrigin && event.target !== document.body && event.target !== document.documentElement) focusMoved = true; }
    function trackInput() { focusMoved = true; }
    function beginAction(message) { if (actionPending || !card.isConnected) return false; actionPending = true; actions.setAttribute('aria-busy', 'true'); focusOrigin = document.activeElement; focusMoved = false; document.addEventListener('focusin', trackFocus, true); document.addEventListener('pointerdown', trackInput, true); document.addEventListener('keydown', trackInput, true); actionButtons.forEach(control => control.disabled = true); status.textContent = message; return true; }
    function endAction() { actionPending = false; actions.removeAttribute('aria-busy'); document.removeEventListener('focusin', trackFocus, true); document.removeEventListener('pointerdown', trackInput, true); document.removeEventListener('keydown', trackInput, true); if (card.isConnected) actionButtons.forEach(control => control.disabled = false); }
    function button(text, handler) {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = text;
      control.addEventListener('click', handler);
      actions.appendChild(control);
      actionButtons.push(control);
      return control;
    }
    async function copy(value, success, control) {
      if (!beginAction('Copying…')) return;
      let copied = false;
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        if (!card.isConnected) return;
        status.textContent = success;
        copied = true;
      } catch (_) {
        if (!card.isConnected) return;
        field.value = value;
        if (!focusMoved && isVisible(field) && (document.activeElement === focusOrigin || document.activeElement === document.body || document.activeElement === document.documentElement)) {
          field.focus(); field.select();
          status.textContent = 'Copy was blocked. The text is selected: press and hold to copy, then paste it into the owner’s chat.';
        } else status.textContent = 'Copy was blocked. The text is available above for manual copying.';
      } finally {
        const restore = copied && canRestoreCopyFocus(control, focusOrigin, focusMoved, field);
        endAction();
        if (restore) control.focus({ preventScroll: true });
      }
    }
    button('Copy message', event => { field.value = message; return copy(message, 'Message copied. Paste it into the owner’s chat and send.', event.currentTarget); }).className = 'primary';
    button('Copy link', event => copy(link, 'Link copied. Paste it into the owner’s chat and send.', event.currentTarget));
    if (typeof navigator.share === 'function') {
      button('Share', async event => {
        const control = event.currentTarget;
        if (!beginAction('Opening share sheet…')) return;
        try {
          await navigator.share({ title: `${dog} — owner care form`, text: message });
          if (!card.isConnected) return;
          status.textContent = 'Share sheet closed. Check your chosen app to confirm the message was sent.';
        } catch (error) {
          if (!card.isConnected) return;
          if (error?.name === 'AbortError') status.textContent = 'Sharing cancelled. Your message is still ready to copy or share.';
          else status.textContent = 'Sharing is unavailable. Choose Copy message and paste it into the owner’s chat.';
        } finally {
          const restore = card.isConnected && control.isConnected && !focusMoved && isVisible(card) && (document.activeElement === control || document.activeElement === focusOrigin || document.activeElement === document.body || document.activeElement === document.documentElement);
          endAction();
          if (restore) control.focus();
        }
      });
    }
    card.append(heading, hint, label, actions, status);
    host.appendChild(card);
    return card;
  }
  window.WAFFLE_OWNER_HANDOFF = Object.freeze({ render, copyLink });
})();
