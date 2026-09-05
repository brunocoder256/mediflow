-- Migration: 00053_safe_daily_sequences.sql
-- Make daily document-number generators concurrency-safe.
--
-- Problem: generate_sale_number (and siblings) computed next sequence via a plain
-- "read max + 1"; concurrent inserts (two cashiers, retried checkout, offline queue
-- syncing at the same time as a live sale) could both pick the same number, and the
-- UNIQUE constraint (e.g. sales_sale_number_key) rejected the second one, rolling back
-- a valid sale with "duplicate value violates unique key constraint".
--
-- Fix: each generator takes a transactional advisory lock keyed on (document, date).
-- The lock is held until the inserting transaction commits, so a concurrent insert for
-- the same date blocks, then reads the committed max and continues. Also compute the
-- true numeric max of the day's number suffix (regexp) instead of relying on
-- lexicographic order / fixed offsets, which is robust even if a row has an odd suffix.

CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(NEW.sold_at, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_sale:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(sale_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM sales
    WHERE sale_number LIKE v_date || '-%';
    NEW.sale_number := v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_purchase:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(purchase_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM purchase_orders
    WHERE purchase_number LIKE v_date || '-%';
    NEW.purchase_number := v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    IF new.return_number IS NOT NULL AND length(trim(new.return_number)) > 0 THEN
        RETURN new;
    END IF;
    v_date := to_char(coalesce(NEW.created_at, now()), 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_return:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(return_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM returns
    WHERE return_number LIKE 'RET-' || v_date || '-%';
    NEW.return_number := 'RET-' || v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_purchase_return_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    IF new.return_number IS NOT NULL AND length(trim(new.return_number)) > 0 THEN
        RETURN new;
    END IF;
    v_date := to_char(coalesce(NEW.created_at, now()), 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_pr:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(return_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM purchase_returns
    WHERE return_number LIKE 'PR-' || v_date || '-%';
    NEW.return_number := 'PR-' || v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(NEW.received_at, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_grn:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(grn_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM goods_receipts
    WHERE grn_number LIKE 'GRN-' || v_date || '-%';
    NEW.grn_number := 'GRN-' || v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_refund_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_refund:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(refund_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM refunds
    WHERE refund_number LIKE v_date || '-%';
    NEW.refund_number := v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_adjustment:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(adjustment_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM stock_adjustments
    WHERE adjustment_number LIKE v_date || '-%';
    NEW.adjustment_number := v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('ms_transfer:' || v_date)::bigint);
    SELECT COALESCE(MAX((regexp_match(transfer_number, '-([0-9]+)$'))[1]::int), 0) INTO v_seq
    FROM transfers
    WHERE transfer_number LIKE v_date || '-%';
    NEW.transfer_number := v_date || '-' || lpad((v_seq + 1)::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;