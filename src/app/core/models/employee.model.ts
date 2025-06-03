export interface Employee {
  empNo: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  dept: string;

  employmentType: string;
  weeklyHours: number;

  joinDate: string;
  leaveDate?: string;
  birthday: string;

  gender?: 'male' | 'female' | 'other';
  studentStatus?: 'none' | 'daytime' | 'nighttime' | 'correspondence';
  note?: string;

  expectedMonthlyWage?: number;
  expectedDuration?: 'within2Months' | 'over2Months' | 'over1Year';
  hasBonus?: boolean;

  salaryType?: SalaryType;
  healthInsuranceStatus?: string;
  healthInsuranceReason?: string;
  pensionStatus?: string;
  pensionReason?: string;
  careInsuranceStatus?: string;
  careInsuranceReason?: string;

  nationality?: string;
  residencyStatus?: string;

  appliedGrade?: number;
  standardMonthlyAmount?: number;
}

export type SalaryType = 'monthly' | 'daily' | 'hourly' | 'none';

export interface BonusDetail {
  applicableMonth: string;
  amount: number;
}

export interface BonusSummary {
  bonusCount: number;
  totalBonusAmount: number;
  bonusDetails: BonusDetail[];
}
