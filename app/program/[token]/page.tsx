import { ProgramPortal } from '@/components/programs/ProgramPortal'

export default function ProgramPortalPage({ params }: { params: { token: string } }) {
  return <ProgramPortal token={params.token} />
}
