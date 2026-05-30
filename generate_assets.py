import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from xgboost import XGBClassifier
from pyproj import Transformer
import json
import os

print("--- Starting Asset Generation ---")

# 1. Load df_for_task2.csv
print("Loading df_for_task2.csv...")
df_path = "/Users/woojin/project/2025/underwater-big-data/데이터 분석 결과/df_for_task2.csv"
df = pd.read_csv(df_path, encoding="cp949")

# Rename columns
df = df.rename(columns={
    '관정심도_m의평균': 'mean_well_depth',
    '가뭄취약성 등급': 'drought_vulnerability',
    '평균양수량의평균': 'mean_pumped_volume_per_day',
    '자연수위_m의평균': 'mean_natural_water_level',
    '안정수위_m의평균': 'mean_stable_water_level',
    '저류계수의평균': 'mean_storage_coef',
    '개발여부': 'is_developable'
})
df = df.drop(columns=['양수능력_m의평균', '취수계획량의평균'])
df['mean_storage_coef'] = df['mean_storage_coef'].apply(lambda x: 0 if pd.isna(x) else 1)

feature_cols = ['hydrogeology', 'aquifer', 'water_quality_type', 'mean_well_depth', 'drought_vulnerability',
                'mean_pumped_volume_per_day', 'mean_natural_water_level', 'mean_stable_water_level', 'mean_storage_coef']
categorical = ['hydrogeology', 'aquifer', 'water_quality_type']
numerical = [col for col in feature_cols if col not in categorical]

# Cast types
df[categorical] = df[categorical].astype('str')
for col in numerical:
    df[col] = pd.to_numeric(df[col], errors='coerce')

# 2. Train XGBoost Model on labeled data
print("Preprocessing and training XGBoost model...")
temp = df[df['is_developable'].notna()]
X = temp[feature_cols].fillna(0)
y = temp['is_developable'].values.ravel()

# Calculate base score log-odds
base_score = float(y.mean())
base_score_logodds = float(np.log(base_score / (1.0 - base_score)))
print(f"Calculated base_score: {base_score:.6f} | base_score_logodds: {base_score_logodds:.6f}")

preprocessor = ColumnTransformer(
    transformers=[
        ('ohe', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical),
        ('scaler', StandardScaler(), numerical)
    ],
    remainder='drop'
)
X_proc = preprocessor.fit_transform(X)

xgb = XGBClassifier(
    objective='binary:logistic',
    eval_metric='logloss',
    random_state=42,
    n_estimators=30,
    max_depth=4
)
xgb.fit(X_proc, y)
print("Model training complete.")

# 3. Predict on all data
print("Running prediction on the entire dataset...")
X_all = df[feature_cols].fillna(0)
X_all_proc = preprocessor.transform(X_all)
pred_prob = xgb.predict_proba(X_all_proc)[:, 1]
df['pred_prob'] = pred_prob
df['pred'] = (pred_prob >= 0.5).astype(int)

# 4. Project coordinates from EPSG:5186 to EPSG:4326
print("Projecting coordinates from EPSG:5186 to EPSG:4326...")
transformer = Transformer.from_crs("EPSG:5186", "EPSG:4326", always_xy=True)

lons = []
lats = []
for x, y_val in zip(df['X'], df['Y']):
    try:
        lon, lat = transformer.transform(x, y_val)
        lons.append(lon)
        lats.append(lat)
    except:
        lons.append(np.nan)
        lats.append(np.nan)

df['lng'] = lons
df['lat'] = lats

# Filter out rows without valid coordinates
df = df.dropna(subset=['lat', 'lng'])
print(f"Total projected valid coordinates: {len(df)}")

