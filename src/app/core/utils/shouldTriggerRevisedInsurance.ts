// shouldTriggerRevisedInsurance.ts

/**
 * 2等級以上の差があれば true を返す（随時改定の等級差基準に該当）
 */
export function shouldTriggerRevisedInsurance(
    currentGrade: number | null | undefined,
    averageGrade: number | null | undefined
  ): boolean {
    if (currentGrade == null || averageGrade == null) return false;
    return Math.abs(currentGrade - averageGrade) >= 2;
  }
  