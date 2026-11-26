// Every user-facing string lives here, from docs/COPY.md.
// Brand rule: the name is "7B", never "the 7B".

export const COPY = {
  brand: "7B",
  gameName: "Postcards",

  hero: {
    headline: "Greetings from 7B.",
    kicker: "Wish you were here. (Oh wait — you are.)",
    sub: "The handbook for everything in, around, and about Sandpoint — plus a little game we call Postcards.",
  },
  home: {
    cta: "Play Postcards",
    join: "Join 7B",
    happeningsTitle: "What's going on in 7B",
    happeningsEmpty: "Quiet week in town. Check back soon — something's always brewing.",
    weatherLabel: "Right now in Sandpoint",
    stripTitle: "Fresh off the wall",
    stripEmpty: "The wall's waiting for its first postcard. Could be yours.",
  },
  footer: "Made in Sandpoint, for 7B. Free for neighbors and visitors alike.",

  game: {
    intro:
      "Five winter missions around town. Do one, snap a photo, send it in. Approved postcards hit the wall and earn their stamps. Most stamps by March 31 gets a prize in their actual mailbox.",
    wallTitle: "The Wall",
    wallSub: "Postcards from all of us",
    wallEmpty: "No postcards yet. The first stamp of the season is up for grabs.",
    standingsTitle: "Winter Standings",
    standingsEmpty: "Nobody's on the board yet. Plenty of winter left.",
    send: "Send this postcard",
    sendHint: "By sending, you're saying it's your photo and it's OK to show on the wall.",
    sent: "Sent! Your postcard is in the mail.",
    pending: "In the mail — your postcard's waiting for a quick look before it posts.",
    rejected: (reason?: string | null) =>
      `This one didn't make the wall${reason ? ": " + reason : ""}. Grab another shot — the stamps are still yours for the taking.`,
    stamped: "Stamped ✓",
    seasonOver: "That's a wrap on winter — the season closed March 31. See you when the lake thaws.",
    seasonOverShort: "That's a wrap on winter — the season's wrapped. See you when the lake thaws.",
    featured: "Postcard of the Week (+25)",
    loginToPlay: "Join 7B to send this one",
  },

  objectivesUnit: "stamps",

  finisher: {
    name: "Winter Finisher",
    line: "All five. Stamped, sent, and on the wall.",
  },

  auth: {
    signupTitle: "Join 7B",
    signupSub: "A name, an email, and you're in. That's the whole form.",
    agree: "I'm 13 or older, these photos are mine, and they're OK to show on the wall.",
    consent: "Send me occasional 7B mail. No spam, ever — we're neighbors.",
    loginTitle: "Welcome back to 7B",
    dupEmail: "Looks like you already have an account — try logging in.",
    dupName: "That name's taken — Sandpoint's smaller than it looks.",
    badEmail: "That email doesn't look quite right.",
    badName: "Display names are 3–24 letters, numbers, or spaces.",
    badPassword: "Passwords need at least 8 characters.",
    needAgree: "Check the box to say you're 13+ and the photos are yours.",
    badLogin: (contact: string) =>
      `That email and password don't match. Forgot it? ${contact} and he'll sort you out.`,
    forgotTitle: "Forgot your password?",
    forgotBody: (contact: string) =>
      `No email robots here yet. ${contact}, and he'll set you up with a temporary password.`,
  },

  errors: {
    type: "Postcards are photos — JPEG only, please.",
    size: "That photo's a little heavy for the mail. Try a smaller one (under 2.5 MB).",
    unreadable: "We couldn't read that photo. Try taking it again, or pick a different one.",
    noPhoto: "Pick a photo first — the mail carrier needs something to carry.",
    dailyCap: "Twenty postcards in one day! Save some winter for tomorrow.",
    alreadyPending: "That one's already in the mail — hang tight while it gets a look.",
    alreadyStamped: "You've already stamped that one. On to the next!",
    noObjective: "That mission isn't on the board.",
    forbidden: "This page is just for 7B's mail room.",
    notFound: "That page wandered off. Probably out sledding.",
    crossSite: "That form came from somewhere else, so we didn't send it.",
  },
} as const;

export function contactLine(email: string): string {
  return email ? `Email Luke at ${email}` : "Message Luke";
}
