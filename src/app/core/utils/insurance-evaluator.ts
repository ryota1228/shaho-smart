import { Employee } from '../models/employee.model';
import { Company } from '../models/company.model';

export function getAge(birthday: string): number {
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

function isApplicableToSpecialOffice(company: Company, employees: Employee[]): boolean {
  const threshold = (company.standardWeeklyHours ?? 40) * 0.75;
  return employees.filter(emp => {
    const age = getAge(emp.birthday);
    const isDaytimeStudent = emp.studentStatus === 'daytime';
    return age < 75 && emp.weeklyHours >= threshold && !isDaytimeStudent;
  }).length >= 51;
}

function countApplicableEmployeesForSpecialOffice(
  employees: Employee[],
  company: Company
): number {
  const standard = company.standardWeeklyHours ?? 40;

  return employees.filter(emp => {
    const age = getAge(emp.birthday);
    const isStudent = emp.studentStatus === 'daytime';
    const isDurationOK = emp.expectedDuration !== 'within2Months';
    const isWorkingEnough = emp.weeklyHours >= standard;
    const isAgeOK = age >= 20 && age < 75;

    return isWorkingEnough && isDurationOK && !isStudent && isAgeOK;
  }).length;
}

export function evaluateInsuranceStatus(
  employee: Employee,
  company: Company,
  latestIncome?: { totalMonthlyIncome?: number },
  allEmployees: Employee[] = [],
  applicableMonth?: string
): Partial<Employee> {
  const health = evaluateHealthInsurance(employee, company, latestIncome, allEmployees, applicableMonth);
  const pension = evaluatePension(employee, company, latestIncome, allEmployees, applicableMonth);
  const care = evaluateCareInsurance({ ...employee, ...health }, applicableMonth);
  return { ...health, ...pension, ...care };
}

function evaluateHealthInsurance(
  employee: Employee,
  company: Company,
  latestIncome?: { totalMonthlyIncome?: number },
  allEmployees: Employee[] = [],
  applicableMonth?: string
): Partial<Employee> {
  console.log(`▶ 健康保険判定開始 for ${employee.empNo}`);

  const reasons: string[] = [];

  const age = applicableMonth
    ? getAgeAtMonth(employee.birthday, applicableMonth)
    : getAge(employee.birthday);

  // ✅ 社会保障協定で除外
  if (employee.excludedBySocialAgreement) {
    return {
      healthInsuranceStatus: '対象外',
      healthInsuranceReason: '社会保障協定による適用除外'
    };
  }

  // ✅ 本人が扶養に入っている
  if (employee.isDependentInsured) {
    return {
      healthInsuranceStatus: '対象外',
      healthInsuranceReason: '本人が扶養に入っている'
    };
  }

  if (age >= 75) {
    reasons.push('75歳以上（後期高齢者医療制度へ移行）');
    return {
      healthInsuranceStatus: '対象外',
      healthInsuranceReason: reasons.join('・')
    };
  }

  const isApplicable =
    company.isApplicableToHealthInsurance ||
    company.voluntaryHealthApplicable;

  const employmentType = (employee.employmentType ?? '').trim();
  const isRegular = ['正社員', '契約社員', '嘱託社員'].includes(employmentType);
  const fullTime = company.standardWeeklyHours ?? 40;
  const isShort = employee.weeklyHours < fullTime * 0.75;

  console.log(`- 年齢: ${age}`);
  console.log(`- 適用事業所: ${company.isApplicableToHealthInsurance} / 任意適用: ${company.voluntaryHealthApplicable}`);
  console.log(`- 雇用区分: ${employmentType} / 常用雇用 = ${isRegular}`);
  console.log(`- フルタイム基準: ${fullTime}h → 実勤務: ${employee.weeklyHours}h → isShort=${isShort}`);

  if (!isApplicable) {
    reasons.push('適用外事業所');
  } else if (!isRegular) {
    const weeklyOK = employee.weeklyHours >= 20;
    const durationOK = employee.expectedDuration !== 'within2Months';
    const isDaytimeStudent = employee.studentStatus === 'daytime';
    const enoughPeople = company.isApplicableToHealthInsurance || isApplicableToSpecialOffice(company, allEmployees);
    const monthlyIncomeOK = (latestIncome?.totalMonthlyIncome ?? 0) >= 88000;

    console.log(`- 雇用期間: ${employee.expectedDuration} → OK=${durationOK}`);
    console.log(`- 学生区分: ${employee.studentStatus} → isDaytimeStudent=${isDaytimeStudent}`);
    console.log(`- 特定適用対象人数満たす: ${enoughPeople}`);

    if (!weeklyOK) reasons.push('週20時間未満');
    if (!durationOK) reasons.push('雇用期間が2か月以内');
    if (isDaytimeStudent) reasons.push('昼間部学生');
    if (isShort && !enoughPeople) reasons.push('従業員数が50人以下');
    if (!monthlyIncomeOK) reasons.push('月収8.8万円未満');
  }

  const status = reasons.length === 0 ? '加入' : '対象外';
  return {
    healthInsuranceStatus: status,
    healthInsuranceReason: reasons.join('・')
  };
}

function evaluatePension(
  employee: Employee,
  company: Company,
  latestIncome?: { totalMonthlyIncome?: number },
  allEmployees: Employee[] = [],
  applicableMonth?: string
): Partial<Employee> {
  console.log(`▶ 厚生年金保険判定開始 for ${employee.empNo}`);

  const reasons: string[] = [];

  const age = applicableMonth
    ? getAgeAtMonth(employee.birthday, applicableMonth)
    : getAge(employee.birthday);

  // ✅ 社会保障協定で除外
  if (employee.excludedBySocialAgreement) {
    return {
      pensionStatus: '対象外',
      pensionReason: '社会保障協定による適用除外'
    };
  }

  if (age >= 70) {
    reasons.push('70歳以上');
  }

  const isApplicable =
    company.isApplicableToPension ||
    company.voluntaryPensionApplicable;

  const employmentType = (employee.employmentType ?? '').trim();
  const isRegular = ['正社員', '契約社員', '嘱託社員'].includes(employmentType);
  const fullTime = company.standardWeeklyHours ?? 40;
  const isShort = employee.weeklyHours < fullTime * 0.75;

  console.log(`- 年齢: ${age}`);
  console.log(`- 適用事業所: ${company.isApplicableToPension} / 任意適用: ${company.voluntaryPensionApplicable}`);
  console.log(`- 雇用区分: ${employmentType} / 常用雇用 = ${isRegular}`);
  console.log(`- フルタイム基準: ${fullTime}h → 実勤務: ${employee.weeklyHours}h → isShort=${isShort}`);

  if (!isApplicable) {
    reasons.push('適用外事業所');
  } else if (!isRegular) {
    const weeklyOK = employee.weeklyHours >= 20;
    const durationOK = employee.expectedDuration !== 'within2Months';
    const isDaytimeStudent = employee.studentStatus === 'daytime';
    const enoughPeople = company.isApplicableToPension || isApplicableToSpecialOffice(company, allEmployees);
    const monthlyIncomeOK = (latestIncome?.totalMonthlyIncome ?? 0) >= 88000;

    console.log(`- 雇用期間: ${employee.expectedDuration} → OK=${durationOK}`);
    console.log(`- 学生区分: ${employee.studentStatus} → isDaytimeStudent=${isDaytimeStudent}`);
    console.log(`- 特定適用対象人数満たす: ${enoughPeople}`);

    if (!weeklyOK) reasons.push('週20時間未満');
    if (!durationOK) reasons.push('雇用期間が2か月以内');
    if (isDaytimeStudent) reasons.push('昼間部学生');
    if (isShort && !enoughPeople) reasons.push('従業員数が50人以下');
    if (!monthlyIncomeOK) reasons.push('月収8.8万円未満');
  }

  const status = reasons.length === 0 ? '加入' : '対象外';
  return {
    pensionStatus: status,
    pensionReason: reasons.join('・')
  };
}

function evaluateCareInsurance(employee: Employee, applicableMonth?: string): Partial<Employee> {
  const age = applicableMonth
    ? getAgeAtMonth(employee.birthday, applicableMonth)
    : getAge(employee.birthday);

  if (employee.excludedBySocialAgreement) {
    return {
      careInsuranceStatus: '対象外',
      careInsuranceReason: '社会保障協定による適用除外'
    };
  }

  if (employee.isDependentInsured) {
    return {
      careInsuranceStatus: '対象外',
      careInsuranceReason: '本人が扶養に入っている'
    };
  }

  const raw = employee.healthInsuranceStatus?.trim() ?? '';
  const isHealthJoined = raw === '加入';

  if (age >= 40 && age < 65) {
    return {
      careInsuranceStatus: isHealthJoined
        ? '加入（第2号）'
        : '加入（第2号/国保）',
      careInsuranceReason: ''
    };
  } else if (age >= 65 && age < 75) {
    return {
      careInsuranceStatus: '加入（第1号）',
      careInsuranceReason: ''
    };
  } else {
    return {
      careInsuranceStatus: '対象外',
      careInsuranceReason: '対象年齢外'
    };
  }
}

export function getAgeAtMonth(birthday: string, targetMonth: string): number {
  const [birthY, birthM, birthD] = birthday.split('-').map(Number);
  const [targetY, targetM] = targetMonth.split('-').map(Number);
  let age = targetY - birthY;
  if (targetM < birthM || (targetM === birthM && 1 < birthD)) {
    age--;
  }
  return age;
}

export function isCareInsuranceApplicable(birthday: string, month: string): boolean {
  const age = getAgeAtMonth(birthday, month);
  return age >= 40 && age < 65;
}

export function isHealthInsuranceApplicable(birthday: string, month: string): boolean {
  const age = getAgeAtMonth(birthday, month);
  return age < 75;
}

export function isPensionApplicable(birthday: string, month: string): boolean {
  const age = getAgeAtMonth(birthday, month);
  return age < 70;
}
