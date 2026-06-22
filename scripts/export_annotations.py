"""
Export all annotations as CSV with joined prompt data.
Optionally computes simple inter-annotator agreement.

Usage:
    pip install supabase
    export SUPABASE_URL=https://your-project.supabase.co
    export SUPABASE_SERVICE_KEY=your-service-role-key
    python export_annotations.py [--country India]
"""
import argparse
import csv
import datetime
import os
import sys
from collections import defaultdict

from supabase import create_client


def main():
    parser = argparse.ArgumentParser(description="Export annotations to CSV.")
    parser.add_argument("--country", default=None, help="Filter by country (e.g. 'India')")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.", file=sys.stderr)
        sys.exit(1)

    sb = create_client(url, key)

    # Fetch annotations joined with prompts. Paginate to avoid the 1000-row default cap.
    PAGE = 1000
    all_rows = []
    from_idx = 0
    while True:
        query = (
            sb.table("annotations")
            .select("*, prompts(country, jurisdiction, law_article, compliance_dimension, prompt_text, expected_behavior, violation_type, language)")
            .range(from_idx, from_idx + PAGE - 1)
        )
        if args.country:
            query = query.eq("country", args.country)
        result = query.execute()
        data = result.data or []
        all_rows.extend(data)
        if len(data) < PAGE:
            break
        from_idx += PAGE

    if not all_rows:
        print("No annotations found.")
        return

    # Flatten nested prompt fields.
    flat = []
    for r in all_rows:
        prompt = r.pop("prompts", {}) or {}
        r.update({f"prompt_{k}": v for k, v in prompt.items()})
        flat.append(r)

    date_str = datetime.date.today().isoformat()
    country_str = args.country.lower().replace(" ", "_") if args.country else "all"
    fname = f"govalign_annotations_{country_str}_{date_str}.csv"

    with open(fname, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(flat[0].keys()))
        writer.writeheader()
        writer.writerows(flat)

    print(f"Exported {len(flat)} rows to {fname}")

    # Simple IAA stats (prompts with >=2 annotations).
    by_prompt = defaultdict(list)
    for r in flat:
        by_prompt[r["prompt_id"]].append(r)

    multi = {pid: anns for pid, anns in by_prompt.items() if len(anns) >= 2}
    if multi:
        print(f"\nInter-annotator overlap: {len(multi)} prompts have >=2 annotations")
        for field in ["law_verified", "difficulty", "implicitness"]:
            agree = sum(
                1 for anns in multi.values()
                if len(set(a.get(field) for a in anns)) == 1
            )
            pct = agree / len(multi) * 100
            print(f"  {field} agreement: {agree}/{len(multi)} ({pct:.1f}%)")
    else:
        print("\nNo prompts have >=2 annotations yet.")


if __name__ == "__main__":
    main()