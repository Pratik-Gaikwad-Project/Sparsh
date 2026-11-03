import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("MESSAGE_PUSH_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-webhook-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server configuration missing", { status: 500 });
  }

  try {
    const payload = await req.json();
    const message = payload?.record ?? payload?.new ?? payload;

    const receiverId = message?.receiver_id;
    const senderId = message?.sender_id;

    if (!receiverId || !senderId || receiverId === senderId) {
      return new Response("Invalid message record", { status: 200 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const [{ data: receiver }, { data: sender }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, partner_id")
        .eq("id", receiverId)
        .maybeSingle(),

      admin
        .from("profiles")
        .select("id, partner_id, name")
        .eq("id", senderId)
        .maybeSingle(),
    ]);

    if (
      !receiver ||
      !sender ||
      receiver.partner_id !== senderId ||
      sender.partner_id !== receiverId
    ) {
      return new Response("Users are not connected", { status: 200 });
    }

    const { data: tokens, error } = await admin
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", receiverId);

    if (error) throw error;

    if (!tokens?.length) {
      return new Response("No registered devices", { status: 200 });
    }

    const isVoice =
      Boolean(message.voice_path) || Number(message.voice_secs) > 0;

    const notifications = tokens.map(({ expo_push_token }) => ({
      to: expo_push_token,
      sound: "default",
      title: sender.name || "Your partner",
      body: isVoice ? "Sent you a voice message" : "Sent you a message",
      channelId: "messages",
      priority: "high",
      data: {
        type: "chat_message",
        senderId,
      },
    }));

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(notifications),
    });

    const result = await pushResponse.json();

    if (!pushResponse.ok) {
      throw new Error(JSON.stringify(result));
    }

    console.log("Expo push response:", result);

    return new Response(
      JSON.stringify({
        success: true,
        sent: notifications.length,
        result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Push notification error:", error);

    return new Response("Notification delivery failed", {
      status: 500,
    });
  }
});
