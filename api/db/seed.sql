-- =============================================================================
-- Halberd & Co — Domain Seed Data
-- =============================================================================
-- Populates the operational domain tables for the four-workflow HITL demo.
--
-- Order of operations (see plan §"Implementation Notes for Claude Code"):
--   1. alembic upgrade head            (apply 001_initial_schema.sql)
--   2. psql < api/db/seed.sql          (THIS FILE — domain tables)
--   3. npx tsx scripts/seed-workflows.ts  (workflows + workflow_items)
--
-- Fixed UUIDs are used throughout so that workflow_items seed rows in
-- lib/contract/seed.ts can reference these domain entities reliably.
--
-- UUID scheme (human-readable):
--   shippers  11111111-0000-0000-0000-0000000000NN
--   carriers  22222222-0000-0000-0000-0000000000NN
--   lanes     33333333-0000-0000-0000-0000000000NN
--   loads     44444444-0000-0000-0000-0000000000NN
--
-- This file is idempotent: it truncates the domain tables before re-seeding.
-- It does NOT touch workflows / workflow_items (the Drizzle/TS seed owns those).
-- =============================================================================

BEGIN;

TRUNCATE TABLE rate_snapshots, loads, lanes, carriers, shippers RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- shippers (12) — 7 active, 5 inactive; inactive have stale last_load_date
-- -----------------------------------------------------------------------------
INSERT INTO shippers (id, hubspot_company_id, company_name, doing_business_as, city, state_code, zip_code, credit_terms_days, status, last_load_date, lifetime_load_count, notes) VALUES
('11111111-0000-0000-0000-000000000001', 'HS-001', 'Cascade Building Products', 'Cascade BP',        'Portland',       'OR', '97203', 30, 'active',   (CURRENT_DATE - 3),  142, 'Building materials. Reliable weekly volume out of Portland.'),
('11111111-0000-0000-0000-000000000002', 'HS-002', 'Sierra Foods Distribution',  'Sierra Foods',      'Fresno',         'CA', '93725', 30, 'active',   (CURRENT_DATE - 1),  208, 'Food/ag. Temp-controlled occasionally but mostly dry van.'),
('11111111-0000-0000-0000-000000000003', 'HS-003', 'Pacific Consumer Goods',     'PCG',               'Los Angeles',    'CA', '90021', 45, 'active',   (CURRENT_DATE - 5),   97, 'Consumer goods. Net 45 terms negotiated last year.'),
('11111111-0000-0000-0000-000000000004', 'HS-004', 'Granite State Manufacturing','Granite Mfg',       'Phoenix',        'AZ', '85043', 30, 'active',   (CURRENT_DATE - 2),  176, 'Industrial manufacturing. High-value freight.'),
('11111111-0000-0000-0000-000000000005', 'HS-005', 'Redwood Lumber Co',          'Redwood Lumber',    'Sacramento',     'CA', '95828', 30, 'active',   (CURRENT_DATE - 7),  121, 'Building materials / lumber.'),
('11111111-0000-0000-0000-000000000006', 'HS-006', 'Desert Bloom Produce',       'Desert Bloom',      'Tucson',         'AZ', '85714', 30, 'active',   (CURRENT_DATE - 4),   88, 'Food/ag. Seasonal produce volume.'),
('11111111-0000-0000-0000-000000000007', 'HS-007', 'Summit Outdoor Brands',      'Summit Outdoor',    'Boise',          'ID', '83709', 30, 'active',   (CURRENT_DATE - 6),   64, 'Consumer goods — outdoor gear.'),
('11111111-0000-0000-0000-000000000008', 'HS-008', 'Coastal Packaging Inc',      'Coastal Packaging', 'Oakland',        'CA', '94621', 30, 'inactive', (CURRENT_DATE - 52),  73, 'Lapsed. No load since early spring — reactivation candidate.'),
('11111111-0000-0000-0000-000000000009', 'HS-009', 'Highline Aggregates',        'Highline',          'Salt Lake City', 'UT', '84104', 30, 'inactive', (CURRENT_DATE - 61),  45, 'Building materials. Went quiet after Q1.'),
('11111111-0000-0000-0000-000000000010', 'HS-010', 'Valley Fresh Distributors',  'Valley Fresh',      'Reno',           'NV', '89506', 30, 'inactive', (CURRENT_DATE - 74),  39, 'Food/ag. Reactivation candidate — try produce season.'),
('11111111-0000-0000-0000-000000000011', 'HS-011', 'Northwest Steel Supply',     'NW Steel',          'Seattle',        'WA', '98108', 45, 'inactive', (CURRENT_DATE - 83),  58, 'Manufacturing. Long-standing but dormant.'),
('11111111-0000-0000-0000-000000000012', 'HS-012', 'Mojave Retail Group',        'Mojave Retail',     'Las Vegas',      'NV', '89118', 30, 'inactive', (CURRENT_DATE - 89),  31, 'Consumer goods. Oldest dormancy in the set.');

