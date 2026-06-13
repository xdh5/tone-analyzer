export default defineNuxtConfig({
  modules: [],
  css: ['bootstrap/dist/css/bootstrap.css', 'bootstrap-icons/font/bootstrap-icons.css'],
  app: {
    head: {
      title: 'TONE',
      meta: [
        { name: 'theme-color', content: '#ffc43d' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'TONE' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' }
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },
  devtools: { enabled: false },
  ssr: true
})
