# AI Complaint Intelligence Module - Example Responses

## Example AI Service Response Structure

### Function: `analyzeComplaint(description)`

**Input:**
```javascript
const description = "Garbage bins in the area are overflowing and have not been cleared for the past three days. The smell is spreading, and stray animals are scattering waste across the road. Request immediate cleaning and regular maintenance.";
```

**Output:**
```javascript
{
  summary: "Garbage bins overflowing for three days causing odor and animal scattering waste",
  tags: ["garbage", "overflow", "sanitation", "waste", "cleaning"],
  ai_suggested_priority: "High"
}
```

---

## Example Complaint Submission Flow

### Request

```http
POST /complaints
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "category": "Garbage",
  "description": "Garbage bins in the area are overflowing and have not been cleared for the past three days. The smell is spreading, and stray animals are scattering waste across the road. Request immediate cleaning and regular maintenance.",
  "location": "Street No. 5, Near Community Park, Narsapur"
}
```

### AI Analysis (Internal)

**AI Service Call:**
```javascript
const aiData = await analyzeComplaint(description);
```

**AI Response:**
```json
{
  "summary": "Garbage bins overflowing for three days causing odor and animal scattering waste",
  "tags": ["garbage", "overflow", "sanitation", "waste", "cleaning"],
  "ai_suggested_priority": "High"
}
```

### Database Insert

**SQL Query:**
```sql
INSERT INTO complaints (
  user_id, 
  category, 
  description, 
  location, 
  status, 
  priority, 
  summary, 
  tags, 
  ai_suggested_priority
) VALUES (
  1,
  'Garbage',
  'Garbage bins in the area are overflowing...',
  'Street No. 5, Near Community Park, Narsapur',
  'Submitted',
  'Medium',
  'Garbage bins overflowing for three days causing odor and animal scattering waste',
  '["garbage", "overflow", "sanitation", "waste", "cleaning"]',
  'High'
);
```

### API Response

```json
{
  "success": true,
  "duplicate": false,
  "complaintId": "COMP-0025",
  "reportsCount": 1,
  "escalated": false,
  "escalationLevel": "Medium",
  "message": "Complaint submitted. Total reports for this location: 1."
}
```

**Note:** The API response doesn't include AI data (as per existing design). AI data is stored in the database and can be retrieved via GET endpoints.

---

## Example Database Records

### Record with AI Data

```sql
SELECT 
  id,
  complaint_id,
  category,
  description,
  summary,
  tags,
  priority,
  ai_suggested_priority,
  status
FROM complaints
WHERE id = 25;
```

**Result:**
```
id: 25
complaint_id: COMP-0025
category: Garbage
description: Garbage bins in the area are overflowing and have not been cleared for the past three days...
summary: Garbage bins overflowing for three days causing odor and animal scattering waste
tags: ["garbage", "overflow", "sanitation", "waste", "cleaning"]
priority: Medium
ai_suggested_priority: High
status: Submitted
```

### Record without AI Data (AI Failed)

```sql
SELECT 
  id,
  complaint_id,
  category,
  description,
  summary,
  tags,
  priority,
  ai_suggested_priority,
  status
FROM complaints
WHERE id = 26;
```

**Result:**
```
id: 26
complaint_id: COMP-0026
category: Water
description: Water supply interrupted since yesterday...
summary: NULL
tags: NULL
priority: Medium
ai_suggested_priority: NULL
status: Submitted
```

---

## Example Scenarios

### Scenario 1: Critical Issue (Flooding)

**Input:**
```
"Severe flooding in residential area due to blocked drainage. Water level rising rapidly. Multiple houses affected. Immediate action required."
```

**AI Output:**
```json
{
  "summary": "Severe flooding from blocked drainage affecting multiple houses with rising water levels",
  "tags": ["flooding", "drainage", "water", "emergency", "residential"],
  "ai_suggested_priority": "Critical"
}
```

### Scenario 2: Low Priority Issue (Streetlight)

**Input:**
```
"One streetlight is not working on Main Street near the park. It's been off for a few days."
```

**AI Output:**
```json
{
  "summary": "Single streetlight non-functional on Main Street near park for several days",
  "tags": ["streetlight", "lighting", "infrastructure", "maintenance"],
  "ai_suggested_priority": "Low"
}
```

### Scenario 3: Medium Priority Issue (Pothole)

**Input:**
```
"Large pothole on Highway 101 near exit 5. It's causing traffic slowdowns and vehicle damage. Reported last week but not fixed."
```

**AI Output:**
```json
{
  "summary": "Large pothole on Highway 101 causing traffic issues and vehicle damage, unrepaired after week",
  "tags": ["pothole", "road", "traffic", "highway", "infrastructure"],
  "ai_suggested_priority": "Medium"
}
```

