const fs = require('fs');
const path = require('path');

const fontDir = path.join(__dirname, 'src/assets/fonts');
const output = path.join(__dirname, 'src/app/pdf/vfs_fonts.ts');

const fontFiles = [
  'NotoSansJP-Regular.ttf',
  'Roboto-Regular.ttf',
  'Roboto-Medium.ttf',
  'Roboto-Italic.ttf',
  'Roboto-MediumItalic.ttf'
];

const vfs = {};

for (const file of fontFiles) {
  const filePath = path.join(fontDir, file);
  const base64 = fs.readFileSync(filePath).toString('base64');
  vfs[file] = base64;
}

const js = `
// AUTO-GENERATED FILE

export const pdfMakeVfs = ${JSON.stringify(vfs, null, 2)};
`;

fs.writeFileSync(output, js.trimStart());
console.log('✅ vfs_fonts.ts was successfully generated!');