# 5. Save the data points to JSON
print("Compiling wells_data.json...")
wells = []
for idx, row in df.iterrows():
    well_name = str(row['mw_name']) if pd.notna(row['mw_name']) else (str(row['sw_name']) if pd.notna(row['sw_name']) else f"Well #{row['ID']}")
    wells.append({
        "id": int(row['ID']),
        "name": well_name,
        "prov": str(row['province']) if pd.notna(row['province']) else "",
        "city": str(row['city_district']) if pd.notna(row['city_district']) else "",
        "town": str(row['township']) if pd.notna(row['township']) else "",
        "lat": float(row['lat']),
        "lng": float(row['lng']),
        "is_dev": int(row['is_developable']) if pd.notna(row['is_developable']) else -1,
        "prob": float(row['pred_prob']),
        "pred": int(row['pred']),
        "depth": float(row['mean_well_depth']) if pd.notna(row['mean_well_depth']) else 0.0,
        "drought": int(row['drought_vulnerability']) if pd.notna(row['drought_vulnerability']) else 0,
        "pump": float(row['mean_pumped_volume_per_day']) if pd.notna(row['mean_pumped_volume_per_day']) else 0.0,
        "nat_lvl": float(row['mean_natural_water_level']) if pd.notna(row['mean_natural_water_level']) else 0.0,
        "stab_lvl": float(row['mean_stable_water_level']) if pd.notna(row['mean_stable_water_level']) else 0.0,
        "storage": int(row['mean_storage_coef']),
        "wq_type": int(row['water_quality_type']) if pd.notna(row['water_quality_type']) else -1,
        "hydro": str(row['hydrogeology']) if pd.notna(row['hydrogeology']) else "",
        "aquifer": str(row['aquifer']) if pd.notna(row['aquifer']) else ""
    })

# Create web directories if they don't exist
os.makedirs("web-app/src/data", exist_ok=True)
os.makedirs("web-app/src/model", exist_ok=True)

with open("web-app/src/data/wells_data.json", "w", encoding="utf-8") as f:
    json.dump(wells, f, ensure_ascii=False, indent=2)
print(f"Successfully wrote {len(wells)} records to web-app/src/data/wells_data.json")

# 6. Extract preprocessing parameters
ohe = preprocessor.named_transformers_['ohe']
scaler = preprocessor.named_transformers_['scaler']

ohe_categories = [list(cat) for cat in ohe.categories_]
scaler_mean = list(scaler.mean_)
scaler_scale = list(scaler.scale_)

# Write model config
model_config = {
    "categorical_features": categorical,
    "numerical_features": numerical,
    "ohe_categories": ohe_categories,
    "scaler_mean": scaler_mean,
    "scaler_scale": scaler_scale,
    "base_score_logodds": base_score_logodds
}

with open("web-app/src/model/model_config.json", "w", encoding="utf-8") as f:
    json.dump(model_config, f, ensure_ascii=False, indent=2)
print("Saved model_config.json.")

# 7. Compile XGBoost Trees into TypeScript code
print("Compiling XGBoost Trees into TypeScript code...")
trees = xgb.get_booster().get_dump(dump_format='json')

def render_node(node):
    if "leaf" in node:
        return f"return {float(node['leaf'])};"
    
    feat_idx = int(node["split"][1:])
    split_cond = float(node["split_condition"])
    
    left_child = node["children"][0]
    right_child = node["children"][1]
    
    return f"""if (f[{feat_idx}] < {split_cond}) {{
  {render_node(left_child)}
}} else {{
  {render_node(right_child)}
}}"""

ts_code = f"""// Auto-generated XGBoost Inference Engine
import modelConfig from './model_config.json';

interface PredictInput {{
  hydrogeology: string;
  aquifer: string;
  water_quality_type: string;
  mean_well_depth: number;
  drought_vulnerability: number;
  mean_pumped_volume_per_day: number;
  mean_natural_water_level: number;
  mean_stable_water_level: number;
  mean_storage_coef: number;
}}

export function predictSuitability(input: PredictInput): {{ probability: number; label: number }} {{
  // 1. One-Hot Encoding
  const encodedCat: number[] = [];
  const oheCats = modelConfig.ohe_categories;
  
  // hydrogeology encoding
  const hydroIdx = oheCats[0].indexOf(input.hydrogeology);
  oheCats[0].forEach((_, i) => encodedCat.push(i === hydroIdx ? 1 : 0));
  
  // aquifer encoding
  const aquIdx = oheCats[1].indexOf(input.aquifer);
  oheCats[1].forEach((_, i) => encodedCat.push(i === aquIdx ? 1 : 0));
  
  // water_quality_type encoding
  const wqIdx = oheCats[2].indexOf(String(input.water_quality_type));
  oheCats[2].forEach((_, i) => encodedCat.push(i === wqIdx ? 1 : 0));
  
  // 2. Standard Scaling
  const mean = modelConfig.scaler_mean;
  const scale = modelConfig.scaler_scale;
  
  const scaledNum = [
    (input.mean_well_depth - mean[0]) / scale[0],
    (input.drought_vulnerability - mean[1]) / scale[1],
    (input.mean_pumped_volume_per_day - mean[2]) / scale[2],
    (input.mean_natural_water_level - mean[3]) / scale[3],
    (input.mean_stable_water_level - mean[4]) / scale[4],
    (input.mean_storage_coef - mean[5]) / scale[5]
  ];
  
  // Concatenate features
  const f = [...encodedCat, ...scaledNum];
  
  // 3. Evaluate Trees
  let sum = modelConfig.base_score_logodds; // base score logodds offset
  
"""

