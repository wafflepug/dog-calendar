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

  function render(host, details) {
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
