# Plano de Implementação — Sistema de Biblioteca Escolar (multi-escola)

> Documento para o agente do Antigravity IDE. Trabalhe **fase por fase** (seção 11): ao fim de cada fase, resuma o que foi feito, como testar e peça confirmação antes de seguir.

**Restrições do projeto (obrigatórias)**
- Front-end em **HTML, CSS e JavaScript puros** (ES Modules). **Sem frameworks e sem etapa de build** (nada de React, Vue, Vite, npm no front).
- **Sem Cloud Functions.** Toda a lógica roda no navegador, protegida por **Firestore Security Rules**. O projeto deve funcionar no plano gratuito (**Spark**) do Firebase.
- Banco: **Cloud Firestore**. Login: **Firebase Authentication** (e-mail/senha). Hospedagem: **Firebase Hosting** (estático).

---

## 1. Visão geral

| Perfil | Quem é | O que faz |
|---|---|---|
| `superadmin` | Dono da plataforma | Cadastra, ativa e desativa escolas (pelo e-mail da escola). |
| `school_admin` | Gestor da escola | Configura a escola e gerencia funcionários, acervo, alunos, regras e relatórios. |
| `staff` | Funcionário/bibliotecário | Opera empréstimos, devoluções e solicitações; cadastra livros e alunos. |
| Aluno (sem login) | Visitante do link público | Vê o catálogo e envia uma solicitação de empréstimo por formulário. |

**Fluxo central**
1. Superadmin cadastra a escola pelo e-mail → a escola recebe e-mail para criar a senha.
2. A escola configura tudo: livros, cópias, alunos (manual ou planilha SED) e funcionários.
3. Empréstimo e devolução feitos pelo funcionário no balcão ou a partir de uma solicitação do aluno no link público.

---

## 2. Stack e bibliotecas (todas via CDN, sem build)

- **HTML5 + CSS3 + JavaScript (ES Modules)**; CSS próprio com variáveis (`:root`), Flexbox/Grid, responsivo.
- **Firebase JS SDK modular** via CDN (`https://www.gstatic.com/firebasejs/<versão>/firebase-app.js`, `-auth.js`, `-firestore.js`, `-app-check.js`, `-storage.js` se usar upload de capa).
- **SheetJS (`xlsx`)** via CDN: leitura de `.xlsx/.xls/.csv` no navegador.
- **JsBarcode** e **qrcodejs** (CDN): etiquetas e QR Code do link público.
- **Ícones:** Lucide ou Phosphor via CDN (ou SVGs inline). **Fonte:** Inter (Google Fonts).
- **Ferramentas de desenvolvimento:** Firebase CLI + **Emulator Suite** (Auth, Firestore, Hosting) e servidor estático local. Testes das regras com `@firebase/rules-unit-testing` (somente como ferramenta de dev, fora do front).

> Pode-se baixar as bibliotecas para uma pasta `vendor/` e servi-las localmente, se preferir não depender de CDN.

---

## 3. Arquitetura sem backend

### 3.1 Papéis e multi-escola
- Sem Cloud Functions **não há custom claims**. O papel fica em `users/{uid}` no Firestore: `{ role, schoolId, name, email, active }`.
- As Security Rules leem esse documento com `get(/databases/$(database)/documents/users/$(request.auth.uid))`.
- Todo dado de uma escola fica em `schools/{schoolId}/...`; as regras só permitem acesso se `users/{uid}.schoolId == schoolId`.

### 3.2 Superadmin inicial
- Criado **manualmente** uma vez: criar o usuário no Console do Firebase (Authentication) e criar `users/{uid}` com `role: 'superadmin'` pelo Console.
- As regras **proíbem** qualquer cliente de criar ou alterar `role: 'superadmin'`.

