import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type FilePurpose, uploadFile } from '../../../shared/files/upload';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { Drawer } from '../../../shared/ui/drawer';
import { EmptyState } from '../../../shared/ui/empty-state';
import { FileDropzone } from '../../../shared/ui/file-dropzone';
import { Spinner } from '../../../shared/ui/spinner';
import { StatusPill } from '../../../shared/ui/status-pill';
import {
  attachInstallationFiles,
  fileLink,
  type Installation,
  INSTALLATIONS_KEY,
  removeInstallationFile,
  useInstallationFiles,
} from './places-api';

const KINDS: readonly {
  purpose: FilePurpose;
  accept: readonly string[];
  types: 'places.installations.drawingTypes' | 'places.installations.photoTypes';
  add: 'places.installations.addDrawings' | 'places.installations.addPhotos';
}[] = [
  {
    purpose: 'installation-drawing',
    accept: ['application/pdf', 'image/png', 'image/jpeg', '.pdf', '.png', '.jpg', '.jpeg'],
    types: 'places.installations.drawingTypes',
    add: 'places.installations.addDrawings',
  },
  {
    purpose: 'installation-photo',
    accept: ['image/png', 'image/jpeg', '.png', '.jpg', '.jpeg', '.heic'],
    types: 'places.installations.photoTypes',
    add: 'places.installations.addPhotos',
  },
];

/** An installation's drawings and photos (BRD C.4.2-31): open, add and remove with a reason. */
export function InstallationFiles({
  installation,
  canEdit,
  onOpenChange,
}: {
  installation: Installation;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const files = useInstallationFiles(installation.id);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; fileName: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: INSTALLATIONS_KEY });

  const add = async (purpose: FilePurpose, chosen: File[]) => {
    setBusy(true);
    setProblems([]);
    const uploaded: string[] = [];
    const failed: string[] = [];
    for (const file of chosen) {
      try {
        uploaded.push((await uploadFile(purpose, file)).id);
      } catch (error) {
        failed.push(
          t('places.installations.uploadFailed', {
            name: file.name,
            message: error instanceof Error ? error.message : '',
          }),
        );
      }
    }
    try {
      if (uploaded.length > 0) await attachInstallationFiles(installation.id, uploaded);
    } catch (error) {
      failed.push(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
    setProblems(failed);
    setBusy(false);
    await refresh();
  };

  const open = async (id: string) => {
    const link = await fileLink(id).catch(() => null);
    if (link) window.open(link.url, '_blank', 'noopener');
  };

  return (
    <Drawer
      open
      onOpenChange={onOpenChange}
      title={t('places.installations.filesOf', { record: installation.name })}
    >
      <div className="space-y-4">
        {problems.map((p) => (
          <Banner key={p} tone="danger">
            {p}
          </Banner>
        ))}
        {files.isPending && <Spinner label={t('loading')} />}
        {files.data?.length === 0 && <EmptyState title={t('places.installations.filesEmpty')} />}
        <ul className="divide-y divide-border">
          {(files.data ?? []).map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink">{file.fileName}</p>
                <p className="text-xs text-ink-secondary">
                  {t(
                    `places.installations.fileKind.${file.purpose as 'installation-drawing' | 'installation-photo'}`,
                  )}
                </p>
                {file.scanStatus === 'pending' && (
                  <StatusPill tone="warning">{t('places.installations.scanning')}</StatusPill>
                )}
                {file.scanStatus === 'infected' && (
                  <StatusPill tone="danger">{t('places.installations.infected')}</StatusPill>
                )}
              </div>
              <div className="flex gap-1">
                {file.scanStatus === 'clean' && (
                  <Button variant="secondary" onClick={() => void open(file.id)}>
                    {t('places.installations.open')}
                  </Button>
                )}
                {canEdit && (
                  <Button variant="ghost" onClick={() => setRemoving(file)}>
                    {t('places.installations.remove')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {canEdit &&
          KINDS.map((kind) => (
            <section key={kind.purpose} className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">{t(kind.add)}</h3>
              <FileDropzone
                accept={kind.accept}
                acceptLabel={t(kind.types)}
                maxSizeMb={15}
                multiple
                disabled={busy}
                onFiles={(chosen) => void add(kind.purpose, chosen)}
              />
            </section>
          ))}
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoving(null);
        }}
        title={removing ? t('places.installations.removeTitle', { name: removing.fileName }) : ''}
        body={t('places.installations.removeBody')}
        confirmLabel={t('places.installations.remove')}
        onConfirm={async (reason) => {
          if (!removing) return;
          await removeInstallationFile(installation.id, removing.id, reason);
          await refresh();
        }}
      />
    </Drawer>
  );
}
