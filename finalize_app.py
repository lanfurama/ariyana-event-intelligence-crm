
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# indices 0-based.
# line 101 is index 100.
start_idx = 100

full_app_code = lines[start_idx:]

imports = [
    "import React, { useState, useEffect } from 'react';\n",
    "import { User, Lead } from './types';\n",
    "import { usersApi, leadsApi } from './services/apiService';\n",
    "import { mapLeadFromDB, mapLeadToDB } from './utils/leadUtils';\n",
    "import { INITIAL_LEADS } from './constants';\n",
    "import { LoginView } from './components/LoginView';\n",
    "import { Sidebar } from './components/Sidebar';\n",
    "import { Dashboard } from './views/Dashboard';\n",
    "import { LeadsView } from './views/LeadsView';\n",
    "import { LeadDetail } from './components/LeadDetail';\n",
    "import { IntelligentDataView } from './views/IntelligentDataView';\n",
    "import { ChatAssistant } from './components/ChatAssistant';\n",
    "import { EmailTemplatesView } from './views/EmailTemplatesView';\n",
    "import { UserProfileView } from './views/UserProfileView';\n",
    "import { VideoAnalysisView } from './views/VideoAnalysisView';\n",
    "\n"
]

final_content = imports + full_app_code

print(f"Writing {len(final_content)} lines to {app_path}...")
with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(final_content)

print("Finalization complete.")
