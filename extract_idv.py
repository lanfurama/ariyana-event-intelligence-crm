
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"
target_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\views\IntelligentDataView.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Based on previous view_file, IntelligentDataView interfaces start at line 67 (index 66)
# Component ends at line 5351 (index 5350)
start_idx = 66
end_idx = 5351

content_lines = lines[start_idx:end_idx]

imports = [
    "import React, { useState, useRef, useEffect, useMemo } from 'react';\n",
    "import {\n",
    "  LayoutDashboard,\n",
    "  Users,\n",
    "  Search,\n",
    "  Plus,\n",
    "  ChevronRight,\n",
    "  Loader2,\n",
    "  Upload,\n",
    "  Save,\n",
    "  X,\n",
    "  Check,\n",
    "  ExternalLink,\n",
    "  BrainCircuit,\n",
    "  FileText,\n",
    "  Download,\n",
    "  FileSpreadsheet,\n",
    "  ChevronDown,\n",
    "  ChevronUp,\n",
    "  ChevronLeft,\n",
    "  Star,\n",
    "  User as UserIcon,\n",
    "  Calendar,\n",
    "  MapPin,\n",
    "  Sparkles,\n",
    "  CheckCircle,\n",
    "  TrendingUp,\n",
    "  Menu\n",
    "} from 'lucide-react';\n",
    "import { Lead } from '../types';\n",
    "import * as XLSX from 'xlsx';\n",
    "import * as GeminiService from '../services/geminiService';\n",
    "import { leadsApi, leadScoringApi } from '../services/apiService';\n",
    "import { mapLeadToDB } from '../utils/leadUtils';\n",
    "\n"
]

# Check if we need to export the component
# The component definition is: const IntelligentDataView = ...
# We should change it to: export const IntelligentDataView = ...

modified_content = []
for line in content_lines:
    if line.strip().startswith("const IntelligentDataView ="):
        modified_content.append(line.replace("const IntelligentDataView =", "export const IntelligentDataView ="))
    else:
        modified_content.append(line)

final_content = imports + modified_content

print(f"Writing to {target_path}...")
with open(target_path, 'w', encoding='utf-8') as f:
    f.writelines(final_content)

print("Extraction complete.")
