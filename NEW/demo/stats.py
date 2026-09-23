#!/usr/bin/env python3
import os
import sys

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(base_dir, "demo") if os.path.exists(os.path.join(base_dir, "demo")) else base_dir)

import demo_analytics

def main():
    analytics_db = os.path.join(base_dir, "demo", "analytics.db") if os.path.exists(os.path.join(base_dir, "demo", "analytics.db")) else os.path.join(base_dir, "analytics.db")
    if not os.path.exists(analytics_db):
        print("\n[!] Baza analitike se ne obstaja ali se ni zabelezenih obiskov.")
        return

    data = demo_analytics.get_analytics_summary(analytics_db)
    
    print("\n========================================================")
    print("           📊 INVOICE83 DEMO STATISTIKA OBISKA")
    print("========================================================")
    print(f"  Vsi zabelezeni obiski (seje):   {data['total_sessions']}")
    print(f"  Danes novih obiskovalcev:       {data['sessions_today']}")
    print(f"  Povprecen cas aktivnosti:       {data['avg_duration_min']} minut")
    print("--------------------------------------------------------")
    print("  📱 Naprave:")
    for d in data['devices']:
        print(f"     - {d[0]}: {d[1]}")
    if not data['devices']:
        print("     (ni podatkov)")
        
    print("\n  🌐 Brskalniki:")
    for b in data['browsers']:
        print(f"     - {b[0]}: {b[1]}")
    if not data['browsers']:
        print("     (ni podatkov)")

    print("\n  ⚡ Najbolj aktivni moduli / kliki:")
    for e in data['top_events']:
        print(f"     - {e[0]}: {e[1]}x")
    if not data['top_events']:
        print("     (ni zabelezenih klikov)")

    print("\n  📋 Zadnjih 10 obiskovalcev:")
    print(f"  {'Datum/Ura':<20} | {'Trajanje':<9} | {'Naprava':<20} | {'IP'}")
    print("  " + "-"*70)
    for s in data['recent_sessions'][:10]:
        dur = f"{s[3]}s" if s[3] < 60 else f"{s[3]//60}m {s[3]%60}s"
        print(f"  {s[1]:<20} | {dur:<9} | {s[5]:<20} | {s[4]}")
    print("========================================================\n")

if __name__ == "__main__":
    main()
