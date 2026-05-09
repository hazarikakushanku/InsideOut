import re

HAZARD_KB = [
    {
        "key": "sodium_benzoate",
        "aliases": ["e211", "sodium benzoate", "benzoate of soda"],
        "name": "Sodium Benzoate (E211)",
        "status": "caution",
        "plain": "May cause hyperactivity in children when combined with artificial colors.",
        "tags": ["kids"],
        "citation": "WHO/EFSA Safety Guidelines"
    },
    {
        "key": "tartrazine",
        "aliases": ["e102", "fd&c yellow 5", "tartrazine"],
        "name": "Tartrazine (E102)",
        "status": "risky",
        "plain": "Linked to allergic reactions and hyperactivity.",
        "tags": ["kids", "sensitive_skin"],
        "citation": "FDA Warnings on Food Colors"
    },
    {
        "key": "allura_red",
        "aliases": ["e129", "fd&c red 40", "allura red", "red 40"],
        "name": "Allura Red (E129)",
        "status": "risky",
        "plain": "Possible link to hyperactivity in children.",
        "tags": ["kids"],
        "citation": "EFSA Scientific Opinion"
    },
    {
        "key": "sunset_yellow",
        "aliases": ["e110", "fd&c yellow 6", "sunset yellow", "yellow 6"],
        "name": "Sunset Yellow (E110)",
        "status": "risky",
        "plain": "May trigger allergies and hyperactivity.",
        "tags": ["kids", "sensitive_skin"],
        "citation": "FDA Regulations"
    },
    {
        "key": "sulphur_dioxide",
        "aliases": ["e220", "sulfur dioxide", "sulphur dioxide", "sulfites"],
        "name": "Sulphur Dioxide (E220)",
        "status": "caution",
        "plain": "Can trigger severe allergic reactions, especially in asthmatics.",
        "tags": ["sensitive_skin"],
        "citation": "FDA Food Labeling Guide"
    },
    {
        "key": "sodium_nitrite",
        "aliases": ["e250", "sodium nitrite", "nitrite"],
        "name": "Sodium Nitrite (E250)",
        "status": "risky",
        "plain": "Forms potentially carcinogenic compounds when cooked at high heat.",
        "tags": ["kids"],
        "citation": "WHO IARC Monographs"
    },
    {
        "key": "msg",
        "aliases": ["e621", "monosodium glutamate", "msg", "yeast extract"],
        "name": "Monosodium Glutamate (E621)",
        "status": "caution",
        "plain": "May cause headaches and allergic reactions in sensitive individuals.",
        "tags": ["sensitive_skin"],
        "citation": "FDA GRAS Notices"
    },
    {
        "key": "aspartame",
        "aliases": ["e951", "aspartame", "nutrasweet", "equal"],
        "name": "Aspartame (E951)",
        "status": "caution",
        "plain": "Controversial artificial sweetener; potentially harmful in high doses.",
        "tags": ["kids", "fitness"],
        "citation": "WHO/IARC Evaluation"
    },
    {
        "key": "sucralose",
        "aliases": ["e955", "sucralose", "splenda"],
        "name": "Sucralose (E955)",
        "status": "caution",
        "plain": "May affect gut microbiome and insulin sensitivity.",
        "tags": ["fitness"],
        "citation": "FDA Food Additive Status"
    },
    {
        "key": "titanium_dioxide",
        "aliases": ["e171", "titanium dioxide", "tio2", "ci 77891"],
        "name": "Titanium Dioxide (E171)",
        "status": "risky",
        "plain": "Banned as food additive in EU due to genotoxicity concerns.",
        "tags": ["kids", "sensitive_skin"],
        "citation": "EFSA Safety Assessment"
    },
    {
        "key": "hfcs",
        "aliases": ["hfcs", "high fructose corn syrup", "corn syrup", "glucose-fructose syrup"],
        "name": "High Fructose Corn Syrup",
        "status": "risky",
        "plain": "Linked to obesity, insulin resistance, and metabolic syndrome.",
        "tags": ["kids", "fitness"],
        "citation": "WHO Sugar Guidelines"
    },
    {
        "key": "added_sugar",
        "aliases": ["sugar", "sucrose", "cane sugar", "added sugar"],
        "name": "Added Sugar",
        "status": "caution",
        "plain": "Excessive consumption leads to weight gain and chronic diseases.",
        "tags": ["kids", "fitness"],
        "citation": "WHO Guidelines on Sugar Intake"
    },
    {
        "key": "saccharin",
        "aliases": ["e954", "saccharin", "sweet'n low"],
        "name": "Saccharin (E954)",
        "status": "caution",
        "plain": "Artificial sweetener with mixed safety history.",
        "tags": ["fitness"],
        "citation": "FDA Safety Communication"
    },
    {
        "key": "trans_fat",
        "aliases": ["trans fat", "partially hydrogenated oil", "hydrogenated vegetable oil"],
        "name": "Trans Fat",
        "status": "risky",
        "plain": "Strongly linked to heart disease. Banned in many countries.",
        "tags": ["kids", "fitness"],
        "citation": "WHO REPLACE Action Package"
    },
    {
        "key": "palm_oil",
        "aliases": ["palm oil", "palm kernel oil"],
        "name": "Palm Oil",
        "status": "caution",
        "plain": "High in saturated fat; environmental concerns.",
        "tags": ["fitness"],
        "citation": "WHO Nutritional Recommendations"
    },
    {
        "key": "caffeine",
        "aliases": ["caffeine", "guarana extract", "coffee extract"],
        "name": "Caffeine",
        "status": "caution",
        "plain": "Can cause jitteriness and sleep disruption in excess.",
        "tags": ["kids", "fitness"],
        "citation": "FDA Advice on Caffeine"
    },
    {
        "key": "taurine",
        "aliases": ["taurine", "l-taurine"],
        "name": "Taurine",
        "status": "caution",
        "plain": "Often combined with caffeine in energy drinks; high doses unstudied.",
        "tags": ["kids", "fitness"],
        "citation": "EFSA Scientific Opinion"
    },
    {
        "key": "ephedra",
        "aliases": ["ephedra", "ma huang"],
        "name": "Ephedra",
        "status": "risky",
        "plain": "Banned stimulant linked to heart attacks.",
        "tags": ["fitness"],
        "citation": "FDA Ban on Ephedra"
    },
    {
        "key": "dmaa",
        "aliases": ["dmaa", "1,3-dimethylamylamine", "geranium extract"],
        "name": "DMAA",
        "status": "risky",
        "plain": "Illegal stimulant posing serious cardiovascular risks.",
        "tags": ["fitness"],
        "citation": "FDA DMAA Warnings"
    },
    {
        "key": "soy",
        "aliases": ["soy", "soybean", "soy lecithin", "soy protein"],
        "name": "Soy",
        "status": "caution",
        "plain": "Common allergen; phytoestrogens may affect sensitive individuals.",
        "tags": ["fitness", "sensitive_skin"],
        "citation": "FDA Food Allergen Labeling"
    },
    {
        "key": "gluten",
        "aliases": ["gluten", "wheat", "barley", "rye", "wheat flour"],
        "name": "Gluten / Wheat",
        "status": "caution",
        "plain": "Triggers reactions in celiac disease or gluten sensitivity.",
        "tags": ["sensitive_skin"],
        "citation": "FDA Gluten-Free Labeling"
    },
    {
        "key": "dairy",
        "aliases": ["dairy", "lactose", "milk", "milk powder", "casein"],
        "name": "Dairy / Lactose",
        "status": "caution",
        "plain": "Common allergen and cause of digestive issues for lactose intolerant.",
        "tags": ["sensitive_skin"],
        "citation": "WHO Food Allergies"
    },
    {
        "key": "parabens",
        "aliases": ["parabens", "methylparaben", "propylparaben", "butylparaben"],
        "name": "Parabens",
        "status": "risky",
        "plain": "Potential endocrine disruptors; may interfere with hormones.",
        "tags": ["sensitive_skin", "kids"],
        "citation": "EU Cosmetics Regulation"
    },
    {
        "key": "sls",
        "aliases": ["sls", "sles", "sodium lauryl sulfate", "sodium laureth sulfate"],
        "name": "SLS / SLES",
        "status": "caution",
        "plain": "Harsh detergent that can strip skin and cause irritation.",
        "tags": ["sensitive_skin", "kids"],
        "citation": "FDA Cosmetic Ingredients"
    },
    {
        "key": "phthalates",
        "aliases": ["phthalates", "dep", "dbp", "fragrance (phthalates)"],
        "name": "Phthalates",
        "status": "risky",
        "plain": "Endocrine disruptors linked to reproductive issues.",
        "tags": ["sensitive_skin", "kids"],
        "citation": "FDA Phthalates in Cosmetics"
    },
    {
        "key": "formaldehyde_releasers",
        "aliases": ["formaldehyde releasers", "dmdm hydantoin", "imidazolidinyl urea", "diazolidinyl urea"],
        "name": "Formaldehyde Releasers",
        "status": "risky",
        "plain": "Slowly releases formaldehyde, a known carcinogen.",
        "tags": ["sensitive_skin"],
        "citation": "IARC Classification"
    },
    {
        "key": "triclosan",
        "aliases": ["triclosan"],
        "name": "Triclosan",
        "status": "risky",
        "plain": "Antibacterial agent linked to hormone disruption and resistance.",
        "tags": ["sensitive_skin"],
        "citation": "FDA Triclosan Rule"
    },
    {
        "key": "oxybenzone",
        "aliases": ["oxybenzone", "benzophenone-3"],
        "name": "Oxybenzone",
        "status": "caution",
        "plain": "Chemical sunscreen filter; potential hormone disruptor, damages reefs.",
        "tags": ["sensitive_skin", "kids"],
        "citation": "FDA Sunscreen Proposed Rule"
    },
    {
        "key": "mineral_oil",
        "aliases": ["mineral oil", "petrolatum", "paraffin", "liquid paraffin"],
        "name": "Mineral Oil",
        "status": "caution",
        "plain": "Petroleum derivative; can be comedogenic and trap dirt.",
        "tags": ["sensitive_skin"],
        "citation": "EU Cosmetic Safety"
    },
    {
        "key": "alcohol_denat",
        "aliases": ["alcohol denat", "denatured alcohol", "sd alcohol"],
        "name": "Alcohol Denat",
        "status": "caution",
        "plain": "Can be very drying and irritating to the skin barrier.",
        "tags": ["sensitive_skin"],
        "citation": "FDA Cosmetics Safety"
    },
    {
        "key": "vitamin_c",
        "aliases": ["vitamin c", "ascorbic acid", "e300"],
        "name": "Vitamin C (E300)",
        "status": "safe",
        "plain": "Essential nutrient and potent antioxidant.",
        "tags": [],
        "citation": "WHO Nutrient Requirements"
    },
    {
        "key": "vitamin_e",
        "aliases": ["vitamin e", "tocopherol", "e306"],
        "name": "Vitamin E (Tocopherol)",
        "status": "safe",
        "plain": "Antioxidant that protects cells from damage.",
        "tags": [],
        "citation": "FDA Nutrient Guidelines"
    },
    {
        "key": "citric_acid",
        "aliases": ["citric acid", "e330"],
        "name": "Citric Acid (E330)",
        "status": "safe",
        "plain": "Natural preservative found in citrus fruits.",
        "tags": [],
        "citation": "FDA GRAS Status"
    },
    {
        "key": "glycerin",
        "aliases": ["glycerin", "glycerol", "e422"],
        "name": "Glycerin",
        "status": "safe",
        "plain": "Excellent humectant that draws moisture to the skin.",
        "tags": [],
        "citation": "FDA Cosmetics Safety"
    },
    {
        "key": "hyaluronic_acid",
        "aliases": ["hyaluronic acid", "sodium hyaluronate"],
        "name": "Hyaluronic Acid",
        "status": "safe",
        "plain": "Naturally occurring substance that retains moisture.",
        "tags": [],
        "citation": "Dermatology Safety Boards"
    },
    {
        "key": "niacinamide",
        "aliases": ["niacinamide", "vitamin b3"],
        "name": "Niacinamide",
        "status": "safe",
        "plain": "Supports skin barrier, reduces inflammation.",
        "tags": [],
        "citation": "Cosmetic Ingredient Review"
    },
    {
        "key": "shea_butter",
        "aliases": ["shea butter", "butyrospermum parkii"],
        "name": "Shea Butter",
        "status": "safe",
        "plain": "Natural plant butter, excellent moisturizer.",
        "tags": [],
        "citation": "FDA Food and Cosmetics"
    },
    {
        "key": "salt",
        "aliases": ["salt", "sodium chloride"],
        "name": "Salt (Sodium Chloride)",
        "status": "caution",
        "plain": "Excessive intake raises blood pressure.",
        "tags": ["fitness"],
        "citation": "WHO Sodium Guidelines"
    },
    {
        "key": "whey_protein",
        "aliases": ["whey", "whey protein", "whey protein isolate"],
        "name": "Whey Protein",
        "status": "safe",
        "plain": "High-quality protein source derived from milk.",
        "tags": [],
        "citation": "FDA Dietary Supplements"
    },
    {
        "key": "creatine",
        "aliases": ["creatine", "creatine monohydrate"],
        "name": "Creatine",
        "status": "safe",
        "plain": "Well-studied supplement for energy and muscle performance.",
        "tags": [],
        "citation": "International Society of Sports Nutrition"
    }
]

