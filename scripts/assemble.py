#!/usr/bin/env python3
"""Writes the site's pages from the shared shell plus the sections in parts/.

The site is plain static HTML with no runtime templating, so the header and
footer would otherwise be copied by hand into every page and drift apart. This
puts them in one place: edit the shell here, run the script, and every page is
rewritten.

    python3 scripts/assemble.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / "parts"

NAV = [
    ("about.html", "OMIYAcappellaとは？"),
    ("gallery.html", "ギャラリー"),
    ("projects.html", "企画一覧"),
    ("index.html#x", "X（Twitter）"),
]

# Every absolute url the site emits — canonical tags, og:url, the sitemap and
# the structured data — is built from this. It MUST match the url the site is
# actually served from: a canonical pointing at a host that does not exist tells
# Google to index nothing. Change it here and re-run before deploying elsewhere.
SITE_URL = "https://omiya.acappella.workers.dev"

FONTS = (
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800'
    '&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap'
)


WRITTEN = []


def structured_data():
    """Tells Google in so many words what this is and where it happens.

    Only the home page carries it: it describes the organisation, not the page,
    and repeating it on every url would just claim five organisations.
    """
    data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": f"{SITE_URL}/#organization",
        "name": "OMIYAcappella",
        "alternateName": ["大宮アカペラプラットフォーム", "OMIYAcappella 大宮アカペラプラットフォーム"],
        "url": f"{SITE_URL}/",
        "logo": f"{SITE_URL}/assets/img/logo.jpg",
        "image": f"{SITE_URL}/assets/img/maihama-poster.jpg",
        "description": (
            "埼玉・大宮周辺の社会人アカペラコミュニティ。サークルのように固定バンドを組まず、"
            "一日 or 短期の企画バンドを自由につくれる、アカペラ経験者限定のプラットフォームです。"
        ),
        "sameAs": ["https://x.com/OMIYAacappella"],
        "knowsAbout": ["アカペラ", "ボーカルアンサンブル"],
        # No street address is claimed: the group books studios around 大宮
        # rather than holding premises of its own.
        "areaServed": [
            {"@type": "AdministrativeArea", "name": "埼玉県"},
            {"@type": "City", "name": "さいたま市大宮区"},
        ],
        "location": {
            "@type": "Place",
            "name": "大宮周辺",
            "address": {
                "@type": "PostalAddress",
                "addressRegion": "埼玉県",
                "addressLocality": "さいたま市",
                "addressCountry": "JP",
            },
        },
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "参加申し込み・お問い合わせ",
            "url": f"{SITE_URL}/contact.html",
            "availableLanguage": ["ja"],
        },
    }
    body = json.dumps(data, ensure_ascii=False, indent=2)
    return f'\n<script type="application/ld+json">\n{body}\n</script>\n'


def part(name):
    return (PARTS / f"{name}.html").read_text(encoding="utf-8").rstrip() + "\n"


def head(title, description, page, structured=""):
    """`page` marks which nav entry is the current one."""
    # Crawlers and the services that unfurl links do not resolve relative urls,
    # so these two are the exception to the site's relative-path rule.
    canonical = f"{SITE_URL}/" if page == "index.html" else f"{SITE_URL}/{page}"
    og_image = f"{SITE_URL}/assets/img/maihama-poster.jpg"
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#fcfaf5">

<link rel="canonical" href="{canonical}">

<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="OMIYAcappella 大宮アカペラプラットフォーム">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{og_image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@OMIYAacappella">

<link rel="icon" href="./assets/img/logo.jpg">
<link rel="apple-touch-icon" href="./assets/img/logo.jpg">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONTS}" rel="stylesheet">
<link rel="stylesheet" href="./assets/css/style.css">
{structured}</head>

<body>
"""


def loader():
    return """
<!-- Opening animation: the four logo circles converging -->
<div class="loader" id="loader" aria-hidden="true">
  <div class="circles">
    <span></span><span></span><span></span><span></span>
  </div>
</div>
"""


