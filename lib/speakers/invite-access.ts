// How an invite email tells the person to get in, depending on
// whether their email matched an existing IGNITE! account. Pure and
// unit-tested; both the speaker and the host invite emails render
// from this so the two flows can never drift apart.
//
// Existing account: their password already works, so the email says
// so and links to /login. Sending a set-password (recovery) link to
// an existing account would invite them to reset a password they use.

export interface InviteAccessBlock {
  intro: string;
  buttonLabel: string;
  // True = the caller generates a set-password link for the button;
  // false = the button is the plain /login page.
  useSetPasswordLink: boolean;
  note: string;
}

export function inviteAccessBlock(accountExisted: boolean): InviteAccessBlock {
  if (accountExisted) {
    return {
      intro:
        "You already have an IGNITE! account under this email, so your usual password works. Log in and have a look around:",
      buttonLabel: "Log in",
      useSetPasswordLink: false,
      note: "Forgotten your password? Reset it from the login page.",
    };
  }
  return {
    intro: "Set a password first, then have a look around:",
    buttonLabel: "Set your password",
    useSetPasswordLink: true,
    note: "The set-password link is good for 24 hours; if it expires, request a new one from the login page.",
  };
}

export function loginUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}/login`;
}
