#!/usr/bin/env python3
"""
Script to generate SQL INSERT statements from Normal.csv file
Usage: python scripts/generate_normal_leads_sql.py
"""

import csv
import re
from datetime import datetime

def slugify(text):
    """Convert text to a valid ID slug"""
    if not text:
        return ''
    # Remove special characters, convert to lowercase, replace spaces with hyphens
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.lower().strip('-')

def clean_sql_string(text):
    """Escape SQL string"""
    if not text:
        return 'NULL'
    # Replace single quotes with double single quotes for SQL
    text = str(text).replace("'", "''")
    return f"'{text}'"

def generate_id(conference_name):
    """Generate a unique ID from conference name"""
    slug = slugify(conference_name)[:40]
    return f"normal-{slug}"

def parse_normal_csv(filename):
    """Parse Normal CSV file"""
    leads = []
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            conference_name = row.get('Conference Name', '').strip()
            if not conference_name or conference_name == 'Conference Name':
                continue
            
            # Generate ID
            lead_id = generate_id(conference_name)
            
            # Extract fields
            sector = row.get('Sector', '').strip()
            est_attendance = row.get('Est. Attendance', '').strip()
            contact_person = row.get('Contact Person', '').strip()
            contact_email = row.get('Contact Email', '').strip()
            contact_phone = row.get('Contact Phone', '').strip()
            website = row.get('Website', '').strip()
            breakout_rooms = row.get('Break‑out Rooms', '').strip()
            cycle = row.get('Cycle / Preferred Month', '').strip()
            suggested_host = row.get('Suggested VN Host', '').strip()
            royalty = row.get('Royalty / Licence', '').strip()
            
            # Parse number of delegates
            number_of_delegates = None
            if est_attendance:
                # Extract number from string like "700" or "3–5"
                numbers = re.findall(r'\d+', est_attendance)
                if numbers:
                    number_of_delegates = int(numbers[0])
            
            # Build notes
            notes_parts = []
            if breakout_rooms:
                notes_parts.append(f"Breakout rooms: {breakout_rooms}")
            if cycle:
                notes_parts.append(f"Cycle: {cycle}")
            if suggested_host:
                notes_parts.append(f"Suggested VN Host: {suggested_host}")
            if royalty:
                notes_parts.append(f"Royalty/Licence: {royalty}")
            
            notes = ". ".join(notes_parts) if notes_parts else None
            
            # Determine country - try to infer from contact email domain or use default
            country = 'International'
            if contact_email:
                if '.sg' in contact_email.lower() or 'singapore' in contact_email.lower():
                    country = 'Singapore'
                elif '.my' in contact_email.lower() or 'malaysia' in contact_email.lower():
                    country = 'Malaysia'
                elif '.hk' in contact_email.lower() or 'hong kong' in contact_email.lower():
                    country = 'Hong Kong'
                elif '.org' in contact_email.lower() and 'asia' in contact_email.lower():
                    country = 'Asia-Pacific'
            
            leads.append({
                'id': lead_id,
                'company_name': conference_name,
                'industry': sector or 'Unknown',
                'country': country,
                'city': 'Da Nang',
                'website': website if website else None,
                'key_person_name': contact_person if contact_person else 'TBD',
                'key_person_title': None,
                'key_person_email': contact_email if contact_email else None,
                'key_person_phone': contact_phone if contact_phone else None,
                'number_of_delegates': number_of_delegates,
                'notes': notes,
                'type': None  # Normal leads have NULL type
            })
    
    return leads

def generate_sql(leads):
    """Generate SQL INSERT statements"""
    sql_lines = []
    
    for lead in leads:
        # Match the exact column order from LeadModel.create
        sql = f"('{lead['id']}', {clean_sql_string(lead['company_name'])}, {clean_sql_string(lead['industry'])}, {clean_sql_string(lead['country'])}, {clean_sql_string(lead['city'])}, {clean_sql_string(lead['website'])}, {clean_sql_string(lead['key_person_name'])}, {clean_sql_string(lead['key_person_title'])}, {clean_sql_string(lead['key_person_email'])}, {clean_sql_string(lead['key_person_phone'])}, NULL, 0, 0, {clean_sql_string(lead['notes'])}, 'New', NULL, NULL, NULL, NULL, NULL, NULL, {lead['number_of_delegates'] if lead['number_of_delegates'] else 'NULL'}, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        sql_lines.append(sql)
    
    return sql_lines

def main():
    output_lines = []
    output_lines.append("-- Import script for Normal leads from Normal.csv")
    output_lines.append(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output_lines.append("-- Usage: Run this script after running migrations 003 and 004\n")
    
    # Parse CSV file
    print("-- Parsing Normal.csv...")
    normal_leads = parse_normal_csv('Normal.csv')
    print(f"-- Found {len(normal_leads)} Normal leads\n")
    
    output_lines.append(f"-- Found {len(normal_leads)} Normal leads (type = NULL)\n")
    
    # Generate SQL
    output_lines.append("INSERT INTO leads (")
    output_lines.append("    id, company_name, industry, country, city, website,")
    output_lines.append("    key_person_name, key_person_title, key_person_email, key_person_phone, key_person_linkedin,")
    output_lines.append("    total_events, vietnam_events, notes, status, last_contacted,")
    output_lines.append("    past_events_history, research_notes, secondary_person_name, secondary_person_title,")
    output_lines.append("    secondary_person_email, number_of_delegates, lead_score, last_score_update, type,")
    output_lines.append("    created_at, updated_at")
    output_lines.append(") VALUES")
    
    sql_values = generate_sql(normal_leads)
    
    for i, sql_val in enumerate(sql_values):
        if i < len(sql_values) - 1:
            output_lines.append(f"    {sql_val},")
        else:
            output_lines.append(f"    {sql_val};")
    
    output_lines.append(f"\n-- Total: {len(normal_leads)} normal leads (type = NULL)")
    
    # Write to file
    output_filename = 'scripts/import_normal_leads_generated.sql'
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))
    
    print(f"\n-- SQL file generated: {output_filename}")
    print(f"-- Total: {len(normal_leads)} normal leads (type = NULL)")

if __name__ == '__main__':
    main()
