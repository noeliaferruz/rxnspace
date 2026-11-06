# rxnspace: data downloads

Bulk tables behind the transformation atlas at https://noeliaferruz.github.io/rxnspace/ (pipeline commit `83d8cab`).
A transformation is the reaction centre of a reaction, described independently of the rest of the
molecule; lab chemistry comes from US patents (1976-2016), enzyme chemistry from Rhea, BRENDA (via
EnzymeMap) and RetroBioCat.

| file | size | content |
|---|---|---|
| `enzyme_reactions.parquet` | 3.7 MB | every mapped Rhea reaction with its signature at each level |
| `enzymemap_vs_literature.csv` | 346 kB | the literature-checked transformations against BRENDA (EnzymeMap) |
| `lab_only_precedent.csv` | 320 kB | literature verdict for each of the 500 most used lab-only transformations |
| `lab_only_precedent_families.csv` | 143 kB | the same per chemistry family |
| `lab_reactions.parquet` | 98.7 MB | every mapped patent reaction with its signature at each level |
| `near_miss_L1x.csv` | 653 kB | near-miss result for the 5,000 most used lab-only transformations |
| `retrobiocat_transformations.csv` | 20 kB | every RetroBioCat transformation with its Rhea, EnzymeMap and patent status |
| `transformations_L0.csv.gz` | 7.6 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |
| `transformations_L1.csv.gz` | 10.9 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |
| `transformations_L1_undirected.csv.gz` | 4.7 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |
| `transformations_L1x.csv.gz` | 11.7 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |
| `transformations_L1x_stereo.csv.gz` | 12.0 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |
| `transformations_L1x_undirected.csv.gz` | 6.0 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |
| `transformations_L2.csv.gz` | 20.4 MB | every transformation at one level, listed on the site or not: counts, flags, summary, SMARTS pattern, canonical signature, BRENDA and RetroBioCat counts |

Derived data follow the licences of their sources: USPTO reactions extracted by D. M. Lowe (CC0);
Rhea, UniProtKB, M-CSA and EnzymeMap (CC BY 4.0); the public sample of the RetroBioCat database
(CC BY-NC 4.0), which `retrobiocat_transformations.csv` and the RetroBioCat counts derive from.
