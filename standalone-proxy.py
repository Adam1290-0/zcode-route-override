#!/usr/bin/env python3
"""Local reverse proxy: rewrites outgoing requests to look like Claude Code CLI.

ZCode -> http://127.0.0.1:8899/v1/...  --(add Claude Code headers)-->  https://agentrouter.org/v1/...
Outbound connections go through the local system proxy (VPN) because
agentrouter.org is unreachable directly (DNS poisoning + IP reset).

Heads are rebuilt from a whitelist: only auth/content headers from the client
are kept, everything else (x-client-language, x-device-mid, ...) is dropped,
then the Claude Code identity headers are added.
"""

import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import os, sys
LISTEN_PORT = int(os.environ.get("PROXY_PORT", "8899"))
UPSTREAM = (sys.argv[1] if len(sys.argv) > 1 else "").rstrip("/")
if not UPSTREAM:
    print("usage: python standalone-proxy.py <upstream-url>   (e.g. https://api.example.com)")
    sys.exit(1)
# VPN/system proxy: set PROXY_URL env, or empty string to connect directly
OUTBOUND_PROXY = os.environ.get("PROXY_URL", "http://127.0.0.1:12334")

# Identity headers verified against agentrouter (real key, 200 OK)
CLAUDE_HEADERS = {
    "user-agent": "claude-cli/2.1.227 (external, cli)",
    "x-app": "cli",
    "x-stainless-lang": "js",
    "x-stainless-runtime": "node",
    "x-stainless-os": "Windows",
    "x-stainless-arch": "x64",
    "x-stainless-package-version": "0.70.0",
    "x-stainless-runtime-version": "v22.0.0",
    "x-stainless-helper-method": "stream",
    "x-stainless-retry-count": "0",
    "x-stainless-timeout": "600",
    "anthropic-dangerous-direct-browser-access": "true",
}
# Client headers forwarded as-is (auth + protocol essentials)
PASSTHROUGH = {"content-type", "x-api-key", "authorization", "anthropic-version", "accept"}

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler(
        {"http": OUTBOUND_PROXY, "https": OUTBOUND_PROXY} if OUTBOUND_PROXY else {}
    )
)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _relay(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(UPSTREAM + self.path, data=body, method=self.command)
        for k, v in self.headers.items():
            if k.lower() in PASSTHROUGH:
                req.add_header(k, v)
        for k, v in CLAUDE_HEADERS.items():
            req.add_header(k, v)
        if not req.has_header("anthropic-version"):
            req.add_header("anthropic-version", "2023-06-01")

        try:
            resp = opener.open(req, timeout=300)
        except urllib.error.HTTPError as e:
            resp = e
        except Exception as e:
            self.send_error(502, f"upstream error: {e}")
            return

        self.send_response(resp.status if hasattr(resp, "status") else resp.code)
        for k, v in resp.headers.items():
            if k.lower() in ("transfer-encoding", "connection", "content-encoding", "content-length"):
                continue
            self.send_header(k, v)
        self.send_header("connection", "close")
        self.end_headers()
        try:
            while True:
                chunk = resp.readline()
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except Exception:
            pass
        finally:
            resp.close()

    do_GET = _relay
    do_POST = _relay

    def log_message(self, fmt, *args):
        sys.stdout.write("%s %s\n" % (self.log_date_time_string(), fmt % args))
        sys.stdout.flush()


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", LISTEN_PORT), Handler)
    print(f"standalone-proxy on 127.0.0.1:{LISTEN_PORT} -> {UPSTREAM} (via {OUTBOUND_PROXY or 'direct'})")
    srv.serve_forever()
