(() => {
  'use strict';
  const api = window.WaffleRndOps;
  if (!api) return;
  const { $, safeText, isoToday, activeBusiness, activeSettings, activeMembership, dogById, stayById, setMessage } = api;

  function render(view=api.view){window.WaffleRndOpsRender.renderView(view);}
  async function refresh(view=api.view){await api.loadData();render(view);}

  function bindGlobal(){
    document.addEventListener('click', async event=>{
      const nav=event.target.closest('[data-ops-view]'); if(nav){api.editingStayId='';render(nav.dataset.opsView);return;}
      const jump=event.target.closest('[data-ops-jump]'); if(jump){api.editingStayId='';render(jump.dataset.opsJump);return;}
      const edit=event.target.closest('[data-edit-stay]'); if(edit){api.editingStayId=edit.dataset.editStay;render('add');return;}
      const profile=event.target.closest('[data-open-dog]'); if(profile){window.WaffleRndOpsRender.renderProfile(profile.dataset.openDog);return;}
      const care=event.target.closest('[data-care]'); if(care){api.careTab=care.dataset.care;render('care');return;}
      const cal=event.target.closest('[data-cal]'); if(cal){const now=new Date();if(cal.dataset.cal==='prev')api.calendarCursor=new Date(api.calendarCursor.getFullYear(),api.calendarCursor.getMonth()-1,1);if(cal.dataset.cal==='next')api.calendarCursor=new Date(api.calendarCursor.getFullYear(),api.calendarCursor.getMonth()+1,1);if(cal.dataset.cal==='today')api.calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);render('calendar');return;}
      if(event.target.closest('[data-cancel-edit]')){api.editingStayId='';render('add');return;}
      if(event.target.closest('[data-delete-stay]')){await deleteStay();return;}
      if(event.target.closest('[data-close-profile]')){const panel=$('opsProfilePanel');if(panel)panel.hidden=true;return;}
    });

    document.addEventListener('change', event=>{
      if(event.target.id==='opsBusinessPicker') switchBusiness(event.target.value);
      if(event.target.id==='opsDogSelect') toggleNewDog();
      if(event.target.id==='opsStatus'&&event.target.value==='meet_greet')$('opsEnd').value=$('opsStart').value;
      if(event.target.id==='opsStart'){if($('opsStatus')?.value==='meet_greet')$('opsEnd').value=event.target.value;else if($('opsEnd')&&(!$('opsEnd').value||$('opsEnd').value<event.target.value))$('opsEnd').value=event.target.value;}
    });

    document.addEventListener('submit', async event=>{
      if(event.target.id==='opsBookingForm'){event.preventDefault();await saveBooking();}
      if(event.target.id==='opsProfileForm'){event.preventDefault();await saveProfile();}
      if(event.target.id==='opsSettingsForm'){event.preventDefault();await saveSettings();}
    });
  }

  async function switchBusiness(id){
    api.businessId=id;api.editingStayId='';api.careTab='current';sessionStorage.setItem('waffleRndBusinessId',id);
    $('opsPlanBadge').textContent=safeText(activeBusiness()?.plan).toUpperCase();$('opsRoleBadge').textContent=safeText(activeMembership()?.role).toUpperCase();
    await refresh('today');
  }

  function bindView(){
    const select=$('opsDogSelect');if(select)toggleNewDog();
  }

  function toggleNewDog(){const node=$('opsNewDog');if(!node)return;const isNew=$('opsDogSelect').value==='__new__';node.hidden=!isNew;const name=$('opsNewDogName');if(name)name.required=isNew;}

  async function createDog(){
    const name=$('opsNewDogName').value.trim();if(!name)throw new Error('Enter the new dog name.');
    const {data,error}=await api.client.from('dogs').insert({business_id:api.businessId,dog_name:name,breed:$('opsNewBreed').value.trim()||null,owner_name:$('opsOwnerName').value.trim()||null,owner_phone:$('opsOwnerPhone').value.trim()||null}).select().single();
    if(error)throw error;return data;
  }

  async function saveBooking(){
    setMessage('opsBookingMessage',api.editingStayId?'Saving booking…':'Creating booking…');
    try{
      let dogId=$('opsDogSelect').value;if(!dogId)throw new Error('Choose a dog.');if(dogId==='__new__')dogId=(await createDog()).id;
      const status=$('opsStatus').value,start=$('opsStart').value;let end=$('opsEnd').value;if(status==='meet_greet')end=start;if(!start||!end)throw new Error('Start and end dates are required.');if(end<start)throw new Error('End date cannot be before start date.');
      const payload={business_id:api.businessId,dog_id:dogId,start_date:start,end_date:end,status,arrival_time:$('opsArrival').value||null,departure_time:status==='meet_greet'?null:($('opsDeparture').value||null),notes:$('opsNotes').value.trim()||null,updated_at:new Date().toISOString()};
      let error;if(api.editingStayId)({error}=await api.client.from('stays').update(payload).eq('id',api.editingStayId).eq('business_id',api.businessId));else({error}=await api.client.from('stays').insert(payload));if(error)throw error;
      api.editingStayId='';await refresh('calendar');
    }catch(error){setMessage('opsBookingMessage',error.message||String(error),true);}
  }

  async function deleteStay(){
    if(!api.editingStayId||activeMembership()?.role!=='owner')return;const stay=stayById(api.editingStayId),dog=dogById(stay?.dog_id);if(!confirm(`Delete ${dog?.dog_name||'this'} booking? The dog profile will be retained.`))return;
    const {error}=await api.client.from('stays').delete().eq('id',api.editingStayId).eq('business_id',api.businessId);if(error){setMessage('opsBookingMessage',error.message,true);return;}api.editingStayId='';await refresh('calendar');
  }

  async function saveProfile(){
    const panel=$('opsProfilePanel'),dogId=panel?.dataset.dogId;if(!dogId)return;setMessage('opsProfileMessage','Saving profile…');
    const {error}=await api.client.from('dogs').update({dog_name:$('opsProfileName').value.trim(),breed:$('opsProfileBreed').value.trim()||null,owner_name:$('opsProfileOwner').value.trim()||null,owner_phone:$('opsProfilePhone').value.trim()||null,notes:$('opsProfileNotes').value.trim()||null,updated_at:new Date().toISOString()}).eq('id',dogId).eq('business_id',api.businessId);
    if(error){setMessage('opsProfileMessage',error.message,true);return;}await api.loadData();render('care');window.WaffleRndOpsRender.renderProfile(dogId);setMessage('opsProfileMessage','Dog profile saved.');
  }

  async function saveSettings(){
    if(activeMembership()?.role!=='owner')return;setMessage('opsSettingsMessage','Saving…');
    const [{data:businessRow,error:bError},{data:settingRow,error:sError}]=await Promise.all([
      api.client.from('businesses').update({name:$('opsSettingsName').value.trim(),timezone:$('opsSettingsTimezone').value.trim(),normal_capacity:Number($('opsSettingsCapacity').value||4),updated_at:new Date().toISOString()}).eq('id',api.businessId).select().single(),
      api.client.from('business_settings').update({contact_name:$('opsSettingsContact').value.trim()||null,contact_email:$('opsSettingsEmail').value.trim()||null,contact_phone:$('opsSettingsPhone').value.trim()||null,address_text:$('opsSettingsAddress').value.trim()||null,default_arrival_time:$('opsSettingsArrival').value||null,default_departure_time:$('opsSettingsDeparture').value||null,updated_at:new Date().toISOString()}).eq('business_id',api.businessId).select().single()
    ]);
    if(bError||sError){setMessage('opsSettingsMessage',(bError||sError).message,true);return;}api.businesses.set(api.businessId,businessRow);api.settings.set(api.businessId,settingRow);$('opsPlanBadge').textContent=safeText(businessRow.plan).toUpperCase();setMessage('opsSettingsMessage','Business settings saved.');render('settings');
  }

  bindGlobal();
  window.WaffleRndOpsActions={bindView};
})();