def header(page):
    stuck = "" if page == "index.html" else " is-stuck"
    home = "#top" if page == "index.html" else "./index.html"
    items = []
    for href, label in NAV:
        current = " is-current" if href == page else ""
        items.append(
            f'        <li><a class="nav__link{current}" href="./{href}">{label}</a></li>'
        )
    cta_current = " is-current" if page == "contact.html" else ""
    items.append(
        f'        <li><a class="btn nav__cta{cta_current}" href="./contact.html">'
        'お問い合わせ<span class="btn__arrow" aria-hidden="true">→</span></a></li>'
    )
    return f"""
<!-- ====================== HEADER ====================== -->
<header class="header{stuck}" id="header">
  <div class="header__inner">
    <a class="brand" href="{home}">
      <img class="brand__mark" src="./assets/img/logo.jpg" alt="">
      <span>OMIYAcappella</span>
    </a>

    <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="メニューを開く">
      <span></span><span></span><span></span>
    </button>

    <nav class="nav" id="nav" aria-label="メインナビゲーション">
      <ul class="nav__list">
{chr(10).join(items)}
      </ul>
    </nav>
  </div>
</header>
"""


def page_hero(eyebrow, title, lead, crumb):
    return f"""
  <section class="page-hero">
    <span class="deco deco--diamond deco--yellow" style="top:14%;right:7%" aria-hidden="true"></span>
    <span class="deco deco--diamond deco--blue" style="bottom:-8%;right:24%" aria-hidden="true"></span>

    <div class="container" style="position:relative;z-index:1">
      <p class="page-hero__en">{eyebrow}</p>
      <h1 class="page-hero__title">{title}</h1>
      <p class="sec-head__lead" style="margin-top:20px">{lead}</p>
      <p class="breadcrumb"><a href="./index.html">Home</a> ／ {crumb}</p>
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


def write(name, title, description, body, extra="", structured=""):
    html = (
        head(title, description, name, structured)
        + (loader() if name == "index.html" else "")
        + header(name)
        + "\n<main"
        + (' id="top"' if name == "index.html" else "")
        + ">\n"
        + body
        + "\n</main>\n"
        + extra
        + "\n"
        + part("footer")
        + '\n<p class="proto-flag">Prototype</p>\n\n'
        + '<script src="./assets/js/main.js"></script>\n'
        + "</body>\n</html>\n"
    )
    (ROOT / name).write_text(html, encoding="utf-8")
    WRITTEN.append(name)
    print(f"{name:16s} {len(html):>7} bytes")


def home_cards():
    entries = [
        ("about.html", "01", "About", "OMIYAcappellaとは？",
         "6つの決まりごと、参加までの流れ、募集要項、活動ルール。"),
        ("gallery.html", "02", "Gallery", "ギャラリー",
         "イベント出演時の演奏動画と、企画バンドの音源。"),
        ("projects.html", "03", "Projects", "企画一覧",
         "2022年からLINEグループで立ち上がった企画。"),
        ("contact.html", "04", "Contact", "お問い合わせ",
         "参加のご希望、ご質問、イベント出演のご相談はこちらから。"),
    ]
    cards = []
    for href, no, en, title, text in entries:
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


# --------------------------------------------------------------------- pages

write(
    "index.html",
    "OMIYAcappella｜大宮アカペラプラットフォーム",
    "「楽しく、いつでも、アカペラを、大宮で」。固定バンドを組まずに、一日 or 短期の企画バンドを自由につくれる、アカペラ経験者限定のプラットフォームです。",
    part("hero")
    + f"""
  <!-- ====================== MENU ====================== -->
  <section class="section">
    <div class="container">
      <header class="menu-head reveal">
        <span class="circles menu-head__circles" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </span>
        <h2 class="menu-head__title">MENU</h2>
        <span class="menu-head__rule" aria-hidden="true"></span>
      </header>

      <div class="portal">
{home_cards()}
      </div>
    </div>
  </section>
