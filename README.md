# TRADEIX — יומן מסחר חכם

## הוראות התקנה מלאות

---

### שלב 1 — הורדת הפרויקט

1. פתח **Terminal** (מק: Cmd+Space → Terminal | חלונות: Win+R → cmd)
2. נווט לתיקייה שבה תרצה לשמור:
   ```
   cd Desktop
   ```
3. צור את תיקיית הפרויקט ופתח ב-VS Code:
   ```
   code tradeix
   ```

---

### שלב 2 — הגדרת Supabase

1. כנס ל [supabase.com](https://supabase.com) → New Project → שם: `tradeix`
2. לאחר יצירת הפרויקט, כנס ל **SQL Editor**
3. העתק את כל תוכן הקובץ `supabase-schema.sql` והרץ (Run)
4. כנס ל **Authentication → Providers → Google** → Enable
5. הגדר את ה-OAuth (ראה שלב 3)
6. שמור את:
   - **Project URL** (Settings → API → Project URL)
   - **anon public key** (Settings → API → anon key)

---

### שלב 3 — הגדרת Google OAuth

1. כנס ל [console.cloud.google.com](https://console.cloud.google.com)
2. צור פרויקט חדש → APIs & Services → Credentials
3. Create Credentials → OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URIs:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   (החלף YOUR_PROJECT_REF עם ה-ref מ-Supabase Settings)
6. העתק את **Client ID** ו-**Client Secret** לתוך Supabase → Auth → Google

---

### שלב 4 — קבלת Anthropic API Key

1. כנס ל [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key
3. שמור את המפתח (מתחיל ב-`sk-ant-...`)

---

### שלב 5 — הגדרת משתני סביבה

1. פתח את הקובץ `.env.local` בפרויקט
2. מלא את הפרטים:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_SITE_URL=https://tradeix.vercel.app
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   LEMONSQUEEZY_API_KEY=your_lemonsqueezy_api_key
   LEMONSQUEEZY_STORE_ID=your_store_id
   LEMONSQUEEZY_PRO_VARIANT_ID=your_pro_variant_id
   LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID=your_yearly_pro_variant_id
   LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_signing_secret
   ```

Lemon Squeezy webhook callback:

```
https://tradeix.vercel.app/api/billing/webhook
```

Recommended subscription events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`.

---

### שלב 6 — הפעלת הפרויקט

בטרמינל, בתוך תיקיית הפרויקט:

```bash
# התקנת חבילות (פעם אחת בלבד)
npm install

# הפעלת שרת פיתוח
npm run dev
```

פתח דפדפן: [http://localhost:3000](http://localhost:3000)

---

### שלב 7 — העלאה לאינטרנט (Vercel)

```bash
# התקן Vercel CLI
npm i -g vercel

# העלה
vercel
```

לחלופין:
1. כנס ל [vercel.com](https://vercel.com)
2. Import Git Repository
3. הוסף את משתני הסביבה (Environment Variables)
4. Deploy!

---

## מבנה הפרויקט

```
tradeix/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/          # דף התחברות
│   │   │   └── callback/       # Google OAuth callback
│   │   ├── dashboard/          # דשבורד ראשי
│   │   ├── add-trade/          # הוספת עסקה + AI
│   │   ├── trades/             # כל העסקאות
│   │   ├── stats/              # סטטיסטיקות
│   │   ├── portfolios/         # ניהול תיקים
│   │   ├── settings/           # הגדרות אישיות
│   │   └── api/
│   │       └── analyze-trade/  # Claude AI endpoint
│   ├── lib/
│   │   └── supabase/           # Supabase clients
│   └── types/                  # TypeScript types
├── supabase-schema.sql          # SQL לבסיס הנתונים
├── .env.local                   # משתני סביבה (לא ל-Git!)
└── README.md
```

---

## שאלות נפוצות

**שגיאה: "Cannot find module"**
→ הרץ `npm install` מחדש

**שגיאה: "Invalid API key"**
→ בדוק שה-.env.local מלא נכון ואין רווחים

**הכניסה ב-Google לא עובדת**
→ בדוק שה-redirect URI ב-Google Console מדויק

**AI לא מנתח את התמונה**
→ בדוק שה-ANTHROPIC_API_KEY תקין ויש קרדיט בחשבון
