(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // En-tete : fond plein des que l'on quitte le haut de page
  var top = document.querySelector('[data-top]');
  var arch = document.querySelector('[data-arch]');
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    if (top) top.classList.toggle('is-solid', y > 24);
    if (arch && !reduce) {
      var r = arch.getBoundingClientRect();
      var vh = window.innerHeight;
      // 0 quand l'arche apparait en bas, 1 quand son haut atteint le quart superieur
      var p = (vh - r.top) / (vh * 0.75);
      p = Math.max(0, Math.min(1, p - 0.35));
      p = p / 0.65;
      arch.style.setProperty('--p', (1 - Math.pow(1 - Math.min(p, 1), 3)).toFixed(4));
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // Menu mobile
  var burger = document.querySelector('[data-burger]');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { burger.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
    });
  }

  // Visionneuse photos
  var dlg = document.querySelector('[data-lb-dialog]');
  var imgs = Array.prototype.slice.call(document.querySelectorAll('[data-lb]'));
  var idx = 0;
  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    var src = imgs[idx];
    var big = dlg.querySelector('[data-lb-img]');
    big.src = src.getAttribute('data-full') || src.currentSrc || src.src;
    big.alt = src.alt;
    dlg.querySelector('[data-lb-cap]').textContent = src.alt;
  }
  if (dlg && imgs.length && typeof dlg.showModal === 'function') {
    imgs.forEach(function (im, i) {
      im.setAttribute('tabindex', '0');
      im.setAttribute('role', 'button');
      function open() { show(i); dlg.showModal(); }
      im.addEventListener('click', open);
      im.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    dlg.querySelector('[data-lb-close]').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('[data-lb-prev]').addEventListener('click', function () { show(idx - 1); });
    dlg.querySelector('[data-lb-next]').addEventListener('click', function () { show(idx + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    var sx = null;
    dlg.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  // Demande de sejour : la demande est redigee puis ouverte dans la messagerie du visiteur
  var form = document.querySelector('[data-form]');
  if (!form) return;
  var to = ['raphaelau67', 'gmail.com'].join('@');
  var ds = form.dataset;
  var arrival = form.elements.arrival, departure = form.elements.departure;
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  var iso = today.toISOString().slice(0, 10);
  arrival.min = iso; departure.min = iso;
  arrival.addEventListener('change', function () {
    if (arrival.value) {
      departure.min = arrival.value;
      if (departure.value && departure.value <= arrival.value) departure.value = '';
    }
  });

  function setErr(input, msg) {
    var field = input.closest('.field');
    var old = field.querySelector('.err');
    if (old) old.remove();
    field.classList.toggle('is-bad', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) {
      var e = document.createElement('span');
      e.className = 'err'; e.textContent = msg;
      e.id = 'err-' + input.name;
      input.setAttribute('aria-describedby', e.id);
      field.appendChild(e);
    } else {
      input.removeAttribute('aria-describedby');
    }
  }
  function fmt(d) {
    var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0];
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var el = form.elements, first = null, ok = true;
    function bad(input, msg) { setErr(input, msg); ok = false; if (!first) first = input; }
    ['arrival', 'departure', 'people', 'type', 'name', 'email', 'phone'].forEach(function (n) { setErr(el[n], ''); });
    ['arrival', 'departure', 'type', 'name', 'email'].forEach(function (n) {
      if (!el[n].value.trim()) bad(el[n], ds.errRequired);
    });
    if (el.arrival.value && el.departure.value && el.departure.value <= el.arrival.value) bad(el.departure, ds.errDates);
    var ppl = parseInt(el.people.value, 10);
    if (!(ppl >= 1 && ppl <= 50)) bad(el.people, ds.errPeople);
    if (el.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.email.value.trim())) bad(el.email, ds.errEmail);
    if (!ok) { first.focus(); return; }

    var nights = Math.round((new Date(el.departure.value) - new Date(el.arrival.value)) / 86400000);
    var lines = [
      ds.intro, '',
      ds.lArrival + ' : ' + fmt(el.arrival.value),
      ds.lDeparture + ' : ' + fmt(el.departure.value) + ' (' + nights + ' ' + ds.nights + ')',
      ds.lPeople + ' : ' + ppl,
      ds.lType + ' : ' + el.type.value,
      '',
      ds.lName + ' : ' + el.name.value.trim(),
      ds.lEmail + ' : ' + el.email.value.trim()
    ];
    if (el.phone.value.trim()) lines.push(ds.lPhone + ' : ' + el.phone.value.trim());
    if (el.message.value.trim()) lines.push('', el.message.value.trim());
    var subject = ds.subject + ' — ' + fmt(el.arrival.value) + ' — ' + ppl;
    var href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));

    var done = form.querySelector('.form__done');
    var link = form.querySelector('[data-mail-link]');
    link.href = 'mailto:' + to; link.textContent = to;
    done.hidden = false;
    window.location.href = href;
  });
})();
