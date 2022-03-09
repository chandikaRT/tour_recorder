from odoo import models, SUPERUSER_ID


class ir_ui_view(models.Model):
    _inherit = 'ir.ui.view'

    def _apply_groups(self, node, name_manager, node_info):
        
        try:
            hide_field_obj = self.env['hide.field'].sudo()
            for hide_field in hide_field_obj.search([('model_id.model','=',name_manager.model._name),('access_management_id.user_ids','in',self._uid)]):
                for field_id in hide_field.field_id:
                    if (node.tag == 'field' and node.get('name') == field_id.name) or (node.tag == 'label' and 'for' in node.attrib.keys() and node.attrib['for'] == field_id.name):
                        if hide_field.invisible:
                            node_info['modifiers']['invisible'] = hide_field.invisible
                            node.set('invisible', '1')
                        if hide_field.readonly:
                            node_info['modifiers']['readonly'] = hide_field.readonly
                            node.set('readonly', '1')
            if node.get('groups'):
                can_see = self.user_has_groups(groups=node.get('groups'))
                if not can_see:
                    node.set('invisible', '1')
                    node_info['modifiers']['invisible'] = True
                    if 'attrs' in node.attrib:
                        del node.attrib['attrs']    # avoid making field visible later
            del node.attrib['groups']
        except Exception:
            pass
   

    def _postprocess_tag_button(self, node, name_manager, node_info):
        # Hide Any Button
        postprocessor = getattr(super(ir_ui_view, self), '_postprocess_tag_button', False)
        if postprocessor:
            super(ir_ui_view, self)._postprocess_tag_button(node, name_manager, node_info)

        hide = None
        hide_button_obj = self.env['hide.view.nodes']
        hide_button_ids = hide_button_obj.sudo().search([('access_management_id','!=',False)])

        # Filtered with same env user and current model
        hide_button_ids = hide_button_ids.filtered(lambda x : x if self.env.user in x.access_management_id.user_ids and x.model_id.model == name_manager.model._name else None)    
        if hide_button_ids:
            for line in hide_button_ids:
                for btn in line.btn_store_model_nodes_ids:
                    if btn.attribute_name == node.get('name'):
                        if node.get('string'):
                            if btn.attribute_string == node.get('string'):
                                hide = [btn]
                                break
                        else:
                            hide = [btn]
                            break    
                if hide:
                    break

        if hide:
            node.set('invisible', '1')
            if 'attrs' in node.attrib.keys() and node.attrib['attrs']:
                del node.attrib['attrs']
            node_info['modifiers']['invisible'] = True


        return None


    def _postprocess_tag_page(self, node, name_manager, node_info):
        # Hide Any Notebook Page
        postprocessor = getattr(super(ir_ui_view, self), '_postprocess_tag_page', False)
        if postprocessor:
            super(ir_ui_view, self)._postprocess_tag_page(node, name_manager, node_info)

        hide = None
        hide_tab_obj = self.env['hide.view.nodes']
        hide_tab_ids = hide_tab_obj.sudo().search([('access_management_id','!=',False)])

        # Filtered with same env user and current model
        hide_tab_ids = hide_tab_ids.filtered(lambda x : x if self.env.user in x.access_management_id.user_ids and x.model_id.model == name_manager.model._name else None)    
        if hide_tab_ids:
            for line in hide_tab_ids:
                for tab in line.page_store_model_nodes_ids:
                    if tab.attribute_string == node.get('string'):
                        if node.get('name'):
                            if tab.attribute_name == node.get('name'):
                                hide = [tab]
                                break
                        else:
                            hide = [tab]
                            break    
                if hide:
                    break

        if hide:
            node.set('invisible', '1')
            if 'attrs' in node.attrib.keys() and node.attrib['attrs']:
                del node.attrib['attrs']
      
            node_info['modifiers']['invisible'] = True


        return None        
