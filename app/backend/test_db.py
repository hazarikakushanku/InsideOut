import os
import json
import uuid
import urllib.request
from datetime import datetime, timezone

# Load manually to avoid python-dotenv requirement if it's missing
url = ""
key = ""
try:
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("SUPABASE_URL="):
                url = line.split("=", 1)[1].strip()
            elif line.startswith("SUPABASE_KEY="):
                key = line.split("=", 1)[1].strip()
except Exception as e:
    print("Could not read .env:", e)

print("URL:", url)

if not url or not key:
    print("Error: Missing SUPABASE_URL or SUPABASE_KEY")
    exit(1)

# Ensure URL does not have trailing slash
if url.endswith("/"):
    url = url[:-1]

rest_url = f"{url}/rest/v1/scans"

dummy_scan = {
    "id": str(uuid.uuid4()),
    "profile": "default",
    "product_name": "Test Product",
    "product_category": "Test Category",
    "health_score": 100,
    "overall_status": "safe",
    "summary": "This is a test scan",
    "raw_text": "Test text",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "ingredients": [{"name": "Water", "status": "safe", "plain": "Water", "citation": "None", "tags": []}],
    "categories": [],
    "alternatives": []
}

data = json.dumps(dummy_scan).encode('utf-8')

req = urllib.request.Request(rest_url, data=data, method='POST')
req.add_header('apikey', key)
req.add_header('Authorization', f'Bearer {key}')
req.add_header('Content-Type', 'application/json')
req.add_header('Prefer', 'return=representation')

print("Attempting to insert dummy scan via raw REST API...")
try:
    with urllib.request.urlopen(req) as response:
        res_body = response.read()
        res_json = json.loads(res_body)
        print("SUCCESS! Inserted scan ID:", res_json[0]['id'])
except urllib.error.HTTPError as e:
    print("\n--- DATABASE ERROR OCCURRED ---")
    print(f"HTTP Error {e.code}: {e.reason}")
    print("Response Body:", e.read().decode('utf-8'))
except Exception as e:
    print("\n--- UNEXPECTED ERROR ---")
    print(str(e))
