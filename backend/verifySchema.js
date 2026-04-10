require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');
const config = require('./config/dbConfig');

const EXPECTED = {
  users:               ['id','name','email','password_hash','role','created_at'],
  complaints:          ['id','user_id','category','description','summary','tags','location','image_url',
                        'status','priority','ai_suggested_priority','is_deleted','created_at','updated_at',
                        'assigned_admin_id','resolved_at','is_escalated'],
  complaint_history:   ['id','complaint_id','changed_by','old_status','new_status','note','created_at'],
  complaint_remarks:   ['id','complaint_id','admin_id','remark_text','created_at'],
  notifications:       ['id','user_id','title','message','type','related_complaint_id','is_read','created_at'],
  attachments:         ['id','complaint_id'],
};

async function verify() {
  const conn = await mysql.createConnection(config);
  let allOk = true;

  for (const [table, required] of Object.entries(EXPECTED)) {
    const [rows] = await conn.query(`DESCRIBE \`${table}\``);
    const existing = rows.map(r => r.Field);
    const missing  = required.filter(c => !existing.includes(c));

    if (missing.length === 0) {
      console.log(`✅  ${table} — all columns present`);
    } else {
      console.log(`❌  ${table} — MISSING: ${missing.join(', ')}`);
      allOk = false;
    }
  }

  await conn.end();
  console.log(allOk ? '\n🎉 Schema is complete!' : '\n⚠️  Schema has gaps — run fixes above.');
}

verify().catch(e => { console.error('Error:', e.message); process.exit(1); });
