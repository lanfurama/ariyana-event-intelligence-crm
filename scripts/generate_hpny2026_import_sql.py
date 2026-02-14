#!/usr/bin/env python3
"""Generate SQL INSERT from Postcard HPNY2026 CSV. Output: import_hpny2026_postcard_leads.sql"""

import csv
import re
import os

def slugify(text):
    if not text:
        return ''
    text = re.sub(r'[^\w\s-]', '', str(text))
    text = re.sub(r'[-\s]+', '-', text)
    return text.lower().strip('-')[:30]

def extract_email(text):
    if not text:
        return None
    m = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', str(text))
    return m[0] if m else None

def clean_sql_string(text):
    if text is None or (isinstance(text, str) and not text.strip()):
        return 'NULL'
    text = str(text).replace("'", "''").strip()
    return f"'{text}'" if text else 'NULL'

def parse_pax(val):
    if not val or not str(val).strip():
        return None
    s = str(val).strip().replace('.', '').replace(',', '')
    nums = re.findall(r'\d+', s)
    return int(nums[0]) if nums else None

def parse_csv(csv_path):
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, skipinitialspace=True)
        for row in reader:
            row = {k.strip(): v for k, v in row.items() if k}
            client = (row.get('CLIENT') or '').strip() or (row.get('AGENT') or '').strip()
            contact = (row.get('Contact') or '').strip()
            poc = (row.get('POC') or '').strip()
            if not client and not contact:
                continue
            company = client or 'TBA'
            email = extract_email(contact)
            venue = (row.get('Venue') or '').strip()
            pax = parse_pax(row.get('PAX') or row.get('PAX ') or '')
            event_type = (row.get('EVENT TYPE') or '').strip()
            status_evt = (row.get('STATUS') or '').strip()
            segment = (row.get('Segment') or '').strip()
            room = (row.get('Room night') or '').strip()
            office = (row.get('Office in charge') or '').strip()
            source = (row.get('SOURCE') or '').strip()
            notes_parts = [x for x in [venue, f"PAX {pax}" if pax else None, event_type, status_evt, f"Room {room}" if room else None] if x]
            notes = '; '.join(notes_parts) if notes_parts else None
            city = office or source or 'Da Nang'
            industry = segment or event_type or 'Meetings & Events'
            rows.append({
                'company_name': company,
                'key_person_name': poc or None,
                'key_person_email': email,
                'industry': industry,
                'city': city,
                'notes': notes,
                'pax': pax,
                'email_raw': email or contact,
            })
    return rows

def dedupe(rows):
    seen = {}
    for r in rows:
        key = (r['company_name'].lower().strip(), (r['key_person_email'] or '').lower())
        if key not in seen:
            seen[key] = {**r, 'total_events': 1, 'notes_list': [r['notes']] if r.get('notes') else []}
        else:
            seen[key]['total_events'] += 1
            if r.get('notes'):
                seen[key]['notes_list'].append(r['notes'])
            if r.get('pax') and (not seen[key].get('pax') or r['pax'] > seen[key]['pax']):
                seen[key]['pax'] = r['pax']
    out = []
    for v in seen.values():
        v['notes'] = '; '.join(v['notes_list']) if v['notes_list'] else v.get('notes')
        del v['notes_list']
        out.append(v)
    return out

def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base, 'Database_Postcard HPNY2026_ACC.xlsx - Sheet1.csv')
    out_path = os.path.join(base, 'scripts', 'import_hpny2026_postcard_leads.sql')

    rows = parse_csv(csv_path)
    leads = dedupe(rows)

    lines = [
        '-- HPNY2026 Postcard ACC leads - run migration 007 first if type HPNY2026 not yet allowed',
        '-- Generated from Database_Postcard HPNY2026_ACC.xlsx - Sheet1.csv',
        '',
        'INSERT INTO leads (',
        '    id, company_name, industry, country, city, website,',
        '    key_person_name, key_person_title, key_person_email, key_person_phone,',
        '    total_events, vietnam_events, notes, status, type,',
        '    created_at, updated_at',
        ') VALUES',
    ]
    vals = []
    for i, lead in enumerate(leads):
        company = lead['company_name']
        slug = slugify(company) or 'tba'
        lid = f"hpny2026-{slug}-{i+1}"
        country = 'Vietnam'
        notes = lead.get('notes')
        pax = lead.get('pax')
        if pax and notes:
            notes = f"PAX {pax}; " + notes
        elif pax:
            notes = f"PAX {pax}"
        v = (
            f"({clean_sql_string(lid)}, {clean_sql_string(company)}, {clean_sql_string(lead.get('industry'))}, "
            f"{clean_sql_string(country)}, {clean_sql_string(lead.get('city'))}, NULL, "
            f"{clean_sql_string(lead.get('key_person_name'))}, NULL, {clean_sql_string(lead.get('key_person_email'))}, NULL, "
            f"{lead.get('total_events', 1)}, 0, {clean_sql_string(notes)}, 'New', 'HPNY2026', "
            f"CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        vals.append(v)
    lines.append(',\n'.join(vals))
    lines.append(';')
    lines.append('')
    lines.append(f'-- Total: {len(leads)} HPNY2026 leads')

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"Wrote {len(leads)} leads to {out_path}")

if __name__ == '__main__':
    main()
