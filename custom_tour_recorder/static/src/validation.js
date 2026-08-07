/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";

/**
 * Shared validation definitions for tour steps. Kept in sync with the
 * `validation_type` Selection on the `tour.recorder.step` model.
 *
 * Labels and messages use `_t` so they follow the user's language via the
 * module's PO files.
 */

export const VALIDATION_TYPES = [
    ["none", _t("No validation")],
    ["required", _t("Required (not empty)")],
    ["integer", _t("Whole number")],
    ["float", _t("Number (decimal)")],
    ["email", _t("Email")],
    ["phone", _t("Phone")],
    ["url", _t("URL")],
    ["date", _t("Date")],
    ["alpha", _t("Letters only")],
    ["alphanumeric", _t("Letters & numbers")],
    ["regex", _t("Custom (regex)")],
];

const DEFAULT_MESSAGES = {
    required: _t("This field is required."),
    integer: _t("Please enter a whole number."),
    float: _t("Please enter a valid number."),
    email: _t("Please enter a valid email address."),
    phone: _t("Please enter a valid phone number."),
    url: _t("Please enter a valid URL."),
    date: _t("Please enter a valid date."),
    alpha: _t("Please use letters only."),
    alphanumeric: _t("Please use letters and numbers only."),
    regex: _t("The value does not match the required format."),
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-\s\d]{6,}$/;
const INT_RE = /^-?\d+$/;
const FLOAT_RE = /^-?\d+(?:[.,]\d+)?$/;
const ALPHA_RE = /^[\p{L}\s]+$/u;
const ALNUM_RE = /^[\p{L}\p{N}\s]+$/u;
const DATE_RE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;

/**
 * Returns true when `value` satisfies the given validation type.
 * Empty values are considered invalid (the tour must not advance), but callers
 * decide whether to show an error for an empty field.
 */
export function isValid(value, type, regex) {
    const v = (value ?? "").toString().trim();
    switch (type) {
        case "none":
            return true;
        case "required":
            return v.length > 0;
        case "integer":
            return INT_RE.test(v);
        case "float":
            return FLOAT_RE.test(v);
        case "email":
            return EMAIL_RE.test(v);
        case "phone":
            return PHONE_RE.test(v);
        case "url":
            try {
                // eslint-disable-next-line no-new
                new URL(v);
                return true;
            } catch {
                return false;
            }
        case "date":
            return DATE_RE.test(v) || !Number.isNaN(Date.parse(v));
        case "alpha":
            return ALPHA_RE.test(v);
        case "alphanumeric":
            return ALNUM_RE.test(v);
        case "regex":
            if (!regex) {
                return true;
            }
            try {
                return new RegExp(regex).test(v);
            } catch {
                return true; // a broken regex should not permanently block the user
            }
        default:
            return true;
    }
}

export function validationMessage(type, customMessage) {
    return customMessage || DEFAULT_MESSAGES[type] || _t("Invalid value.");
}
