"""Run the existing strict browser suite against the shipped Node server."""
import json
import subprocess
import sys
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
output = root / "evidence/runtime-browser"
output.mkdir(parents=True, exist_ok=True)
with subprocess.Popen(
    ["node", "scripts/serve.mjs", "--port", "0", "--base-path", "/datasense/"],
    cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
) as server:
    try:
        ready = json.loads(server.stdout.readline())
        url = ready["url"]
        with urlopen(url, timeout=5) as response:
            headers = dict(response.headers.items())
        (output / "response-headers.json").write_text(json.dumps(headers, indent=2) + "\n")
        assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
        subprocess.run([
            sys.executable, "scripts/real_origin_smoke.py", "--browser", "chromium",
            "--site-root", "_site", "--url", url, "--output", str(output / "chromium")
        ], cwd=root, check=True, timeout=600)
    finally:
        server.terminate()
        server.wait(timeout=10)
