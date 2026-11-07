# Sao Mai Photo Gallery v1.5 — security update

## Important deployment steps
1. Upload ALL updated files to GitHub (including `functions/api/[[path]].js`, `public/app.js`, `public/index.html`, `sql/upgrade-v1.5.sql`).
2. Run `sql/upgrade-v1.5.sql` in the existing D1 database **once**. Preserve existing `albums`, `photos`, and `storage_quota` tables.
3. In Cloudflare Pages > Settings > Variables and secrets, configure BOTH `ADMIN_PASSWORD` (long random password) and `SESSION_SECRET` (independent random secret, at least 32 bytes). Set as Secrets in Production and redeploy.
4. Bind D1 as `DB`. Bind R2 as `PHOTOS` only after billing is understood and enabled. The gallery list can work before R2; image upload cannot.
5. Configure Cloudflare WAF rate limiting for `/api/login` and `/api/album-access`, plus protections on `/api/photo`, and alerts for R2 usage. Rate limiting in D1 is only an additional defense; it can be evaded across IPs and can consume D1 operations.
6. Test login, incorrect passwords, private albums, uploading, deleting, and quota behavior with a tiny test bucket before production.

## Limitations and important warnings
- This release does NOT enforce a hard Cloudflare billing limit. R2 usage, D1/Workers requests and other resources may incur costs beyond free allowances.
- The 8 GB quota is application-level only. Direct writes to R2 bypass it.
- Existing private albums created by earlier versions used unsalted SHA-256 password hashes. **Recreate those private albums with new passwords** before use; the v1.5 HMAC verification intentionally does not accept the legacy hashes. Do not delete albums containing real photos without first exporting them.
- Private album access is granted by a one-hour cookie; it is not per-photo authorization or DRM. The album-access endpoint needs edge rate limiting.
- Failed uploads can leave conservative quota reservations; deletions do not credit quota automatically. Manual R2/D1 inventory reconciliation is required, and should be done offline with writes paused.
- Large client-side ZIP downloads can exhaust the visitor device's memory; max 25 images per batch.
- Content-type magic-byte checks do not fully validate images. Consider stronger image decoding/inspection and malware scanning for untrusted contributors.
- A single `sm_album` cookie grants access to one private album at a time. Opening a second private album replaces that access.
- CSRF protection checks same-origin on state-changing requests. Login is still password-based; secure Cloudflare account with MFA.
- Do not put passwords or R2 keys in GitHub.
