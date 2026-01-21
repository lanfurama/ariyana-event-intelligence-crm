
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"
target_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\views\EmailTemplatesView.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# EmailTemplatesView range
# Line 82 (index 81) to Line 526 (index 525)
start_idx = 81
end_idx = 526
# content_lines = lines[81:527] to include lien 526.

content_lines = lines[start_idx:end_idx+1]

imports = [
    "import React, { useState, useEffect, useRef } from 'react';\n",
    "import { \n",
    "  Plus, \n",
    "  Search, \n",
    "  Edit2, \n",
    "  Trash2, \n",
    "  X, \n",
    "  Save, \n",
    "  FileText, \n",
    "  Check, \n",
    "  AlertCircle \n",
    "} from 'lucide-react';\n",
    "import { EmailTemplate } from '../types';\n",
    "import { emailTemplatesApi } from '../services/apiService';\n",
    "\n"
]

modified_content = []
for line in content_lines:
    if line.strip().startswith("const EmailTemplatesView ="):
        modified_content.append(line.replace("const EmailTemplatesView =", "export const EmailTemplatesView ="))
    else:
        modified_content.append(line)

final_content = imports + modified_content

print(f"Writing to {target_path}...")
with open(target_path, 'w', encoding='utf-8') as f:
    f.writelines(final_content)

print("Extraction complete.")
