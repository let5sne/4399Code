import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(req.url);

    // API Endpoint: Claim Coupon
    // Use endsWith to handle potential function name prefixes in path
    if (req.method === "POST" && url.pathname.endsWith("/api/claim-coupon")) {
        try {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Initialize Supabase Client
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Verify User
            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                return new Response(JSON.stringify({ error: "Invalid Token" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const body = await req.json();
            const { template_id } = body;

            if (!template_id) {
                return new Response(JSON.stringify({ error: "Template ID required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Call the database function to claim coupon from pool
            const { data, error: claimError } = await supabase
                .rpc('claim_coupon_from_pool', {
                    p_template_id: template_id,
                    p_user_email: user.email
                })
                .single();

            if (claimError) {
                console.error("Claim error:", claimError);
                const errorMessage = claimError.message.includes('No coupons available')
                    ? '该优惠券已抢光，请选择其他券种'
                    : '领取失败，请稍后重试';
                return new Response(JSON.stringify({ error: errorMessage }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            if (!data) {
                return new Response(JSON.stringify({ error: "Failed to claim coupon" }), {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Send Email Notification (Async - don't block response)
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey) {
                console.log("Sending email to:", user.email);
                const emailHtml = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                        <h2 style="color: #4f46e5; text-align: center;">🎉 领取成功！</h2>
                        <p>亲爱的开发者，您好！</p>
                        <p>恭喜您成功领取 <strong>4399Code 智能编程助手</strong> 优惠券。</p>
                        
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">您的专属优惠码</p>
                            <p style="margin: 10px 0; font-size: 24px; font-weight: bold; color: #111827; letter-spacing: 2px;">${data.code}</p>
                            <p style="margin: 0; color: #059669; font-weight: 500;">${data.discount_value}折优惠</p>
                        </div>

                        <p><strong>如何使用：</strong></p>
                        <ol style="color: #374151; line-height: 1.6;">
                            <li>访问 4399Code 支付页面</li>
                            <li>在结算时输入上方优惠码</li>
                            <li>享受您的专属折扣！</li>
                        </ol>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://4399code-prom.pages.dev" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">立即使用</a>
                        </div>
                        
                        <p style="margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af;">
                            &copy; 2025 4399Code. All rights reserved.
                        </p>
                    </div>
                `;

                // Fire and forget email sending
                fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${resendApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: "4399Code <onboarding@resend.dev>", // Default test sender
                        to: [user.email],
                        subject: "【4399Code】您的优惠券领取成功！",
                        html: emailHtml,
                    }),
                }).then(res => {
                    if (res.ok) console.log("Email sent successfully");
                    else res.text().then(text => console.error("Failed to send email:", text));
                }).catch(err => console.error("Email error:", err));
            } else {
                console.warn("RESEND_API_KEY not set. Skipping email.");
            }

            return new Response(JSON.stringify({
                success: true,
                code: data.code,
                discount: `${data.discount_value}折`,
                message: "优惠券领取成功！"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    }

    // Serve root - redirect to deployed static site
    if (url.pathname === "/") {
        return new Response("Please use the local HTML files for now. Edge Function static serving is limited.", {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
    }

    return new Response("Not Found - API endpoint is /api/claim-coupon", {
        status: 404,
        headers: corsHeaders
    });
});
