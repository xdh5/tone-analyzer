# Deploy TONE to Aliyun ECS

This deployment uses GitHub Actions, SSH, PM2, and Caddy.

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
```

Usually only this placeholder must be changed:

```text
ECS_HOST
```

## 3. Add GitHub Secrets

Path: GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`.

Only add:

```text
ECS_SSH_KEY
```

`ECS_SSH_KEY` is the private SSH key content:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

## 4. Prepare ECS

Install Node.js and npm on the ECS server.

PM2 will be installed automatically during deployment if it is missing.

Verify:

```bash
node -v
npm -v
pm2 -v
```

## 5. Deploy

Push to `main`.

GitHub Actions will:

1. Upload source code to ECS.
2. Run `npm ci`.
3. Run Prisma generate and database sync.
4. Build Nuxt.
5. Start or restart PM2 process `tone` on port `3002`.
