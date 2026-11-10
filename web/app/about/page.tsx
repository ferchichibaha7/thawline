import type { Metadata } from 'next';
import { Statement } from '@/components/Statement';
import { TAGLINE } from '@/lib/site';

export const metadata: Metadata = { title: 'About', description: 'What Thawline is, who maintains it and how it is funded.' };

export default function AboutPage() {
  return (
    <div className="page">
      <Statement size="l">{TAGLINE}</Statement>
      <div className="body-text" style={{ marginTop: 32 }}>
        <p>
          Thawline shows tech and design workers where the job market stands for their role, what happened at companies
          that cut staff for AI, and how much pressure the AI boom is under, using only sourced public data.
        </p>
        <p>
          Hiring froze. A thaw line is the boundary where frozen ground starts to give. Thawline shows each role&apos;s
          position against that line, set at the number of job postings on 1 February 2020, and whether it is moving
          toward it.
        </p>
        <p>
          Every number carries its source and date. Forecasts appear only when they beat a simple baseline in testing.
          The method is published in full, the code is MIT licensed and the data Thawline produces is CC BY 4.0.
        </p>
        <p>
          Thawline is not a job board, a forum or financial advice. It holds no data about individual people.
        </p>
        <h2 className="heading" style={{ marginTop: 32 }}>
          Funding and maintainers
        </h2>
        <p>Thawline has no funding. It is maintained by its founder; moderators will be named here when the company tracker opens.</p>
        <h2 className="heading" style={{ marginTop: 32 }}>
          The bot
        </h2>
        <p>
          ThawlineBot collects public data. It identifies itself, respects robots.txt for web pages, follows each
          API&apos;s published limits and waits between requests to the same host.
        </p>
        <p>
          Contact: {process.env.CONTACT_EMAIL ? <a href={`mailto:${process.env.CONTACT_EMAIL}`}>{process.env.CONTACT_EMAIL}</a> : 'an address will be published here before launch.'}
        </p>
      </div>
    </div>
  );
}
