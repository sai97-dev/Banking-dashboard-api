-- Banking Dashboard API - Initial Schema
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  address       TEXT,
  date_of_birth DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts
CREATE TABLE accounts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id          UUID NOT NULL REFERENCES customers(id),
  account_number       VARCHAR(20) UNIQUE NOT NULL,
  account_type         VARCHAR(50) NOT NULL CHECK (account_type IN ('checking', 'savings', 'investment')),
  available_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  current_balance      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  currency             CHAR(3) NOT NULL DEFAULT 'USD',
  status               VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  daily_transfer_used  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  last_transaction_date TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          UUID NOT NULL REFERENCES accounts(id),
  type                VARCHAR(20) NOT NULL CHECK (type IN ('debit', 'credit', 'transfer')),
  amount              NUMERIC(15,2) NOT NULL,
  currency            CHAR(3) NOT NULL DEFAULT 'USD',
  status              VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  description         TEXT,
  reference_number    VARCHAR(50) UNIQUE,
  counterparty_name   VARCHAR(255),
  counterparty_account VARCHAR(50),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_account_id  UUID NOT NULL REFERENCES accounts(id),
  to_account_id    UUID NOT NULL REFERENCES accounts(id),
  amount           NUMERIC(15,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'USD',
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  description      TEXT,
  transfer_type    VARCHAR(20) DEFAULT 'internal',
  reference_number VARCHAR(50) UNIQUE,
  created_by       UUID REFERENCES customers(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES customers(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_accounts_customer_id ON accounts(customer_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_payments_from_account ON payments(from_account_id);
CREATE INDEX idx_payments_created_by ON payments(created_by);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Reset daily transfer limit (run via cron/scheduled job at midnight)
-- UPDATE accounts SET daily_transfer_used = 0.00;
