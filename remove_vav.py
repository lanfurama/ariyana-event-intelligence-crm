
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# VideoAnalysisView range (from extraction step)
start_idx = 93
end_idx = 295

print(f"Line {start_idx+1}: {lines[start_idx]}") # Should be // 8. Video Analysis View
print(f"Line {end_idx}: {lines[end_idx-1]}") # Should be }; (end of component)
if end_idx < len(lines):
    print(f"Line {end_idx+1}: {lines[end_idx]}") # Should be empty or next component

new_content = lines[:start_idx] + [
    "\n",
    "// VideoAnalysisView is now imported from views/VideoAnalysisView\n",
    "import { VideoAnalysisView } from './views/VideoAnalysisView';\n",
    "\n"
] + lines[end_idx:]

print(f"Writing {len(new_content)} lines to {app_path}...")
with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("Removal complete.")
