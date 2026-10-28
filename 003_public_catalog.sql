-- Needed only if you already ran an earlier schema.sql.

-- Public catalog: visitors who are not signed in can see course and lesson titles on the landing page.
create policy courses_public_read on public.courses for select to anon using (true);
create policy lessons_public_read on public.lessons for select to anon using (true);
