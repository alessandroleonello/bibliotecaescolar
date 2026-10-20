-- ============================================================================
-- BIBLIOTECA ESCOLAR (MULTI-ESCOLA) - SUPABASE SCHEMA & RLS POLICIES
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================================

-- 1. TABELA DE ESCOLAS (Schools)
CREATE TABLE IF NOT EXISTS public.schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    settings JSONB NOT NULL DEFAULT '{
        "loanDays": 14,
        "maxLoansPerStudent": 2,
        "renewalsAllowed": 1,
        "blockIfOverdue": true,
        "publicCatalogEnabled": true,
        "requestHoldHours": 48,
        "grades": ["6º ano", "7º ano", "8º ano", "9º ano", "1º EM", "2º EM", "3º EM"],
        "categories": [
            "Literatura Brasileira", "Literatura Estrangeira", "Infantojuvenil",
            "Ficção Científica", "História & Geografia", "Ciências", "Poesia",
            "Didático", "Quadrinhos / HQ", "Outros"
        ]
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE PERFIS DE USUÁRIOS (Profiles vinculados ao auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'school_admin', 'staff')),
    school_id TEXT REFERENCES public.schools(id) ON DELETE SET NULL,
    school_name TEXT,
    job_title TEXT DEFAULT 'Bibliotecário',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE LIVROS (Books)
CREATE TABLE IF NOT EXISTS public.books (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    authors TEXT[] NOT NULL DEFAULT '{}',
    publisher TEXT DEFAULT '',
    isbn TEXT DEFAULT '',
    category TEXT DEFAULT 'Geral',
    year INT,
    edition TEXT DEFAULT '',
    synopsis TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    shelf_location TEXT DEFAULT '',
    total_copies INT DEFAULT 0,
    available_copies INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE EXEMPLARES / CÓPIAS / TOMBOS (Copies)
CREATE TABLE IF NOT EXISTS public.copies (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'loaned', 'lost', 'damaged', 'withdrawn')),
    condition TEXT DEFAULT 'Bom',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);

-- 5. TABELA DE ALUNOS (Students)
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ra TEXT NOT NULL,
    ra_digit TEXT DEFAULT '',
    grade TEXT DEFAULT '',
    classroom TEXT DEFAULT '',
    shift TEXT DEFAULT 'Manhã',
    active BOOLEAN DEFAULT TRUE,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
    import_batch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, ra)
);

-- 6. TABELA DE EMPRÉSTIMOS (Loans)
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    copy_id TEXT NOT NULL REFERENCES public.copies(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    loaned_at TIMESTAMPTZ DEFAULT NOW(),
    due_at TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    renewals INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'returned', 'lost')),
    loaned_by TEXT DEFAULT 'Bibliotecário',
    returned_by TEXT,
    request_id TEXT
);

-- 7. TABELA DE SOLICITAÇÕES PÚBLICAS DE EMPRÉSTIMO (Loan Requests)
CREATE TABLE IF NOT EXISTS public.loan_requests (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    book_title TEXT NOT NULL,
    student_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    student_ra TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    handled_by TEXT,
    handled_at TIMESTAMPTZ,
    rejection_reason TEXT
);

