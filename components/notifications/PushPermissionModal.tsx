'use client'

import { useState } from 'react'
import { Modal, Btn } from '@/components/ui'
import { subscribeToPush, getPushPermission } from '@/lib/push'
import toast from 'react-hot-toast'
import { useApp } from '@/lib/store'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function PushPermissionModal({ isOpen, onClose }: Props) {
  const { state } = useApp()
  const [loading, setLoading] = useState(false)

  const eventName = state.event?.name || 'your event'

  // Do not show if permission is already granted or denied
  const currentPermission = getPushPermission()
  if (currentPermission === 'granted' || currentPermission === 'denied') {
    return null
  }

  async function handleEnable() {
    setLoading(true)
    try {
      const success = await subscribeToPush()
      if (success) {
        toast.success('Push notifications enabled')
        onClose()
      } else {
        const perm = getPushPermission()
        if (perm === 'denied') {
          toast.error('Notifications blocked — update permissions in your browser settings.')
        } else {
          toast.error('Push notifications unavailable. Check your browser settings and try again.')
        }
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Get Event Alerts"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={loading}>
            Not Now
          </Btn>
          <Btn variant="primary" onClick={handleEnable} disabled={loading}>
            Enable Notifications
          </Btn>
        </>
      }
    >
      <p
        id="push-permission-modal-desc"
        aria-describedby="push-permission-modal-desc"
        className="text-[13px] text-white leading-relaxed"
      >
        Stay updated on weather delays, schedule changes, and game day alerts for{' '}
        <strong>{eventName}</strong>.
      </p>
    </Modal>
  )
}
