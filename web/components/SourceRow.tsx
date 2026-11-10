import { formatDate, formatShortDate } from '@/lib/format';

type Props = {
  source: string;
  dataThrough: string | null;
  updated: string | null;
  methodHref?: string;
  csvHref?: string;
};

/** The footer of every chart and table (spec 3.5). */
export function SourceRow({ source, dataThrough, updated, methodHref = '/method', csvHref }: Props) {
  return (
    <p className="small muted" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
      <span>
        Source: {source}.{dataThrough ? ` Data to ${formatDate(dataThrough)}.` : ''}
        {updated ? ` Updated ${formatShortDate(updated)}.` : ''}
      </span>
      <a href={methodHref} style={{ color: 'inherit' }}>
        How this is calculated
      </a>
      {csvHref ? (
        <a href={csvHref} style={{ color: 'inherit' }}>
          Download CSV
        </a>
      ) : null}
    </p>
  );
}
