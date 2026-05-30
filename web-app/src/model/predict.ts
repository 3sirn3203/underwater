// Auto-generated XGBoost Inference Engine
import modelConfig from './model_config.json';

interface PredictInput {
  hydrogeology: string;
  aquifer: string;
  water_quality_type: string;
  mean_well_depth: number;
  drought_vulnerability: number;
  mean_pumped_volume_per_day: number;
  mean_natural_water_level: number;
  mean_stable_water_level: number;
  mean_storage_coef: number;
}

export function predictSuitability(input: PredictInput): { probability: number; label: number } {
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
  
  // Tree 0
  const evaluateTree0 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[16] < 1.0) {
      if (f[35] < 1.54537201) {
      return 0.0754941106;
    } else {
      return 0.544216931;
    }
    } else {
      return -0.297265708;
    }
    } else {
      return -0.329163998;
    }
    } else {
      if (f[33] < -0.0490875579) {
      if (f[30] < 1.06427467) {
      if (f[31] < 2.72149587) {
      return 0.0647795647;
    } else {
      return -0.269174308;
    }
    } else {
      return 1.58010089;
    }
    } else {
      return 2.16486144;
    }
    }
  };
  sum += evaluateTree0(f);

  // Tree 1
  const evaluateTree1 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[16] < 1.0) {
      if (f[9] < 1.0) {
      return 0.165827796;
    } else {
      return -0.0866964608;
    }
    } else {
      return -0.281051278;
    }
    } else {
      return -0.318504423;
    }
    } else {
      if (f[16] < 1.0) {
      if (f[0] < 1.0) {
      if (f[32] < -0.484823197) {
      return 0.59016341;
    } else {
      return 0.318769991;
    }
    } else {
      return -0.248370335;
    }
    } else {
      return -0.312686175;
    }
    }
  };
  sum += evaluateTree1(f);

  // Tree 2
  const evaluateTree2 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[33] < -0.824048221) {
      if (f[21] < 1.0) {
      return -0.130051762;
    } else {
      return 0.121116318;
    }
    } else {
      return 0.559134126;
    }
    } else {
      return -0.31026268;
    }
    } else {
      if (f[16] < 1.0) {
      if (f[33] < 0.0548705794) {
      if (f[31] < 2.72149587) {
      return 0.242431343;
    } else {
      return -0.290622264;
    }
    } else {
      if (f[34] < 1.74817133) {
      return 0.424157679;
    } else {
      return 0.041736681;
    }
    }
    } else {
      return -0.279438883;
    }
    }
  };
  sum += evaluateTree2(f);

  // Tree 3
  const evaluateTree3 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[16] < 1.0) {
      if (f[33] < -0.824048221) {
      return 0.0174788665;
    } else {
      return 0.388639838;
    }
    } else {
      return -0.258672565;
    }
    } else {
      return -0.303397059;
    }
    } else {
      if (f[16] < 1.0) {
      if (f[33] < 0.0548705794) {
      if (f[33] < -0.838224292) {
      return 0.489374191;
    } else {
      return -0.0352535546;
    }
    } else {
      if (f[32] < 0.411966383) {
      return 0.172641844;
    } else {
      return 0.407605559;
    }
    }
    } else {
      return -0.25116238;
    }
    }
  };
  sum += evaluateTree3(f);

  // Tree 4
  const evaluateTree4 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[16] < 1.0) {
      if (f[0] < 1.0) {
      return 0.0118357399;
    } else {
      return 0.329053998;
    }
    } else {
      return -0.243790835;
    }
    } else {
      return -0.297177017;
    }
    } else {
      if (f[32] < -0.484823197) {
      if (f[31] < 2.72149587) {
      return 0.430930942;
    } else {
      return -0.201882645;
    }
    } else {
      if (f[34] < 1.02983534) {
      if (f[32] < 0.65003103) {
      return -0.259032518;
    } else {
      return 0.165556788;
    }
    } else {
      if (f[34] < 2.18170023) {
      return 0.265578389;
    } else {
      return -0.127684742;
    }
    }
    }
    }
  };
  sum += evaluateTree4(f);

  // Tree 5
  const evaluateTree5 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[33] < -0.824048221) {
      if (f[0] < 1.0) {
      return -0.059689194;
    } else {
      return 0.223634109;
    }
    } else {
      return 0.286850095;
    }
    } else {
      return -0.291047573;
    }
    } else {
      if (f[34] < 0.0471051149) {
      if (f[31] < 2.72149587) {
      if (f[9] < 1.0) {
      return -0.179605395;
    } else {
      return 0.452256799;
    }
    } else {
      return -0.266463965;
    }
    } else {
      if (f[34] < 1.02983534) {
      if (f[32] < 0.65003103) {
      return -0.384687454;
    } else {
      return 0.16717422;
    }
    } else {
      if (f[33] < 0.236797318) {
      return 0.0103132213;
    } else {
      return 0.32493192;
    }
    }
    }
    }
  };
  sum += evaluateTree5(f);

  // Tree 6
  const evaluateTree6 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[31] < 1.34137595) {
      if (f[32] < -0.980711877) {
      if (f[34] < -0.412668765) {
      return 0.00292500691;
    } else {
      return 0.369197756;
    }
    } else {
      return -0.285321206;
    }
    } else {
      if (f[32] < 0.124939755) {
      if (f[31] < 2.72149587) {
      return 0.363874286;
    } else {
      return -0.0504499935;
    }
    } else {
      if (f[32] < 0.44370833) {
      return -0.229859933;
    } else {
      return 0.108404852;
    }
    }
    }
    } else {
      return -0.276570231;
    }
  };
  sum += evaluateTree6(f);

  // Tree 7
  const evaluateTree7 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[31] < 1.34137595) {
      if (f[32] < -0.980711877) {
      if (f[34] < -0.412668765) {
      return 0.00208067289;
    } else {
      return 0.304480523;
    }
    } else {
      return -0.275613427;
    }
    } else {
      if (f[33] < 0.236797318) {
      if (f[34] < 0.0471051149) {
      return 0.224309802;
    } else {
      return -0.0931834877;
    }
    } else {
      return 0.257643372;
    }
    }
    } else {
      return -0.265103042;
    }
  };
  sum += evaluateTree7(f);

  // Tree 8
  const evaluateTree8 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[5] < 1.0) {
      if (f[30] < 1.21435761) {
      if (f[30] < 1.06716084) {
      return -0.0244065877;
    } else {
      return -0.372558922;
    }
    } else {
      return 0.180514947;
    }
    } else {
      if (f[31] < 1.34137595) {
      if (f[33] < -0.866576552) {
      return 0.0867382735;
    } else {
      return -0.219352648;
    }
    } else {
      return 0.277494073;
    }
    }
    } else {
      return -0.252868116;
    }
  };
  sum += evaluateTree8(f);

  // Tree 9
  const evaluateTree9 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[0] < 1.0) {
      return 0.000341599633;
    } else {
      return 0.17297931;
    }
    } else {
      return -0.258826584;
    }
    } else {
      if (f[33] < -0.838224292) {
      return 0.338566601;
    } else {
      if (f[33] < -0.216838181) {
      return -0.233118817;
    } else {
      return 0.112657413;
    }
    }
    }
    } else {
      return -0.239828542;
    }
  };
  sum += evaluateTree9(f);

  // Tree 10
  const evaluateTree10 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[5] < 1.0) {
      if (f[31] < 2.72149587) {
      if (f[32] < 0.356417954) {
      return 0.0552459583;
    } else {
      return -0.101704866;
    }
    } else {
      return -0.245577529;
    }
    } else {
      if (f[31] < 1.34137595) {
      if (f[33] < -0.866576552) {
      return 0.0586454533;
    } else {
      return -0.19246681;
    }
    } else {
      return 0.244733706;
    }
    }
    } else {
      return -0.22610487;
    }
  };
  sum += evaluateTree10(f);

  // Tree 11
  const evaluateTree11 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[30] < -1.0266993) {
      if (f[33] < -0.824048221) {
      if (f[6] < 1.0) {
      return -0.00384555897;
    } else {
      return -0.213781551;
    }
    } else {
      return 0.183989167;
    }
    } else {
      return -0.25546819;
    }
    } else {
      if (f[33] < -0.838224292) {
      return 0.300481051;
    } else {
      if (f[33] < -0.216838181) {
      if (f[32] < -0.404198647) {
      return 0.0429660603;
    } else {
      return -0.274649024;
    }
    } else {
      if (f[34] < 0.169581875) {
      return 0.237429544;
    } else {
      return -0.0257392954;
    }
    }
    }
    }
  };
  sum += evaluateTree11(f);

  // Tree 12
  const evaluateTree12 = (f: number[]): number => {
    if (f[34] < 1.23979557) {
      if (f[34] < 0.169581875) {
      if (f[34] < -0.197362393) {
      if (f[6] < 1.0) {
      return -0.0148939304;
    } else {
      return -0.215476006;
    }
    } else {
      if (f[31] < 2.72149587) {
      return 0.28911832;
    } else {
      return -0.057572104;
    }
    }
    } else {
      if (f[32] < 0.717562079) {
      if (f[33] < 0.818017781) {
      return -0.338443071;
    } else {
      return 0.00404679403;
    }
    } else {
      return 0.0337564349;
    }
    }
    } else {
      if (f[34] < 2.18170023) {
      if (f[33] < 0.137564555) {
      if (f[33] < -0.838224292) {
      return 0.231307566;
    } else {
      return -0.201311782;
    }
    } else {
      return 0.255196989;
    }
    } else {
      return -0.1211017;
    }
    }
  };
  sum += evaluateTree12(f);

  // Tree 13
  const evaluateTree13 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[30] < 0.518271744) {
      if (f[30] < -1.0266993) {
      if (f[33] < -0.824048221) {
      return -0.00517230481;
    } else {
      return 0.219315752;
    }
    } else {
      if (f[32] < 1.36422503) {
      return -0.238862664;
    } else {
      return 0.0941683054;
    }
    }
    } else {
      if (f[30] < 0.577693701) {
      return 0.342355371;
    } else {
      if (f[33] < -0.838224292) {
      return 0.217539638;
    } else {
      return -0.0284164138;
    }
    }
    }
    } else {
      return -0.203504726;
    }
  };
  sum += evaluateTree13(f);

  // Tree 14
  const evaluateTree14 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[32] < -0.980711877) {
      if (f[21] < 1.0) {
      if (f[0] < 1.0) {
      return -0.0733567551;
    } else {
      return 0.116899855;
    }
    } else {
      return 0.0523964129;
    }
    } else {
      return -0.246746629;
    }
    } else {
      if (f[33] < -0.531075299) {
      return 0.211759567;
    } else {
      if (f[33] < -0.216838181) {
      return -0.232667252;
    } else {
      if (f[34] < 1.8900888) {
      return 0.117053986;
    } else {
      return -0.226609364;
    }
    }
    }
    }
  };
  sum += evaluateTree14(f);

  // Tree 15
  const evaluateTree15 = (f: number[]): number => {
    if (f[34] < 1.23979557) {
      if (f[34] < 0.169581875) {
      if (f[31] < 2.72149587) {
      if (f[31] < 1.34137595) {
      return -0.0215317607;
    } else {
      return 0.25332576;
    }
    } else {
      if (f[9] < 1.0) {
      return -0.0561666489;
    } else {
      return -0.226567686;
    }
    }
    } else {
      if (f[33] < 0.515594125) {
      return -0.251875103;
    } else {
      return 0.0162056163;
    }
    }
    } else {
      if (f[32] < 0.429424465) {
      if (f[32] < 0.124939755) {
      return 0.131869465;
    } else {
      return -0.204292044;
    }
    } else {
      if (f[32] < 0.655189097) {
      return 0.23251985;
    } else {
      return 0.0271033924;
    }
    }
    }
  };
  sum += evaluateTree15(f);

  // Tree 16
  const evaluateTree16 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[5] < 1.0) {
      if (f[31] < 2.72149587) {
      if (f[31] < 1.34137595) {
      return -0.0526211485;
    } else {
      return 0.0593141317;
    }
    } else {
      return -0.226249278;
    }
    } else {
      if (f[31] < 1.34137595) {
      if (f[12] < 1.0) {
      return 0.0105405888;
    } else {
      return 0.0245790891;
    }
    } else {
      return 0.200998649;
    }
    }
    } else {
      return -0.181344151;
    }
  };
  sum += evaluateTree16(f);

  // Tree 17
  const evaluateTree17 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[32] < 0.124939755) {
      if (f[30] < 0.890592754) {
      if (f[30] < -1.0266993) {
      return 0.0323532894;
    } else {
      return -0.140371412;
    }
    } else {
      return 0.181396902;
    }
    } else {
      if (f[32] < 0.34848249) {
      return -0.25702247;
    } else {
      if (f[33] < -0.0845278278) {
      return -0.143304035;
    } else {
      return 0.074812673;
    }
    }
    }
    } else {
      return -0.167863593;
    }
  };
  sum += evaluateTree17(f);

  // Tree 18
  const evaluateTree18 = (f: number[]): number => {
    if (f[16] < 1.0) {
      if (f[34] < 2.18170023) {
      if (f[34] < 1.23979557) {
      if (f[34] < 0.0471051149) {
      return 0.0160247963;
    } else {
      return -0.158159792;
    }
    } else {
      if (f[33] < 0.137564555) {
      return 0.00845036376;
    } else {
      return 0.206968978;
    }
    }
    } else {
      return -0.109617226;
    }
    } else {
      return -0.155202478;
    }
  };
  sum += evaluateTree18(f);

  // Tree 19
  const evaluateTree19 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[33] < -0.453106672) {
      if (f[33] < -0.486184269) {
      if (f[6] < 1.0) {
      return -0.000881643675;
    } else {
      return -0.17106387;
    }
    } else {
      return 0.182058543;
    }
    } else {
      return -0.215607271;
    }
    } else {
      if (f[33] < -0.838224292) {
      return 0.207464591;
    } else {
      if (f[34] < 0.169581875) {
      if (f[31] < 2.72149587) {
      return 0.203622684;
    } else {
      return -0.132377103;
    }
    } else {
      if (f[33] < 0.236797318) {
      return -0.177073225;
    } else {
      return 0.172696516;
    }
    }
    }
    }
  };
  sum += evaluateTree19(f);

  // Tree 20
  const evaluateTree20 = (f: number[]): number => {
    if (f[34] < -0.197362393) {
      if (f[30] < -1.0266993) {
      if (f[0] < 1.0) {
      if (f[5] < 1.0) {
      return -0.0681049675;
    } else {
      return 0.0162210111;
    }
    } else {
      return 0.0964368507;
    }
    } else {
      if (f[30] < 0.543738246) {
      return -0.200288728;
    } else {
      return -6.80747253e-05;
    }
    }
    } else {
      if (f[34] < 0.0471051149) {
      return 0.204549164;
    } else {
      if (f[33] < -0.838224292) {
      return 0.187542722;
    } else {
      if (f[31] < 2.72149587) {
      return -0.134881034;
    } else {
      return 0.148638263;
    }
    }
    }
    }
  };
  sum += evaluateTree20(f);

  // Tree 21
  const evaluateTree21 = (f: number[]): number => {
    if (f[34] < 1.23979557) {
      if (f[32] < -0.101459742) {
      if (f[33] < -0.538163304) {
      if (f[0] < 1.0) {
      return -0.0263630804;
    } else {
      return 0.0701873079;
    }
    } else {
      if (f[30] < -1.0266993) {
      return 0.217555091;
    } else {
      return 0.00746137323;
    }
    }
    } else {
      if (f[32] < 0.737321436) {
      if (f[33] < -0.0821651444) {
      return -0.0178894624;
    } else {
      return -0.258742481;
    }
    } else {
      if (f[34] < 0.1287563) {
      return -0.0649280474;
    } else {
      return 0.140923038;
    }
    }
    }
    } else {
      if (f[32] < 0.429424465) {
      return -0.0801272169;
    } else {
      if (f[33] < 0.137564555) {
      return 0.0441227332;
    } else {
      return 0.189085737;
    }
    }
    }
  };
  sum += evaluateTree21(f);

  // Tree 22
  const evaluateTree22 = (f: number[]): number => {
    if (f[31] < 1.34137595) {
      if (f[32] < -0.980711877) {
      if (f[23] < 1.0) {
      if (f[5] < 1.0) {
      return -0.0535452887;
    } else {
      return 0.0189365186;
    }
    } else {
      return 0.0781041831;
    }
    } else {
      return -0.192856178;
    }
    } else {
      if (f[30] < 0.492805153) {
      if (f[32] < -0.101459742) {
      return 0.0498958118;
    } else {
      if (f[32] < 1.11822486) {
      return -0.158099219;
    } else {
      return 0.0566874444;
    }
    }
    } else {
      if (f[30] < 0.577693701) {
      return 0.243003502;
    } else {
      if (f[32] < 0.429424465) {
      return -0.062706016;
    } else {
      return 0.10795068;
    }
    }
    }
    }
  };
  sum += evaluateTree22(f);

  // Tree 23
  const evaluateTree23 = (f: number[]): number => {
    if (f[34] < -0.197362393) {
      if (f[6] < 1.0) {
      if (f[30] < -1.0266993) {
      if (f[24] < 1.0) {
      return 0.0223288853;
    } else {
      return -0.0583074875;
    }
    } else {
      if (f[34] < -0.450578243) {
      return -0.175993904;
    } else {
      return 0.02159236;
    }
    }
    } else {
      return -0.166168913;
    }
    } else {
      if (f[34] < 0.0471051149) {
      return 0.158560961;
    } else {
      if (f[34] < 1.03177941) {
      if (f[32] < 0.559725165) {
      return -0.180402786;
    } else {
      return 0.00612141611;
    }
    } else {
      if (f[34] < 2.18170023) {
      return 0.116748899;
    } else {
      return -0.0887050107;
    }
    }
    }
    }
  };
  sum += evaluateTree23(f);

  // Tree 24
  const evaluateTree24 = (f: number[]): number => {
    if (f[25] < 1.0) {
      if (f[31] < 1.34137595) {
      if (f[32] < -0.980711877) {
      if (f[5] < 1.0) {
      return -0.0526269712;
    } else {
      return 0.00730195967;
    }
    } else {
      return -0.167992994;
    }
    } else {
      if (f[32] < -0.101459742) {
      return 0.1653575;
    } else {
      if (f[34] < -0.175977573) {
      return -0.117495455;
    } else {
      return 0.0433924794;
    }
    }
    }
    } else {
      return 0.11105442;
    }
  };
  sum += evaluateTree24(f);

  // Tree 25
  const evaluateTree25 = (f: number[]): number => {
    if (f[33] < -0.838224292) {
      if (f[0] < 1.0) {
      if (f[23] < 1.0) {
      if (f[5] < 1.0) {
      return -0.0528957248;
    } else {
      return 0.0110607482;
    }
    } else {
      return 0.0683591515;
    }
    } else {
      return 0.0810671747;
    }
    } else {
      if (f[33] < -0.0845278278) {
      if (f[32] < -0.540292263) {
      if (f[33] < -0.464920104) {
      return -0.0608406663;
    } else {
      return 0.14158988;
    }
    } else {
      return -0.223746687;
    }
    } else {
      if (f[15] < 1.0) {
      if (f[33] < -0.00419654418) {
      return 0.0561021082;
    } else {
      return -0.0786369443;
    }
    } else {
      return 0.125796467;
    }
    }
    }
  };
  sum += evaluateTree25(f);

  // Tree 26
  const evaluateTree26 = (f: number[]): number => {
    if (f[35] < 1.54537201) {
      if (f[34] < 1.23493528) {
      if (f[33] < 0.0312437285) {
      if (f[33] < -0.0845278278) {
      return -0.0115244314;
    } else {
      return 0.162595928;
    }
    } else {
      return -0.120372161;
    }
    } else {
      if (f[33] < 0.118663073) {
      return 0.0226146169;
    } else {
      return 0.149759203;
    }
    }
    } else {
      if (f[32] < 0.124939755) {
      return 0.0333174169;
    } else {
      return -0.154080838;
    }
    }
  };
  sum += evaluateTree26(f);

  // Tree 27
  const evaluateTree27 = (f: number[]): number => {
    if (f[3] < 1.0) {
      if (f[35] < 1.54537201) {
      if (f[34] < 1.73067462) {
      if (f[32] < 0.65003103) {
      return -0.00518722553;
    } else {
      return 0.0928071737;
    }
    } else {
      return 0.113417841;
    }
    } else {
      if (f[32] < 0.124939755) {
      return 0.0313939899;
    } else {
      return -0.132266983;
    }
    }
    } else {
      return -0.0895697996;
    }
  };
  sum += evaluateTree27(f);

  // Tree 28
  const evaluateTree28 = (f: number[]): number => {
    if (f[25] < 1.0) {
      if (f[31] < 1.34137595) {
      if (f[5] < 1.0) {
      if (f[23] < 1.0) {
      return -0.0951514468;
    } else {
      return 0.0498421639;
    }
    } else {
      if (f[21] < 1.0) {
      return -0.0172346793;
    } else {
      return 0.00801604334;
    }
    }
    } else {
      if (f[32] < -0.101459742) {
      return 0.145320058;
    } else {
      if (f[32] < 0.337690204) {
      return -0.0969031453;
    } else {
      return 0.035689503;
    }
    }
    }
    } else {
      return 0.0889984667;
    }
  };
  sum += evaluateTree28(f);

  // Tree 29
  const evaluateTree29 = (f: number[]): number => {
    if (f[33] < -0.838224292) {
      if (f[0] < 1.0) {
      if (f[9] < 1.0) {
      if (f[5] < 1.0) {
      return -0.0876874775;
    } else {
      return 0.0118858814;
    }
    } else {
      return 0.0437433384;
    }
    } else {
      return 0.0771972984;
    }
    } else {
      if (f[33] < -0.464920104) {
      return -0.133350849;
    } else {
      if (f[12] < 1.0) {
      if (f[34] < 0.748916447) {
      return 0.116726108;
    } else {
      return 0.00598078035;
    }
    } else {
      if (f[34] < 0.0471051149) {
      return 0.00954468828;
    } else {
      return -0.0872037262;
    }
    }
    }
    }
  };
  sum += evaluateTree29(f);

  // 4. Sigmoid activation
  const probability = 1.0 / (1.0 + Math.exp(-sum));
  const label = probability >= 0.5 ? 1 : 0;
  
  return { probability, label };
}
