import { Html, Body, Section, Text, Button, Hr } from '@react-email/components'
import { EventHeader } from './components/EventHeader'

interface InviteEmailProps {
  eventName: string
  logoUrl: string | null
  recipientName: string
  role: string
  appUrl: string
}

export function InviteEmail({ eventName, logoUrl, recipientName, role, appUrl }: InviteEmailProps) {
  const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <Html>
      <Body
        style={{
          backgroundColor: '#020810',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '0',
        }}
      >
        <EventHeader eventName={eventName} logoUrl={logoUrl} />
        <Section style={{ padding: '24px' }}>
          <Text
            style={{
              fontSize: '12px',
              color: '#5a6e9a',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.12em',
              margin: '0 0 8px',
            }}
          >
            INVITATION
          </Text>
          <Text style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px' }}>
            You&apos;ve been added as a {roleLabel}
          </Text>
          <Text
            style={{
              fontSize: '16px',
              color: '#c0c8d8',
              lineHeight: '1.5',
              margin: '0 0 24px',
            }}
          >
            Hi {recipientName}, you&apos;ve been registered as a{' '}
            <strong style={{ color: '#ffffff' }}>{roleLabel}</strong> for{' '}
            <strong style={{ color: '#ffffff' }}>{eventName}</strong>. Click the button below to
            access the event portal and complete your setup.
          </Text>
          <Button
            href={appUrl}
            style={{
              backgroundColor: '#0B3D91',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '12px 24px',
              display: 'inline-block',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            GET STARTED
          </Button>
        </Section>
        <Hr style={{ borderColor: '#1a2d50', margin: '0' }} />
        <Section style={{ padding: '12px 24px' }}>
          <Text style={{ fontSize: '12px', color: '#5a6e9a', margin: '0' }}>
            {eventName} &middot; Powered by LeagueOps
          </Text>
        </Section>
      </Body>
    </Html>
  )
}
