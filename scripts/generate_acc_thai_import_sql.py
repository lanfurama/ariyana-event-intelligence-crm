#!/usr/bin/env python3
"""Generate SQL INSERT for Potential Lead for ACC_26Feb.csv with type LEAD2026FEB_THAIACC"""

import csv
import re
from datetime import datetime

def slugify(text):
    if not text:
        return ''
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.lower().strip('-')[:30]

def extract_email(text):
    if not text:
        return None
    matches = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', str(text))
    return matches[0] if matches else None

def extract_number(text):
    if not text:
        return None
    m = re.search(r'\d+', str(text).replace(',', '').replace(' ', ''))
    return int(m.group()) if m else None

def clean_sql_string(text):
    if text is None or (isinstance(text, str) and text.strip() == ''):
        return 'NULL'
    s = str(text).replace("'", "''").replace('\n', ' ').replace('\r', ' ').strip()
    return f"'{s}'" if s else 'NULL'

def main():
    import os
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base, 'Potential Lead for ACC_26Feb.csv')
    lead_type = 'LEAD2026FEB_THAIACC'
    leads = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            conf_name = (row.get('Conference Name') or '').strip()
            if not conf_name or conf_name == 'Conference Name':
                continue

            sector = (row.get('Sector') or '').strip() or 'Unknown'
            est_att = extract_number(row.get('Est. Attendance', ''))
            cycle = (row.get('Cycle / Preferred Month') or '').strip()
            contact_person = (row.get('Contact Person') or '').strip() or 'TBD'
            contact_email = extract_email(row.get('Contact Email') or row.get('Email') or '')
            contact_phone = (row.get('Contact Phone') or '').strip() or None
            website = (row.get('Website') or '').strip() or None
            vn_host = (row.get('Suggested VN Host') or '').strip()
            contact = (row.get('Contact') or '').strip()
            dept = (row.get('Department') or '').strip()
            next_action = (row.get('Next action') or '').strip()
            royalty = (row.get('Royalty / Licence') or '').strip()

            notes_parts = []
            if vn_host:
                notes_parts.append(f"VN Host: {vn_host}")
            if contact:
                notes_parts.append(f"Contact: {contact}")
            if dept:
                notes_parts.append(f"Department: {dept}")
            if cycle:
                notes_parts.append(f"Cycle: {cycle}")
            if next_action:
                notes_parts.append(f"Next action: {next_action}")
            notes = '. '.join(notes_parts) if notes_parts else None

            research_parts = []
            if royalty:
                research_parts.append(f"Royalty: {royalty}")
            research_notes = '; '.join(research_parts) if research_parts else None

            lead_id = f"acc-thai-{slugify(conf_name)}-2026"

            leads.append({
                'id': lead_id,
                'company_name': conf_name,
                'industry': sector,
                'country': 'Vietnam',
                'city': 'Da Nang',
                'website': website,
                'key_person_name': contact_person,
                'key_person_email': contact_email,
                'key_person_phone': contact_phone,
                'number_of_delegates': est_att,
                'notes': notes,
                'research_notes': research_notes,
            })

    # Output SQL
    lines = [
        f"-- Import ACC Thai potential leads from Potential Lead for ACC_26Feb.csv",
        f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"-- Type: {lead_type}\n",
        f"-- Total: {len(leads)} leads\n",
        "INSERT INTO leads (",
        "    id, company_name, industry, country, city, website,",
        "    key_person_name, key_person_title, key_person_email, key_person_phone,",
        "    total_events, vietnam_events, number_of_delegates, notes, status, type, research_notes,",
        "    created_at, updated_at",
        ") VALUES",
    ]

    values = []
    for lead in leads:
        v = (
            f"('{lead['id']}', {clean_sql_string(lead['company_name'])}, {clean_sql_string(lead['industry'])}, "
            f"{clean_sql_string(lead['country'])}, {clean_sql_string(lead['city'])}, {clean_sql_string(lead['website'])}, "
            f"{clean_sql_string(lead['key_person_name'])}, NULL, {clean_sql_string(lead['key_person_email'])}, "
            f"{clean_sql_string(lead['key_person_phone'])}, 0, 0, "
            f"{lead['number_of_delegates'] if lead['number_of_delegates'] else 'NULL'}, "
            f"{clean_sql_string(lead['notes'])}, 'New', '{lead_type}', {clean_sql_string(lead['research_notes'])}, "
            f"CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        values.append(v)

    for i, v in enumerate(values):
        lines.append(f"    {v}," if i < len(values) - 1 else f"    {v};")

    out_path = 'scripts/import_acc_thai_leads_2026feb.sql'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f"Generated {out_path} with {len(leads)} leads")

if __name__ == '__main__':
    main()
