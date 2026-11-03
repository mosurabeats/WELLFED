#!/usr/bin/env python3
"""
Build src/data/usda-nutrients.json from the USDA FoodData Central SR Legacy CSV
release. Every fdcId referenced in src/data/ingredient-specs.ts is looked up;
the script fails loudly if one is missing so nothing is silently guessed.

Usage:
  curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
  unzip FoodData_Central_sr_legacy_food_csv_2018-04.zip
  python3 scripts/build-nutrients.py FoodData_Central_sr_legacy_food_csv_2018-04
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS = os.path.join(ROOT, "src", "data", "ingredient-specs.ts")
OUT = os.path.join(ROOT, "src", "data", "usda-nutrients.json")

# FDC nutrient ids
NUTRIENTS = {
    "1008": "kcal",
    "1003": "protein",
    "1005": "carbs",
    "1004": "fat",
    "1258": "satFat",
    "1079": "fiber",
    "1093": "sodium",
    "1235": "addedSugar",
    "2000": "totalSugar",
}


def main(data_dir: str) -> None:
    ids = sorted(set(int(m) for m in re.findall(r"fdcId:\s*(\d+)", open(SPECS).read())))
    wanted = {str(i) for i in ids}

    desc = {}
    with open(os.path.join(data_dir, "food.csv"), newline="") as f:
        for row in csv.DictReader(f):
            if row["fdc_id"] in wanted:
                desc[row["fdc_id"]] = row["description"]

    missing = wanted - desc.keys()
    if missing:
        sys.exit(f"fdcIds not found in SR Legacy: {sorted(missing)}")

    values = {i: {} for i in wanted}
    with open(os.path.join(data_dir, "food_nutrient.csv"), newline="") as f:
        for row in csv.DictReader(f):
            fid = row["fdc_id"]
            if fid in wanted and row["nutrient_id"] in NUTRIENTS:
                values[fid][NUTRIENTS[row["nutrient_id"]]] = round(float(row["amount"]), 3)

    out = {}
    for fid in sorted(wanted, key=int):
        v = values[fid]
        for key in ("kcal", "protein", "carbs", "fat"):
            if key not in v:
                sys.exit(f"{fid} {desc[fid]} lacks {key}")
        out[fid] = {
            "description": desc[fid],
            "per100g": {
                "kcal": v["kcal"],
                "protein": v["protein"],
                "carbs": v["carbs"],
                "fat": v["fat"],
                "satFat": v.get("satFat", 0),
                "fiber": v.get("fiber", 0),
                "sodium": v.get("sodium", 0),
                "addedSugar": v.get("addedSugar"),
            },
            "totalSugar": v.get("totalSugar"),
        }

    payload = {
        "source": "USDA FoodData Central, SR Legacy (April 2018 release)",
        "url": "https://fdc.nal.usda.gov/",
        "basis": "per 100 g edible portion",
        "foods": out,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=1)
    print(f"wrote {len(out)} foods to {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
