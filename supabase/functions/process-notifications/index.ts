import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import webpush from 'npm:web-push'

/** Exponential backoff schedule in milliseconds: 1min, 5min, 15min per D-15 */
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000] // retry_count 0 -> 1min, 1 -> 5min, 2 -> 15min
const MAX_RETRIES = 3

// VAPID setup at module level
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails('mailto:alerts@leagueops.app', vapidPublicKey, vapidPrivateKey)
}

const RESEND_FROM_EMAIL =
  Deno.env.get('RESEND_FROM_EMAIL') ?? 'LeagueOps <onboarding@resend.dev>'

/**
 * Build an HTML email string using the email template contract values.
 * Background: #020810, header accent: #0B3D91, body font: system sans-serif.
 */
function buildEmailHtml(opts: {
  eventName: string
  logoUrl?: string | null
  alertType: string
  title: string
  summary: string
  detail?: string | null
  ctaUrl?: string | null
}): string {
  const { eventName, logoUrl, alertType, title, summary, detail, ctaUrl } = opts

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${eventName}" style="height:40px;width:auto;display:block;margin-bottom:8px;" />`
    : ''

  const detailHtml = detail
    ? `<p style="font-size:16px;color:#c0c8d8;margin:12px 0 0;">${detail}</p>`
    : ''

  const ctaHtml = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:24px;background:#0B3D91;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;">View in App</a>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020810;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020810;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#0B3D91;padding:24px 32px;border-radius:8px 8px 0 0;">
              ${logoHtml}
              <span style="color:#ffffff;font-size:20px;font-weight:700;font-family:system-ui,sans-serif;">${eventName}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#081428;padding:32px;border-radius:0 0 8px 8px;border:1px solid #1a2d50;border-top:none;">
              <p style="margin:0 0 8px;font-size:12px;color:#5a6e9a;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">${alertType}</p>
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${title}</p>
              <p style="font-size:15px;color:#e0e8f8;margin:12px 0 0;">${summary}</p>
              ${detailHtml}
              ${ctaHtml}
              <hr style="border:none;border-top:1px solid #1a2d50;margin:32px 0 16px;" />
              <p style="margin:0;font-size:13px;color:#5a6e9a;">
                You're receiving this because you have a role in <strong style="color:#8090b0;">${eventName}</strong>.
                Manage preferences in the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Resolve recipient user IDs by role-based mapping per alert type (D-17, D-18).
 * All queries are scoped to eventId per CLAUDE.md mandate.
 */
async function resolveRecipients(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  eventId: number,
  alertType: string,
  scope: string,
  scopeId: number | null,
): Promise<string[]> {
  const recipientSet = new Set<string>()

  try {
    if (alertType === 'weather_alert') {
      if (scope === 'field' && scopeId !== null) {
        // Find games on the affected field with status Scheduled or Live
        const { data: games } = await supabase
          .from('games')
          .select('home_team_id, away_team_id')
          .eq('event_id', eventId)
          .eq('field_id', scopeId)
          .in('status', ['Scheduled', 'Live'])

        if (games && games.length > 0) {
          const teamIds = games.flatMap((g: { home_team_id: number; away_team_id: number }) => [
            g.home_team_id,
            g.away_team_id,
          ])
          // Coaches for affected teams
          const { data: coaches } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('event_id', eventId)
            .eq('role', 'coach')
            .in('team_id', teamIds)
          if (coaches) coaches.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
        }
        // All admins for the event
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('event_id', eventId)
          .in('role', ['admin', 'super_admin', 'league_admin'])
        if (admins) admins.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
      } else {
        // scope === 'event' — all admins + all coaches for the event
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('event_id', eventId)
          .in('role', ['admin', 'super_admin', 'league_admin', 'coach'])
        if (roles) roles.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
      }
    } else if (alertType === 'schedule_change') {
      if (scope === 'team' && scopeId !== null) {
        // Coaches for the specific team + admins
        const { data: coaches } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('event_id', eventId)
          .eq('role', 'coach')
          .eq('team_id', scopeId)
        if (coaches) coaches.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))

        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('event_id', eventId)
          .in('role', ['admin', 'super_admin', 'league_admin'])
        if (admins) admins.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
      } else {
        // scope === 'event' — all coaches + admins
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('event_id', eventId)
          .in('role', ['admin', 'super_admin', 'league_admin', 'coach'])
        if (roles) roles.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
      }
    } else if (alertType === 'admin_alert') {
      // Admins only
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('event_id', eventId)
        .in('role', ['admin', 'super_admin', 'league_admin'])
      if (admins) admins.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
    } else if (alertType === 'registration_update') {
      // Program leaders + admins
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('event_id', eventId)
        .in('role', ['admin', 'super_admin', 'league_admin', 'program_leader'])
      if (roles) roles.forEach((r: { user_id: string }) => recipientSet.add(r.user_id))
    }
  } catch (err) {
    console.error('[resolveRecipients] Error resolving recipients:', err)
  }

  return Array.from(recipientSet)
}

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json()
    const record = payload.record

    // Extract required fields from the queue row
    const {
      id,
      event_id: eventId,
      alert_type: alertType,
      scope,
      scope_id: scopeId,
      payload: notificationPayload,
      dedup_key: dedupKey,
      status,
      retry_count: retryCount = 0,
    } = record

    // If already processed or suppressed, skip
    if (status !== 'pending') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ------------------------------------------------------------------
    // Step 3: Dedup check (D-13, NOT-08)
    // Query for same dedup_key within last 5 minutes that was already sent
    // ------------------------------------------------------------------
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from('notification_queue')
      .select('id')
      .eq('dedup_key', dedupKey)
      .neq('id', id)
      .gte('created_at', fiveMinutesAgo)
      .not('notification_sent_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (recent) {
      await supabase.from('notification_queue').update({ status: 'suppressed' }).eq('id', id)
      return new Response(JSON.stringify({ ok: true, suppressed: 'dedup' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // Step 4: Atomic claim (Pitfall 1 prevention)
    // Only succeeds if notification_sent_at is still null
    // ------------------------------------------------------------------
    const { data: claimed, error: claimError } = await supabase
      .from('notification_queue')
      .update({ notification_sent_at: new Date().toISOString(), status: 'processing' })
      .eq('id', id)
      .is('notification_sent_at', null)
      .select()
      .single()

    if (claimError || !claimed) {
      // Another invocation claimed it
      return new Response(JSON.stringify({ ok: true, skipped: 'claimed' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // Step 5: Storm cap check (D-14, NOT-08)
    // Count delivered + processing entries for this event in the last hour
    // ------------------------------------------------------------------
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['delivered', 'processing'])
      .gte('created_at', oneHourAgo)

    if (count !== null && count >= 50) {
      await supabase.from('notification_queue').update({ status: 'suppressed' }).eq('id', id)
      return new Response(JSON.stringify({ ok: true, suppressed: 'storm_cap' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // Step 6: Fetch event details for email branding (D-05)
    // ------------------------------------------------------------------
    const { data: event } = await supabase
      .from('events')
      .select('name, logo_url')
      .eq('id', eventId)
      .single()

    const eventName = event?.name ?? 'LeagueOps Event'
    const eventLogoUrl = event?.logo_url ?? null

    // ------------------------------------------------------------------
    // Step 7: Resolve recipients (D-17, D-18)
    // ------------------------------------------------------------------
    const recipientIds = await resolveRecipients(supabase, eventId, alertType, scope, scopeId)

    if (recipientIds.length === 0) {
      await supabase.from('notification_queue').update({ status: 'delivered' }).eq('id', id)
      return new Response(JSON.stringify({ ok: true, recipients: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // Step 8: Load notification preferences for recipients
    // Default (no row): both channels on
    // ------------------------------------------------------------------
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, email_on, push_on')
      .eq('alert_type', alertType)
      .in('user_id', recipientIds)

    const prefMap = new Map<string, { email_on: boolean; push_on: boolean }>()
    if (prefs) {
      for (const p of prefs) {
        prefMap.set(p.user_id, { email_on: p.email_on, push_on: p.push_on })
      }
    }

    // Extract notification content from payload JSONB
    const notifTitle: string = notificationPayload?.title ?? alertType
    const notifSummary: string = notificationPayload?.summary ?? ''
    const notifDetail: string | null = notificationPayload?.detail ?? null
    const notifCtaUrl: string | null = notificationPayload?.cta_url ?? null

    // Initialize Resend client
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resend = resendApiKey ? new Resend(resendApiKey) : null

    let anyFailed = false
    const logEntries: Array<{
      queue_id: number
      event_id: number
      user_id: string
      channel: string
      status: string
      error_message: string | null
      title: string
      summary: string
      delivered_at: string | null
    }> = []

    // ------------------------------------------------------------------
    // Step 9: Fan out email (NOT-05)
    // ------------------------------------------------------------------
    for (const userId of recipientIds) {
      const pref = prefMap.get(userId)
      const emailOn = pref ? pref.email_on : true // default on

      if (!emailOn) continue
      if (!resend) {
        // No API key configured — log as failed
        logEntries.push({
          queue_id: id,
          event_id: eventId,
          user_id: userId,
          channel: 'email',
          status: 'failed',
          error_message: 'RESEND_API_KEY not configured',
          title: notifTitle,
          summary: notifSummary,
          delivered_at: null,
        })
        anyFailed = true
        continue
      }

      try {
        // Fetch user email from auth.users via admin API
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(userId)
        if (userError || !userData?.user?.email) {
          throw new Error(userError?.message ?? 'No email found for user')
        }

        const userEmail = userData.user.email
        const htmlBody = buildEmailHtml({
          eventName,
          logoUrl: eventLogoUrl,
          alertType: alertType.replace(/_/g, ' ').toUpperCase(),
          title: notifTitle,
          summary: notifSummary,
          detail: notifDetail,
          ctaUrl: notifCtaUrl,
        })

        const { error: sendError } = await resend.emails.send({
          from: RESEND_FROM_EMAIL,
          to: userEmail,
          subject: `[${eventName}] ${notifTitle}`,
          html: htmlBody,
        })

        if (sendError) {
          throw new Error(String(sendError))
        }

        logEntries.push({
          queue_id: id,
          event_id: eventId,
          user_id: userId,
          channel: 'email',
          status: 'delivered',
          error_message: null,
          title: notifTitle,
          summary: notifSummary,
          delivered_at: new Date().toISOString(),
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[email] Failed for user ${userId}:`, errMsg)
        logEntries.push({
          queue_id: id,
          event_id: eventId,
          user_id: userId,
          channel: 'email',
          status: 'failed',
          error_message: errMsg,
          title: notifTitle,
          summary: notifSummary,
          delivered_at: null,
        })
        anyFailed = true
      }
    }

    // ------------------------------------------------------------------
    // Step 10: Fan out push (NOT-06)
    // ------------------------------------------------------------------
    for (const userId of recipientIds) {
      const pref = prefMap.get(userId)
      const pushOn = pref ? pref.push_on : true // default on

      if (!pushOn) continue
      if (!vapidPublicKey || !vapidPrivateKey) continue

      try {
        // Fetch push subscriptions for this user
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId)

        if (!subscriptions || subscriptions.length === 0) continue

        const pushData = JSON.stringify({
          title: notifTitle,
          body: notifSummary,
          icon: eventLogoUrl ?? '/icon.png',
          url: notifCtaUrl,
          eventName,
          appUrl: Deno.env.get('APP_URL') ?? '',
        })

        for (const sub of subscriptions) {
          try {
            const subscriptionObj = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            }
            await webpush.sendNotification(subscriptionObj, pushData)

            logEntries.push({
              queue_id: id,
              event_id: eventId,
              user_id: userId,
              channel: 'push',
              status: 'delivered',
              error_message: null,
              title: notifTitle,
              summary: notifSummary,
              delivered_at: new Date().toISOString(),
            })
          } catch (pushErr) {
            const errMsg = pushErr instanceof Error ? pushErr.message : String(pushErr)
            console.error(`[push] Failed for user ${userId} endpoint ${sub.endpoint}:`, errMsg)
            logEntries.push({
              queue_id: id,
              event_id: eventId,
              user_id: userId,
              channel: 'push',
              status: 'failed',
              error_message: errMsg,
              title: notifTitle,
              summary: notifSummary,
              delivered_at: null,
            })
            anyFailed = true
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[push] Subscription fetch failed for user ${userId}:`, errMsg)
        anyFailed = true
      }
    }

    // ------------------------------------------------------------------
    // Write all log entries to notification_log
    // ------------------------------------------------------------------
    if (logEntries.length > 0) {
      const { error: logError } = await supabase.from('notification_log').insert(logEntries)
      if (logError) {
        console.error('[notification_log] Insert error:', logError.message)
      }
    }

    // ------------------------------------------------------------------
    // Step 11: Update queue row to final status with retry scheduling (D-15)
    // ------------------------------------------------------------------
    if (anyFailed) {
      const newRetryCount = retryCount + 1
      if (newRetryCount >= MAX_RETRIES) {
        // Exhausted all retries — mark permanently failed
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            retry_count: newRetryCount,
            next_retry_at: null,
          })
          .eq('id', id)
      } else {
        // Schedule next retry with exponential backoff per D-15
        const backoffMs =
          RETRY_BACKOFF_MS[retryCount] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]
        const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()
        await supabase
          .from('notification_queue')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt,
            notification_sent_at: null, // Reset claim so retry can re-claim
          })
          .eq('id', id)
      }
    } else {
      // All deliveries succeeded
      await supabase.from('notification_queue').update({ status: 'delivered' }).eq('id', id)
    }

    // ------------------------------------------------------------------
    // Step 12: Return 200 with summary JSON
    // ------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        ok: true,
        recipients: recipientIds.length,
        logEntries: logEntries.length,
        anyFailed,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    // Wrap entire handler in try/catch — return 200 to prevent webhook retry storm
    console.error('[process-notifications] Unhandled error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
