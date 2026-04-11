// Service worker for push notification reception
// Phase 7: Notification Infrastructure

const recentPushTimestamps = []

self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()
  const now = Date.now()

  // Collapse: 3+ pushes within 60 seconds = summary (D-11)
  // Filter timestamps to last 60 seconds
  while (recentPushTimestamps.length > 0 && now - recentPushTimestamps[0] > 60000) {
    recentPushTimestamps.shift()
  }
  recentPushTimestamps.push(now)

  let title, body, url
  if (recentPushTimestamps.length >= 3) {
    // Collapse to summary per D-11
    title = 'New Alerts \u2014 ' + (data.eventName || 'LeagueOps')
    body = recentPushTimestamps.length + ' new alerts \u2014 Tap to view'
    url = data.appUrl || '/'
  } else {
    // Individual notification per D-10
    title = data.title || 'LeagueOps Alert'
    body = data.body || ''
    url = data.url || '/'
  }

  // Detect urgent notifications (trainer dispatch, medical, lightning)
  var isUrgent =
    (title && (title.toLowerCase().includes('trainer') ||
     title.toLowerCase().includes('medical') ||
     title.toLowerCase().includes('lightning') ||
     title.toLowerCase().includes('dispatch'))) ||
    (body && (body.toLowerCase().includes('dispatch') ||
     body.toLowerCase().includes('trainer')))

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: data.icon || '/icon.png',
      badge: '/icon.png',
      data: { url: url },
      tag: recentPushTimestamps.length >= 3 ? 'collapsed-summary' : undefined,
      vibrate: isUrgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
      requireInteraction: isUrgent ? true : false,
      silent: false,
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(clients.openWindow(url))
})
