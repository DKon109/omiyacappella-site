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

  /* Newest posts shown in the X section, newest first, pinned post excluded.
     Rendered from this data rather than through X's embed widget: the profile
     timeline widget is sunset upstream, and the single-post embed has spells
     of not responding, which would leave the section blank. Everything below
     is served from this site, so the cards always appear.

     To refresh: replace these three entries with the latest posts, and drop
     any new image into assets/img/. */
  var LATEST_POSTS = [
    {
      id: '2073646030047072696',
      date: '2026.07.05',
      text: '今年から都内や埼玉で働くことになった新卒の方や異動された方等、是非一緒にアカペラしませんか？\n\n本コミュニティの規模自体はそこまで大きくないですが、その分楽しく活動しています！',
      quote: {
        text: '舞浜アカペラストリート／出演したバンド: おおみやの森／帰りたくなったよ・いきものがかり',
        id: '2053350183833145686'
      }
    },
    {
      id: '2067811327951970505',
      date: '2026.06.19',
      text: '✍️本コミュニティに関するQ&A\n過去いただいた問い合わせをもとにこちらで情報共有致します\n\n･会費は？\n一切ありません\n\n･アカペラ以外の活動は？\n強制的な活動は一切ありませんが、BBQや飲み会は定期的に開催しています\n\n･退会は自由？\n引き止める、といったことは特にありません',
      image: './assets/img/x-qa.jpg',
      alt: 'メンバーでのBBQのようす'
    },
    {
      id: '2053350183833145686',
      date: '2026.05.10',
      text: '舞浜アカペラストリート\n\n出演したバンド: おおみやの森\n\n帰りたくなったよ／いきものがかり\n\n#アカペラ #大宮',
      video: './assets/video/maihama.mp4',
      poster: './assets/img/maihama-poster.jpg'
    }
  ];

  var X_HANDLE = 'OMIYAacappella';

  /* Live 企画募集 feed, published by the LINE webhook worker in /server.
     Empty until the worker is deployed, in which case the section falls back
     to the entries written into index.html. */
  var PROJECTS_ENDPOINT = '';

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

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
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
    var lbStage = document.getElementById('lbStage');
    var lbCap = document.getElementById('lbCap');
    var lbIndex = 0;
    var lastFocus = null;

    /* X blocks hotlinking of video.twimg.com by Referer, and its embed service
       is not always reachable, so the clips are served from this site and
       played in a plain <video>. That also gives the browser's own fullscreen
       control, which is what an embed could not reliably offer. */

    var statusId = function (item) {
      var match = (item.getAttribute('href') || '').match(/status\/(\d+)/);
      return match ? match[1] : null;
    };

    var caption = function (item) {
      var title = item.querySelector('.gal-item__title');
      var sub = item.querySelector('.gal-item__sub');
      return [title && title.textContent, sub && sub.textContent]
        .filter(Boolean).join(' — ');
    };

    var xLink = function (item, label) {
      return ' — <a href="' + item.getAttribute('href')
        + '" target="_blank" rel="noopener">' + (label || 'Xの投稿を見る') + '</a>';
    };

    var showPhoto = function (item) {
      var img = document.createElement('img');
      img.src = item.dataset.src;
      var thumb = item.querySelector('img');
      img.alt = thumb ? thumb.alt : '';
      lbStage.appendChild(img);
      lbCap.innerHTML = item.dataset.caption
        + (item.dataset.href
          ? ' — <a href="' + item.dataset.href + '" target="_blank" rel="noopener">Xの投稿を見る</a>'
          : '');
    };

    var showMedia = function (item) {
      // Audio posts were uploaded as a screen recording of a voice memo, so
      // only the sound is worth playing — <audio> reads the same mp4.
      var isAudio = item.dataset.kind === 'audio';
      var player = document.createElement(isAudio ? 'audio' : 'video');
      player.src = item.dataset.video;
      player.controls = true;
      player.autoplay = true;
      player.preload = 'metadata';

      if (!isAudio) {
        player.playsInline = true;
        player.className = 'lightbox__video';
        var thumb = item.querySelector('img');
        if (thumb) player.poster = thumb.getAttribute('src');
      }

      player.addEventListener('error', function () {
        player.remove();
        var fallback = document.createElement('p');
        fallback.className = 'lightbox__fallback';
        fallback.innerHTML = '再生できませんでした。<br>'
          + '<a href="' + item.getAttribute('href')
          + '" target="_blank" rel="noopener">Xの投稿ページで再生する</a>';
        lbStage.appendChild(fallback);
      });

      if (isAudio) {
        var shell = document.createElement('div');
        shell.className = 'lightbox__audioshell';
        shell.appendChild(el('span', 'lightbox__wave'));
        shell.appendChild(player);
        lbStage.appendChild(shell);
      } else {
        lbStage.appendChild(player);
      }

      lbCap.innerHTML = caption(item) + xLink(item);
    };

    var clearStage = function () {
      var playing = lbStage.querySelector('video, audio');
      if (playing) {
        playing.pause();
        playing.removeAttribute('src');
        playing.load();
      }
      while (lbStage.firstChild) lbStage.removeChild(lbStage.firstChild);
    };

    var renderLb = function () {
      var item = galItems[lbIndex];
      clearStage();

      if (item.dataset.src) showPhoto(item);
      else if (item.dataset.video) showMedia(item);
    };

    var openLb = function (index) {
      lbIndex = index;
      lastFocus = document.activeElement;
      lb.hidden = false;
      lb.classList.add('is-open');
      document.body.classList.add('is-locked');
      renderLb();
      document.getElementById('lbClose').focus();
    };

    var closeLb = function () {
      clearStage();
      lb.classList.remove('is-open');
      lb.hidden = true;
      document.body.classList.remove('is-locked');
      if (lastFocus) lastFocus.focus();
    };

    /* Steps over whatever the active filter is showing, so ← → stays in step
       with the grid the viewer is looking at. */
    var stepLb = function (delta) {
      var shown = galItems.filter(function (i) { return !i.classList.contains('is-hidden'); });
      if (!shown.length) return;
      var at = shown.indexOf(galItems[lbIndex]);
      var next = shown[(at + delta + shown.length) % shown.length];
      lbIndex = galItems.indexOf(next);
      renderLb();
    };

    galItems.forEach(function (item, i) {
      item.addEventListener('click', function (e) {
        // Leave cmd/ctrl-click and middle-click to open X in a new tab.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openLb(i);
      });
    });

    document.getElementById('lbClose').addEventListener('click', closeLb);
    document.getElementById('lbPrev').addEventListener('click', function () { stepLb(-1); });
    document.getElementById('lbNext').addEventListener('click', function () { stepLb(1); });

    // Clicking the backdrop closes; clicking the media or caption does not.
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target === lbStage) closeLb();
    });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') stepLb(-1);
      if (e.key === 'ArrowRight') stepLb(1);
    });
  }

  /* ------------------------------------------------------- Latest X posts */
  var xLatest = document.getElementById('xLatest');

  if (xLatest && LATEST_POSTS.length) {
    LATEST_POSTS.forEach(function (post) {
      xLatest.appendChild(buildPost(post));
    });
  }

  function buildPost(post) {
    var url = 'https://x.com/' + X_HANDLE + '/status/' + post.id;

    var card = el('article', 'xpost');

    var head = el('div', 'xpost__head');
    var avatar = document.createElement('img');
    avatar.className = 'xpost__avatar';
    avatar.src = './assets/img/logo.jpg';
    avatar.alt = '';
    head.appendChild(avatar);
    var who = el('div');
    who.appendChild(el('p', 'xpost__name', 'OMIYAcappella'));
    who.appendChild(el('p', 'xpost__handle', '@' + X_HANDLE));
    head.appendChild(who);
    card.appendChild(head);

    card.appendChild(el('p', 'xpost__text', post.text));

    if (post.quote) {
      var quote = el('blockquote', 'xpost__quote');
      quote.appendChild(el('p', '', post.quote.text));
      card.appendChild(quote);
    }

    if (post.image) {
      var figure = el('figure', 'xpost__media');
      var img = document.createElement('img');
      img.src = post.image;
      img.alt = post.alt || '';
      img.loading = 'lazy';
      figure.appendChild(img);
      card.appendChild(figure);
    }

    if (post.video) {
      var media = el('figure', 'xpost__media');
      var video = document.createElement('video');
      video.src = post.video;
      video.poster = post.poster || '';
      video.controls = true;
      video.preload = 'none';
      video.playsInline = true;
      media.appendChild(video);
      card.appendChild(media);
    }

    var foot = el('div', 'xpost__foot');
    foot.appendChild(el('span', 'xpost__date', post.date));
    var link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'xpost__link';
    link.textContent = 'Xで見る';
    foot.appendChild(link);
    card.appendChild(foot);

    return card;
  }

  /* ------------------------------------------------ Live projects feed */
  var lineTl = document.getElementById('lineTl');

  if (lineTl && PROJECTS_ENDPOINT) {
    fetch(PROJECTS_ENDPOINT)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var entries = (data && data.entries) || [];
        if (!entries.length) return;

        // Newest first, above the entries baked into the page.
        entries.slice().reverse().forEach(function (entry) {
          lineTl.insertBefore(buildProject(entry), lineTl.firstElementChild);
        });
      })
      .catch(function () {
        // The static entries already on the page stand in for the feed.
      });
  }

  function buildProject(entry) {
    var article = document.createElement('article');
    article.className = 'line-post line-post--open reveal is-visible is-live';
    article.dataset.state = 'current';

    var card = document.createElement('div');
    card.className = 'line-post__card';

    var top = document.createElement('div');
    top.className = 'line-post__top';
    top.appendChild(el('span', 'line-post__date', formatDate(entry.at)));
    top.appendChild(el('span', 'tag tag--kind', entry.kind));
    if (entry.status) {
      var tone = entry.status === '募集中' ? 'open'
        : entry.status === '成立' ? 'filled' : 'done';
      top.appendChild(el('span', 'tag tag--' + tone, entry.status));
    }
    top.appendChild(el('span', 'tag tag--live', 'LINEから自動反映'));
    card.appendChild(top);

    var song = el('h3', 'line-post__song', entry.song);
    if (entry.artist) song.appendChild(el('span', '', entry.artist));
    card.appendChild(song);

    if (entry.body) card.appendChild(el('p', 'line-post__body', entry.body));

    var foot = document.createElement('dl');
    foot.className = 'line-post__foot';
    [
      ['募集パート', entry.parts],
      ['締切', entry.deadline],
      ['日時', entry.date],
      ['練習場所', entry.place]
    ].forEach(function (pair) {
      if (!pair[1]) return;
      var wrap = document.createElement('div');
      wrap.appendChild(el('dt', '', pair[0]));
      wrap.appendChild(el('dd', '', pair[1]));
      foot.appendChild(wrap);
    });

    card.appendChild(foot);
    article.appendChild(card);
    return article;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '.'
      + String(d.getMonth() + 1).padStart(2, '0') + '.'
      + String(d.getDate()).padStart(2, '0');
  }

  /* ------------------------------------------------- Past projects toggle */
  var pastToggle = document.getElementById('pastToggle');

  if (pastToggle) {
    var pastPosts = document.querySelectorAll('.line-post[data-state="past"]');

    var closedLabel = '過去の企画を見る（' + pastPosts.length + '件）'
      + '<span class="btn__arrow" aria-hidden="true">\u2192</span>';
    pastToggle.innerHTML = closedLabel;

    pastToggle.addEventListener('click', function () {
      var open = pastToggle.getAttribute('aria-expanded') === 'true';
      pastToggle.setAttribute('aria-expanded', String(!open));
      pastToggle.innerHTML = open
        ? closedLabel
        : '過去の企画を閉じる<span class="btn__arrow" aria-hidden="true">\u2191</span>';

      pastPosts.forEach(function (post) {
        post.classList.toggle('is-collapsed', open);
        // Entries revealed after their observer fired would stay transparent.
        if (!open) post.classList.add('is-visible');
      });

      if (open) pastToggle.scrollIntoView({ block: 'center' });
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
