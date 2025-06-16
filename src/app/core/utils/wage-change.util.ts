import { IncomeRecord } from '../models/income-record.model';

/**
 * 固定的賃金に変動があったかを判定（制度準拠）
 * @param records - 対象3ヶ月の収入記録
 * @param targetMonth - 判定対象となる変動月（最新月）
 */
export function hasFixedWageChange(records: IncomeRecord[], targetMonth: string): boolean {
  const sorted = [...records].sort((a, b) => a.applicableMonth.localeCompare(b.applicableMonth));
  const target = sorted.find(r => r.applicableMonth === targetMonth);

  // targetMonthより前の月のうち、最も新しいものを探す
  const previous = sorted
    .filter(r => r.applicableMonth < targetMonth)
    .sort((a, b) => b.applicableMonth.localeCompare(a.applicableMonth))[0];

  if (!target || !previous) return false;

  // ① 基本給の変化
  const baseChanged = target.baseAmount !== previous.baseAmount;

  // ② 固定的手当の金額または構成の変化（isFixed !== false のみ対象）
  const getFixedAllowances = (record: IncomeRecord) =>
    (record.allowances ?? []).filter(a => a.isFixed !== false);

  const targetAllowances = getFixedAllowances(target).sort((a, b) => a.name.localeCompare(b.name));
  const previousAllowances = getFixedAllowances(previous).sort((a, b) => a.name.localeCompare(b.name));

  if (targetAllowances.length !== previousAllowances.length) return true;

  for (let i = 0; i < targetAllowances.length; i++) {
    if (
      targetAllowances[i].name !== previousAllowances[i].name ||
      targetAllowances[i].amount !== previousAllowances[i].amount
    ) {
      return true;
    }
  }

  return baseChanged;
}
