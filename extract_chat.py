
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"
target_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\components\ChatAssistant.tsx"

print(f"Reading {app_path}...")
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# ChatAssistant range
start_idx = 76
end_idx = 407
# Inclusive means we need lines[76:408] if end_idx is 407.
# Let's verify line 76 (index 76) and line 407 (index 407).
# Wait, list indices are 0-based.
# line 1 is index 0.
# line 76 is index 75.
# line 407 is index 406.
# If I look at the output of `view_file` which shows "76: const ChatAssistant...", that means index 75.
# And "407: };", that means index 406.
# So range is 75 to 406 inclusive -> 75 to 407 exclusive.

content_lines = lines[75:407]

imports = [
    "import React, { useState, useEffect, useRef } from 'react';\n",
    "import { Bot, Send, Loader2 } from 'lucide-react';\n",
    "import { User, ChatMessage } from '../types';\n",
    "import { chatMessagesApi } from '../services/apiService';\n",
    "import * as GPTService from '../services/gptService';\n",
    "import { extractRetryDelay, isRateLimitError } from '../services/gptService';\n",
    "import { formatMarkdown } from '../utils/markdownUtils';\n",
    "\n"
]

modified_content = []
for line in content_lines:
    if line.strip().startswith("const ChatAssistant ="):
        modified_content.append(line.replace("const ChatAssistant =", "export const ChatAssistant ="))
    else:
        modified_content.append(line)

final_content = imports + modified_content

print(f"Writing to {target_path}...")
with open(target_path, 'w', encoding='utf-8') as f:
    f.writelines(final_content)

print("Extraction complete.")