### 3.3 Cadastro de escola pelo superadmin (sem Functions)
1. Superadmin informa nome + e-mail da escola.
2. O app cria o usuário no Auth usando uma **segunda instância do Firebase App** (`initializeApp(config, 'secondary')`), para não deslogar o superadmin, com senha aleatória temporária.
3. Grava `schools/{schoolId}` (nome, e-mail, slug, status) e `users/{uidNovo}` (`role: 'school_admin'`, `schoolId`).
4. Chama `sendPasswordResetEmail` (e-mail nativo do Firebase) para a escola **definir a própria senha**.
5. Reenviar convite = chamar `sendPasswordResetEmail` de novo.
- Mesma técnica para o `school_admin` cadastrar **funcionários** (`role: 'staff'`) na própria escola.
- **Desativar escola:** `schools/{id}.status = 'inactive'` e regras negam acesso ao acervo quando inativa.

### 3.4 Consistência de empréstimos sem servidor
- Empréstimo, devolução e renovação usam **`runTransaction`/`writeBatch`** no cliente, atualizando no mesmo ato: `loan`, `copy.status` e `book.availableCopies`.
- As **regras reforçam** a integridade usando `getAfter()`/`existsAfter()`: só permitem criar um `loan` se, na mesma operação, a cópia passar de `available` para `loaned`, e só permitem alterar `availableCopies` em ±1 junto com uma mudança de cópia.
- Reconhecer a limitação: sem servidor, a proteção depende das regras. Por isso as regras devem ser **bem testadas** (seção 7).

### 3.5 Tarefas "agendadas" sem Functions
- **Atrasos:** calculados na consulta (`status == 'open'` e `dueAt < agora`), sem rotina diária.
- **Solicitações vencidas:** o painel considera `expiresAt < agora` como "expirada" na exibição e as marca como `expired` ao abrir a fila.

---

## 4. Modelo de dados (Firestore)

```
users/{uid}                     -> { email, name, role, schoolId, active, createdAt }

schools/{schoolId}
  name, email, slug, status ('active'|'inactive'), createdAt, createdBy
  settings: {
    loanDays: 14, maxLoansPerStudent: 2, renewalsAllowed: 1,
    blockIfOverdue: true, publicCatalogEnabled: true,
    grades: ['6º ano', '7º ano', ... , '3º EM'],
    requestHoldHours: 48
  }

schools/{schoolId}/books/{bookId}
  title, authors[], publisher, isbn, category, tags[], year, edition,
  language, synopsis, coverUrl, shelfLocation,
  totalCopies, availableCopies,        // contadores (atualizados em transação)
  searchTokens[],                       // busca sem acento, em minúsculas
  active, createdAt, updatedAt

schools/{schoolId}/copies/{copyId}
  bookId, code (tombo/código de barras, único na escola),
  status ('available'|'loaned'|'lost'|'damaged'|'withdrawn'), condition, notes

schools/{schoolId}/students/{studentId}
  name, ra, raDigit, grade, classroom, shift, active,
  source ('manual'|'import'), importBatchId?

schools/{schoolId}/loans/{loanId}
  bookId, copyId, studentId,
  snapshot: { bookTitle, copyCode, studentName, grade },
  loanedAt, dueAt, returnedAt?, renewals,
  status ('open'|'returned'|'lost'), loanedBy, returnedBy?, requestId?

schools/{schoolId}/loanRequests/{requestId}
  bookId, bookTitle, studentName, grade, studentId?,
  status ('pending'|'approved'|'rejected'|'expired'),
  createdAt, expiresAt, handledBy?, handledAt?, rejectionReason?

schools/{schoolId}/importBatches/{batchId}   -> resumo e erros da importação
schools/{schoolId}/auditLogs/{logId}         -> { action, entity, entityId, userId, at }

publicSchools/{slug}                         -> { schoolId, name, enabled }   (leitura pública)
publicSchools/{slug}/books/{bookId}          -> { title, authors, category, coverUrl, synopsis, available }  (leitura pública)
```

**Catálogo público:** o funcionário, ao salvar um livro ou alterar disponibilidade, grava **no mesmo `writeBatch`** o espelho em `publicSchools/{slug}/books/{bookId}`. O aluno só lê essas coleções, nunca `copies`, `students` ou `loans`.

**Índices compostos previstos:** `loans (status, dueAt)`, `loans (studentId, status)`, `loanRequests (status, createdAt)`, `copies (bookId, status)`, `students (grade, name)`. Manter em `firestore.indexes.json`.

