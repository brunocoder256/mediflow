-- Migration: 00032_functions_triggers.sql
-- Functions, triggers, and procedural helpers

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_sale text;
BEGIN
    v_date := to_char(NEW.sold_at, 'YYYYMMDD');
    SELECT sale_number INTO v_last_sale
    FROM sales
    WHERE sale_number LIKE v_date || '-%'
    ORDER BY sale_number DESC
    LIMIT 1;

    IF v_last_sale IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_sale from 9 for 6)::integer + 1;
    END IF;

    NEW.sale_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_po text;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    SELECT purchase_number INTO v_last_po
    FROM purchase_orders
    WHERE purchase_number LIKE v_date || '-%'
    ORDER BY purchase_number DESC
    LIMIT 1;

    IF v_last_po IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_po from 9 for 6)::integer + 1;
    END IF;

    NEW.purchase_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_return text;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    SELECT return_number INTO v_last_return
    FROM returns
    WHERE return_number LIKE v_date || '-%'
    ORDER BY return_number DESC
    LIMIT 1;

    IF v_last_return IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_return from 9 for 6)::integer + 1;
    END IF;

    NEW.return_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_refund_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_refund text;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    SELECT refund_number INTO v_last_refund
    FROM refunds
    WHERE refund_number LIKE v_date || '-%'
    ORDER BY refund_number DESC
    LIMIT 1;

    IF v_last_refund IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_refund from 9 for 6)::integer + 1;
    END IF;

    NEW.refund_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_adj text;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    SELECT adjustment_number INTO v_last_adj
    FROM stock_adjustments
    WHERE adjustment_number LIKE v_date || '-%'
    ORDER BY adjustment_number DESC
    LIMIT 1;

    IF v_last_adj IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_adj from 9 for 6)::integer + 1;
    END IF;

    NEW.adjustment_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_transfer text;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    SELECT transfer_number INTO v_last_transfer
    FROM transfers
    WHERE transfer_number LIKE v_date || '-%'
    ORDER BY transfer_number DESC
    LIMIT 1;

    IF v_last_transfer IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_transfer from 9 for 6)::integer + 1;
    END IF;

    NEW.transfer_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_purchase_return_number()
RETURNS trigger AS $$
DECLARE
    v_date text;
    v_seq integer;
    v_last_pr text;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    SELECT return_number INTO v_last_pr
    FROM purchase_returns
    WHERE return_number LIKE v_date || '-%'
    ORDER BY return_number DESC
    LIMIT 1;

    IF v_last_pr IS NULL THEN
        v_seq := 1;
    ELSE
        v_seq := substring(v_last_pr from 9 for 6)::integer + 1;
    END IF;

    NEW.return_number := v_date || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_ensure_batch_available(
    p_product_id uuid,
    p_branch_id uuid,
    p_batch_id uuid,
    p_quantity integer,
    p_movement_type text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_available integer;
BEGIN
    IF p_movement_type = 'SALE' OR p_movement_type = 'SALE_RETURN' THEN
        SELECT quantity_available INTO v_available
        FROM product_batches
        WHERE id = p_batch_id;

        IF v_available IS NULL OR v_available < p_quantity THEN
            RETURN false;
        END IF;
    END IF;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION fn_reduce_batch_quantity(
    p_batch_id uuid,
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE product_batches
    SET quantity_available = quantity_available - p_quantity,
        updated_at = now()
    WHERE id = p_batch_id
    AND quantity_available >= p_quantity;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient batch quantity for batch %', p_batch_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_increase_batch_quantity(
    p_batch_id uuid,
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE product_batches
    SET quantity_available = quantity_available + p_quantity,
        updated_at = now()
    WHERE id = p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_batch_for_sale(
    p_product_id uuid,
    p_branch_id uuid,
    p_quantity integer
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_batch_id uuid;
BEGIN
    SELECT pb.id INTO v_batch_id
    FROM product_batches pb
    WHERE pb.product_id = p_product_id
    AND pb.branch_id = p_branch_id
    AND pb.is_active = true
    AND pb.quantity_available >= p_quantity
    AND pb.expiry_date > CURRENT_DATE
    ORDER BY pb.expiry_date ASC
    LIMIT 1;

    RETURN v_batch_id;
END;
$$;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_product_batches_updated_at
    BEFORE UPDATE ON product_batches
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_stock_adjustments_updated_at
    BEFORE UPDATE ON stock_adjustments
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_transfers_updated_at
    BEFORE UPDATE ON transfers
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_purchase_returns_updated_at
    BEFORE UPDATE ON purchase_returns
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_stock_counts_updated_at
    BEFORE UPDATE ON stock_counts
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_stock_count_items_updated_at
    BEFORE UPDATE ON stock_count_items
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_sale_number
    BEFORE INSERT ON sales
    FOR EACH ROW EXECUTE FUNCTION generate_sale_number();

CREATE TRIGGER trg_purchase_number
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION generate_purchase_number();

CREATE TRIGGER trg_return_number
    BEFORE INSERT ON returns
    FOR EACH ROW EXECUTE FUNCTION generate_return_number();

CREATE TRIGGER trg_refund_number
    BEFORE INSERT ON refunds
    FOR EACH ROW EXECUTE FUNCTION generate_refund_number();

CREATE TRIGGER trg_adjustment_number
    BEFORE INSERT ON stock_adjustments
    FOR EACH ROW EXECUTE FUNCTION generate_adjustment_number();

CREATE TRIGGER trg_transfer_number
    BEFORE INSERT ON transfers
    FOR EACH ROW EXECUTE FUNCTION generate_transfer_number();

CREATE TRIGGER trg_purchase_return_number
    BEFORE INSERT ON purchase_returns
    FOR EACH ROW EXECUTE FUNCTION generate_purchase_return_number();