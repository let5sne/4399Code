import { supabase } from './supabase.js';

// Tab 切换
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // 切换 tab 样式
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // 切换内容
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// 加载券种列表
async function loadTemplates() {
    try {
        const { data: templates, error } = await supabase
            .from('coupon_templates')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 获取每个券种的统计数据
        const templatesWithStats = await Promise.all(templates.map(async (template) => {
            const { count: totalCount } = await supabase
                .from('coupon_pool')
                .select('*', { count: 'exact', head: true })
                .eq('template_id', template.id);

            const { count: claimedCount } = await supabase
                .from('coupon_pool')
                .select('*', { count: 'exact', head: true })
                .eq('template_id', template.id)
                .eq('status', 'claimed');

            return {
                ...template,
                total: totalCount || 0,
                claimed: claimedCount || 0,
                remaining: (totalCount || 0) - (claimedCount || 0)
            };
        }));

        renderTemplatesList(templatesWithStats);
    } catch (error) {
        console.error('加载券种失败:', error);
        alert('加载券种失败，请刷新重试');
    }
}

// 渲染券种列表
function renderTemplatesList(templates) {
    const container = document.getElementById('templatesList');

    if (templates.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">暂无券种，请创建新券种</p>';
        return;
    }

    container.innerHTML = templates.map(template => `
        <div class="template-card">
            <h3>${template.name}</h3>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">${template.description || '无描述'}</p>
            <div class="validity-info">
                ${template.discount_value}${template.discount_type === 'percentage' ? '折' : '元'} | 
                原价: ¥${template.original_price || '-'} | 额度: $${template.credit_amount || '-'} |
                ${template.redirect_url ? `<a href="${template.redirect_url}" target="_blank" style="color: var(--primary-color)">跳转链接</a> |` : ''}
                权重: ${template.sort_order || 0} |
                ${formatDate(template.valid_from)} ~ ${formatDate(template.valid_until)}
                ${formatDate(template.valid_from)} ~ ${formatDate(template.valid_until)}
            </div>
            <div class="template-stats">
                <div class="stat">
                    <div class="stat-value">${template.total}</div>
                    <div class="stat-label">总数</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${template.claimed}</div>
                    <div class="stat-label">已领</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${template.remaining}</div>
                    <div class="stat-label">剩余</div>
                </div>
            </div>
            <div class="template-actions">
                <button class="btn btn-primary" onclick="openImportModal('${template.id}', '${template.name}')">导入券码</button>
                <button class="btn" onclick="openEditModal('${template.id}')">编辑</button>
                <button class="btn" onclick="toggleTemplateStatus('${template.id}', '${template.status}')">
                    ${template.status === 'active' ? '禁用' : '启用'}
                </button>
            </div>
        </div>
    `).join('');
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

// 打开创建/编辑券种模态框
document.getElementById('createTemplateBtn').addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = '创建新券种';
    document.getElementById('templateForm').reset();
    document.querySelector('#templateForm [name="id"]').value = ''; // Clear ID
    document.getElementById('templateModal').classList.add('show');
});

