import { Timestamp } from '@angular/fire/firestore';

export type ActualPremiumMethod = 'qualification' | 'fixed' | 'revised' | 'loss';

export interface ActualPremiumEntry {
  grade: number;
  total: number;
  employee: number;
  company: number;
}

export interface ActualPremiumRecord {
  method: ActualPremiumMethod;
  applicableMonth: string;
  sourceSubmissionId: string;
  decidedAt: Timestamp;
  decidedBy: string;
  health: ActualPremiumEntry;
  pension?: ActualPremiumEntry;
  care: ActualPremiumEntry | null;
}
