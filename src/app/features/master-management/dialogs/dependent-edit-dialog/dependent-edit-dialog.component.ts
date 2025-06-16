import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material/material.module';
import { Dependent } from '../../../../core/models/dependent.model';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-dependent-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './dependent-edit-dialog.component.html',
  styleUrls: ['./dependent-edit-dialog.component.scss']
})
export class DependentEditDialogComponent implements OnInit {
  @Input() companyId!: string;
  @Input() empNo!: string;
  @Input() dependents: any[] = [];
  @Output() dependentsChange = new EventEmitter<any[]>();

  newDependent: Dependent = {
    name: '',
    relation: '',
    birthday: null,
    livesTogether: false,
    income: null
  };

  constructor(private firestoreService: FirestoreService, private snackbar: MatSnackBar) {}

  editIndex: number = -1;


  async ngOnInit(): Promise<void> {
    if (this.companyId && this.empNo) {
      this.dependents = await this.firestoreService.getDependents(this.companyId, this.empNo);
    }
  }

  addDependent(form: NgForm): void {
    if (form.invalid) return;

    this.dependents.push({ ...this.newDependent });

    this.newDependent = {
      name: '',
      relation: '',
      birthday: null,
      livesTogether: false,
      income: null
    };

    form.resetForm();
  }

  editDependent(index: number) {
    const dep = this.dependents[index];
    this.newDependent = {
      ...dep,
      birthday: dep.birthday ? new Date(dep.birthday) : null
    };
    this.dependents.splice(index, 1);
  }

  save(): Dependent[] {
    return this.dependents.map(dep => ({
      ...dep,
      birthday: dep.birthday ? new Date(dep.birthday).toISOString() : null
    }));
  }

  removeDependent(index: number): void {
    const dep = this.dependents[index];
  
    const birthdayStr = dep.birthday instanceof Date
      ? dep.birthday.toISOString()
      : new Date(dep.birthday).toISOString();
  
    const id = `${dep.name}_${birthdayStr}`;
    
    this.firestoreService.deleteDependent(this.companyId, this.empNo, id)
      .then(() => {
        this.dependents.splice(index, 1);
      })
      .catch(err => {
        console.error('❌ 扶養者の削除に失敗しました', err);
        this.snackbar.open('扶養者の削除に失敗しました', '閉じる', { duration: 3000 });
      });
  }
  
  saveEditedDependent(index: number): void {
    if (index < 0 || !this.newDependent.name) return;
  
    // 編集した内容を反映
    this.dependents[index] = { ...this.newDependent };
  
    // Firestoreへの更新（省略可能：保存時まとめてやる場合）
    // const id = `${this.newDependent.name}_${new Date(this.newDependent.birthday).toISOString()}`;
    // await this.firestoreService.saveDependent(this.companyId, this.empNo, this.newDependent);
  
    // 編集モード解除
    this.editIndex = -1;
  
    // newDependentをクリア
    this.newDependent = {
      name: '',
      relation: '',
      birthday: null,
      livesTogether: false,
      income: null
    };
  }
  
}
