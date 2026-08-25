#!/usr/bin/env python3
"""Writes the site's pages from the shared shell plus the sections in parts/.

The site is plain static HTML with no runtime templating, so the header and
footer would otherwise be copied by hand into every page and drift apart. This
puts them in one place: edit the shell here, run the script, and every page is
rewritten.

    python3 scripts/assemble.py

Japanese is the default and lands at the site root. English is generated from
parts/en/ into en/, and the two are linked to each other by the header's
language switch and by hreflang tags.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / "parts"

# Every absolute url the site emits — canonical tags, og:url, hreflang, the
# sitemap and the structured data — is built from this. It MUST match the url
# the site is actually served from: a canonical pointing at a host that does not
# exist tells Google to index nothing. Change it here and re-run before
# deploying anywhere else.
SITE_URL = "https://omiyacappella.com"

# Cloudflare Web Analytics. The token is issued by the dashboard once the site
# is live, so this stays empty until then and no beacon is emitted. It counts
# page views without cookies or local storage, which is why there is no consent
# banner anywhere on this site — keep it that way.
ANALYTICS_TOKEN = ""

FONTS = (
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800'
    '&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap'
)

PAGES = ["index.html", "about.html", "gallery.html", "projects.html",
         "contact.html", "rules.html"]

# --------------------------------------------------------------------- locales

JA = {
    "lang": "ja",
    "out": "",            # japanese is the default, so it sits at the root
    "up": "./",           # how this locale reaches assets/
    "label": "日本語",
    "nav": [
        ("about.html", "OMIYAcappellaとは？"),
        ("gallery.html", "ギャラリー"),
        ("projects.html", "企画一覧"),
        ("index.html#x", "X（Twitter）"),
    ],
    "cta": "お問い合わせ",
    "menu_title": "MENU",
    "cards": [
        ("about.html", "01", "About", "OMIYAcappellaとは？",
         "6つの決まりごと、参加までの流れ、募集要項、活動ルール。"),
        ("gallery.html", "02", "Gallery", "ギャラリー",
         "イベント出演時の演奏動画と、企画バンドの音源。"),
        ("projects.html", "03", "Projects", "企画一覧",
         "2022年からLINEグループで立ち上がった企画。"),
        ("contact.html", "04", "Contact", "お問い合わせ",
         "参加のご希望、ご質問、イベント出演のご相談はこちらから。"),
    ],
    "join_title": "大宮周辺で、<br>一緒にアカペラしませんか。",
    "join_text": ("会費はありません。活動の強制もありません。"
                  "歌いたいときに手を挙げる、それだけの場です。"),
    "join_cta": "大宮アカペラに参加する！",
    "join_alt": "募集要項を見る",
    "crumb_home": "Home",
    "crumb_sep": "／",
    "meta": {
        "index.html": (
            "OMIYAcappella｜埼玉・大宮の社会人アカペラサークル",
            "埼玉・大宮周辺の社会人アカペラコミュニティ。サークルのように固定バンドを組まず、一日 or 短期の企画バンドを自由につくれる、アカペラ経験者限定のプラットフォームです。会費なし、練習の強制もありません。",
        ),
        "about.html": (
            "OMIYAcappellaとは？｜埼玉・大宮の社会人アカペラ",
            "バンドを固定せず、練習も強制せず、歌いたい人が歌いたいときに集まるための「場」。埼玉・大宮周辺で活動する社会人アカペラの、6つの決まりごと、参加までの流れ、募集要項をまとめています。",
        ),
        "gallery.html": (
            "演奏動画・音源｜埼玉・大宮の社会人アカペラ",
            "埼玉・大宮周辺で活動する社会人アカペラ OMIYAcappella の演奏動画と、企画バンドの音源。イベント出演時の様子を、このページのまま再生できます。",
        ),
        "projects.html": (
            "企画一覧｜埼玉・大宮の社会人アカペラ",
            "2022年4月から現在まで、実際に立ち上がった企画を新しい順に。埼玉・大宮周辺の社会人アカペラで、どんな曲にどう人が集まってきたかがわかります。",
        ),
        "contact.html": (
            "参加申し込み・お問い合わせ｜埼玉・大宮の社会人アカペラ",
            "埼玉・大宮周辺の社会人アカペラ OMIYAcappella への参加申し込み・お問い合わせ。ご質問やイベント出演のご相談もこちらから。順次ご返信します。",
        ),
        "rules.html": (
            "活動ルール｜埼玉・大宮の社会人アカペラ",
            "埼玉・大宮周辺の社会人アカペラ OMIYAcappella の活動ルール。企画バンドの立て方、練習場所、キャンセル時の連絡、練習中の心がけなど、気持ちよく集まるための約束事をまとめています。",
        ),
    },
    "hero": {
        "about.html": (
            "Concept &amp; Requirements", "OMIYAcappellaとは？",
            "OMIYAcappella は「サークル」ではありません。バンドを固定せず、練習も強制せず、"
            "歌いたい人が歌いたいときに集まるための<strong>「場」</strong>を提供する、大宮周辺のアカペラプラットフォームです。",
            "OMIYAcappellaとは？"),
        "gallery.html": (
            "Videos &amp; Recordings", "ギャラリー",
            "イベント出演時の演奏動画と、企画バンドの音源をまとめています。"
            "カードをクリックすると、このページのまま再生できます。",
            "ギャラリー"),
        "projects.html": (
            "Since 2022", "企画一覧",
            "2022年4月から現在まで、LINEグループで実際に立ち上がった企画を新しい順に並べています。"
            "歌いたい曲があれば、メンバーなら誰でもこの形で募集をかけられます。",
            "企画一覧"),
        "contact.html": (
            "Join us", "お問い合わせ",
            "参加のご希望、ご質問、イベント出演のご相談などはこちらから。"
            "送信内容は運営のメールアドレス宛に届き、確認のうえ順次ご返信します。",
            "お問い合わせ"),
        "rules.html": (
            "Rules", "活動ルール",
            "ルールは、縛るためではなく、全員が気持ちよく歌うためのものです。"
            "コンセプトはあくまで「楽しくアカペラを」。その前提を守るための最低限の約束事をまとめています。",
            "活動ルール"),
    },
}

EN = {
    "lang": "en",
    "out": "en",
    "up": "../",
    "label": "English",
    "nav": [
        ("about.html", "About"),
        ("gallery.html", "Gallery"),
        ("projects.html", "Projects"),
        ("index.html#x", "X (Twitter)"),
    ],
    "cta": "Contact",
    "menu_title": "MENU",
    "cards": [
        ("about.html", "01", "About", "What is OMIYAcappella?",
         "Our six ground rules, how to join, and who we are looking for."),
        ("gallery.html", "02", "Gallery", "Gallery",
         "Live footage from our appearances, and recordings by project bands."),
        ("projects.html", "03", "Projects", "Projects",
         "Every band that has come together since 2022."),
        ("contact.html", "04", "Contact", "Contact",
         "To join, to ask a question, or to invite us to your event."),
    ],
    "join_title": "Come and sing with us<br>around Omiya.",
    "join_text": ("There are no membership fees, and nothing you are obliged to "
                  "attend. You raise your hand when you feel like singing — that is all."),
    "join_cta": "Join OMIYAcappella",
    "join_alt": "See who we are looking for",
    "crumb_home": "Home",
    "crumb_sep": "/",
    "meta": {
        "index.html": (
            "OMIYAcappella | A cappella in Omiya, Saitama",
            "An a cappella community around Omiya in Saitama, Japan. Rather than fixed bands, we form one-day and short-term project bands whenever someone wants to sing. Open to experienced singers; no fees, no compulsory rehearsals.",
        ),
        "about.html": (
            "What is OMIYAcappella? | A cappella in Omiya, Saitama",
            "Not a club, but a place to gather: no fixed bands, no compulsory practice, just people who want to sing. Our six ground rules, how to join, and who we are looking for.",
        ),
        "gallery.html": (
            "Videos & recordings | A cappella in Omiya, Saitama",
            "Live footage from OMIYAcappella's appearances and recordings by our project bands, playable right here on the page.",
        ),
        "projects.html": (
            "Projects | A cappella in Omiya, Saitama",
            "Every band that has actually come together since April 2022, newest first — what people wanted to sing, and who showed up for it.",
        ),
        "contact.html": (
            "Contact & join | A cappella in Omiya, Saitama",
            "Get in touch with OMIYAcappella, an a cappella community around Omiya in Saitama: to join us, to ask a question, or to invite us to your event.",
        ),
        "rules.html": (
            "House rules | A cappella in Omiya, Saitama",
            "How OMIYAcappella works in practice: starting a project band, booking rooms, cancelling, and the courtesies that keep rehearsals pleasant.",
        ),
    },
    "hero": {
        "about.html": (
            "Concept &amp; Requirements", "What is OMIYAcappella?",
            "OMIYAcappella is not a club. There are no fixed bands and no compulsory practice — "
            "it is a <strong>place to gather</strong> for anyone around Omiya who feels like singing, "
            "whenever they feel like it.",
            "About"),
        "gallery.html": (
            "Videos &amp; Recordings", "Gallery",
            "Live footage from our appearances, together with recordings made by project bands. "
            "Select a card and it plays right here, without leaving the page.",
            "Gallery"),
        "projects.html": (
            "Since 2022", "Projects",
            "Every band that has actually come together since April 2022, newest first. "
            "Any member with a song in mind can put out a call exactly like these.",
            "Projects"),
        "contact.html": (
            "Join us", "Contact",
            "To join us, to ask a question, or to invite us to your event. "
            "Your message reaches the organisers by email, and we reply in turn.",
            "Contact"),
        "rules.html": (
            "Rules", "House rules",
            "These exist to keep everyone comfortable, not to tie anyone down. "
            "The idea is simply to enjoy singing — this is the minimum that protects it.",
            "House rules"),
    },
}

LOCALES = [JA, EN]
WRITTEN = []


def url_for(loc, page):
    """The absolute url a page is published at."""
    tail = "" if page == "index.html" else page
    prefix = f"{SITE_URL}/{loc['out']}/" if loc["out"] else f"{SITE_URL}/"
    return prefix + tail


def path_for(loc, page):
    return ROOT / loc["out"] / page if loc["out"] else ROOT / page


def part(loc, name):
    """Reads a section, and re-points its asset paths at the locale's depth.

    The parts are written with root-relative-looking './assets/…' paths because
    the Japanese pages sit at the root. English pages live one directory down,
    so every such path has to climb back out.
    """
    src = PARTS / loc["out"] / f"{name}.html" if loc["out"] else PARTS / f"{name}.html"
    if not src.exists():
        raise SystemExit(f"missing translation: {src.relative_to(ROOT)}")
    html = src.read_text(encoding="utf-8").rstrip() + "\n"
    return html.replace('"./assets/', f'"{loc["up"]}assets/')


def head(loc, title, description, page, structured=""):
    canonical = url_for(loc, page)
    up = loc["up"]
    alternates = "\n".join(
        f'<link rel="alternate" hreflang="{other["lang"]}" href="{url_for(other, page)}">'
        for other in LOCALES
    )
    return f"""<!DOCTYPE html>
