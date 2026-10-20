# Deploying DataSense alpha

The `_site/` directory is a complete static app. It has relative URLs and works
at `/` or a project subpath ending in `/`. Only this directory should be
published. Source, tests, research evidence and repository metadata stay out.

## Local or private server

Use Node.js 22+; the release was validated with 24.19.0:

```sh
node scripts/serve.mjs --root _site --port 8765
node scripts/serve.mjs --root _site --port 8765 --base-path /datasense/
```

The default address is `127.0.0.1`; binding to an external address requires both
an explicit HTTPS origin and a TLS certificate/key. The server verifies the staged file hashes
before listening, preloads those bytes, rejects unexpected Host headers, and
supports GET/HEAD only. It has no upload, write, directory listing or login API.
It adds CSP (including `frame-ancestors 'none'`), nosniff, no-referrer,
same-origin resource/opener policies, no-store and indexing restrictions.
Restart after changing a release. Hashes detect corruption, not malicious
replacement of both the files and their manifest: obtain the ZIP from a
trusted source and compare its externally supplied checksum.

## HTTPS behind an existing reverse proxy

Replace the example domain with a domain you control. Keep the Node process
bound to loopback:

```sh
node scripts/serve.mjs --root _site --port 8765 --origin https://stats.example.org
```

Example Caddyfile (requires separately installed/configured Caddy):

```caddyfile
stats.example.org {
    header Strict-Transport-Security "max-age=31536000"
    reverse_proxy 127.0.0.1:8765
}
```

Configure DNS, firewall, proxy service supervision and certificate renewal for
your host. Preserve the browser's Host header so it matches `--origin`.
For private pilot access, enforce authentication at the proxy or private
network before granting access. A private Git repository and `noindex` do not
restrict who can access a published site. Caddy deployment is a documented
recipe, not an executed deployment in the DS-14 evidence.

References: [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
and [automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Direct TLS

On a managed server with an existing certificate and protected private key:

```sh
node scripts/serve.mjs --root _site --host 0.0.0.0 --port 8443 \
  --origin https://stats.example.org:8443 --cert /secure/fullchain.pem --key /secure/key.pem
```

Use a service manager and renew/restart certificates. Never put private keys in
the runtime ZIP, repository or `_site`. Only TLS 1.2 or newer is accepted.
Direct TLS sets HSTS. The local TLS test explicitly trusts an ephemeral test
certificate without changing the operating-system trust store; it is not
evidence of a publicly trusted certificate.

## Static hosting / GitHub Pages

Upload the contents of `_site`, preserving its directory structure. Configure
equivalent security headers wherever the hosting service supports them; the
HTML includes the application's CSP but frame-ancestors needs a response header.
Test the actual response, not only a configuration file.

The existing manual GitHub Pages workflow is guarded by
`DATASENSE_PAGES_ENABLED=true` and the dedicated repository's main branch.
The owner authorized public visibility for this dedicated repository and a
Pages alpha preview on 2026-10-20. Set Pages source to GitHub Actions, enable
that variable, then manually run **Guarded alpha Pages staging** on `main`.
The workflow checks every deployed HTTPS file against the exact commit and
runs Chromium, Firefox and WebKit checks against the actual Pages URL.
Inspect all jobs before accepting a deployment. GitHub Pages does not apply
the Node server's custom response headers; actual headers are retained in
the public-origin evidence. There is no authentication gate on this preview.
[GitHub's plan requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
and site visibility are distinct from source visibility.

## Acceptance and rollback

Keep each release ZIP and checksum. Deploy to a new versioned directory, run the
checks below, then switch the proxy/service to it. Roll back by switching to the
previous validated directory and restarting its server; no database migration
is involved. Stop old processes after checking the replacement.

From the development checkout with locked QA dependencies installed:

```sh
python scripts/real_origin_smoke.py --browser chromium --site-root _site \
  --url https://stats.example.org/ --output evidence/deployment-chromium
```

Repeat with Firefox and WebKit and separate output directories. Check the exact
deployed manifest and response bytes against the release; verify real CSP,
security headers, all eight downloads, source SHA-256, keyboard navigation,
network/storage behavior and the intended access controls. Keep an acceptance
record with URL, version, commit and date. Do not claim public HTTPS deployment
from loopback checks or a prepared configuration.
