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
  expectedDuration?: 'within2Months' | 'over2Months' | 'indefinite';
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

  bonusMergedIntoMonthly?: boolean;
  bonusSummary?: BonusSummary;
  bonusRecords?: BonusRecord[];
  role?: 'employee' | 'hr';
  firebaseUid?: string;
  isDeleted?: boolean;

  excludedBySocialAgreement?: boolean;
  isDependentInsured?: boolean;

  hasExemption?: boolean;
  exemptionDetails?: {
    types: string[];
    targetInsurances: string[];
    startMonth?: string;
    endMonth?: string;
    notes?: string;
  };
}

export interface ExtendedEmployee extends Employee {
  displayName: string;
  actualPremium: {
    health: { employee: number; employer: number };
    care?: { employee: number; employer: number };
    pension: { employee: number; employer: number };
  };
}

export interface BonusRecord {
  bonusId: string;
  applicableMonth: string;
  amount: number;
  includedInStandardBonus: boolean;
}

export type SalaryType = 'monthly' | 'daily' | 'hourly' | 'none';

export interface BonusDetail {
  applicableMonth: string;
  amount: number;
  includedInStandardBonus?: boolean;
}

export interface BonusSummary {
  total: number;
  bonusCount: number;
  bonusDetails: BonusDetail[];
}
