# CDL Saúde — Painel do associado

Front-end do painel do associado (a empresa filiada) do CDL Saúde. Busca todos os dados pela API do
painel do associado do projeto `cdl-saude` (`/api/v1/associate_panel`, documentada em
`cdl-saude/docs/api.md`).

React 19 + TypeScript + Vite, React Router, `lucide-react` para os ícones e SheetJS (`xlsx`) para ler
as planilhas de importação. Mesma base visual do `cdl-saude-usuarios` (tema claro/escuro, barra
lateral no computador, barra inferior no celular).

## Telas

| Rota | O que faz |
|---|---|
| `/entrar` | Login com CPF/CNPJ do associado (ou CPF de um usuário administrador) e senha |
| `/` | Painel: guias no mês e no total, usuários ativos, conveniados, guias por mês, procedimentos mais usados, últimas guias e o que precisa de atenção |
| `/guias` | Guias dos funcionários e dependentes, com busca, filtro por situação, impressão e paginação |
| `/guias/nova` | Beneficiário → conveniado → procedimentos (vários, com total) → gera a guia |
| `/guias/:id` | Detalhe: adicionar procedimentos por busca, remover, finalizar, imprimir, excluir |
| `/usuarios` | Funcionários e dependentes, com busca e filtro de titulares |
| `/usuarios/novo`, `/usuarios/:id` | Cadastro e edição (grupo, titular do dependente, administrador do associado, endereço); a edição lista os dependentes |
| `/usuarios/importar` | Importação por planilha (.xlsx, .xls, .csv), com resultado e planilha de conferência dos não importados |
| `/rede` | Rede de atendimento, com os procedimentos e preços de cada conveniado |
| `/perfil` | Foto, dados do associado (só leitura), troca de senha e tema |

## Rodando em desenvolvimento

O Rails precisa estar de pé (por padrão em `http://localhost:3000`). O Vite repassa `/api` e
`/rails` para ele, então não é preciso configurar CORS.

```bash
npm install
npm run dev
```

Para apontar para outro backend: `BACKEND_URL=http://localhost:4000 npm run dev`.

"Esqueci minha senha" leva para a redefinição do painel web (código por e-mail), que fica em
`VITE_WEB_URL` (`.env.development` aponta para `http://localhost:3000`).

## Produção

```bash
npm run build   # gera dist/
```

Igual ao painel do usuário: sirva `dist/` no mesmo domínio do Rails encaminhando `/api` e `/rails`
(rotas desconhecidas caem no `index.html`), ou gere com `VITE_API_URL=https://api.exemplo.com` e
libere CORS no Rails. Defina `VITE_WEB_URL` com o endereço do painel web, se ele estiver em outro
domínio.

## Sessão

O token JWT (12 h) fica no `localStorage`. Quando a API responde 401 — token vencido ou conta
desativada — o app volta para a tela de login.
