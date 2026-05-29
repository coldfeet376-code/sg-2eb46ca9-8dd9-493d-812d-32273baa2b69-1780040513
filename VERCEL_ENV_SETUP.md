# Vercel Environment Variables Setup

Copy and paste these EXACT values into your Vercel dashboard.

**Vercel Dashboard:** https://vercel.com/dashboard
**Steps:** Project → Settings → Environment Variables

---

## Variable 1: NEXT_PUBLIC_SUPABASE_URL

**Name:**
```
NEXT_PUBLIC_SUPABASE_URL
```

**Value:**
```
https://neucyhpwwnokykafuldj.supabase.co
```

---

## Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

**Name:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldWN5aHB3d25va3lrYWZ1bGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTM5MTYsImV4cCI6MjA5NTU2OTkxNn0.mVUZE_JoKAENc97_aZXPguJCMiEPdWLmT1deFvaqUSY
```

---

## Variable 3: SUPABASE_SERVICE_ROLE_KEY

**Name:**
```
SUPABASE_SERVICE_ROLE_KEY
```

**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldWN5aHB3d25va3lrYWZ1bGRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk5MzkxNiwiZXhwIjoyMDk1NTY5OTE2fQ.PHOWJPfPezs9KY-2npMSgbKA78KLIcv4c8qj6U_Xhug
```

---

## After Adding All Three Variables:

1. ✅ Click **"Save"** on each variable
2. ✅ Go to **"Deployments"** tab
3. ✅ Click the **"..."** menu on the latest deployment
4. ✅ Select **"Redeploy"**
5. ✅ Wait 2-3 minutes for build to complete
6. ✅ Test your production URL!

---

## Quick Copy Format (all in one):

```
NEXT_PUBLIC_SUPABASE_URL=https://neucyhpwwnokykafuldj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldWN5aHB3d25va3lrYWZ1bGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTM5MTYsImV4cCI6MjA5NTU2OTkxNn0.mVUZE_JoKAENc97_aZXPguJCMiEPdWLmT1deFvaqUSY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldWN5aHB3d25va3lrYWZ1bGRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk5MzkxNiwiZXhwIjoyMDk1NTY5OTE2fQ.PHOWJPfPezs9KY-2npMSgbKA78KLIcv4c8qj6U_Xhug
```