"""
    + part("x")
    + """
  <!-- ====================== 参加 ====================== -->
  <section class="section">
    <div class="container">
      <div class="join reveal">
        <h2 class="join__title">大宮周辺で、<br>一緒にアカペラしませんか。</h2>
        <p class="join__text">
          会費はありません。活動の強制もありません。
          歌いたいときに手を挙げる、それだけの場です。
        </p>
        <div class="join__actions">
          <a class="btn btn--accent btn--lg" href="./contact.html">大宮アカペラに参加する！<span class="btn__arrow" aria-hidden="true">→</span></a>
          <a class="btn btn--lg" href="./about.html">募集要項を見る</a>
        </div>
      </div>
    </div>
  </section>
"""
    + part("marquee"),
    structured=structured_data(),
)

write(
    "about.html",
    "OMIYAcappellaとは？｜OMIYAcappella",
    "バンドを固定せず、練習も強制せず、歌いたい人が歌いたいときに集まるための「場」。6つの決まりごと、参加までの流れ、募集要項をまとめています。",
    page_hero(
        "Concept &amp; Requirements",
        "OMIYAcappellaとは？",
        "OMIYAcappella は「サークル」ではありません。バンドを固定せず、練習も強制せず、"
        "歌いたい人が歌いたいときに集まるための<strong>「場」</strong>を提供する、大宮周辺のアカペラプラットフォームです。",
        "OMIYAcappellaとは？",
    )
    + unwrap(part("about")),
)

write(
    "gallery.html",
    "ギャラリー｜OMIYAcappella",
    "イベント出演時の演奏動画と、企画バンドの音源をまとめています。カードをクリックするとその場で再生できます。",
    page_hero(
        "Videos &amp; Recordings",
        "ギャラリー",
        "イベント出演時の演奏動画と、企画バンドの音源をまとめています。"
        "カードをクリックすると、このページのまま再生できます。",
        "ギャラリー",
    )
    + unwrap(part("gallery")),
    extra=part("lightbox"),
)

write(
    "projects.html",
    "企画一覧｜OMIYAcappella",
    "2022年4月から現在まで、LINEグループで実際に立ち上がった企画を新しい順に並べています。",
    page_hero(
        "Since 2022",
        "企画一覧",
        "2022年4月から現在まで、LINEグループで実際に立ち上がった企画を新しい順に並べています。"
        "歌いたい曲があれば、メンバーなら誰でもこの形で募集をかけられます。",
        "企画一覧",
    )
    + unwrap(part("projects")),
)

write(
    "contact.html",
    "お問い合わせ｜OMIYAcappella",
    "参加のご希望、ご質問、イベント出演のご相談はこちらから。送信内容は運営に届き、確認のうえ順次ご返信します。",
    page_hero(
        "Join us",
        "お問い合わせ",
        "参加のご希望、ご質問、イベント出演のご相談などはこちらから。"
        "送信内容は運営のメールアドレス宛に届き、確認のうえ順次ご返信します。",
        "お問い合わせ",
    )
    + unwrap(part("contact")),
)


# ------------------------------------------------------------------ crawling

def write_sitemap():
    """No <lastmod>: a build-time date would say every page changed whenever the
    script ran, which is worse than saying nothing."""
    urls = "\n".join(
        f"  <url><loc>{SITE_URL}/{'' if name == 'index.html' else name}</loc></url>"
        for name in WRITTEN + ["rules.html"]
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"{'sitemap.xml':16s} {len(xml):>7} bytes")


def write_robots():
    txt = (
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )
    (ROOT / "robots.txt").write_text(txt, encoding="utf-8")
    print(f"{'robots.txt':16s} {len(txt):>7} bytes")


write_sitemap()
write_robots()