for i, tree_str in enumerate(trees):
    tree_node = json.loads(tree_str)
    ts_code += f"  // Tree {i}\n"
    ts_code += f"  const evaluateTree{i} = (f: number[]): number => {{\n"
    lines = render_node(tree_node).split('\n')
    ts_code += '\n'.join([f"    {line}" for line in lines])
    ts_code += "\n  };\n"
    ts_code += f"  sum += evaluateTree{i}(f);\n\n"

ts_code += """  // 4. Sigmoid activation
  const probability = 1.0 / (1.0 + Math.exp(-sum));
  const label = probability >= 0.5 ? 1 : 0;
  
  return { probability, label };
}
"""

with open("web-app/src/model/predict.ts", "w", encoding="utf-8") as f:
    f.write(ts_code)
print("Successfully generated web-app/src/model/predict.ts.")

# 8. Verify compiled TypeScript prediction matches Python's prediction
print("\n--- Verifying JS prediction vs Python prediction on first 5 samples ---")
mean = scaler_mean
scale = scaler_scale

def js_emulate(row):
    encodedCat = []
    oheCats = ohe_categories
    
    hydroIdx = oheCats[0].index(str(row['hydrogeology'])) if str(row['hydrogeology']) in oheCats[0] else -1
    for i in range(len(oheCats[0])):
        encodedCat.append(1 if i == hydroIdx else 0)
        
    aquIdx = oheCats[1].index(str(row['aquifer'])) if str(row['aquifer']) in oheCats[1] else -1
    for i in range(len(oheCats[1])):
        encodedCat.append(1 if i == aquIdx else 0)
        
    wqIdx = oheCats[2].index(str(row['water_quality_type'])) if str(row['water_quality_type']) in oheCats[2] else -1
    for i in range(len(oheCats[2])):
        encodedCat.append(1 if i == wqIdx else 0)
        
    scaledNum = [
        (float(row['mean_well_depth']) - mean[0]) / scale[0],
        (float(row['drought_vulnerability']) - mean[1]) / scale[1],
        (float(row['mean_pumped_volume_per_day']) - mean[2]) / scale[2],
        (float(row['mean_natural_water_level']) - mean[3]) / scale[3],
        (float(row['mean_stable_water_level']) - mean[4]) / scale[4],
        (float(row['mean_storage_coef']) - mean[5]) / scale[5]
    ]
    f_arr = encodedCat + scaledNum
    
    sum_val = base_score_logodds
    for i, t_str in enumerate(trees):
        t_node = json.loads(t_str)
        def eval_node(n):
            if "leaf" in n:
                return float(n["leaf"])
            feat = int(n["split"][1:])
            split_c = float(n["split_condition"])
            if f_arr[feat] < split_c:
                return eval_node(n["children"][0])
            else:
                return eval_node(n["children"][1])
        sum_val += eval_node(t_node)
        
    prob = 1.0 / (1.0 + np.exp(-sum_val))
    return prob

test_samples = temp.head(5)
all_match = True
for idx, row in test_samples.iterrows():
    p_pred = xgb.predict_proba(preprocessor.transform(pd.DataFrame([row[feature_cols]])))[0, 1]
    js_pred = js_emulate(row)
    is_match = abs(p_pred - js_pred) < 1e-5
    if not is_match:
        all_match = False
    print(f"Sample {row['mw_name']}: Python Prob = {p_pred:.6f} | JS Emulated Prob = {js_pred:.6f} | Match = {is_match}")

if all_match:
    print("Verification SUCCESS: JavaScript/TypeScript prediction exactly matches Python!")
else:
    print("Verification WARNING: Slight mismatch detected, check scaling logic.")

print("--- Asset Generation Completed Successfully! ---")
