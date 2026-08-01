#!/usr/bin/env python3
"""
serve.py - a tiny local HTTP server for the DASH test fixture.

Serves a directory (default: the "dash" subdirectory next to this script)
over plain HTTP, with:
  - HTTP Range request support (RFC 7233 "bytes=start-end", "bytes=start-",
    "bytes=-suffixLength"), returning 206 Partial Content with
    Content-Range/Content-Length/Accept-Ranges headers. This matters because
    the DASH fixture's SegmentBase addressing (see README.md) requires the
    client to issue byte-range GETs against the .webm files, and Python's
    stdlib http.server.SimpleHTTPRequestHandler does NOT implement Range
    support out of the box -- this class adds it.
  - Correct Content-Type for .mpd (application/dash+xml) and .webm
    (video/webm; Media3 doesn't care that this is audio-only content, but
    video/webm is the registered/correct MIME type for the WebM container
    regardless of which tracks it carries) files, which
    http.server.SimpleHTTPRequestHandler's default mimetypes table does not
    know about.

Uses only the Python 3 standard library (http.server, socketserver) -- no
pip installs, per the migration plan's environment constraints.

Usage:
    python serve.py [--port 8099] [--dir PATH]

Examples:
    python serve.py
    python serve.py --port 9000
    python serve.py --dir test-media/malformed --port 8100
"""

import argparse
import http.server
import os
import re
import socketserver
import sys

EXTRA_CONTENT_TYPES = {
    ".mpd": "application/dash+xml",
    ".webm": "video/webm",
    ".xml": "application/xml",
}

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with HTTP Range request support and a few
    extra Content-Type mappings for DASH fixture files."""

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTRA_CONTENT_TYPES:
            return EXTRA_CONTENT_TYPES[ext]
        return super().guess_type(path)

    def send_head(self):
        # Reimplementation of SimpleHTTPRequestHandler.send_head() with
        # Range support spliced in. Non-Range requests fall back to the
        # normal 200 full-file behavior.
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        if not os.path.exists(path) or not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None

        ctype = self.guess_type(path)
        file_size = os.path.getsize(path)

        range_header = self.headers.get("Range")
        if range_header is None:
            f = open(path, "rb")
            self.send_response(200)
            self.send_header("Content-type", ctype)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
            self.end_headers()
            return f

        match = RANGE_RE.fullmatch(range_header.strip())
        if not match:
            self.send_error(416, "Invalid Range header")
            return None

        start_str, end_str = match.groups()
        if start_str == "" and end_str == "":
            self.send_error(416, "Invalid Range header")
            return None

        if start_str == "":
            # suffix range: last N bytes
            suffix_len = int(end_str)
            start = max(file_size - suffix_len, 0)
            end = file_size - 1
        else:
            start = int(start_str)
            end = int(end_str) if end_str != "" else file_size - 1

        if start >= file_size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return None

        end = min(end, file_size - 1)
        length = end - start + 1

        f = open(path, "rb")
        f.seek(start)

        self.send_response(206)
        self.send_header("Content-type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()

        # Wrap so copyfile() only sends `length` bytes.
        return _LimitedReader(f, length)


class _LimitedReader:
    """File-like wrapper that stops reading after `length` bytes, so
    BaseHTTPRequestHandler's shutil.copyfileobj-based copyfile() only
    streams the requested range."""

    def __init__(self, f, length):
        self._f = f
        self._remaining = length

    def read(self, size=-1):
        if self._remaining <= 0:
            return b""
        if size < 0 or size > self._remaining:
            size = self._remaining
        data = self._f.read(size)
        self._remaining -= len(data)
        return data

    def close(self):
        self._f.close()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    parser = argparse.ArgumentParser(description="Serve the DASH test fixture over HTTP with Range support.")
    parser.add_argument("--port", type=int, default=8099, help="TCP port to listen on (default: 8099)")
    parser.add_argument(
        "--dir",
        default=None,
        help="Directory to serve (default: the 'dash' subdirectory next to this script)",
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    serve_dir = args.dir or os.path.join(script_dir, "dash")
    serve_dir = os.path.abspath(serve_dir)

    if not os.path.isdir(serve_dir):
        print(f"error: directory not found: {serve_dir}", file=sys.stderr)
        sys.exit(1)

    handler = lambda *a, **kw: RangeRequestHandler(*a, directory=serve_dir, **kw)

    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as httpd:
        print(f"Serving {serve_dir} at http://127.0.0.1:{args.port}/ (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping.")


if __name__ == "__main__":
    main()
