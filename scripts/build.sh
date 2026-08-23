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

# Published builds post to the Pages Function in functions/api/contact.js,
# which holds the destination address in a Cloudflare secret. Override only to
# point the form somewhere else entirely.
ENDPOINT="${FORM_ENDPOINT:-/api/contact}"
sed "s|var FORM_ENDPOINT = '[^']*';|var FORM_ENDPOINT = '${ENDPOINT}';|" \
  dist/assets/js/main.js > dist/assets/js/main.js.tmp
mv dist/assets/js/main.js.tmp dist/assets/js/main.js

echo "  form:  ${ENDPOINT}"

echo "dist/ built:"
find dist -type f | wc -l | xargs echo "  files:"
du -sh dist | awk '{print "  size:  " $1}'
