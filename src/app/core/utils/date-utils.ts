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

  export function toJSTMidnightISO(date: Date): string {
    const jstDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0);
    return jstDate.toISOString(); // JST 0時相当のUTC 9時を ISO形式で保存
  }
  
  