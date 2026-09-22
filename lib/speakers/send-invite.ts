import { render } from "@react-email/render";
import {
  SpeakerInviteEmail,
  renderSpeakerInvitePlainText,
  type SpeakerInviteProps,
} from "@/emails/speaker-invite";
import { generateSetPasswordLink } from "@/lib/bookings/send-confirmation";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";

export async function sendSpeakerInvite(opts: {
  firstName: string;
  email: string;
  slug: string;
}): Promise<void> {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const props: SpeakerInviteProps = {
    firstName: opts.firstName,
    pageUrl: `${siteUrl}/speakers/${opts.slug}`,
    editorUrl: `${siteUrl}/speaker`,
    setPasswordUrl: await generateSetPasswordLink(opts.email),
  };

  const html = await render(SpeakerInviteEmail(props));
  const text = renderSpeakerInvitePlainText(props);
  await sendTransactionalEmail({
    to: opts.email,
    subject: "Your IGNITE! 27 speaker page",
    html,
    text,
    tag: "speaker-invite",
  });
}
