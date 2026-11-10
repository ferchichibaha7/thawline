/**
 * Story files for every component in spec 3.5, in Component Story Format
 * (default export with a title, named exports with a render function). The
 * gallery at /dev/components renders them; Storybook can load the same files.
 *
 * Market components use fixtures recorded from real pipeline output
 * (web/tests/fixtures). Aftermath and demand components have no real data yet,
 * so their stories show layout only, with neutral text that names no company.
 */
import type { ReactNode } from 'react';
import strip from '@/tests/fixtures/line-strip-US.json';
import weekly from '@/tests/fixtures/weekly-US-software-development.json';
import forecast from '@/tests/fixtures/forecast-US-scientific-research.json';
import signals from '@/tests/fixtures/signals-US.json';
import { ComponentBreakdown } from './ComponentBreakdown';
import { EmptyState } from './EmptyState';
import { EvidenceTimeline } from './EvidenceTimeline';
import { Explain } from './Explain';
import { Glossary } from './Glossary';
import { LineStrip } from './LineStrip';
import { PositionBar, PRESSURE } from './PositionBar';
import { RolePicker } from './RolePicker';
import { SignalList } from './SignalList';
import { SkillTable } from './SkillTable';
import { SourceRow } from './SourceRow';
import { StaleNotice } from './StaleNotice';
import { StateTag } from './StateTag';
import { Statement } from './Statement';
import { TrendChart } from './TrendChart';
import { VerdictTag } from './VerdictTag';
import { EXPLAIN } from '@/lib/explain';
import { lineWords } from '@/lib/format';
import { metrics } from '@/lib/metrics';
import { postingsNoun, recoverySentence, sectorSentence, type Recovery } from '@/lib/statements';

export type Story = { name: string; render: () => ReactNode };
export type StoryModule = { title: string; stories: Story[] };

const LAYOUT_ONLY = 'Layout sample, not data';

const fourWeek = (pts: { value: number }[]) =>
  pts.slice(3).map((_, i) => (pts[i]!.value + pts[i + 1]!.value + pts[i + 2]!.value + pts[i + 3]!.value) / 4);
const swStatement = sectorSentence(postingsNoun('Software', 'the United States'), fourWeek(weekly.points), weekly.points[weekly.points.length - 1]!.value);
const fcStatement = recoverySentence(forecast.recovery as Recovery);
const last = strip.items[0]!;
const reasons = metrics.thaw_index.missing_reasons;
const componentRows = [
  { name: 'Level', score: strip.thaw.level, reading: `Four-week average ${last.value.toFixed(1)}: ${lineWords(last.value)} the line.`, weight: strip.thaw.weights.level ?? null },
  { name: 'Momentum', score: strip.thaw.momentum, reading: `Up ${((last.value / last.valueThen - 1) * 100).toFixed(1)}% in 13 weeks.`, weight: strip.thaw.weights.momentum ?? null },
  { name: 'Breadth', score: null, reading: reasons.breadth, weight: null },
  { name: 'Entry access', score: null, reading: reasons.entry_access, weight: null },
  { name: 'Competition', score: null, reading: reasons.competition, weight: null },
];

