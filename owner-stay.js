(() => {
  'use strict';
  const root = document.querySelector('[data-owner-stay]');
  const find = selector => root.querySelector(selector);
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const status = find('[data-owner-status]'), form = find('[data-owner-handover]');
  let record;
  async function request(operation, extra = {}) {
    if (!token) throw Error('Open the private stay link shared by your sitter.');
    const response = await fetch(root.dataset.endpoint,{method:'POST',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
      body:new URLSearchParams({action:'owner_stay',payloadJson:JSON.stringify({token,operation,...extra})})});
    const result = await response.json();
    if (!response.ok || result.result !== 'success') throw Error(result.error || 'The stay link could not be loaded.');
    return result.value;
  }
  function show(value) {
    record = value;
    const format = date => new Date(date+'T00:00:00Z').toLocaleDateString('en-AU',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
    find('[data-owner-pet]').textContent = value.dogName;
    find('[data-owner-dates]').textContent = format(value.startDate)+' – '+format(value.endDate);
    const photo = find('[data-owner-photo]');
    photo.hidden = !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value.photo);
    if (!photo.hidden) photo.src = value.photo;
    const update = find('[data-owner-update]');
    update.hidden = !value.update;
    update.textContent = value.update;
    const intake = find('[data-owner-intake]');
    intake.hidden = !value.intakeToken;
    if (!intake.hidden) intake.href = 'palz-intake.html#'+new URLSearchParams({token:value.intakeToken});
    find('[data-owner-complete]').hidden = !value.intakeComplete;
    form.elements.dropoffTime.value = value.times.dropoffTime;
    form.elements.pickupTime.value = value.times.pickupTime;
    form.elements.dropoffTime.disabled = !value.canEdit || !value.canEditDropoff;
    form.elements.pickupTime.disabled = !value.canEdit;
    form.querySelector('button').hidden = !value.canEdit;
    find('[data-owner-content]').hidden = false;
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (!record?.canEdit || event.submitter.disabled) return;
    const button = event.submitter;
    button.disabled = true;
    try {
      show(await request('handover',{revision:record.revision,dropoffTime:form.elements.dropoffTime.value,pickupTime:form.elements.pickupTime.value}));
      status.textContent = 'Handover times confirmed.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  };
  request('read').then(value => { show(value); status.textContent = ''; }).catch(error => { status.textContent = error.message; });
})();
