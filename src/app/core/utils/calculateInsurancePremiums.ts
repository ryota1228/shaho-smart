import { Employee } from '../models/employee.model';
import { Company } from '../models/company.model';
import { SalaryGrade } from './salary-grade.util';
import { InsurancePremiumRecord } from '../models/insurance-premium.model';

export interface PremiumBreakdown {
  employee: number | null;
  company: number | null;
  total: number | null;
}

export function extractPrefecture(address: string): string {
  const match = address.match(/^(.{2,3}都|.{2,3}道|.{2,3}府|.{2,3}県)/);
  return match ? match[1] : 'default';
}

// 追加：給与額を直接渡して保険料を算出する（新ロジック）
export function calculatePremiumsFromSalary(
  salary: number,
  employee: Employee,
  company: Company,
  ratesTable: Record<string, InsuranceRates>,
  healthGrades: SalaryGrade[],
  pensionGrades: SalaryGrade[]
): InsurancePremiumRecord | undefined {
  if (!salary || !company?.prefecture) return;

  const rates = ratesTable[company.prefecture];
  if (!rates) return;

  const now = new Date().toISOString();

  const findGrade = (grades: SalaryGrade[]) =>
    grades.find(g =>
      salary >= g.lower &&
      salary < (typeof g.upper === 'string' && g.upper === 'Infinity'
        ? Number.POSITIVE_INFINITY
        : g.upper as number)
    );

  const healthGrade = findGrade(healthGrades);
  const pensionGrade = findGrade(pensionGrades);
  const careGrade = employee.careInsuranceStatus?.startsWith('加入') ? healthGrade?.grade ?? null : null;

  const healthMonthly = healthGrade?.monthly ?? 0;
  const pensionMonthly = pensionGrade?.monthly ?? 0;
  const careMonthly = careGrade !== null ? healthMonthly : 0;

  return {
    applicableMonth: '',
    empNo: employee.empNo,
    companyId: company.companyId,
    calculatedAt: now,
    standardMonthlyAmount: healthMonthly,
    healthGrade: healthGrade?.grade ?? null,
    pensionGrade: pensionGrade?.grade ?? null,
    careGrade,
    health: calc(rates.health, healthMonthly),
    pension: calc(rates.pension, pensionMonthly),
    care: careGrade !== null && rates.care ? calc(rates.care, careMonthly) : null
  };
}

// 従来の引数形式を保ったまま内部で salary を算出（後方互換対応）
export function calculateInsurancePremiums(
  salary: number,
  employee: Employee,
  company: Company,
  ratesTable: Record<string, InsuranceRates>,
  healthGrades: SalaryGrade[],
  pensionGrades: SalaryGrade[]
): InsurancePremiumRecord | undefined {
  console.log('📘 calculateInsurancePremiums() called', {
    salary,
    empNo: employee.empNo,
    careReason: employee.careInsuranceReason,
    prefecture: company.prefecture
  });

  if (!salary || !company?.prefecture) return;

  const rates = ratesTable[company.prefecture];
  if (!rates) {
    console.warn('❌ 保険料率が見つかりません:', company.prefecture);
    return;
  }

  const now = new Date().toISOString();

  const findGrade = (grades: SalaryGrade[]) =>
    grades.find(g =>
      salary >= g.lower &&
      salary < (typeof g.upper === 'string' && g.upper === 'Infinity'
        ? Number.POSITIVE_INFINITY
        : g.upper as number)
    );

  const healthGrade = findGrade(healthGrades);
  const pensionGrade = findGrade(pensionGrades);

  let careGrade: number | null = null;
  if (
    employee.careInsuranceStatus?.startsWith('加入') &&
    healthGrade?.grade !== undefined
  ) {
    careGrade = healthGrade.grade;
  }

  const healthMonthly = healthGrade?.monthly ?? 0;
  const pensionMonthly = pensionGrade?.monthly ?? 0;
  const careMonthly = careGrade !== null ? healthMonthly : 0;

  const result: InsurancePremiumRecord = {
    applicableMonth: '',
    empNo: employee.empNo,
    companyId: company.companyId,
    standardMonthlyAmount: healthMonthly,
    calculatedAt: now,
    healthGrade: healthGrade?.grade ?? null,
    pensionGrade: pensionGrade?.grade ?? null,
    careGrade,
    health: calc(rates.health, healthMonthly),
    pension: calc(rates.pension, pensionMonthly),
    care: careGrade !== null && rates.care
      ? calc(rates.care, careMonthly)
      : null
  };

  console.log('📦 保険料算出結果:', result);

  return result;
}

// 共通：保険料計算
function calc(rate: { employee: number; company: number }, base: number) {
  const employee = roundToInt(base * rate.employee);
  const company = roundToInt(base * rate.company);
  return {
    employee,
    company,
    total: employee !== null && company !== null ? employee + company : null
  };
}

function roundToInt(value: number | undefined): number | null {
  return typeof value === 'number' && !isNaN(value) ? Math.round(value) : null;
}

export interface InsuranceRates {
  health: { employee: number; company: number };
  pension: { employee: number; company: number };
  care: { employee: number; company: number };
}

export interface BonusPremiumResult {
  standardBonusAmount: number;
  health?: PremiumBreakdown | null;
  pension?: PremiumBreakdown | null;
  care?: PremiumBreakdown | null;
}

export function calculateBonusPremium(
  rawBonus: number,
  employee: Employee,
  company: Company,
  ratesTable: Record<string, InsuranceRates>
): BonusPremiumResult | undefined {
  if (!rawBonus || !company?.prefecture) return;

  const rates = ratesTable[company.prefecture];
  if (!rates) {
    console.warn('❌ 保険料率が見つかりません:', company.prefecture);
    return;
  }

  const standardBonusAmount = Math.floor(rawBonus / 1000) * 1000;

  const result: BonusPremiumResult = {
    standardBonusAmount
  };

  if (employee.healthInsuranceStatus === '加入') {
    result.health = calc(rates.health, standardBonusAmount);
  }

  if (employee.pensionStatus === '加入') {
    result.pension = calc(rates.pension, standardBonusAmount);
  }

  if (
    employee.careInsuranceStatus?.startsWith('加入') &&
    employee.healthInsuranceStatus === '加入'
  ) {
    result.care = calc(rates.care, standardBonusAmount);
  }

  return result;
}

