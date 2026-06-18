# Contradictions

| ID | Evidence A | Evidence B | Status |
|---|---|---|---|
| C-001 | `README.md` documents a small content detector, background submitter, and simple popup. | Current source also contains SPA navigation, DOM observation, GraphQL scraping, authentication, OAuth, analytics, recommendations, snapshots, and a database-backed API. | Open; quantify during Phases 1-3. |
| C-002 | Root `package.json` version is `1.0.0`. | `manifest.json` version is `1.0.1`. | Open. |
| C-003 | A `.git` directory exists. | It is empty and `git status` reports that the workspace is not a Git repository. | Confirmed environmental contradiction. |

