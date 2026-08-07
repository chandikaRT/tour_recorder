# -*- coding: utf-8 -*-
"""
pre_migrate: convert translatable Char/Text columns from varchar/text to jsonb.

The multi-language commit added translate=True to several fields. In Odoo 17,
translatable fields are stored as jsonb ({"en_US": "value", "si_LK": "..."}).
Existing columns are still varchar/text, so Odoo's ->> operator fails at runtime
with:  operator does not exist: character varying ->> unknown

This pre-migration runs BEFORE the ORM inspects the schema, so by the time
_auto_init runs the columns are already jsonb and everything is consistent.
"""
import logging

_logger = logging.getLogger(__name__)

_COLUMNS = [
    ("tour_recorder", "name"),
    ("tour_recorder", "description"),
    ("tour_recorder_step", "name"),
    ("tour_recorder_step", "content"),
    ("tour_recorder_step", "validation_message"),
]


def _convert_column(cr, table, column):
    """Wrap existing varchar/text values as {"en_US": value} and retype to jsonb."""
    cr.execute(
        """
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    row = cr.fetchone()
    if not row:
        _logger.info(
            "custom_tour_recorder migrate: %s.%s not found — skipping.", table, column
        )
        return
    if row[0] == "jsonb":
        _logger.info(
            "custom_tour_recorder migrate: %s.%s already jsonb — skipping.", table, column
        )
        return

    _logger.info(
        "custom_tour_recorder migrate: converting %s.%s (%s → jsonb) …",
        table,
        column,
        row[0],
    )
    cr.execute(
        f"""
        ALTER TABLE {table}
            ALTER COLUMN {column} TYPE jsonb
            USING CASE
                WHEN {column} IS NULL OR {column}::text = ''
                    THEN NULL
                ELSE jsonb_build_object('en_US', {column}::text)
            END
        """  # noqa: S608 — table/column are hard-coded constants, not user input
    )
    _logger.info("custom_tour_recorder migrate: %s.%s converted.", table, column)


def migrate(cr, version):
    for table, column in _COLUMNS:
        _convert_column(cr, table, column)
