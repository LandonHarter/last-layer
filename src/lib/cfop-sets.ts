/** CFOP extensions have branching goals; their order is not a solve sequence. */
export const CFOP_SETS = {
  COLL: { label: "COLL", title: "Corners of the last layer", blurb: "With F2L done and the last-layer edges oriented, solve the corners. Only edge permutation remains.", goal: "corners" },
  WV: { label: "WV", title: "Winter variation", blurb: "With edges oriented and the last pair joined, insert it into the front-right slot and orient the last layer. Includes both insertion directions.", goal: "orientation" },
  SV: { label: "SV", title: "Summer variation", blurb: "With edges oriented and the last pair set for R U R' (or its front-right mirror), insert it and orient the last layer.", goal: "orientation" },
  ZBLL: { label: "ZBLL", title: "Zborowski–Bruchem last layer", blurb: "With F2L done and the last-layer edges oriented, solve the entire last layer in one look. Includes the 21 PLL cases.", goal: "solved" },
  ZBLS: { label: "ZBLS", title: "Zborowski–Bruchem last slot", blurb: "Solve the last pair into the front-right slot and orient all last-layer edges. Follow with ZBLL, or COLL and edge permutation.", goal: "edges" },
  VHLS: { label: "VHLS", title: "Vandenbergh–Harris last slot", blurb: "With the last pair ready for a three-move insertion, solve it into the front-right slot and orient the last-layer edges. A subset of ZBLS.", goal: "edges" },
  VLS: { label: "VLS", title: "Valk last slot", blurb: "With the last pair joined, insert it into the front-right slot and orient the entire last layer, whatever the edge orientation.", goal: "orientation" },
  OLLCP: { label: "OLLCP", title: "Last-layer orientation and corner permutation", blurb: "With F2L done, orient the last layer and solve its corners. Only edge permutation remains.", goal: "corners" },
} as const;

export type CfopSet = keyof typeof CFOP_SETS;

export const isCfopSet = (set: string): set is CfopSet => Object.hasOwn(CFOP_SETS, set);

export const isLastSlotSet = (set: string) => ["F2L", "WV", "SV", "ZBLS", "VHLS", "VLS"].includes(set);
