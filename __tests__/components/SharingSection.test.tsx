import { describe, it } from 'vitest'

describe('Sharing Tab', () => {
  // EVT-04: System generates a unique registration link per event
  it.todo('constructs registration URL as NEXT_PUBLIC_PUBLIC_RESULTS_URL/e/[slug]/register')
  it.todo('displays registration URL in a read-only input')
  it.todo('copies registration URL to clipboard on button click')

  // EVT-05: QR code download
  it.todo('renders QRCodeSVG with registration URL as value')
  it.todo('renders hidden QRCodeCanvas for PNG export')
  it.todo('preview modal opens on PREVIEW button click')

  // EVT-06: Registration link includes event slug for direct routing
  it.todo('registration URL contains event.slug segment')
  it.todo('mailto href contains encoded registration URL')
  it.todo('sms href contains encoded registration URL')

  // D-08: Draft gate
  it.todo('shows "Registration link available after publishing" when status !== active')
  it.todo('shows sharing content when status === active')
})
