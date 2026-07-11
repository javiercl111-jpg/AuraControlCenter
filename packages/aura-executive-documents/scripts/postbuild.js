const fs = require('fs');
const path = require('path');

const esmPkgPath = path.join(__dirname, '../dist/esm/package.json');
fs.mkdirSync(path.dirname(esmPkgPath), { recursive: true });
fs.writeFileSync(esmPkgPath, JSON.stringify({ type: 'module' }, null, 2));
console.log('Generated dist/esm/package.json');
