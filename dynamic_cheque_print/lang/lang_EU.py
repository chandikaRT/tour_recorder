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
from .base import Num2Word_Base

class Num2Word_EU(Num2Word_Base):
    def set_high_numwords(self, high):
        max = 3 + 6*len(high)

        for word, n in zip(high, range(max, 3, -6)):
            self.cards[10**n] = word + "illiard"
            self.cards[10**(n-3)] = word + "illion"


    def base_setup(self):
        lows = ["non","oct","sept","sext","quint","quadr","tr","b","m"]
        units = ["", "un", "duo", "tre", "quattuor", "quin", "sex", "sept",
                 "octo", "novem"]
        tens = ["dec", "vigint", "trigint", "quadragint", "quinquagint",
                "sexagint", "septuagint", "octogint", "nonagint"]
        self.high_numwords = ["cent"]+self.gen_high_numwords(units, tens, lows)

    def to_currency(self, val, longval=True, jointxt=""):
        return self.to_splitnum(val, hightxt="Euro/s", lowtxt="Euro cent/s",
                                jointxt=jointxt, longval=longval)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: