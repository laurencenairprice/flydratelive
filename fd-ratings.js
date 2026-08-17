var flydrateFdFamilies = {
  b787: {
    rating: 1,
    cabin: "Higher-humidity modern cabin (~15% RH)",
    family: "787-8 / 787-9 / 787-10"
  },
  a350: {
    rating: 1,
    cabin: "Higher-humidity modern cabin (~15% RH)",
    family: "A350-900 / A350-1000"
  },
  a380: {
    rating: 2,
    cabin: "Potentially higher-humidity widebody",
    family: "A380-800"
  },
  a320: {
    rating: 3,
    cabin: "Typical modern narrowbody",
    family: "A320 family"
  },
  b737: {
    rating: 4,
    cabin: "Typical commercial cabin",
    family: "737 family / 737 MAX"
  },
  a330: {
    rating: 5,
    cabin: "Typical/dry widebody",
    family: "A330 / A330neo"
  },
  a340: {
    rating: 5,
    cabin: "Typical/dry widebody",
    family: "A340"
  },
  crj: {
    rating: 5,
    cabin: "Typical regional jet cabin",
    family: "CRJ family"
  },
  b767: {
    rating: 6,
    cabin: "Dry widebody",
    family: "767"
  },
  b757: {
    rating: 7,
    cabin: "Dry older-generation cabin",
    family: "757"
  },
  b777: {
    rating: 8,
    cabin: "Very dry in measured sample",
    family: "777 / 777-200 / 777-300ER"
  },
  a300: {
    rating: 8,
    cabin: "Older-generation widebody / dry",
    family: "A300 / A310"
  },
  b747: {
    rating: 9,
    cabin: "Very dry in measured sample",
    family: "747 / 747-400 / 747-8"
  },
  md11: {
    rating: 9,
    cabin: "Older widebody / dry environment",
    family: "MD-11"
  },
  md80: {
    rating: 10,
    cabin: "Older-generation / potentially very dry",
    family: "MD-80 / MD-90"
  },
  ejet: {
    rating: 4,
    cabin: "Typical regional jet cabin",
    family: "E170 / E175 / E190 / E195"
  },
  e2: {
    rating: 4,
    cabin: "Typical modern regional jet cabin",
    family: "E190-E2 / E195-E2"
  }
};

function fdForAircraft(name) {
  const n = String(name || "").toLowerCase();
  const rules = [
    [/787|dreamliner|b78[89x]/, "b787"],
    [/a350|a359|a35k|350-9|350-10/, "a350"],
    [/a380|a388|380-8/, "a380"],
    [/a321|a320|a319|a318|a20n|a21n/, "a320"],
    [/737|b73/, "b737"],
    [/a330|a332|a333|a339/, "a330"],
    [/a340|a342|a343|a345|a346/, "a340"],
    [/767|b76/, "b767"],
    [/757|b75/, "b757"],
    [/777|b77/, "b777"],
    [/747|b74/, "b747"],
    [/md-?11/, "md11"],
    [/md-?8|md-?9/, "md80"],
    [/a300|a310/, "a300"],
    [/e190-?e2|e195-?e2|embraer e2/, "e2"],
    [/e170|e175|e190|e195/, "ejet"],
    [/crj/, "crj"]
  ];
  for (const [pattern, key] of rules) {
    if (pattern.test(n)) return flydrateFdFamilies[key];
  }
  return null;
}
