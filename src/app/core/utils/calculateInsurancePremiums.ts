import { Employee } from '../models/employee.model';
import { Company } from '../models/company.model';
import { SalaryGrade } from './salary-grade.util';
import { InsurancePremiumRecord, InsurancePremiumSnapshot } from '../models/insurance-premium.model';
import { BonusPremiumRecord } from '../models/bonus-premium.model';
import { IncomeRecord } from '../models/income-record.model';
import { hasFixedWageChange } from './wage-change.util';

export interface PremiumBreakdown {
  employee: number;
  company: number;
  total: number;
}

export function extractPrefecture(address: string): string {
  const match = address.match(/^(.{2,3}都|.{2,3}道|.{2,3}府|.{2,3}県)/);
  return match ? match[1] : 'default';
}

function findGrade(grades: SalaryGrade[], amount: number): SalaryGrade | undefined {
  return grades.find(g =>
    amount >= g.lower &&
    amount < (typeof g.upper === 'string' && g.upper === 'Infinity'
      ? Number.POSITIVE_INFINITY
      : g.upper as number)
  );
}

function isCareInsuranceApplicable(emp: Employee): boolean {
  return !!emp.careInsuranceStatus && emp.careInsuranceStatus.startsWith('加入') && emp.healthInsuranceStatus === '加入';
}

export function calculateInsurancePremiums(
  salary: number,
  employee: Employee,
  company: Company,
  rates: InsuranceRates,
  healthGrades: SalaryGrade[],
  pensionGrades: SalaryGrade[],
  bonusMonthlyEquivalent?: number,
  applicableMonth?: string,
  disableAutoExemption: boolean = false,
  exemptionsOverride?: ('health' | 'pension' | 'care')[]
): InsurancePremiumRecord | undefined {
  if (!salary) return;

  const now = new Date().toISOString();
  const effectiveSalary = salary + (bonusMonthlyEquivalent ?? 0);

  const healthGrade = findGrade(healthGrades, effectiveSalary);
  const pensionGrade = findGrade(pensionGrades, effectiveSalary);
  const careGrade = findGrade(healthGrades, effectiveSalary);

  const healthMonthly = healthGrade?.monthly ?? 0;
  const pensionMonthly = pensionGrade?.monthly ?? 0;
  const careMonthly = careGrade?.monthly ?? 0;

  // ✅ 年齢に基づく制度適用判定（副作用なし）
  const isInsuranceApplicableByAge = (
    birthDate: string,
    month: string,
    startAge: number,
    endAge?: number
  ): boolean => {
    const dob = new Date(birthDate);
    const birthDayBefore = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate() - 1);
    const startMonth = new Date(birthDayBefore.getFullYear() + startAge, birthDayBefore.getMonth(), 1);
    const endMonth = endAge !== undefined
      ? new Date(birthDayBefore.getFullYear() + endAge, birthDayBefore.getMonth(), 1)
      : null;
    const target = new Date(`${month}-01`);
    return (!isNaN(target.getTime())) &&
           target >= startMonth &&
           (!endMonth || target < endMonth);
  };

  if (!applicableMonth || !employee.birthday) return;

  const month = applicableMonth;
  const birth = employee.birthday;
  
  const effectiveCareStatus = isInsuranceApplicableByAge(birth, month, 40, 65) ? '加入' : '対象外';
  const effectiveHealthStatus = isInsuranceApplicableByAge(birth, month, 0, 75) ? '加入' : '対象外';
  const effectivePensionStatus = isInsuranceApplicableByAge(birth, month, 0, 70) ? '加入' : '対象外';
  
  const isCareApplicable = effectiveCareStatus === '加入' && effectiveHealthStatus === '加入';

  const isExempted = (type: 'health' | 'pension' | 'care'): boolean => {
    const manualOverride = exemptionsOverride?.includes(type);
    console.log(`[免除override] empNo=${employee.empNo} type=${type} → ${manualOverride}`);
    if (manualOverride) return true;
  
    const ex = employee.exemptionDetails;
    const result =
      !disableAutoExemption &&
      employee.hasExemption &&
      ex &&
      ex.targetInsurances?.includes(type) &&
      applicableMonth &&
      (!ex.startMonth || ex.startMonth <= applicableMonth) &&
      (!ex.endMonth || applicableMonth <= ex.endMonth);
  
    console.log(`[免除fallback] empNo=${employee.empNo} type=${type} → ${result}`);
    return !!result;
  };

  const healthPremiumRaw = calc(rates.health, healthMonthly);
  const pensionPremiumRaw = calc(rates.pension, pensionMonthly);
  const carePremiumRaw = calc(rates.care, careMonthly);

  let healthPremium: PremiumBreakdown = { ...healthPremiumRaw };
  if (!effectiveHealthStatus?.includes('加入')) {
    healthPremium = { employee: 0, company: 0, total: 0 };
  } else if (isExempted('health')) {
    healthPremium = { employee: 0, company: 0, total: 0 };
  }

  let pensionPremium: PremiumBreakdown = { ...pensionPremiumRaw };
  if (!effectivePensionStatus?.includes('加入')) {
    pensionPremium = { employee: 0, company: 0, total: 0 };
  } else if (isExempted('pension')) {
    pensionPremium = { employee: 0, company: 0, total: 0 };
  }

  let carePremium: PremiumBreakdown = { ...carePremiumRaw };
  if (!isCareApplicable || !effectiveCareStatus?.includes('加入')) {
    carePremium = { employee: 0, company: 0, total: 0 };
  } else if (isExempted('care')) {
    carePremium = { employee: 0, company: 0, total: 0 };
  }

  return {
    applicableMonth: applicableMonth ?? '',
    empNo: employee.empNo,
    companyId: company.companyId,
    calculatedAt: now,
    standardMonthlyAmount: healthMonthly,
    healthGrade: healthGrade?.grade ?? null,
    pensionGrade: pensionGrade?.grade ?? null,
    careGrade: careGrade?.grade ?? null,
    health: healthPremium,
    pension: pensionPremium,
    care: carePremium,
    standardMonthlyAmountBreakdown: {
      baseSalary: salary,
      bonusMonthlyEquivalent: bonusMonthlyEquivalent ?? null,
      allowances: [],
    },
  };
}

