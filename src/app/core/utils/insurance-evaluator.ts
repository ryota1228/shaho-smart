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

export function evaluateInsuranceStatus(
  employee: Employee,
  company: Company,
  latestIncome?: { totalMonthlyIncome?: number }
): Partial<Employee> {

  const health = evaluateHealthInsurance(employee, company, latestIncome);
  const pension = evaluatePension(employee, company, latestIncome);

  const care = evaluateCareInsurance({
    ...employee,
    ...health
  });

  return {
    ...health,
    ...pension,
    ...care
  };
}



function evaluateHealthInsurance(employee: Employee, company: Company, latestIncome?: { totalMonthlyIncome?: number }): Partial<Employee> {
  console.log(`▶ 健康保険判定開始 for ${employee.empNo}`);

  const reasons: string[] = [];

  const isApplicable = company.isApplicableToHealthInsurance ?? false;
  const employmentType = (employee.employmentType ?? '').trim();
  const isRegular = ['正社員', '契約社員', '嘱託社員'].includes(employmentType);

  console.log(`- 適用事業所: ${isApplicable}`);
  console.log(`- 雇用区分: ${employmentType} / 常用雇用 = ${isRegular}`);

  if (!isApplicable) {
    reasons.push('適用事業所ではない');
  } else if (!isRegular) {
    const weeklyOK = employee.weeklyHours >= 20;
    const durationOK = employee.expectedDuration !== 'within2Months';
    const isStudent = employee.studentStatus !== 'none';
    const isShort = employee.weeklyHours < 30;
    const enoughPeople = (company.totalEmployeeCount ?? 0) >= 51;
    const monthlyIncomeOK = (latestIncome?.totalMonthlyIncome ?? 0) >= 88000;

    console.log(`- 週勤務時間: ${employee.weeklyHours} → OK=${weeklyOK}`);
    console.log(`- 雇用期間: ${employee.expectedDuration} → OK=${durationOK}`);
    console.log(`- 学生: ${employee.studentStatus} → isStudent=${isStudent}`);
    console.log(`- 従業員数: ${company.totalEmployeeCount} → enoughPeople=${enoughPeople}`);

    if (!weeklyOK) reasons.push('週20時間未満');
    if (!durationOK) reasons.push('雇用期間が2か月以内');
    if (isStudent) reasons.push('学生');
    if (isShort && !enoughPeople) reasons.push('従業員数が50人以下');
    if (!monthlyIncomeOK) reasons.push('月収8.8万円未満');
  }

  const status = reasons.length === 0 ? '加入' : '対象外';

  console.log(`▶ 判定結果: ${status} ${reasons.length > 0 ? '(' + reasons.join(' / ') + ')' : ''}`);

  return {
    healthInsuranceStatus: status,
    healthInsuranceReason: reasons.join('・')
  };
}

function evaluatePension(employee: Employee, company: Company, latestIncome?: { totalMonthlyIncome?: number }): Partial<Employee> {
  console.log(`▶ 厚生年金保険判定開始 for ${employee.empNo}`);

  const reasons: string[] = [];

  const isApplicable = company.isApplicableToPension ?? false;
  const employmentType = (employee.employmentType ?? '').trim();
  const isRegular = ['正社員', '契約社員', '嘱託社員'].includes(employmentType);
  const age = getAge(employee.birthday);

  console.log(`- 適用事業所: ${isApplicable}`);
  console.log(`- 雇用区分: ${employmentType} → 常用雇用 = ${isRegular}`);
  console.log(`- 年齢: ${age}`);

  if (!isApplicable) {
    reasons.push('適用事業所ではない');
  } else if (!isRegular) {
    const weeklyOK = employee.weeklyHours >= 20;
    const durationOK = employee.expectedDuration !== 'within2Months';
    const isStudent = employee.studentStatus !== 'none';
    const isShort = employee.weeklyHours < 30;
    const enoughPeople = (company.totalEmployeeCount ?? 0) >= 51;
    const monthlyIncomeOK = (latestIncome?.totalMonthlyIncome ?? 0) >= 88000;

    console.log(`- 週勤務時間: ${employee.weeklyHours} → OK=${weeklyOK}`);
    console.log(`- 雇用期間: ${employee.expectedDuration} → OK=${durationOK}`);
    console.log(`- 学生: ${employee.studentStatus} → isStudent=${isStudent}`);
    console.log(`- 従業員数: ${company.totalEmployeeCount} → enoughPeople=${enoughPeople}`);

    if (!weeklyOK) reasons.push('週20時間未満');
    if (!durationOK) reasons.push('雇用期間が2か月以内');
    if (isStudent) reasons.push('学生');
    if (isShort && !enoughPeople) reasons.push('従業員数が50人以下');
    if (!monthlyIncomeOK) reasons.push('月収8.8万円未満');
  }

  if (age >= 70) reasons.push('70歳以上');

  const status = reasons.length === 0 ? '加入' : '対象外';
  console.log(`▶ 判定結果: ${status} ${reasons.length > 0 ? '(' + reasons.join(' / ') + ')' : ''}`);

  return {
    pensionStatus: status,
    pensionReason: reasons.join('・')
  };
}

function evaluateCareInsurance(employee: Employee): Partial<Employee> {
  const age = getAge(employee.birthday);
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