-- -----------------------------------------------------------------------------
-- carriers (18) — 6 preferred, 8 backup, 4 spot; 3 with compliance issues
-- -----------------------------------------------------------------------------
INSERT INTO carriers (id, dot_number, mc_number, company_name, doing_business_as, carrier_operation, city, state_code, postal_code, authority_status, safety_rating, insurance_expiry, compliance_status, last_fmcsa_check_at, is_active, relationship_type, tier, tender_enabled, loads_completed, on_time_rate, claim_count, invoice_accuracy_rate, payment_terms_days, quick_pay_enrolled, factoring_company, risk_summary, risk_updated_at, notes) VALUES
-- preferred (6)
('22222222-0000-0000-0000-000000000001', '1542087', 'MC-612340', 'Blue Ridge Trucking',      'Blue Ridge',     'Interstate', 'Phoenix',      'AZ', '85009', 'active', 'Satisfactory', (CURRENT_DATE + 210), 'Pass', (now() - interval '6 days'),  true, 'Favorite', 'preferred', true,  214, 97.50, 0, 99.10, 15, true,  'TAFS Inc',          'Low risk. Strong safety and on-time profile.',           (now() - interval '6 days'),  'Top performer on AZ lanes.'),
('22222222-0000-0000-0000-000000000002', '2087451', 'MC-734821', 'Pacific Crest Carriers',   'Pac Crest',      'Interstate', 'Portland',     'OR', '97217', 'active', 'Satisfactory', (CURRENT_DATE + 180), 'Pass', (now() - interval '4 days'),  true, 'Favorite', 'preferred', true,  198, 96.20, 1, 98.40, 15, true,  'RTS Financial',     'Low risk. Occasional claim but well documented.',        (now() - interval '4 days'),  'Reliable PNW capacity.'),
('22222222-0000-0000-0000-000000000003', '3310992', 'MC-845112', 'Goldenstate Logistics',    'Goldenstate',    'Interstate', 'Fresno',       'CA', '93706', 'active', 'Satisfactory', (CURRENT_DATE + 320), 'Pass', (now() - interval '8 days'),  true, 'Favorite', 'preferred', true,  176, 95.80, 0, 97.90, 30, false, NULL,                'Low risk.',                                              (now() - interval '8 days'),  'Great for CA Central Valley.'),
('22222222-0000-0000-0000-000000000004', '1899023', 'MC-501277', 'Sentinel Freightways',     'Sentinel',       'Interstate', 'Salt Lake City','UT','84116', 'active', 'Satisfactory', (CURRENT_DATE + 95),  'Pass', (now() - interval '10 days'), true, 'Favorite', 'preferred', true,  161, 94.10, 1, 96.50, 30, false, NULL,                'Low-moderate risk.',                                     (now() - interval '10 days'), 'Strong Mountain West coverage.'),
('22222222-0000-0000-0000-000000000005', '2455310', 'MC-667901', 'Cascade Haulers',          'Cascade Haul',   'Interstate', 'Seattle',      'WA', '98168', 'active', 'Satisfactory', (CURRENT_DATE + 145), 'Pass', (now() - interval '5 days'),  true, 'Favorite', 'preferred', true,  189, 96.90, 0, 98.80, 15, true,  'Apex Capital',      'Low risk.',                                              (now() - interval '5 days'),  'PNW preferred.'),
('22222222-0000-0000-0000-000000000006', '3781240', 'MC-912043', 'Vanguard Transport',       'Vanguard',       'Interstate', 'Denver',       'CO', '80216', 'active', 'Satisfactory', (CURRENT_DATE + 260), 'Pass', (now() - interval '3 days'),  true, 'Favorite', 'preferred', true,  152, 95.30, 0, 97.20, 30, false, NULL,                'Low risk.',                                              (now() - interval '3 days'),  'Rocky Mountain corridor specialist.'),
-- backup (8)
('22222222-0000-0000-0000-000000000007', '1203847', 'MC-410228', 'Roadrunner Express LLC',   'Roadrunner',     'Interstate', 'Tucson',       'AZ', '85706', 'active', 'Satisfactory', (CURRENT_DATE + 120), 'Pass', (now() - interval '12 days'), true, 'Watched', 'backup', false, 94,  91.40, 1, 94.10, 30, false, NULL,                'Moderate risk.',                                         (now() - interval '12 days'), 'Solid backup in AZ.'),
('22222222-0000-0000-0000-000000000008', '2640118', 'MC-558310', 'Silver Star Trucking',     'Silver Star',    'Interstate', 'Las Vegas',    'NV', '89030', 'active', 'Conditional',  (CURRENT_DATE + 70),  'Warning', (now() - interval '9 days'), true, 'Watched', 'backup', false, 81,  88.70, 2, 92.30, 30, false, NULL,                'Moderate risk — conditional safety rating.',             (now() - interval '9 days'),  'Use with caution on high-value freight.'),
('22222222-0000-0000-0000-000000000009', '3094762', 'MC-623455', 'Lone Pine Logistics',      'Lone Pine',      'Interstate', 'Reno',         'NV', '89502', 'active', 'Satisfactory', (CURRENT_DATE + 200), 'Pass', (now() - interval '14 days'), true, 'Watched', 'backup', false, 76,  90.10, 1, 93.80, 30, false, NULL,                'Moderate risk.',                                         (now() - interval '14 days'), 'NV/CA backup.'),
('22222222-0000-0000-0000-000000000010', '1750934', 'MC-470911', 'Frontier Freight Systems', 'Frontier',       'Interstate', 'Boise',        'ID', '83702', 'active', 'Satisfactory', (CURRENT_DATE + 165), 'Pass', (now() - interval '11 days'), true, 'Watched', 'backup', false, 68,  89.50, 0, 95.20, 30, false, NULL,                'Moderate risk.',                                         (now() - interval '11 days'), 'ID/PNW backup.'),
('22222222-0000-0000-0000-000000000011', '2911005', 'MC-701882', 'Coyote Run Carriers',      'Coyote Run',     'Interstate', 'Albuquerque',  'NM', '87105', 'active', 'Satisfactory', (CURRENT_DATE + 140), 'Pass', (now() - interval '13 days'), true, 'Watched', 'backup', false, 59,  87.20, 1, 91.60, 30, false, NULL,                'Moderate risk.',                                         (now() - interval '13 days'), 'Southwest backup.'),
('22222222-0000-0000-0000-000000000012', '3422781', 'MC-810443', 'Evergreen Hauling',        'Evergreen',      'Interstate', 'Sacramento',   'CA', '95824', 'active', 'Satisfactory', (CURRENT_DATE + 230), 'Pass', (now() - interval '7 days'),  true, 'Watched', 'backup', false, 72,  92.80, 0, 96.10, 30, false, NULL,                'Low-moderate risk.',                                     (now() - interval '7 days'),  'NorCal backup.'),
('22222222-0000-0000-0000-000000000013', '1066220', 'MC-389017', 'Mesa Transport Group',     'Mesa',           'Interstate', 'Mesa',         'AZ', '85201', 'active', 'Satisfactory', (CURRENT_DATE + 88),  'Pass', (now() - interval '15 days'), true, 'Watched', 'backup', false, 64,  86.40, 2, 90.50, 30, false, NULL,                'Moderate risk — two claims this year.',                  (now() - interval '15 days'), 'AZ backup.'),
('22222222-0000-0000-0000-000000000014', '2588194', 'MC-640228', 'Trailblazer Freight',      'Trailblazer',    'Interstate', 'Spokane',      'WA', '99202', 'active', 'Satisfactory', (CURRENT_DATE + 175), 'Pass', (now() - interval '6 days'),  true, 'Watched', 'backup', false, 70,  91.90, 1, 94.70, 30, false, NULL,                'Moderate risk.',                                         (now() - interval '6 days'),  'Inland NW backup.'),
-- spot (4) — includes compliance problems for the reconciliation demo
('22222222-0000-0000-0000-000000000015', '3855012', 'MC-920771', 'Quickdraw Transport',      'Quickdraw',      'Interstate', 'Bakersfield',  'CA', '93307', 'active', 'Conditional',  (CURRENT_DATE - 8),   'Fail',    (now() - interval '20 days'),true, 'Watched', 'spot', false, 22,  78.30, 3, 84.20, 30, false, NULL,                'HIGH RISK — insurance lapsed, conditional rating, multiple claims.', (now() - interval '20 days'), 'Insurance expired. Do not tender until renewed.'),
('22222222-0000-0000-0000-000000000016', '1477630', 'MC-355209', 'Tumbleweed Logistics',     'Tumbleweed',     'Interstate', 'El Paso',      'TX', '79907', 'inactive','Unsatisfactory',(CURRENT_DATE - 45),  'Fail',    (now() - interval '25 days'),false,'Blocked', 'spot', false, 14,  72.10, 4, 79.80, 30, false, NULL,                'HIGH RISK — unsatisfactory safety, revoked-pending authority.',      (now() - interval '25 days'), 'Blocked. Authority and insurance both lapsed.'),
('22222222-0000-0000-0000-000000000017', '2933471', 'MC-588120', 'Saguaro Spot Carriers',    'Saguaro',        'Interstate', 'Yuma',         'AZ', '85364', 'active', 'None',         (CURRENT_DATE + 40),  'Pending', (now() - interval '30 days'),true, 'Watched', 'spot', false, 9,   81.50, 1, 87.40, 30, false, NULL,                'Unscored — new to network, FMCSA check pending.',        (now() - interval '30 days'), 'New spot carrier, limited history.'),
('22222222-0000-0000-0000-000000000018', '3201998', 'MC-702551', 'Dust Devil Freight',       'Dust Devil',     'Interstate', 'Barstow',      'CA', '92311', 'active', 'Satisfactory', (CURRENT_DATE + 55),  'Pass',    (now() - interval '18 days'),true, 'Watched', 'spot', false, 31,  83.90, 2, 88.10, 30, false, NULL,                'Moderate-high risk.',                                    (now() - interval '18 days'), 'Spot capacity, decent record.');

