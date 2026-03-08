#!/usr/bin/env python3
"""Simple HTTP server with CORS support for local development."""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver

class CORSHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    PORT = 8080
    with socketserver.TCPServer(("", PORT), CORSHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        httpd.serve_forever()
