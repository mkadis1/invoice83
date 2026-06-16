import os
import re

backup_path = r"d:\Antigravity\Racunovodstvo\BACKUP-16-06-2026\static\app.js"
target_path = r"d:\Antigravity\Racunovodstvo\static\app.js"

print("Reading backup file...")
with open(backup_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace route in renderModuleToContainer
old_route = "else if (moduleName === 'zgodovina') { await renderHelp(); await window.renderHelpDetail('zgodovina'); }"
new_route = "else if (moduleName === 'zgodovina') await renderZgodovina();"

if old_route in content:
    content = content.replace(old_route, new_route)
    print("[OK] Route replaced successfully.")
else:
    print("[ERR] Old route not found in backup file!")

# 2. Find and extract the 'zgodovina' topic from helpTopics array, and remove it.
# We will look for the exact block from the end of kompenzacije to the end of the helpTopics array.
# The kompenzacije item ends with:
#                 <p>To omogoča hitro prehajanje med povezanimi računi in dobropisi brez iskanja po seznamih.</p>
#             `
#         },
#         {
#             id: 'zgodovina',
#             ...
#         }
#     ];

pattern_to_remove = r"""\s*\},\s*{\s*id:\s*'zgodovina',\s*(?:[^\n]*\n)*?\s*}\s*\];\s*"""
# Let's find exactly the zgodovina block content using string searching first to be very safe.
start_marker = "id: 'zgodovina',"
zgodovina_pos = content.find(start_marker)
if zgodovina_pos != -1:
    print(f"[OK] Found zgodovina at position {zgodovina_pos}")
    # Let's find details: `
    details_start_str = "details: `"
    details_pos = content.find(details_start_str, zgodovina_pos)
    if details_pos != -1:
        details_content_start = details_pos + len(details_start_str)
        # Find the matching closing ` for details
        details_end_pos = content.find("`", details_content_start)
        # Extract the details HTML content
        details_html = content[details_content_start:details_end_pos].strip()
        print("[OK] Extracted details HTML successfully.")
        
        # Now let's remove the zgodovina block from helpTopics
        # We find the 'kompenzacije' block preceding it.
        kompenzacije_end_marker = 'To omogoča hitro prehajanje med povezanimi računi in dobropisi brez iskanja po seznamih.</p>\n            `'
        komp_end_pos = content.find(kompenzacije_end_marker)
        if komp_end_pos != -1:
            print("[OK] Found end of kompenzacije.")
            # Let's replace the whole block from the end of kompenzacije to the end of the helpTopics array
            target_block_start = content.find('}', komp_end_pos)
            # Find the closing array bracket ]; after the zgodovina topic
            target_block_end = content.find('];', zgodovina_pos) + 2
            
            old_block = content[target_block_start:target_block_end]
            new_block = "}\n    ];"
            
            content = content[:target_block_start] + new_block + content[target_block_end:]
            print("[OK] Removed zgodovina topic from helpTopics array.")
            
            # 3. Create renderZgodovina function
            # Let's clean up details_html slightly if needed (it might contain some extra indentation, but that is fine)
            render_zgodovina_func = f"""
async function renderZgodovina() {{
    titleEl.textContent = "Zgodovina sprememb";
    contentDiv.innerHTML = `
        <div id="zgodovina-wrapper" style="max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.05);">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:30px; border-bottom: 2px solid var(--bg-sidebar); padding-bottom: 15px;">
                <span style="font-size:2.5rem;">🕒</span>
                <h2 style="margin:0; color:var(--primary-blue);">Zgodovina sprememb in novosti</h2>
            </div>
            <div id="zgodovina-marker" style="background:#fff; border:1px solid #eee; border-radius:10px; padding:20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                {details_html}
            </div>
        </div>
    `;
}}
"""
            # Insert this right after the end of renderHelp function
            help_end_marker = "window.renderHelpList();\n}"
            help_end_pos = content.find(help_end_marker)
            if help_end_pos != -1:
                insert_pos = help_end_pos + len(help_end_marker)
                content = content[:insert_pos] + "\n\n" + render_zgodovina_func + content[insert_pos:]
                print("[OK] Inserted renderZgodovina function.")
                
                # Write back to target
                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print("[SUCCESS] Modified app.js written to target path.")
            else:
                print("[ERR] Could not find end of renderHelp function!")
        else:
            print("[ERR] Could not find end of kompenzacije!")
    else:
        print("[ERR] Could not find details in zgodovina topic!")
else:
    print("[ERR] Could not find zgodovina topic start!")
