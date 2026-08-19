/* ==========================================================================
   OMIYAcappella — prototype scripts
   Loader / sticky header / mobile nav / scroll reveal / scroll spy /
   gallery filter + lightbox / contact form.
   No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------- Config */

  /* Where the contact form is delivered. FormSubmit relays each submission to
     this mailbox; the first submission triggers a one-off confirmation email
     that the owner has to click before delivery starts.

     TODO before launch: once activated, FormSubmit issues an alias endpoint of
     the form https://formsubmit.co/ajax/el/xxxxxxx — swap it in here so the
     address no longer appears anywhere in the source. Any endpoint that accepts
     a POST (Formspree, Google Apps Script, a serverless function) works too.
     Set this to '' to fall back to prototype mode, where nothing is sent. */
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/REDACTED@example.com';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- Loader */
  var loader = document.getElementById('loader');
  if (loader) {
    var hide = function () {
      loader.classList.add('is-done');
    };
    window.addEventListener('load', function () {
      setTimeout(hide, reduceMotion ? 0 : 1100);
    });
    // Safety net in case a slow asset delays the load event.
    setTimeout(hide, 3500);
  }

  /* -------------------------------------------------------- Sticky header */
  var header = document.getElementById('header');
  var isSubPage = header && header.classList.contains('is-stuck');

  if (header && !isSubPage) {
    var syncHeader = function () {
      header.classList.toggle('is-stuck', window.scrollY > 40);
    };
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  /* ----------------------------------------------------------- Mobile nav */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  if (toggle && nav) {
    var setNav = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
    };

    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
    });

    // Closing the overlay on resize avoids a stuck body scroll lock.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) setNav(false);
    });
  }

  /* --------------------------------------------------------- Scroll reveal */
  var revealables = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ------------------------------------------------------------ Scroll spy */
  var spyLinks = Array.prototype.filter.call(
    document.querySelectorAll('.nav__link'),
    function (a) { return (a.getAttribute('href') || '').indexOf('#') === 0; }
  );

  if (spyLinks.length && 'IntersectionObserver' in window) {
    var sections = spyLinks
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);

    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        spyLinks.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { spyObserver.observe(s); });
  }

  /* --------------------------------------------------------- Gallery filter */
  var galGrid = document.getElementById('galGrid');

  if (galGrid) {
    var galItems = Array.prototype.slice.call(galGrid.querySelectorAll('.gal-item'));
    var galEmpty = document.getElementById('galEmpty');
    var filterBtns = document.querySelectorAll('.gal-filter button');

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.dataset.filter;
        var shown = 0;

        filterBtns.forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });

        galItems.forEach(function (item) {
          var match = kind === 'all' || item.dataset.kind === kind;
          item.classList.toggle('is-hidden', !match);
          if (match) shown++;
        });

        if (galEmpty) galEmpty.hidden = shown > 0;
      });
    });

    /* ------------------------------------------------------------ Lightbox */
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lbImg');
    var lbCap = document.getElementById('lbCap');
    // Only photo items open in the lightbox; videos link straight out to X.
    var photos = galItems.filter(function (i) { return i.dataset.src; });
    var lbIndex = 0;
    var lastFocus = null;

    var renderLb = function () {
      var item = photos[lbIndex];
      lbImg.src = item.dataset.src;
      lbImg.alt = item.querySelector('img') ? item.querySelector('img').alt : '';
      lbCap.innerHTML = item.dataset.caption
        + (item.dataset.href
          ? ' — <a href="' + item.dataset.href + '" target="_blank" rel="noopener">Xの投稿を見る</a>'
          : '');
    };

    var openLb = function (index) {
      lbIndex = index;
      lastFocus = document.activeElement;
      renderLb();
      lb.hidden = false;
      lb.classList.add('is-open');
      document.body.classList.add('is-locked');
      document.getElementById('lbClose').focus();
    };

    var closeLb = function () {
      lb.classList.remove('is-open');
      lb.hidden = true;
      document.body.classList.remove('is-locked');
      if (lastFocus) lastFocus.focus();
    };

    var stepLb = function (delta) {
      lbIndex = (lbIndex + delta + photos.length) % photos.length;
      renderLb();
    };

    photos.forEach(function (item, i) {
      item.addEventListener('click', function () { openLb(i); });
    });

    document.getElementById('lbClose').addEventListener('click', closeLb);
    document.getElementById('lbPrev').addEventListener('click', function () { stepLb(-1); });
    document.getElementById('lbNext').addEventListener('click', function () { stepLb(1); });

    // Clicking the backdrop closes; clicking the image or caption does not.
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLb();
    });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') stepLb(-1);
      if (e.key === 'ArrowRight') stepLb(1);
    });
  }

  /* ------------------------------------------------------------------ Form */
  var form = document.getElementById('contactForm');
  if (!form) return;

  var status = document.getElementById('formStatus');
  var submitBtn = form.querySelector('.form__submit');
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var fieldOf = function (input) { return input.closest('.field'); };

  var isFilled = function (input) {
    if (input.type === 'checkbox') return input.checked;
    return input.value.trim() !== '';
  };

  var validate = function (input) {
    var ok = isFilled(input);
    if (ok && input.type === 'email') ok = emailPattern.test(input.value.trim());
    fieldOf(input).classList.toggle('has-error', !ok);
    return ok;
  };

  var required = ['f-name', 'f-email', 'f-type', 'f-message', 'f-agree']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  required.forEach(function (input) {
    // Only re-validate after a first failed attempt, so typing feels quiet.
    input.addEventListener('blur', function () {
      if (fieldOf(input).classList.contains('has-error')) validate(input);
    });
    input.addEventListener('change', function () {
      if (fieldOf(input).classList.contains('has-error')) validate(input);
    });
  });

  var say = function (message, ok) {
    status.classList.add('is-shown');
    status.classList.toggle('is-ok', !!ok);
    status.textContent = message;
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var results = required.map(validate);
    if (results.indexOf(false) !== -1) {
      say('未入力または形式に誤りのある項目があります。赤く表示された項目をご確認ください。', false);
      var firstError = form.querySelector('.field.has-error input, .field.has-error select, .field.has-error textarea');
      if (firstError) firstError.focus();
      return;
    }

    if (!FORM_ENDPOINT) {
      say('入力内容の確認が完了しました。※ 送信先が未設定のため、実際の送信は行われていません。', true);
      return;
    }

    var data = new FormData(form);
    data.append('_subject', '【OMIYAcappella】サイトからのお問い合わせ：' + data.get('type'));
    data.append('_template', 'table');
    data.append('_captcha', 'false');

    submitBtn.disabled = true;
    say('送信しています…', false);

    fetch(FORM_ENDPOINT, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () {
        form.reset();
        say('送信しました。運営にメールで通知が届きます。折り返しのご連絡までしばらくお待ちください。', true);
      })
      .catch(function () {
        say(
          '送信に失敗しました。通信環境をご確認のうえ、もう一度お試しください。'
          + '解決しない場合は X（@OMIYAacappella）のDMからご連絡ください。',
          false
        );
      })
      .then(function () {
        submitBtn.disabled = false;
      });
  });
})();
