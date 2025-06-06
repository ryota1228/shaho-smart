import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms'; // ✅ NgFormを追加
import { MaterialModule } from '../../../../shared/material/material.module';
import { Dependent } from '../../../../core/models/dependent.model';
import { FirestoreService } from '../../../../core/services/firestore.service';

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

  constructor(private firestoreService: FirestoreService) {}

  async ngOnInit(): Promise<void> {
    if (this.companyId && this.empNo) {
      this.dependents = await this.firestoreService.getDependents(this.companyId, this.empNo);
    }
  }

  // ✅ バリデーション付き addDependent
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

    form.resetForm(); // ✅ 入力値とバリデーション状態を初期化
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
    return this.dependents;
  }
}
