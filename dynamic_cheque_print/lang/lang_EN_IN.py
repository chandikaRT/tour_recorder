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
from .lang_EN import Num2Word_EN

class Num2Word_EN_IN(Num2Word_EN):
    def set_high_numwords(self, high):
        self.cards[10**7] = "crore"
        self.cards[10**5] = "lakh"
        

n2w = Num2Word_EN_IN()
to_card = n2w.to_cardinal
to_ord = n2w.to_ordinal
to_ordnum = n2w.to_ordinal_num

def main():
    for val in (15000,
            15*10**5,
            15*10**6,
            15*10**7,
            15*10**8,
            15*10**9,
            15*10**10):
        n2w.test(val)

if __name__ == "__main__":
    main()

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: