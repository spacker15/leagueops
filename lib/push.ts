'use client'

/**
 * Convert URL-safe base64 to Uint8Array for applicationServerKey.
 * Required by the Push API subscribe method.
 */
export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Get current push permission state.
 * Returns 'granted', 'denied', 'default', or 'unsupported'.
 */
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Subscribe to push notifications.
 * Per D-09: Only call after first meaningful action (schedule view, command center open).
 * Checks Notification.permission before prompting — never re-prompts denied users.
 *
 * @returns true if subscription succeeded, false otherwise
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('[push] Not supported in this browser')
    return false
  }
  if (Notification.permission === 'denied') {
    console.warn('[push] Permission denied by user')
    return false
  }

  try {
    console.log('[push] Registering service worker...')
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    console.log('[push] Service worker registered')

    // Check for existing subscription
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      console.log('[push] Already subscribed')
      return true
    }

    // Request permission
    console.log('[push] Requesting permission...')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('[push] Permission not granted:', permission)
      return false
    }

    // Subscribe with VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return false
    }
    console.log('[push] VAPID key found, subscribing...')

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    console.log('[push] Browser subscription created')

    // Save to server
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[push] Server save failed:', response.status, text)
    } else {
      console.log('[push] Subscription saved to server')
    }

    return response.ok
  } catch (err) {
    console.error('[push] Subscription failed:', err)
    return false
  }
}

/**
 * Unsubscribe from push notifications.
 * Removes the browser subscription and deletes the server record.
 *
 * @returns true if unsubscription succeeded, false otherwise
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true // Already unsubscribed

    // Remove from server first
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })

    // Unsubscribe from browser
    await subscription.unsubscribe()
    return true
  } catch (err) {
    console.error('Push unsubscription failed:', err)
    return false
  }
}
