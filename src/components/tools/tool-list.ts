import { CalculatorIcon, EyeOffIcon, FootprintsIcon, ListOrderedIcon, SparklesIcon, WandIcon, type LucideIcon } from "lucide-react";

export type Tool = { href: string; name: string; description: string; Icon: LucideIcon };

export const TOOLS: Tool[] = [
  {
    href: "/drill/f2l",
    name: "F2L solution lab",
    description: "Find efficient solutions in every slot, check your moves and compare verified alternatives. Weak spots return sooner.",
    Icon: FootprintsIcon,
  },
  {
    href: "/tools/blind",
    name: "Blindfolded memo",
    description: "Turn a scramble into edge and corner letters with your own scheme, buffers and orientation. Quiz yourself on it.",
    Icon: EyeOffIcon,
  },
  {
    href: "/tools/fmc",
    name: "Fewest moves",
    description: "A random-state scramble and an hour on the clock. Type your solution and it's checked and counted.",
    Icon: FootprintsIcon,
  },
  {
    href: "/tools/solver",
    name: "Solver",
    description: "Type any 3x3 scramble and get a solution of 22 moves or fewer.",
    Icon: WandIcon,
  },
  {
    href: "/tools/scrambles",
    name: "Scramble sheet",
    description: "A numbered batch of scrambles for any puzzle, ready to copy for a meetup or a race.",
    Icon: ListOrderedIcon,
  },
  {
    href: "/tools/alg",
    name: "Algorithm toolkit",
    description: "Invert, mirror, clean up and count an algorithm, and see what it does to a solved cube.",
    Icon: SparklesIcon,
  },
  {
    href: "/tools/average",
    name: "Average calculator",
    description: "Work out a WCA average, and what you need on your last solve to hit a target.",
    Icon: CalculatorIcon,
  },
];