ALTERNATIVES = {
    "soda": [
        {"name": "Sparkling Water with Lemon", "reason": "Zero sugar, natural flavor", "where": "https://amazon.com/s?k=sparkling+water"},
        {"name": "Kombucha", "reason": "Probiotics, lower sugar", "where": "https://amazon.com/s?k=kombucha"},
        {"name": "Green Tea", "reason": "Antioxidants, natural energy", "where": "https://amazon.com/s?k=green+tea"}
    ],
    "snack": [
        {"name": "Mixed Nuts", "reason": "Healthy fats and protein", "where": "https://amazon.com/s?k=mixed+nuts"},
        {"name": "Air-popped Popcorn", "reason": "Whole grain, high fiber", "where": "https://amazon.com/s?k=air+popped+popcorn"},
        {"name": "Dried Fruit", "reason": "Natural sweetness, vitamins", "where": "https://amazon.com/s?k=dried+fruit"}
    ],
    "cosmetic": [
        {"name": "Mineral Sunscreen", "reason": "Reef safe, no chemical filters", "where": "https://amazon.com/s?k=mineral+sunscreen"},
        {"name": "Plant-based Moisturizer", "reason": "No petroleum derivatives", "where": "https://amazon.com/s?k=plant+based+moisturizer"},
        {"name": "Sulfate-free Cleanser", "reason": "Gentle on skin barrier", "where": "https://amazon.com/s?k=sulfate+free+cleanser"}
    ],
    "sweetener": [
        {"name": "Stevia", "reason": "Natural zero-calorie sweetener", "where": "https://amazon.com/s?k=stevia"},
        {"name": "Monk Fruit", "reason": "Zero glycemic impact", "where": "https://amazon.com/s?k=monk+fruit"},
        {"name": "Raw Honey", "reason": "Antimicrobial properties", "where": "https://amazon.com/s?k=raw+honey"}
    ],
    "default": [
        {"name": "Organic Whole Foods", "reason": "Minimal processing", "where": "https://amazon.com/s?k=organic+foods"},
        {"name": "Clean Label Products", "reason": "No artificial additives", "where": "https://amazon.com/s?k=clean+label+products"},
        {"name": "Homemade Alternatives", "reason": "Full control over ingredients", "where": "https://amazon.com/s?k=healthy+recipes"}
    ]
}

def lookup(name: str):
    name_clean = name.lower().strip()
    for item in HAZARD_KB:
        if item["key"] == name_clean:
            return item
        for alias in item["aliases"]:
            if alias in name_clean or name_clean in alias:
                return item
        if item["name"].lower() in name_clean or name_clean in item["name"].lower():
            return item
    return None
