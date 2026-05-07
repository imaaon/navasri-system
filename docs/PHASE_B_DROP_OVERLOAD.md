# Phase B — Drop Legacy RPC Overloads

**Date:** 7 พ.ค. 2569 / May 7, 2026  
**Related Bugs:** Bug 1.2 + 1.3 (Phase 1 Final Inspection)

## What Was Dropped

| Function | Signature | Reason |
|---|---|---|
| `return_stock(bigint, numeric)` | tombstone (returned error message) | replaced by `return_stock(uuid, numeric, numeric, text, text)` |
| `get_next_doc_no(p_module text)` | 1-arg version | replaced by `get_next_doc_no(text, text, integer)` with DEFAULT NULL for new args |

## Why

Both overloads caused Postgres function resolution conflicts:
- `return_stock(bigint, numeric)` was tombstoned but JS still passed UUID → Postgres would attempt cast bigint, fail with "invalid input syntax for type bigint"
- `get_next_doc_no(text)` and `get_next_doc_no(text, text DEFAULT NULL, integer DEFAULT NULL)` created ambiguity for 1-arg calls → "could not choose the best candidate function"

## Verification

After drop:
- Only one signature exists per function name
- All JS callers (requisition.js:760, expenses.js:164, assets.js:107) use the new signatures
- No DB function bodies reference the dropped signatures
