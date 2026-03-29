# AI Complaint Intelligence Module

## Overview

The AI Complaint Intelligence Module automatically analyzes complaint descriptions using OpenAI's GPT models to:
1. **Summarize** complaints into concise 1-2 line summaries
2. **Extract tags** - Identify 3-5 key civic issue keywords
3. **Suggest priority** - Recommend priority level (Low, Medium, High, Critical) based on severity, urgency, and impact

## Installation

### Step 1: Install Dependencies

```bash
cd backend
npm install openai
```

### Step 2: Set Environment Variable

Add your OpenAI API key to your environment variables:

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="your-api-key-here"
```

**Windows (Command Prompt):**
```cmd
set OPENAI_API_KEY=your-api-key-here
```

**Linux/Mac:**
```bash
export OPENAI_API_KEY="your-api-key-here"
```

**Or create a `.env` file** (recommended for development):
```
OPENAI_API_KEY=your-api-key-here
```

### Step 3: Run Database Migration

Execute the migration script to add the required columns:

```bash
mysql -u root -p scrs < backend/migrations/add_ai_intelligence_columns.sql
```

Or run it manually in MySQL:
```sql
USE scrs;
SOURCE backend/migrations/add_ai_intelligence_columns.sql;
```

## Architecture

### File Structure

```
backend/
├── services/
│   └── aiService.js          # AI analysis service
├── migrations/
│   └── add_ai_intelligence_columns.sql  # Database migration
└── server.js                 # Updated complaint route
```

### Module Flow

```
Complaint Submission
    ↓
Validation
    ↓
[Duplicate Detection] (if implemented)
    ↓
🤖 AI Analysis (NEW)
    ├── Success → Store AI data
    └── Failure → Continue without AI data (graceful degradation)
    ↓
Database Insert
    ↓
Escalation Logic (unchanged)
```

## API Integration

### Service Function

**File:** `services/aiService.js`

**Function:** `analyzeComplaint(description)`

**Returns:**
```javascript
{
  summary: "Short 1-2 line summary",
  tags: ["tag1", "tag2", "tag3"],
  ai_suggested_priority: "Low" | "Medium" | "High" | "Critical"
}
```

**Example Usage:**
```javascript
const { analyzeComplaint } = require('./services/aiService');

try {
  const aiData = await analyzeComplaint("Water pipe burst near school junction");
  console.log(aiData);
  // {
  //   summary: "Water pipe burst near school causing water supply disruption",
  //   tags: ["water", "pipe", "burst", "school", "infrastructure"],
  //   ai_suggested_priority: "High"
  // }
} catch (error) {
  console.error('AI analysis failed:', error);
}
```

## Database Schema

### New Columns Added to `complaints` Table

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `summary` | TEXT | YES | AI-generated concise summary |
| `tags` | JSON | YES | Array of 3-5 key issue tags |
| `ai_suggested_priority` | ENUM('Low','Medium','High','Critical') | YES | AI-suggested priority level |

### Example Data

```sql
SELECT id, description, summary, tags, ai_suggested_priority 
FROM complaints 
WHERE summary IS NOT NULL;

-- Example result:
-- id: 1
-- description: "Water pipe burst near school junction causing flooding"
-- summary: "Water pipe burst near school causing flooding and water supply disruption"
-- tags: ["water", "pipe", "burst", "school", "flooding"]
-- ai_suggested_priority: "High"
```

## Error Handling

The module implements **graceful degradation**:

- ✅ **AI Success**: Complaint is saved with AI-generated summary, tags, and priority suggestion
- ⚠️ **AI Failure**: Complaint is still saved successfully, but AI fields are set to `NULL`
- 🔒 **System Never Crashes**: All AI errors are caught and logged, never blocking complaint submission

### Common Error Scenarios

1. **Missing API Key**
   - Error logged, complaint saved without AI data
   - Set `OPENAI_API_KEY` environment variable

2. **API Rate Limits**
   - Error logged, complaint saved without AI data
   - Consider implementing retry logic or rate limiting

3. **Invalid API Response**
   - Error logged, complaint saved without AI data
   - Check OpenAI API status

4. **Network Issues**
   - Error logged, complaint saved without AI data
   - Check internet connectivity

## Important Notes

### Priority Handling

- **AI Suggested Priority** (`ai_suggested_priority`) is stored separately from the actual `priority` field
- The actual `priority` field is still controlled by existing escalation logic
- AI suggestion does **NOT override** existing priority escalation rules
- AI suggestion is informational only and can be used for:
  - Dashboard analytics
  - Admin review
  - Future ML model training

### Duplicate Detection

- AI analysis happens **after** duplicate detection (if implemented)
- AI analysis does **NOT modify** existing duplicate detection logic
- Both systems work independently

## Testing

### Test AI Service Directly

```javascript
// test-ai.js
const { analyzeComplaint } = require('./services/aiService');

async function test() {
  try {
    const result = await analyzeComplaint(
      "Garbage bins overflowing for three days. Smell spreading and stray animals scattering waste."
    );
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
```

### Test Complaint Submission

Use your existing complaint submission endpoint:

```bash
POST http://localhost:3000/complaints
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "Garbage",
  "description": "Garbage bins overflowing for three days. Smell spreading and stray animals scattering waste.",
  "location": "Main Street, City"
}
```

**Expected Response:**
```json
{
  "success": true,
  "complaintId": "COMP-0001",
  "reportsCount": 1,
  "escalated": false,
  "escalationLevel": "Medium",
  "message": "Complaint submitted. Total reports for this location: 1."
}
```

Check database:
```sql
SELECT id, summary, tags, ai_suggested_priority 
FROM complaints 
WHERE id = LAST_INSERT_ID();
```

## Configuration

### Model Selection

Default model: `gpt-3.5-turbo` (cost-efficient)

To use a different model, edit `services/aiService.js`:
```javascript
const completion = await openai.chat.completions.create({
  model: 'gpt-4', // or 'gpt-4-turbo', 'gpt-3.5-turbo', etc.
  // ...
});
```

### Temperature Setting

Current: `0.3` (lower = more consistent, structured output)

To adjust, edit `services/aiService.js`:
```javascript
temperature: 0.3, // Range: 0.0 (deterministic) to 2.0 (creative)
```

## Cost Considerations

- **GPT-3.5-turbo**: ~$0.0015 per complaint analysis
- **GPT-4**: ~$0.03 per complaint analysis
- Consider implementing caching for similar complaints
- Monitor API usage in OpenAI dashboard

## Future Enhancements

Potential improvements:
1. **Caching**: Cache AI results for similar complaints
2. **Batch Processing**: Process multiple complaints in one API call
3. **Retry Logic**: Automatic retry on transient failures
4. **Rate Limiting**: Implement rate limiting to control costs
5. **Custom Models**: Fine-tune models on complaint data
6. **Multi-language**: Support complaints in multiple languages

## Troubleshooting

### Issue: "OPENAI_API_KEY environment variable is not set"

**Solution:** Set the environment variable before starting the server:
```bash
export OPENAI_API_KEY="your-key"
node server.js
```

### Issue: "Invalid JSON response from AI service"

**Solution:** Check OpenAI API status. The service uses `response_format: { type: 'json_object' }` which should ensure JSON output.

### Issue: Columns don't exist in database

**Solution:** Run the migration script:
```bash
mysql -u root -p scrs < backend/migrations/add_ai_intelligence_columns.sql
```

## Support

For issues or questions:
1. Check error logs in console output
2. Verify OpenAI API key is set correctly
3. Ensure database migration was run successfully
4. Check OpenAI API status page
