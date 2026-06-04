"""Quote Desk LangGraph workflow.

Reads lane rate history + shipper context for a pending RFQ, drafts a quote,
and hands it to HITL review via a workflow_items row. Triggered by api.routers.quote_desk.
"""
