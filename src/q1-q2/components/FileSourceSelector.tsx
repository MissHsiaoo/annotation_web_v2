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
          数据集导入
        </CardTitle>
        <CardDescription className="text-slate-600">
          上传旧版 <code>manual_check_data</code> 标注数据集，或新版
          <code>task123_session_packets</code> / <code>chunks</code> 基准构建会话数据集。系统会自动识别数据结构，并按需懒加载当前样本。
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
              <p className="text-sm font-medium text-slate-900">推荐导入方式</p>
              <p className="text-sm text-slate-600">
                请选择数据集根目录。对于新的基准构建会话数据，你可以直接上传包含它的项目目录，
                或直接上传 <code>task123_session_packets</code> / <code>chunks</code> 数据文件夹。
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
                {isLoading ? '正在读取文件夹...' : '上传数据集文件夹'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => bundleInputRef.current?.click()}
                disabled={isLoading}
                className="gap-2 self-start rounded-xl border-slate-300 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Upload className="h-4 w-4" />
                导入标注结果 JSON
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-200/25">
            <p className="mb-2 font-medium text-slate-900">当前支持</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>从 <code>manual_check_data</code> 根目录导入</li>
              <li>从 <code>task123_session_packets</code> 根目录导入</li>
              <li>从包含 <code>chunks/chunk_*/sess_*.json</code> 的根目录导入</li>
              <li>自动发现各标注任务视图</li>
              <li>按样本逐个懒加载</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-sm ring-1 ring-slate-200/25">
            <p className="mb-2 font-medium text-slate-900">工作台能力</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>按任务定制左侧样本展示</li>
              <li>Q1 task1-4 可在样本展示区直接修改待标注数据</li>
              <li>右侧中文标注表单与保存流程</li>
              <li>支持导入标注结果与合并数据包</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
