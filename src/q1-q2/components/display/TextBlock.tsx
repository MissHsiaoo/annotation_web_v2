import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { sampleBlockCardClass, sampleBlockContentClass, sampleBlockHeaderClass } from './sampleBlockStyles';
import { TranslatedText } from './TranslatedText';

interface TextBlockItem {
  label?: string;
  text: string;
}

interface TextBlockProps {
  title: string;
  description?: string;
  items: TextBlockItem[];
  translationEnabled?: boolean;
}

export function TextBlock({
  title,
  description,
  items,
  translationEnabled = false,
}: TextBlockProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        <CardTitle className="text-base text-slate-900">{title}</CardTitle>
        {description ? <CardDescription className="text-slate-600">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={`space-y-4 ${sampleBlockContentClass}`}>
        {items.map((item, index) => (
          <div key={`${item.label ?? title}-${index}`} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {item.label ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            ) : null}
            <TranslatedText text={item.text} translationEnabled={translationEnabled} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
