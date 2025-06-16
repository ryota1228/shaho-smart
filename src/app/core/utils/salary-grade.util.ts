export interface SalaryGrade {
    grade: number;
    lower: number;
    upper: number | string;
    monthly: number;
  }
  
  export function parseSalaryGrades(raw: SalaryGrade[]): SalaryGrade[] {
    return raw.map(g => ({
      ...g,
      upper: g.upper === 'Infinity' ? Number.POSITIVE_INFINITY : Number(g.upper)
    }));
  }
  
  export function determineSalaryGrade(income: number, grades: SalaryGrade[]): SalaryGrade | null {
    return grades.find(g => income >= g.lower && income < (typeof g.upper === 'number' ? g.upper : Number(g.upper))) ?? null;
  }

export function getSalaryGrade(income: number, grades: SalaryGrade[]): SalaryGrade {
  for (const grade of grades) {
    const lower = grade.lower;
    const upper = grade.upper === 'Infinity' ? Infinity : Number(grade.upper);
    if (income >= lower && income < upper) {
      return grade;
    }
  }

  return grades[0];
}

export function getStandardSalaryGrade(
  amount: number,
  gradeTable: SalaryGrade[]
): SalaryGrade | undefined {
  return gradeTable.find(g => {
    const upper = typeof g.upper === 'number' ? g.upper : Number(g.upper);
    return amount >= g.lower && amount < upper;
  });
}

  

  