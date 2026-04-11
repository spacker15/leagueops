'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type AgeGroup = '6U/8U' | '10U' | '12U' | '14U'

interface RuleRow {
  category: string
  '6U/8U': string
  '10U': string
  '12U': string
  '14U': string
}

const RULES_DATA: RuleRow[] = [
  {
    category: 'Field Size',
    '6U/8U': 'L: 60-70 yds, W: 35-40 yds (Cross-Field)',
    '10U': '7v7 Cross Field, 10v10 Full Field',
    '12U': '7v7 Cross Field, 10v10 Full Field',
    '14U': 'Full Field',
  },
  {
    category: 'Players',
    '6U/8U': '4v4 — 1 GK, 3 Field Players',
    '10U': '6v6, 7v7 or 10v10 (NFHS) — 1 GK, 5-6 Field Players',
    '12U': '7v7: 1GK 2D 2A 2M, 10v10: NFHS',
    '14U': '10v10 NFHS',
  },
  {
    category: 'Cross Length',
    '6U/8U': 'FP: 37"-42", GK: 37"-54", LP: None',
    '10U': 'FP: 37"-42", GK: 37"-54", LP: 47"-54" (7v7=3 max, 10v10=4 max)',
    '12U': 'FP: 40"-42", GK: 40"-72", LP: 52"-72" (7v7=3 max, 10v10=4 max)',
    '14U': 'FP: 40"-72", GK: 40"-72", LP: 52"-72" (4 Max)',
  },
  {
    category: 'Game Length',
    '6U/8U': '2 x 12 min Running',
    '10U': '4 x 10 min Running',
    '12U': '4 x 10 min Running',
    '14U': '4 x 10 min Running',
  },
  {
    category: 'Overtime',
    '6U/8U': 'N/A',
    '10U': '10v10 ONLY (see 12U)',
    '12U': '4 min Sudden Victory',
    '14U': '4 min Sudden Victory',
  },
  {
    category: 'Timeouts',
    '6U/8U': 'None — Officials Only',
    '10U': 'None — Officials Only',
    '12U': '2/half, 1 each OT',
    '14U': '2/half, 1 each OT',
  },
  {
    category: 'Substitutions',
    '6U/8U': 'No "on the fly"',
    '10U': 'No "on the fly" except 10v10 NFHS',
    '12U': 'NFHS',
    '14U': 'NFHS',
  },
  {
    category: 'Counts',
    '6U/8U': '4-sec GK only, no advance. GK out of crease gets 5 sec to return.',
    '10U': '4-sec GK only, no advance. GK out of crease gets 5 sec to return. 10v10 see 12U.',
    '12U': 'GK 4s + 20s Def Zone + 10s Off Zone. No count for GK if outside crease.',
    '14U': 'GK 4s + 20s Def Zone + 10s Off Zone. No count for GK if outside crease.',
  },
  {
    category: 'Over & Back',
    '6U/8U': 'N/A',
    '10U': '10v10 ONLY (see 12U)',
    '12U': 'In effect once 10 sec count satisfied',
    '14U': 'In effect once 10 sec count satisfied',
  },
  {
    category: 'Faceoffs',
    '6U/8U': 'No FO: Coin flip winner at Center X. Others on own def half >5 yds apart. Other team gets ball to start 2nd half.',
    '10U': '1 FO, 1 GK, 2 behind each GLE. 7v7 adds 1 wing (foot on either SL). FO Neutral grip, knee down OK.',
    '12U': '7v7: 1 FO, 1 GK, 2 behind each GLE, 1 wing (foot on either sideline). 10v10 same as NFHS. Standing Neutral Grip.',
    '14U': 'NFHS incl. Standing Neutral Grip',
  },
  {
    category: 'One Pass Rule',
    '6U/8U': '1 attempted pass after FO possession or restart after goal scored',
    '10U': '1 attempted pass after FO possession',
    '12U': 'N/A',
    '14U': 'N/A',
  },
  {
    category: 'Stalling',
    '6U/8U': 'N/A',
    '10U': '10v10 ONLY: See 14U',
    '12U': '10v10 ONLY: See 14U',
    '14U': 'Final 2 min if team ahead 1-4 goals',
  },
  {
    category: 'Scrum',
    '6U/8U': 'Extended w/3 or more players, use AP',
    '10U': 'Extended w/3 or more players, use AP',
    '12U': 'N/A',
    '14U': 'N/A',
  },
  {
    category: 'Restarts',
    '6U/8U': 'All players must be 5 yards from ball carrier',
    '10U': 'All players must be 5 yards from ball carrier',
    '12U': 'Defense can be within 5 yds but must gain 5-yd separation before engaging. Offensive players must be 5 yds away.',
    '14U': 'Defense can be within 5 yds but must gain 5-yd separation before engaging. Offensive players must be 5 yds away.',
  },
  {
    category: 'Fouling Out',
    '6U/8U': 'Personals = 3X or 5-mins',
    '10U': 'Personals = 3X or 5-mins',
    '12U': 'Personals = 3X or 5-mins',
    '14U': 'Personals = 3X or 5-mins',
  },
  {
    category: 'Flag Down',
    '6U/8U': 'Stop play when ball hits ground, not a shot. OR "G.O.O.D.I.E.S"',
    '10U': 'Stop play when ball hits ground, not a shot. OR "G.O.O.D.I.E.S"',
    '12U': 'Stop play when ball hits ground, not a shot. OR "G.O.O.D.I.E.S"',
    '14U': 'Stop play when ball hits ground, not a shot. OR "G.O.O.D.I.E.S"',
  },
  {
    category: 'Man Up/Down',
    '6U/8U': 'N/A: Player serves, team plays at full strength',
    '10U': 'N/A: Player serves, team plays full strength. 10v10 see 12U.',
    '12U': 'Yes (3-down max). All time serving fouls are Non-Releasable.',
    '14U': 'Yes (3-down max). All time serving fouls are Non-Releasable.',
  },
  {
    category: 'Offsides',
    '6U/8U': 'N/A',
    '10U': '7v7: >4 on Off or >5 on Def (exclude penalty area: never man-down)',
    '12U': '7v7: >4 on Off or >5 on Def (incl. penalty area). 10v10 see 14U.',
    '14U': '>6 on Off or >7 on Def (include penalty area)',
  },
  {
    category: '3-Yard Rule',
    '6U/8U': 'All legal holds, pushes & checks must be on a player with possession or within 3 yards of a loose ball',
    '10U': 'All legal holds, pushes & checks must be on a player with possession or within 3 yards of a loose ball',
    '12U': 'All legal holds, pushes & checks must be on a player with possession or within 3 yards of a loose ball',
    '14U': 'All legal holds, pushes & checks must be on a player with possession or within 3 yards of a loose ball',
  },
  {
    category: 'Body Contact',
    '6U/8U': 'Legal Holds & Pushes, Box Out, Riding, Incidental. No "take-out" checks.',
    '10U': 'Legal Holds & Pushes, Box Out, Riding, Incidental. No "take-out" checks.',
    '12U': 'Below neck and Above waist. No "take-out" checks.',
    '14U': 'Below neck and Above waist. No "take-out" checks.',
  },
  {
    category: 'Checking with Cross',
    '6U/8U': 'Lift/poke bottom hand or head of crosse below chest area OR downward check initiated below BOTH players\' shoulders. No one-handed checks.',
    '10U': 'Lift/poke bottom hand or head of crosse below chest area OR downward check initiated below BOTH players\' shoulders. No one-handed checks.',
    '12U': 'See 3-yard rule. Lift/poke bottom hand or head of crosse below chest area OR downward check initiated below BOTH players\' shoulders. One handed OK.',
    '14U': 'See 3-yard rule. Lift/poke bottom hand or head of crosse below chest area OR downward check initiated below BOTH players\' shoulders. One handed OK.',
  },
  {
    category: 'Equipment',
    '6U/8U': 'NFHS — Loss of helmet is an Illegal Procedure Technical Foul',
    '10U': 'NFHS — Loss of helmet is an Illegal Procedure Technical Foul',
    '12U': 'NFHS — Loss of helmet is an Illegal Procedure Technical Foul',
    '14U': 'NFHS — Loss of helmet is an Illegal Procedure Technical Foul',
  },
]

