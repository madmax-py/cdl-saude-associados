import { ArrowLeft, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { ImportResult } from '../api/types'
import { Alert, PageHeader } from '../components/ui'

type Row = Record<string, unknown>

// A planilha é lida aqui no navegador (como no painel web) e as linhas vão
// para a API como JSON; quem entende as colunas é o UsersImportService.
async function readSpreadsheet(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx')
  const workbook = file.name.toLowerCase().endsWith('.csv')
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null })
}

async function downloadFailures(result: ImportResult) {
  const XLSX = await import('xlsx')
  const rows = result.nao_importados.map((f) => ({ Linha: f.linha, CPF: f.cpf, Nome: f.nome, Motivo: f.motivo }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Não importados')
  XLSX.writeFile(book, 'usuarios-nao-importados.xlsx')
}

export default function UserImport() {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pick(selected: File | undefined) {
    setResult(null)
    setError('')
    setRows(null)
    setFile(selected ?? null)
    if (!selected) return
    try {
      const data = await readSpreadsheet(selected)
      if (data.length === 0) setError('A planilha está vazia.')
      setRows(data)
    } catch {
      setError('Não foi possível ler o arquivo. Use uma planilha .xlsx, .xls ou .csv.')
    }
  }

  async function send() {
    if (!rows?.length) return
    setError('')
    setBusy(true)
    try {
      setResult(await api.post<ImportResult>('/users/import', { dados_json: JSON.stringify(rows) }))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const columns = rows?.length ? Object.keys(rows[0]) : []

  return (
    <div className="stack">
      <Link to="/usuarios" className="btn btn-ghost btn-sm back"><ArrowLeft size={16} /> Usuários</Link>
      <PageHeader title="Importar usuários" subtitle="Cadastre vários funcionários de uma vez a partir de uma planilha." />

      <section className="card stack">
        <h2>1. Escolha a planilha</h2>
        <p className="muted">
          Colunas reconhecidas: <strong>CPF</strong> (obrigatória), nome, e-mail, telefone, data de nascimento, sexo,
          grupo, CEP, rua, número, complemento, bairro e cidade. O que faltar recebe um valor padrão — o endereço,
          por exemplo, vem do associado.
        </p>
        <button type="button" className="dropzone" onClick={() => input.current?.click()}>
          <FileSpreadsheet size={28} />
          <span>{file ? file.name : 'Clique para escolher um arquivo .xlsx, .xls ou .csv'}</span>
          {rows && rows.length > 0 && <span className="muted">{rows.length} linha{rows.length > 1 ? 's' : ''} encontrada{rows.length > 1 ? 's' : ''}</span>}
        </button>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => pick(e.target.files?.[0])} />

        {rows && rows.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 3).map((row, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 3 && <p className="muted table-note">Prévia das 3 primeiras linhas.</p>}
          </div>
        )}

        <Alert>{error}</Alert>
        <div className="actions">
          <button className="btn btn-primary" disabled={!rows?.length || busy} onClick={send}>
            <Upload size={18} /> {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </section>

      {result && (
        <section className="card stack">
          <h2>2. Resultado</h2>
          <Alert tone={result.status === 'success' ? 'success' : result.status === 'partial' ? 'info' : 'danger'}>
            {result.resumo}
          </Alert>
          {result.nao_importados.length > 0 && (
            <>
              <div className="section-head">
                <h2>Não importados ({result.nao_importados_count})</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => downloadFailures(result)}>
                  <Download size={16} /> Baixar planilha de conferência
                </button>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead><tr><th>Linha</th><th>CPF</th><th>Nome</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {result.nao_importados.map((f) => (
                      <tr key={`${f.linha}-${f.cpf}`}><td>{f.linha}</td><td>{f.cpf}</td><td>{f.nome}</td><td>{f.motivo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="actions">
            <Link to="/usuarios" className="btn btn-primary">Ver usuários</Link>
          </div>
        </section>
      )}
    </div>
  )
}
