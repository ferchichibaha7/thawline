import type { ReactNode } from 'react';

type Props = {
  size: 'xl' | 'l' | 'm';
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
  children: ReactNode;
};

/** The statement sentence that opens a screen or chart (spec 3.2, 3.5). */
export function Statement({ size, as, id, children }: Props) {
  const Tag = as ?? (size === 'm' ? 'h2' : 'h1');
  return (
    <Tag id={id} className={`statement statement-${size}`}>
      {children}
    </Tag>
  );
}
