# Geniotech learning platform

Bilingual (English / Arabic) STEM learning platform. Vite + vanilla JS + Supabase.
Roles: admin (owner), teacher, student, parent.

## 1. Run locally

```bash
npm install
cp .env.example .env        # then fill in the two values (Supabase > Project Settings > API)
npm run dev                 # http://localhost:5173
```

Use only the **anon public** key in `.env`. Never put the service-role key in this project.

## 2. Set up Supabase (once)

1. Create a project at supabase.com.
2. SQL Editor: run `supabase/schema.sql` (tables, security rules, private video bucket).
   Optional: run `supabase/seed.sql` for sample courses.
   (If you already ran the schema from chat, run `supabase/migrations/002_fix_xp_view.sql` and `003_public_catalog.sql` instead.)
3. Authentication > Providers > Email: turn **off** "Confirm email".
4. Create the first admin:
   - Authentication > Users > Add user: email `admin@geniotech.app`, a strong password, tick "Auto confirm".
   - SQL Editor, using that user's UUID:
     `insert into public.profiles (id, username, full_name, role) values ('<UUID>','admin','Head Admin','admin');`
5. Deploy the user-management function (admin creates teachers, students, parents):
   ```bash
   npm i -g supabase            # or: npx supabase ...
   supabase login
   supabase link --project-ref <YOUR-PROJECT-REF>
   supabase functions deploy admin-users
   ```
6. Sign in as `admin`, open **Users**, and add people. A parent is linked to students by their usernames.

## 3. Deploy

`npm run build` creates `dist/`. Upload it to Vercel or Netlify and set the same two `VITE_` variables there.
Then add the site URL in Supabase > Authentication > URL Configuration.

## Where things live

| File | What it does |
|---|---|
| `src/main.js` | start-up, login flow, every button and form |
| `src/views.js` | pages: landing, login, student / parent / admin / teacher dashboards, modals |
| `src/player.js` | video player, pop-up quizzes, XP, PDF certificate |
| `src/api.js` | all Supabase calls (the only file that talks to the database) |
| `src/i18n.js` | English and Arabic text (add a key to both) |
| `src/styles.css` | design tokens and styles (light and dark) |
| `supabase/schema.sql` | tables, Row Level Security, quiz and XP functions |
| `supabase/functions/admin-users` | server function that creates and deletes users |

## Security model (short)

- Logins are Supabase Auth users (`username@geniotech.app`).
- Students cannot read quiz answers; they call `submit_quiz_answer`, and the server checks the answer.
- XP, lesson progress and certificates are written only by server functions, never directly by the browser.
- A parent sees only linked children. Videos are in a private bucket and played through short-lived signed links.

## Known limits / next ideas

- Teachers cannot preview lessons yet (lessons play from student accounts).
- No password reset screen yet (admin can reset in the Supabase dashboard).
- Course thumbnails are set in SQL (`thumb_path`); an upload field is a good next step.
- Lists load up to 1,000 rows per table; add paging when you grow past that.
