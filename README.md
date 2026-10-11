# 📚 Sistema de Biblioteca Escolar (Multi-Escola) — Supabase Edition

Sistema integrado de gestão para bibliotecas escolares com arquitetura Serverless moderna baseada no **Supabase** (PostgreSQL + Auth + Row Level Security), suporte completo a múltiplas escolas, gestão manual de códigos/tombos de exemplares, CRUD de categorias, importação de planilhas SED, circulação com leitor de código de barras e catálogo público online para alunos.

---

## ⚡ 100% Gratuito: Solução para a Pausa de 7 Dias do Supabase

> **Atenção:** No plano gratuito do Supabase, projetos inativos por mais de 7 dias entram em modo de suspensão (*paused*). **Neste projeto, esse problema está 100% resolvido sem necessidade de plano pago.**

### Como funciona o Keep-Alive automático:
1. **GitHub Actions (`.github/workflows/supabase-keepalive.yml`):**
   - Roda a cada 3 dias via cron no GitHub.
   - Dispara um ping HTTP leve para a tabela `heartbeat` do Supabase usando a REST API anônima.
   - Isso conta como atividade oficial no banco, **impedindo permanentemente que o Supabase congele o projeto**.
2. **Ping no Frontend (`public/js/supabase.js`):**
   - Sempre que o sistema administrativo ou o catálogo público do aluno é acessado, um ping silencioso é registrado.

---

## 🚀 Arquitetura e Tecnologias

- **Front-end:** HTML5, CSS3 moderno e Vanilla JavaScript (ES Modules nativos). **Sem etapas de build, sem frameworks pesados, sem dependências Node no cliente.**
- **Backend / Banco de Dados:** **Supabase** (PostgreSQL 15 com Row Level Security e Triggers automáticos).
- **Autenticação:** Supabase Auth (e-mail institucional e senhas criptografadas).
- **Sincronização Atômica:** Trigger PostgreSQL (`trg_sync_copies_count`) que recalcula automaticamente o total de cópias e exemplares disponíveis sempre que uma cópia é inserida, atualizada ou devolvida.
- **Modo Offline / Demonstração:** Se as credenciais do Supabase não forem inseridas de imediato, o sistema entra automaticamente em modo de simulação local com dados predefinidos no navegador (`localStorage`), permitindo testes imediatos.

---

## 📁 Estrutura de Pastas

```
/
├─ .github/
│  └─ workflows/
│     └─ supabase-keepalive.yml   # Automação gratuita contra a pausa de 7 dias
├─ supabase-schema.sql            # Script SQL completo (tabelas, RLS, triggers, índices)
├─ public/
│  ├─ index.html                  # Painel administrativo SPA (Superadmin, Gestor, Bibliotecário)
│  ├─ catalogo.html               # Portal público de consulta de acervo para alunos
│  ├─ css/
│  │  ├─ base.css                 # Design tokens, tipografia moderna e resets
│  │  ├─ components.css           # Botões, cards, tabelas, modais, toasts, badges
│  │  └─ pages.css                # Layout com sidebar colapsável e responsividade
│  ├─ js/
│  │  ├─ supabase-config.js       # Credenciais do Supabase (URL e Anon Key)
│  │  ├─ supabase.js              # Inicialização modular do cliente Supabase v2
│  │  ├─ auth.js                  # Login, perfis, recuperação de senha e demo
│  │  ├─ router.js                # Roteador SPA por hash com controle de papéis
│  │  ├─ db/
│  │  │  ├─ schools.js            # Escolas, categorias e funcionários
│  │  │  ├─ books.js              # Acervo bibliográfico e busca por tombo
│  │  │  ├─ copies.js             # Exemplares físicos e códigos customizados
│  │  │  ├─ students.js           # Cadastro e importação de alunos (SED)
│  │  │  ├─ loans.js              # Circulação, empréstimos, devoluções e renovações
│  │  │  └─ requests.js           # Fila de solicitações do catálogo online
│  │  ├─ pages/                   # Controladores de tela (login, livros, empréstimos, etc.)
│  │  └─ ui/                      # Modais acessíveis e notificações toast
└─ plano-implementacao-biblioteca.md
```

---

## 🛠️ Como Configurar o Supabase (Passo a Passo)

### 1. Criar um projeto gratuito no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Clique em **New Project**, escolha um nome (ex: `Biblioteca-Escolar`) e defina a senha do banco.

### 2. Executar o Script de Banco de Dados
1. No painel do seu projeto no Supabase, acesse o menu **SQL Editor** na barra lateral.
2. Clique em **New query**.
3. Copie todo o conteúdo do arquivo [`supabase-schema.sql`](supabase-schema.sql) e cole no editor.
4. Clique em **Run**. O script criará:
   - Todas as tabelas (`schools`, `profiles`, `books`, `copies`, `students`, `loans`, `loan_requests`, `heartbeat`).
   - Políticas de segurança Row Level Security (RLS).
   - O trigger automático de contagem de exemplares.
   - Os dados iniciais de demonstração.

### 3. Conectar a Aplicação ao seu Supabase
Existem duas maneiras:

**Opção A (Pelo Navegador, sem mexer no código):**
1. Abra a aplicação e, na tela de login, clique em **⚡ Configurar chaves do Supabase**.
2. Cole sua **Project URL** e a **Project Anon Key** (encontradas no menu **Project Settings -> API** do painel do Supabase).
3. Clique em **Salvar Credenciais**.

**Opção B (Direto no arquivo de configuração):**
Abra o arquivo [`public/js/supabase-config.js`](public/js/supabase-config.js) e insira suas credenciais:
```javascript
export const supabaseConfig = {
  url: "https://seu-projeto.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
};
```

---

## ⏰ Ativar o Keep-Alive Gratuito no GitHub Actions

Para garantir que o Supabase nunca suspenda o seu banco por inatividade:
1. Suba o projeto para um repositório no seu GitHub.
2. No repositório, acesse **Settings -> Secrets and variables -> Actions**.
3. Crie dois segredos (**New repository secret**):
   - `SUPABASE_URL`: sua URL do Supabase (ex: `https://xyz.supabase.co`)
   - `SUPABASE_ANON_KEY`: sua chave pública `anon`
4. A Action `.github/workflows/supabase-keepalive.yml` será executada automaticamente a cada 3 dias e manterá seu banco ativo sem você precisar pagar nada!

---

## 💻 Como Rodar Localmente

Basta servir a pasta do projeto com qualquer servidor web estático:

### Via Python:
```bash
python -m http.server 8085
```
Acesse no navegador: `http://localhost:8085/public/index.html`

### Via VS Code:
Instale a extensão **Live Server**, clique com o botão direito em `public/index.html` e selecione *Open with Live Server*.

---

## 🔑 Perfis de Acesso de Demonstração

Na tela de login, você pode testar imediatamente usando os atalhos:
1. **👑 Superadmin (Dono da Plataforma):** Gestão geral de todas as escolas cadastradas.
2. **🏫 Gestor Escolar (Diretoria):** Gestão do acervo da sua unidade escolar, equipe de bibliotecários e categorias.
3. **📖 Bibliotecário:** Balcão de atendimento, empréstimos com leitor de código de barras, devoluções, importação de alunos via SED e cadastro de exemplares com tombos manuais.
4. **🎓 Aluno:** Acessa `public/catalogo.html` (não requer senha), pesquisa títulos e solicita reserva para retirada.
