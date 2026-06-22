"""
Upload a country's CSV dataset to Supabase.

Usage:
    pip install supabase
    export SUPABASE_URL=https://your-project.supabase.co
    export SUPABASE_SERVICE_KEY=your-service-role-key
    python upload_dataset.py --csv govAlign_india_100.csv --country India
"""
import argparse
import csv
import os
import sys

from supabase import create_client


def main():
    parser = argparse.ArgumentParser(description="Upload a country's CSV to Supabase prompts table.")
    parser.add_argument("--csv", required=True, help="Path to the CSV file")
    parser.add_argument("--country", required=True, help="Country name (e.g. 'India')")
    parser.add_argument("--batch", type=int, default=100, help="Batch size for upserts")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.", file=sys.stderr)
        sys.exit(1)

    sb = create_client(url, key)

    rows = []
    with open(args.csv, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            row["country"] = args.country
            row["uploaded_by"] = "pulkitchatwal@gmail.com"
            rows.append(row)

    if not rows:
        print("No rows found in CSV.")
        return

    # Upsert in batches.
    total = len(rows)
    for i in range(0, total, args.batch):
        batch = rows[i : i + args.batch]
        result = sb.table("prompts").upsert(batch).execute()
        # The supabase-py client raises on error; result.data is the list of upserted rows.
        print(f"  Upserted rows {i + 1}-{min(i + args.batch, total)}")

    print(f"Done. {total} rows uploaded for {args.country}.")


if __name__ == "__main__":
    main()