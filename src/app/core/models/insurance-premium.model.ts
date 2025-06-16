export interface StandardMonthlyAmountBreakdown {
  baseSalary: number | null;
  bonusMonthlyEquivalent: number | null;
  allowances: { name: string; amount: number }[];
}


export interface PremiumDetail {
  grade: number;
  premiumTotal: number;
  premiumEmployee: number;
  premiumCompany: number;
}

export interface InsurancePremiumSnapshot {
  standardMonthlyAmount: number;
  healthGrade: number;
  pensionGrade: number;
  careGrade: number | null;
  calculatedAt: string;

  health: PremiumDetail;
  pension: PremiumDetail;
  care: PremiumDetail | null;

  standardMonthlyAmountBreakdown?: StandardMonthlyAmountBreakdown;
}

export interface InsurancePremiumRecord {
  applicableMonth: string;
  calculatedAt: string;
  empNo: string;
  companyId: string;
  standardMonthlyAmount: number;

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

export interface EmployeeInsurancePremiums {
  qualification?: InsurancePremiumSnapshot;
  fixed?: InsurancePremiumSnapshot;
  revised?: InsurancePremiumSnapshot;
  bonus?: InsurancePremiumSnapshot;

  metadata?: {
    updatedAt: any;
    updatedBy: string;
    deleted?: boolean;
    deletedAt?: any;
    deletedBy?: string;
  };
}