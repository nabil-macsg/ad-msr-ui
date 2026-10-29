import { Fragment, type ReactNode } from 'react';

/** Links people may follow: the web, email, and MASAR's own pages. */
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

const INLINE: readonly { re: RegExp; render: (m: RegExpExecArray, key: string) => ReactNode }[] = [
  {
    re: /\*\*([^*]+)\*\*/,
    render: (m, key) => <strong key={key}>{inline(m[1] ?? '', key)}</strong>,
  },
  {
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    render: (m, key) =>
      SAFE_HREF.test(m[2] ?? '') ? (
        <a
          key={key}
          href={m[2]}
          className="text-primary underline"
          {...(/^https?:/i.test(m[2] ?? '') ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
          {inline(m[1] ?? '', key)}
        </a>
      ) : (
        <Fragment key={key}>{m[0]}</Fragment>
      ),
  },
  { re: /`([^`]+)`/, render: (m, key) => <code key={key}>{m[1]}</code> },
  {
    re: /(?:\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/,
    render: (m, key) => <em key={key}>{inline(m[1] ?? m[2] ?? '', key)}</em>,
  },
];

/** Bold, links, code and italics, as elements; everything else stays text. */
function inline(text: string, prefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest.length > 0) {
    let first: { index: number; match: RegExpExecArray; rule: (typeof INLINE)[number] } | null =
      null;
    for (const rule of INLINE) {
      const match = rule.re.exec(rest);
      if (match && (first === null || match.index < first.index)) {
        first = { index: match.index, match, rule };
      }
    }
    if (!first) {
      out.push(rest);
      break;
    }
    if (first.index > 0) out.push(rest.slice(0, first.index));
    out.push(first.rule.render(first.match, `${prefix}.${n++}`));
    rest = rest.slice(first.index + first.match[0].length);
  }
  return out;
}

const BULLET = /^\s*[-*]\s+/;
const NUMBER = /^\s*\d+\.\s+/;
const HEADING = /^(#{1,4})\s+(.*)$/;

/**
 * A safe subset of markdown for help articles (spec 10 §1.4): headings, paragraphs, **bold**,
 * *italics*, `code`, bulleted and numbered lists, and links. It builds React elements, so HTML
 * in the text shows as text and nothing is ever injected.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/);
  return (
    <div className={className ?? 'space-y-2 text-sm text-ink'}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        const lines = block.split('\n');
        if (lines.every((l) => BULLET.test(l))) {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={`${key}.${j}`}>{inline(l.replace(BULLET, ''), `${key}.${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => NUMBER.test(l))) {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={`${key}.${j}`}>{inline(l.replace(NUMBER, ''), `${key}.${j}`)}</li>
              ))}
            </ol>
          );
        }
        const heading = HEADING.exec(lines[0] ?? '');
        if (heading && lines.length === 1) {
          // Articles sit under the page's own headings: their levels start at 3.
          const Tag = (heading[1]?.length ?? 1) <= 2 ? 'h3' : 'h4';
          return (
            <Tag key={key} className="font-semibold text-ink">
              {inline(heading[2] ?? '', key)}
            </Tag>
          );
        }
        return (
          <p key={key}>
            {lines.map((l, j) => (
              <Fragment key={`${key}.${j}`}>
                {j > 0 && <br />}
                {inline(l, `${key}.${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
