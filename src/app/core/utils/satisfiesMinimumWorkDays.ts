import { IncomeRecord } from '../models/income-record.model';
import { Employee } from '../models/employee.model';
import { Company } from '../models/company.model';

/**
 * 要件③：変動月から連続する3か月すべての支払基礎日数が
 * 一般→17日以上／短時間労→11日以上を満たしているか判定
 */
export function satisfiesMinimumWorkDays(
  incomeRecords: IncomeRecord[],
  employee: Employee,
  company: Company
): boolean {
  if (incomeRecords.length < 3) return false;

  // 変動があった月以降の3か月分を年月順に並べ替え
  const sorted = [...incomeRecords]
    .sort((a, b) => a.applicableMonth.localeCompare(b.applicableMonth))
    .slice(-3);

  const threshold = isShortTime(employee, company) ? 11 : 17;

  return sorted.every(rec => (rec.workDays ?? 0) >= threshold);
}

function isShortTime(employee: Employee, company: Company): boolean {
  return employee.weeklyHours < (company.standardWeeklyHours ?? Infinity);
}
