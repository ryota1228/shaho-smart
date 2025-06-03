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
}



  