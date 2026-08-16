import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Modal, SectionTitle, toast } from '../../components/ui';
import { timeAgo } from '../../lib/format';

/**
 * User & role management (plan §2.4).
 *
 * Officers and drivers are created here and nowhere else — there is no public
 * signup for staff roles, which is both a security control and how municipal
 * onboarding actually works.
 */

const ROLE_TONE: Record<string, 'brand' | 'info' | 'warn' | 'danger'> = {
  CITIZEN: 'brand',
  DRIVER: 'info',
  OFFICER: 'warn',
  ADMIN: 'danger',
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState('OFFICER');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'OFFICER', password: '', wardIds: [] as string[] });

  const users = useQuery({
    queryKey: ['admin', 'users', role, search, page],
    queryFn: async () =>
      (await api('admin').get('/admin/users', { params: { role: role || undefined, search: search || undefined, page, pageSize: 25 } })).data,
  });
  const wards = useQuery({
    queryKey: ['admin', 'wards'],
    queryFn: async () => (await api('admin').get('/admin/wards')).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api('admin').post('/admin/users', {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password,
          wardIds: form.role === 'OFFICER' ? form.wardIds : undefined,
          wardId: form.role === 'DRIVER' ? form.wardIds[0] : undefined,
        })
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Account created');
      setCreating(false);
      setForm({ name: '', email: '', phone: '', role: 'OFFICER', password: '', wardIds: [] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api('admin').patch(`/admin/users/${id}`, { isActive })).data,
    onSuccess: async (_d, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(vars.isActive ? 'Account reactivated' : 'Account deactivated — sessions revoked');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Users & roles"
        subtitle="Officers and drivers are provisioned here — there is no public signup for staff"
        action={
          <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
            <UserPlus className="h-3.5 w-3.5" /> New account
          </button>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            className="field pl-9"
            placeholder="Search by name, email or phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-1.5">
          {['OFFICER', 'DRIVER', 'CITIZEN', 'ADMIN', ''].map((r) => (
            <button
              key={r || 'all'}
              type="button"
              onClick={() => {
                setRole(r);
                setPage(1);
              }}
              className={`chip transition ${role === r ? 'border-brand bg-brand/10 text-brand' : 'text-muted hover:bg-sunken'}`}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
      </Card>

      {users.isLoading ? (
        <Loading />
      ) : users.error ? (
        <ErrorState message="Could not load users" onRetry={() => users.refetch()} />
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <div className="table-scroll">
              <table className="w-full min-w-[52rem] text-left text-fluid-sm">
                <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Contact</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Wards</th>
                    <th className="px-4 py-2.5">Last login</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.data.items.map((u: any) => (
                    <tr key={u.id} className="hover:bg-sunken/50">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{u.name}</span>
                        {u.twoFactorEnabled && (
                          <ShieldCheck className="ml-1.5 inline h-3.5 w-3.5 text-ok" aria-label="Two-factor enabled" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-fluid-xs">
                        <p className="truncate">{u.email ?? '—'}</p>
                        <p className="text-muted">{u.phone ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                      <td className="px-4 py-2.5 text-fluid-xs">
                        {u.officerWards?.length
                          ? u.officerWards.map((w: any) => w.ward.code).join(', ')
                          : u.ward?.code ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-fluid-xs text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.isActive ? 'ok' : 'danger'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ul className="space-y-2.5 md:hidden">
            {users.data.items.map((u: any) => (
              <li key={u.id}>
                <Card className="p-3.5">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium">{u.name}</p>
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-fluid-xs text-muted">{u.email ?? u.phone}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={u.isActive ? 'ok' : 'danger'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                    <button
                      type="button"
                      className="btn-ghost btn-sm ml-auto"
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {users.data.pages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-fluid-xs text-muted">Page {users.data.page} of {users.data.pages} · {users.data.total} users</p>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <button type="button" className="btn-ghost btn-sm" disabled={page >= users.data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a staff account"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!form.name || !form.password || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create account
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="role">Role</label>
            <select id="role" className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="OFFICER">Ward Officer</option>
              <option value="DRIVER">Driver</option>
              <option value="ADMIN">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="uemail">Email {form.role === 'DRIVER' && '(used for OTP login)'}</label>
            <input id="uemail" type="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="uphone">Phone</label>
            <input id="uphone" className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="upass">Temporary password</label>
            <input id="upass" className="field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
          </div>
          {form.role !== 'ADMIN' && (
            <div>
              <label className="label">{form.role === 'OFFICER' ? 'Wards (first is primary)' : 'Ward'}</label>
              <div className="flex flex-wrap gap-1.5">
                {(wards.data ?? []).map((w: any) => {
                  const selected = form.wardIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          wardIds: selected
                            ? form.wardIds.filter((id) => id !== w.id)
                            : form.role === 'DRIVER'
                              ? [w.id]
                              : [...form.wardIds, w.id],
                        })
                      }
                      className={`chip transition ${selected ? 'border-brand bg-brand/10 text-brand' : 'text-muted hover:bg-sunken'}`}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