<html lang="{loc['lang']}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#fcfaf5">

<link rel="canonical" href="{canonical}">
{alternates}
<link rel="alternate" hreflang="x-default" href="{url_for(JA, page)}">

<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="OMIYAcappella 大宮アカペラプラットフォーム">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{SITE_URL}/assets/img/maihama-poster.jpg">
<meta property="og:locale" content="{'ja_JP' if loc['lang'] == 'ja' else 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@OMIYAacappella">

<link rel="icon" href="{up}assets/img/logo.jpg">
<link rel="apple-touch-icon" href="{up}assets/img/logo.jpg">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONTS}" rel="stylesheet">
<link rel="stylesheet" href="{up}assets/css/style.css">
{structured}</head>

<body>
"""


def analytics():
    if not ANALYTICS_TOKEN:
        return ""
    return (
        '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" '
        f"data-cf-beacon='{{\"token\": \"{ANALYTICS_TOKEN}\"}}'></script>\n"
    )


def loader():
    return """
<!-- Opening animation: the four logo circles converging -->
<div class="loader" id="loader" aria-hidden="true">
  <div class="circles">
    <span></span><span></span><span></span><span></span>
  </div>
</div>
"""


def lang_switch(loc, page):
    """Both languages are always shown, so the reader can see that the other one
    exists before deciding to leave the page they are on."""
    opts = []
    for other in LOCALES:
        current = other["lang"] == loc["lang"]
        # Within a locale the pages are siblings; across locales they are not.
        if current:
            href = "./" + ("index.html" if page == "index.html" else page)
        elif other["out"]:
            href = f"./{other['out']}/{page}"
        else:
            href = f"../{page}"
        short = "JA" if other["lang"] == "ja" else "EN"
        cls = " is-current" if current else ""
        aria = ' aria-current="true"' if current else ""
        opts.append(
            f'<a class="lang__opt{cls}" href="{href}" hreflang="{other["lang"]}" '
            f'lang="{other["lang"]}"{aria}><span class="u-sr">{other["label"]}</span>'
            f'<span aria-hidden="true">{short}</span></a>'
        )
    inner = '<span class="lang__sep" aria-hidden="true"></span>'.join(opts)
    return (
        '        <li class="nav__lang"><span class="lang" role="group" '
        f'aria-label="Language">{inner}</span></li>'
    )


def header(loc, page):
    stuck = "" if page == "index.html" else " is-stuck"
    home = "#top" if page == "index.html" else "./index.html"
    items = []
    for href, label in loc["nav"]:
        current = " is-current" if href == page else ""
        items.append(
            f'        <li><a class="nav__link{current}" href="./{href}">{label}</a></li>'
        )
    cta_current = " is-current" if page == "contact.html" else ""
    items.append(
        f'        <li><a class="btn nav__cta{cta_current}" href="./contact.html">'
        f'{loc["cta"]}<span class="btn__arrow" aria-hidden="true">→</span></a></li>'
    )
    items.append(lang_switch(loc, page))
    toggle_label = "メニューを開く" if loc["lang"] == "ja" else "Open menu"
    nav_label = "メインナビゲーション" if loc["lang"] == "ja" else "Main navigation"
    return f"""