-- -----------------------------------------------------------------------------
-- lanes (10) — Western US dry-van corridors; one paired backhaul (LA→Fresno + Fresno→Dallas)
-- -----------------------------------------------------------------------------
INSERT INTO lanes (id, origin_city, origin_state_code, origin_zip_code, origin_latitude, origin_longitude, destination_city, destination_state_code, destination_zip_code, destination_latitude, destination_longitude, equipment_code, transportation_mode, estimated_miles, avg_carrier_rate_per_mile, avg_shipper_rate_per_mile, avg_margin_percent, load_count, last_load_date, has_backhaul_pair, is_active, notes) VALUES
('33333333-0000-0000-0000-000000000001', 'Los Angeles',    'CA', '90021', 34.040713,  -118.233054, 'Phoenix',     'AZ', '85043', 33.448376,  -112.074036, 'V', 'TL', 373,  2.05, 2.65, 22.60, 64, (CURRENT_DATE - 2),  false, true, 'High-volume LA→PHX corridor.'),
('33333333-0000-0000-0000-000000000002', 'Los Angeles',    'CA', '90021', 34.040713,  -118.233054, 'Fresno',      'CA', '93725', 36.737797,  -119.787125, 'V', 'TL', 219,  1.95, 2.45, 20.40, 38, (CURRENT_DATE - 4),  true,  true, 'Outbound leg of LA↔Fresno↔Dallas round trip.'),
('33333333-0000-0000-0000-000000000003', 'Fresno',         'CA', '93725', 36.737797,  -119.787125, 'Dallas',      'TX', '75201', 32.776665,  -96.796989,  'V', 'TL', 1565, 2.10, 2.70, 22.20, 27, (CURRENT_DATE - 4),  true,  true, 'Backhaul leg paired with LA→Fresno.'),
('33333333-0000-0000-0000-000000000004', 'Oakland',        'CA', '94621', 37.751820,  -122.200300, 'Portland',    'OR', '97203', 45.587490,  -122.730637, 'V', 'TL', 632,  2.20, 2.80, 21.40, 41, (CURRENT_DATE - 3),  false, true, 'NorCal to PNW.'),
('33333333-0000-0000-0000-000000000005', 'Portland',       'OR', '97203', 45.587490,  -122.730637, 'Seattle',     'WA', '98108', 47.541440,  -122.314380, 'V', 'TL', 173,  2.35, 2.95, 20.30, 33, (CURRENT_DATE - 1),  false, true, 'Short PNW haul, premium short-mile rate.'),
('33333333-0000-0000-0000-000000000006', 'Seattle',        'WA', '98108', 47.541440,  -122.314380, 'Boise',       'ID', '83709', 43.564170,  -116.222080, 'V', 'TL', 496,  2.15, 2.75, 21.80, 29, (CURRENT_DATE - 6),  false, true, 'PNW to Mountain West.'),
('33333333-0000-0000-0000-000000000007', 'Phoenix',        'AZ', '85043', 33.448376,  -112.074036, 'Denver',      'CO', '80216', 39.769900,  -104.965700, 'V', 'TL', 821,  2.00, 2.55, 21.60, 36, (CURRENT_DATE - 2),  false, true, 'Southwest to Rockies.'),
('33333333-0000-0000-0000-000000000008', 'Salt Lake City', 'UT', '84104', 40.758701,  -111.940002, 'Las Vegas',   'NV', '89118', 36.082861,  -115.176910, 'V', 'TL', 421,  1.90, 2.40, 20.80, 31, (CURRENT_DATE - 5),  false, true, 'Mountain West to NV.'),
('33333333-0000-0000-0000-000000000009', 'Sacramento',     'CA', '95828', 38.481400,  -121.418400, 'Reno',        'NV', '89506', 39.529633,  -119.813805, 'V', 'TL', 132,  2.40, 3.00, 20.00, 24, (CURRENT_DATE - 7),  false, true, 'Short NorCal→NV mountain crossing.'),
('33333333-0000-0000-0000-000000000010', 'San Diego',      'CA', '92154', 32.715736,  -117.161087, 'Tucson',      'AZ', '85714', 32.221743,  -110.926476, 'V', 'TL', 408,  1.85, 2.35, 21.30, 28, (CURRENT_DATE - 3),  false, true, 'Southern border corridor.');