### Scenario 4: High Priority Issue (Water Supply)

**Input:**
```
"No water supply in entire neighborhood for 48 hours. Residents unable to cook, clean, or drink. Water department not responding to calls."
```

**AI Output:**
```json
{
  "summary": "Complete water supply disruption for 48 hours affecting entire neighborhood with no response",
  "tags": ["water", "supply", "disruption", "residential", "emergency"],
  "ai_suggested_priority": "High"
}
```

---

## JSON Tags Format

The `tags` column stores data as JSON string in MySQL:

**In Database (JSON string):**
```json
"[\"garbage\", \"overflow\", \"sanitation\", \"waste\", \"cleaning\"]"
```

**When Retrieved (Parsed):**
```javascript
const tags = JSON.parse(complaint.tags);
// Result: ["garbage", "overflow", "sanitation", "waste", "cleaning"]
```

**Example Query:**
```sql
SELECT 
  id,
  JSON_EXTRACT(tags, '$[0]') as first_tag,
  JSON_LENGTH(tags) as tag_count
FROM complaints
WHERE tags IS NOT NULL;
```

---

## Priority Comparison

### Actual Priority vs AI Suggested Priority

| Complaint ID | Actual Priority | AI Suggested Priority | Reason for Difference |
|--------------|----------------|----------------------|----------------------|
| COMP-0025 | Medium | High | AI considers severity; actual priority uses report-count escalation |
| COMP-0030 | High | High | Both systems agree |
| COMP-0035 | Medium | Critical | AI sees urgency; actual priority hasn't reached escalation threshold yet |

**Key Point:** AI suggestion is informational and doesn't override existing escalation logic.

---

## Error Scenarios

### Scenario: AI Service Fails

**Console Output:**
```
✅ Validation passed - Proceeding with AI analysis...

🤖 === AI COMPLAINT ANALYSIS ===
   Analyzing complaint description...
❌ Error in AI complaint analysis: OPENAI_API_KEY environment variable is not set
⚠️ AI analysis failed, continuing without AI data: OPENAI_API_KEY environment variable is not set
   Complaint will be saved without AI-generated summary, tags, or priority suggestion

➕ === INSERTING NEW COMPLAINT ===
   Status: Submitted
   Priority: Medium
✅ New complaint inserted successfully with ID: 27
```

**Database Record:**
```
id: 27
summary: NULL
tags: NULL
ai_suggested_priority: NULL
priority: Medium  (from escalation logic)
```

**API Response:** (unchanged, success)
```json
{
  "success": true,
  "complaintId": "COMP-0027",
  "message": "Complaint submitted. Total reports for this location: 1."
}
```

---

## Testing Examples

### Test Case 1: Successful AI Analysis

```javascript
const { analyzeComplaint } = require('./services/aiService');

async function test1() {
  const result = await analyzeComplaint(
    "Street lights have been non-functional for the past week, making the area unsafe at night."
  );
  console.log(result);
  // Expected:
  // {
  //   summary: "Street lights non-functional for week creating safety concerns",
  //   tags: ["streetlight", "lighting", "safety", "infrastructure"],
  //   ai_suggested_priority: "Medium" or "High"
  // }
}
```

### Test Case 2: Empty Description

```javascript
try {
  await analyzeComplaint("");
} catch (error) {
  console.log(error.message);
  // Expected: "Invalid complaint description provided"
}
```

### Test Case 3: Missing API Key

```javascript
// Without OPENAI_API_KEY set
try {
  await analyzeComplaint("Test complaint");
} catch (error) {
  console.log(error.message);
  // Expected: "OPENAI_API_KEY environment variable is not set"
}
```

---

## Integration with Existing Endpoints

### GET /complaints/:id

**Response (with AI data):**
```json
{
  "success": true,
  "complaint": {
    "id": 25,
    "complaint_id": "COMP-0025",
    "category": "Garbage",
    "description": "Garbage bins in the area are overflowing...",
    "location": "Street No. 5, Near Community Park, Narsapur",
    "status": "Submitted",
    "priority": "Medium",
    "summary": "Garbage bins overflowing for three days causing odor and animal scattering waste",
    "tags": ["garbage", "overflow", "sanitation", "waste", "cleaning"],
    "ai_suggested_priority": "High",
    "created_at": "2026-02-22T10:30:00.000Z"
  }
}
```

### GET /complaints/my

**Response (with AI data):**
```json
{
  "success": true,
  "complaints": [
    {
      "id": 25,
      "complaint_id": "COMP-0025",
      "category": "Garbage",
      "summary": "Garbage bins overflowing for three days...",
      "tags": ["garbage", "overflow", "sanitation"],
      "ai_suggested_priority": "High",
      "priority": "Medium",
      "status": "Submitted"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 1
  }
}
```
