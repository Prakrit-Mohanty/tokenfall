"""Serves the repo on http://127.0.0.1:8765 with Cache-Control: no-store, so a normal refresh always loads the latest files.
Plain `python3 -m http.server` sends no cache header and browsers keep showing old code after an edit. Run: npm run dev
Each start also stamps index.html with a new server start id; js/fresh-start.js sees the change and starts the game over once."""
import functools
import http.server
import logging
import os
import re
import secrets
from urllib.parse import urlsplit

PORT = 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_PAGES = ('/', '/index.html')
HEAD_TAG = re.compile(r'<head\b[^>]*>', re.IGNORECASE)


def new_boot_id() -> str:
    return secrets.token_hex(8)


def is_game_page(path: str) -> bool:
    return urlsplit(path).path in GAME_PAGES


def with_boot(html: str, boot: str) -> str:
    return HEAD_TAG.sub(lambda m: f'{m.group(0)}<meta name="tokenfall-server-boot" content="{boot}">', html, count=1)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, boot: str, **kwargs) -> None:
        self.boot = boot
        super().__init__(*args, **kwargs)

    def end_headers(self) -> None:
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self) -> None:
        if not is_game_page(self.path):
            super().do_GET()
            return

        with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as f:
            body = with_boot(f.read(), self.boot).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class DevServer(http.server.ThreadingHTTPServer):
    # the page loads ~100 files at once; Python's default queue of 5 makes the OS reset the rest, so scripts go missing at random
    request_queue_size = 256
    daemon_threads = True


def serve() -> None:
    boot = new_boot_id()
    handler = functools.partial(NoCacheHandler, directory=ROOT, boot=boot)
    with DevServer(('127.0.0.1', PORT), handler) as server:
        logging.info('TokenFall on http://127.0.0.1:%d/ (no caching, fresh game each start: %s, Ctrl+C to stop)', PORT, boot)
        server.serve_forever()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    serve()