function roundEmployeePremium(amount: number): number {
  const fractionalPart = Math.floor(amount * 100) % 10;
  return fractionalPart < 5 ? Math.floor(amount) : Math.ceil(amount);
}

function truncateCompanyPremium(amount: number): number {
  return Math.floor(amount);
}

function calc(rate: { employee: number; company: number }, base: number): PremiumBreakdown {
  const employeeRaw = rate.employee * base;
  const companyRaw = rate.company * base;

  const employee = roundEmployeePremium(employeeRaw);
  const company = truncateCompanyPremium(companyRaw);
  const total = employee + company;

  return {
    employee,
    company,
    total
  };
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
  rates: InsuranceRates,
  includedInStandardBonus: boolean,
  applicableMonth?: string
): BonusPremiumResult | undefined {
  if (!rawBonus) return;

  const standardBonusAmount = Math.floor(rawBonus / 1000) * 1000;
  const result: BonusPremiumResult = { standardBonusAmount };

  const isExempted = (type: 'health' | 'pension' | 'care') => {
    const ex = employee.exemptionDetails;
    if (!employee.hasExemption || !ex) return false;
    if (!ex.targetInsurances?.includes(type)) return false;
    if (!applicableMonth) return false;
    return (
      (!ex.startMonth || ex.startMonth <= applicableMonth) &&
      (!ex.endMonth || applicableMonth <= ex.endMonth)
    );
  };

  // ✅ 制度準拠の保険適用判定（誕生日×対象月）
  const isInsuranceApplicableByAge = (
    birthDate: string,
    month: string,
    startAge: number,
    endAge?: number
  ): boolean => {
    const dob = new Date(birthDate);
    const birthDayBefore = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate() - 1);
    const startMonth = new Date(birthDayBefore.getFullYear() + startAge, birthDayBefore.getMonth(), 1);
    const endMonth = endAge !== undefined
      ? new Date(birthDayBefore.getFullYear() + endAge, birthDayBefore.getMonth(), 1)
      : null;
    const target = new Date(`${month}-01`);
    return (!isNaN(target.getTime())) &&
           target >= startMonth &&
           (!endMonth || target < endMonth);
  };

  const birth = employee.birthday ?? '';
  const month = applicableMonth ?? '';

  const isHealthApplicable = applicableMonth && birth
    ? isInsuranceApplicableByAge(birth, month, 0, 75)
    : employee.healthInsuranceStatus === '加入';

  const isPensionApplicable = applicableMonth && birth
    ? isInsuranceApplicableByAge(birth, month, 0, 70)
    : employee.pensionStatus === '加入';

  const isCareApplicable = applicableMonth && birth
    ? isInsuranceApplicableByAge(birth, month, 40, 65) && isHealthApplicable
    : employee.careInsuranceStatus?.startsWith('加入') && employee.healthInsuranceStatus === '加入';

  // 保険料計算
  if (isHealthApplicable) {
    result.health = isExempted('health')
      ? { employee: 0, company: 0, total: 0 }
      : calc(rates.health, standardBonusAmount);
  }

  if (isPensionApplicable) {
    result.pension = isExempted('pension')
      ? { employee: 0, company: 0, total: 0 }
      : calc(rates.pension, standardBonusAmount);
  }

  if (isCareApplicable) {
    result.care = isExempted('care')
      ? { employee: 0, company: 0, total: 0 }
      : calc(rates.care, standardBonusAmount);
  }

  return result;
}

