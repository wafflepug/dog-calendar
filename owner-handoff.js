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
    let copyPending = false;
    copyButton.addEventListener('click', async () => {
      if (copyPending || !card.isConnected) return;
      const focusWasOnControls = document.activeElement === copyButton || document.activeElement === linkField || document.activeElement === document.body || document.activeElement === document.documentElement;
      copyPending = true;
      copyButton.disabled = true;
      let restoreFocus = false;
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(link);
        if (!card.isConnected) return;
        status.textContent = 'Owner care link copied. Paste it into the owner’s usual chat and send.';
        const active = document.activeElement;
        if (!linkLabel.hidden) {
          linkLabel.hidden = true;
          restoreFocus = focusWasOnControls && (active === linkField || active === copyButton || active === document.body);
        }
      } catch (_) {
        if (!card.isConnected) return;
        if (linkLabel.parentNode !== card) card.insertBefore(linkLabel, actions);
        linkLabel.hidden = false;
        const active = document.activeElement;
        const canSelectFallback = focusWasOnControls && (active === linkField || active === copyButton || active === document.body || active === document.documentElement);
        if (canSelectFallback) {
          linkField.focus();
          linkField.select();
          status.textContent = 'Copy was blocked. The link is selected: press and hold to copy, then paste it into the owner’s chat.';
        } else {
          status.textContent = 'Copy was blocked. The link is available in the field above for manual copying.';
        }
      } finally {
        copyPending = false;
        if (card.isConnected) {
          copyButton.disabled = false;
          if (restoreFocus) copyButton.focus();
        }
      }
    });
    actions.appendChild(copyButton);

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
    async function copy(value, success, fallbackField) {
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        if (!card.isConnected) return;
        status.textContent = success;
      } catch (_) {
        if (!card.isConnected) return;
        fallbackField.focus();
        fallbackField.select();
        status.textContent = 'Copy was blocked. The text is selected: press and hold to copy, then paste it into the owner’s chat.';
      }
    }
    function secondaryButton(text, handler) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', handler);
      secondaryActions.appendChild(button);
      return button;
    }
    secondaryButton('Copy message', () => copy(message, 'Message copied. Paste it into the owner’s chat and send.', messageField)).className = 'primary';
    if (typeof navigator.share === 'function') {
      secondaryButton('Share', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await navigator.share({ title: `${dog} — owner care form`, text: message });
          if (!card.isConnected) return;
          status.textContent = 'Share sheet closed. Check your chosen app to confirm the message was sent.';
        } catch (error) {
          if (!card.isConnected) return;
          if (error?.name === 'AbortError') status.textContent = 'Sharing cancelled. Your message is still ready to copy or share.';
          else status.textContent = 'Sharing is unavailable. Choose Copy message and paste it into the owner’s chat.';
        } finally { button.disabled = false; }
      });
    }
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

    function button(text, handler) {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = text;
      control.addEventListener('click', handler);
      actions.appendChild(control);
      return control;
    }
    async function copy(value, success) {
      try {
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        status.textContent = success;
      } catch (_) {
        field.value = value;
        field.focus();
        field.select();
        status.textContent = 'Copy was blocked. The text is selected: press and hold to copy, then paste it into the owner’s chat.';
      }
    }
    button('Copy message', () => { field.value = message; return copy(message, 'Message copied. Paste it into the owner’s chat and send.'); }).className = 'primary';
    button('Copy link', () => copy(link, 'Link copied. Paste it into the owner’s chat and send.'));
    if (typeof navigator.share === 'function') {
      button('Share', async event => {
        const control = event.currentTarget;
        control.disabled = true;
        try {
          await navigator.share({ title: `${dog} — owner care form`, text: message });
          status.textContent = 'Share sheet closed. Check your chosen app to confirm the message was sent.';
        } catch (error) {
          if (error?.name === 'AbortError') status.textContent = 'Sharing cancelled. Your message is still ready to copy or share.';
          else status.textContent = 'Sharing is unavailable. Choose Copy message and paste it into the owner’s chat.';
        } finally { control.disabled = false; }
      });
    }
    card.append(heading, hint, label, actions, status);
    host.appendChild(card);
    return card;
  }
  window.WAFFLE_OWNER_HANDOFF = Object.freeze({ render });
})();
