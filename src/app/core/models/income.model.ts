export type SalaryType = 'monthly' | 'daily' | 'hourly' | 'none';

export interface Allowance {
  name: string;
  amount: number;
}

export interface InKindIncome {
  name: string;
  amount: number;
  taxable: boolean;
}

export interface IncomeRecord {
  applicableMonth: string;
  baseAmount: number;
  absenceDays?: number;
  workDays?: number;
  workingHoursPerDay?: number;
  overtimeAmount?: number;
  allowances?: {
    name: string;
    amount: number;
    isFixed?: boolean;
  }[];
  inKindIncome?: { name: string; amount: number; taxable: boolean }[];

  totalMonthlyIncome: number;
  estimatedAnnualIncome?: number;
  createdAt?: string;
}

