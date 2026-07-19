const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

copyFolderSync(path.join(__dirname, 'src', 'assets'), path.join(__dirname, 'lib', 'assets'));
copyFolderSync(path.join(__dirname, 'src', 'assets'), path.join(__dirname, 'lib', 'src', 'assets'));
console.log('Assets copied successfully.');
