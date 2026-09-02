-- Migration: 00025_seed.sql
-- Seed data for demo and initial setup

-- Demo Organization
INSERT INTO organizations (id, name, business_type, registration_number, phone, email, address, currency, timezone, status)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'MediFlow Demo Pharmacy',
    'pharmacy',
    'REG-2024-001',
    '+256700123456',
    'demo@mediflow.com',
    'Plot 123, Kampala Road, Kampala, Uganda',
    'UGX',
    'Africa/Kampala',
    'active'
) ON CONFLICT DO NOTHING;

-- Main Branch
INSERT INTO branches (id, organization_id, name, code, phone, address, is_active)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Main Branch',
    'MB01',
    '+256700123457',
    'Plot 123, Kampala Road, Kampala, Uganda',
    true
) ON CONFLICT DO NOTHING;

-- Permissions
INSERT INTO permissions (id, code, name, description) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'products.view', 'View Products', 'Can view product list'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'products.create', 'Create Products', 'Can create new products'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'products.edit', 'Edit Products', 'Can edit product details'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'products.delete', 'Delete Products', 'Can delete products'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'sales.view', 'View Sales', 'Can view sales list'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'sales.create', 'Create Sales', 'Can create new sales'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'sales.void', 'Void Sales', 'Can void sales'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'purchases.view', 'View Purchases', 'Can view purchase orders'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'purchases.create', 'Create Purchases', 'Can create purchase orders'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'purchases.receive', 'Receive Purchases', 'Can receive purchase orders'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'inventory.view', 'View Inventory', 'Can view inventory'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'inventory.adjust', 'Adjust Inventory', 'Can adjust inventory'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'reports.view', 'View Reports', 'Can view reports'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'settings.manage', 'Manage Settings', 'Can manage organization settings'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'users.manage', 'Manage Users', 'Can manage user accounts and roles'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'expenses.view', 'View Expenses', 'Can view expenses'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'expenses.create', 'Create Expenses', 'Can create expenses'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'customers.view', 'View Customers', 'Can view customers'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'customers.manage', 'Manage Customers', 'Can create/edit customers'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'returns.process', 'Process Returns', 'Can process returns')
ON CONFLICT (code) DO NOTHING;

-- System Roles
INSERT INTO roles (id, organization_id, name, description, is_system_role) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Owner', 'Full system access', true),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Administrator', 'Administrative access', true),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Manager', 'Branch management access', true),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cashier', 'Sales and POS access', true),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Stock Manager', 'Inventory management access', true)
ON CONFLICT DO NOTHING;

-- Role-Permission mappings
-- Owner gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', id FROM permissions
ON CONFLICT DO NOTHING;

-- Administrator gets most permissions except settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', id FROM permissions
WHERE code NOT IN ('settings.manage', 'users.manage')
ON CONFLICT DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', id FROM permissions
WHERE code IN ('products.view', 'products.create', 'products.edit', 'sales.view', 'sales.create', 'sales.void',
               'purchases.view', 'purchases.create', 'purchases.receive', 'inventory.view', 'inventory.adjust',
               'reports.view', 'expenses.view', 'expenses.create', 'customers.view', 'customers.manage', 'returns.process')
ON CONFLICT DO NOTHING;

-- Cashier permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', id FROM permissions
WHERE code IN ('products.view', 'sales.view', 'sales.create', 'customers.view', 'customers.manage', 'returns.process')
ON CONFLICT DO NOTHING;

-- Stock Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', id FROM permissions
WHERE code IN ('products.view', 'products.create', 'products.edit', 'inventory.view', 'inventory.adjust',
               'purchases.view', 'purchases.create', 'purchases.receive')
ON CONFLICT DO NOTHING;

-- Sample Categories
INSERT INTO categories (id, organization_id, name, description) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Antibiotics', 'Antibacterial medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Pain Relief', 'Analgesics and antipyretics'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Vitamins', 'Vitamins and supplements'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Antimalarials', 'Antimalarial medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Gastrointestinal', 'Digestive system medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Respiratory', 'Respiratory system medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dermatology', 'Skin care medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cardiovascular', 'Heart and blood vessel medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Diabetes', 'Diabetes management medications'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'First Aid', 'First aid supplies')
ON CONFLICT DO NOTHING;

-- Sample Units
INSERT INTO units (id, organization_id, name, abbreviation) VALUES
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Tablet', 'tab'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Capsule', 'cap'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Syrup', 'syp'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Injection', 'inj'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ointment', 'oint'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Drops', 'drop'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cream', 'crm'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Suspension', 'susp'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Suppository', 'sup'),
    ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sachet', 'sach')
ON CONFLICT DO NOTHING;

-- Sample Products
INSERT INTO products (id, organization_id, category_id, unit_id, name, generic_name, brand_name, sku, barcode, reorder_level) VALUES
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Amoxicillin 500mg', 'Amoxicillin', 'Amoxil', 'AMX-500', '6291234567890', 100),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Paracetamol 500mg', 'Paracetamol', 'Panadol', 'PCM-500', '6291234567891', 200),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Vitamin C 1000mg', 'Ascorbic Acid', 'Redoxon', 'VTC-1000', '6291234567892', 50),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Artemether-Lumefantrine', 'ACT', 'Coartem', 'ACT-20', '6291234567893', 100),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'ORS Sachet', 'Oral Rehydration Salts', 'ORS', 'ORS-SCH', '6291234567894', 150),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Cetirizine 10mg', 'Cetirizine', 'Zyrtec', 'CTZ-10', '6291234567895', 80),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'Betamethasone Cream', 'Betamethasone', 'Betnovate', 'BET-CRM', '6291234567896', 30),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Amlodipine 5mg', 'Amlodipine', 'Norvasc', 'AML-5', '6291234567897', 60),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Metformin 500mg', 'Metformin', 'Glucophage', 'MET-500', '6291234567898', 100),
    ('10eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Ibuprofen 400mg', 'Ibuprofen', 'Brufen', 'IBU-400', '6291234567899', 120)
ON CONFLICT DO NOTHING;

-- Sample Suppliers
INSERT INTO suppliers (id, organization_id, name, contact_person, phone, email, address) VALUES
    ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Medipharm Uganda Ltd', 'James Okello', '+256700987654', 'orders@medipharm.co.ug', 'Industrial Area, Kampala'),
    ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Quality Chemicals Ltd', 'Sarah Nambogo', '+256700876543', 'info@qualitychem.co.ug', 'Namanve Industrial Park'),
    ('20eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cipla Quality Chemicals', 'Peter Mugisha', '+256700765432', 'sales@cipla.co.ug', 'Jinja Road, Kampala')
ON CONFLICT DO NOTHING;

-- Organization Settings
INSERT INTO organization_settings (organization_id, receipt_header, receipt_footer, default_tax_rate, default_currency, low_stock_threshold, expiry_warning_days)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'MediFlow Demo Pharmacy\nThank you for your purchase!',
    'For inquiries: +256700123456\nEmail: demo@mediflow.com',
    18.00,
    'UGX',
    10,
    90
) ON CONFLICT (organization_id) DO NOTHING;

-- Branch Settings
INSERT INTO branch_settings (branch_id, receipt_prefix, invoice_prefix, default_payment_method)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'RCP',
    'INV',
    'CASH'
) ON CONFLICT (branch_id) DO NOTHING;
