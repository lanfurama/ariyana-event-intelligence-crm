-- Import script for CORP and DMC leads from CSV files
-- Generated: 2026-02-13
-- Usage: Run this script after running migrations 003 and 004

-- CORP Leads
INSERT INTO leads (
    id, company_name, industry, country, city, website,
    key_person_name, key_person_title, key_person_email, key_person_phone,
    total_events, vietnam_events, notes, status, type,
    created_at, updated_at
) VALUES
-- Singapore CORP Leads
('corp-dbs-sg', 'DBS', 'Banking / Financial Services', 'Singapore', 'Da Nang', NULL,
 NULL, 'Head of Events; APAC Travel Manager; Procurement (Travel & Meetings); HR Rewards & Recognition; Sales Enablement', NULL, NULL,
 0, 0, 'Why target: Regional sales meetings, dealer incentives, leadership offsites. Vietnam signal: Likely SEA footprint. Partner angle: Pitch a premium but efficient offsite: ACC for plenary/breakouts + gala; combine with beach resort accommodation; emphasize short-haul and high perceived value. Suggested route: Via DMC (BCD/CTM/FCM) + direct warm intro', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('corp-uob-sg', 'UOB', 'Banking / Financial Services', 'Singapore', 'Da Nang', NULL,
 NULL, 'Regional Events Lead; Marketing Events; Travel Manager; Procurement', NULL, NULL,
 0, 0, 'Why target: Annual kickoffs and client events. Vietnam signal: Likely SEA footprint. Partner angle: Position Da Nang as alternative to Bangkok/Bali with fresh destination appeal. ACC provides scalable plenary + production readiness. Suggested route: Via DMC + direct', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('corp-ocbc-sg', 'OCBC', 'Banking / Financial Services', 'Singapore', 'Da Nang', NULL,
 NULL, 'Regional Events; HR Rewards; Procurement Travel', NULL, NULL,
 0, 0, 'Why target: Incentives + internal conferences. Vietnam signal: Likely SEA footprint. Partner angle: Offer budget tiers (good/better/best) and highlight quick airport-to-venue transfer and easy logistics. Suggested route: Via DMC + direct', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Malaysia CORP Leads
('corp-maybank-my', 'Maybank', 'Banking', 'Malaysia', 'Da Nang', NULL,
 NULL, 'Group HR; Rewards & Recognition; Travel Manager; Procurement', NULL, NULL,
 0, 0, 'Why target: Large employee base; leadership and sales conferences. Vietnam signal: Likely regional/offshore travel. Partner angle: Offer cost-effective scale: ACC plenary + breakout + gala; propose 3 package tiers and all-in per-delegate budgeting. Suggested route: Via Mayflower / Apple MICE / Holiday Tours', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('corp-cimb-my', 'CIMB', 'Banking', 'Malaysia', 'Da Nang', NULL,
 NULL, 'Regional Events; HR Rewards; Procurement Travel', NULL, NULL,
 0, 0, 'Why target: Regional kickoffs + dealer events. Vietnam signal: Likely. Partner angle: Emphasize quick access and strong hospitality network; offer structured programme templates. Suggested route: Via DMC/agency', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('corp-petronas-my', 'PETRONAS', 'Energy / Industrial', 'Malaysia', 'Da Nang', NULL,
 NULL, 'Corporate Affairs Events; HR Rewards; Travel Procurement', NULL, NULL,
 0, 0, 'Why target: High frequency of corporate meetings/incentives. Vietnam signal: Likely. Partner angle: Offer executive-grade production, security, and privacy; propose leadership retreat formats and CSR. Suggested route: Via agency', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Taiwan CORP Leads
('corp-foxconn-tw', 'Foxconn (Hon Hai)', 'Electronics / Manufacturing', 'Taiwan', 'Da Nang', NULL,
 NULL, 'Corporate HR; Rewards; Global Procurement; Supplier Management; Events', NULL, NULL,
 0, 0, 'Why target: Large workforce; frequent incentives and supplier meetings. Vietnam signal: Likely Vietnam footprint. Partner angle: Pitch Vietnam as convenient for Taiwan teams; ACC for supplier conferences and internal kickoffs; offer bilingual support and robust production vendors. Suggested route: Via Taiwan MICE agencies (ezTravel / iMICE) + direct', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('corp-pegatron-tw', 'Pegatron', 'Electronics / Manufacturing', 'Taiwan', 'Da Nang', NULL,
 NULL, 'Procurement; HR Rewards; Events', NULL, NULL,
 0, 0, 'Why target: Supplier meetings and internal offsites. Vietnam signal: Likely Vietnam footprint. Partner angle: ACC for supplier summit + breakout workshops; package with resort stay. Suggested route: Via agency + direct', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('corp-compal-tw', 'Compal', 'Electronics / Manufacturing', 'Taiwan', 'Da Nang', NULL,
 NULL, 'HR Rewards; Events; Procurement', NULL, NULL,
 0, 0, 'Why target: Sales conferences. Vietnam signal: Likely. Partner angle: Offer predictable pricing and fast contracting; provide turnkey supplier summit format. Suggested route: Via agency', 'New', 'CORP',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- DMC Leads
('dmc-bcd-sg', 'BCD Meetings & Events (Singapore)', 'Meetings & Events agency / TMC', 'Singapore', 'Da Nang', 'https://bcdme.com/en-sg/',
 NULL, 'Client Solutions Director; Program Manager; Venue Sourcing Lead; Strategic Meetings Mgmt', 'mervyn.tan@bcdme.com.my', NULL,
 0, 0, 'Vietnam signal: Singapore HQ page + meetings/events services. Partner angle: Best for large corporates. ACC should position as value + scale vs Bangkok/Bali: modern venue, short-haul, beach incentive add-ons, and straightforward contracting. Offer a master venue brief + sample budgets for 200/500/800 pax. Recommended action: Send venue brief + host virtual walkthrough; offer to support their venue sourcing with holding dates and quick quotes. Contact: mervyn.tan@bcdme.com.my (MY Office)', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-cwt-sg', 'CWT Meetings & Events (Singapore)', 'Meetings & Events agency', 'Singapore', 'Da Nang', 'https://www.cwt-meetings-events.com/talk-to-us/singapore/',
 NULL, 'Head of Client Development; Creative/Production Lead; Group Travel Lead', 'MayshanMZ@cwt-me.com; SufiH@cwt-me.com; Ochen@cwt-me.com', NULL,
 0, 0, 'Vietnam signal: APAC centre of excellence in SG; strong event production capability. Partner angle: Pitch operational reliability: single venue for plenary/breakouts/expo; strong back-of-house for production; contingency plans. Offer a Da Nang playbook for event risk and logistics. Recommended action: Send tech pack + rate ranges; propose a test RFP / pilot group. Contact: MayshanMZ@cwt-me.com (Mayshan), SufiH@cwt-me.com (Sufi), Ochen@cwt-me.com (Ochen) - SG Office', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-fcm-sg', 'FCM Travel (Singapore)', 'Corporate travel management (TMC) + MICE', 'Singapore', 'Da Nang', 'https://www.fcmtravel.com/en-fi/about-us/global-network/singapore',
 NULL, 'Regional Travel Manager; MICE/Groups Lead; Procurement Travel & Meetings', NULL, NULL,
 0, 0, 'Vietnam signal: Corporate travel services include MICE; SG address listed. Partner angle: Approach via their group bookings/MICE team. ACC can offer preferred rates and bundle packages for internal meetings and rewards trips. Provide duty-of-care and vendor compliance details. Recommended action: Share venue brief + compliance info; ask for preferred supplier onboarding process', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-apple-my', 'Apple MICE (Apple Vacations)', 'Incentive / MICE agency', 'Malaysia', 'Da Nang', 'https://www.applevacations.my/en/mice.php',
 NULL, 'Head of Apple MICE; Incentive Travel Manager; Corporate Sales', 'enquiry@applevacations.my', NULL,
 0, 0, 'Vietnam signal: Dedicated MICE page + MICE contact listed. Partner angle: Malaysia corporates do short-haul incentives; Da Nang is a fresh alternative to Bangkok/Bali. ACC should offer packaged pricing and fast turnaround, and suggest offsite dinners + CSR activities in Hoi An/Da Nang. Recommended action: Email intro + propose 2 sample programmes; invite top planner for inspection. Contact: enquiry@applevacations.my (Vanness Lai) - MY Office', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-gd-my', 'Golden Destinations (GD MICE)', 'MICE travel wholesaler / B2B', 'Malaysia', 'Da Nang', 'https://www.goldendestinations.com/mice',
 NULL, 'GD MICE Director; Key Account; Group Incentives Manager', 'feedback@gd.my', NULL,
 0, 0, 'Vietnam signal: GD MICE positioned for custom-made travel solutions. Partner angle: Work them as a B2B distribution partner. Provide ACC-ready collateral: photos, floorplans, capacity, menus, and sample budgets. Offer a fixed MICE bundle they can plug into proposals. Recommended action: Partner meeting; provide packaged offers and marketing collateral. Contact: feedback@gd.my (Sunny Ong) - MY Office', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-mayflower-my', 'Mayflower (Malaysia)', 'Corporate travel + MICE', 'Malaysia', 'Da Nang', 'https://www.mayflower.com.my/contactus',
 NULL, 'MICE Planner; Corporate Accounts; Travel Procurement Lead', NULL, NULL,
 0, 0, 'Vietnam signal: Large corporate travel group with MICE capability. Partner angle: Pitch annual corporate calendars: kickoffs, awards nights, dealer incentives. ACC can offer yearly preferred agreements and rate protection. Provide risk and safety plan plus vendor list. Recommended action: Intro + share venue brief + propose preferred agreement', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-eztravel-tw', 'ezTravel 易遊網 (MICE)', 'Outbound corporate/MICE travel', 'Taiwan', 'Da Nang', 'https://vacation.eztravel.com.tw/pkgfrn/miceForm',
 NULL, 'MICE Product Manager; Corporate Sales; Group Travel Lead', NULL, NULL,
 0, 0, 'Vietnam signal: Dedicated MICE form with MICE email/phone. Partner angle: Provide Chinese-language ACC kit. Emphasize Taiwan–Da Nang nonstop connectivity and ease: short flight, resort + meeting in one. Offer packaged programmes and quick quote SLAs. Recommended action: Send Chinese kit + invite key MICE product owner for virtual walkthrough; propose joint promotion', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-flying-tw', 'Flying Tour / iMICE (Kaohsiung)', 'Outbound MICE organiser / DMC', 'Taiwan', 'Da Nang', 'https://www.fly168.com.tw/inb/',
 NULL, 'iMICE BD Manager; Project Director; Corporate Sales', NULL, NULL,
 0, 0, 'Vietnam signal: Subsidiary iMICE focuses on MICE planning; corporate clients. Partner angle: Position Da Nang as short-haul incentive option from Taiwan. Offer venue assurance and production support; connect them with local Da Nang DMCs for ground ops. Recommended action: Intro + propose 1 pilot group; provide Chinese collateral + sample budgets', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dmc-ctm-tw', 'CTM (Taiwan)', 'Corporate travel management / TMC', 'Taiwan', 'Da Nang', 'https://asia.travelctm.com/contact/',
 NULL, 'Travel Manager; Meetings & Events lead; Procurement', NULL, NULL,
 0, 0, 'Vietnam signal: CTM has Taiwan office listed on Asia contact page. Partner angle: Use CTM as channel to corporates with managed travel. ACC can be a preferred venue and provide quick RFP responses. Recommended action: Contact Taiwan office; ask about meetings/events referrals and preferred venue onboarding', 'New', 'DMC',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Note: This script inserts 9 CORP leads and 8 DMC leads
-- All leads are set with status 'New' and type 'CORP' or 'DMC' respectively
-- City is set to 'Da Nang' as these are leads for ACC venue
-- Key person information is extracted from "Ideal contacts" field where available
-- Email addresses are included from Contact field for DMC leads
