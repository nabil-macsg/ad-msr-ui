import { Upload } from 'lucide-react';
import { type DragEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export interface FileDropzoneProps {
  /** MIME types or extensions (`application/pdf`, `.jpg`). The server checks content again. */
  readonly accept: readonly string[];
  /** A readable list for the hint, e.g. "PDF, JPG or PNG". */
  readonly acceptLabel: string;
  readonly maxSizeMb: number;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly onFiles: (files: File[]) => void;
}

function accepted(file: File, accept: readonly string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((rule) =>
    rule.startsWith('.')
      ? name.endsWith(rule.toLowerCase())
      : rule.endsWith('/*')
        ? file.type.startsWith(rule.slice(0, -1))
        : file.type === rule,
  );
}

/** Drag and drop, or choose files; refuses wrong types and sizes before uploading (PROMPT §2.10). */
export function FileDropzone({
  accept,
  acceptLabel,
  maxSizeMb,
  multiple = false,
  disabled = false,
  onFiles,
}: FileDropzoneProps) {
  const { t } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const take = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).slice(0, multiple ? undefined : 1);
    const problems: string[] = [];
    const ok = files.filter((file) => {
      if (!accepted(file, accept)) {
        problems.push(t('ui.dropzone.wrongType', { name: file.name }));
        return false;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        problems.push(t('ui.dropzone.tooLarge', { name: file.name, size: maxSizeMb }));
        return false;
      }
      return true;
    });
    setErrors(problems);
    if (ok.length > 0) onFiles(ok);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled) take(event.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-muted/50 px-6 py-8 text-center transition-colors',
          over && 'border-primary bg-primary-subtle',
          disabled && 'opacity-50',
        )}
      >
        <Upload className="size-8 text-ink-muted" aria-hidden />
        <p className="text-sm text-ink">
          {t('ui.dropzone.prompt')}{' '}
          <label
            htmlFor={id}
            className="cursor-pointer font-semibold text-link underline-offset-4 hover:underline"
          >
            {t('ui.dropzone.choose')}
          </label>
        </p>
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {t('ui.dropzone.limits', { types: acceptLabel, size: maxSizeMb })}
        </p>
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          accept={accept.join(',')}
          multiple={multiple}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-sm text-danger-fg">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
