
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"
target_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\views\VideoAnalysisView.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# VideoAnalysisView range
# Line 94 (index 93) to Line 295 (index 294)
start_idx = 93
end_idx = 295

content_lines = lines[start_idx:end_idx]

imports = [
    "import React, { useState, useEffect } from 'react';\n",
    "import { \n",
    "  Loader2, \n",
    "  BrainCircuit, \n",
    "  FileText, \n",
    "  Upload, \n",
    "  Film, \n",
    "  X \n",
    "} from 'lucide-react';\n",
    "import * as GeminiService from '../services/geminiService';\n",
    "import { extractRetryDelay as extractGeminiRetryDelay, isRateLimitError as isGeminiRateLimitError } from '../services/geminiService';\n",
    "\n"
]

modified_content = []
for line in content_lines:
    if line.strip().startswith("const VideoAnalysisView ="):
        modified_content.append(line.replace("const VideoAnalysisView =", "export const VideoAnalysisView ="))
    else:
        modified_content.append(line)

final_content = imports + modified_content

print(f"Writing to {target_path}...")
with open(target_path, 'w', encoding='utf-8') as f:
    f.writelines(final_content)

print("Extraction complete.")
