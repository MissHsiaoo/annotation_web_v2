import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import {
  annotationFormCardClass,
  annotationFormContentClass,
  annotationFormHeaderClass,
} from './annotationFormShell';

interface UnsupportedTaskFormProps {
  label: string;
}

export function UnsupportedTaskForm({ label }: UnsupportedTaskFormProps) {
  return (
    <Card className={annotationFormCardClass}>
      <CardHeader className={annotationFormHeaderClass}>
        <CardTitle className="text-slate-900">标注面板</CardTitle>
        <CardDescription className="text-slate-600">
          {label} 在表单层尚未实现。
        </CardDescription>
      </CardHeader>
      <CardContent className={`${annotationFormContentClass} pb-6 text-sm leading-6 text-slate-600`}>
        数据路径与按任务展示的样本视图已经准备好。该任务下一步需要接入专用标注结构和保存逻辑到当前面板中。
      </CardContent>
    </Card>
  );
}
