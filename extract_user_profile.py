
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"
target_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\views\UserProfileView.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# UserProfileView range
# Line 88 (index 87) to Line 267 (index 266)
start_idx = 87
end_idx = 267

content_lines = lines[start_idx:end_idx]

imports = [
    "import React, { useState } from 'react';\n",
    "import { Loader2, Save } from 'lucide-react';\n",
    "import { User } from '../types';\n",
    "import { usersApi } from '../services/apiService';\n",
    "\n"
]

modified_content = []
for line in content_lines:
    if line.strip().startswith("const UserProfileView ="):
        modified_content.append(line.replace("const UserProfileView =", "export const UserProfileView ="))
    else:
        modified_content.append(line)

final_content = imports + modified_content

print(f"Writing to {target_path}...")
with open(target_path, 'w', encoding='utf-8') as f:
    f.writelines(final_content)

print("Extraction complete.")