---

## 5. Regras de negócio

**Empréstimo** (transação): cópia `available`; aluno `active`; aluno abaixo de `maxLoansPerStudent`; (opcional) sem atrasos pendentes; `dueAt = hoje + loanDays`. Atualiza cópia, contador do livro, espelho público e cria o `loan`.

**Devolução:** marca `returned`, libera a cópia (ou marca `damaged`/`lost`), ajusta contadores e espelho público.

**Renovação:** respeita `renewalsAllowed`; bloqueia se houver solicitação pendente do mesmo livro sem cópia livre.

**Solicitação pública (sem login e sem Function):**
1. Aluno abre `/catalogo.html?escola=<slug>` → vê o catálogo (busca, categoria, selo Disponível/Indisponível).
2. Só pode solicitar livro com `available == true`.
3. Formulário: nome completo, série (select vindo de `settings.grades`) e livro.
4. O navegador faz `addDoc` direto em `schools/{id}/loanRequests` (permitido pelas regras apenas para **criação**, com validação rígida de campos, tamanhos e `status == 'pending'`).
5. **Proteção contra spam:** Firebase **App Check** com reCAPTCHA (v3 ou Enterprise) com enforcement no Firestore; honeypot no formulário; limite de tamanho de texto; bloqueio por tempo no `localStorage` (apenas dissuasório). Painel permite apagar solicitações em lote.
6. Funcionário abre **Solicitações**, confirma o aluno (busca por nome + série), escolhe a cópia física e clica **Aprovar** (gera o empréstimo) ou **Recusar** com motivo.
7. Aluno vê: "Solicitação enviada! Retire o livro na biblioteca até DD/MM."

---

## 6. Telas (um app de página única com roteamento por hash)

### 6.1 Superadmin
- **Dashboard** (totais de escolas ativas/inativas) e **Escolas** (listar, cadastrar, reenviar convite, ativar/desativar, copiar link público).

### 6.2 Escola (admin e funcionário)
- **Início:** empréstimos abertos, atrasados, devoluções de hoje, solicitações pendentes, atalhos "Novo empréstimo" e "Devolver".
- **Livros:** tabela com busca/filtros, cadastro/edição, capa por URL (ou upload ao Storage, se habilitado), preenchimento opcional por ISBN (Google Books / Open Library, via `fetch`).
- **Cópias:** gerar N cópias com códigos sequenciais, mudar status, **imprimir etiquetas** com código de barras/QR (CSS `@media print`).
- **Alunos:** lista por série/turma, cadastro manual, edição, inativar, histórico.
- **Importar alunos (planilha SED):** assistente de 4 passos: (1) enviar arquivo; (2) **mapear colunas** (nome, RA, dígito, série, turma…) com sugestão automática pelos cabeçalhos; (3) **pré-visualização** com validação (válidas, duplicadas, com erro); (4) confirmar importação em lotes de até 400 (`writeBatch`) com **upsert por RA**, barra de progresso e relatório de erros baixável.
- **Empréstimos:** fluxo em tela única: escanear/buscar aluno → escanear/buscar cópia → confirmar. Lista de abertos com filtro "atrasados", **Devolver** e **Renovar**.
- **Devoluções:** campo único para escanear/digitar o código da cópia.
- **Solicitações:** fila do link público com Aprovar/Recusar.
- **Relatórios:** atrasados (exportar `.xlsx` via SheetJS ou imprimir), histórico por período, livros mais emprestados, acervo por categoria.
- **Configurações:** dados da escola, regras de empréstimo, séries, **link público + QR Code**, gestão de funcionários.

### 6.3 Público
- `catalogo.html` — catálogo mobile-first, busca, filtros, modal de solicitação e confirmação.

---

## 7. Segurança (Firestore Rules)

