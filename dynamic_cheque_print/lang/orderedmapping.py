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

class OrderedMapping(dict):
    def __init__(self, *pairs):
        self.order = []
        for key, val in pairs:
            self[key] = val
            
    def __setitem__(self, key, val):
        if key not in self:
            self.order.append(key)
        super(OrderedMapping, self).__setitem__(key, val)

    def __iter__(self):
        for item in self.order:
            yield item

    def __repr__(self):
        out = ["%s: %s"%(repr(item), repr(self[item])) for item in self]
        out = ", ".join(out)
        return "{%s}"%out

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: