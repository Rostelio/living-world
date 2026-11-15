#!/usr/bin/env python3
"""Local dev server for Living World. Serves the game with caching disabled.

Usage: python3 serve.py [port]   then open http://localhost:8417
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8417
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    NoCacheHandler.extensions_map[".js"] = "text/javascript"
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler) as httpd:
        print(f"Living World running at http://localhost:{port}")
        httpd.serve_forever()
