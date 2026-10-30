# CFOP extension data

Rebuild with `bun scripts/import-cfop.ts`. Data is checked in; the app never
fetches algorithms at runtime.

Primary source: [Tao Yu's Alg Trainer](https://github.com/tao-yu/Alg-Trainer),
`js/alg_list.js`, pinned at `cb95945c3e4839ee1e4b058d4a79bc022615b220`.
The original bank credits AlgDB, Juliette Sébastien, Chad Batten, Tao Yu,
Jayden McNeill and the contributors listed in that file.

Summer variation's 27 right-insertion sequences follow
[SpeedCubeDB's SV numbering](https://www.speedcubedb.com/a/3x3/SV).
Their front-right reflections supply the other insertion direction.

| Set | Cases | Coverage |
| --- | ---: | --- |
| COLL | 40 | T, U, L, H, Pi, Sune, Antisune |
| WV | 54 | 27 per insertion direction, both normalized to the FR slot |
| SV | 54 | 27 per insertion direction, both in the FR slot |
| ZBLL | 493 | 472 non-PLL cases plus all 21 PLLs; solved case excluded |
| ZBLS | 302 | All source pair/edge-orientation cases |
| VHLS | 32 | Four pair positions, eight edge orientations each |
| VLS | 216 | Eight edge-orientation patterns, 27 corner patterns each |
| OLLCP | 331 | Symmetries merged; includes the corner-oriented cases (Aa/Ab share a case) |

Import restores the ending grip, conjugates last-slot cases onto FR, fits every
alternative to its reference image, merges equivalent cases, and rejects
malformed or incorrect alternatives. Reference algorithms are checked for the
required F2L preservation. No generated search sequences substitute for missing
source cases. The test suite checks step goals, alternatives, distinct recognition
states, coverage, setups and current SVGs.

## Upstream license

MIT License

Copyright (c) 2017-2021 Tao Yu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
