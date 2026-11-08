"""Serves the repo on http://127.0.0.1:8765 with Cache-Control: no-store, so a normal refresh always loads the latest files.
Plain `python3 -m http.server` sends no cache header and browsers keep showing old code after an edit. Run: npm run dev"""
import functools
import http.server
import logging
import os

PORT = 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve() -> None:
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler) as server:
        logging.info('TokenFall on http://127.0.0.1:%d/ (no caching, Ctrl+C to stop)', PORT)
        server.serve_forever()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    serve()
