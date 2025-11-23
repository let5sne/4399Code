import { supabase } from './supabase.js';

// 加载券种
async function loadCoupons() {
    const container = document.getElementById('couponsContainer');

    // 显示骨架屏 (如果容器为空或已有内容不是骨架屏)
    if (container && !container.querySelector('.skeleton-card')) {
        container.innerHTML = `
            <div class="skeleton-card skeleton"></div>
            <div class="skeleton-card skeleton"></div>
            <div class="skeleton-card skeleton"></div>
        `;
    }

    try {
        const { data: templates, error } = await supabase
            .from('coupon_templates')
            .select('*')
            .eq('status', 'active')
            .gte('valid_until', new Date().toISOString())
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 获取每个券种的剩余数量
        const templatesWithRemaining = await Promise.all(templates.map(async (template) => {
            const { count: totalCount } = await supabase
                .from('coupon_pool')
                .select('*', { count: 'exact', head: true })
                .eq('template_id', template.id);

            const { count: availableCount } = await supabase
                .from('coupon_pool')
                .select('*', { count: 'exact', head: true })
                .eq('template_id', template.id)
                .eq('status', 'available');

            return {
                ...template,
                total: totalCount || 0,
                remaining: availableCount || 0
            };
        }));

        renderCoupons(templatesWithRemaining);
    } catch (error) {
        console.error('加载券种失败:', error);
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">加载失败，请稍后重试</p>
                    <button onclick="window.location.reload()" class="btn-secondary">刷新页面</button>
                </div>
            `;
        }
    }
}

// 渲染券种卡片
function renderCoupons(templates) {
    const container = document.getElementById('couponsContainer');
    if (!container) return;

    if (templates.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1; padding: 2rem;">暂无可用优惠券</p>';
        return;
    }

    container.innerHTML = templates.map(template => {
        const formatDate = (date) => new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

        // Calculate prices and savings
        const isPercentage = template.discount_type === 'percentage';
        const discountValue = parseFloat(template.discount_value);
        const originalPrice = parseFloat(template.original_price) || 0;

        let currentPriceDisplay;
        let savings = 0;

        if (isPercentage) {
            currentPriceDisplay = `${discountValue}折`;
            if (originalPrice > 0) {
                const calculatedPrice = originalPrice * (discountValue / 10);
                savings = (originalPrice - calculatedPrice).toFixed(0);
            }
        } else {
            // Fixed price
            currentPriceDisplay = `¥${discountValue}`;
            if (originalPrice > 0) {
                savings = (originalPrice - discountValue).toFixed(0);
            }
        }

        const creditAmount = template.credit_amount || 0;
        const isSoldOut = template.remaining === 0;

        return `
            <div class="price-card">
                <div class="card-header">
                    <h3 class="product-name">${template.name}</h3>
                    ${creditAmount > 0 ? `<div class="credit-badge">含 $${creditAmount} 额度</div>` : ''}
                    
                    <div class="price-row">
                        <span class="current-price">${currentPriceDisplay}</span>
                        ${originalPrice > 0 ? `<span class="original-price">¥${originalPrice}</span>` : ''}
                    </div>
                    
                    <div class="mb-4">
                        <span class="discount-badge">立省 ¥${savings}</span>
                    </div>

                    <p style="color: var(--text-secondary); font-size: 0.75rem;">
                        有效期：${formatDate(template.valid_from)} - ${formatDate(template.valid_until)}
                    </p>
                    <p style="color: ${template.remaining > 0 ? 'var(--success-color)' : 'var(--error-color)'}; font-size: 0.875rem; margin-top: 0.5rem; font-weight: 500;">
                        剩余: ${template.remaining}/${template.total}
                    </p>
                </div>
                <button class="btn-claim" 
                        data-template-id="${template.id}"
                        data-template-name="${template.name}"
                        data-redirect-url="${template.redirect_url || ''}"
                        ${isSoldOut ? 'disabled' : ''}>
                    ${isSoldOut ? '已抢光' : '领取优惠券'}
                </button>
            </div>
        `;
    }).join('');

    // 绑定点击事件
    attachClaimHandlers();
}

// 绑定领取按钮事件
function attachClaimHandlers() {
    const claimButtons = document.querySelectorAll('.btn-claim');
    claimButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const templateId = button.dataset.templateId;
            const templateName = button.dataset.templateName;
            const redirectUrl = button.dataset.redirectUrl;

            if (!templateId) return;

            // 检查登录状态
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const loginModal = document.getElementById('loginModal');
                if (loginModal) loginModal.classList.add('show');
                return;
            }

            handleClaim(templateId, templateName, session.access_token, redirectUrl);
        });
    });
}

// 处理领取
async function handleClaim(templateId, templateName, token, redirectUrl) {
    showToast(`正在为您领取 ${templateName}...`, 'info');

    try {
        const response = await fetch('https://usmgskzqvjypqvgydaad.supabase.co/functions/v1/site/api/claim-coupon', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ template_id: templateId }),
        });

        const data = await response.json();

        if (data.success) {
            showCouponModal(data.code, redirectUrl);
            // 重新加载券种以更新库存
            await loadCoupons();
        } else {
            showToast('领取失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('网络错误，请稍后重试', 'error');
    }
}

// 显示优惠券模态框
function showCouponModal(code, redirectUrl) {
    const modal = document.getElementById('couponModal');
    const codeElement = document.getElementById('couponCode');
    const useBtn = document.getElementById('useCouponBtn');

    if (codeElement) codeElement.textContent = code;

    if (useBtn) {
        if (redirectUrl) {
            useBtn.href = redirectUrl;
            useBtn.style.display = 'block';
        } else {
            useBtn.href = '#';
            useBtn.style.display = 'none';
        }
    }

    if (modal) modal.classList.add('show');
}

// 显示 Toast 提示
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';

    // Add icon based on type
    let icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    else if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    else icon = '<i class="fas fa-info-circle"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;

    // Set color based on type (optional, can be handled by CSS classes)
    if (type === 'error') {
        toast.style.backgroundColor = 'var(--error-color)';
    } else if (type === 'success') {
        toast.style.backgroundColor = 'var(--success-color)';
    }

    document.body.appendChild(toast);
    toast.offsetHeight; // Trigger reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 更新认证 UI
function updateAuthUI(session) {
    const navLoginBtn = document.getElementById('navLoginBtn');
    const userMenu = document.getElementById('userMenu');
    const userEmail = document.getElementById('userEmail');

    if (session) {
        if (navLoginBtn) navLoginBtn.classList.add('hidden');
        if (userMenu) {
            userMenu.classList.remove('hidden');
            userMenu.classList.add('flex', 'items-center');
        }
        if (userEmail) userEmail.textContent = session.user.email;
    } else {
        if (navLoginBtn) navLoginBtn.classList.remove('hidden');
        if (userMenu) {
            userMenu.classList.add('hidden');
            userMenu.classList.remove('flex');
        }
        if (userEmail) userEmail.textContent = '';
    }
}

// 初始化
try {
    document.addEventListener('DOMContentLoaded', async () => {
        // 加载券种
        await loadCoupons();

        // 检查用户会话
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            updateAuthUI(session);

            supabase.auth.onAuthStateChange((_event, session) => {
                updateAuthUI(session);
            });
        }

        // UI 元素
        const couponModal = document.getElementById('couponModal');
        const loginModal = document.getElementById('loginModal');
        const closeCouponModal = document.querySelector('#couponModal .close-modal');
        const closeLoginModal = document.getElementById('closeLoginModal');
        const copyBtn = document.getElementById('copyCodeBtn');
        const navLoginBtn = document.getElementById('navLoginBtn');
        const loginForm = document.getElementById('loginForm');
        const logoutBtn = document.getElementById('logoutBtn');

        // 模态框关闭事件
        if (closeCouponModal) {
            closeCouponModal.addEventListener('click', () => {
                if (couponModal) couponModal.classList.remove('show');
            });
        }

        if (closeLoginModal) {
            closeLoginModal.addEventListener('click', () => {
                if (loginModal) loginModal.classList.remove('show');
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === couponModal && couponModal) couponModal.classList.remove('show');
            if (e.target === loginModal && loginModal) loginModal.classList.remove('show');
        });

        // 登录流程
        if (navLoginBtn) {
            navLoginBtn.addEventListener('click', () => {
                if (loginModal) loginModal.classList.add('show');
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const emailInput = document.getElementById('emailInput');
                const loginBtn = document.getElementById('loginBtn');
                const message = document.getElementById('loginMessage');

                if (!emailInput || !loginBtn || !message) return;

                const email = emailInput.value;

                loginBtn.disabled = true;
                loginBtn.textContent = '发送中...';

                try {
                    const { error } = await supabase.auth.signInWithOtp({ email });
                    if (error) throw error;

                    message.textContent = '登录链接已发送到您的邮箱，请查收！';
                    message.classList.remove('hidden', 'text-red-500');
                    message.classList.add('text-green-600');
                    showToast('登录链接已发送', 'success');
                } catch (error) {
                    message.textContent = '发送失败: ' + error.message;
                    message.classList.remove('hidden', 'text-green-600');
                    message.classList.add('text-red-500');
                    showToast('发送失败', 'error');
                } finally {
                    loginBtn.disabled = false;
                    loginBtn.textContent = '发送登录链接';
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                showToast('已退出登录');
            });
        }

        // 复制优惠券代码
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const codeElement = document.getElementById('couponCode');
                if (!codeElement) return;

                const code = codeElement.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check">已复制</i>';
                    showToast('优惠码已复制', 'success');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                    }, 2000);
                });
            });
        }
    });
} catch (e) {
    console.error("Failed to initialize app:", e);
}
