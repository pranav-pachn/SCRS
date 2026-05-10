const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/prana/Projects/SCRS/frontend';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') || f.endsWith('.js'));

for (const file of files) {
  const fp = path.join(dir, file);
  let content = fs.readFileSync(fp, 'utf8');
  let modified = false;

  const targetStr = "window.location.hostname === '127.0.0.1'";
  const replacementStr = "window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'";

  if (content.includes(targetStr) && !content.includes(replacementStr)) {
    content = content.replace(new RegExp(targetStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementStr);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fp, content);
    console.log('Updated ' + file);
  }
}