export function calculateBonusPremiumsForEmployee(
  employee: Employee,
  company: Company,
  ratesTable: Record<string, InsuranceRates>
): BonusPremiumRecord[] {
  if (!employee.bonusRecords || !company.prefecture) return [];

  const bonusPremiums: BonusPremiumRecord[] = [];
  const fiscalYearMap: Record<number, number> = {};

  const getFiscalYear = (dateStr: string): number => {
    const d = new Date(`${dateStr}-01`);
    return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  };

  const defaultRates = ratesTable[company.prefecture];

  const rates: InsuranceRates =
    company.healthType === '組合健保' && company.customRates
      ? {
          health: {
            employee: parseFloat(company.customRates.health?.employee ?? '0'),
            company: parseFloat(company.customRates.health?.company ?? '0'),
          },
          pension: defaultRates.pension,
          care: {
            employee: parseFloat(company.customRates.care?.employee ?? '0'),
            company: parseFloat(company.customRates.care?.company ?? '0'),
          },
        }
      : defaultRates;

  for (const bonus of employee.bonusRecords) {
    const bonusId = bonus.bonusId ?? bonus.applicableMonth;
    const now = new Date().toISOString();

    if (bonus.includedInStandardBonus) {
      bonusPremiums.push({
        bonusId,
        empNo: employee.empNo,
        companyId: company.companyId,
        applicableDate: now,
        applicableMonth: bonus.applicableMonth,
        calculatedAt: now,
        standardBonusAmount: Math.floor((bonus.amount || 0) / 1000) * 1000,
        health: null,
        pension: null,
        care: null,
      });
      continue;
    }

    const fiscalYear = getFiscalYear(bonus.applicableMonth);
    const currentTotal = fiscalYearMap[fiscalYear] ?? 0;
    const cappedPerBonus = Math.min(bonus.amount, 1_500_000);
    const remaining = Math.max(5_730_000 - currentTotal, 0);
    const applicableBonusRaw = Math.min(cappedPerBonus, remaining);
    const applicableBonus = Math.floor(applicableBonusRaw / 1000) * 1000;

    fiscalYearMap[fiscalYear] = currentTotal + cappedPerBonus;

    if (applicableBonus <= 0) {
      bonusPremiums.push({
        bonusId,
        empNo: employee.empNo,
        companyId: company.companyId,
        applicableDate: now,
        applicableMonth: bonus.applicableMonth,
        calculatedAt: now,
        standardBonusAmount: 0,
        health: { employee: 0, company: 0, total: 0 },
        pension: { employee: 0, company: 0, total: 0 },
        care: (() => {
          const birth = employee.birthday ?? '';
          const month = bonus.applicableMonth ?? '';
          const isInsuranceApplicableByAge = (
            birthDate: string,
            month: string,
            startAge: number,
            endAge?: number
          ): boolean => {
            const dob = new Date(birthDate);
            const birthDayBefore = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate() - 1);
            const startMonth = new Date(birthDayBefore.getFullYear() + startAge, birthDayBefore.getMonth(), 1);
            const endMonth = endAge !== undefined
              ? new Date(birthDayBefore.getFullYear() + endAge, birthDayBefore.getMonth(), 1)
              : null;
            const target = new Date(`${month}-01`);
            return (!isNaN(target.getTime())) &&
                   target >= startMonth &&
                   (!endMonth || target < endMonth);
          };
        
          const isCareApplicable = birth && isInsuranceApplicableByAge(birth, month, 40, 65);
        
          return isCareApplicable
            ? { employee: 0, company: 0, total: 0 }
            : null;
        })(),
      });
      continue;
    }

    const premium = calculateBonusPremium(
      applicableBonus,
      employee,
      company,
      rates,
      false,
      bonus.applicableMonth
    );

    if (!premium) continue;

    bonusPremiums.push({
      bonusId,
      empNo: employee.empNo,
      companyId: company.companyId,
      applicableDate: now,
      applicableMonth: bonus.applicableMonth,
      calculatedAt: now,
      standardBonusAmount: premium.standardBonusAmount,
      health: premium.health ?? null,
      pension: premium.pension ?? null,
      care: premium.care ?? null,
    });
  }

  return bonusPremiums;
}


