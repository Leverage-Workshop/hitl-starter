# HITL-Starter Contract

A plug-in contract for human-in-the-loop workflow dashboards. Three objects —
**Workflow**, **Item**, **Action** — that let new workflows drop into the
dashboard without touching the shell.

## Files

| File | What it is |
|---|---|
| `SPEC.md` | The human-readable contract. Start here. |
| `contract.ts` | TypeScript + Zod schemas and types. Runtime-validated. |
| `contract.py` | Python + Pydantic v2 models. Runtime-validated. |
| `seed_rfp_intake.ts` | The rfp-intake workflow expressed in TS — a worked example. |
| `seed_rfp_intake.py` | The same workflow in Python. |

The two seed files are intentionally parallel: same workflow, same items, same
actions, same assertions. Use whichever matches your stack as the template for a
new workflow.

## The core idea

The dashboard knows only the contract, never a specific workflow. To add a
workflow you implement a `Workflow` (its stats, `itemSchema`, `availableActions`,
and the `items` it produces). You write zero dashboard code.

The lifecycle:

```
Workflow runs -> produces Items (above the confidence floor -> queue as `pending`)
   -> human opens Item in flyout, reviews sourceContent vs proposedOutput
   -> human fires an Action -> Action.resultingStatus updates the Item
   -> Item leaves the pending queue
```

Actions are the only thing that change an item's status. An action's `intent`
(primary / neutral / destructive) drives its button styling, and its `appliesTo`
(single / bulk / both) decides whether it shows in the flyout, the bulk-action
bar, or both — which is how "bulk actions only in table mode" is expressed at the
contract level.

## Validate

```bash
# Python
pip install pydantic
python seed_rfp_intake.py

# TypeScript
npm install zod tsx
npx tsx seed_rfp_intake.ts
```

Both print the same result and assert that the action-resolution helpers behave
correctly (bulk excludes single-only `edit`; the second item narrows its own
action set to approve + edit).