<!-- ====================== HEADER ====================== -->
<header class="header{stuck}" id="header">
  <div class="header__inner">
    <a class="brand" href="{home}">
      <img class="brand__mark" src="{loc['up']}assets/img/logo.jpg" alt="">
      <span>OMIYAcappella</span>
    </a>

    <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="{toggle_label}">
      <span></span><span></span><span></span>
    </button>

    <nav class="nav" id="nav" aria-label="{nav_label}">
      <ul class="nav__list">
{chr(10).join(items)}
      </ul>
    </nav>
  </div>
</header>
"""


def page_hero(loc, page):
    eyebrow, title, lead, crumb = loc["hero"][page]
    return f"""
  <section class="page-hero">
    <span class="deco deco--diamond deco--yellow" style="top:14%;right:7%" aria-hidden="true"></span>
    <span class="deco deco--diamond deco--blue" style="bottom:-8%;right:24%" aria-hidden="true"></span>

    <div class="container" style="position:relative;z-index:1">
      <p class="page-hero__en">{eyebrow}</p>
      <h1 class="page-hero__title">{title}</h1>
      <p class="sec-head__lead" style="margin-top:20px">{lead}</p>
      <p class="breadcrumb"><a href="./index.html">{loc['crumb_home']}</a> {loc['crumb_sep']} {crumb}</p>
    </div>
  </section>
