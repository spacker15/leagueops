import { Html, Body, Section, Text, Button, Hr } from '@react-email/components'
import { EventHeader } from './components/EventHeader'

interface AlertEmailProps {
  eventName: string
  logoUrl: string | null
  alertType: string
  summary: string
  detail: string
  ctaUrl: string
  ctaLabel?: string
}

export function AlertEmail({
  eventName,
  logoUrl,
  alertType,
  summary,
  detail,
  ctaUrl,
  ctaLabel = 'View in App',
}: AlertEmailProps) {
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
            {alertType}
          </Text>
          <Text style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px' }}>{summary}</Text>
          <Text
            style={{ fontSize: '16px', color: '#c0c8d8', lineHeight: '1.5', margin: '0 0 16px' }}
          >
            {detail}
          </Text>
          <Button
            href={ctaUrl}
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
            {ctaLabel}
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