export function getAverageStandardMonthlyAmount(
  incomeRecords: IncomeRecord[],
  employee: Employee,
  company: Company,
  ratesTable: Record<string, InsuranceRates>,
  healthGrades: SalaryGrade[],
  pensionGrades: SalaryGrade[]
): AverageCalculationResult {
  const bonuses = employee.bonusRecords ?? [];

  const fallbackRates: InsuranceRates = {
    health: { employee: 0, company: 0 },
    pension: { employee: 0, company: 0 },
    care: { employee: 0, company: 0 }
  };

  const defaultRates = company.prefecture && ratesTable[company.prefecture]
  ? ratesTable[company.prefecture]
  : fallbackRates;

  const rates: InsuranceRates =
  company.healthType === '組合健保' && company.customRates
    ? {
        health: {
          employee: parseFloat(company.customRates.health?.employee ?? '0'),
          company: parseFloat(company.customRates.health?.company ?? '0')
        },
        pension: defaultRates.pension,
        care: {
          employee: parseFloat(company.customRates.care?.employee ?? '0'),
          company: parseFloat(company.customRates.care?.company ?? '0')
        }
      }
    : defaultRates;

    const records = incomeRecords.map(income => {
      const bonusMonthlyEquivalent = bonuses
        .filter(b => b.applicableMonth === income.applicableMonth && b.includedInStandardBonus)
        .reduce((sum, b) => sum + b.amount / 12, 0);
    
      const premium = calculateInsurancePremiums(
        income.totalMonthlyIncome,
        employee,
        company,
        rates,
        healthGrades,
        pensionGrades,
        bonusMonthlyEquivalent,
        income.applicableMonth
      );
    
      return premium?.standardMonthlyAmount ?? 0;
    });
    
    const averageAmount = Math.round(records.reduce((a, b) => a + b, 0) / records.length);
    
    const latestMonth = incomeRecords
      .map(r => r.applicableMonth)
      .sort((a, b) => b.localeCompare(a))[0] ?? '';
    
    const resultPremium = calculateInsurancePremiums(
      averageAmount,
      employee,
      company,
      rates,
      healthGrades,
      pensionGrades,
      undefined,
      latestMonth
    );    

  return {
    averageAmount,
    healthGrade: resultPremium?.healthGrade ?? null,
    pensionGrade: resultPremium?.pensionGrade ?? null,
    careGrade: resultPremium?.careGrade ?? null
  };
}


