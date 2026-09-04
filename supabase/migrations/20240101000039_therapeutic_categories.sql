-- Migration: 00039_therapeutic_categories.sql
-- Seed full therapeutic categories per product.md Section 7

INSERT INTO categories (organization_id, name, description) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Analgesics / Pain Relief', 'Pain relief & analgesics'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Antipyretics', 'Fever reduction'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Anti-inflammatory', 'Anti-inflammatory agents'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Anti-infective / Antimicrobial', 'Antibiotics & antimicrobials'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Antimalarial', 'Antimalarial drugs'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Antiallergic / Antihistamine', 'Allergy & histamine'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Respiratory', 'Respiratory system'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Gastrointestinal', 'Digestive system'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cardiovascular', 'Heart & circulation'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Endocrine / Metabolic', 'Hormonal & metabolic'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dermatological', 'Skin'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ophthalmic', 'Eye'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Otic', 'Ear'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Oral / Dental', 'Mouth & dental'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Genitourinary', 'Genitourinary'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Reproductive / Maternal Health', 'Maternal & reproductive'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Vitamins & Minerals', 'Micronutrients'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Electrolytes / Rehydration', 'Fluids & rehydration'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Neurological', 'Nervous system'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Musculoskeletal', 'Bones & muscles'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Blood / Hematological', 'Blood disorders'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Immunological', 'Immune system'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Other / Unclassified', 'Unclassified')
ON CONFLICT (organization_id, name) DO NOTHING;
