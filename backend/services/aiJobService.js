const mysql = require('mysql2/promise');
const { analyzeComplaint } = require('./aiService');

const dbPool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  enableKeepAlive: true
});

async function runAnalysis(complaintId, description) {
  if (!complaintId || !description) {
    throw new Error('Invalid AI job payload');
  }

  const aiData = await analyzeComplaint(description);

  await dbPool.execute(
    'UPDATE complaints SET summary = ?, tags = ?, ai_suggested_priority = ? WHERE id = ?',
    [aiData.summary, JSON.stringify(aiData.tags), aiData.ai_suggested_priority, complaintId]
  );

  return {
    id: `complaint:${complaintId}`,
    name: 'analyze-complaint'
  };
}

function enqueueComplaintAnalysis(complaintId, description) {
  // Fire-and-forget keeps complaint submission fast and resilient.
  runAnalysis(complaintId, description)
    .then(() => {
      console.log(`✅ AI analysis stored for complaint ${complaintId}`);
    })
    .catch((err) => {
      console.warn(`⚠️ AI analysis skipped for complaint ${complaintId}:`, err.message);
    });

  return Promise.resolve({
    id: `complaint:${complaintId}`,
    name: 'analyze-complaint'
  });
}

module.exports = {
  enqueueComplaintAnalysis
};
