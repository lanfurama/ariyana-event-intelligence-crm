import xlrd
import sys

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Open the old .xls file
wb = xlrd.open_workbook('ICCA-BI-Export_12_11_2025.xls')

print("=" * 80)
print("EXCEL FILE INSPECTION - ICCA BI Export")
print("=" * 80)
print(f"\nTotal Sheets: {len(wb.sheet_names())}")
print(f"Sheet names: {wb.sheet_names()}\n")

# Inspect each sheet
for sheet_name in wb.sheet_names()[:3]:  # First 3 sheets
    ws = wb.sheet_by_name(sheet_name)
    print(f"\n{'='*80}")
    print(f"Sheet: {sheet_name}")
    print(f"{'='*80}")
    print(f"Dimensions: {ws.nrows} rows x {ws.ncols} columns")
    
    # Get headers
    if ws.nrows > 0:
        headers = [ws.cell_value(0, col) for col in range(ws.ncols)]
        print(f"\n📝 Headers ({len([h for h in headers if h])}):")
        for i, header in enumerate(headers[:20], 1):
            if header:
                print(f"  {i:2d}. {header}")
        
        # Get first 3 data rows
        print(f"\n📋 Sample Data (first 3 rows):")
        for row_idx in range(1, min(4, ws.nrows)):
            row = [ws.cell_value(row_idx, col) for col in range(ws.ncols)]
            print(f"\nRow {row_idx + 1}:")
            for col_idx, (header, value) in enumerate(zip(headers[:15], row[:15])):
                if header and value:
                    # Truncate long values
                    val_str = str(value)[:60]
                    print(f"  {header}: {val_str}")

print(f"\n\n{'='*80}")
print("SUMMARY FOR SCORING LOGIC")
print("="*80)

# Check if Editions sheet exists
editions_sheet = None
for name in wb.sheet_names():
    if 'edition' in name.lower():
        editions_sheet = name
        break

if editions_sheet:
    ws = wb.sheet_by_name(editions_sheet)
    print(f"\n✅ Found Editions sheet: '{editions_sheet}'")
    print(f"   Total records: {ws.nrows - 1} (excluding header)")
    
    headers = [ws.cell_value(0, col) for col in range(ws.ncols)]
    
    # Check for key fields needed for scoring
    key_fields = {
        'Event/Series Name': ['EVENT', 'SERIES', 'SERIESNAME', 'Event', 'Series'],
        'Country': ['COUNTRY', 'Country'],
        'City': ['CITY', 'City'],
        'Delegates': ['TOTATTEND', 'REGATTEND', 'Delegates', 'Attendees', 'ATTENDANCE'],
        'Email': ['EMAIL', 'Email', 'CONTACT_EMAIL'],
        'Phone': ['PHONE', 'Phone', 'TEL'],
        'Year': ['YEAR', 'Year'],
        'Series ID': ['SERIESID', 'SeriesID', 'Series ID'],
        'Event Code': ['ECODE', 'Ecode', 'Event Code']
    }
    
    print("\n📊 Key fields for scoring:")
    for category, field_names in key_fields.items():
        found = [h for h in headers if h and any(str(fn).upper() == str(h).upper() for fn in field_names)]
        if found:
            print(f"  ✅ {category}: {found[0]}")
        else:
            print(f"  ⚠️  {category}: NOT FOUND (looking for: {', '.join(field_names[:3])})")
    
    # Count Vietnam/SEA events
    country_col = None
    for col_idx, header in enumerate(headers):
        if header and str(header).upper() in ['COUNTRY', 'COUNTRYNAME']:
            country_col = col_idx
            break
    
    if country_col is not None:
        vietnam_count = 0
        sea_count = 0
        asia_count = 0
        sea_countries = ['VIETNAM', 'THAILAND', 'SINGAPORE', 'MALAYSIA', 'INDONESIA', 
                        'PHILIPPINES', 'MYANMAR', 'CAMBODIA', 'LAOS', 'BRUNEI']
        asia_countries = ['CHINA', 'JAPAN', 'KOREA', 'INDIA', 'TAIWAN', 'HONG KONG']
        
        for row_idx in range(1, ws.nrows):
            country = str(ws.cell_value(row_idx, country_col)).upper().strip()
            if 'VIETNAM' in country or country == 'VN':
                vietnam_count += 1
            elif any(sea in country for sea in sea_countries):
                sea_count += 1
            elif any(asia in country for asia in asia_countries):
                asia_count += 1
        
        print(f"\n📍 Geographic Distribution:")
        print(f"  🇻🇳 Vietnam events: {vietnam_count}")
        print(f"  🌏 Southeast Asia events: {sea_count}")
        print(f"  🌏 Other Asia events: {asia_count}")
        print(f"  🌍 Total events: {ws.nrows - 1}")
        
        # Calculate potential high-priority events
        high_priority_potential = vietnam_count + sea_count
        print(f"\n🎯 Potential HIGH priority events: ~{high_priority_potential}")
        print(f"   (Events with History Score ≥ 15)")
else:
    print("\n❌ No 'Editions' sheet found!")
    print("   Available sheets:", wb.sheet_names())

print("\n" + "="*80)
print("\n✅ Ready to test with app! Upload this file to see scoring in action.")
print("="*80)
