#!/usr/bin/env python3
"""Serveur de développement pour ctrl.app.

`python3 -m http.server` laisse le navigateur mettre les modules en cache, ce
qui fait qu'une modification du code peut passer inaperçue au rechargement.
Ce serveur ajoute les en-têtes qui l'interdisent, et sert le bon type MIME
pour le manifeste.
"""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Une ligne par requête suffit ; on tait les 200 sur les assets.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"ctrl.app → http://localhost:{PORT}")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
