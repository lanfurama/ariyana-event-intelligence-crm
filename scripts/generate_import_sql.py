#!/usr/bin/env python3
"""
Script to generate SQL INSERT statements from CORP and DMC CSV files
Usage: python scripts/generate_import_sql.py
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

def extract_email(text):
    """Extract email address from text"""
    if not text:
        return None
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    matches = re.findall(email_pattern, text)
    return matches[0] if matches else None

def clean_sql_string(text):
    """Escape SQL string"""
    if not text:
        return 'NULL'
    # Replace single quotes with double single quotes for SQL
    text = str(text).replace("'", "''")
    return f"'{text}'"

def generate_id(prefix, company_name, country_code, year=None):
    """Generate a unique ID"""
    company_slug = slugify(company_name)[:20]
    country_slug = slugify(country_code)[:2]
    if year:
        return f"{prefix}-{company_slug}-{country_slug}-{year}"
    return f"{prefix}-{company_slug}-{country_slug}"

def parse_corp_csv(filename, year=None):
    """Parse CORP CSV file"""
    leads = []
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        # Find header row (line with 'Market')
        header_idx = None
        for i, line in enumerate(lines):
            if 'Market' in line and 'Sector' in line:
                header_idx = i
                break
        
        if header_idx is None:
            print(f"Warning: Could not find header in {filename}")
            return leads
        
        # Parse header
        header_line = lines[header_idx].strip()
        reader = csv.DictReader(lines[header_idx:], fieldnames=header_line.split(','))
        next(reader)  # Skip header row
        
        for row in reader:
            market = row.get('Market', '').strip()
            sector = row.get('Sector', '').strip()
            company = row.get('Company', '').strip()
            
            if not company or not market or company == 'Company':
                continue
            
            # Generate ID with year
            lead_id = generate_id('corp', company, market, year)
            
            # Extract key person info from "Ideal contacts"
            ideal_contacts = row.get('Ideal contacts to search (titles)', '').strip()
            key_person_title = ideal_contacts if ideal_contacts else None
            
            # Build notes
            why_target = row.get('Why target (trigger)', '').strip()
            vietnam_signal = row.get('Vietnam signal', '').strip()
            partner_angle = row.get('Partner angle (elaborate)', '').strip()
            suggested_route = row.get('Suggested route (Direct vs via agency)', '').strip()
            
            notes_parts = []
            if why_target:
                notes_parts.append(f"Why target: {why_target}")
            if vietnam_signal:
                notes_parts.append(f"Vietnam signal: {vietnam_signal}")
            if partner_angle:
                notes_parts.append(f"Partner angle: {partner_angle}")
            if suggested_route:
                notes_parts.append(f"Suggested route: {suggested_route}")
            
            notes = ". ".join(notes_parts) if notes_parts else None
            
            # Research notes - search keywords for verification
            search_keywords = row.get('How to verify Vietnam / Da Nang history (search keywords)', '').strip()
            research_notes = search_keywords if search_keywords else None
            
            leads.append({
                'id': lead_id,
                'company_name': company,
                'industry': sector or 'Unknown',
                'country': market,
                'city': 'Da Nang',
                'website': None,
                'key_person_name': 'TBD',  # Required field, use default if not available
                'key_person_title': key_person_title,
                'key_person_email': None,
                'key_person_phone': None,
                'notes': notes,
                'research_notes': research_notes,
                'type': 'CORP'
            })
    
    return leads

def parse_dmc_csv(filename, year=None):
    """Parse DMC CSV file"""
    leads = []
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        # Find header row (line with 'Market')
        header_idx = None
        for i, line in enumerate(lines):
            if 'Market' in line and 'Lead type' in line:
                header_idx = i
                break
        
        if header_idx is None:
            print(f"Warning: Could not find header in {filename}")
            return leads
        
        # Parse header - handle CSV with commas in quoted fields
        reader = csv.DictReader(lines[header_idx:])
        
        for row in reader:
            market = row.get('Market', '').strip()
            lead_type = row.get('Lead type', '').strip()
            company = row.get('Company', '').strip()
            website = row.get('Website / contact page', '').strip()
            
            if not company or not market or company == 'Company':
                continue
            
            # Generate ID with year
            lead_id = generate_id('dmc', company, market, year)
            
            # Extract email from Contact field
            contact = row.get('Contact', '').strip()
            key_person_email = extract_email(contact)
            
            # Extract key person info
            ideal_contacts = row.get('Ideal contacts to search (titles)', '').strip()
            key_person_title = ideal_contacts if ideal_contacts else None
            
            # Build notes
            vietnam_signal = row.get('Vietnam signal (why easy)', '').strip()
            partner_angle = row.get('Notes / partner angle (elaborate)', '').strip()
            recommended_action = row.get('Recommended next action', '').strip()
            contact_info = row.get('Contact', '').strip()
            remark = row.get('Remark', '').strip()
            
            notes_parts = []
            if vietnam_signal:
                notes_parts.append(f"Vietnam signal: {vietnam_signal}")
            if partner_angle:
                notes_parts.append(f"Partner angle: {partner_angle}")
            if recommended_action:
                notes_parts.append(f"Recommended action: {recommended_action}")
            if contact_info:
                notes_parts.append(f"Contact: {contact_info}")
            if remark:
                notes_parts.append(f"Remark: {remark}")
            
            notes = ". ".join(notes_parts) if notes_parts else None
            
            # Research notes - Vietnam proof/reference link
            vietnam_proof = row.get('Vietnam proof / reference link', '').strip()
            research_notes = vietnam_proof if vietnam_proof else None
            
            leads.append({
                'id': lead_id,
                'company_name': company,
                'industry': lead_type or 'Meetings & Events agency',
                'country': market,
                'city': 'Da Nang',
                'website': website if website else None,
                'key_person_name': 'TBD',  # Required field, use default if not available
                'key_person_title': key_person_title,
                'key_person_email': key_person_email,
                'key_person_phone': None,
                'notes': notes,
                'research_notes': research_notes,
                'type': 'DMC'
            })
    
    return leads

def generate_sql(leads, lead_type):
    """Generate SQL INSERT statements"""
    sql_lines = []
    
    for lead in leads:
        research_notes = lead.get('research_notes')
        
        sql = f"('{lead['id']}', {clean_sql_string(lead['company_name'])}, {clean_sql_string(lead['industry'])}, {clean_sql_string(lead['country'])}, {clean_sql_string(lead['city'])}, {clean_sql_string(lead['website'])}, {clean_sql_string(lead['key_person_name'])}, {clean_sql_string(lead['key_person_title'])}, {clean_sql_string(lead['key_person_email'])}, {clean_sql_string(lead['key_person_phone'])}, 0, 0, {clean_sql_string(lead['notes'])}, 'New', {clean_sql_string(lead['type'])}, {clean_sql_string(research_notes)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        sql_lines.append(sql)
    
    return sql_lines

def main():
    import sys
    
    # Check if year argument provided, default to 2026
    year = sys.argv[1] if len(sys.argv) > 1 else '2026'
    
    corp_filename = f'CORP {year}.csv'
    dmc_filename = f'DMC {year}.csv'
    
    output_lines = []
    output_lines.append(f"-- Import script for CORP and DMC leads from CSV files ({year})")
    output_lines.append(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output_lines.append("-- Usage: Run this script after running migrations 003 and 004\n")
    
    # Parse CSV files
    print(f"-- Parsing {corp_filename}...")
    corp_leads = parse_corp_csv(corp_filename, year)
    print(f"-- Found {len(corp_leads)} CORP leads")
    
    print(f"-- Parsing {dmc_filename}...")
    dmc_leads = parse_dmc_csv(dmc_filename, year)
    print(f"-- Found {len(dmc_leads)} DMC leads\n")
    
    output_lines.append(f"-- Found {len(corp_leads)} CORP leads")
    output_lines.append(f"-- Found {len(dmc_leads)} DMC leads\n")
    
    # Generate SQL
    output_lines.append("INSERT INTO leads (")
    output_lines.append("    id, company_name, industry, country, city, website,")
    output_lines.append("    key_person_name, key_person_title, key_person_email, key_person_phone,")
    output_lines.append("    total_events, vietnam_events, notes, status, type, research_notes,")
    output_lines.append("    created_at, updated_at")
    output_lines.append(") VALUES")
    
    all_leads = corp_leads + dmc_leads
    sql_values = generate_sql(all_leads, 'ALL')
    
    for i, sql_val in enumerate(sql_values):
        if i < len(sql_values) - 1:
            output_lines.append(f"    {sql_val},")
        else:
            output_lines.append(f"    {sql_val};")
    
    output_lines.append(f"\n-- Total: {len(all_leads)} leads ({len(corp_leads)} CORP, {len(dmc_leads)} DMC)")
    
    # Write to file
    output_filename = f'scripts/import_corp_dmc_leads_{year}_generated.sql'
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))
    
    print(f"\n-- SQL file generated: {output_filename}")
    print(f"-- Total: {len(all_leads)} leads ({len(corp_leads)} CORP, {len(dmc_leads)} DMC)")

if __name__ == '__main__':
    main()