-- 8. TABELA DE HEARTBEAT (KEEP-ALIVE ANTI-PAUSA DE 7 DIAS)
CREATE TABLE IF NOT EXISTS public.heartbeat (
    id INT PRIMARY KEY DEFAULT 1,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    pings_count BIGINT DEFAULT 1
);
INSERT INTO public.heartbeat (id, last_ping, pings_count)
VALUES (1, NOW(), 1)
ON CONFLICT (id) DO NOTHING;

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_books_school ON public.books(school_id);
CREATE INDEX IF NOT EXISTS idx_copies_school_book ON public.copies(school_id, book_id);
CREATE INDEX IF NOT EXISTS idx_copies_code ON public.copies(school_id, code);
CREATE INDEX IF NOT EXISTS idx_students_school_ra ON public.students(school_id, ra);
CREATE INDEX IF NOT EXISTS idx_loans_school_status ON public.loans(school_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_student ON public.loans(student_id);
CREATE INDEX IF NOT EXISTS idx_loan_requests_school_status ON public.loan_requests(school_id, status);

-- ============================================================================
-- TRIGGER AUTOMÁTICO: ATUALIZA CONTAGEM DE CÓPIAS DISPONÍVEIS NO LIVRO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_book_copies_count()
RETURNS TRIGGER AS $$
DECLARE
    target_book_id TEXT;
    target_school_id TEXT;
BEGIN
    target_book_id := COALESCE(NEW.book_id, OLD.book_id);
    target_school_id := COALESCE(NEW.school_id, OLD.school_id);

    UPDATE public.books
    SET 
        total_copies = (SELECT COUNT(*) FROM public.copies WHERE book_id = target_book_id),
        available_copies = (SELECT COUNT(*) FROM public.copies WHERE book_id = target_book_id AND status = 'available'),
        updated_at = NOW()
    WHERE id = target_book_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_copies_count ON public.copies;
CREATE TRIGGER trg_sync_copies_count
AFTER INSERT OR UPDATE OR DELETE ON public.copies
FOR EACH ROW EXECUTE FUNCTION public.sync_book_copies_count();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeat ENABLE ROW LEVEL SECURITY;

-- Helper function: papel do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: escola do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS TEXT AS $$
    SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- POLÍTICAS: ESCOLAS
DROP POLICY IF EXISTS "Permitir leitura pública de escolas ativas" ON public.schools;
CREATE POLICY "Permitir leitura pública de escolas ativas" ON public.schools
    FOR SELECT USING (status = 'active' OR public.get_auth_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin gerencia escolas" ON public.schools;
CREATE POLICY "Superadmin gerencia escolas" ON public.schools
    FOR ALL USING (public.get_auth_role() = 'superadmin');

-- POLÍTICAS: LIVROS
DROP POLICY IF EXISTS "Catálogo público pode ler livros de escolas ativas" ON public.books;
CREATE POLICY "Catálogo público pode ler livros de escolas ativas" ON public.books
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Funcionários gerenciam livros da própria escola" ON public.books;
CREATE POLICY "Funcionários gerenciam livros da própria escola" ON public.books
    FOR ALL USING (school_id = public.get_auth_school_id());

-- POLÍTICAS: EXEMPLARES / CÓPIAS
DROP POLICY IF EXISTS "Funcionários gerenciam cópias da própria escola" ON public.copies;
CREATE POLICY "Funcionários gerenciam cópias da própria escola" ON public.copies
    FOR ALL USING (school_id = public.get_auth_school_id());

-- POLÍTICAS: ALUNOS
DROP POLICY IF EXISTS "Funcionários gerenciam alunos da própria escola" ON public.students;
CREATE POLICY "Funcionários gerenciam alunos da própria escola" ON public.students
    FOR ALL USING (school_id = public.get_auth_school_id());

-- POLÍTICAS: EMPRÉSTIMOS
DROP POLICY IF EXISTS "Funcionários gerenciam empréstimos da própria escola" ON public.loans;
CREATE POLICY "Funcionários gerenciam empréstimos da própria escola" ON public.loans
    FOR ALL USING (school_id = public.get_auth_school_id());

-- POLÍTICAS: SOLICITAÇÕES PÚBLICAS
DROP POLICY IF EXISTS "Alunos podem enviar solicitações" ON public.loan_requests;
CREATE POLICY "Alunos podem enviar solicitações" ON public.loan_requests
    FOR INSERT WITH CHECK (status = 'pending' AND length(student_name) >= 3);

DROP POLICY IF EXISTS "Funcionários gerenciam solicitações da própria escola" ON public.loan_requests;
CREATE POLICY "Funcionários gerenciam solicitações da própria escola" ON public.loan_requests
    FOR ALL USING (school_id = public.get_auth_school_id());

-- POLÍTICAS: HEARTBEAT (Permite ping público anônimo para manter banco ativo)
DROP POLICY IF EXISTS "Permitir leitura e ping do heartbeat" ON public.heartbeat;
CREATE POLICY "Permitir leitura e ping do heartbeat" ON public.heartbeat
    FOR ALL USING (true) WITH CHECK (true);

-- POLÍTICAS: PROFILES
DROP POLICY IF EXISTS "Usuários leem seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários leem seus próprios perfis" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.get_auth_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin gerencia perfis" ON public.profiles;
CREATE POLICY "Superadmin gerencia perfis" ON public.profiles
    FOR ALL USING (public.get_auth_role() = 'superadmin');

-- ============================================================================
-- FUNÇÃO RPC: ALTERAR / DEFINIR SENHA DE USUÁRIO (SUPERADMIN)
-- Permite que o superadmin defina a senha da dona da escola sem depender de e-mail
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_set_user_password(user_email TEXT, new_password TEXT)
RETURNS JSONB AS $$
DECLARE
    target_id UUID;
BEGIN
    IF public.get_auth_role() != 'superadmin' THEN
        RAISE EXCEPTION 'Acesso negado: apenas o Superadministrador pode alterar senhas diretamente.';
    END IF;

    IF length(new_password) < 6 THEN
        RAISE EXCEPTION 'A senha deve conter no mínimo 6 caracteres.';
    END IF;

    SELECT id INTO target_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(user_email));
    
    IF target_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado com este e-mail no Supabase Auth.');
    END IF;

    UPDATE auth.users
    SET 
        encrypted_password = crypt(new_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = target_id;

    RETURN jsonb_build_object('success', true, 'message', 'Senha alterada com sucesso.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
