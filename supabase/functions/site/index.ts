import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
    const url = new URL(req.url);

    // API Endpoint: Claim Coupon
    // Use endsWith to handle potential function name prefixes in path
    if (req.method === "POST" && url.pathname.endsWith("/api/claim-coupon")) {
        try {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
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
                    headers: { "Content-Type": "application/json" },
                });
            }

            const body = await req.json();
            const { template_id } = body;

            if (!template_id) {
                return new Response(JSON.stringify({ error: "Template ID required" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
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
                    headers: { "Content-Type": "application/json" },
                });
            }

            if (!data) {
                return new Response(JSON.stringify({ error: "Failed to claim coupon" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                });
            }

            return new Response(JSON.stringify({
                success: true,
                code: data.code,
                discount: `${data.discount_value}折`,
                message: "优惠券领取成功！"
            }), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    // Serve root - redirect to deployed static site
    if (url.pathname === "/") {
        return new Response("Please use the local HTML files for now. Edge Function static serving is limited.", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    return new Response("Not Found - API endpoint is /api/claim-coupon", { status: 404 });
});
