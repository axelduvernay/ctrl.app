// ctrl.app — envoi des notifications push.
//
// Appelée chaque minute par la base (voir supabase/push.sql), et par l'app
// pour la notification de test. Elle ne fait qu'envoyer ce qui est dû :
// l'appeler plus souvent ne renvoie jamais deux fois le même rappel.
//
// Les clés d'envoi (VAPID) sont créées au premier appel et rangées dans la
// base. Aucun secret à configurer.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

async function keys() {
  const read = () => db.from("push_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
  const { data } = await read();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  await db.from("push_keys").upsert(
    { id: 1, public_key: k.publicKey, private_key: k.privateKey },
    { onConflict: "id", ignoreDuplicates: true },
  );
  return (await read()).data!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const k = await keys();
  webpush.setVapidDetails("https://axelduvernay.github.io/ctrl.app/", k.public_key, k.private_key);

  const { data: rows, error } = await db.rpc("claim_pushes");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

  let sent = 0;
  await Promise.all((rows ?? []).map(async (r: Record<string, string | null>) => {
    const payload = JSON.stringify({
      title: r.title, body: r.body, tag: r.block_id || "test", board: r.board_id, block: r.block_id,
    });
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint!, keys: { p256dh: r.p256dh!, auth: r.auth! } },
        payload,
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch (e) {
      // Appareil désabonné (app supprimée, notifications coupées) : on l'oublie.
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", r.endpoint);
      else console.error("Envoi impossible", status, (e as Error).message);
    }
  }));

  return new Response(JSON.stringify({ sent, publicKey: k.public_key }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
