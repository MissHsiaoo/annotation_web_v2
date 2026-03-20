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
        <CardTitle className="text-slate-900">Annotation panel</CardTitle>
        <CardDescription className="text-slate-600">
          {label} is not implemented yet in the form layer.
        </CardDescription>
      </CardHeader>
      <CardContent className={`${annotationFormContentClass} pb-6 text-sm leading-6 text-slate-600`}>
        The data path and task-aware sample display are ready. The next step for this task is to wire its dedicated
        annotation schema and save behavior into this pane.
      </CardContent>
    </Card>
  );
}
