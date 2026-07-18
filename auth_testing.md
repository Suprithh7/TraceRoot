# TraceRoot Auth Testing Playbook

## Test User Setup
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.investigator@example.com',
  name: 'Test Investigator',
  picture: null,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('SESSION_TOKEN=' + sessionToken);
print('USER_ID=' + userId);
"
```

## Verify /api/auth/me
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -s "$API_URL/api/auth/me" -H "Authorization: Bearer $SESSION_TOKEN"
```

## Seed demo cases for the test user
```bash
curl -s -X POST "$API_URL/api/seed" -H "Authorization: Bearer $SESSION_TOKEN"
```

## Browser test — set cookie then visit dashboard
```python
await page.context.add_cookies([{
  "name": "session_token", "value": SESSION_TOKEN,
  "domain": "<preview host>", "path": "/",
  "httpOnly": True, "secure": True, "sameSite": "None",
}])
await page.goto(FRONTEND_URL + "/dashboard")
```

## Cleanup
```bash
mongosh --eval "
use('test_database');
db.users.deleteMany({email: /test\.investigator/});
db.user_sessions.deleteMany({session_token: /test_session_/});
"
```
