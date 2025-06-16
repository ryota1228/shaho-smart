import { IncomeRecord } from '../models/income-record.model';
import { BonusRecord } from '../models/employee.model';

/**
 * 平均報酬月額を算出（賞与按分込み）
 * 
 * @param incomeRecords 直近3か月の報酬記録
 * @param bonuses 対象期間中の賞与一覧（includedInStandardBonus === true のみ対象）
 * @returns 月額平均（円単位）
 */
export function calculateAverageMonthlyWage(
  incomeRecords: IncomeRecord[],
  bonuses: BonusRecord[]
): number {
  const totalBase = incomeRecords.reduce((sum, record) => sum + (record.totalMonthlyIncome ?? 0), 0);

  // includedInStandardBonus の賞与のみを対象にする
  const proratedBonuses = bonuses
    .filter(b => b.includedInStandardBonus)
    .reduce((sum, b) => sum + (b.amount ?? 0), 0);

  const proratedBonusPerMonth = proratedBonuses / 3;

  return Math.floor((totalBase + proratedBonusPerMonth) / 3);
}
