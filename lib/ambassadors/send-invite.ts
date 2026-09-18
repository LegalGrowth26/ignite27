import { render } from "@react-email/render";
import {
  AmbassadorInviteEmail,
  renderAmbassadorInvitePlainText,
  type AmbassadorInviteProps,
} from "@/emails/ambassador-invite";
import { generateSetPasswordLink } from "@/lib/bookings/send-confirmation";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { ambassadorShareUrl } from "./attribution";

export async function sendAmbassadorInvite(opts: {
  firstName: string;
  email: string;
  slug: string;
  compAllowance: number;
}): Promise<void> {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const props: AmbassadorInviteProps = {
    firstName: opts.firstName,
    shareUrl: ambassadorShareUrl(siteUrl, opts.slug),
    compAllowance: opts.compAllowance,
    dashboardUrl: `${siteUrl}/ambassador`,
    setPasswordUrl: await generateSetPasswordLink(opts.email),
  };

  const html = await render(AmbassadorInviteEmail(props));
  const text = renderAmbassadorInvitePlainText(props);
  await sendTransactionalEmail({
    to: opts.email,
    subject: "Your IGNITE! 27 ambassador dashboard",
    html,
    text,
    tag: "ambassador-invite",
  });
}
