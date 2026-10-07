"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography } from '@mui/material';

type User = { id: string; username: string; created_at: string; updated_at: string };
export default function UsersPage() {
  const router = useRouter();
  const [items, setItems] = useState<User[]>([]);
  const [me, setMe] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [usersResponse, meResponse] = await Promise.all([fetch('/api/admin/users', { cache: 'no-store' }), fetch('/api/auth/me', { cache: 'no-store' })]);
    if (usersResponse.status === 401 || meResponse.status === 401) { router.push('/login'); return; }
    if (!usersResponse.ok || !meResponse.ok) throw new Error('Could not load users');
    setItems((await usersResponse.json()).items);
    setMe((await meResponse.json()).user.id);
  }
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function add() { setEditing(null); setUsername(''); setPassword(''); setError(''); setOpen(true); }
  function edit(user: User) { setEditing(user); setUsername(user.username); setPassword(''); setError(''); setOpen(true); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const changedPassword = !!password;
      const response = await fetch(editing ? `/api/admin/users/${editing.id}` : '/api/admin/users', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { username, ...(changedPassword ? { password } : {}) } : { username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save user');
      setOpen(false); setPassword('');
      if (editing?.id === me && changedPassword) { router.push('/login'); router.refresh(); return; }
      await refresh();
      setNotice(editing ? 'User updated.' : 'User created.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save user'); }
    finally { setBusy(false); }
  }
  return <Box sx={{ py: 3 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mb={3}>
      <Box><Typography variant="h4" fontWeight={800}>Users</Typography><Typography color="text.secondary" mt={.5}>All users can manage this adserver. Create accounts and update their sign-in details.</Typography></Box>
      <Button variant="contained" onClick={add}>Add user</Button>
    </Stack>
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    {error && !open && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {loading && <LinearProgress />}
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}><CardContent sx={{ p: 0 }}>
      {items.map(user => <Stack key={user.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box><Typography fontWeight={700}>{user.username}{user.id === me ? ' (you)' : ''}</Typography><Typography variant="body2" color="text.secondary">Created {new Date(user.created_at).toLocaleDateString()}</Typography></Box>
        <Button variant="outlined" onClick={() => edit(user)}>Edit username or password</Button>
      </Stack>)}
    </CardContent></Card>
    <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm"><Stack component="form" onSubmit={save}>
      <DialogTitle>{editing ? `Edit ${editing.username}` : 'Add user'}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Username" autoComplete="off" required value={username} onChange={e => setUsername(e.target.value)} helperText="3–64 letters, numbers, dots, underscores or hyphens" />
        <TextField label={editing ? 'New password (leave blank to keep current)' : 'Password'} type="password" autoComplete="new-password" required={!editing} value={password} onChange={e => setPassword(e.target.value)} helperText="12–128 characters" />
        {editing?.id === me && password && <Alert severity="info">Changing your password will sign you out.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></DialogActions>
    </Stack></Dialog>
  </Box>;
}
