# Methodology

## Evidence Levels

- **Observed**: directly read from repository content or command output.
- **Derived**: mechanically computed from observed repository content.
- **Inferred**: reasoned conclusion with cited supporting and contradictory evidence.
- **Unverified**: plausible claim lacking enough evidence.

## File Examination

Every non-`.git` file is recorded by path, type, size, hash, and provenance class. Authored text is reviewed at content level. Generated dependencies, build products, archives, binary assets, and runtime-profile data are examined through metadata, manifests, representative structure, hashes, and targeted content inspection where relevant.

## Conclusion Gate

No item is a final conclusion until it survives primary review, attempted disproof, independent review, adversarial review, and knowledge-gap analysis.