"""


def strip_section_head(html):
    """Sub-pages carry the title in their page hero, so the in-section
    heading block would repeat it."""
    return re.sub(
        r'      <header class="sec-head reveal">.*?</header>\n\n',
        "",
        html,
        count=1,
        flags=re.S,
    )


def unwrap(html):
    """Turns a <section class="section" …> block into bare page content."""
    html = strip_section_head(html)
    html = re.sub(r'\n?  <!-- =+ .*? =+\n(?:.*?-->\n)?', "", html, count=1, flags=re.S)
    html = re.sub(r'^\s*<section class="section[^"]*" id="[^"]+">\n', "", html)
    html = re.sub(r'\s*<span class="ghost-num"[^>]*>.*?</span>\n', "", html, flags=re.S)
    html = re.sub(r"</section>\s*$", "", html.rstrip()) + "\n"
    return '  <section class="section">\n' + html + "  </section>\n"


def structured_data(loc):
    """Tells Google in so many words what this is and where it happens.

    Only the home pages carry it, and both point at the same @id: it describes
    one organisation described in two languages, not two organisations.
    """
    ja = loc["lang"] == "ja"
    data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": f"{SITE_URL}/#organization",
        "name": "OMIYAcappella",
        "alternateName": ["大宮アカペラプラットフォーム", "Omiya Acappella Platform"],
        "url": url_for(loc, "index.html"),
        "logo": f"{SITE_URL}/assets/img/logo.jpg",
        "image": f"{SITE_URL}/assets/img/maihama-poster.jpg",
        "description": (
            "埼玉・大宮周辺の社会人アカペラコミュニティ。サークルのように固定バンドを組まず、"
            "一日 or 短期の企画バンドを自由につくれる、アカペラ経験者限定のプラットフォームです。"
        ) if ja else (
            "An a cappella community around Omiya in Saitama, Japan. Rather than fixed "
            "bands, members form one-day and short-term project bands whenever they want to sing."
        ),
        "inLanguage": ["ja", "en"],
        "sameAs": ["https://x.com/OMIYAacappella"],
        "knowsAbout": ["アカペラ", "a cappella", "vocal ensemble"],
        # No street address is claimed: the group books studios around 大宮
        # rather than holding premises of its own.
        "areaServed": [
            {"@type": "AdministrativeArea", "name": "埼玉県" if ja else "Saitama Prefecture"},
            {"@type": "City", "name": "さいたま市大宮区" if ja else "Omiya, Saitama"},
        ],
        "location": {
            "@type": "Place",
            "name": "大宮周辺" if ja else "Around Omiya",
            "address": {
                "@type": "PostalAddress",
                "addressRegion": "埼玉県" if ja else "Saitama",
                "addressLocality": "さいたま市" if ja else "Saitama",
                "addressCountry": "JP",
            },
        },
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "参加申し込み・お問い合わせ" if ja else "membership enquiries",
            "url": url_for(loc, "contact.html"),
            "availableLanguage": ["ja", "en"],
        },
    }
    body = json.dumps(data, ensure_ascii=False, indent=2)
    return f'\n<script type="application/ld+json">\n{body}\n</script>\n'


def write(loc, page, body, extra="", structured=""):
    title, description = loc["meta"][page]
    html = (
        head(loc, title, description, page, structured)
        + (loader() if page == "index.html" else "")
        + header(loc, page)
        + "\n<main"
        + (' id="top"' if page == "index.html" else "")
        + ">\n"
        + body
        + "\n</main>\n"
        + extra
        + "\n"
        + part(loc, "footer")
        + '\n<p class="proto-flag">Prototype</p>\n\n'
        + f'<script src="{loc["up"]}assets/js/main.js"></script>\n'
        + analytics()
        + "</body>\n</html>\n"
    )
    out = path_for(loc, page)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    WRITTEN.append((loc, page))
    shown = f"{loc['out']}/{page}" if loc["out"] else page
    print(f"{shown:20s} {len(html):>7} bytes")


def home_cards(loc):
    cards = []
    for href, no, en, title, text in loc["cards"]:
        cards.append(f"""        <a class="portal__card reveal" href="./{href}">
          <span class="portal__ghost" aria-hidden="true">{no}</span>
          <p class="portal__en">{en}</p>
          <h3 class="portal__title">{title}</h3>
          <p class="portal__text">{text}</p>
          <span class="portal__go">
            <span class="portal__rule" aria-hidden="true"></span>
            <span class="portal__arrow" aria-hidden="true">→</span>
          </span>
        </a>""")
    return "\n".join(cards)


def build(loc):
    write(
        loc, "index.html",
        part(loc, "hero")
        + f"""
  <!-- ====================== MENU ====================== -->
  <section class="section">
    <div class="container">
      <header class="menu-head reveal">
        <span class="circles menu-head__circles" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </span>
        <h2 class="menu-head__title">{loc['menu_title']}</h2>
        <span class="menu-head__rule" aria-hidden="true"></span>
      </header>

      <div class="portal">
{home_cards(loc)}
      </div>
    </div>
  </section>
