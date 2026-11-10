import { Statement } from '@/components/Statement';

export default function NotFound() {
  return (
    <div className="page">
      <Statement size="l">There is no page at this address.</Statement>
      <p style={{ marginTop: 24 }}>
        <a href="/">Go to the home page</a>
      </p>
    </div>
  );
}
