# Troubleshooting Guide

Solutions to common issues in the Prayer App.

## Table of Contents

- [Build & Development](#build--development)
- [Database Issues](#database-issues)
- [Email Problems](#email-problems)
- [Authentication](#authentication)
- [UI/Display Issues](#uidisplay-issues)
- [Edge Functions](#edge-functions)
- [Performance](#performance)
- [Deployment](#deployment)

## Build & Development

### Module Not Found Errors

**Error**: `Cannot find module 'xyz'`

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Vite Dev Server Won't Start

**Error**: `Port 5173 already in use`

**Solution**:
```bash
# Find and kill process
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

### TypeScript Errors

**Error**: Type errors during build

**Solution**:
```bash
# Check types
npm run type-check

# Common fixes:
# 1. Update imports
# 2. Check null/undefined handling
# 3. Verify interface definitions
```

### Hot Reload Not Working

**Symptoms**: Changes not reflecting in browser

**Solutions**:
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Clear browser cache
3. Restart dev server
4. Check file watcher limits (Linux):
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Database Issues

### Can't Read Table Data

**Error**: Empty array when querying

**Cause**: Row Level Security (RLS) blocking access

**Solution**: Apply RLS fix migrations:

```bash
# In Supabase SQL Editor:
# 1. Run fix_email_subscribers_rls.sql
# 2. Run fix_pending_preference_changes_rls.sql
```

**Verify**:
```sql
SELECT * FROM pg_policies WHERE tablename = 'email_subscribers';
```

### Status Change Request Failing

**Error**: `new row violates check constraint`

**Cause**: Constraint uses 'active' instead of 'current'

**Solution**: Run migration:

```sql
-- supabase/migrations/fix_status_change_constraint.sql
ALTER TABLE status_change_requests 
DROP CONSTRAINT IF EXISTS status_change_requests_requested_status_check;

ALTER TABLE status_change_requests 
ADD CONSTRAINT status_change_requests_requested_status_check 
CHECK (requested_status IN ('current', 'answered', 'ongoing', 'closed'));
```

### Connection Errors

**Error**: `Failed to connect to database`

**Solutions**:
1. Check Supabase project status
2. Verify environment variables:
```bash
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```
3. Check internet connection
4. Verify project isn't paused (free tier)

### Slow Queries

**Symptoms**: Long loading times

**Solutions**:
1. Check indexes exist (see DATABASE.md)
2. Add LIMIT to queries:
```typescript
const { data } = await supabase
  .from('prayers')
  .select('*')
  .limit(50); // Add limit
```
3. Use specific columns:
```typescript
.select('id, title, status') // Instead of '*'
```

### Migration Errors

**Error**: Migration fails to apply

**Solutions**:
1. Check migration order (see DATABASE.md)
2. Verify table doesn't already exist
3. Check for data conflicts
4. Run migrations one at a time

## Email Problems

### Emails Not Sending

**Error**: `403 Forbidden` from Resend

**Causes & Solutions**:

#### 1. Test Mode Restrictions

**Symptoms**: Can only send to one email

**Solution**: Verify domain at resend.com/domains

**Temporary**: Add recipient filtering in Edge Function:
```typescript
const allowedEmail = 'your@email.com';
const filteredRecipients = recipients.filter(r => r === allowedEmail);
```

#### 2. Invalid API Key

**Solution**: Update secret:
```bash
supabase secrets set RESEND_API_KEY=your_key_here
```

#### 3. Unverified Sender Domain

**Solution**: See EMAIL.md → Domain Verification

#### 4. Rate Limiting

**Symptoms**: Some emails send, others fail

**Solution**: 
- Free tier: 100 emails/day
- Add delay between sends
- Upgrade Resend plan

### No Approval Emails Received

**Checklist**:
1. ✅ Check spam folder
2. ✅ Verify admin email in `admin_settings`:
```sql
SELECT notification_emails FROM admin_settings;
```
3. ✅ Check Edge Function logs:
```bash
supabase functions logs send-notification
```
4. ✅ Test email manually (see TEST_EMAIL.md in archive)

### User Not Receiving Notifications

**Checklist**:
1. ✅ Check user is in `email_subscribers`:
```sql
SELECT * FROM email_subscribers WHERE email = 'user@example.com';
```
2. ✅ Verify `is_active = true`
3. ✅ Check for pending preference changes:
```sql
SELECT * FROM pending_preference_changes 
WHERE email = 'user@example.com' 
  AND approval_status = 'pending';
```
4. ✅ Admin must approve preference changes

### Email Formatting Issues

**Problem**: HTML not rendering correctly

**Solutions**:
1. Check email client (Gmail, Outlook, etc.)
2. Use inline CSS (not external stylesheets)
3. Test in multiple clients
4. Use email-safe HTML (tables for layout)

## Authentication

### Can't Access Admin Portal

**Error**: "Invalid password"

**Solutions**:
1. Check default password: `prayer2024`
2. Verify no typos (case-sensitive)
3. Reset password:
```sql
UPDATE admin_settings SET admin_password = 'new_password';
```
4. Check you're on `/admin` page

### Admin Password Not Saving

**Cause**: RLS policy or missing admin_settings record

**Solution**:
```sql
-- Verify record exists
SELECT * FROM admin_settings;

-- If empty, insert default
INSERT INTO admin_settings (admin_password, notification_emails)
VALUES ('prayer2024', 'admin@example.com');
```

## UI/Display Issues

### Name Disappearing in Settings

**Cause**: Race condition between localStorage and database

**Solution**: Already fixed with `isInitialLoad` flag

**Verify** in `UserSettings.tsx`:
```typescript
const [isInitialLoad, setIsInitialLoad] = useState(true);
```

### Checkbox Not Reflecting Database

**Cause**: Initial state set before query completes

**Solution**: Don't set initial `receiveNotifications` state

**Verify** in `UserSettings.tsx`:
```typescript
// Should NOT have:
const [receiveNotifications, setReceiveNotifications] = useState(true);

// Should be:
const [receiveNotifications, setReceiveNotifications] = useState<boolean>();
```

### Dark Mode Not Working

**Symptoms**: Theme not changing or persisting

**Solutions**:
1. Check localStorage:
```javascript
localStorage.getItem('theme')
```
2. Clear and reload:
```javascript
localStorage.removeItem('theme');
location.reload();
```
3. Verify Tailwind dark mode config:
```typescript
// tailwind.config.ts
darkMode: 'class'
```

### Realtime Updates Not Working

**Symptoms**: Need to refresh to see new prayers

**Solutions**:
1. Check Supabase realtime enabled:
   - Dashboard → Database → Replication → Enable for table
2. Verify subscription in `usePrayerManager.ts`
3. Check browser console for errors
4. Test with multiple browser windows

### Dropdown Arrow Not Visible

**Solution**: Already fixed with larger, colored arrow

**Verify** in `PrayerCard.tsx`:
```typescript
<ChevronDown 
  size={20} 
  className="text-blue-600 dark:text-blue-400" 
/>
```

## Edge Functions

### 403 Forbidden Error

**Cause**: JWT verification enabled

**Solution**: Deploy with flag:
```bash
supabase functions deploy send-notification --no-verify-jwt
```

**Verify** in `deno.json`:
```json
{
  "verify_jwt": false
}
```

### Function Not Found (404)

**Cause**: Function not deployed or wrong URL

**Solutions**:
1. Deploy function:
```bash
./deploy-functions.sh send-notification
```
2. Verify URL in code matches deployed name
3. Check Supabase project reference

### Function Timeout

**Cause**: Long-running operation

**Solutions**:
1. Optimize database queries
2. Add pagination
3. Increase timeout (max 60s on free tier)
4. Split into multiple functions

### Environment Variables Not Available

**Error**: `undefined` when accessing `Deno.env.get()`

**Solution**: Set secrets:
```bash
supabase secrets set RESEND_API_KEY=your_key
supabase secrets list # Verify
```

## Performance

### Slow Page Load

**Solutions**:
1. Add indexes (see DATABASE.md)
2. Limit query results:
```typescript
.limit(50)
```
3. Use pagination
4. Enable caching headers
5. Optimize images (use WebP)

### High Database Usage

**Causes**:
- Too many queries
- Missing indexes
- Large result sets

**Solutions**:
1. Batch queries
2. Add appropriate indexes
3. Use `select()` to limit columns
4. Implement pagination

### Memory Issues

**Symptoms**: Browser tab crashes

**Solutions**:
1. Limit realtime subscriptions
2. Clean up event listeners
3. Use pagination
4. Check for memory leaks in useEffect

## Deployment

### Build Fails in Production

**Error**: Build succeeds locally but fails on hosting

**Solutions**:
1. Match Node versions:
```json
// package.json
"engines": {
  "node": "18.x"
}
```
2. Check environment variables set in hosting dashboard
3. Clear build cache
4. Check for dev dependencies in production code

### 404 on Routes

**Cause**: SPA routing not configured

**Solutions**:

**Vercel** (`vercel.json`):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Netlify** (`netlify.toml`):
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Environment Variables Not Loading

**Solutions**:
1. Verify in hosting dashboard
2. Must start with `VITE_` for client-side
3. Restart/redeploy after adding
4. Check for typos

### Database Connection Fails in Production

**Solutions**:
1. Verify production Supabase URL/key
2. Check project isn't paused
3. Verify RLS policies allow access
4. Check API rate limits

## Common Error Messages

### "Failed to fetch"

**Causes**:
- Network issue
- CORS error
- Server down

**Solutions**:
1. Check network connection
2. Verify Supabase project status
3. Check browser console for CORS errors
4. Verify API endpoint URL

### "Invalid API key"

**Solutions**:
1. Check environment variable:
```bash
echo $VITE_SUPABASE_ANON_KEY
```
2. Verify key in Supabase dashboard → Settings → API
3. Re-deploy with correct key

### "This function has been paused"

**Cause**: Supabase project paused (free tier inactivity)

**Solution**:
1. Restore project in dashboard
2. Consider upgrading plan

## Debug Tools

### Browser Console

Essential for debugging:
```javascript
// Check environment
console.log(import.meta.env);

// Check localStorage
console.log(localStorage);

// Check Supabase client
console.log(supabase);
```

### Supabase Dashboard

Check:
- **Table Editor**: View data
- **Logs**: API requests
- **Reports**: Usage stats
- **SQL Editor**: Run queries

### Edge Function Logs

```bash
# Real-time
supabase functions logs send-notification --follow

# Last hour
supabase functions logs send-notification --since 1h

# Specific time
supabase functions logs send-notification --since "2024-01-01 12:00:00"
```

### Network Tab

Check in browser DevTools:
- Request/response headers
- Status codes
- Response bodies
- Timing

## Getting Help

### Before Asking

1. ✅ Check this guide
2. ✅ Search error message
3. ✅ Check browser console
4. ✅ Review recent changes
5. ✅ Try in incognito mode

### Information to Provide

- **Error message**: Full text
- **Browser**: Name and version
- **Console errors**: Screenshot
- **Steps to reproduce**: Detailed
- **Environment**: Dev or production
- **Recent changes**: What you modified

### Resources

- **Supabase**: [supabase.com/support](https://supabase.com/support)
- **Resend**: [resend.com/support](https://resend.com/support)
- **GitHub Issues**: Create issue with details
- **Stack Overflow**: Tag with relevant technologies

## Preventive Measures

### Best Practices

- ✅ Test locally before deploying
- ✅ Use environment variables for config
- ✅ Keep dependencies updated
- ✅ Monitor error logs regularly
- ✅ Have rollback plan
- ✅ Document custom changes

### Regular Maintenance

- Weekly: Check error logs
- Monthly: Update dependencies
- Quarterly: Review database performance
- Yearly: Audit RLS policies

---

**Still having issues?** Check the other documentation files or create a GitHub issue with details.
