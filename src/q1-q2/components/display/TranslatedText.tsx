import { useEffect, useState } from 'react';
import { Languages, LoaderCircle } from 'lucide-react';

import { translateToZhCN } from '../../../utils/translator';

interface TranslatedTextProps {
  text: string;
  translationEnabled?: boolean;
  className?: string;
}

export function TranslatedText({
  text,
  translationEnabled = false,
  className = 'whitespace-pre-wrap break-words text-sm leading-6 text-slate-700',
}: TranslatedTextProps) {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!translationEnabled || !text.trim()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    translateToZhCN(text)
      .then((result) => {
        if (!isCancelled) {
          setTranslatedText(result);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setTranslatedText(text);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [text, translationEnabled]);

  return (
    <div className="space-y-2">
      <p className={className}>{text}</p>

      {translationEnabled ? (
        isLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            正在翻译...
          </div>
        ) : translatedText && translatedText !== text ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
              <Languages className="h-3.5 w-3.5" />
              中文翻译
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
              {translatedText}
            </p>
          </div>
        ) : null
      ) : null}
    </div>
  );
}
