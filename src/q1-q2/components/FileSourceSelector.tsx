import { useEffect, useRef } from 'react';
import { FolderOpen, Upload } from 'lucide-react';

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
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute('webkitdirectory', '');
    folderInputRef.current.setAttribute('directory', '');
  }, []);

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) onFolderSelected(files);
    event.target.value = '';
  };

  const handleBundleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onBundleSelected(file);
    event.target.value = '';
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <FolderOpen className="h-4 w-4 text-slate-500" />
          导入数据集
        </CardTitle>
        <CardDescription className="text-slate-500">
          上传 <code>manual_check_data</code>、<code>task123_session_packets</code> 或 <code>chunks</code> 数据集文件夹，或导入标注结果 JSON 文件。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-6 pt-5 sm:px-6">
        <input ref={folderInputRef} type="file" className="hidden" multiple onChange={handleFolderChange} />
        <input ref={bundleInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleBundleChange} />

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={isLoading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isLoading ? '读取中...' : '上传数据集文件夹'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => bundleInputRef.current?.click()}
            disabled={isLoading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            导入标注结果 JSON
          </Button>
        </div>

        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 font-medium text-slate-800">支持的数据格式</p>
            <ul className="list-disc space-y-1 pl-4 text-slate-500">
              <li><code>manual_check_data</code> 根目录</li>
              <li><code>task123_session_packets</code> 根目录</li>
              <li><code>chunks/chunk_*/sess_*.json</code> 结构</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 font-medium text-slate-800">工作台能力</p>
            <ul className="list-disc space-y-1 pl-4 text-slate-500">
              <li>自动识别任务视图，逐样本懒加载</li>
              <li>Q1 task1-4 可在展示区直接编辑标注数据</li>
              <li>支持导入已有标注结果与合并数据包</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