const AGE_GROUPS: AgeGroup[] = ['6U/8U', '10U', '12U', '14U']
const AGE_COLORS: Record<AgeGroup, string> = {
  '6U/8U': 'text-green-400 border-green-500',
  '10U': 'text-blue-400 border-blue-500',
  '12U': 'text-orange-400 border-orange-500',
  '14U': 'text-red-400 border-red-500',
}

export function RulesReference({ selectedDivision }: { selectedDivision?: string }) {
  const [activeAge, setActiveAge] = useState<AgeGroup | 'all'>(() => {
    if (!selectedDivision) return 'all'
    const d = selectedDivision.toLowerCase()
    if (d.includes('1/2') || d.includes('8u') || d.includes('6u')) return '6U/8U'
    if (d.includes('3/4') || d.includes('10u')) return '10U'
    if (d.includes('5/6') || d.includes('12u')) return '12U'
    if (d.includes('7/8') || d.includes('14u')) return '14U'
    return 'all'
  })

  const visibleGroups = activeAge === 'all' ? AGE_GROUPS : [activeAge]

  return (
    <div className="space-y-4">
      {/* Age group selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveAge('all')}
          className={cn(
            'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 rounded border transition-colors',
            activeAge === 'all'
              ? 'bg-navy border-blue-500 text-white'
              : 'bg-surface border-border text-muted hover:text-white'
          )}
        >
          ALL AGES
        </button>
        {AGE_GROUPS.map((ag) => (
          <button
            key={ag}
            onClick={() => setActiveAge(ag)}
            className={cn(
              'font-cond text-[11px] font-bold tracking-wider px-3 py-1.5 rounded border transition-colors',
              activeAge === ag
                ? `bg-surface-card ${AGE_COLORS[ag]}`
                : 'bg-surface border-border text-muted hover:text-white'
            )}
          >
            {ag}
          </button>
        ))}
      </div>

      {/* Source */}
      <div className="font-cond text-[9px] text-muted tracking-wider">
        SOURCE: USA LACROSSE — 2026 BOYS YOUTH RULES COMPARISON CHART
      </div>

      {/* Rules table */}
      <div className="rounded-lg overflow-auto border border-border">
        <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr className="bg-surface-card">
              <th className="px-3 py-2 border-b border-border text-left sticky left-0 bg-surface-card z-10">
                <span className="font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase">
                  Rule
                </span>
              </th>
              {visibleGroups.map((ag) => (
                <th key={ag} className="px-3 py-2 border-b border-border text-left">
                  <span className={cn('font-cond text-[11px] font-black tracking-[.12em] uppercase', AGE_COLORS[ag])}>
                    {ag}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RULES_DATA.map((rule, i) => (
              <tr key={rule.category} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-card)' }}>
                <td className="px-3 py-2.5 border-b border-border/50 sticky left-0 z-10"
                    style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-card)' }}>
                  <span className="font-cond text-[11px] font-bold text-white uppercase">
                    {rule.category}
                  </span>
                </td>
                {visibleGroups.map((ag) => (
                  <td key={ag} className="px-3 py-2.5 border-b border-border/50 max-w-[280px]">
                    <span className="text-[11px] text-gray-300 leading-snug">
                      {rule[ag]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