export const STORIES: StoryModule[] = [
  {
    title: 'Statement',
    stories: [
      { name: 'XL', render: () => <Statement size="xl">{swStatement}</Statement> },
      { name: 'L', render: () => <Statement size="l" as="h2">{swStatement}</Statement> },
      { name: 'M', render: () => <Statement size="m">{fcStatement}</Statement> },
    ],
  },
  {
    title: 'LineStrip',
    stories: [{ name: 'United States', render: () => <LineStrip items={strip.items} dataThrough={strip.dataThrough} /> }],
  },
  {
    title: 'TrendChart',
    stories: [
      {
        name: 'Sector against the line',
        render: () => <TrendChart label={swStatement} series={weekly.points} />,
      },
      {
        name: 'With forecast fan',
        render: () => <TrendChart label={fcStatement} series={forecast.points} forecast={forecast.forecast} />,
      },
    ],
  },
  {
    title: 'PositionBar',
    stories: [
      { name: 'Thaw Index', render: () => <PositionBar score={strip.thaw.score} state={strip.thaw.state} label={`Thaw Index ${Math.round(strip.thaw.score)}, ${strip.thaw.state}`} /> },
      { name: `Pressure, three segments (${LAYOUT_ONLY})`, render: () => <PositionBar score={50} state="Stretched" segments={PRESSURE} label="Pressure layout sample" /> },
    ],
  },
  {
    title: 'StateTag',
    stories: [{ name: 'All states', render: () => <div style={{ display: 'flex', gap: 8 }}>{['Frozen', 'Cold', 'Thawing', 'Open'].map((s) => <StateTag key={s} state={s} />)}</div> }],
  },
  {
    title: 'ComponentBreakdown',
    stories: [{ name: 'Two parts available', render: () => <ComponentBreakdown rows={componentRows} /> }],
  },
  {
    title: 'EvidenceTimeline',
    stories: [
      {
        name: LAYOUT_ONLY,
        render: () => (
          <EvidenceTimeline
            entries={[
              { id: 1, date: '2026-01-15', type: 'claim', summary: 'Sample summary sentence in the past tense.', publisher: 'Publisher name', url: '#', tier: 'A' },
              { id: 2, date: '2026-06-02', type: 'rehire', summary: 'Sample summary sentence in the past tense.', publisher: 'Publisher name', url: '#', tier: 'B' },
              { id: 3, date: '2026-07-20', type: 'other', summary: 'Sample unverified report.', publisher: 'Submission', url: '#', tier: 'D' },
            ]}
          />
        ),
      },
    ],
  },
  {
    title: 'VerdictTag',
    stories: [{ name: 'All verdicts', render: () => <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(['Holding', 'Walked back', 'Mixed', 'Too early', 'Unclear'] as const).map((v) => <VerdictTag key={v} verdict={v} />)}</div> }],
  },
  {
    title: 'SkillTable',
    stories: [
      {
        name: LAYOUT_ONLY,
        render: () => (
          <SkillTable caption="Layout sample" rows={[{ skill: 'Skill A', share: 0.5, change: 3 }, { skill: 'Skill B', share: 0.3, change: -2 }, { skill: 'Skill C', share: 0.1, change: null }]} />
        ),
      },
    ],
  },
  {
    title: 'SourceRow',
    stories: [{ name: 'Indeed', render: () => <SourceRow source="Indeed Hiring Lab" dataThrough={strip.dataThrough} updated={strip.updated} csvHref="#" /> }],
  },
  { title: 'Explain', stories: [{ name: 'Thaw Index', render: () => <Explain {...EXPLAIN.thawIndex} /> }] },
  {
    title: 'RolePicker',
    stories: [
      {
        name: 'Default',
        render: () => (
          <RolePicker
            families={[{ value: 'frontend', label: 'Frontend engineering' }, { value: 'product_design', label: 'Product, UX and UI design' }]}
            countries={[{ value: 'US', label: 'United States' }, { value: 'FR', label: 'France' }]}
            family="frontend"
            country="US"
            level="mid"
          />
        ),
      },
    ],
  },
  { title: 'SignalList', stories: [{ name: 'Recent', render: () => <SignalList items={signals} /> }] },
  {
    title: 'StaleNotice',
    stories: [
      { name: 'Late', render: () => <StaleNotice lastData={strip.dataThrough} /> },
      { name: 'Stale', render: () => <StaleNotice lastData={strip.dataThrough} stale /> },
    ],
  },
  { title: 'EmptyState', stories: [{ name: 'Collecting', render: () => <EmptyState>Role-level trend appears after 26 weeks of collection. 0 weeks so far.</EmptyState> }] },
  {
    title: 'Glossary',
    stories: [{ name: 'Inline term', render: () => <p>Postings are measured against <Glossary term="the line" uid="story" />.</p> }],
  },
];
