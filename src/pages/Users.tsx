import { FileSpreadsheet, Search, ShieldCheck, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Page, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, PageHeader, Pagination, Spinner } from '../components/ui'
import { formatCpf } from '../lib/format'
import { useApi, useDebounced } from '../lib/useApi'

export default function Users() {
  const navigate = useNavigate()
  const { isGuestAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [holdersOnly, setHoldersOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const term = useDebounced(search)
  const users = useApi(
    () => api.get<Page<User>>('/users', { search: term, page, holders_only: holdersOnly ? 'true' : undefined }),
    [term, page, holdersOnly],
  )

  async function remove(user: User) {
    if (!confirm(`Excluir ${user.name}? Essa ação não pode ser desfeita.`)) return
    setError('')
    try {
      await api.delete(`/users/${user.id}`)
      users.reload()
    } catch (e) {
      // Usuário com guias ou dependentes não é excluído.
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.')
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Usuários"
        subtitle="Funcionários e dependentes que usam o CDL Saúde pelo associado."
        action={
          <div className="header-actions">
            <Link to="/usuarios/importar" className="btn btn-ghost"><FileSpreadsheet size={18} /> Importar planilha</Link>
            <Link to="/usuarios/novo" className="btn btn-primary"><UserPlus size={18} /> Novo usuário</Link>
          </div>
        }
      />

      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input className="input" placeholder="Nome, CPF ou e-mail" value={search}
                 onChange={(e) => {
                   setSearch(e.target.value)
                   setPage(1)
                 }}
                 aria-label="Buscar usuários" />
        </label>
        <div className="segmented" role="group" aria-label="Quem mostrar">
          <button className={!holdersOnly ? 'active' : ''} onClick={() => { setHoldersOnly(false); setPage(1) }}>Todos</button>
          <button className={holdersOnly ? 'active' : ''} onClick={() => { setHoldersOnly(true); setPage(1) }}>Só titulares</button>
        </div>
      </div>

      <Alert>{error || users.error}</Alert>
      {users.loading && !users.data && <Spinner />}
      {users.data?.data.length === 0 && (
        <Empty icon={<UsersIcon size={32} />} title={term ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}>
          {!term && <Link to="/usuarios/importar" className="btn btn-ghost">Importar de uma planilha</Link>}
        </Empty>
      )}

      {users.data && users.data.data.length > 0 && (
        <div className={users.loading ? 'card table-card is-loading' : 'card table-card'}>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="hide-sm">CPF</th>
                <th className="hide-sm">Grupo</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {users.data.data.map((user) => (
                <tr key={user.id} className="row-clickable" onClick={() => navigate(`/usuarios/${user.id}`)}>
                  <td>
                    <Link to={`/usuarios/${user.id}`} className="row-link">{user.name}</Link>
                    {user.associate_admin && (
                      <span className="tag" title="Tem acesso a este painel"><ShieldCheck size={13} /> Admin</span>
                    )}
                    <div className="muted">
                      {user.holder ? 'Titular' : 'Dependente'}
                      <span className="show-sm"> · CPF {formatCpf(user.document_number)}</span>
                    </div>
                  </td>
                  <td className="hide-sm">{formatCpf(user.document_number)}</td>
                  <td className="hide-sm">{user.user_group?.description}</td>
                  <td>
                    <span className={user.active ? 'badge badge-finalizado' : 'badge badge-trancado'}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="row-actions">
                    {!(isGuestAdmin && user.holder) && (
                      <button className="btn btn-ghost btn-icon danger" aria-label={`Excluir ${user.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                remove(user)
                              }}>
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={users.data.meta} onChange={setPage} />
        </div>
      )}
    </div>
  )
}
