// Initialize Supabase Client
// NOTE: Replace these with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://usmgskzqvjypqvgydaad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzbWdza3pxdmp5cHF2Z3lkYWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzA4MDksImV4cCI6MjA3OTQwNjgwOX0.9KxkUw8nDRrgy2ee0UgyPf6BTWt403uXgdMiYJzQQuY';

let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    document.addEventListener('DOMContentLoaded', async () => {
        // Check User Session
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            updateAuthUI(session);

            supabase.auth.onAuthStateChange((_event, session) => {
                updateAuthUI(session);
            });
        }

        // UI Elements
        const claimButtons = document.querySelectorAll('.btn-claim');
        const couponModal = document.getElementById('couponModal');
        const loginModal = document.getElementById('loginModal');
        const closeCouponModal = document.querySelector('#couponModal .close-modal');
        const closeLoginModal = document.getElementById('closeLoginModal');
        const copyBtn = document.getElementById('copyCodeBtn');
        const navLoginBtn = document.getElementById('navLoginBtn');
        const loginForm = document.getElementById('loginForm');
        const logoutBtn = document.getElementById('logoutBtn');

        // Modal Close Events
        closeCouponModal.addEventListener('click', () => couponModal.classList.remove('show'));
        closeLoginModal.addEventListener('click', () => loginModal.classList.remove('show'));

        window.addEventListener('click', (e) => {
            if (e.target === couponModal) couponModal.classList.remove('show');
            if (e.target === loginModal) loginModal.classList.remove('show');
        });

        // Login Flow
        navLoginBtn.addEventListener('click', () => {
            loginModal.classList.add('show');
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('emailInput').value;
            const loginBtn = document.getElementById('loginBtn');
            const message = document.getElementById('loginMessage');

            loginBtn.disabled = true;
            loginBtn.textContent = '发送中...';

            try {
                const { error } = await supabase.auth.signInWithOtp({ email });
                if (error) throw error;

                message.textContent = '登录链接已发送到您的邮箱，请查收！';
                message.classList.remove('hidden', 'text-red-500');
                message.classList.add('text-green-600');
            } catch (error) {
                message.textContent = '发送失败: ' + error.message;
                message.classList.remove('hidden', 'text-green-600');
                message.classList.add('text-red-500');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = '发送登录链接';
            }
        });

        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });

        // Copy Code
        copyBtn.addEventListener('click', () => {
            const code = document.getElementById('couponCode').textContent;
            navigator.clipboard.writeText(code).then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });
        });

        // Claim Logic
        claimButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();

                // Check Auth
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    loginModal.classList.add('show');
                    return;
                }

                const productName = button.closest('.price-card').querySelector('.product-name').textContent;
                const targetUrl = button.getAttribute('href');

                handleClaim(productName, targetUrl, session.access_token);
            });
        });
    });

    function updateAuthUI(session) {
        const navLoginBtn = document.getElementById('navLoginBtn');
        const userMenu = document.getElementById('userMenu');
        const userEmail = document.getElementById('userEmail');

        if (session) {
            navLoginBtn.classList.add('hidden');
            userMenu.classList.remove('hidden');
            userMenu.classList.add('flex', 'items-center'); // Ensure flex display
            userEmail.textContent = session.user.email;
        } else {
            navLoginBtn.classList.remove('hidden');
            userMenu.classList.add('hidden');
            userMenu.classList.remove('flex');
            userEmail.textContent = '';
        }
    }

    async function handleClaim(productName, targetUrl, token) {
        showToast(`正在为您领取 ${productName} 优惠券...`);

        try {
            const response = await fetch('/api/claim-coupon', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ product_name: productName }),
            });

            const data = await response.json();

            if (data.success) {
                showCouponModal(data.code, targetUrl);
            } else {
                showToast('领取失败: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('网络错误，请稍后重试');
        }
    }

    function showCouponModal(code, url) {
        const modal = document.getElementById('couponModal');
        document.getElementById('couponCode').textContent = code;
        document.getElementById('useCouponBtn').href = "https://fe.dtyuedan.cn/shop/GOD6NLTH";
        modal.classList.add('show');
    }

    function showToast(message) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

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
