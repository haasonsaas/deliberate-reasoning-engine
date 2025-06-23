# Example: Systematic Debugging

This example shows how DRE can structure debugging and root cause analysis.

## Scenario
Production API is experiencing intermittent 500 errors affecting 5% of requests.

## Reasoning Process

### 1. Define the Problem
```javascript
{
  "thought": "Diagnose and fix intermittent 500 errors in production API",
  "thought_type": "objective"
}
```

### 2. Form Initial Hypotheses
```javascript
{
  "thought": "Database connection pool exhaustion during peak loads",
  "thought_type": "hypothesis",
  "dependencies": ["<objective_id>"],
  "confidence": 0.8
}

{
  "thought": "Memory leak in request handler causing OOM errors",
  "thought_type": "hypothesis",
  "dependencies": ["<objective_id>"],
  "confidence": 0.6
}

{
  "thought": "Race condition in authentication middleware",
  "thought_type": "hypothesis",
  "dependencies": ["<objective_id>"],
  "confidence": 0.4
}
```

### 3. Make Testable Assumptions
```javascript
{
  "thought": "Errors correlate with high traffic periods",
  "thought_type": "assumption",
  "dependencies": ["<db_hypothesis_id>"],
  "confidence": 0.9
}

{
  "thought": "Memory usage increases linearly with uptime",
  "thought_type": "assumption",
  "dependencies": ["<memory_hypothesis_id>"],
  "confidence": 0.7
}
```

### 4. Define Investigation Steps
```javascript
{
  "thought": "Analyze error logs for timing patterns",
  "thought_type": "sub_problem",
  "dependencies": ["<traffic_assumption_id>"]
}

{
  "thought": "Monitor memory usage over 24-hour period",
  "thought_type": "sub_problem",
  "dependencies": ["<memory_assumption_id>"]
}
```

### 5. Gather Evidence
```javascript
{
  "thought": "Error logs show: 80% of 500s occur between 2-4 PM (peak hours)",
  "thought_type": "evidence",
  "dependencies": ["<log_analysis_id>"]
}

{
  "thought": "Memory usage stable at 2GB regardless of uptime",
  "thought_type": "evidence",
  "dependencies": ["<memory_monitoring_id>"]
}

{
  "thought": "Database shows: connection pool hitting max (20) during errors",
  "thought_type": "evidence",
  "dependencies": ["<db_hypothesis_id>"]
}
```

### 6. Invalidate Disproven Assumptions
```javascript
{
  "thought_id": "<memory_assumption_id>",
  "reason": "Memory usage remains constant, not increasing with uptime"
}
// This marks the memory leak hypothesis branch as stale
```

### 7. Synthesize Root Cause
```javascript
{
  "thought": "Root cause: DB connection pool size (20) insufficient for peak traffic",
  "thought_type": "synthesis",
  "dependencies": ["<db_evidence_id>", "<timing_evidence_id>"]
}
```

### 8. Plan Fix
```javascript
{
  "thought": "Increase connection pool size to 50 and implement connection queuing",
  "thought_type": "action",
  "dependencies": ["<synthesis_id>"],
  "action_request": {
    "tool": "config_update",
    "parameters": {
      "db_pool_size": 50,
      "enable_queue": true
    }
  }
}
```

## Benefits of Structured Debugging

- **Systematic approach**: No hypothesis is forgotten
- **Evidence-based**: Assumptions are validated with data
- **Efficient**: Dead-end investigations are pruned early
- **Knowledge capture**: Debugging process is documented for future reference
- **Team collaboration**: Others can see the reasoning and contribute