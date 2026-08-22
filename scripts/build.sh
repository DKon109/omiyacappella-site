#!/usr/bin/env bash
# Assembles the site into dist/.
#
# Only the files below are published. The repository also holds the README,
# the LINE worker and these scripts — all of which would otherwise be served
# at their own URLs by a static host.
set -euo pipefail

rm -rf dist
mkdir -p dist

cp index.html rules.html dist/
cp -R assets dist/
cp scripts/_headers dist/_headers

echo "dist/ built:"
find dist -type f | wc -l | xargs echo "  files:"
du -sh dist | awk '{print "  size:  " $1}'
