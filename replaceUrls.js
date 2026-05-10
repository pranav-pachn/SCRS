const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/prana/Projects/SCRS/frontend';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') || f.endsWith('.js'));

const replaceWith = "(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:3000' : 'https://scrs-3rwc.onrender.com')";

for (const file of files) {
  const fp = path.join(dir, file);
  let content = fs.readFileSync(fp, 'utf8');
  let modified = false;

  // Replace exact string definitions like const API_BASE = 'https://...';
  const exactRegex = /(['"])https:\/\/scrs-3rwc\.onrender\.com(?:\/api)?\1/g;
  if (content.match(exactRegex)) {
    content = content.replace(exactRegex, replaceWith);
    modified = true;
  }

  // Replace string combinations like fetch('https://.../auth')
  const strRegex = /(['"])https:\/\/scrs-3rwc\.onrender\.com([^'"]*)\1/g;
  if (content.match(strRegex)) {
    content = content.replace(strRegex, replaceWith + " + '$2'");
    modified = true;
  }

  // Replace template literals like `https://.../auth`
  const tmplRegex = /`https:\/\/scrs-3rwc\.onrender\.com/g;
  if (content.match(tmplRegex)) {
    content = content.replace(tmplRegex, "`${" + replaceWith + "}");
    modified = true;
  }

  // Replace ['https://scrs-3rwc.onrender.com/api/admin', 'https://scrs-3rwc.onrender.com/admin']
  const arrayRegex = /\['https:\/\/scrs-3rwc\.onrender\.com\/api\/admin', 'https:\/\/scrs-3rwc\.onrender\.com\/admin'\]/g;
  if (content.match(arrayRegex)) {
      content = content.replace(arrayRegex, `[${replaceWith} + '/api/admin', ${replaceWith} + '/admin']`);
      modified = true;
  }

  if (modified) {
    fs.writeFileSync(fp, content);
    console.log('Updated ' + file);
  }
}