interface AverageCalculationResult {
  averageAmount: number;
  healthGrade: number | null;
  pensionGrade: number | null;
  careGrade: number | null;
}

export function shouldTriggerRevisedInsurance(
  currentGrade: number | null | undefined,
  averageGrade: number | null | undefined
): boolean {
  if (
    typeof currentGrade !== 'number' ||
    typeof averageGrade !== 'number'
  ) return false;

  return Math.abs(averageGrade - currentGrade) >= 2;
}

export function isShortTimeEmployee(employee: Employee, company: Company): boolean {
  if (!employee.weeklyHours || !company.standardWeeklyHours) return false;
  return employee.weeklyHours < company.standardWeeklyHours;
}

export function satisfiesMinimumWorkDays(
  incomeRecords: IncomeRecord[],
  employee: Employee,
  company: Company
): boolean {
  const threshold = isShortTimeEmployee(employee, company) ? 11 : 17;

  return incomeRecords.every(rec => {
    const workDays = rec.workDays ?? rec.workingHoursPerDay ?? 0;
    return workDays >= threshold;
  });
}

export interface RevisedEligibilityCheckResult {
  hasFixedWageChange: boolean;
  hasGradeDifference: boolean;
  meetsWorkDayRequirement: boolean;
  eligible: boolean;
}

export function checkRevisedEligibility(
  incomeRecords: IncomeRecord[],
  employee: Employee,
  company: Company,
  currentHealthGrade: number | null | undefined,
  averageHealthGrade: number | null | undefined
): RevisedEligibilityCheckResult {
  const latestMonth = incomeRecords
  .map(r => r.applicableMonth)
  .sort((a, b) => b.localeCompare(a))[0];

const hasFixed = hasFixedWageChange(incomeRecords, latestMonth);
const hasGradeDiff = shouldTriggerRevisedInsurance(currentHealthGrade, averageHealthGrade);
const meetsWorkDays = satisfiesMinimumWorkDays(incomeRecords, employee, company);

return {
  hasFixedWageChange: hasFixed,
  hasGradeDifference: hasGradeDiff,
  meetsWorkDayRequirement: meetsWorkDays,
  eligible: hasFixed && hasGradeDiff && meetsWorkDays
};
}

export function calculateRevisedInsurancePremium(
  incomeRecords: IncomeRecord[],
  employee: Employee,
  company: Company,
  ratesTable: Record<string, InsuranceRates>,
  healthGrades: SalaryGrade[],
  pensionGrades: SalaryGrade[]
): InsurancePremiumRecord | null {
  if (incomeRecords.length !== 3) return null;

  const bonuses = employee.bonusRecords ?? [];

  const averageAmount = Math.round(
    incomeRecords.reduce((sum, income) => {
      const bonusMonthlyEquivalent = bonuses
        .filter(b => b.applicableMonth === income.applicableMonth && b.includedInStandardBonus)
        .reduce((bSum, b) => bSum + b.amount / 12, 0);

      return sum + (income.totalMonthlyIncome + bonusMonthlyEquivalent);
    }, 0) / 3
  );

  const fallbackRates: InsuranceRates = {
    health: { employee: 0, company: 0 },
    pension: { employee: 0, company: 0 },
    care: { employee: 0, company: 0 }
  };

  const defaultRates =
    company.prefecture && ratesTable[company.prefecture]
      ? ratesTable[company.prefecture]
      : fallbackRates;

  const rates: InsuranceRates =
    company.healthType === '組合健保' && company.customRates
      ? {
          health: {
            employee: parseFloat(company.customRates.health?.employee ?? '0'),
            company: parseFloat(company.customRates.health?.company ?? '0')
          },
          pension: defaultRates.pension,
          care: {
            employee: parseFloat(company.customRates.care?.employee ?? '0'),
            company: parseFloat(company.customRates.care?.company ?? '0')
          }
        }
      : defaultRates;

  const applicableMonth = incomeRecords[2].applicableMonth;

  const premium = calculateInsurancePremiums(
    averageAmount,
    employee,
    company,
    rates,
    healthGrades,
    pensionGrades,
    undefined,
    applicableMonth
  );

  return premium ?? null;
}











