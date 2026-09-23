import { render } from "@react-email/render";
import {
  SpeakerInviteEmail,
  renderSpeakerInvitePlainText,
  type SpeakerInviteProps,
} from "@/emails/speaker-invite";
import { generateSetPasswordLink } from "@/lib/bookings/send-confirmation";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { inviteAccessBlock, loginUrl } from "./invite-access";

export async function sendSpeakerInvite(opts: {
  firstName: string;
  email: string;
  slug: string;
  // True when the invite email matched an existing IGNITE! account:
  // the email says to log in rather than set a password.
  accountExisted: boolean;
}): Promise<void> {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const access = inviteAccessBlock(opts.accountExisted);
  const props: SpeakerInviteProps = {
    firstName: opts.firstName,
    pageUrl: `${siteUrl}/speakers/${opts.slug}`,
    editorUrl: `${siteUrl}/speaker`,
    accessIntro: access.intro,
    accessLabel: access.buttonLabel,
    accessUrl: access.useSetPasswordLink
      ? await generateSetPasswordLink(opts.email)
      : loginUrl(siteUrl),
    accessNote: access.note,
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
