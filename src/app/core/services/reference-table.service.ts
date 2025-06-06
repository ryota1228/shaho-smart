import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SalaryGrade } from '../utils/salary-grade.util';
import { InsuranceRates } from '../utils/calculateInsurancePremiums';
import { Observable, forkJoin } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReferenceTableService {
  constructor(private http: HttpClient) {}

  loadSalaryGrades(): Observable<SalaryGrade[]> {
    return this.http.get<SalaryGrade[]>('assets/data/salary-grade.json');
  }

  loadPensionGrades(): Observable<SalaryGrade[]> {
    return this.http.get<SalaryGrade[]>('assets/data/pension-grade.json');
  }

  loadInsuranceRates(): Observable<Record<string, InsuranceRates>> {
    return this.http.get<Record<string, InsuranceRates>>('assets/data/prefecture-insurance-rates.json');
  }

  loadAll(): Observable<{
    salary: SalaryGrade[];
    pension: SalaryGrade[];
    rates: Record<string, InsuranceRates>;
  }> {
    return forkJoin({
      salary: this.loadSalaryGrades(),
      pension: this.loadPensionGrades(),
      rates: this.loadInsuranceRates()
    });
  }
}