-- Wire up the paired backhaul (LA→Fresno ↔ Fresno→Dallas)
UPDATE lanes SET paired_lane_id = '33333333-0000-0000-0000-000000000003'
    WHERE id = '33333333-0000-0000-0000-000000000002';
UPDATE lanes SET paired_lane_id = '33333333-0000-0000-0000-000000000002'
    WHERE id = '33333333-0000-0000-0000-000000000003';

-- -----------------------------------------------------------------------------
-- loads — explicit demo-critical rows with fixed UUIDs
-- -----------------------------------------------------------------------------

-- Pending RFQs (5) — Quote Desk demo. Not yet quoted: no carrier, no rates.
INSERT INTO loads (id, shipper_id, lane_id, load_number, origin_city, origin_state_code, origin_zip_code, destination_city, destination_state_code, destination_zip_code, equipment_code, commodity_description, weight_lbs, pallet_count, mileage, pickup_date, delivery_date, status, rfq_source, internal_notes) VALUES
('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'HAL-25001', 'Los Angeles', 'CA', '90021', 'Fresno',  'CA', '93725', 'V', 'Canned goods, palletized',     38000, 24, 219,  (CURRENT_DATE + 2), (CURRENT_DATE + 3), 'pending', 'email', 'Inbound RFQ via email — needs quote.'),
('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000007', 'HAL-25002', 'Phoenix',     'AZ', '85043', 'Denver',  'CO', '80216', 'V', 'Industrial fasteners',         42000, 26, 821,  (CURRENT_DATE + 3), (CURRENT_DATE + 5), 'pending', 'email', 'Inbound RFQ via email — high-value, needs quote.'),
('44444444-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000005', 'HAL-25003', 'Portland',    'OR', '97203', 'Seattle', 'WA', '98108', 'V', 'Engineered wood panels',       44000, 22, 173,  (CURRENT_DATE + 1), (CURRENT_DATE + 1), 'pending', 'form',  'Inbound RFQ via web form — short haul.'),
('44444444-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'HAL-25004', 'Los Angeles', 'CA', '90021', 'Phoenix', 'AZ', '85043', 'V', 'Assorted consumer goods',      31000, 28, 373,  (CURRENT_DATE + 2), (CURRENT_DATE + 3), 'pending', 'email', 'Inbound RFQ via email.'),
('44444444-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000009', 'HAL-25005', 'Sacramento',  'CA', '95828', 'Reno',    'NV', '89506', 'V', 'Dimensional lumber',           45000, 20, 132,  (CURRENT_DATE + 1), (CURRENT_DATE + 2), 'pending', 'phone', 'Inbound RFQ via phone — short mountain haul.');

-- Discrepancy invoices (6) — Carrier Invoice Reconciliation demo.
-- Completed loads where the carrier-billed amount differs from the agreed carrier_rate.
INSERT INTO loads (id, shipper_id, carrier_id, lane_id, load_number, origin_city, origin_state_code, destination_city, destination_state_code, equipment_code, commodity_description, weight_lbs, mileage, pickup_date, delivery_date, shipper_rate, carrier_rate, fuel_surcharge, margin_percent, status, on_time_pickup, on_time_delivery, pod_received_at, carrier_invoice_number, carrier_invoice_amount, carrier_invoice_status, invoice_discrepancy_amt, invoice_discrepancy_notes, rfq_source) VALUES
('44444444-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'HAL-24910', 'Los Angeles', 'CA', 'Phoenix', 'AZ', 'V', 'Industrial parts',   40000, 373,  (CURRENT_DATE - 12), (CURRENT_DATE - 11), 988.00,  765.00,  120.00, 22.57, 'completed', true,  true,  (now() - interval '10 days'), 'INV-BR-4471', 915.00,  'discrepancy', 150.00, 'Carrier billed $150 detention not on the rate con. POD timestamps support 3h wait — verify.', 'email'),
('44444444-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', 'HAL-24911', 'Los Angeles', 'CA', 'Fresno',  'CA', 'V', 'Canned goods',       38000, 219,  (CURRENT_DATE - 14), (CURRENT_DATE - 13), 536.00,  427.00,  70.00,  20.34, 'completed', true,  false, (now() - interval '12 days'), 'INV-GS-2210', 477.00,  'discrepancy', 50.00,  'Late delivery — carrier still billed full rate plus $50 lumper. Lumper receipt missing.', 'email'),
('44444444-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 'HAL-24912', 'Oakland',     'CA', 'Portland','OR', 'V', 'Packaging materials',36000, 632,  (CURRENT_DATE - 16), (CURRENT_DATE - 14), 1769.00, 1391.00, 210.00, 21.37, 'completed', true,  true,  (now() - interval '13 days'), 'INV-PC-8830', 1471.00, 'discrepancy', 80.00,  'Fuel surcharge billed at higher index than agreed. $80 over.', 'form'),
('44444444-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000006', 'HAL-24913', 'Seattle',     'WA', 'Boise',   'ID', 'V', 'Outdoor equipment',  29000, 496,  (CURRENT_DATE - 18), (CURRENT_DATE - 16), 1364.00, 1066.00, 160.00, 21.85, 'completed', false, true,  (now() - interval '15 days'), 'INV-CH-1192', 1216.00, 'discrepancy', 150.00, 'Carrier billed TONU-style accessorial after reschedule. Disputed — needs review.', 'email'),
('44444444-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000010', 'HAL-24914', 'San Diego',   'CA', 'Tucson',  'AZ', 'V', 'Produce, dry',       33000, 408,  (CURRENT_DATE - 20), (CURRENT_DATE - 19), 959.00,  755.00,  120.00, 21.27, 'completed', true,  true,  (now() - interval '17 days'), 'INV-RR-5567', 815.00,  'discrepancy', 60.00,  '$60 over on agreed linehaul — possible mileage dispute (carrier used 440mi vs 408mi).', 'email'),
('44444444-0000-0000-0000-000000000015', '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000015', '33333333-0000-0000-0000-000000000007', 'HAL-24915', 'Phoenix',     'AZ', 'Denver',  'CO', 'V', 'Machined components', 41000, 821,  (CURRENT_DATE - 22), (CURRENT_DATE - 20), 2093.00, 1642.00, 250.00, 21.55, 'completed', true,  true,  (now() - interval '19 days'), 'INV-QD-3301', 1862.00, 'discrepancy', 220.00, 'Large overbill ($220) from a carrier with lapsed insurance (Quickdraw). Escalate — do not pay until reviewed.', 'email');

-- A few explicit completed/paid loads referenced by the Weekly Digest demo.
INSERT INTO loads (id, shipper_id, carrier_id, lane_id, load_number, origin_city, origin_state_code, destination_city, destination_state_code, equipment_code, commodity_description, weight_lbs, mileage, pickup_date, delivery_date, shipper_rate, carrier_rate, fuel_surcharge, margin_percent, status, on_time_pickup, on_time_delivery, pod_received_at, carrier_invoice_number, carrier_invoice_amount, carrier_invoice_status, rfq_source) VALUES
('44444444-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 'HAL-24820', 'Oakland',  'CA', 'Portland','OR', 'V', 'Building products', 40000, 632, (CURRENT_DATE - 6), (CURRENT_DATE - 4), 1769.00, 1391.00, 210.00, 21.37, 'paid',      true,  true,  (now() - interval '3 days'), 'INV-PC-9001', 1391.00, 'paid',     'email'),
('44444444-0000-0000-0000-000000000021', '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'HAL-24821', 'Los Angeles','CA','Phoenix', 'AZ', 'V', 'Industrial parts',  42000, 373, (CURRENT_DATE - 5), (CURRENT_DATE - 4), 988.00,  765.00,  120.00, 22.57, 'completed', true,  true,  (now() - interval '2 days'), 'INV-BR-9002', 765.00,  'matched',  'email'),
('44444444-0000-0000-0000-000000000022', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', 'HAL-24822', 'Los Angeles','CA','Fresno',  'CA', 'V', 'Food products',     38000, 219, (CURRENT_DATE - 4), (CURRENT_DATE - 4), 536.00,  427.00,  70.00,  20.34, 'completed', true,  true,  (now() - interval '1 days'), 'INV-GS-9003', 427.00,  'matched',  'email');

-- -----------------------------------------------------------------------------
-- loads — historical filler to reach 40–60 total (completed/paid, last 90 days)
-- Deterministically distributes across shippers/carriers/lanes via modulo.
-- -----------------------------------------------------------------------------
INSERT INTO loads (
    shipper_id, carrier_id, lane_id, load_number,
    origin_city, origin_state_code, destination_city, destination_state_code,
    equipment_code, commodity_description, weight_lbs, mileage,
    pickup_date, delivery_date,
    shipper_rate, carrier_rate, fuel_surcharge, margin_percent,
    status, on_time_pickup, on_time_delivery, pod_received_at,
    carrier_invoice_number, carrier_invoice_amount, carrier_invoice_status, rfq_source
)
SELECT
    s.id,
    c.id,
    l.id,
    'HAL-247' || lpad(g::text, 2, '0'),
    l.origin_city, l.origin_state_code, l.destination_city, l.destination_state_code,
    'V',
    (ARRAY['Palletized dry goods','Building materials','Packaged food','Consumer goods','Industrial supplies'])[1 + (g % 5)],
    32000 + (g % 13) * 1000,
    l.estimated_miles,
    (CURRENT_DATE - (20 + g)),
    (CURRENT_DATE - (19 + g)),
    round((l.estimated_miles * l.avg_shipper_rate_per_mile)::numeric, 2),
    round((l.estimated_miles * l.avg_carrier_rate_per_mile)::numeric, 2),
    round((l.estimated_miles * 0.32)::numeric, 2),
    l.avg_margin_percent,
    CASE WHEN g % 3 = 0 THEN 'paid' ELSE 'completed' END,
    (g % 7 <> 0),          -- ~86% on-time pickup
    (g % 9 <> 0),          -- ~89% on-time delivery
    (now() - ((18 + g) || ' days')::interval),
    'INV-H-' || lpad(g::text, 3, '0'),
    round((l.estimated_miles * l.avg_carrier_rate_per_mile)::numeric, 2),
    CASE WHEN g % 3 = 0 THEN 'paid' ELSE 'matched' END,
    (ARRAY['email','form','phone','api'])[1 + (g % 4)]
FROM generate_series(1, 36) AS g
JOIN LATERAL (
    SELECT id FROM shippers WHERE status = 'active' ORDER BY id OFFSET (g % 7) LIMIT 1
) s ON true
JOIN LATERAL (
    SELECT id FROM carriers WHERE tier IN ('preferred','backup') AND compliance_status = 'Pass'
    ORDER BY id OFFSET (g % 12) LIMIT 1
) c ON true
JOIN LATERAL (
    SELECT id, origin_city, origin_state_code, destination_city, destination_state_code,
           estimated_miles, avg_shipper_rate_per_mile, avg_carrier_rate_per_mile, avg_margin_percent
    FROM lanes ORDER BY id OFFSET (g % 10) LIMIT 1
) l ON true;

-- Refresh denormalized counters that workflows otherwise maintain on writeback.
UPDATE lanes ln SET load_count = sub.cnt
FROM (SELECT lane_id, count(*) AS cnt FROM loads WHERE lane_id IS NOT NULL GROUP BY lane_id) sub
WHERE ln.id = sub.lane_id;

UPDATE carriers ca SET loads_completed = sub.cnt
FROM (SELECT carrier_id, count(*) AS cnt FROM loads
      WHERE carrier_id IS NOT NULL AND status IN ('completed','paid','invoiced') GROUP BY carrier_id) sub
WHERE ca.id = sub.carrier_id;

-- -----------------------------------------------------------------------------
-- rate_snapshots — internal-source snapshots for completed/paid loads
-- (~1 per completed/paid load; derived from lane averages with slight variance)
-- -----------------------------------------------------------------------------
INSERT INTO rate_snapshots (
    load_id, lane_id, rate_source, captured_at, rate_type,
    low_rate_per_mile, avg_rate_per_mile, high_rate_per_mile, fuel_surcharge_per_mile,
    equipment_code, origin_city, origin_state_code, destination_city, destination_state_code, mileage
)
SELECT
    ld.id,
    ld.lane_id,
    'internal',
    ld.pickup_date - interval '2 days',
    'booked',
    round((ln.avg_carrier_rate_per_mile * 0.92)::numeric, 4),
    ln.avg_carrier_rate_per_mile,
    round((ln.avg_carrier_rate_per_mile * 1.12)::numeric, 4),
    0.3200,
    ld.equipment_code,
    ld.origin_city, ld.origin_state_code, ld.destination_city, ld.destination_state_code,
    ld.mileage
FROM loads ld
JOIN lanes ln ON ln.id = ld.lane_id
WHERE ld.status IN ('completed', 'paid');

COMMIT;

