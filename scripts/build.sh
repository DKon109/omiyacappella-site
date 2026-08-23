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
cp -R assets dist/
cp scripts/_headers dist/_headers

# The contact address sits in main.js so the page itself never shows it — but a
# published build would still hand it to anyone who opens the JavaScript. It is
# blanked here unless an endpoint is passed in, in which case the form validates
# and reports that nothing was sent.
#
#   FORM_ENDPOINT='https://formsubmit.co/ajax/el/xxxxxxx' bash scripts/build.sh
#
# Use FormSubmit's alias URL, issued after activation — it carries no address.
ENDPOINT="${FORM_ENDPOINT:-}"
sed "s|var FORM_ENDPOINT = '[^']*';|var FORM_ENDPOINT = '${ENDPOINT}';|" \
  dist/assets/js/main.js > dist/assets/js/main.js.tmp
mv dist/assets/js/main.js.tmp dist/assets/js/main.js

if [ -z "$ENDPOINT" ]; then
  echo "  form:  送信先なし（アドレスはビルドから除去）"
else
  echo "  form:  ${ENDPOINT}"
fi

echo "dist/ built:"
find dist -type f | wc -l | xargs echo "  files:"
du -sh dist | awk '{print "  size:  " $1}'
