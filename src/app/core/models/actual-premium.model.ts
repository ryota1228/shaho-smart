import { Timestamp } from '@angular/fire/firestore';
import { StandardMonthlyAmountBreakdown } from './insurance-premium.model';

export type ActualPremiumMethod = 'qualification' | 'fixed' | 'revised' | 'loss';

export interface ActualPremiumEntry {
  grade: number;
  total: number;
  employee: number;
  company: number;
}

export interface ActualPremiumRecord {
  applicableMonth: string;
  calculatedAt: string;
  empNo: string;
  companyId: string;
  standardMonthlyAmount: number;

  method: ActualPremiumMethod;
  sourceSubmissionId?: string;
  decidedAt: Timestamp;
  decidedBy: string;  

  healthGrade: number | null;
  pensionGrade: number | null;
  careGrade: number | null;

  health: {
    employee: number | null;
    company: number | null;
    total: number | null;
  };
  pension: {
    employee: number | null;
    company: number | null;
    total: number | null;
  };
  care: {
    employee: number | null;
    company: number | null;
    total: number | null;
  } | null;

  standardMonthlyAmountBreakdown?: StandardMonthlyAmountBreakdown;
}
