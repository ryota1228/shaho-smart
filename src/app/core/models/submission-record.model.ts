import { Timestamp } from '@angular/fire/firestore';

export type SubmissionType = 'acquire' | 'loss' | 'fixed' | 'revised';

export interface SubmissionRecord {
  type: SubmissionType;
  empNo: string;
  companyId: string;
  applicableMonth: string; // 'yyyy-MM'
  createdAt: Timestamp;
  createdBy: string;
  data: any; // 必要に応じて型分離可能
}
