# Security

## Cloudflare tunnel token rotation

The tunnel token was previously visible in `docker inspect`. Rotate it:

1. Cloudflare Zero Trust → Networks → Tunnels → your tunnel → **Configure**
2. **Refresh token** (or delete and recreate the connector token)
3. Save the new token to `~/work/.cloudflared/tunnel.env` (mode `600`):

   ```
   TUNNEL_TOKEN=your-new-token
   ```

4. Recreate the container:

   ```bash
   docker rm -f cloudflare_tunnel
   docker run -d --name cloudflare_tunnel --restart always --network host \
     --env-file ~/work/.cloudflared/tunnel.env \
     cloudflare/cloudflared:latest tunnel --no-autoupdate run
   ```

## IPScope origin URL

The app binds to `127.0.0.1:3920` only. A local `socat` proxy (`ipscope-proxy` in PM2) forwards `192.168.0.234:3920` → `127.0.0.1:3920` for the Cloudflare tunnel.

**Recommended:** In Cloudflare Zero Trust, change `ip.vinitk.dev` origin to `http://127.0.0.1:3920` and remove the socat proxy. Keep cloudflared on `--network host`.

Requires `socat` on the server: `sudo apt install socat`

## Reporting vulnerabilities

Email `legal@vinitk.dev` with subject line `Security`.