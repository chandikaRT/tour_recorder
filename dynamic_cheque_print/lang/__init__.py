# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#################################################################################

from __future__ import unicode_literals
from . import lang_EN_IN
from . import lang_EN


CONVERTER_CLASSES = {
    'en': lang_EN.Num2Word_EN(),
    'en_IN': lang_EN_IN.Num2Word_EN_IN(),
}

def num2words(number, ordinal=False, lang='en'):
    # We try the full language first
    if lang not in CONVERTER_CLASSES:
        # ... and then try only the first 2 letters
        lang = lang[:2]
    if lang not in CONVERTER_CLASSES:
        raise NotImplementedError()
    converter = CONVERTER_CLASSES[lang]
    if ordinal:
        return converter.to_ordinal(number)
    else:
        return converter.to_cardinal(number)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: