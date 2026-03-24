import { useEffect, useRef } from 'react';
import { FolderTree, Upload } from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';

interface FileSourceSelectorProps {
  onFolderSelected: (files: FileList) => void;
  onBundleSelected: (file: File) => void;
  isLoading: boolean;
}

export function FileSourceSelector({ onFolderSelected, onBundleSelected, isLoading }: FileSourceSelectorProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!folderInputRef.current) {
      return;
    }

    folderInputRef.current.setAttribute('webkitdirectory', '');
    folderInputRef.current.setAttribute('directory', '');
  }, []);

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      onFolderSelected(files);
    }

    event.target.value = '';
  };

  const handleBundleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onBundleSelected(file);
    }

    event.target.value = '';
  };

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-md ring-1 ring-slate-200/35">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white via-white to-sky-50/50 px-5 py-5 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <FolderTree className="h-5 w-5 text-slate-700" />
          Dataset Import
        </CardTitle>
        <CardDescription className="text-slate-600">
          Upload the local <code>manual_check_data</code> folder. The workbench reads manifest indexes first
          and only lazy-loads the active <code>item.json</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-6 pt-6 sm:px-6">
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFolderChange}
        />
        <input
          ref={bundleInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleBundleChange}
        />

        <div className="rounded-2xl border border-dashed border-sky-300/90 bg-gradient-to-br from-sky-50/90 to-white p-6 shadow-inner ring-1 ring-sky-200/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">Recommended input</p>
              <p className="text-sm text-slate-600">
                Select the root <code>manual_check_data</code> folder so the app can discover both Q1 and
                Q2 tracks safely.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isLoading}
                className="gap-2 self-start rounded-xl shadow-sm transition-shadow hover:shadow-md"
              >
                <Upload className="h-4 w-4" />
                {isLoading ? 'Reading folder...' : 'Upload Dataset Folder'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => bundleInputRef.current?.click()}
                disabled={isLoading}
                className="gap-2 self-start rounded-xl border-slate-300 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Upload className="h-4 w-4" />
                Import Bundle JSON
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-200/25">
            <p className="mb-2 font-medium text-slate-900">Works well today</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Root folder import from <code>manual_check_data</code></li>
              <li>Manifest discovery for Q1 and Q2</li>
              <li>Lazy loading of one <code>item.json</code> at a time</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-sm ring-1 ring-slate-200/25">
            <p className="mb-2 font-medium text-slate-900">Included in this workbench</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Task-specific left-side display composition</li>
              <li>Right-side annotation forms and save flow</li>
              <li>Annotation bundle import and merged bundle import</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
