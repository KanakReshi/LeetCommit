# Assumptions

| ID | Assumption | Basis | Status | Consequence if false |
|---|---|---|---|---|
| A-001 | `.git` is unavailable as historical evidence because the visible directory is empty and Git reports no repository. | Direct filesystem and Git inspection. | Active | Commit history, tracked-file status, and provenance cannot be verified locally. |
| A-002 | Dependency trees and runtime-profile files can be content-classified mechanically, with targeted inspection, rather than manually interpreting every vendored line. | Scale: more than 31,000 files; most are third-party/generated/runtime artifacts. | Active | A relevant modification hidden in a generated tree could be missed. |
| A-003 | Files under `investigation/` are investigation outputs and are excluded from the baseline repository-under-review census after their creation. | Prevents self-referential inventory growth. | Active | The final inventory must state both baseline and generated evidence counts. |

