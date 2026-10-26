  // photos par etage : elles suivent l'onglet choisi
  var FP=[
    [['chambre-rdc','Chambre du rez-de-chaussée'],['chambre-rdc-2','Chambre à deux lits, rez-de-chaussée'],['sdb-douche','Douche à l’italienne, adaptée PMR']],
    [['chambre-double','Chambre double'],['chambre-fleurie','Chambre double fleurie'],['chambre-balcon','Chambre avec balcon'],['sdb-baignoire','Salle de bain privée']],
    [['chambre-verte','Chambre sous les toits'],['chambre-bleue','Chambre familiale'],['chambre-ocre','Chambre sous les combles'],['chambre-bleue-3','Chambre familiale, coin salon']]
  ];
  var rp=document.querySelector('[data-roompics]'),floorSet=[];
  function pics(n){
    floorSet=FP[n].map(function(p){return {src:'../../assets/img/'+p[0]+'.webp',alt:p[1]}});
    rp.innerHTML=FP[n].map(function(p,i){return '<figure class="zoom"><img class="ph" data-fi="'+i+'" tabindex="0" style="cursor:zoom-in" src="../../assets/img/'+p[0]+'-s.webp" alt="'+p[1]+'" loading="lazy"><figcaption>'+p[1]+'</figcaption></figure>'}).join('');
  }
  pics(0);
  rp.addEventListener('click',function(e){var im=e.target.closest('[data-fi]');if(im)openLb(floorSet,+im.dataset.fi)});
  rp.addEventListener('keydown',function(e){var im=e.target.closest('[data-fi]');if(im&&e.key==='Enter')openLb(floorSet,+im.dataset.fi)});
  tabs.forEach(function(t,i){t.addEventListener('click',function(){pics(i)});t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){setTimeout(function(){var k2=tabs.findIndex(function(x){return x.getAttribute('aria-selected')==='true'});pics(k2)},0)}})});
