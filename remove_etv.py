
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# EmailTemplatesView range (from extraction step)
start_idx = 81
end_idx = 526 # index of line 527.

print(f"Line {start_idx+1}: {lines[start_idx]}") # Should be // 6. Email Templates Management View
print(f"Line {end_idx}: {lines[end_idx-1]}") # Should be }; (end of component)
if end_idx < len(lines):
    print(f"Line {end_idx+1}: {lines[end_idx]}") # Should be empty or next component

new_content = lines[:start_idx] + [
    "\n",
    "// EmailTemplatesView is now imported from views/EmailTemplatesView\n",
    "import { EmailTemplatesView } from './views/EmailTemplatesView';\n",
    "\n"
] + lines[end_idx:] # slices from line after the end of component?
# Wait. lines[start_idx:end_idx] includes index start_idx up to end_idx-1.
# Here I want to SKIP lines from start_idx to end_idx.
# lines[end_idx] is the line AFTER the component (or the `};` if I messed up indices).
# My extraction used lines[81:527]. That includes line 526 (index 526? No, index 526 is line 527).
# Wait, extraction used `content_lines = lines[start_idx:end_idx+1]` where end_idx=526.
# So lines[81:527]. Index 526 is included.
# Line 526 is index 525.
# Let's check line numbers again.
# 526: }; -> This is index 525.
# So content includes lines[81] to lines[525] inclusive.
# So I should SKIP lines[81] to lines[525].
# So use `lines[end_idx:]` where `end_idx` is 526?
# `lines[526:]` starts from index 526 (line 527).
# Correct.

print(f"Writing {len(new_content)} lines to {app_path}...")
with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("Removal complete.")
