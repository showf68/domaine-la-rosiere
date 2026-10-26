  // ---- reservation : calendrier, estimation, envoi ----
  // API = service du site (voir server/). Vide : le formulaire ouvre un e-mail prérempli (repli).
  var CFG={api:'',mail:'domainelarosiere@gmail.com',dest:'116 Grand’Rue, 67430 Diemeringen'};
  // Tarifs du site actuel (relevé 26/10/2026). SEASONS : [{from:'AAAA-MM-JJ',to:'AAAA-MM-JJ',t:'haute'|'tres'}] à fournir par le propriétaire ; sans période, tarif 1.
  var TARIFS={t1:{n:1200,w:6750,x:30,min:2},haute:{n:1300,w:7600,x:26,min:4},tres:{n:1450,w:10150,x:26,min:4}},INCL=20,SEASONS=[];
  function tarifOf(iso){for(var i=0;i<SEASONS.length;i++){if(iso>=SEASONS[i].from&&iso<=SEASONS[i].to)return TARIFS[SEASONS[i].t]}return TARIFS.t1}
  var f=document.querySelector('[data-form]'),el=f.elements;
  var t=new Date();t.setMinutes(t.getMinutes()-t.getTimezoneOffset());var iso=t.toISOString().slice(0,10);
  el.arrival.min=iso;el.departure.min=iso;
  var rA=f.querySelector('[data-r-arr]'),rD=f.querySelector('[data-r-dep]'),rS=f.querySelector('[data-r-stay]'),est=f.querySelector('[data-estim]');
  function fmt(v){var d=new Date(v+'T12:00:00');return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
  function setR(node,txt,empty){node.textContent=txt;node.classList.toggle('empty',!!empty)}
  function addDays(v,n){var d=new Date(v+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  function nightsBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5)}
  // nuits déjà réservées (ensemble de dates AAAA-MM-JJ)
  var BUSY={};
  function setBusy(list){BUSY={};(list||[]).forEach(function(r){for(var d=r.start;d<r.end;d=addDays(d,1))BUSY[d]=1})}
  function freeRange(a,b){for(var d=a;d<b;d=addDays(d,1)){if(BUSY[d])return false}return true}
  function price(n,p,a){var T=tarifOf(a),base=Math.floor(n/7)*T.w+(n%7)*T.n,extra=Math.max(0,p-INCL)*T.x*n;
    var opt=(el.sheets.checked?10*p:0)+(el.towels.checked?3*p:0);return {base:base,extra:extra,opt:opt,total:base+extra+opt,min:T.min}}
  function eur(v){return v.toLocaleString('fr-FR')+' €'}
  function nights(){
    setR(rA,el.arrival.value?fmt(el.arrival.value):'à choisir',!el.arrival.value);
    setR(rD,el.departure.value?fmt(el.departure.value):'à choisir',!el.departure.value);
    var p=parseInt(el.people.value,10)||0;
    if(el.arrival.value&&el.departure.value&&el.departure.value>el.arrival.value){
      var n=nightsBetween(el.arrival.value,el.departure.value);setR(rS,n+(n>1?' nuits':' nuit')+' · '+p+' pers.');
      var q=price(n,p,el.arrival.value);est.hidden=false;
      if(!freeRange(el.arrival.value,el.departure.value)){est.innerHTML='Ces dates ne sont pas libres : une partie du séjour est déjà réservée.'}
      else if(n<q.min){est.innerHTML='Séjour minimum : <b>'+q.min+' nuits</b> sur cette période.'}
      else{est.innerHTML='Estimation du séjour : <b>'+eur(q.total)+'</b><small>Location '+eur(q.base)+(q.extra?' · personnes au-delà de '+INCL+' : '+eur(q.extra):'')+(q.opt?' · options : '+eur(q.opt):'')+'. Tarif indicatif, confirmé par le propriétaire.</small>'}
    }else{setR(rS,p+' pers.',false);est.hidden=true}
    drawCal();
  }
  // ---- calendrier ----
  var cal=f.querySelector('[data-cal]'),calM=cal.querySelector('[data-calm]'),calT=cal.querySelector('[data-calttl]'),view=new Date(iso.slice(0,7)+'-01T12:00:00');
  function monthHtml(d){
    var y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1,12),lead=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
    var s='<div class="cal__m"><h4>'+d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})+'</h4><div class="cal__g">'+['L','M','M','J','V','S','D'].map(function(x){return '<span>'+x+'</span>'}).join('');
    for(var i=0;i<lead;i++)s+='<i></i>';
    for(var k=1;k<=days;k++){
      var v=y+'-'+('0'+(m+1)).slice(-2)+'-'+('0'+k).slice(-2),c='',a=el.arrival.value,b=el.departure.value;
      if(v<iso)c='past';else if(BUSY[v])c='busy';
      if(a&&(v===a||(b&&v===b)))c='end';else if(a&&b&&v>a&&v<b)c='sel';
      s+='<button type="button" data-d="'+v+'" class="'+c+'"'+((v<iso)?' aria-disabled="true" tabindex="-1"':'')+' aria-label="'+fmt(v)+(BUSY[v]?', déjà réservé':'')+'">'+k+'</button>'}
    return s+'</div></div>'}
  function drawCal(){var n2=new Date(view);n2.setMonth(n2.getMonth()+1);calM.innerHTML=monthHtml(view)+monthHtml(n2);calT.textContent=''}
  cal.querySelectorAll('[data-calnav]').forEach(function(b){b.addEventListener('click',function(){var d=new Date(view);d.setMonth(d.getMonth()+ +b.dataset.calnav);if(d.toISOString().slice(0,7)<iso.slice(0,7))return;view=d;drawCal()})});
  calM.addEventListener('click',function(e){var b=e.target.closest('[data-d]');if(!b||b.getAttribute('aria-disabled'))return;var v=b.dataset.d,a=el.arrival.value,d2=el.departure.value;
    if(a&&!d2&&v>a&&freeRange(a,v)){el.departure.value=v}
    else if(!BUSY[v]){el.arrival.value=v;el.departure.value=''}
    else return;
    nights()});
  [el.arrival,el.departure].forEach(function(i){i.addEventListener('click',function(){try{i.showPicker()}catch(e){}})});
  el.arrival.addEventListener('change',function(){if(el.arrival.value){el.departure.min=el.arrival.value;if(el.departure.value&&el.departure.value<=el.arrival.value)el.departure.value='';view=new Date(el.arrival.value.slice(0,7)+'-01T12:00:00')}nights()});
  el.departure.addEventListener('change',nights);
  f.querySelectorAll('[data-stepbtn]').forEach(function(x){x.addEventListener('click',function(){el.people.value=Math.min(50,Math.max(1,(parseInt(el.people.value,10)||0)+ +x.dataset.stepbtn));nights()})});
  el.people.addEventListener('input',nights);el.sheets.addEventListener('change',nights);el.towels.addEventListener('change',nights);
  nights();
  fetch((CFG.api||'../..')+(CFG.api?'/disponibilites.json':'/data/disponibilites.json'),{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){setBusy(j.booked);nights()}).catch(function(){});
  function err(input,msg){var fl=input.closest('.fld');var o=fl.querySelector('.err');if(o)o.remove();fl.classList.toggle('bad',!!msg);input.setAttribute('aria-invalid',msg?'true':'false');if(msg){var e=document.createElement('span');e.className='err';e.textContent=msg;fl.appendChild(e)}}
  f.addEventListener('submit',function(ev){ev.preventDefault();var first=null;function bad(i,m){err(i,m);if(!first)first=i}
    ['arrival','departure','people','name','email','phone'].forEach(function(n){err(el[n],'')});
    if(!el.arrival.value)bad(el.arrival,'Date d’arrivée ?');
    if(!el.departure.value)bad(el.departure,'Date de départ ?');else if(el.arrival.value&&el.departure.value<=el.arrival.value)bad(el.departure,'Après l’arrivée.');
    else if(!freeRange(el.arrival.value,el.departure.value))bad(el.departure,'Dates déjà réservées.');
    var pp=parseInt(el.people.value,10);if(!(pp>=1&&pp<=50))bad(el.people,'Entre 1 et 50.');
    if(!el.name.value.trim())bad(el.name,'Votre nom ?');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.email.value.trim()))bad(el.email,'E-mail incomplet.');
    if(el.phone.value.replace(/\D/g,'').length<8)bad(el.phone,'Téléphone ?');
    if(first){first.focus();return}
    var n=nightsBetween(el.arrival.value,el.departure.value),q=price(n,pp,el.arrival.value);
    var d={arrival:el.arrival.value,departure:el.departure.value,people:pp,type:f.querySelector('[name=type]:checked').value,name:el.name.value.trim(),email:el.email.value.trim(),phone:el.phone.value.trim(),sheets:el.sheets.checked,towels:el.towels.checked,message:el.message.value.trim(),estimate:q.total,nights:n};
    function done(title,txt){f.querySelector('[data-formbody]').hidden=true;f.querySelector('[data-done]').hidden=false;f.querySelector('[data-donetitle]').textContent=title;f.querySelector('[data-donetxt]').textContent=txt}
    if(CFG.api){fetch(CFG.api+'/demande',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)}).then(function(r){if(!r.ok)throw 0;done('Merci, votre demande est envoyée.','Le propriétaire vous répond personnellement.')}).catch(function(){err(el.email,'Envoi impossible : écrivez à '+CFG.mail)})}
    else{var body='Arrivée : '+d.arrival+'\nDépart : '+d.departure+' ('+n+' nuits)\nPersonnes : '+pp+'\nOccasion : '+d.type+'\nDraps : '+(d.sheets?'oui':'non')+' · Serviettes : '+(d.towels?'oui':'non')+'\nEstimation : '+eur(q.total)+'\n\nNom : '+d.name+'\nTéléphone : '+d.phone+'\nE-mail : '+d.email+'\n\n'+d.message;
      location.href='mailto:'+CFG.mail+'?subject='+encodeURIComponent('Demande de séjour '+d.arrival+' - '+d.departure)+'&body='+encodeURIComponent(body);
      done('Votre messagerie s’ouvre.','Envoyez le message prérempli : il arrive directement au propriétaire.')}});
  // ---- itineraire ----
  var rt=document.querySelector('[data-route]');
  rt.addEventListener('submit',function(ev){ev.preventDefault();var v=rt.elements.from.value.trim();if(!v){rt.elements.from.focus();return}
    var q=encodeURIComponent(v),dd=encodeURIComponent(CFG.dest);
    document.querySelector('[data-routemap]').src='https://maps.google.com/maps?saddr='+q+'&daddr='+dd+'&hl=fr&output=embed';
    document.querySelector('[data-routelink]').href='https://www.google.com/maps/dir/?api=1&origin='+q+'&destination='+dd});