- Funções auxiliares nas regras: `isSignedIn()`, `userDoc()`, `isSuperadmin()`, `isSchoolMember(schoolId)`, `isSchoolAdmin(schoolId)`, `schoolActive(schoolId)`.
- `superadmin`: lê e grava `schools/{id}` e `users` de `school_admin`; **não** precisa acessar o acervo.
- `school_admin`/`staff`: acesso total apenas ao próprio `schools/{schoolId}`; só `school_admin` gerencia `users` e `settings`.
- Ninguém altera o próprio `role`/`schoolId`; ninguém cria `superadmin` pelo cliente.
- Integridade de empréstimos via `getAfter()` (seção 3.4), validação de campos obrigatórios, tipos e tamanhos em toda escrita.
- Leitura pública **somente** em `publicSchools/**`; criação pública **somente** em `loanRequests` (com `status == 'pending'`, campos permitidos e sem leitura).
- Escola `inactive` perde acesso ao acervo.
- **Testar as regras** com o Emulator (`@firebase/rules-unit-testing`), incluindo casos de ataque: aluno tentando ler `students`, funcionário de outra escola, tentativa de mudar o próprio papel, empréstimo sem alterar a cópia.
- **LGPD:** coletar o mínimo (nome, RA, série, turma); permitir **exclusão/anonimização** de aluno; página simples de privacidade; nunca registrar dados reais de alunos em código, testes ou commits.
- Restringir a chave de API do Firebase por domínio (referrer) no Google Cloud e ativar App Check.
- Auditoria em `auditLogs` para ações sensíveis.

---

## 8. Diretrizes de UI/UX

- **Mobile-first** no catálogo público; **desktop-first** (com boa adaptação a tablet) no painel.
- Visual limpo e acolhedor: paleta suave, cantos arredondados, bom espaçamento, tipografia Inter, ícones consistentes, tema claro (escuro opcional via variáveis CSS).
- Menu lateral enxuto; empréstimo e devolução com o **mínimo de cliques**.
- **Uso por teclado e leitor de código de barras** (autofocus, Enter confirma).
- Feedback claro: toasts, skeletons de carregamento, estados vazios com instrução ("Nenhum livro ainda — cadastre o primeiro").
- Tabelas com busca, ordenação e paginação; confirmação antes de ações destrutivas.
- Acessibilidade (contraste AA, `label` em formulários, foco visível); textos em **pt-BR**, datas `dd/MM/yyyy`, fuso `America/Sao_Paulo`.
- Selos de status coloridos (Disponível, Emprestado, Atrasado, Pendente).

---

## 9. Estrutura de pastas

```
/
├─ public/
│  ├─ index.html              # app autenticado (superadmin + escola), SPA com hash router
│  ├─ catalogo.html           # página pública do aluno
│  ├─ css/
│  │  ├─ base.css             # reset, variáveis, tipografia
│  │  ├─ components.css       # botões, cards, tabelas, modais, toasts
│  │  └─ pages.css
│  ├─ js/
│  │  ├─ firebase.js          # init + instância secundária (criar usuários)
│  │  ├─ router.js
│  │  ├─ auth.js              # login, logout, guarda por papel
│  │  ├─ db/                  # books.js, copies.js, students.js, loans.js, requests.js, schools.js
│  │  ├─ pages/               # dashboard.js, books.js, students.js, import.js, loans.js, ...
│  │  ├─ ui/                  # toast.js, modal.js, table.js, dom helpers
│  │  └─ utils/               # dates.js, search.js (normalização/tokens), xlsx.js, barcode.js
│  └─ assets/
├─ firestore.rules
├─ firestore.indexes.json
├─ firebase.json              # hosting apontando para public/
├─ tests/rules.test.js        # testes das regras (apenas dev)
└─ README.md
```

---

## 10. Pontos de atenção (consequência de não usar Functions)

- **E-mails de convite** usam o modelo padrão do Firebase (`sendPasswordResetEmail`), personalizável no Console (texto e remetente).
- **Sem validação 100% no servidor:** a integridade depende de regras bem escritas e testadas.
- **Rate limit real não existe:** a defesa do formulário público é App Check + validação + limpeza pelo painel.
- **Contadores** (`availableCopies`) só mudam em transação; incluir no painel uma ação "**Recalcular contadores**" para o administrador corrigir eventuais divergências.
- **Cada `get()` nas regras conta como leitura** do Firestore; manter o documento `users/{uid}` pequeno e usar poucas chamadas por regra.
- Se um dia precisar de e-mails personalizados, notificação de atrasos ou limite de requisições, aí sim seria o caso de adicionar Functions (fora do escopo atual).

