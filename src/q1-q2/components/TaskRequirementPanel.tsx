import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Eye, ListChecks, ShieldCheck, Target } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import type { TaskRequirementConfig } from '../types';

interface TaskRequirementPanelProps {
  requirement: TaskRequirementConfig;
}

export function TaskRequirementPanel({ requirement }: TaskRequirementPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden border-slate-200/90 bg-white/95 shadow-md ring-slate-200/45 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white via-white to-indigo-50/45 px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <ClipboardList className="h-5 w-5 text-slate-700" />
              {requirement.title}
            </CardTitle>
            <CardDescription className="max-w-4xl text-sm leading-5 text-slate-600">
              {requirement.objective}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen((current) => !current)}
            className="gap-2 rounded-xl border-slate-300 bg-white"
          >
            {isOpen ? '隐藏说明' : '查看说明'}
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isOpen ? (
        <CardContent className="grid gap-4 border-t border-slate-100/80 px-5 py-5 sm:px-6 2xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">查看内容</h3>
            </div>
            <ul className="list-disc space-y-1.5 pl-4 text-sm leading-6 text-slate-600">
              {requirement.whatToReview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">判断标准</h3>
            </div>
            <ul className="list-disc space-y-1.5 pl-4 text-sm leading-6 text-slate-600">
              {requirement.judgingCriteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">检查清单</h3>
            </div>
            <ul className="list-disc space-y-1.5 pl-4 text-sm leading-6 text-slate-600">
              {requirement.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">输出要求</h3>
            </div>
            <ul className="list-disc space-y-1.5 pl-4 text-sm leading-6 text-slate-600">
              {requirement.outputExpectation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
