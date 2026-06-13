# Deploy TONE to Aliyun ECS

This deployment uses GitHub Actions, SSH, PM2, and Nginx.

## 1. Server Layout

The app runs on the ECS server like this:

```text
tone -> 127.0.0.1:3002
```

Files are deployed under:

```text
/opt/tone
```

SQLite data is stored outside release folders:

```text
/opt/tone/shared/data/prod.db
```

## 2. Edit Fixed Values

Edit this block in `.github/workflows/deploy-aliyun.yml`:

```yaml
env:
  APP_NAME: tone
  ECS_HOST: your-ecs-public-ip
  ECS_USERNAME: root
  ECS_SSH_PORT: 22
  ECS_APP_DIR: /opt/tone
  ECS_APP_PORT: 3002
  GOOGLE_CLIENT_ID: your-google-client-id
```

Usually only these two placeholders must be changed:

```text
ECS_HOST
GOOGLE_CLIENT_ID
```

## 3. Add GitHub Secrets

Path: GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`.

Only add:

```text
ECS_SSH_KEY
GOOGLE_CLIENT_SECRET
```

`ECS_SSH_KEY` is the private SSH key content:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

## 4. Prepare ECS

Install Node.js, npm, and Nginx on the ECS server.

PM2 will be installed automatically during deployment if it is missing.

Verify:

```bash
node -v
npm -v
pm2 -v
nginx -v
```

## 5. Nginx

Use a subdomain, for example:

```text
tone.your-domain.com
```

Nginx config:

```nginx
server {
    server_name tone.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:

```bash
nginx -t
systemctl reload nginx
```

## 6. Google OAuth

In Google Cloud Console, add:

```text
https://tone.your-domain.com/api/auth/google/callback
```

If testing directly by IP:

```text
http://your-ecs-public-ip:3002/api/auth/google/callback
```

## 7. Deploy

Push to `master`.

GitHub Actions will:

1. Upload source code to ECS.
2. Run `npm ci`.
3. Run Prisma generate and database sync.
4. Build Nuxt.
5. Start or restart PM2 process `tone` on port `3002`.
