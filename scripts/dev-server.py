#!/usr/bin/env python3
"""Static preview server that never lets the browser cache a file.

python -m http.server sends Last-Modified, and browsers then hold on to CSS and
JS across reloads — which during development means editing a file and seeing the
old one. Everything here is served with no-store.

It also serves /about from about.html, the way Cloudflare's asset server does,
so that the extensionless links the site is built with resolve here too.

    python3 scripts/dev-server.py [port]
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and not path.endswith("/"):
            candidate = local + ".html"
            if os.path.isfile(candidate):
                return candidate
        return local

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the console readable; errors still surface through the response.
        if not str(args[1]).startswith("2"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    handler = partial(NoCacheHandler, directory=".")
    print(f"serving http://localhost:{port} (no-store)")
    ThreadingHTTPServer(("", port), handler).serve_forever()
