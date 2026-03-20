import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';

import {
  sampleBlockCardClass,
  sampleBlockContentClass,
  sampleBlockHeaderClass,
} from './display/sampleBlockStyles';

interface JsonPreviewBlockProps {
  title: string;
  description?: string;
  value: unknown;
}

export function JsonPreviewBlock({ title, description, value }: JsonPreviewBlockProps) {
  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        <CardTitle className="text-base text-slate-900">{title}</CardTitle>
        {description ? <CardDescription className="text-slate-600">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={sampleBlockContentClass}>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100 shadow-inner ring-1 ring-white/10">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
