// Edge Function: only an admin can create or delete users.
// Deploy:  supabase functions deploy admin-users
// The service-role key stays on the server (Supabase injects it automatically).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ROLES = ['admin', 'teacher', 'student', 'parent'];
const DOMAIN = 'geniotech.app';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const body = await req.json();

    if (body.action === 'create') {
      const username = String(body.username ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const role = String(body.role ?? '');
      const name = String(body.name ?? '').trim();
      if (!/^[a-z0-9._-]{3,30}$/.test(username) || password.length < 6 || !ROLES.includes(role) || !name)
        return json({ error: 'invalid-input' }, 400);

      const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
      if (taken) return json({ error: 'username-taken' }, 409);

      let childIds: string[] = [];
      if (role === 'parent' && Array.isArray(body.children) && body.children.length) {
        const names = body.children.map((c: string) => String(c).trim().toLowerCase());
        const { data: kids } = await admin.from('profiles').select('id, username').eq('role', 'student').in('username', names);
        if (!kids || kids.length !== names.length) return json({ error: 'children-not-found' }, 400);
        childIds = kids.map(k => k.id);
      }

      const { data: created, error: e1 } = await admin.auth.admin.createUser({
        email: `${username}@${DOMAIN}`, password, email_confirm: true,
      });
      if (e1 || !created.user) return json({ error: e1?.message ?? 'create-failed' }, 400);

      const { error: e2 } = await admin.from('profiles').insert({
        id: created.user.id, username, full_name: name, role, age: role === 'student' ? Number(body.age) || 8 : null,
      });
      if (e2) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: e2.message }, 400); }
      if (childIds.length)
        await admin.from('parent_students').insert(childIds.map(sid => ({ parent_id: created.user!.id, student_id: sid })));
      return json({ ok: true, id: created.user.id });
    }

    if (body.action === 'delete') {
      if (body.id === user.id) return json({ error: 'cannot-delete-self' }, 400);
      const { error } = await admin.auth.admin.deleteUser(String(body.id)); // profile rows cascade
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
