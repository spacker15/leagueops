import { Section, Text, Img } from '@react-email/components'

interface EventHeaderProps {
  eventName: string
  logoUrl: string | null
}

export function EventHeader({ eventName, logoUrl }: EventHeaderProps) {
  return (
    <Section style={{ backgroundColor: '#0B3D91', padding: '20px 24px' }}>
      {logoUrl && <Img src={logoUrl} alt={eventName} height={40} />}
      <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', margin: '8px 0 0' }}>
        {eventName}
      </Text>
    </Section>
  )
}
