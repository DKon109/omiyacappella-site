#!/usr/bin/env bash
# Assembles the site into dist/.
#
# Only the files below are published. The repository also holds the README,
# the LINE worker and these scripts — all of which would otherwise be served
# at their own URLs by a static host.
set -euo pipefail

rm -rf dist
mkdir -p dist

cp index.html about.html gallery.html projects.html contact.html rules.html dist/
cp robots.txt sitemap.xml dist/
cp -R en dist/en
cp -R assets dist/
cp scripts/_headers dist/_headers

# The browser posts straight to the relay, so these end up in the published
# JavaScript by necessity — but not in the repository. Set them as *build*
# variables in the dashboard (the Build section of Variables and Secrets, which
# is the one the build reads; runtime secrets are a different store).
#
#   FORM_ENDPOINT   the relay's alias url — an alias, never the bare address,
#                   so no mailbox is exposed to scrapers
#   FORM_CC         optional, a second organiser copied on every enquiry
#
# Left unset, the form validates and reports that no destination is configured
# rather than pretending to send.
ENDPOINT="${FORM_ENDPOINT:-}"
CC="${FORM_CC:-}"
sed -e "s|var FORM_ENDPOINT = '[^']*';|var FORM_ENDPOINT = '${ENDPOINT}';|" \
    -e "s|var FORM_CC = '[^']*';|var FORM_CC = '${CC}';|" \
  dist/assets/js/main.js > dist/assets/js/main.js.tmp
mv dist/assets/js/main.js.tmp dist/assets/js/main.js

echo "  form:  ${ENDPOINT:-(unset — the form will not send)}"
echo "  cc:    ${CC:-(none)}"

echo "dist/ built:"
find dist -type f | wc -l | xargs echo "  files:"
du -sh dist | awk '{print "  size:  " $1}'