---

## 11. Fases de implementação

**Fase 0 — Fundação**
- Projeto Firebase (Auth, Firestore, Hosting), Emulator Suite, estrutura de pastas, `firebase.js`, CSS base (variáveis, componentes), roteador por hash, layout com menu lateral.
- ✅ Critério: app abre localmente com emuladores e mostra a tela de login.

**Fase 1 — Autenticação e superadmin**
- Login, recuperação de senha, guarda de rotas por papel (lendo `users/{uid}`), criação manual do superadmin.
- Tela **Escolas**: cadastrar (instância secundária + `sendPasswordResetEmail`), reenviar convite, ativar/desativar, copiar link.
- Regras base + testes.
- ✅ Critério: superadmin cadastra escola; a escola define a senha e entra.

**Fase 2 — Acervo**
- CRUD de livros, geração de cópias com código, status, busca por tokens, espelho em `publicSchools`, etiquetas imprimíveis.
- ✅ Critério: cadastrar livro, gerar 5 cópias e imprimir etiquetas.

**Fase 3 — Alunos e importação**
- CRUD de alunos, séries configuráveis, assistente de importação da planilha SED (mapeamento, preview, upsert por RA, relatório de erros).
- ✅ Critério: importar planilha de teste com ~500 alunos fictícios, com duplicados e linhas inválidas tratadas.

**Fase 4 — Empréstimos e devoluções**
- Transações de empréstimo, devolução e renovação; regras com `getAfter()`; telas de balcão e lista de atrasados.
- ✅ Critério: impossível emprestar cópia indisponível ou exceder limite; teste de concorrência com duas abas.

**Fase 5 — Catálogo público e solicitações**
- `catalogo.html`, formulário, App Check, regras de criação pública, fila de solicitações, aprovar → empréstimo, QR Code do link.
- ✅ Critério: aluno envia pedido pelo celular e o funcionário o transforma em empréstimo.

**Fase 6 — Dashboard, relatórios e acabamento**
- Dashboard, relatórios com exportação `.xlsx`/impressão, auditoria, "recalcular contadores", polimento visual e responsivo.
- ✅ Critério: checklist de UX revisado em desktop, tablet e celular.

**Fase 7 — Qualidade e publicação**
- Testes das regras (casos de ataque), revisão de índices, restrição da chave de API, deploy no Hosting (domínio próprio opcional), README e manual rápido para escolas.
- ✅ Critério: produção estável com uma escola-piloto.

---

## 12. Decisões em aberto

1. A solicitação do aluno **reserva** a cópia? Sugestão: **não reservar** (só mostra disponibilidade); a cópia é escolhida na aprovação.
2. Colunas exatas da **planilha da SED** (o assistente de mapeamento cobre variações; testar com planilha real sem dados identificáveis).
3. Upload de capas: usar **Firebase Storage** (exige habilitar) ou apenas URL/ISBN?
4. Multa ou suspensão por atraso: fora do escopo inicial.

---

## 13. Instruções para o agente

- Use apenas **HTML, CSS e JavaScript (ES Modules)**; não adicione frameworks, bundlers nem Cloud Functions.
- Separe responsabilidades por módulos (`db/`, `pages/`, `ui/`, `utils/`) e evite JavaScript inline no HTML.
- Evite estilos inline no HTML, prefira usar CSS.
- Escreva e teste as **Firestore Rules** antes de liberar cada módulo; toda regra de negócio crítica deve ser reforçada nelas, não só no front.
- Textos em **pt-BR**; datas `dd/MM/yyyy`; fuso `America/Sao_Paulo`.
- Use dados **fictícios** em testes e seeds.
- Ao final de cada fase: resumo do que foi feito, como testar e próximos passos.