// 打开编辑模态框
window.openEditModal = async function (templateId) {
    try {
        const { data: template, error } = await supabase
            .from('coupon_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (error) throw error;

        const form = document.getElementById('templateForm');
        form.querySelector('[name="id"]').value = template.id;
        form.querySelector('[name="name"]').value = template.name;
        form.querySelector('[name="description"]').value = template.description || '';
        form.querySelector('[name="discount_type"]').value = template.discount_type;
        form.querySelector('[name="discount_value"]').value = template.discount_value;
        form.querySelector('[name="original_price"]').value = template.original_price || '';
        form.querySelector('[name="credit_amount"]').value = template.credit_amount || '';
        form.querySelector('[name="redirect_url"]').value = template.redirect_url || '';
        form.querySelector('[name="sort_order"]').value = template.sort_order || 0;

        // Format dates for datetime-local input (YYYY-MM-DDThh:mm)
        const formatDateForInput = (dateString) => {
            const date = new Date(dateString);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            return date.toISOString().slice(0, 16);
        };

        form.querySelector('[name="valid_from"]').value = formatDateForInput(template.valid_from);
        form.querySelector('[name="valid_until"]').value = formatDateForInput(template.valid_until);

        document.getElementById('modalTitle').textContent = '编辑券种';
        document.getElementById('templateModal').classList.add('show');
    } catch (error) {
        console.error('加载券种详情失败:', error);
        alert('加载失败，请重试');
    }
};

// 关闭模态框
window.closeModal = function (modalId) {
    document.getElementById(modalId).classList.remove('show');
    // 清空表单
    if (modalId === 'templateModal') {
        document.getElementById('templateForm').reset();
        document.querySelector('#templateForm [name="id"]').value = '';
    } else if (modalId === 'importCodesModal') {
        document.getElementById('codesInput').value = '';
        document.getElementById('importResult').style.display = 'none';
    }
};

// 处理券种表单提交 (创建或更新)
document.getElementById('templateForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const id = formData.get('id');

    const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        discount_type: formData.get('discount_type'),
        discount_value: parseFloat(formData.get('discount_value')),
        original_price: parseFloat(formData.get('original_price')) || null,
        credit_amount: parseInt(formData.get('credit_amount')) || null,
        redirect_url: formData.get('redirect_url') || null,
        sort_order: parseInt(formData.get('sort_order')) || 0,
        valid_from: new Date(formData.get('valid_from')).toISOString(),
        valid_until: new Date(formData.get('valid_until')).toISOString()
    };

    try {
        let error;
        if (id) {
            // Update existing
            const result = await supabase
                .from('coupon_templates')
                .update(data)
                .eq('id', id);
            error = result.error;
        } else {
            // Create new
            const result = await supabase
                .from('coupon_templates')
                .insert([data]);
            error = result.error;
        }

        if (error) throw error;

        alert(id ? '券种更新成功！' : '券种创建成功！');
        closeModal('templateModal');
        loadTemplates();
    } catch (error) {
        console.error('保存券种失败:', error);
        alert('保存失败：' + error.message);
    }
});

// 打开导入券码模态框
window.openImportModal = async function (templateId, templateName) {
    // 加载券种列表到下拉框
    try {
        const { data: templates, error } = await supabase
            .from('coupon_templates')
            .select('id, name')
            .eq('status', 'active');

        if (error) throw error;

        const select = document.getElementById('importTemplateSelect');
        select.innerHTML = templates.map(t =>
            `<option value="${t.id}" ${t.id === templateId ? 'selected' : ''}>${t.name}</option>`
        ).join('');

        document.getElementById('importCodesModal').classList.add('show');
    } catch (error) {
        console.error('加载券种失败:', error);
        alert('加载券种失败，请刷新重试');
    }
};

// 导入券码
window.importCodes = async function () {
    const templateId = document.getElementById('importTemplateSelect').value;
    const codesText = document.getElementById('codesInput').value.trim();

    if (!codesText) {
        alert('请输入券码');
        return;
    }

    // 解析券码（支持换行或逗号分隔）
    const codes = codesText
        .split(/[\n,]+/)
        .map(code => code.trim())
        .filter(code => code.length > 0);

    if (codes.length === 0) {
        alert('未检测到有效券码');
        return;
    }

    try {
        // 批量插入到券池
        const poolData = codes.map(code => ({
            template_id: templateId,
            code: code
        }));

        const { data, error } = await supabase
            .from('coupon_pool')
            .insert(poolData)
            .select();

        if (error) throw error;

        document.getElementById('importResult').innerHTML =
            `<div class="import-result">成功导入 ${data.length} 个券码</div>`;
        document.getElementById('importResult').style.display = 'block';

        // 清空输入框
        document.getElementById('codesInput').value = '';

        // 2秒后关闭并刷新
        setTimeout(() => {
            closeModal('importCodesModal');
            loadTemplates();
        }, 2000);

    } catch (error) {
        console.error('导入券码失败:', error);
        document.getElementById('importResult').innerHTML =
            `<div class="import-result error">导入失败：${error.message}</div>`;
        document.getElementById('importResult').style.display = 'block';
    }
};

// 切换券种状态
window.toggleTemplateStatus = async function (templateId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
        const { error } = await supabase
            .from('coupon_templates')
            .update({ status: newStatus })
            .eq('id', templateId);

        if (error) throw error;

        loadTemplates();
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新状态失败，请重试');
    }
};

// 初始化
loadTemplates();
