self.addEventListener('push', event => {
  if (!event.data) return
  const { title, body, url } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: url || '/today' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(event.notification.data.url)
          return client.focus()
        }
      }
      return clients.openWindow(event.notification.data.url)
    })
  )
})

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request))
})
