import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-csv-guide-dialog',
  imports: [CommonModule, MatDialogModule, MatTableModule],
  templateUrl: './csv-guide-dialog.component.html'
})
export class CsvGuideDialogComponent {
  displayedColumns: string[] = ['field', 'type', 'format', 'note'];

  requiredFields = [
    { field: 'empNo', type: '文字列', format: '半角英数', note: '社員番号。重複不可' },
    { field: 'lastName', type: '文字列', format: '例: 山田', note: '姓' },
    { field: 'firstName', type: '文字列', format: '例: 太郎', note: '名' },
    { field: 'lastNameKana', type: 'カタカナ', format: '例: ヤマダ', note: '姓カナ' },
    { field: 'firstNameKana', type: 'カタカナ', format: '例: タロウ', note: '名カナ' },
    { field: 'email', type: 'メール形式', format: 'xxx@example.com', note: 'アカウント作成に使用' },
    { field: 'password', type: '文字列', format: '6文字以上', note: '初期ログインパスワード' },
    { field: 'employmentType', type: '文字列', format: '例: 正社員', note: '雇用区分' },
    { field: 'expectedDuration', type: '文字列', format: 'within2Months / over2Months / indefinite', note: '契約期間の見込み' },
    { field: 'weeklyHours', type: '数値', format: '例: 40', note: '週所定労働時間' },
    { field: 'joinDate', type: '日付', format: 'YYYY-MM-DD (例: 2023-04-01)', note: '入社日' },
    { field: 'birthday', type: '日付', format: 'YYYY-MM-DD (例: 1990-01-01)', note: '生年月日' },
    { field: 'studentStatus', type: '選択肢', format: 'none / daytime / nighttime / correspondence', note: '学生区分' },
  ];
  
  optionalFields = [
    { field: 'gender', type: '選択肢', format: 'male / female / other', note: '性別' },
    { field: 'salaryType', type: '選択肢', format: '月給 / 日給 / 時給', note: '給与形態' },
    { field: 'note', type: '文字列', format: '自由記述', note: '備考' }
  ];  
}
