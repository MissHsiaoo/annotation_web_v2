import { Bot, User } from 'lucide-react';

import { Badge } from '../../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
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
}

export function ConversationBlock({
  title,
  description,
  turns,
  translationEnabled = false,
}: ConversationBlockProps) {
  if (turns.length === 0) {
    return null;
  }

  return (
    <Card className="min-w-0 overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white to-slate-50">
        <CardTitle className="text-slate-900">{title}</CardTitle>
        {description ? <CardDescription className="text-slate-600">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="max-h-[720px] overflow-y-auto pt-6">
        <div className="mx-auto max-w-[1040px] space-y-4">
        {turns.map((turn, index) => {
          const isUser = turn.role === 'user';

          return (
            <div key={`${turn.role}-${index}`} className={`flex gap-3 ${isUser ? 'justify-start' : 'justify-end'}`}>
              {isUser ? (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
              ) : null}

              <div
                className={`max-w-[78%] min-w-0 rounded-2xl border p-4 shadow-sm ${
                  isUser ? 'border-blue-200 bg-blue-50/80' : 'border-emerald-200 bg-emerald-50/80'
                }`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      isUser
                        ? 'border-blue-300 bg-blue-100 text-blue-700'
                        : 'border-emerald-300 bg-emerald-100 text-emerald-700'
                    }
                  >
                    {isUser ? 'User' : 'Assistant'}
                  </Badge>
                  <span className="text-xs text-slate-400">Turn {index + 1}</span>
                </div>
                <TranslatedText text={turn.text} translationEnabled={translationEnabled} />
              </div>

              {!isUser ? (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Bot className="h-4 w-4 text-emerald-600" />
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