"""
        + part(loc, "x")
        + f"""
  <!-- ====================== 参加 ====================== -->
  <section class="section">
    <div class="container">
      <div class="join reveal">
        <h2 class="join__title">{loc['join_title']}</h2>
        <p class="join__text">
          {loc['join_text']}
        </p>
        <div class="join__actions">
          <a class="btn btn--accent btn--lg" href="./contact.html">{loc['join_cta']}<span class="btn__arrow" aria-hidden="true">→</span></a>
          <a class="btn btn--lg" href="./about.html">{loc['join_alt']}</a>
        </div>
      </div>
    </div>
  </section>
"""
        + part(loc, "marquee"),
        structured=structured_data(loc),
    )

    write(loc, "about.html", page_hero(loc, "about.html") + unwrap(part(loc, "about")))
    write(loc, "gallery.html", page_hero(loc, "gallery.html") + unwrap(part(loc, "gallery")),
          extra=part(loc, "lightbox"))
    write(loc, "projects.html", page_hero(loc, "projects.html") + unwrap(part(loc, "projects")))
    write(loc, "contact.html", page_hero(loc, "contact.html") + unwrap(part(loc, "contact")))
    # The rules part is already a plain section, so it needs no unwrapping.
    write(loc, "rules.html", page_hero(loc, "rules.html") + part(loc, "rules"))


for locale in LOCALES:
    build(locale)


# ------------------------------------------------------------------ crawling

def write_sitemap():
    """No <lastmod>: a build-time date would say every page changed whenever the
    script ran, which is worse than saying nothing."""
    urls = "\n".join(
        f"  <url><loc>{url_for(loc, page)}</loc></url>" for loc, page in WRITTEN
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"{'sitemap.xml':20s} {len(xml):>7} bytes")


def write_robots():
    txt = (
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )
    (ROOT / "robots.txt").write_text(txt, encoding="utf-8")
    print(f"{'robots.txt':20s} {len(txt):>7} bytes")


write_sitemap()
write_robots()
