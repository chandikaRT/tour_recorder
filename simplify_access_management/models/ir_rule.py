# -*- coding: utf-8 -*-

from odoo import api, fields, models, tools,_
from odoo.exceptions import Warning, ValidationError, UserError
from odoo.tools import config
from odoo.osv import expression
from odoo.tools.safe_eval import safe_eval

class ir_rule(models.Model):
    _inherit = 'ir.rule'


    @api.model
    @tools.conditional(
        'xml' not in config['dev_mode'],
        tools.ormcache('self.env.uid', 'self.env.su', 'model_name', 'mode',
                       'tuple(self._compute_domain_context_values())'),
    )
    def _compute_domain(self, model_name, mode="read"):
        res = super(ir_rule,self)._compute_domain(model_name, mode)

        value = True
        self._cr.execute("SELECT state FROM ir_module_module WHERE name='simplify_access_management'")
        data = self._cr.fetchone() or False
        if data and data[0] != 'installed':
            value = False
        model_list = ['mail.activity','res.users.log','res.users','mail.channel','mail.alias','bus.presence','res.lang']
        is_readonly = False
        if self.env.user.id and value:
            self._cr.execute("SELECT id FROM ir_model WHERE model='" + model_name +"'")
            model_id = self._cr.fetchone()[0]

            self._cr.execute("SELECT access_management_id FROM access_management_users_rel_ah WHERE user_id=" + str(self.env.user.id))
            access_list = []
            for data in self._cr.fetchall():
                access_list.append(data[0])
            if access_list:
                a = "SELECT id FROM remove_action WHERE access_management_id in " + str(tuple(access_list)) + " and model_id = " + str(model_id) + " and readonly = True"
                if len(access_list) == 1:
                    a = a.replace(',','')
                self._cr.execute(a)
                a = self._cr.fetchall()
                if a:
                    is_readonly = True
            if model_name not in model_list:
                a = "select access_management_id from access_management_users_rel_ah where user_id = " + str(self.env.user.id)
                self._cr.execute(a)
                a = self._cr.fetchall()
                if a:
                    a = "SELECT id FROM access_management WHERE id in " + str(tuple([i[0] for i in a]+[0])) + " and readonly = True"
                    self._cr.execute(a)
                    a = self._cr.fetchall()
                if bool(a) or is_readonly:
                    if mode != 'read' and model_name not in ['mail.channel.partner']:
                        raise UserError(_('%s is a read-only user. So you can not make any changes in the system!') % self.env.user.name)

        value = self._cr.execute("""SELECT value from ir_config_parameter where key='uninstall_simplify_access_management' """)
        value = self._cr.fetchone()
        if not value:
            if model_name:
                self._cr.execute("SELECT id FROM ir_model WHERE model='" + model_name +"'")
                model_numeric_id = self._cr.fetchone()[0]
                if model_numeric_id and isinstance(model_numeric_id,int) and self.env.user:
                    try:
                        self._cr.execute("""
                                        SELECT dm.id
                                        FROM access_domain_ah as dm
                                        WHERE dm.model_id=%s AND dm.apply_domain AND dm.access_management_id 
                                        IN (SELECT am.id 
                                            FROM access_management as am 
                                            WHERE am.id 
                                            IN (SELECT amusr.access_management_id
                                                FROM access_management_users_rel_ah as amusr
                                                WHERE amusr.user_id=%s))
                                        """,[model_numeric_id, self.env.user.id])
                    except:
                        pass                
                    access_domain_ah_ids = self.env['access.domain.ah'].browse(row[0] for row in self._cr.fetchall())
                    if access_domain_ah_ids:
                        domain_list = []
                        eval_context = self._eval_context()
                        # only domain records 
                        for access in access_domain_ah_ids.sudo():
                            dom = safe_eval(access.domain, eval_context) if access.domain else []
                            dom = expression.normalize_domain(dom)
                            domain_list.append(dom)
                        return expression.OR(domain_list)

        return res
