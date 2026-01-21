
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# ChatAssistant range (from extraction step)
# Line 76 (index 75) to Line 407 (index 406)
start_idx = 75
end_idx = 407 # index of line 408

print(f"Line {start_idx+1}: {lines[start_idx]}") # Should be // 6. Chat Assistant
print(f"Line {end_idx}: {lines[end_idx-1]}") # Should be };
print(f"Line {end_idx+1}: {lines[end_idx]}") # Should be empty or next component

new_content = lines[:start_idx] + [
    "\n",
    "// ChatAssistant is now imported from components/ChatAssistant\n",
    "import { ChatAssistant } from './components/ChatAssistant';\n",
    "\n"
] + lines[end_idx:]

print(f"Writing {len(new_content)} lines to {app_path}...")
with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("Removal complete.")
