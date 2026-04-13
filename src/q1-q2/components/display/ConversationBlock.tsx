import { Bot, User } from 'lucide-react';

import { Badge } from '../../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { sampleBlockCardClass, sampleBlockContentClass, sampleBlockHeaderClass } from './sampleBlockStyles';
import { TranslatedText } from './TranslatedText';

interface ConversationTurn {
  role: string;
  text: string;
}

interface ConversationBlockProps {
  title: string;
  description?: string;
  turns: ConversationTurn[];
  translationEnabled?: boolean;
  /** When true, turns become clickable to select/deselect as evidence. */
  evidenceMode?: boolean;
  /** Set of turn indices currently selected as evidence. */
  selectedIndices?: Set<number>;
  /** Called when the user clicks a turn to toggle it. */
  onTurnClick?: (index: number) => void;
}

export function ConversationBlock({
  title,
  description,
  turns,
  translationEnabled = false,
  evidenceMode = false,
  selectedIndices,
  onTurnClick,
}: ConversationBlockProps) {
  if (turns.length === 0) return null;

  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
        {description ? (
          <CardDescription className="mt-0.5 text-xs text-slate-500">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={`max-h-[640px] overflow-y-auto ${sampleBlockContentClass}`}>
        <div className="space-y-3">
          {turns.map((turn, index) => {
            const isUser = turn.role === 'user';
            const isSelected = evidenceMode && (selectedIndices?.has(index) ?? false);
            return (
              <div
                key={`${turn.role}-${index}`}
                className={`flex gap-2.5 ${isUser ? 'justify-start' : 'justify-end'}`}
              >
                {isUser ? (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <User className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                ) : null}

                <div
                  onClick={evidenceMode && onTurnClick ? () => onTurnClick(index) : undefined}
                  className={`min-w-0 max-w-[80%] rounded-xl border p-3 shadow-sm transition-colors ${
                    evidenceMode ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'border-pink-400 bg-pink-100/60 ring-1 ring-pink-300'
                      : isUser
                        ? 'border-blue-200 bg-blue-50/80'
                        : 'border-emerald-200 bg-emerald-50/80'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        isSelected
                          ? 'border-pink-300 bg-pink-100 text-xs text-pink-700'
                          : isUser
                            ? 'border-blue-300 bg-blue-100 text-xs text-blue-700'
                            : 'border-emerald-300 bg-emerald-100 text-xs text-emerald-700'
                      }
                    >
                      {isUser ? '用户' : '助手'}
                    </Badge>
                    <span className="text-xs text-slate-400">第 {index + 1} 轮</span>
                    {isSelected ? (
                      <span className="ml-auto text-xs font-medium text-pink-500">✓ evidence</span>
                    ) : null}
                  </div>
                  <TranslatedText text={turn.text} translationEnabled={translationEnabled} />
                </div>

                {!isUser ? (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <Bot className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
