import { ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Address, Page, User, UserGroup, UserWithDependents } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import AddressFields, { type AddressValue } from '../components/AddressFields'
import { Alert, Field, PageHeader, Spinner } from '../components/ui'
import { formatCpf, formatPhone, onlyDigits } from '../lib/format'
import { useApi, useDebounced } from '../lib/useApi'

interface FormValue extends AddressValue {
  name: string
  document_number: string
  birthday: string
  gender: string
  email: string
  phone: string
  user_group_id: string
  user_id: string
  active: boolean
  associate_admin: boolean
}

function addressValue(address?: Address): AddressValue {
  return {
    postal_code: address?.postal_code ?? '',
    address_street: address?.street ?? '',
    address_number: address?.number ?? '',
    address_complement: address?.complement ?? '',
    address_district: address?.district ?? '',
    city_id: address?.city_id ?? null,
  }
}

function fromUser(user: User): FormValue {
  return {
    name: user.name, document_number: user.document_number, birthday: user.birthday, gender: user.gender,
    email: user.email, phone: user.phone, user_group_id: String(user.user_group?.id ?? ''),
    user_id: user.holder_id ? String(user.holder_id) : '', active: user.active, associate_admin: user.associate_admin,
    ...addressValue(user.address),
  }
}

export default function UserForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { me, isGuestAdmin } = useAuth()

  const groups = useApi(() => api.get<{ data: UserGroup[] }>('/lookups/user_groups'), [])
  const existing = useApi(() => (id ? api.get<UserWithDependents>(`/users/${id}`) : Promise.resolve(null)), [id])
  // Funcionário novo costuma ter o endereço da empresa: vem preenchido.
  const [form, setForm] = useState<FormValue | null>(isNew ? {
    name: '', document_number: '', birthday: '', gender: '', email: '', phone: '', user_group_id: '', user_id: '',
    active: true, associate_admin: false, ...addressValue(me?.associate.address),
  } : null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (existing.data) setForm(fromUser(existing.data))
  }, [existing.data])

  if (!form) return existing.error ? <Alert>{existing.error}</Alert> : <Spinner />

  const set = (patch: Partial<FormValue>) => setForm({ ...form, ...patch })
  const group = groups.data?.data.find((g) => String(g.id) === form.user_group_id)
  // Grupo "relative" = dependente: precisa de um titular deste associado.
  const isDependent = Boolean(group?.relative)
  const addressSource = existing.data?.address ?? me?.associate.address
  const canDelete = !isNew && !(isGuestAdmin && existing.data?.holder)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setError('')
    setErrors({})
    setBusy(true)
    const payload = {
      ...form,
      document_number: onlyDigits(form.document_number),
      phone: onlyDigits(form.phone),
      user_id: isDependent ? form.user_id : '',
    }
    try {
      if (isNew) await api.post('/users', { user: payload })
      else await api.patch(`/users/${id}`, { user: payload })
      navigate('/usuarios')
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
        setErrors(e.fields)
      } else {
        setError('Erro inesperado.')
      }
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing.data || !confirm(`Excluir ${existing.data.name}? Essa ação não pode ser desfeita.`)) return
    setBusy(true)
    try {
      await api.delete(`/users/${id}`)
      navigate('/usuarios')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.')
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <Link to="/usuarios" className="btn btn-ghost btn-sm back"><ArrowLeft size={16} /> Usuários</Link>
      <PageHeader
        title={isNew ? 'Novo usuário' : existing.data?.name ?? 'Editar usuário'}
        subtitle={isNew ? undefined : `CPF ${formatCpf(form.document_number)}`}
        action={canDelete ? (
          <button className="btn btn-danger-outline" onClick={remove} disabled={busy}><Trash2 size={18} /> Excluir</button>
        ) : undefined}
      />

      <form className="card stack" onSubmit={submit}>
        <Alert>{error}</Alert>
        <h2>Dados pessoais</h2>
        <div className="form-grid">
          <Field label="Nome completo" error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </Field>
          <Field label="CPF" error={errors.document_number}>
            <input className="input" inputMode="numeric" value={formatCpf(form.document_number)}
                   onChange={(e) => set({ document_number: e.target.value })} required />
          </Field>
          <Field label="Data de nascimento" error={errors.birthday}>
            <input className="input" type="date" value={form.birthday} onChange={(e) => set({ birthday: e.target.value })} required />
          </Field>
          <Field label="Sexo" error={errors.gender}>
            <select className="input" value={form.gender} onChange={(e) => set({ gender: e.target.value })} required>
              <option value="" disabled>Selecione…</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
            </select>
          </Field>
          <Field label="E-mail" error={errors.email} hint="O código de acesso ao app do usuário vai para este e-mail.">
            <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />
          </Field>
          <Field label="Celular" error={errors.phone}>
            <input className="input" inputMode="tel" value={formatPhone(form.phone)}
                   onChange={(e) => set({ phone: e.target.value })} required />
          </Field>
        </div>

        <h2>Vínculo</h2>
        <div className="form-grid">
          <Field label="Grupo" error={errors.user_group || errors.user_group_id}>
            <select className="input" value={form.user_group_id} onChange={(e) => set({ user_group_id: e.target.value })} required>
              <option value="" disabled>Selecione…</option>
              {groups.data?.data.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.description}{g.relative && !/dependente/i.test(g.description) ? ' (dependente)' : ''}
                </option>
              ))}
            </select>
          </Field>
          {isDependent && (
            <HolderPicker value={form.user_id} exclude={existing.data?.id} error={errors.user_id}
                          onChange={(userId) => set({ user_id: userId })} />
          )}
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
            Usuário ativo
          </label>
          <label className="check check-hint">
            <input type="checkbox" checked={form.associate_admin} onChange={(e) => set({ associate_admin: e.target.checked })} />
            <span>
              <span className="check-title"><ShieldCheck size={15} /> Administrador do associado</span>
              <small className="muted">Pode entrar neste painel com o próprio CPF. A senha inicial é o CPF.</small>
            </span>
          </label>
        </div>

        <h2>Endereço</h2>
        <AddressFields value={form} onChange={(address) => set(address)} errors={errors}
                       initialStateAcronym={addressSource?.state} initialCityName={addressSource?.city} />

        <div className="actions">
          <Link to="/usuarios" className="btn btn-ghost">Cancelar</Link>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      {existing.data && existing.data.dependents.length > 0 && (
        <section className="card">
          <h2>Dependentes</h2>
          <ul className="list">
            {existing.data.dependents.map((dep) => (
              <li key={dep.id}>
                <Link to={`/usuarios/${dep.id}`} className="list-item">
                  <div className="list-body">
                    <strong>{dep.name}</strong>
                    <span className="muted">CPF {formatCpf(dep.document_number)} · {dep.user_group?.description}</span>
                  </div>
                  <span className={dep.active ? 'badge badge-finalizado' : 'badge badge-trancado'}>
                    {dep.active ? 'Ativo' : 'Inativo'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// Titular do dependente: busca entre os titulares do associado.
function HolderPicker({ value, exclude, error, onChange }: {
  value: string
  exclude?: number
  error?: string[]
  onChange: (userId: string) => void
}) {
  const [search, setSearch] = useState('')
  const term = useDebounced(search)
  const holders = useApi(() => api.get<Page<User>>('/users', { holders_only: 'true', search: term }), [term])
  const current = useApi(() => (value ? api.get<User>(`/users/${value}`) : Promise.resolve(null)), [value])
  const options = (holders.data?.data ?? []).filter((u) => u.id !== exclude)
  if (current.data && !options.some((u) => u.id === current.data!.id)) options.unshift(current.data)

  return (
    <Field label="Titular" error={error} hint="Busque pelo nome ou CPF e escolha na lista.">
      <input className="input" placeholder="Buscar titular…" value={search} onChange={(e) => setSearch(e.target.value)}
             aria-label="Buscar titular" />
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>Selecione o titular…</option>
        {options.map((u) => <option key={u.id} value={u.id}>{u.name} · CPF {formatCpf(u.document_number)}</option>)}
      </select>
    </Field>
  )
}
