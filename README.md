# TONE

TONE is a Nuxt 3 vocal pitch recorder and practice app.

## Features

- Real-time microphone pitch detection and pitch curve drawing
- Free recording mode
- Accompaniment upload and practice mode
- Saved recording playback
- Recording and accompaniment rename/delete
- Google login
- PWA manifest and service worker
- SQLite + Prisma persistence
- GitHub Actions deployment to Aliyun ECS with PM2 on port `3002`

## Development

```bash
npm install
npm run prisma:push
npm run dev
```

Local app:

```text
http://localhost:3000/tone
```

## Build

```bash
npm run build
```

## Database

Local development uses:

```env
DATABASE_URL="file:./dev.db"
```

Production deployment writes data to:

```text
/opt/tone/shared/data/prod.db
```

## Useful Scripts

```bash
npm run build
npm run preview
npm run prisma:push
npm run prisma:studio
```

## Deployment

See [DEPLOY_ALIYUN.md](./DEPLOY_ALIYUN.md).
