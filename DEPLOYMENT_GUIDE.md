# Quick Start: Deploy Index & Test AI Chat

## IMMEDIATE ACTION REQUIRED

### Step 1: Deploy the Firestore Index (2 minutes)

**Option A: Firebase CLI (Fastest)**
```bash
firebase deploy --only firestore:indexes
```

**Option B: Manual Console**
1. Open [Firebase Console](https://console.firebase.google.com)
2. Project → Firestore → Indexes tab
3. Create index:
   - Collection: `aiChats`
   - Field 1: `projectId` (↑ Ascending)
   - Field 2: `timestamp` (↑ Ascending)

### Step 2: Wait for Index Creation

- ✅ Immediate: If index already exists
- ⏳ 5-15 min: If index is "Building"
- Status: Check in Firestore Console → Indexes

## Testing Checklist

### Test 1: Load Existing Chat (if you have messages)
1. Open browser DevTools → Console
2. Navigate to AI Workspace
3. Check console for: `[useAIChat] ── Snapshot received ──`
4. Verify: Messages appear without `failed-precondition` error

### Test 2: Send New Message
1. Type a message → Send
2. Verify:
   - ✅ Message appears instantly (optimistic)
   - ✅ AI response arrives within 30 seconds
   - ✅ Both appear in chat permanently
3. Refresh page
4. Verify: Messages still there

### Test 3: Realtime Updates
1. Open two browser tabs to same AI Workspace
2. Send message in Tab 1
3. Verify: Message appears in Tab 2 automatically
4. Verify: No manual refresh needed

### Test 4: Error Recovery
1. While testing, check console logs during first ~10 seconds:

```
[useAIChat] ── Attaching listener ──
[useAIChat]   queryPattern: collection("aiChats") -> where("projectId","==",projectId) -> orderBy("timestamp","asc")

# If index not ready (you'll see ONE of these):

# A) If index is building:
[useAIChat] ⚠️ Composite index not yet available
[useAIChat] Retrying in 2000ms (attempt 1/3)
[useAIChat] Retrying listener setup...
# ... waits 4s, 8s, then works

# B) If index is ready:
[useAIChat] ── Snapshot received ──
[useAIChat]   docs count: N
```

## Console Log Reference

### Success Indicators ✅
```
[useAIChat] ── Snapshot received ──
[useAIChat]   docs count    : 5
[useAIChat]   fromCache     : false
[useAIChat]   pendingWrites : false
```

### Problem Indicators ❌
```
[useAIChat] ── Listener ERROR ──
[useAIChat]   code   : failed-precondition
[useAIChat]   message: The query requires an index
```

If you see this after 10 seconds:
1. Check Firestore Console → Indexes → `aiChats`
2. Status should be "Enabled"
3. If "Building", wait 5-15 min and refresh
4. If missing, deploy the index again

## Expected Timeline

| Stage | Time | What's Happening |
|-------|------|-----------------|
| Index Deploy | 0s | Command sent to Firebase |
| Index Building | 0-15m | Firestore creates composite index |
| Index Ready | 15m | Chat queries start working |
| First Chat Load | 15m | Messages appear in UI |
| Realtime Updates | 15m+ | New messages sync automatically |

## Rollback (if needed)

No rollback needed! The fix only adds better error handling. Original code still works.

## Troubleshooting

### Issue: Index not appearing in Console
**Solution**: Wait 1-2 min for console to refresh, then reload page

### Issue: Index shows "Building" for >30 min
**Solution**: 
1. Check quota in Firebase Console
2. Check for errors in Firestore logs
3. Contact Firebase Support if quota exceeded

### Issue: Chat still not loading after index is "Enabled"
**Solution**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check Firestore rules: `allow list: if isAuth();` ✅
4. Verify user is authenticated

## Next Steps After Index Deployment

1. ✅ Deploy index
2. ✅ Wait for "Enabled" status
3. ✅ Test chat loads
4. ✅ Test sending messages
5. ✅ Test refresh persistence
6. ✅ Test realtime updates
7. ✅ Done!

---

**File Location**: `firestore.indexes.json` (already contains correct index definition)

**Changes Made**: `src/lib/useAIChat.ts` (added retry logic + detailed logging)

**Documentation**: `FIRESTORE_INDEX_FIX.md` (full technical details)
