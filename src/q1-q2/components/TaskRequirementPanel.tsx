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
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="bg-white px-4 py-4">
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
            {isOpen ? 'Hide details' : 'Show details'}
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isOpen ? (
        <CardContent className="grid gap-3 border-t border-slate-100 p-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">What to review</h3>
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
              <h3 className="text-sm font-semibold text-slate-900">Judging criteria</h3>
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
              <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
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
              <h3 className="text-sm font-semibold text-slate-900">Output expectation</h3>
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
